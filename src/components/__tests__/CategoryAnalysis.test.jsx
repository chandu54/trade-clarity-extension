import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import CategoryAnalysisView from '../CategoryAnalysisView';
import DeepViewAi from '../DeepViewAi';
import MiniCandlestickChart from '../MiniCandlestickChart';

// Mock the AI service
vi.mock('../../services/ai', () => ({
  getAiAnalysis: vi.fn(() => Promise.resolve({ rawText: "Mock Analysis Report" }))
}));

const mockStockData = [
  { symbol: 'ABB', currentPrice: 5000, periodChangePct: 12.5, isAdvancing: true },
  { symbol: 'NTPC', currentPrice: 200, periodChangePct: -4.2, isAdvancing: false },
  { symbol: 'RELIANCE', currentPrice: 2500, periodChangePct: 8.0, isAdvancing: true },
];

const mockTimeframe = '3mo';

describe('Category Intelligence Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('CategoryAnalysisView (UI & Logic)', () => {
    it('correctly calculates breadth metrics (Advancers/Decliners)', () => {
      render(
        <CategoryAnalysisView 
          isOpen={true} 
          onClose={() => {}} 
          categoryName="Infrastructure" 
          symbols={['ABB', 'NTPC', 'RELIANCE']}
          initialStockData={mockStockData}
          timeframe={mockTimeframe}
        />
      );

      // Verify the breadth bar labels
      // Use functions to find text split across multiple elements like <span>Adv</span><span>2</span>
      expect(screen.getByText((content, element) => {
        return element.tagName.toLowerCase() === 'span' && content === 'Adv';
      })).toBeInTheDocument();
      expect(screen.getByText((content, element) => {
        return element.tagName.toLowerCase() === 'span' && content === '2' && element.classList.contains('adv');
      })).toBeInTheDocument();

      expect(screen.getByText((content, element) => {
        return element.tagName.toLowerCase() === 'span' && content === 'Dec';
      })).toBeInTheDocument();
      expect(screen.getByText((content, element) => {
        return element.tagName.toLowerCase() === 'span' && content === '1' && element.classList.contains('dec');
      })).toBeInTheDocument();
    });

    it('identifies the absolute performance leader in the "Top Picks" section', () => {
      render(
        <CategoryAnalysisView 
          isOpen={true} 
          onClose={() => {}} 
          categoryName="Infrastructure" 
          symbols={['ABB', 'NTPC', 'RELIANCE']}
          initialStockData={mockStockData}
          timeframe={mockTimeframe}
        />
      );

      // ABB is the leader with +12.5% vs RELIANCE +8.0%
      const picksLabel = screen.getByText('Top Picks');
      const picksValue = picksLabel.nextElementSibling;
      expect(picksValue.textContent).toContain('ABB');
      expect(picksValue.textContent).toContain('RELIANCE');
    });

    it('Scenario: Data Persistence - accurately merges local weekData with fetched stockData', () => {
      const mockWeekData = {
        stocks: {
          ABB: { symbol: 'ABB', sector: 'Power', notes: 'Local conviction high', params: { rs: 99 } }
        }
      };

      render(
        <CategoryAnalysisView 
          isOpen={true} 
          onClose={() => {}} 
          categoryName="Infrastructure" 
          symbols={['ABB']}
          initialStockData={mockStockData}
          weekData={mockWeekData}
          paramDefinitions={{ rs: { label: 'RS', type: 'number' } }}
          sectors={['Power']}
        />
      );

      // Open the edit modal for ABB to see if merged data is there
      // We target the one inside the grid to avoid summary matches in the header
      const abbTile = screen.getAllByText('ABB').find(el => el.closest('.mini-chart-card'));
      fireEvent.click(abbTile);
      
      // Expand parameters so the notes (renderFormContent) become visible in Deep View
      const expandBtn = screen.getByTitle(/Expand Parameters/i);
      fireEvent.click(expandBtn);

      // Verify local data (conviction notes) is present in the document (within textarea)
      expect(screen.getByDisplayValue('Local conviction high')).toBeDefined();
      expect(screen.getByDisplayValue('99')).toBeDefined();
      expect(screen.getByDisplayValue('Power')).toBeDefined();
    });
  });

  describe('DeepViewAi (Intelligence logic)', () => {
    it('maps stockData to stockMetrics correctly for the AI payload', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      
      render(
        <DeepViewAi 
          categoryName="Infrastructure" 
          symbols={['ABB', 'NTPC']}
          stockData={mockStockData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
          timeframe={mockTimeframe}
        />
      );

      // Verify getAiAnalysis was called with correctly mapped data
      expect(getAiAnalysis).toHaveBeenCalledWith(
        'test-key',
        'gemini',
        expect.objectContaining({
          category: 'Infrastructure',
          stockMetrics: expect.objectContaining({
            ABB: expect.objectContaining({ performance: '12.5%' }),
            NTPC: expect.objectContaining({ performance: '-4.2%' })
          })
        }),
        null,
        expect.stringContaining('Lead Institutional Research Analyst'),
        true
      );
    });

    it('enforces "No Tables" instruction in the prompt', async () => {
      const { getAiAnalysis } = await import('../../services/ai');

      render(
        <DeepViewAi 
          categoryName="Infrastructure" 
          symbols={['ABB']}
          stockData={mockStockData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
          timeframe={mockTimeframe}
        />
      );

      const sentPrompt = getAiAnalysis.mock.calls[0][4];
      expect(sentPrompt).toContain('DO NOT USE TABLES');
      expect(sentPrompt).toContain('Leadership Tier');
    });

    it('Scenario: Leadership Identification - accurately passes a single dominant leader to the AI', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      const leadershipData = [
        { symbol: 'LEADER', currentPrice: 100, periodChangePct: 25.0, isAdvancing: true },
        { symbol: 'LAGGARD_A', currentPrice: 50, periodChangePct: 1.0, isAdvancing: true },
        { symbol: 'LAGGARD_B', currentPrice: 50, periodChangePct: 0.5, isAdvancing: true },
      ];

      render(
        <DeepViewAi 
          categoryName="Growth" 
          symbols={['LEADER', 'LAGGARD_A', 'LAGGARD_B']}
          stockData={leadershipData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const payload = getAiAnalysis.mock.calls[0][2];
      expect(payload.stockMetrics['LEADER'].performance).toBe('25.0%');
      expect(payload.stockMetrics['LAGGARD_A'].performance).toBe('1.0%');
    });

    it('Scenario: Sector Trap - accurately passes a group-wide crash to the AI', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      const crashData = [
        { symbol: 'STOCK_A', currentPrice: 100, periodChangePct: -12.0, isAdvancing: false },
        { symbol: 'STOCK_B', currentPrice: 100, periodChangePct: -15.0, isAdvancing: false },
        { symbol: 'STOCK_C', currentPrice: 100, periodChangePct: -10.0, isAdvancing: false },
      ];

      render(
        <DeepViewAi 
          categoryName="Crashing Sector" 
          symbols={['STOCK_A', 'STOCK_B', 'STOCK_C']}
          stockData={crashData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const payload = getAiAnalysis.mock.calls[0][2];
      expect(payload.stockMetrics['STOCK_B'].performance).toBe('-15.0%');
      expect(payload.stockMetrics['STOCK_B'].isUp).toBe(false);
    });

    it('Scenario: Anomaly Detection - accurately passes a "Decoupled" stock to the AI', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      const anomalyData = [
        { symbol: 'ANOMALY', currentPrice: 100, periodChangePct: 8.5, isAdvancing: true },
        { symbol: 'WEAK_A', currentPrice: 100, periodChangePct: -4.0, isAdvancing: false },
        { symbol: 'WEAK_B', currentPrice: 100, periodChangePct: -5.0, isAdvancing: false },
      ];

      render(
        <DeepViewAi 
          categoryName="Weak Sector" 
          symbols={['ANOMALY', 'WEAK_A', 'WEAK_B']}
          stockData={anomalyData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const payload = getAiAnalysis.mock.calls[0][2];
      expect(payload.stockMetrics['ANOMALY'].performance).toBe('8.5%');
      expect(payload.stockMetrics['WEAK_A'].performance).toBe('-4.0%');
    });

    it('Scenario: Empty State - displays graceful error when no symbols are present', () => {
      render(
        <DeepViewAi 
          categoryName="Empty Category" 
          symbols={[]}
          stockData={[]}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      expect(screen.getByText(/No stocks available for analysis/)).toBeInTheDocument();
    });

    it('Scenario: API Failure - displays descriptive error when the service fails', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      getAiAnalysis.mockRejectedValueOnce(new Error("Network Timeout"));

      render(
        <DeepViewAi 
          categoryName="Infrastructure" 
          symbols={['ABB']}
          stockData={mockStockData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const errorMessage = await screen.findByText(/Network Timeout/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('MiniCandlestickChart', () => {
    it('renders null if no data is provided', () => {
      const { container } = render(<MiniCandlestickChart data={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders symbol and price correctly', () => {
      const mockChartData = {
        symbol: 'AAPL',
        longName: 'Apple Inc.',
        currentPrice: 150.50,
        prevClose: 148.00,
        periodChangePct: 1.69,
        isAdvancing: true,
        candlesticks: []
      };

      render(<MiniCandlestickChart data={mockChartData} country="US" />);
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText(/Apple Inc/)).toBeInTheDocument();
    });
  });
});
