import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ZerodhaHeaderDock from '../ZerodhaHeaderDock';
import ZerodhaWatchlistPanel from '../ZerodhaWatchlistPanel';
import ZerodhaIntegration from '../ZerodhaIntegration';
import { extractKiteSymbol, switchKiteSymbol, resetNavigatedSymbol, isZerodhaChartWindow } from '../kiteSymbolNavigator';

describe('kiteSymbolNavigator', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    resetNavigatedSymbol();
    delete window.location;
    window.location = new URL('https://kite.zerodha.com/markets/ext/chart/web/tvc/NSE/SONACOMS/1199105');
  });

  afterEach(() => {
    window.location = originalLocation;
    delete window.tvWidget;
  });

  it('extracts ticker symbol correctly from Zerodha Kite TVC URL path', () => {
    const sym = extractKiteSymbol();
    expect(sym).toBe('SONACOMS');
  });

  it('falls back to document title when path has no symbol', () => {
    window.location = new URL('https://kite.zerodha.com/dashboard');
    document.title = 'APOLLO ₹454.15 - Kite';
    const sym = extractKiteSymbol();
    expect(sym).toBe('APOLLO');
  });

  it('switchKiteSymbol delegates to tvWidget.activeChart().setSymbol if available', () => {
    const mockSetSymbol = vi.fn();
    window.tvWidget = {
      activeChart: () => ({
        setSymbol: mockSetSymbol,
      }),
    };

    const result = switchKiteSymbol('PAYTM');
    expect(result).toBe(true);
    // When instrument token is found, passes instrument token to TradingView chart
    expect(mockSetSymbol).toHaveBeenCalledWith('1716481');
  });
});

describe('ZerodhaHeaderDock', () => {
  const mockStockData = {
    symbol: 'SONACOMS',
    currentPrice: 929.0,
    dailyChangePct: 0.43,
    earningsDate: '2026-11-28',
    params: {
      adr: '4.2%',
      liquidity: '₹85 Cr',
      rs: 'Very Strong',
      movingAverages: 'Above all MAs (10, 21, 50, 200 SMA)',
    },
  };

  it('renders header dock metrics with aligned height and correct pills', () => {
    const handleOpenEdit = vi.fn();
    const { container } = render(
      <ZerodhaHeaderDock
        symbol="SONACOMS"
        stockData={mockStockData}
        currentPrice={929.0}
        dailyChangePct={0.43}
        onOpenEditModal={handleOpenEdit}
      />
    );

    const dock = container.querySelector('.tc-zerodha-header-dock');
    expect(dock).toBeDefined();
    expect(dock.style.height).toBe('32px');

    expect(screen.getByText('SONACOMS')).toBeDefined();
    expect(screen.getByText('ADR')).toBeDefined();
    expect(screen.getByText('4.2%')).toBeDefined();
    expect(screen.getByText('₹85 Cr')).toBeDefined();
    expect(screen.getByText('RS')).toBeDefined();
  });

  it('renders earnings pill properly from liveQuote when stockData lacks earningsDate', () => {
    const { container } = render(
      <ZerodhaHeaderDock
        symbol="TECHNOCRAF"
        stockData={{ symbol: 'TECHNOCRAF' }}
        liveQuote={{ symbol: 'TECHNOCRAF', currentPrice: 490.35, dailyChangePct: -2.23, earningsDaysAway: 2 }}
        currentPrice={490.35}
        dailyChangePct={-2.23}
      />
    );

    const dock = container.querySelector('.tc-zerodha-header-dock');
    expect(dock).toBeDefined();
    // Should display lightning bolt for imminent earnings <= 7d and 2d
    expect(screen.getByText('⚡')).toBeDefined();
    expect(screen.getByText('2d')).toBeDefined();
  });

  it('renders earnings pill properly with formatted date and countdown', () => {
    const { container } = render(
      <ZerodhaHeaderDock
        symbol="TECHNOCRAF"
        stockData={{ symbol: 'TECHNOCRAF' }}
        liveQuote={{ symbol: 'TECHNOCRAF', currentPrice: 490.35, dailyChangePct: -2.23, earningsDate: '2026-11-14', earningsDaysAway: 2 }}
        currentPrice={490.35}
        dailyChangePct={-2.23}
      />
    );

    const dock = container.querySelector('.tc-zerodha-header-dock');
    expect(dock).toBeDefined();
    expect(screen.getByText('⚡')).toBeDefined();
    expect(screen.getByText('Nov 14')).toBeDefined();
    expect(screen.getByText('(2d)')).toBeDefined();
  });

  it('minimizes to glowing circular icon and expands back on click', () => {
    localStorage.clear();
    const { container } = render(
      <ZerodhaHeaderDock
        symbol="SONACOMS"
        stockData={mockStockData}
        currentPrice={929.0}
        dailyChangePct={0.43}
      />
    );

    const minBtn = screen.getByTitle('Minimize metrics dock to floating circle');
    fireEvent.click(minBtn);

    const fab = container.querySelector('.tc-zerodha-minimized-fab');
    expect(fab).toBeDefined();
    expect(screen.getByText('TC: SONACOMS')).toBeDefined();

    fireEvent.click(fab);
    expect(container.querySelector('.tc-zerodha-header-dock')).toBeDefined();
  });
});

