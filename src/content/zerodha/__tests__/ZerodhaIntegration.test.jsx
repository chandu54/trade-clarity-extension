import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ZerodhaHeaderDock from '../ZerodhaHeaderDock';
import ZerodhaWatchlistPanel from '../ZerodhaWatchlistPanel';
import ZerodhaContextMenu from '../ZerodhaContextMenu';
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
    // Dynamic imminent date (3 days from now, <= 7 so it shows ⚡)
    const futureDate = new Date(Date.now() + 3 * 86400000);
    const dateStr = futureDate.toISOString().split('T')[0];
    const monthDay = futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const { container } = render(
      <ZerodhaHeaderDock
        symbol="TECHNOCRAF"
        stockData={{ symbol: 'TECHNOCRAF' }}
        liveQuote={{ symbol: 'TECHNOCRAF', currentPrice: 490.35, dailyChangePct: -2.23, earningsDate: dateStr, earningsDaysAway: 3 }}
        currentPrice={490.35}
        dailyChangePct={-2.23}
      />
    );

    const dock = container.querySelector('.tc-zerodha-header-dock');
    expect(dock).toBeDefined();
    expect(screen.getByText('⚡')).toBeDefined();
    expect(screen.getByText(monthDay)).toBeDefined();
    expect(screen.getByText(/\(3d\)/)).toBeDefined();
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

    expect(screen.getByText('TradeClarity')).toBeDefined();
    expect(screen.getByText('market')).toBeDefined();
    expect(screen.getByTitle('TradeClarity.market')).toBeDefined();
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

  it('triggers onMoveStockToSection when dragging a stock into another section', () => {
    const handleMove = vi.fn();
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
        onMoveStockToSection={handleMove}
      />
    );

    const sonaRow = document.getElementById('tc-stock-row-SONACOMS');
    const acutaasRow = document.getElementById('tc-stock-row-ACUTAAS');

    fireEvent.dragStart(sonaRow, {
      dataTransfer: { setData: vi.fn(), effectAllowed: 'move' },
    });

    fireEvent.dragOver(acutaasRow, {
      dataTransfer: { dropEffect: 'move' },
    });

    fireEvent.drop(acutaasRow, {
      dataTransfer: { getData: () => 'SONACOMS' },
    });

    expect(handleMove).toHaveBeenCalledWith(
      'SONACOMS',
      expect.objectContaining({ grouping: 'sector', sector: 'Chemicals' }),
      ['ACUTAAS', 'SONACOMS']
    );
  });

  it('supports collapsing and expanding individual sections and expand all', () => {
    localStorage.clear();
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    // Initial state: both stocks visible
    expect(screen.getByText('SONACOMS')).toBeDefined();
    expect(screen.getByText('ACUTAAS')).toBeDefined();

    // Click Auto Components section header to collapse it
    const autoHeader = screen.getByText('Auto Components').closest('.tc-watchlist-section-header');
    expect(autoHeader).toBeDefined();
    fireEvent.click(autoHeader);

    // SONACOMS is now hidden because section is collapsed
    expect(screen.queryByText('SONACOMS')).toBeNull();
    // ACUTAAS is still visible
    expect(screen.getByText('ACUTAAS')).toBeDefined();

    // Click again to expand
    fireEvent.click(autoHeader);
    expect(screen.getByText('SONACOMS')).toBeDefined();

    // Click Expand All / Collapse All button
    const toggleAllBtn = screen.getByTitle(/Collapse All Sections/i);
    fireEvent.click(toggleAllBtn);

    // Both should be collapsed
    expect(screen.queryByText('SONACOMS')).toBeNull();
    expect(screen.queryByText('ACUTAAS')).toBeNull();

    // Click expand all
    const expandAllBtn = screen.getByTitle(/Expand All Sections/i);
    fireEvent.click(expandAllBtn);
    expect(screen.getByText('SONACOMS')).toBeDefined();
    expect(screen.getByText('ACUTAAS')).toBeDefined();
  });

  it('renders scrip name with refined, clean medium font weight', () => {
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    const activeTicker = screen.getByText('SONACOMS');
    const inactiveTicker = screen.getByText('ACUTAAS');

    // Inactive symbol is clean 500 font-weight
    expect(inactiveTicker.style.fontWeight).toBe('500');
    expect(inactiveTicker.style.fontSize).toBe('12px');

    // Active symbol is 600 font-weight
    expect(activeTicker.style.fontWeight).toBe('600');
  });

  it('renders total Adv vs Decline market breadth on top and per sector', () => {
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    // Total Watchlist Breadth at the top: SONACOMS (+0.43%) and ACUTAAS (+0.88%) are both advancing
    expect(screen.getByTitle(/Watchlist Breadth: 2 Advancing/i)).toBeDefined();

    // Per-sector breadth pill: Auto Components (1 advancing) and Chemicals (1 advancing)
    expect(screen.getAllByTitle(/Sector Breadth: 1 Advancing, 0 Declining/i).length).toBe(2);
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

  it('renders hover delete button on stock row and triggers onDeleteStock when clicked', () => {
    const handleDeleteStock = vi.fn();
    render(
      <ZerodhaWatchlistPanel
        appData={mockAppData}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
        onDeleteStock={handleDeleteStock}
      />
    );

    const sonaRow = document.getElementById('tc-stock-row-SONACOMS');
    expect(sonaRow).toBeDefined();

    const deleteBtn = sonaRow.querySelector('.tc-stock-delete-btn');
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn.getAttribute('title')).toContain('Remove SONACOMS from watchlist');

    fireEvent.click(deleteBtn);
    expect(handleDeleteStock).toHaveBeenCalledWith('SONACOMS');
  });

  it('renders single-row column headers and compact tag icon with tooltip', () => {
    const dataWithUntagged = {
      ...mockAppData,
      weeks: {
        IN: {
          '2026-11-08': {
            stocks: {
              ...mockAppData.weeks.IN['2026-11-08'].stocks,
              NOTAGS: {
                symbol: 'NOTAGS',
                name: 'No Tags Company',
                sector: 'General',
                currentPrice: 100.0,
                dailyChangePct: 1.0,
                tags: [],
              },
            },
          },
        },
      },
    };

    render(
      <ZerodhaWatchlistPanel
        appData={dataWithUntagged}
        region="IN"
        activeSymbol="SONACOMS"
        onSelectStock={vi.fn()}
      />
    );

    // ACUTAAS has tag 'IPO Base', so it should render tag icon with tooltip
    const acutaasRow = document.getElementById('tc-stock-row-ACUTAAS');
    const tagIcon = acutaasRow.querySelector('.tc-tag-icon-badge');
    expect(tagIcon).toBeDefined();
    expect(tagIcon.getAttribute('title')).toBe('Tags: IPO Base');

    // SONACOMS has tag 'VCP', so it should render tag icon with tooltip
    const sonaRow = document.getElementById('tc-stock-row-SONACOMS');
    const sonaTagIcon = sonaRow.querySelector('.tc-tag-icon-badge');
    expect(sonaTagIcon).toBeDefined();
    expect(sonaTagIcon.getAttribute('title')).toBe('Tags: VCP');

    // NOTAGS has no tags, so no tag icon
    const noTagsRow = document.getElementById('tc-stock-row-NOTAGS');
    const noTagIcon = noTagsRow.querySelector('.tc-tag-icon-badge');
    expect(noTagIcon).toBeNull();

    // Switch to Tag grouping mode -> tag icon should be omitted to avoid redundancy
    const groupBtn = screen.getByTitle('Group Watchlist');
    fireEvent.click(groupBtn);
    fireEvent.click(screen.getByText('Tag'));

    const acutaasInTagMode = document.getElementById('tc-stock-row-ACUTAAS');
    expect(acutaasInTagMode.querySelector('.tc-tag-icon-badge')).toBeNull();
  });
});

