import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnConfigModal from '../ColumnConfigModal';

describe('ColumnConfigModal', () => {
  let mockData;
  let props;

  beforeEach(() => {
    mockData = {
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

    props = {
      data: mockData,
      setData: vi.fn(),
      onClose: vi.fn(),
      isOpen: true,
      selectedWatchlistId: 'all'
    };

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

  it('toggles Live Price column visibility', () => {
    render(<ColumnConfigModal {...props} />);
    
    const livePriceCheckbox = screen.getAllByRole('checkbox')[2];
    fireEvent.click(livePriceCheckbox);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.columnVisibility.__livePrice__).toBe(false);
  });

  it('toggles Live Price globally even when a watchlist scope is selected', () => {
    render(<ColumnConfigModal {...props} />);
    
    // Switch to a watchlist scope
    const scopeSelect = screen.getByRole('combobox');
    fireEvent.change(scopeSelect, { target: { value: 'wl1' } });

    // Live Price is Checkbox 2
    const livePriceCheckbox = screen.getAllByRole('checkbox')[2];
    fireEvent.click(livePriceCheckbox);

    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    
    // It should have modified global uiConfig rather than watchlist's visibleParams
    expect(updatedData.uiConfig.columnVisibility.__livePrice__).toBe(false);
    expect(updatedData.watchlists[0].visibleParams).not.toContain('__livePrice__');
  });

  it('closes when Close button is clicked', () => {
    render(<ColumnConfigModal {...props} />);
    fireEvent.click(screen.getByText('Close'));
    expect(props.onClose).toHaveBeenCalled();
  });
});
