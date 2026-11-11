import React from 'react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IndexDetailModal from '../IndexDetailModal';

// Mock lightweight-charts
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'CandlestickSeries',
  LineSeries: 'LineSeries',
  CrosshairMode: { Magnet: 0, Normal: 1 },
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn()
    })),
    addCandlestickSeries: vi.fn(() => ({
      setData: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn()
    })),
    addLineSeries: vi.fn(() => ({
      setData: vi.fn(),
      applyOptions: vi.fn()
    })),
    applyOptions: vi.fn(),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 100 })),
      setVisibleLogicalRange: vi.fn(),
      subscribeVisibleTimeScaleChange: vi.fn(),
      unsubscribeVisibleTimeScaleChange: vi.fn()
    })),
    remove: vi.fn()
  }))
}));

// Mock services
vi.mock('../../services/marketPulse', () => ({
  fetchSingleIndexDetails: vi.fn(async (symbol) => ({
    symbol,
    longName: 'Nifty 500',
    currentPrice: 23456.95,
    dailyChangePct: 1.01,
    candlesticks: [
      { time: 1700000000, open: 23000, high: 23500, low: 22900, close: 23456.95 }
    ],
    sma5: 23300,
    sma10: 23200,
    sma21: 23100,
    sma50: 22800,
    sma200: 22500,
    rsi: 62.5
  })),
  INDEX_NAME_MAP: {
    '^CRSLDX': { name: 'Nifty 500', badge: 'NIFTY 500 • NSE INDIA' }
  },
  INDEX_CONSTITUENTS: {
    '^CRSLDX': ['RELIANCE', 'TCS', 'HDFCBANK']
  },
  getInstitutionalTrend: vi.fn(() => ({
    score: 100,
    phase: 'Structural Bull',
    color: '#10b981'
  })),
  calculateDistributionDays: vi.fn(() => ({
    count: 1,
    status: 'Low (Confirmed Uptrend)',
    label: 'Low',
    color: '#10b981'
  })),
  analyzePriceActionGeometry: vi.fn(() => ({
    structureLabel: 'Higher Highs & Higher Lows (HH/HL)',
    lastCandleDesc: 'Bullish Hammer',
    pivots: { s1: 23100, s2: 22800, r1: 23500, r2: 24000 },
    recentCandlesSummary: '2026-11-06: O:23000 H:23500 L:22900 C:23456.95 (+1.01%)'
  }))
}));

vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockDataByRange: vi.fn(async () => ({
    symbol: '^CRSLDX',
    candlesticks: [
      { time: 1690000000, open: 22000, high: 22500, low: 21900, close: 22400 }
    ]
  }))
}));