describe('ZerodhaWatchlistPanel', () => {
  const mockAppData = {
    weeks: {
      IN: {
        '2026-11-08': {
          stocks: {
            SONACOMS: {
              symbol: 'SONACOMS',
              name: 'Sona BLW Precision',
              sector: 'Auto Components',
              currentPrice: 929.0,
              dailyChangePct: 0.43,
              flagColor: 'green',
              tags: ['VCP'],
              earningsDate: '2026-11-28',
            },
            ACUTAAS: {
              symbol: 'ACUTAAS',
              name: 'Acutaas Chemicals',
              sector: 'Chemicals',
              currentPrice: 3916.9,
              dailyChangePct: 0.88,
              flagColor: 'blue',
              tags: ['IPO Base'],
            },
          },
        },
      },
    },
    watchlists: ['Weekly Focus', 'IPO Momentum'],
  };

  it('renders watchlist panel, lists stocks, and handles selection', () => {
    const handleSelectStock = vi.fn();
    const handleOpenContext = vi.fn();

    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={handleSelectStock}
        onOpenContextMenu={handleOpenContext}
      />
    );

    expect(screen.getByText('TradeClarity.market')).toBeDefined();
    expect(screen.getByText('SONACOMS')).toBeDefined();
    expect(screen.getByText('ACUTAAS')).toBeDefined();

    // Click stock row
    fireEvent.click(screen.getByText('ACUTAAS'));
    expect(handleSelectStock).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'ACUTAAS' })
    );
  });

  it('allows grouping by sector, flag, tag, or flat list', () => {
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    // Default grouping is sector
    expect(screen.getByText('Auto Components')).toBeDefined();
    expect(screen.getByText('Chemicals')).toBeDefined();

    // Open group menu
    const groupBtn = screen.getByTitle('Group Watchlist');
    fireEvent.click(groupBtn);

    // Click Flat List
    fireEvent.click(screen.getByText('Flat List'));

    expect(screen.queryByText('Auto Components')).toBeNull();
    expect(screen.getByText('SONACOMS')).toBeDefined();
  });

  it('triggers drag and drop reordering callback on drop', () => {
    const handleReorder = vi.fn();
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
        onReorderStocks={handleReorder}
      />
    );

    const sonaRow = document.getElementById('tc-stock-row-SONACOMS');
    const acutaasRow = document.getElementById('tc-stock-row-ACUTAAS');

    fireEvent.dragStart(sonaRow, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: 'move',
      },
    });

    fireEvent.dragOver(acutaasRow, {
      dataTransfer: { dropEffect: 'move' },
    });

    fireEvent.drop(acutaasRow, {
      dataTransfer: { getData: () => 'SONACOMS' },
    });

    expect(handleReorder).toHaveBeenCalledWith(['ACUTAAS', 'SONACOMS'], '2026-11-08');
  });

  it('supports collapsing into compact icon rail and expanding', () => {
    const { container } = render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    const collapseBtn = screen.getByTitle('Collapse Sidebar');
    fireEvent.click(collapseBtn);

    const panel = container.querySelector('.tc-zerodha-watchlist-panel');
    expect(panel.classList.contains('collapsed')).toBe(true);

    // Expand
    const expandBtn = screen.getByTitle('Expand TradeClarity Watchlists');
    fireEvent.click(expandBtn);
    expect(panel.classList.contains('collapsed')).toBe(false);
  });

  it('renders resizer handle and adjusts width on drag', () => {
    const { container } = render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    const resizer = container.querySelector('.tc-panel-resizer-handle');
    expect(resizer).toBeDefined();

    // Start drag resize
    fireEvent.mouseDown(resizer, { clientX: 500 });
    expect(document.documentElement.classList.contains('tc-resizing')).toBe(true);

    // Drag move to 400px width (window.innerWidth is 1024 by default in jsdom)
    fireEvent.mouseMove(window, { clientX: 624 });
    const panel = container.querySelector('.tc-zerodha-watchlist-panel');
    expect(panel.style.width).toBe('400px');

    // End drag
    fireEvent.mouseUp(window);
    expect(document.documentElement.classList.contains('tc-resizing')).toBe(false);
  });

  it('does not render circle avatar and renders dash for stocks with zero price', () => {
    const unlistedStockData = {
      weeks: {
        IN: {
          '2026-11-08': {
            stocks: {
              JPL: {
                symbol: 'JPL',
                name: 'Jio Platforms Limited',
                sector: 'Communications',
                currentPrice: 0,
                dailyChangePct: 0,
              },
            },
          },
        },
      },
      watchlists: [],
    };

    const { container } = render(
      <ZerodhaWatchlistPanel
        appData={unlistedStockData}
        region="IN"
        activeSymbol="JPL"
        onSelectStock={vi.fn()}
      />
    );

    // Verify initials avatar circle is removed
    const circleAvatar = container.querySelector('div[style*="border-radius: 50%"]');
    expect(circleAvatar).toBeNull();

    // Unlisted/zero price stock should display '-' rather than a misleading '+0.00%'
    expect(screen.getByText('-')).toBeDefined();
    expect(screen.queryByText('+0.00%')).toBeNull();
  });
});

