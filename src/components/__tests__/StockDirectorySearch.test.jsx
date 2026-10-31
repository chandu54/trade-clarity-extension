import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditStockModal from '../EditStockModal';
import StockGrid from '../StockGrid';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';
import { initStockUniverse } from '../../services/stockUniverseService';

vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockQuotes: vi.fn().mockResolvedValue([]),
  fetchStockData: vi.fn().mockResolvedValue([])
}));

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

describe('Stock Directory Search Integration', () => {
  beforeEach(() => {
    initStockUniverse();
  });

  const mockStock = {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    sector: 'Auto',
    watchlists: ['default']
  };

  const mockSortedStocks = [mockStock];

  describe('EditStockModal Search', () => {
    it('displays directory stocks in search dropdown when searching for non-watchlist stocks', () => {
      const onSelectStock = vi.fn();

      render(
        <EditStockModal
          isOpen={true}
          isDeepView={true}
          stock={mockStock}
          sortedStocks={mockSortedStocks}
          sectors={['Auto', 'Metals']}
          country="IN"
          onSelectStock={onSelectStock}
          onClose={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search stock.../i);
      expect(searchInput).toBeDefined();

      fireEvent.change(searchInput, { target: { value: 'TATA' } });

      expect(screen.getByText(/In Watchlist/i)).toBeDefined();
      expect(screen.getByText(/Stock Directory/i)).toBeDefined();

      const tataSteelItem = screen.getByText('TATASTEEL');
      expect(tataSteelItem).toBeDefined();

      fireEvent.click(tataSteelItem);
      expect(onSelectStock).toHaveBeenCalled();
      const calledStock = onSelectStock.mock.calls[0][0];
      expect(calledStock.symbol).toBe('TATASTEEL');
    });

    it('renders "+ Add to Watchlist" button in header when viewing a stock not in current watchlist', () => {
      const nonWatchlistStock = {
        symbol: 'TATASTEEL',
        name: 'Tata Steel Ltd',
        sector: 'Metals'
      };
      const onAddStock = vi.fn();

      render(
        <EditStockModal
          isOpen={true}
          isDeepView={true}
          stock={nonWatchlistStock}
          sortedStocks={mockSortedStocks}
          sectors={['Auto', 'Metals']}
          country="IN"
          onAddStock={onAddStock}
          onClose={vi.fn()}
        />
      );

      const addBtn = screen.getByText('+ Add to Watchlist');
      expect(addBtn).toBeDefined();

      fireEvent.click(addBtn);
      expect(onAddStock).toHaveBeenCalledWith('TATASTEEL');
    });
  });

  describe('StockGrid Watchlist Search', () => {
    const mockData = {
      paramDefinitions: {},
      uiConfig: {
        columnVisibility: {},
        sectors: [{ name: 'Auto', countries: ['IN'] }],
        tags: []
      },
      weeks: {
        IN: {
          '2026-W10': {
            stocks: {
              TATAMOTORS: { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto' }
            }
          }
        }
      }
    };

    it('displays directory search dropdown for non-watchlist stocks with + Add button', () => {
      const setData = vi.fn();

      renderWithContext(
        <StockGrid
          country="IN"
          data={mockData}
          setData={setData}
          weekKey="2026-W10"
          selectedWatchlistId="all"
          sectors={[{ name: 'Auto' }]}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search symbols.../i);
      expect(searchInput).toBeDefined();

      // Search for "TATA"
      fireEvent.change(searchInput, { target: { value: 'TATA' } });

      // Directory dropdown should display TATASTEEL
      expect(screen.getByText(/Stock Directory/i)).toBeDefined();
      const tataSteelEl = screen.getByText('TATASTEEL');
      expect(tataSteelEl).toBeDefined();

      // Find the "+ Add" button for TATASTEEL
      const addBtns = screen.getAllByRole('button', { name: /\+ Add/i });
      expect(addBtns.length).toBeGreaterThan(0);

      // Clicking "+ Add" calls setData to add TATASTEEL into week stocks
      fireEvent.click(addBtns[0]);
      expect(setData).toHaveBeenCalled();
    });
  });
});
