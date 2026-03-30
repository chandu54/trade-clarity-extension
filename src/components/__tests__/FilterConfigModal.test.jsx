import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterConfigModal from '../FilterConfigModal';

describe('FilterConfigModal', () => {
  const mockData = {
    uiConfig: {
      sectorFilterable: true,
      tradableFilterable: false,
      tagFilterable: true
    },
    paramDefinitions: {
      rs: { label: 'Relative Strength', filterable: true },
      volume: { label: 'Volume', filterable: false }
    },
    watchlists: [
      { id: 'wl1', name: 'Watchlist 1', visibleFilters: ['rs'] }
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
    render(<FilterConfigModal {...props} />);
    expect(screen.getByText('Filter Configuration')).toBeDefined();
    expect(screen.getByText('Relative Strength')).toBeDefined();
  });

  it('toggles system filters (Global only)', () => {
    render(<FilterConfigModal {...props} />);
    
    // Sector is 0, Tradable is 1, Tag is 2
    const tradableSwitch = screen.getAllByRole('checkbox')[1];
    fireEvent.click(tradableSwitch);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.uiConfig.tradableFilterable).toBe(true);
  });

  it('toggles global parameter filterability', () => {
    render(<FilterConfigModal {...props} />);
    
    // System filters (3) + Params (rs, volume)
    // rs is 3, volume is 4
    const volumeSwitch = screen.getAllByRole('checkbox')[4];
    fireEvent.click(volumeSwitch);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.paramDefinitions.volume.filterable).toBe(true);
  });

  it('toggles watchlist-specific filterability', () => {
    render(<FilterConfigModal {...props} />);
    
    const scopeSelect = screen.getByRole('combobox');
    fireEvent.change(scopeSelect, { target: { value: 'wl1' } });
    
    // System filters are disabled in watchlist scope (checked by prop 'disabled')
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();

    // rs is index 3
    const rsSwitch = screen.getAllByRole('checkbox')[3];
    fireEvent.click(rsSwitch);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.watchlists[0].visibleFilters).not.toContain('rs');
  });
});
