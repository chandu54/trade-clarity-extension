import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StockGrid from '../StockGrid';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

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
      volume: { type: 'number', filterable: true, label: 'Volume' },
      rs: { type: 'number', filterable: true, label: 'RS' }
    },
    uiConfig: {
      columnVisibility: { volume: true, rs: true },
      sectors: ['Tech', 'Finance'],
      tags: ['Growth', 'Value'],
      sectorFilterable: true
    },
    weeks: {
      US: {
        '2024-03-17': {
          stocks: {
            AAPL: { symbol: 'AAPL', sector: 'Tech', params: { volume: 100, rs: 80 }, note: 'Buy' },
            MSFT: { symbol: 'MSFT', sector: 'Tech', params: { volume: 200, rs: 90 }, note: 'Hold' }
          }
        }
      }
    }
  };

  const props = {
    data: mockData,
    weekKey: '2024-03-17',
    setData: vi.fn(),
    isReadOnly: false,
    country: 'US',
    selectedWatchlistId: 'all',
    onExportAll: vi.fn(),
    onImportAll: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the grid with stock data', () => {
    renderWithContext(<StockGrid {...props} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('MSFT')).toBeDefined();
  });

  it('filters stocks by search query', () => {
    renderWithContext(<StockGrid {...props} />);
    
    // Expand filters if hidden
    const filterToggle = screen.getByText(/Show All Filters/i);
    fireEvent.click(filterToggle);

    const searchInput = screen.getByPlaceholderText(/Search symbols\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'AAPL' } });

    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.queryByText('MSFT')).toBeNull();
  });

  it('filters stocks by sector', () => {
    renderWithContext(<StockGrid {...props} />);
    
    const filterToggle = screen.getByText(/Show All Filters/i);
    fireEvent.click(filterToggle);

    const sectorSelect = screen.getAllByRole('combobox')[0]; // Assuming first select is sector
    fireEvent.change(sectorSelect, { target: { value: 'Finance' } });

    expect(screen.queryByText('AAPL')).toBeNull();
    expect(screen.queryByText('MSFT')).toBeNull();
  });

  it('sorts stocks when header is clicked', () => {
    renderWithContext(<StockGrid {...props} />);
    
    const volumeHeader = screen.getByText('Volume');
    fireEvent.click(volumeHeader); // Sort asc: 100, 200

    let rows = screen.getAllByRole('row').slice(1); // skip header row
    expect(within(rows[0]).getByText('AAPL')).toBeDefined();

    fireEvent.click(volumeHeader); // Sort desc: 200, 100
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('MSFT')).toBeDefined();
  });

  it('opens Add Stock modal when button is clicked', () => {
    renderWithContext(<StockGrid {...props} />);
    const addBtn = screen.getByText('Add');
    fireEvent.click(addBtn);
    expect(screen.getByText('Add Stocks')).toBeDefined();
  });

  it('calls deleteStock after confirmation', async () => {
    mockConfirm.mockResolvedValue(true);
    renderWithContext(<StockGrid {...props} />);
    
    // Click delete for AAPL
    const deleteBtns = screen.getAllByTitle(/Delete stock/i);
    fireEvent.click(deleteBtns[0]);

    expect(mockConfirm).toHaveBeenCalled();
    // Verify setData was called to update state
    await vi.waitFor(() => {
      expect(props.setData).toHaveBeenCalled();
    });
  });

  it('paginates data correctly', () => {
    // Add more stocks to test pagination
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
    
    // Page size 10 by default
    expect(screen.getAllByRole('row').length).toBe(11); // 10 rows + 1 header
    
    const nextPageBtn = screen.getByText('▶');
    fireEvent.click(nextPageBtn);
    
    expect(screen.getAllByRole('row').length).toBe(6); // 5 remaining + 1 header
  });
});