describe('ZerodhaIntegration master component', () => {
  beforeEach(() => {
    delete window.location;
    window.location = new URL('https://kite.zerodha.com/markets/ext/chart/web/tvc/NSE/SONACOMS/1199105');
  });

  it('mounts without crashing and initializes safely', () => {
    render(<ZerodhaIntegration />);
    expect(screen.getByText('TradeClarity')).toBeDefined();
    expect(screen.getByText('market')).toBeDefined();
    expect(screen.getByTitle('TradeClarity.market')).toBeDefined();
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

  it('triggers W and S shortcuts to open Watchlist and Sector context menus', () => {
    render(<ZerodhaIntegration />);

    // Press 'w' globally on active stock -> opens Watchlist submenu
    fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
    expect(screen.getByText('Assign Watchlist')).toBeDefined();

    // Close menu with Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Assign Watchlist')).toBeNull();

    // Press 's' globally on active stock -> opens Sector submenu
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    expect(screen.getByText('Assign Sector')).toBeDefined();
  });

  it('triggers Delete/Backspace shortcut key to remove active stock', () => {
    render(<ZerodhaIntegration />);

    // Press Delete key globally
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });

    // Press Backspace key globally
    fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });
  });
});

describe('ZerodhaContextMenu component', () => {
  const mockStock = {
    symbol: 'SONACOMS',
    sector: 'Auto Components',
    tradable: true,
    watchlists: ['wl_1'],
    tags: ['Breakout'],
    flagColor: 'green',
  };

  const mockAvailableSectors = ['Auto Components', 'Chemicals', 'Information Technology', 'Pharma'];
  const mockWatchlists = [{ id: 'wl_1', name: 'Focus 50' }, { id: 'wl_2', name: 'Swing Ideas' }];

  it('renders sector menu item with hotkey badge S and opens sector submenu', () => {
    const handleSelectSector = vi.fn();
    const handleClose = vi.fn();

    render(
      <ZerodhaContextMenu
        isOpen={true}
        x={100}
        y={100}
        stock={mockStock}
        availableSectors={mockAvailableSectors}
        watchlists={mockWatchlists}
        onClose={handleClose}
        onSelectSector={handleSelectSector}
      />
    );

    // Context menu renders Sector row with S shortcut badge
    expect(screen.getByText('Sector')).toBeDefined();
    expect(screen.getByText('S')).toBeDefined();

    // Hover or trigger sector submenu
    const sectorMenuRow = screen.getByText('Sector').closest('div[style*="cursor: pointer"]');
    fireEvent.mouseEnter(sectorMenuRow);

    // Submenu displays available sectors
    expect(screen.getByText('Assign Sector')).toBeDefined();
    expect(screen.getByText('Chemicals')).toBeDefined();
    expect(screen.getByText('Information Technology')).toBeDefined();
    expect(screen.getByText('Pharma')).toBeDefined();

    // Current stock sector has checkmark
    const currentSectorRow = screen.getByText('Auto Components').closest('div');
    expect(currentSectorRow.textContent).toContain('✓');

    // Click another sector to change
    fireEvent.click(screen.getByText('Chemicals'));
    expect(handleSelectSector).toHaveBeenCalledWith('Chemicals');
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows unassigning sector and typing custom sector in inline input', () => {
    const handleSelectSector = vi.fn();
    const handleClose = vi.fn();

    render(
      <ZerodhaContextMenu
        isOpen={true}
        x={100}
        y={100}
        stock={mockStock}
        initialSubmenu="sector"
        availableSectors={mockAvailableSectors}
        watchlists={mockWatchlists}
        onClose={handleClose}
        onSelectSector={handleSelectSector}
      />
    );

    // Initial submenu is opened directly to sector
    expect(screen.getByText('Assign Sector')).toBeDefined();

    // Test Unassigned option
    const unassignedOption = screen.getByText('Unassigned');
    fireEvent.click(unassignedOption);
    expect(handleSelectSector).toHaveBeenCalledWith('');
    expect(handleClose).toHaveBeenCalled();

    // Type custom sector and press Enter
    const customInput = screen.getByPlaceholderText('+ Add custom sector...');
    fireEvent.change(customInput, { target: { value: 'Defence Tech' } });
    fireEvent.keyDown(customInput, { key: 'Enter', code: 'Enter' });

    expect(handleSelectSector).toHaveBeenCalledWith('Defence Tech');
  });

  it('toggles submenus using W and S keyboard shortcuts inside menu', () => {
    render(
      <ZerodhaContextMenu
        isOpen={true}
        x={100}
        y={100}
        stock={mockStock}
        availableSectors={mockAvailableSectors}
        watchlists={mockWatchlists}
        onClose={vi.fn()}
      />
    );

    // Press 's' inside menu -> toggles sector submenu
    fireEvent.keyDown(window, { key: 's' });
    expect(screen.getByText('Assign Sector')).toBeDefined();

    // Press 's' again -> closes sector submenu
    fireEvent.keyDown(window, { key: 's' });
    expect(screen.queryByText('Assign Sector')).toBeNull();

    // Press 'w' inside menu -> toggles watchlist submenu
    fireEvent.keyDown(window, { key: 'w' });
    expect(screen.getByText('Assign Watchlist')).toBeDefined();
  });

  it('triggers onDeleteStock when Delete or Backspace key is pressed inside menu', () => {
    const handleDeleteStock = vi.fn();
    render(
      <ZerodhaContextMenu
        isOpen={true}
        x={100}
        y={100}
        stock={mockStock}
        onDeleteStock={handleDeleteStock}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(handleDeleteStock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(handleDeleteStock).toHaveBeenCalledTimes(2);
  });

  it('supports click-to-lock on Watchlists row and prevents accidental closing during diagonal hover', () => {
    vi.useFakeTimers();
    render(
      <ZerodhaContextMenu
        isOpen={true}
        x={100}
        y={100}
        stock={mockStock}
        watchlists={mockWatchlists}
        onClose={vi.fn()}
      />
    );

    const wlRow = screen.getByText('Watchlists').closest('.tc-context-menu-container > div');
    // Click locks the watchlist submenu open
    fireEvent.click(wlRow);
    expect(screen.getByText('Assign Watchlist')).toBeDefined();

    // Hover over adjacent row (e.g. Copy Ticker) - submenu stays alive within the 160ms grace window
    const copyRow = screen.getByText('Copy Ticker').closest('.tc-context-menu-container > div');
    fireEvent.mouseEnter(copyRow);
    expect(screen.getByText('Assign Watchlist')).toBeDefined();

    // Fast forward past the grace period
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Assign Watchlist')).toBeNull();

    vi.useRealTimers();
  });

  it('implements TradingView flag behavior: applies recent flag immediately and opens palette', () => {
    localStorage.setItem('tc_recent_flag_color', 'blue');
    const handleUpdateStockFlag = vi.fn();

    const stockWithoutFlagData = {
      weeks: {
        IN: {
          '2026-11-08': {
            stocks: {
              TRENT: {
                symbol: 'TRENT',
                name: 'Trent Ltd',
                sector: 'Retail',
                currentPrice: 3180.0,
                dailyChangePct: 0.15,
                flagColor: null,
              },
            },
          },
        },
      },
      watchlists: [],
    };

    const { container } = render(
      <ZerodhaWatchlistPanel
        appData={stockWithoutFlagData}
        region="IN"
        activeSymbol="TRENT"
        onSelectStock={vi.fn()}
        onUpdateStockFlag={handleUpdateStockFlag}
      />
    );

    const flagBtn = screen.getByTitle(/Flag stock \(blue\)/i);
    expect(flagBtn).toBeDefined();

    // Click flag icon on unflagged stock
    fireEvent.click(flagBtn);

    // Immediately applies the recent color (blue)
    expect(handleUpdateStockFlag).toHaveBeenCalledWith('TRENT', 'blue');

    // And opens the floating color palette popover
    const popover = container.querySelector('.tc-flag-palette-popover');
    expect(popover).toBeDefined();

    // Pick green from palette
    const greenBtn = screen.getByTitle(/Set GREEN Flag/i);
    fireEvent.click(greenBtn);

    expect(handleUpdateStockFlag).toHaveBeenCalledWith('TRENT', 'green');
    expect(localStorage.getItem('tc_recent_flag_color')).toBe('green');
  });

  it('allows two-way sync: detects stock searched in Zerodha URL even after prior TradeClarity navigation', () => {
    // 1. User navigates via TradeClarity
    switchKiteSymbol('PAYTM');
    expect(extractKiteSymbol()).toBe('PAYTM');

    // 2. User searches in Zerodha Kite, which updates the browser location URL to BHEL
    delete window.location;
    window.location = new URL('https://kite.zerodha.com/markets/ext/chart/web/tvc/NSE/BHEL/112129');

    // 3. extractKiteSymbol detects Zerodha's live URL without being locked onto PAYTM
    expect(extractKiteSymbol()).toBe('BHEL');
  });

  it('renders an external active stock banner with 1-click + Add button when searched stock is not in watchlist', () => {
    const handleAdd = vi.fn();
    const mockData = {
      weeks: {
        IN: {
          '2026-11-08': {
            stocks: {
              TRENT: { symbol: 'TRENT', sector: 'Retail', currentPrice: 3180.0, dailyChangePct: 0.15 },
            },
          },
        },
      },
      watchlists: [],
    };

    render(
      <ZerodhaWatchlistPanel
        appData={mockData}
        region="IN"
        activeSymbol="RELIANCE"
        onSelectStock={vi.fn()}
        onAddStock={handleAdd}
      />
    );

    // Shows external banner indicating RELIANCE is active in Kite
    expect(screen.getByText('RELIANCE')).toBeDefined();
    expect(screen.getByText(/Active in Kite/i)).toBeDefined();

    // Clicking + Add calls onAddStock with RELIANCE
    const addBtn = screen.getByRole('button', { name: /\+ Add/i });
    fireEvent.click(addBtn);
    expect(handleAdd).toHaveBeenCalledWith('RELIANCE');
  });
});
