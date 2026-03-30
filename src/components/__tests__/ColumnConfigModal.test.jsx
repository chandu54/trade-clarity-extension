import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnConfigModal from '../ColumnConfigModal';

describe('ColumnConfigModal', () => {
  const mockData = {
    uiConfig: {
      columnVisibility: { rs: true, volume: false }
    },
    paramDefinitions: {
      rs: { label: 'Relative Strength' },
      volume: { label: 'Volume' }
    },
    watchlists: [
      { id: 'wl1', name: 'Watchlist 1', visibleParams: ['rs'] }
    ]
  };

  const props = {
    data: mockData,
    setData: vi.fn(),
    onClose: vi.fn(),
    isOpen: true,
    selectedWatchlistId: 'all'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<ColumnConfigModal {...props} />);
    expect(screen.getByText('Column Configuration')).toBeDefined();
    expect(screen.getByText('Relative Strength')).toBeDefined();
  });

  it('toggles global column visibility', () => {
    render(<ColumnConfigModal {...props} />);
    
    // Volume is currently false in mockData.uiConfig.columnVisibility
    const volumeCheckbox = screen.getAllByRole('checkbox')[1]; // rs is 0, volume is 1
    fireEvent.click(volumeCheckbox);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.columnVisibility.volume).toBe(true);
  });

  it('toggles watchlist-specific column visibility', () => {
    render(<ColumnConfigModal {...props} />);
    
    const scopeSelect = screen.getByRole('combobox');
    fireEvent.change(scopeSelect, { target: { value: 'wl1' } });
    
    // rs is currently in visibleParams for wl1
    const rsCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(rsCheckbox);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.watchlists[0].visibleParams).not.toContain('rs');
  });

  it('closes when Close button is clicked', () => {
    render(<ColumnConfigModal {...props} />);
    fireEvent.click(screen.getByText('Close'));
    expect(props.onClose).toHaveBeenCalled();
  });
});