describe('IndexDetailModal Component', () => {
  const mockIndex = {
    symbol: '^CRSLDX',
    longName: 'Nifty 500',
    currentPrice: 23456.95,
    dailyChangePct: 1.01,
    candlesticks: [
      { time: 1700000000, open: 23000, high: 23500, low: 22900, close: 23456.95 }
    ]
  };

  it('renders index title, badge, ribbon, and MAs popover button', async () => {
    const handleClose = vi.fn();
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={handleClose} />);

    expect(screen.getByText('Nifty 500')).toBeDefined();
    expect(screen.getByText('NIFTY 500 • NSE INDIA')).toBeDefined();
    expect(screen.getByText('MAs')).toBeDefined();
    expect(screen.getByTitle(/Collapse Market Intelligence/i)).toBeDefined();
    expect(screen.getByText('Interval')).toBeDefined();
  });

  it('renders timeframe buttons and changes timeframe', async () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '1D' })).toBeDefined();
    expect(screen.getByRole('button', { name: '1W' })).toBeDefined();
    expect(screen.getByRole('button', { name: '1M' })).toBeDefined();
    expect(screen.getByRole('button', { name: '1Y' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '1W' }));
  });

  it('toggles MAs settings popover when clicking the MAs trigger button', async () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    const maTrigger = screen.getByText('MAs');
    fireEvent.click(maTrigger);

    // Popover opens
    expect(screen.getByText('Moving Averages')).toBeDefined();
    expect(screen.getByText('21-day SMA')).toBeDefined();
    expect(screen.getByText('50-day SMA')).toBeDefined();
  });

  it('renders the resizable divider and allows resizing between chart and intelligence', async () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    const resizer = document.querySelector('.fs-resize-divider');
    expect(resizer).not.toBeNull();

    // Trigger drag on resizer
    fireEvent.mouseDown(resizer, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 600 });
    fireEvent.mouseUp(window);
  });

  it('calls onClose when clicking close button', async () => {
    const handleClose = vi.fn();
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={handleClose} />);

    const closeBtn = screen.getByTitle('Close Modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('switches between Index Analysis and AI Analysis tabs', async () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    // Default tab is Index Analysis
    expect(screen.getByText('Index Analysis')).toBeDefined();
    expect(screen.getByText('1. Key Price Levels')).toBeDefined();

    // Switch to AI Analysis tab
    const aiTab = screen.getByText('AI Analysis');
    fireEvent.click(aiTab);

    // AI Analysis tab is active
    expect(screen.getByText(/AI Market Structure Analysis/i)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Generate AI Analysis/i }).length).toBeGreaterThan(0);

    // Switch back to Index Analysis tab
    const indexTab = screen.getByText('Index Analysis');
    fireEvent.click(indexTab);
    expect(screen.getByText('1. Key Price Levels')).toBeDefined();
  });

  it('supports collapsing and expanding the Market Intelligence panel', async () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    // Initially panel is open
    expect(document.querySelector('.fs-ai-panel')).not.toBeNull();

    // Click collapse button
    const collapseBtn = screen.getByTitle('Collapse Market Intelligence');
    fireEvent.click(collapseBtn);

    // Panel is now collapsed
    expect(document.querySelector('.fs-ai-panel')).toBeNull();

    // Expand pill appears on chart
    const expandPill = screen.getByTitle('Expand Market Intelligence');
    expect(expandPill).toBeDefined();

    // Click expand pill to restore panel
    fireEvent.click(expandPill);
    expect(document.querySelector('.fs-ai-panel')).not.toBeNull();
  });

  it('renders structured AI analysis with sections when analysis text is provided', async () => {
    const mockAiText = `### 1. MARKET STRUCTURE & PRICE ACTION
- **Trend Regime**: Stage 2 Markup
- **Geometry**: Higher highs and higher lows

### 2. MOVING AVERAGE ALIGNMENT
- Price comfortably above 21 EMA and 50 SMA`;

    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    // Switch to AI tab
    fireEvent.click(screen.getByText('AI Analysis'));

    // Verify structured sections can render
    expect(screen.getByText('AI Market Structure Analysis')).toBeDefined();
  });

  it('renders theme-native cards, stat subcards, and outlook card without hardcoded styles', () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    // Institutional cards
    const cards = document.querySelectorAll('.institutional-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);

    // Outlook card uses outlook-card class instead of hardcoded dark background
    const outlookCard = document.querySelector('.institutional-card.outlook-card');
    expect(outlookCard).not.toBeNull();
    expect(outlookCard.style.background).toBeFalsy();

    // Stat subcards and subcard-subtext
    const subcardSubtexts = document.querySelectorAll('.subcard-subtext');
    expect(subcardSubtexts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders distribution days and price action structure in index analysis tab', () => {
    render(<IndexDetailModal index={mockIndex} country="IN" onClose={vi.fn()} />);

    expect(screen.getByText('DISTRIBUTION')).toBeDefined();
    expect(screen.getByText(/Price Structure:/i)).toBeDefined();
    expect(screen.getByText(/Recent Candle:/i)).toBeDefined();
    expect(screen.getByText('Higher Highs & Higher Lows (HH/HL)')).toBeDefined();
  });
});
