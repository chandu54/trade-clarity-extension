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
    weekInfo: {},
    country: 'US',
    showTags: true,
    watchlists: [{ id: 'wl1', name: 'Watchlist 1' }, { id: 'wl2', name: 'Watchlist 2' }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with stock data', () => {
    render(<EditStockModal {...props} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByDisplayValue('Tech')).toBeDefined();
    expect(screen.getByDisplayValue('Good stock')).toBeDefined();
  });

  it('updates form data on change', () => {
    render(<EditStockModal {...props} />);
    
    const notesArea = screen.getByPlaceholderText(/Add your analysis notes/i);
    fireEvent.change(notesArea, { target: { value: 'Updated notes' } });
    
    expect(screen.getByDisplayValue('Updated notes')).toBeDefined();
  });

  it('calls onSave with updated data when Save is clicked', () => {
    render(<EditStockModal {...props} />);
    
    const rsInput = screen.getByDisplayValue('85');
    fireEvent.change(rsInput, { target: { value: '90' } });
    
    fireEvent.click(screen.getByText('Save Changes'));
    
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      params: { rs: '90' }
    }));
  });

  it('toggles tags on correctly', () => {
    render(<EditStockModal {...props} />);
    
    // Tag labels are "Growth ✓" (selected) or "Value +" (unselected)
    const valueTag = screen.getByText(/Value \+/);
    fireEvent.click(valueTag);
    
    fireEvent.click(screen.getByText('Save Changes'));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      tags: ['Growth', 'Value']
    }));
  });

  it('toggles tags off correctly', () => {
    render(<EditStockModal {...props} />);
    
    // Toggle off existing tag
    const growthTag = screen.getByText(/Growth ✓/);
    fireEvent.click(growthTag);
    
    fireEvent.click(screen.getByText('Save Changes'));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      tags: []
    }));
  });

  it('toggles watchlists correctly', () => {
    render(<EditStockModal {...props} />);
    
    const wl2Checkbox = screen.getByLabelText('Watchlist 2');
    fireEvent.click(wl2Checkbox);
    
    fireEvent.click(screen.getByText('Save Changes'));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      watchlists: ['wl1', 'wl2']
    }));
  });
});
