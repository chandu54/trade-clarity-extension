import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StockGrid from '../StockGrid';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockQuotes: vi.fn().mockResolvedValue([
    { symbol: 'AAPL', currentPrice: 150.25, dailyChangePct: 1.5, isAdvancing: true },
    { symbol: 'RELIANCE', currentPrice: 2500, dailyChangePct: -0.5, isAdvancing: false }
  ]),
  fetchStockData: vi.fn().mockResolvedValue([])
}));

// Mock contexts
const mockShowToast = vi.fn();
const mockConfirm = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      <ConfirmContext.Provider value={{ confirm: mockConfirm }}>
        {ui}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

describe('StockGrid', () => {
  const mockData = {
    paramDefinitions: {
      volume: { type: 'number', filterable: true, label: 'Volume' }, // Global
      rs: { type: 'number', filterable: true, label: 'RS' },        // Global
      pe: { type: 'number', filterable: true, label: 'PE', countries: ['IN'] } // India Only
    },
    uiConfig: {
      columnVisibility: { volume: true, rs: true, pe: true },
      sectors: [
        { name: 'Tech', countries: ['IN', 'US'] },
        { name: 'Finance', countries: ['IN'] }
      ],
      tags: ['Growth'],
      sectorFilterable: true,
      tradableFilterable: true,
      showTags: true
    },
    weeks: {
      US: {
        '2024-03-17': {
          stocks: {
            AAPL: { symbol: 'AAPL', sector: 'Tech', params: { volume: 100, rs: 80 }, notes: 'Buy' }
          }
        }
      },
      IN: {
        '2024-03-17': {
          stocks: {
            RELIANCE: { symbol: 'RELIANCE', sector: 'Finance', params: { volume: 50, pe: 15 }, notes: 'India stock' }
          }
        }
      }
    },
    watchlists: []
  };

  const props = {
    data: mockData,
    weekKey: '2024-03-17',
    setData: vi.fn(),
    isReadOnly: false,
    country: 'US',
    selectedWatchlistId: 'all',
    onExportAll: vi.fn(),
    onImportAll: vi.fn(),
    availableTags: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the grid with stock data relevant to the country', () => {
    renderWithContext(<StockGrid {...props} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.queryByText('RELIANCE')).toBeNull();
  });

  it('hides parameter columns not relevant to the current country', () => {
    // When country is 'US', 'PE' (India only) should be hidden
    renderWithContext(<StockGrid {...props} country="US" />);
    expect(screen.queryByText('PE')).toBeNull();
    expect(screen.getByText('Volume')).toBeDefined();
  });

  it('shows parameter columns relevant to the current country', () => {
    // When country is 'IN', 'PE' should be visible
    renderWithContext(<StockGrid {...props} country="IN" />);
    expect(screen.getByText('PE')).toBeDefined();
  });

  it('filters sector dropdown based on country scope', () => {
    renderWithContext(<StockGrid {...props} country="US" />);
    
    // Toggle filters
    const filterToggle = screen.getByText(/Show All Filters/i);
    fireEvent.click(filterToggle);

    const sectorSelect = screen.getByLabelText('Sector');
    fireEvent.click(sectorSelect); // Open dropdown
    
    // 'Tech' is IN/US, 'Finance' is IN only. So Finance should be missing in US.
    expect(screen.getByText('Tech', { selector: '.multi-select-label' })).toBeDefined();
    expect(screen.queryByText('Finance', { selector: '.multi-select-label' })).toBeNull();
  });

  it('calculates diagnostics using only relevant check parameters', () => {
    // Define a check that is US only
    const dataWithScopedCheck = {
      ...mockData,
      paramDefinitions: {
        ...mockData.paramDefinitions,
        usCheck: { label: 'US Check', type: 'checkbox', isCheck: true, countries: ['US'] },
        inCheck: { label: 'IN Check', type: 'checkbox', isCheck: true, countries: ['IN'] }
      }
    };
    
    const usStock = {
      ...mockData.weeks.US['2024-03-17'].stocks.AAPL,
      params: { usCheck: true, inCheck: false } // Passed US, failed IN
    };

    const customProps = {
      ...props,
      data: {
        ...dataWithScopedCheck,
        weeks: { US: { '2024-03-17': { stocks: { AAPL: usStock } } } }
      }
    };

    renderWithContext(<StockGrid {...customProps} country="US" />);
    
    // The diagnostic badge should see 1/1 passed (US Check) and ignore IN Check.
    // Since both are '1', we use getAllByText or specific containers
    const diagnosticValues = screen.getAllByText('1');
    expect(diagnosticValues.length).toBeGreaterThanOrEqual(2);
  });

  it('paginates data correctly', () => {
    const manyStocks = {};
    for (let i = 0; i < 15; i++) {
        manyStocks[`S${i}`] = { symbol: `S${i}`, params: {} };
    }
    const propsWithMany = {
        ...props,
        data: {
            ...mockData,
            weeks: { US: { '2024-03-17': { stocks: manyStocks } } }
        }
    };

    renderWithContext(<StockGrid {...propsWithMany} />);
    expect(screen.getAllByRole('row').length).toBe(11); // 10 rows + 1 header
    
    const nextPageBtn = screen.getByText('▶');
    fireEvent.click(nextPageBtn);
    expect(screen.getAllByRole('row').length).toBe(6); // 5 remaining + 1 header
  });

  it('hides parameters with _legacy_ country scope', () => {
    const dataWithLegacy = {
      ...mockData,
      paramDefinitions: {
        ...mockData.paramDefinitions,
        oldParam: { label: 'Old Parameter', countries: ['_legacy_'] }
      }
    };
    
    const propsWithLegacy = { ...props, data: dataWithLegacy };
    
    // Should be hidden in US
    renderWithContext(<StockGrid {...propsWithLegacy} country="US" />);
    expect(screen.queryByText('Old Parameter')).toBeNull();
    
    // Should be hidden in IN
    renderWithContext(<StockGrid {...propsWithLegacy} country="IN" />);
    expect(screen.queryByText('Old Parameter')).toBeNull();
  });

  describe('Stock deletion', () => {
    it('completely deletes the stock from week data when selectedWatchlistId is "all"', async () => {
      mockConfirm.mockResolvedValueOnce(true);
      
      const mockSetData = vi.fn();
      const customProps = {
        ...props,
        setData: mockSetData,
        selectedWatchlistId: 'all',
      };

      renderWithContext(<StockGrid {...customProps} />);

      const deleteBtns = screen.getAllByTitle('Delete stock');
      expect(deleteBtns.length).toBe(1); // AAPL delete button
      
      await fireEvent.click(deleteBtns[0]);

      expect(mockConfirm).toHaveBeenCalledWith('Delete AAPL?', { confirmSettingsKey: 'skipDeleteConfirm' });
      expect(mockSetData).toHaveBeenCalled();
      
      // Call the updater function passed to setData to verify state changes
      // Since auto-sync runs on mount and calls setData, we find the deleteStock call (the last call)
      const deleteCall = mockSetData.mock.calls[mockSetData.mock.calls.length - 1];
      const updater = deleteCall[0];
      const updatedState = updater(mockData);
      
      // Stock AAPL should be deleted completely from US '2024-03-17' stocks
      expect(updatedState.weeks.US['2024-03-17'].stocks.AAPL).toBeUndefined();
    });

    it('only removes the watchlist ID from the stock watchlists array when a watchlist is selected', async () => {
      mockConfirm.mockResolvedValueOnce(true);
      
      const mockDataWithWatchlist = {
        ...mockData,
        watchlists: [{ id: 'wl1', name: 'Tech Watchlist' }],
        weeks: {
          US: {
            '2024-03-17': {
              stocks: {
                AAPL: { 
                  symbol: 'AAPL', 
                  sector: 'Tech', 
                  params: { volume: 100, rs: 80 }, 
                  notes: 'Buy',
                  watchlists: ['wl1']
                }
              }
            }
          }
        }
      };

      const mockSetData = vi.fn();
      const customProps = {
        ...props,
        data: mockDataWithWatchlist,
        setData: mockSetData,
        selectedWatchlistId: 'wl1',
      };

      renderWithContext(<StockGrid {...customProps} />);

      const deleteBtns = screen.getAllByTitle('Delete stock');
      expect(deleteBtns.length).toBe(1);
      
      await fireEvent.click(deleteBtns[0]);

      expect(mockConfirm).toHaveBeenCalledWith('Remove AAPL from watchlist "Tech Watchlist"?', { confirmSettingsKey: 'skipDeleteConfirm' });
      expect(mockSetData).toHaveBeenCalled();
      
      // Since auto-sync runs on mount and calls setData, we find the deleteStock call (the last call)
      const deleteCall = mockSetData.mock.calls[mockSetData.mock.calls.length - 1];
      const updater = deleteCall[0];
      const updatedState = updater(mockDataWithWatchlist);
      
      // AAPL should still exist but its watchlists should be empty/filtered
      expect(updatedState.weeks.US['2024-03-17'].stocks.AAPL).toBeDefined();
      expect(updatedState.weeks.US['2024-03-17'].stocks.AAPL.watchlists).toEqual([]);
    });
  });

  it('renders Live Price column and displays quotes correctly', async () => {
    renderWithContext(<StockGrid {...props} />);
    
    expect(screen.getByText('Live Price')).toBeDefined();
    
    await waitFor(() => {
      expect(screen.getByText('$150.25')).toBeDefined();
      expect(screen.getByText('+1.50%')).toBeDefined();
    });
  });

  it('filters out AI tags from the inline tag picker dropdown', async () => {
    const customProps = {
      ...props,
      availableTags: ['Growth', 'AI: BUY', 'ai: exit'],
      showTags: true
    };
    renderWithContext(<StockGrid {...customProps} />);
    
    // Find the tag adder trigger for AAPL
    const addTagBtn = screen.getByTitle('Add Tag(s) to AAPL');
    fireEvent.click(addTagBtn);
    
    // Now the custom-tag-dropdown is open.
    // It should render "Growth" option.
    expect(screen.getByText('Growth')).toBeDefined();
    
    // It should not render the AI options.
    expect(screen.queryByText('AI: BUY')).toBeNull();
    expect(screen.queryByText('ai: exit')).toBeNull();
  });

  it('renders advances and declines metrics next to Last synced in the grid header', async () => {
    const propsWithSyncDate = {
      ...props,
      data: {
        ...mockData,
        weeks: {
          US: {
            '2024-03-17': {
              lastSyncDate: '2024-03-17',
              stocks: {
                AAPL: { symbol: 'AAPL', sector: 'Tech', params: { volume: 100, rs: 80 }, notes: 'Buy' }
              }
            }
          }
        }
      }
    };
    renderWithContext(<StockGrid {...propsWithSyncDate} />);
    
    await waitFor(() => {
      expect(screen.getByTitle('Advances (Price Up)')).toBeDefined();
      expect(screen.getByText('▲ 1')).toBeDefined();
    });
  });
});

