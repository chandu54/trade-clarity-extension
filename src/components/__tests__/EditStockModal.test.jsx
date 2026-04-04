import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditStockModal from '../EditStockModal';

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
    // US stock (AAPL) should have NASDAQ prefix
    expect(tvLink.getAttribute('href')).toContain('NASDAQ:AAPL');
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
});
