import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MarketPulseView from '../MarketPulseView';
import { fetchMarketPulseData, generateTechnicalThesis } from '../../services/marketPulse';

// Mock child components & services
vi.mock('../../services/marketPulse', () => ({
  fetchMarketPulseData: vi.fn(),
  generateTechnicalThesis: vi.fn()
}));

vi.mock('./MiniCandlestickChart', () => ({
  default: () => <div data-testid="mini-candlestick-chart">Mini Chart</div>
}));

// Mock chrome
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, cb) => cb({})),
      set: vi.fn((data, cb) => cb && cb())
    }
  }
};

describe('MarketPulseView', () => {
  const mockData = [
    {
      category: 'Major Indices',
      indices: [
        {
          symbol: '^GSPC',
          longName: 'S&P 500',
          currentPrice: 5000,
          dailyChangePct: 1.25,
          dist52wH: -1.2,
          rsi: 65,
          trendPhase: 'Structural Bull',
          status: { text: 'Structural Bull', color: 'green' }
        }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then shows loaded data', async () => {
    let resolveData;
    const promise = new Promise((resolve) => {
      resolveData = resolve;
    });
    vi.mocked(fetchMarketPulseData).mockReturnValueOnce(promise);

    render(<MarketPulseView country="US" />);
    
    // Check loading indicator
    expect(screen.getByText(/Fetching data.../i)).toBeInTheDocument();

    // Resolve data
    await act(async () => {
      resolveData(mockData);
    });

    // Check loaded indices
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
  });

  it('handles API error cases gracefully (negative scenario)', async () => {
    vi.mocked(fetchMarketPulseData).mockRejectedValueOnce(new Error('Network Error'));

    render(<MarketPulseView country="US" />);
    
    await act(async () => {
      await Promise.resolve(); // wait for loading state to finish
    });

    // Loading indicator is gone and it doesn't crash
    expect(screen.queryByText(/Fetching data.../i)).toBeNull();
  });

  it('supports searching/filtering indices', async () => {
    vi.mocked(fetchMarketPulseData).mockResolvedValueOnce(mockData);
    render(<MarketPulseView country="US" />);

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = screen.getByPlaceholderText(/Search index.../i);
    fireEvent.change(searchInput, { target: { value: 'NASDAQ' } });

    // S&P 500 is filtered out
    expect(screen.queryByText('S&P 500')).toBeNull();
  });

  it('supports changing sub-tabs and triggers AI insights generation', async () => {
    vi.mocked(fetchMarketPulseData).mockResolvedValue(mockData);
    vi.mocked(generateTechnicalThesis).mockReturnValue('Market Regime is Structural Bull.');
    
    render(<MarketPulseView country="US" />);

    await act(async () => {
      await Promise.resolve();
    });

    // Change to Intelligence sub-tab
    const intelligenceTab = screen.getByText('Trend Matrix');
    fireEvent.click(intelligenceTab);

    expect(screen.getByText('Market Regime is Structural Bull.')).toBeInTheDocument();
  });
});