describe('ZerodhaIntegration master component', () => {
  beforeEach(() => {
    delete window.location;
    window.location = new URL('https://kite.zerodha.com/markets/ext/chart/web/tvc/NSE/SONACOMS/1199105');
  });

  it('mounts without crashing and initializes safely', () => {
    render(<ZerodhaIntegration />);
    expect(screen.getByText('TradeClarity.market')).toBeDefined();
  });

  it('handles arrow key navigation to cycle stocks', () => {
    render(<ZerodhaIntegration />);

    // Press ArrowDown
    fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' });
    // Press ArrowUp
    fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' });
  });

  it('correctly distinguishes between external chart windows and general app pages', () => {
    // External popout chart windows
    expect(isZerodhaChartWindow('https://kite.zerodha.com/markets/ext/chart/web/tvc/NSE/MANIPALHOS/195675393')).toBe(true);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/markets/ext/chart/web/tvc/NSE/TRENT/1199105')).toBe(true);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/markets/ext/chart/web/ciq/NSE/RELIANCE/738561')).toBe(true);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/chart/web/tvc/NSE/SBIN/779521')).toBe(true);

    // General Kite app pages (must NOT enable)
    expect(isZerodhaChartWindow('https://kite.zerodha.com/holdings/equity')).toBe(false);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/dashboard')).toBe(false);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/positions')).toBe(false);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/orders')).toBe(false);
    expect(isZerodhaChartWindow('https://kite.zerodha.com/funds')).toBe(false);
  });

  it('does not render on general app pages like /holdings/equity', () => {
    delete window.location;
    window.location = new URL('https://kite.zerodha.com/holdings/equity');

    const { container } = render(<ZerodhaIntegration />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('TradeClarity')).toBeNull();
  });
});
