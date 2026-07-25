import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditStockModal from '../EditStockModal';
import * as yahooFinanceMap from '../../utils/yahooFinanceMap';

vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockData: vi.fn().mockResolvedValue([]),
  fetchStockQuotes: vi.fn().mockResolvedValue([])
}));

describe('EditStockModal', () => {
  const mockStock = {
    symbol: 'AAPL',
    sector: 'Tech',
    tradable: true,
    notes: 'Good stock',
    params: { rs: 85 },
    tags: ['Growth'],
    watchlists: ['wl1']
  };

  const props = {
    isOpen: true,
    onClose: vi.fn(),
    stock: mockStock,
    onSave: vi.fn(),
    paramDefinitions: { rs: { label: 'RS', type: 'number' } },
    sectors: ['Tech', 'Finance'],
    availableTags: ['Growth', 'Value'],
    weekInfo: 'Week 14',
    country: 'US',
    showTags: true,
    watchlists: [{ id: 'wl1', name: 'Watchlist 1' }, { id: 'wl2', name: 'Watchlist 2' }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with stock data', () => {
    render(<EditStockModal {...props} />);
    // Symbol is rendered in a larger header string in both modes
    expect(screen.getByText(/AAPL/)).toBeDefined();
    expect(screen.getByDisplayValue('Tech')).toBeDefined();
    expect(screen.getByDisplayValue('Good stock')).toBeDefined();
  });

  it('updates form data on change', () => {
    render(<EditStockModal {...props} />);
    
    const notesArea = screen.getByPlaceholderText(/Technical triggers, conviction level/i);
    fireEvent.change(notesArea, { target: { value: 'Updated notes' } });
    
    expect(screen.getByDisplayValue('Updated notes')).toBeDefined();
  });

  it('calls onSave with updated data when Save is clicked', () => {
    render(<EditStockModal {...props} />);
    
    const rsInput = screen.getByDisplayValue('85');
    fireEvent.change(rsInput, { target: { value: '90' } });
    
    fireEvent.click(screen.getByText(/^Save( Changes)?$/));
    
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      params: { rs: '90' }
    }));
  });

  it('toggles tags on correctly', () => {
    render(<EditStockModal {...props} />);
    
    // Clicking the tag text should bubble to the pill container's onClick
    const valueTag = screen.getByText('Value');
    fireEvent.click(valueTag);
    
    fireEvent.click(screen.getByText(/^Save( Changes)?$/));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['Growth', 'Value']
    }));
  });

  it('toggles tags off correctly', () => {
    render(<EditStockModal {...props} />);
    
    // Toggle off existing tag by clicking its text
    const growthTag = screen.getByText('Growth');
    fireEvent.click(growthTag);
    
    fireEvent.click(screen.getByText(/^Save( Changes)?$/));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      tags: []
    }));
  });

  it('supports keyboard navigation for tags (Enter/Space)', () => {
    render(<EditStockModal {...props} />);
    
    // Find the focusable pill container
    const valueTag = screen.getByText('Value').closest('.tag-chip-selectable');
    
    // Toggle on with Enter
    fireEvent.keyDown(valueTag, { key: 'Enter' });
    
    fireEvent.click(screen.getByText(/^Save( Changes)?$/));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['Growth', 'Value']
    }));
  });

  it('toggles watchlists correctly', () => {
    render(<EditStockModal {...props} />);
    
    // Search for the watchlist pill and click its container
    const wl2Pill = screen.getByText('Watchlist 2').closest('.tag-chip-selectable');
    fireEvent.click(wl2Pill);
    
    fireEvent.click(screen.getByText(/^Save( Changes)?$/));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      watchlists: ['wl1', 'wl2']
    }));
  });

  it('renders research links correctly for US', () => {
    render(<EditStockModal {...props} isDeepView={true} />);
    
    const tvLink = screen.getByTitle(/View on TradingView/i);
    const yahooLink = screen.getByTitle(/View on Yahoo Finance/i);
    
    expect(tvLink.getAttribute('href')).toContain('tradingview.com');
    // US stock (AAPL) should be linkable directly
    expect(tvLink.getAttribute('href')).toContain('symbol=AAPL');
    expect(yahooLink.getAttribute('href')).toContain('finance.yahoo.com/quote/AAPL');
  });

  it('renders research links correctly for IN', () => {
    // Override props with country="IN"
    render(<EditStockModal {...props} country="IN" isDeepView={true} />);
    
    const tvLink = screen.getByTitle(/View on TradingView/i);
    const screenerLink = screen.getByTitle(/View on Screener/i);
    
    expect(tvLink.getAttribute('href')).toContain('tradingview.com');
    // IN stock should have NSE prefix
    expect(tvLink.getAttribute('href')).toContain('NSE:AAPL');
    expect(screenerLink.getAttribute('href')).toContain('screener.in/company/AAPL');
  });

  describe('Watchlist Workspace Navigation', () => {
    const sortedStocks = [
      { symbol: 'AAPL', longName: 'Apple Inc.', periodChangePct: 1.5, isAdvancing: true },
      { symbol: 'MSFT', longName: 'Microsoft Corp.', periodChangePct: -0.8, isAdvancing: false },
      { symbol: 'GOOGL', longName: 'Alphabet Inc.', periodChangePct: 2.3, isAdvancing: true }
    ];

    it('renders the watchlist sidebar and navigation controls', () => {
      const onSelectStock = vi.fn();
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock}
        />
      );

      // Verify sidebar title and items
      expect(screen.getByText('Watchlist')).toBeDefined();
      expect(screen.getByText('MSFT')).toBeDefined();
      expect(screen.getByText('GOOGL')).toBeDefined();

      // Verify counter
      expect(screen.getByText('1 / 3')).toBeDefined();

      // Verify search input
      expect(screen.getByPlaceholderText('Search stock... (Ctrl+K)')).toBeDefined();
    });

    it('triggers onSelectStock and saves changes when a sidebar item is clicked and data is dirty', () => {
      const onSelectStock = vi.fn();
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock}
        />
      );

      // Expand parameters first in Deep View
      fireEvent.click(screen.getByTitle('Expand Parameters'));

      // Make data dirty first
      const notesArea = screen.getByPlaceholderText(/Technical triggers, conviction level/i);
      fireEvent.change(notesArea, { target: { value: 'New dirty notes value' } });

      // Click the MSFT item
      fireEvent.click(screen.getByText('MSFT'));

      // Verify onSave was called with current AAPL data (auto-save)
      expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'AAPL',
        notes: 'New dirty notes value'
      }));

      // Verify onSelectStock was called with MSFT stock
      expect(onSelectStock).toHaveBeenCalledWith(sortedStocks[1]);
    });

    it('does not call onSave when a sidebar item is clicked if no changes were made', () => {
      const onSelectStock = vi.fn();
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock}
        />
      );

      // Click the MSFT item
      fireEvent.click(screen.getByText('MSFT'));

      // Verify onSave was not called because data is not dirty
      expect(props.onSave).not.toHaveBeenCalled();

      // Verify onSelectStock was still called with MSFT stock
      expect(onSelectStock).toHaveBeenCalledWith(sortedStocks[1]);
    });

    it('navigates to next/prev stock using header arrows and saves if dirty', () => {
      const onSelectStock = vi.fn();
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock}
        />
      );

      // Expand parameters first in Deep View
      fireEvent.click(screen.getByTitle('Expand Parameters'));

      // Make data dirty first
      const notesArea = screen.getByPlaceholderText(/Technical triggers, conviction level/i);
      fireEvent.change(notesArea, { target: { value: 'New dirty notes value' } });

      // Find next arrow button (Right arrow icon in header)
      const nextBtn = screen.getByTitle(/Next Stock/i);
      fireEvent.click(nextBtn);

      // Auto-saves AAPL
      expect(props.onSave).toHaveBeenCalled();
      // Selects MSFT
      expect(onSelectStock).toHaveBeenCalledWith(sortedStocks[1]);
    });

    it('supports keyboard ArrowUp/ArrowDown and ArrowLeft/ArrowRight navigation when input is not focused', () => {
      const onSelectStock = vi.fn();
      const { unmount } = render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock}
        />
      );

      // Trigger ArrowDown keydown on window -> MSFT
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(onSelectStock).toHaveBeenLastCalledWith(sortedStocks[1]);

      // Trigger ArrowRight keydown on window -> MSFT
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(onSelectStock).toHaveBeenLastCalledWith(sortedStocks[1]);

      unmount();
      
      // Test ArrowUp / ArrowLeft starting from index 1 (MSFT)
      const onSelectStock2 = vi.fn();
      render(
        <EditStockModal
          {...props}
          stock={sortedStocks[1]}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock2}
        />
      );

      // Trigger ArrowUp keydown on window -> AAPL
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(onSelectStock2).toHaveBeenLastCalledWith(sortedStocks[0]);

      // Trigger ArrowLeft keydown on window -> AAPL
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(onSelectStock2).toHaveBeenLastCalledWith(sortedStocks[0]);
    });

    it('filters stock list in search dropdown and switches on click', () => {
      const onSelectStock = vi.fn();
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
          onSelectStock={onSelectStock}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search stock... (Ctrl+K)');
      fireEvent.change(searchInput, { target: { value: 'goog' } });

      // Click the GOOGL dropdown item
      fireEvent.click(screen.getByText('Alphabet Inc.', { selector: '.nav-search-item-name' }));

      expect(onSelectStock).toHaveBeenCalledWith(sortedStocks[2]);
    });

    it('focuses the search input when Ctrl+K is pressed', () => {
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search stock... (Ctrl+K)');
      expect(document.activeElement).not.toBe(searchInput);

      // Press Ctrl+K
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      expect(document.activeElement).toBe(searchInput);
    });

    it('collapses and expands the sidebar', () => {
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
        />
      );

      // Initially open
      expect(screen.getByText('Watchlist')).toBeDefined();

      // Click collapse button
      const toggleBtn = screen.getByTitle('Collapse Sidebar');
      fireEvent.click(toggleBtn);

      // Sidebar content should be gone/hidden
      expect(screen.queryByText('Watchlist')).toBeNull();

      // Expand sidebar
      const expandBtn = screen.getByTitle('Expand Watchlist Sidebar');
      fireEvent.click(expandBtn);

      // Sidebar content should be back
      expect(screen.getByText('Watchlist')).toBeDefined();
    });

    it('renders a custom watchlistName and displays stock prices in the sidebar', () => {
      const stocksWithPrice = [
        { symbol: 'AAPL', longName: 'Apple Inc.', currentPrice: 150.25, periodChangePct: 1.5, isAdvancing: true },
        { symbol: 'MSFT', longName: 'Microsoft Corp.', currentPrice: 320.50, periodChangePct: -0.8, isAdvancing: false }
      ];

      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          watchlistName="My Premium Watchlist"
          sortedStocks={stocksWithPrice}
        />
      );

      // Custom title is rendered
      expect(screen.getByText('My Premium Watchlist')).toBeDefined();

      // Prices are formatted and rendered ($150.25 and $320.50)
      expect(screen.getByText('$150.25')).toBeDefined();
      expect(screen.getByText('$320.50')).toBeDefined();
    });

    it('displays loading indicator while quotes are fetching', async () => {
      let resolveQuotes;
      const promise = new Promise((resolve) => {
        resolveQuotes = resolve;
      });
      const spy = vi.spyOn(yahooFinanceMap, 'fetchStockQuotes').mockReturnValue(promise);

      const stocks = [
        { symbol: 'AAPL', longName: 'Apple Inc.' }
      ];

      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={stocks}
        />
      );

      // Loader is displayed
      expect(screen.getByTitle('Updating quotes...')).toBeDefined();

      // Resolve the mock promise
      resolveQuotes([
        { symbol: 'AAPL', currentPrice: 150.25, dailyChangePct: 1.52 }
      ]);
      await promise;

      // Loader is gone after resolve
      await screen.findByText('$150.25');
      expect(screen.queryByTitle('Updating quotes...')).toBeNull();

      spy.mockRestore();
    });

    it('displays loading overlay while chart data is loading', async () => {
      let resolveChart;
      const promise = new Promise((resolve) => {
        resolveChart = resolve;
      });
      const spy = vi.spyOn(yahooFinanceMap, 'fetchStockData').mockReturnValue(promise);

      render(
        <EditStockModal
          {...props}
          isDeepView={true}
        />
      );

      // Loader is displayed
      expect(screen.getByTitle('Chart loading...')).toBeDefined();
      expect(screen.getByText('Loading chart...')).toBeDefined();

      // Resolve the mock promise
      resolveChart([]);
      await promise;

      // Loader is gone after resolve
      await waitFor(() => {
        expect(screen.queryByTitle('Chart loading...')).toBeNull();
      });

      spy.mockRestore();
    });

    it('filters out AI tags from the rendered selectable tag list', () => {
      const customProps = {
        ...props,
        availableTags: ['Growth', 'Value', 'AI: BUY', 'ai: exit']
      };
      render(<EditStockModal {...customProps} />);
      
      // Selectable tags Growth and Value should be visible
      expect(screen.getByText('Growth')).toBeDefined();
      expect(screen.getByText('Value')).toBeDefined();

      // AI tags should not be visible as selectable pills
      expect(screen.queryByText('AI: BUY')).toBeNull();
      expect(screen.queryByText('ai: exit')).toBeNull();
    });
  });

  describe('Moving Averages and Sidebar Grouping Popovers', () => {
    const sortedStocks = [
      { symbol: 'AAPL', longName: 'Apple Inc.', sector: 'Tech', tags: ['Growth'], periodChangePct: 1.5, isAdvancing: true },
      { symbol: 'MSFT', longName: 'Microsoft Corp.', sector: 'Tech', tags: ['Value'], periodChangePct: -0.8, isAdvancing: false },
      { symbol: 'GOOGL', longName: 'Alphabet Inc.', sector: 'Finance', tags: [], periodChangePct: 2.3, isAdvancing: true }
    ];

    it('toggles the sidebar grouping popover dropdown options', () => {
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
        />
      );

      // Verify layers icon button is rendered
      const groupingBtn = screen.getByTitle('Group & Categorize watchlist');
      expect(groupingBtn).toBeDefined();

      // Click to open popover
      fireEvent.click(groupingBtn);
      expect(screen.getByText('Group by:')).toBeDefined();
      expect(screen.getByText('Sector')).toBeDefined();
      expect(screen.getByText('Tag')).toBeDefined();

      // Click 'Sector' option
      fireEvent.click(screen.getByText('Sector'));

      // The popover should close
      expect(screen.queryByText('Group by:')).toBeNull();
    });

    it('groups and collapses/expands the sidebar watchlist items based on sector and tags', () => {
      render(
        <EditStockModal
          {...props}
          isDeepView={true}
          sortedStocks={sortedStocks}
        />
      );

      const groupingBtn = screen.getByTitle('Group & Categorize watchlist');
      fireEvent.click(groupingBtn);
      fireEvent.click(screen.getByText('Sector'));

      // Header categories should appear: Tech and Finance
      expect(screen.getByText('Tech')).toBeDefined();
      expect(screen.getByText('Finance')).toBeDefined();

      // We should be able to click on 'Finance' header to collapse/expand
      const financeHeader = screen.getByText('Finance').closest('.sidebar-group-header-premium');
      expect(financeHeader).toBeDefined();
      fireEvent.click(financeHeader);
    });

    it('toggles moving average (MAs) popover rows and line weight configuration changes', () => {
      render(<EditStockModal {...props} isDeepView={true} />);

      // Verify the MAs trigger button
      const maTrigger = screen.getByTitle('Moving Average Settings');
      expect(maTrigger).toBeDefined();

      // Click to open MAs popover
      fireEvent.click(maTrigger);
      expect(screen.getByText('50-day SMA')).toBeDefined();
      expect(screen.getByText('200-day SMA')).toBeDefined();

      // Verify and toggle visibility of SMA 50
      const checkboxes = screen.getAllByRole('checkbox');
      const sma50Checkbox = checkboxes.find(c => c.checked);
      expect(sma50Checkbox).toBeDefined();
      fireEvent.click(sma50Checkbox);

      // Verify line thickness selector
      const thicknessSelect = screen.getByTitle('Change 50 SMA line thickness');
      expect(thicknessSelect).toBeDefined();
      fireEvent.change(thicknessSelect, { target: { value: '3' } });
    });

    it('renders Delete Stock button when onDeleteStock prop is provided and triggers callback', () => {
      const onDeleteStock = vi.fn();
      render(<EditStockModal {...props} isDeepView={true} onDeleteStock={onDeleteStock} />);
      
      const deleteBtn = screen.getAllByText(/Delete Stock/i)[0];
      expect(deleteBtn).toBeDefined();
      fireEvent.click(deleteBtn);
      expect(onDeleteStock).toHaveBeenCalledWith('AAPL');
    });

    it('allows choosing a flag color and calling onSave with it', () => {
      const customProps = {
        ...props,
        sortedStocks: [mockStock]
      };
      render(<EditStockModal {...customProps} isDeepView={true} />);
      
      const flagBtn = screen.getByTitle('Flag Stock');
      expect(flagBtn).toBeDefined();
      fireEvent.click(flagBtn);
      
      const greenFlagOption = screen.getByTitle('Green Flag');
      expect(greenFlagOption).toBeDefined();
      fireEvent.click(greenFlagOption);
      
      expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
        flagColor: 'green'
      }));
    });

    it('supports grouping sidebar list by flag color', () => {
      const customStocks = [
        { ...mockStock, symbol: 'AAPL', flagColor: 'green' },
        { ...mockStock, symbol: 'MSFT', flagColor: 'red' },
        { ...mockStock, symbol: 'TSLA', flagColor: null }
      ];
      const customProps = {
        ...props,
        sortedStocks: customStocks
      };
      render(<EditStockModal {...customProps} isDeepView={true} />);

      // Open Grouping Popover
      const groupBtn = screen.getByTitle('Group & Categorize watchlist');
      expect(groupBtn).toBeDefined();
      fireEvent.click(groupBtn);

      // Select "Flag Color"
      const flagGroupOption = screen.getByText('Flag Color');
      expect(flagGroupOption).toBeDefined();
      fireEvent.click(flagGroupOption);

      // Verify the group headers are displayed
      expect(screen.getByText('No Flag')).toBeDefined();
    });
  });
});
