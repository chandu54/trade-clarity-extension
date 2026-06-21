import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import JournalView from '../JournalView';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock yahooFinanceMap
vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockQuotes: vi.fn().mockResolvedValue([
    { symbol: 'AAPL', currentPrice: 170, movingAverages: 'Above' },
    { symbol: 'MSFT', currentPrice: 330, movingAverages: 'Below' }
  ]),
  fetchStockData: vi.fn().mockImplementation((symbols) => {
    const all = [
      {
        symbol: 'AAPL',
        candlesticks: [
          { time: 1781000000, open: 160, high: 165, low: 159, close: 162 },
          { time: 1781500000, open: 162, high: 168, low: 161, close: 167 }
        ]
      },
      {
        symbol: 'MSFT',
        candlesticks: [
          { time: 1781000000, open: 320, high: 325, low: 318, close: 322 },
          { time: 1781500000, open: 322, high: 330, low: 320, close: 328 }
        ]
      },
      {
        symbol: '^GSPC',
        candlesticks: [
          { time: 1781000000, open: 5000, high: 5050, low: 4980, close: 5000 },
          { time: 1781500000, open: 5000, high: 5100, low: 5000, close: 5100 }
        ]
      }
    ];
    return Promise.resolve(all.filter(item => symbols.includes(item.symbol)));
  })
}));

