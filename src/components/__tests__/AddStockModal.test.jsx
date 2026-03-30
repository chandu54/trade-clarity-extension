import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddStockModal from '../AddStockModal';

describe('AddStockModal', () => {
  const props = {
    onAdd: vi.fn(),
    onImport: vi.fn(),
    onClose: vi.fn(),
    existingStocks: {},
    isOpen: true,
    sectors: [],
    onParseTv: vi.fn(),
    watchlists: [{ id: 'wl1', name: 'Watchlist 1' }],
    selectedWatchlistId: 'all'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(<AddStockModal {...props} />);
    expect(screen.getByText('Add Stocks')).toBeDefined();
    expect(screen.getByPlaceholderText(/e.g. AAPL/i)).toBeDefined();
  });

  it('calls onAdd with symbols and watchlists on valid manual entry', () => {
    render(<AddStockModal {...props} />);
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. AAPL/i), { target: { value: 'AAPL, MSFT' } });
    fireEvent.click(screen.getByLabelText('Watchlist 1'));
    fireEvent.click(screen.getByText('Add'));

    expect(props.onAdd).toHaveBeenCalledWith('AAPL, MSFT', ['wl1']);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows error message if duplicate stock is added', () => {
    const existingStocks = {
      'AAPL': { symbol: 'AAPL', watchlists: [] }
    };
    render(<AddStockModal {...props} existingStocks={existingStocks} />);
    
    fireEvent.change(screen.getByPlaceholderText(/e.g. AAPL/i), { target: { value: 'AAPL' } });
    fireEvent.click(screen.getByText('Add'));

    expect(screen.getByText(/Stock\(s\) already exist/i)).toBeDefined();
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('handles TradingView import correctly', () => {
    props.onParseTv.mockReturnValue([{ symbol: 'TSLA' }]);
    render(<AddStockModal {...props} />);
    
    fireEvent.click(screen.getByText('TradingView Import'));
    fireEvent.change(screen.getByPlaceholderText(/Paste your exported list/i), { target: { value: 'TSLA' } });
    fireEvent.click(screen.getByText('Add'));

    expect(props.onParseTv).toHaveBeenCalledWith('TSLA');
    expect(props.onImport).toHaveBeenCalledWith([{ symbol: 'TSLA', watchlists: [] }]);
  });

  it('shows error if TradingView data is empty', () => {
    render(<AddStockModal {...props} />);
    fireEvent.click(screen.getByText('TradingView Import'));
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText(/Please paste the TradingView watchlist data/i)).toBeDefined();
  });
});
