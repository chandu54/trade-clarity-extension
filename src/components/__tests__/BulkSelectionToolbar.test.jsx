import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StockGrid from '../StockGrid';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockQuotes: vi.fn().mockResolvedValue([]),
  fetchStockData: vi.fn().mockResolvedValue([]),
  isMarketOpenForCountry: vi.fn().mockReturnValue(false)
}));

const mockShowToast = vi.fn();
const mockConfirm = vi.fn().mockResolvedValue(true);

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      <ConfirmContext.Provider value={{ confirm: mockConfirm }}>
        {ui}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

describe('BulkSelectionToolbar in StockGrid', () => {
  const mockData = {
    paramDefinitions: {},
    watchlists: [
      { id: 'wl_default', name: 'Default Watchlist', isDefault: true },
      { id: 'wl_growth', name: 'Growth Watchlist', isDefault: false }
    ],
    uiConfig: {
      columnVisibility: {},
      sectors: [{ name: 'Tech', countries: ['IN'] }],
      tags: []
    },
    weeks: {
      IN: {
        '2026-W10': {
          stocks: {
            STOCKA: { symbol: 'STOCKA', name: 'Stock A', sector: 'Tech', watchlists: ['wl_default'] },
            STOCKB: { symbol: 'STOCKB', name: 'Stock B', sector: 'Tech', watchlists: ['wl_default'] },
            STOCKC: { symbol: 'STOCKC', name: 'Stock C', sector: 'Tech', watchlists: ['wl_growth'] }
          }
        }
      }
    }
  };

  it('renders refined toolbar when stocks are selected and clears selection on Clear click', () => {
    const setData = vi.fn();

    renderWithContext(
      <StockGrid
        country="IN"
        data={mockData}
        setData={setData}
        weekKey="2026-W10"
        selectedWatchlistId="wl_default"
        sectors={[{ name: 'Tech' }]}
      />
    );

    // Find the header select-all checkbox or individual checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);

    // Select first stock
    fireEvent.click(checkboxes[1]);

    // Toolbar should appear
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText(/selected/i)).toBeDefined();
    expect(screen.getByText('Clear')).toBeDefined();
    expect(screen.getByText('Add to')).toBeDefined();
    expect(screen.queryByText('Move to')).toBeNull();
    expect(screen.getByText(/Remove \(1\)/i)).toBeDefined();

    // Click Clear
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);

    // Toolbar should disappear
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it('opens Add to menu and displays available watchlists', () => {
    const setData = vi.fn();

    renderWithContext(
      <StockGrid
        country="IN"
        data={mockData}
        setData={setData}
        weekKey="2026-W10"
        selectedWatchlistId="wl_default"
        sectors={[{ name: 'Tech' }]}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const addToBtn = screen.getByText('Add to');
    fireEvent.click(addToBtn);

    // Add menu should be visible and show watchlists
    expect(screen.getByText('ADD TO WATCHLIST')).toBeDefined();
    expect(screen.getByText('Growth Watchlist')).toBeDefined();
  });
});
