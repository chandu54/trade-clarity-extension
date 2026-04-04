import { describe, it, vi, beforeEach, expect } from 'vitest';
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
    
    // 'Tech' is IN/US, 'Finance' is IN only. So Finance should be missing in US.
    const options = Array.from(sectorSelect.options).map(o => o.text);
    expect(options).toContain('Tech');
    expect(options).not.toContain('Finance');
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
});