// Mock AI service
vi.mock('../../services/ai', () => ({
  getPortfolioAnalysis: vi.fn().mockResolvedValue('Mock AI Audit Critique Report')
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

describe('JournalView', () => {
  const mockData = {
    journals: {
      US: [
        {
          id: 'pos-1',
          symbol: 'AAPL',
          setup: 'VCP Breakout (Minervini SEPA)',
          initialStopLoss: 150,
          currentStopLoss: null,
          notes: 'Test AAPL setup notes',
          chartUrl: 'https://www.tradingview.com/x/abcd',
          transactions: [
            {
              id: 'tx-1',
              type: 'Buy',
              price: 160,
              qty: 10,
              date: '2026-06-10',
              reason: 'Initial Entry'
            }
          ]
        },
        {
          id: 'pos-2',
          symbol: 'MSFT',
          setup: 'IPO Base Breakout (CANSLIM)',
          initialStopLoss: 300,
          currentStopLoss: 310,
          notes: 'Test MSFT setup notes',
          chartUrl: '',
          transactions: [
            {
              id: 'tx-2',
              type: 'Buy',
              price: 320,
              qty: 5,
              date: '2026-06-12',
              reason: 'Initial Entry'
            }
          ]
        }
      ],
      IN: []
    },
    journalCapital: {
      US: 50000,
      IN: 1000000
    },
    aiSettings: {
      apiKey: 'test-key',
      model: 'gemini-2.5-flash'
    }
  };

  const props = {
    country: 'US',
    data: mockData,
    setData: vi.fn()
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders the ledger and mock trade entries', () => {
    renderWithContext(<JournalView {...props} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('MSFT')).toBeDefined();
  });

  it('filters trades by search query', () => {
    renderWithContext(<JournalView {...props} />);
    const searchInput = screen.getByPlaceholderText('Search ...');
    
    // Filter to only match AAPL's setup
    fireEvent.change(searchInput, { target: { value: 'AAPL' } });
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.queryByText('MSFT')).toBeNull();
  });

  it('cycles sort column when header is clicked', () => {
    renderWithContext(<JournalView {...props} />);
    
    // Header for Symbol is clickable
    const symbolHeader = screen.getByText('Symbol');
    fireEvent.click(symbolHeader);
    
    // Clicking should set sort column and direction
    // Check if sorted AAPL -> MSFT or MSFT -> AAPL
    const rows = screen.getAllByRole('row');
    // First body row is AAPL, second is MSFT for default sort
    expect(rows[1].textContent).toContain('AAPL');
    expect(rows[2].textContent).toContain('MSFT');
  });

  it('opens Column Config Modal on gear button click', () => {
    renderWithContext(<JournalView {...props} />);
    
    const configBtn = screen.getByTitle('Configure Columns');
    fireEvent.click(configBtn);
    
    expect(screen.getByText('Grid Configuration')).toBeDefined();
    expect(screen.getAllByText('MAs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R-Multiple').length).toBeGreaterThan(0);
  });

  it('persists selected tab state in localStorage and switches view on click', async () => {
    renderWithContext(<JournalView {...props} />);
    
    // Initially Standard is active (renders metrics card now!)
    expect(screen.getByText('% INVESTED')).toBeDefined();
    
    // Switch to Analytics tab
    const analyticsTab = screen.getByText('Analytics');
    fireEvent.click(analyticsTab);
    
    // Analytics tab should hide metrics card, but render benchmark Nifty/S&P
    expect(screen.queryByText('% INVESTED')).toBeNull();
    expect(screen.getByText('Benchmark Comparison')).toBeDefined();
    
    // Check localStorage persistence
    expect(window.localStorage.getItem('trade_clarity_journal_tab_US')).toBe('analytics');
    
    // Switch to Snapshot tab
    const snapshotTab = screen.getByText('Snapshot');
    fireEvent.click(snapshotTab);
    
    // Check Snapshot tab contents
    await screen.findByText(/constituent stocks/i);
    expect(window.localStorage.getItem('trade_clarity_journal_tab_US')).toBe('snapshot');
  });

  it('renders benchmark index returns and triggers AI portfolio insights', async () => {
    const { getPortfolioAnalysis } = await import('../../services/ai');
    renderWithContext(<JournalView {...props} />);
    
    // Switch to Analytics tab
    fireEvent.click(screen.getByText('Analytics'));
    
    // Verify NIFTY/S&P Comparison return details
    await screen.findByText('S&P 500 Return:');
    
    // Portfolio return is (Total P&L / Capital) * 100
    // AAPL: entry 160, current 170. Profit = 10 * 10 = +100
    // MSFT: entry 320, current 330. Profit = 10 * 5 = +50
    // Total P&L = +150. Capital = 50000. Return % = (150/50000)*100 = 0.30%
    expect(screen.getByText('+0.30%')).toBeDefined();
    
    // Verify Index Return based on mock index data
    // Index mock has close 5000 and 5100.
    // Earliest trade is 2026-06-10.
    // Return % is ((5100-5000)/5000)*100 = 2.00%
    expect(screen.getByText('+2.00%')).toBeDefined();
    
    // Outperformance banner difference: 0.30% - 2.00% = -1.70% underperforming
    expect(screen.getByText('-1.70%')).toBeDefined();
    expect(screen.getByText(/Underperforming S&P 500/i)).toBeDefined();
    
    // Click AI Audit button
    const auditBtn = screen.getByText('Analyze Portfolio with AI');
    fireEvent.click(auditBtn);
    
    // Check loading indicator and resolved AI critique message
    await waitFor(() => {
      expect(screen.getByText('Mock AI Audit Critique Report')).toBeDefined();
    });
    expect(getPortfolioAnalysis).toHaveBeenCalled();
  });

  it('renders visual candlestick cards with premium position statistics on Snapshot tab', async () => {
    const RealDate = Date;
    const mockSystemDate = new RealDate('2026-06-15T12:00:00Z');
    
    function MockDate(...args) {
      if (!(this instanceof MockDate)) {
        return mockSystemDate.toString();
      }
      if (args.length === 0) {
        return new RealDate(mockSystemDate);
      }
      return new RealDate(...args);
    }
    MockDate.prototype = RealDate.prototype;
    MockDate.now = () => mockSystemDate.getTime();
    MockDate.UTC = RealDate.UTC;
    MockDate.parse = RealDate.parse;
    
    global.Date = MockDate;

    try {
      renderWithContext(<JournalView {...props} />);
      
      // Switch to Snapshot tab
      fireEvent.click(screen.getByText('Snapshot'));
      
      // Check Snapshot tab contents are loaded
      await screen.findByText(/constituent stocks/i);
      
      // AAPL card premium elements:
      expect(screen.getByText('AAPL')).toBeDefined();
      // Setup tag
      expect(screen.getAllByText('VCP Breakout (Minervini SEPA)').length).toBeGreaterThan(0);
      // Position size & value line
      expect(screen.getByText('3.4%')).toBeDefined();
      expect(screen.getByText('$1.7K')).toBeDefined();
      expect(screen.getByText('Holding 5d')).toBeDefined();
      expect(screen.getByText('Holding 3d')).toBeDefined();
      
      // Right-aligned stats
      expect(screen.getByText('+6.3%')).toBeDefined();
      expect(screen.getByText('+1.0R')).toBeDefined();
      expect(screen.getByText('+$100.00')).toBeDefined();
      
      // Footer prices
      expect(screen.getAllByText('Entry').length).toBeGreaterThan(0);
      expect(screen.getByText('$160.00')).toBeDefined();
      expect(screen.getAllByText('CMP').length).toBeGreaterThan(0);
      expect(screen.getByText('$170.00')).toBeDefined();
    } finally {
      global.Date = RealDate;
    }
  });

  it('correctly preserves custom scaling transactions on save instead of resetting them in simple mode', async () => {
    const mockSetData = vi.fn();
    const customProps = {
      ...props,
      setData: mockSetData
    };

    renderWithContext(<JournalView {...customProps} />);

    // Explicitly switch to Standard tab to view the ledger grid
    fireEvent.click(screen.getByText('Standard'));

    // Click edit on the first position (AAPL, which has id: pos-1, buy: 10 @ 160)
    const editBtns = screen.getAllByTitle('Edit Position');
    fireEvent.click(editBtns[0]);

    // Verify modal is open and we see "Position Parameters"
    expect(screen.getByText('Position Parameters')).toBeDefined();

    // Click Pyramiding tab
    fireEvent.click(screen.getByText('Pyramiding'));

    // Check we see the initial buy transaction: 10 @ $160
    expect(screen.getByText(/10 @ \$160/)).toBeDefined();

    // Fill the add execution form to add a Sell of 5 @ 175
    const typeSelect = screen.getByDisplayValue('Buy (Scale In)');
    fireEvent.change(typeSelect, { target: { value: 'Sell' } });

    const priceInput = document.getElementById('pyramiding-price-input');
    fireEvent.change(priceInput, { target: { value: '175' } });

    const qtyInput = screen.getByPlaceholderText('0');
    fireEvent.change(qtyInput, { target: { value: '5' } });

    // Click "Add" button (now dynamically labeled and styled)
    fireEvent.click(screen.getByText('- Add Sell Exit'));

    // Check the list showing the added execution: 5 @ $175
    expect(screen.getByText(/5 @ \$175/)).toBeDefined();

    // Click "Save Changes"
    fireEvent.click(screen.getByText('Save Changes'));

    // Verify setData was called with the updated transaction list including the new Sell transaction
    expect(mockSetData).toHaveBeenCalled();
    const updatedData = mockSetData.mock.calls[0][0](mockData);
    const savedAapl = updatedData.journals.US.find(t => t.id === 'pos-1');
    expect(savedAapl.transactions).toHaveLength(2);
    expect(savedAapl.transactions[1]).toMatchObject({
      type: 'Sell',
      price: 175,
      qty: 5,
      reason: 'Scale Out'
    });
  });

  it('restricts invalid stop loss levels and triggers position sizing calculations', async () => {
    const mockSetData = vi.fn();
    const customProps = {
      ...props,
      setData: mockSetData
    };

    renderWithContext(<JournalView {...customProps} />);

    // Click edit on the first position (AAPL)
    const editBtns = screen.getAllByTitle('Edit Position');
    fireEvent.click(editBtns[0]);

    // Verify Entry & Risk tab is active and shows entry fields
    expect(screen.getByText('Position Parameters')).toBeDefined();

    // Attempt to set invalid stop loss price (AAPL Entry is 160, let's set SL to 165 which is >= Entry)
    const slInput = document.getElementById('sl-price-input');
    fireEvent.change(slInput, { target: { value: '165' } });

    // Should display real-time validation error text
    expect(screen.getByText('Must be less than Entry')).toBeDefined();

    // Attempting to save should block and show toast error
    const saveBtn = screen.getByText('Save Changes');
    fireEvent.click(saveBtn);
    expect(mockShowToast).toHaveBeenCalledWith(
      'For Long positions, Initial Stop Loss must be less than the Entry Price',
      'error'
    );

    // Reset stop loss to a valid level (150)
    fireEvent.change(slInput, { target: { value: '150' } });
    expect(screen.queryByText('Must be less than Entry')).toBeNull();

    // Verify sizer is visible
    expect(screen.getByText('⚖️ Position Sizing')).toBeDefined();

    // Select the Invest Percent input and set it to 20%
    const investInput = document.getElementById('sizer-invest-input');
    fireEvent.change(investInput, { target: { value: '20' } });

    // Entry = 160, SL = 150.
    // Capital = 50000. 20% investment of 50000 = 10000 cash investment.
    // Qty = 10000 / 160 = 62 shares.
    // Verify that the Quantity input automatically adjusted to 62!
    const qtyInput = screen.getByPlaceholderText('e.g. 50');
    expect(qtyInput.value).toBe('62');

    // Click save and verify it saves successfully now
    fireEvent.click(saveBtn);
    expect(mockSetData).toHaveBeenCalled();
  });

  it('correctly calculates position size, realized/floating P&L, risk-reward (R-multiple) and open risk on scaled/pyramided positions', () => {
    const tcsMockData = {
      journals: {
        US: [],
        IN: [
          {
            id: 'tcs-pyramid',
            symbol: 'TCS',
            setup: 'VCP Breakout',
            initialStopLoss: 2040,
            currentStopLoss: 2100,
            isClosed: false,
            transactions: [
              { id: 'tx-t1', type: 'Buy', price: 2125, qty: 500, date: '2026-06-10', reason: 'Initial Entry' },
              { id: 'tx-t2', type: 'Sell', price: 2800, qty: 250, date: '2026-06-12', reason: 'Scale Out' },
              { id: 'tx-t3', type: 'Buy', price: 2050, qty: 150, date: '2026-06-14', reason: 'Pyramid Entry' }
            ]
          }
        ]
      },
      journalCapital: {
        US: 50000,
        IN: 1000000
      },
      aiSettings: {
        apiKey: 'test-key',
        model: 'gemini-2.5-flash'
      }
    };

    const localProps = {
      country: 'IN',
      data: tcsMockData,
      setData: vi.fn()
    };

    renderWithContext(<JournalView {...localProps} />);

    // Avg Entry Price: ₹2,107.69
    expect(screen.getAllByText(/2,107\.69/).length).toBeGreaterThan(0);

    // Active Qty: 400 shares (Total 650 bought - 250 sold)
    expect(screen.getByText('400')).toBeDefined();

    // Active Position Size Pct: (843076.92 / 1000000) * 100 = 84.3%
    expect(screen.getAllByText('84.3%').length).toBeGreaterThan(0);

    // Net Stop Loss % is ((2107.69 - 2100) / 2107.69) * 100 = -0.4%
    expect(screen.getAllByText('-0.4%').length).toBeGreaterThan(0);

    // R-Multiple: P&L of +173,077.50 vs initial risk of 43,998.50 = +3.93 R
    expect(screen.getByText('+3.93 R')).toBeDefined();

    // Net P&L: +173,077.50
    expect(screen.getByText(/173.*077\.50/)).toBeDefined();
  });
});

