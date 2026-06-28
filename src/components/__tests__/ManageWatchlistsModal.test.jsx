import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManageWatchlistsModal from '../ManageWatchlistsModal';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

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

describe('ManageWatchlistsModal', () => {
  const mockData = {
    paramDefinitions: {
      volume: { type: 'number', filterable: true },
      rs: { type: 'number', filterable: true }
    },
    watchlists: [
      { id: 'wl-1', name: 'Tech Watchlist', isDefault: false },
      { id: 'wl-2', name: 'Growth Watchlist', isDefault: true }
    ],
    weeks: {
      US: {
        '2024-03-17': {
          stocks: {
            AAPL: { symbol: 'AAPL', watchlists: ['wl-1'] }
          }
        }
      }
    }
  };

  const props = {
    data: mockData,
    setData: vi.fn(),
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    renderWithContext(<ManageWatchlistsModal {...props} />);
    expect(screen.getByText('Manage Watchlists')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New Watchlist Name')).toBeInTheDocument();
    expect(screen.getByText('All Stocks (System Default)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tech Watchlist')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Growth Watchlist')).toBeInTheDocument();
  });

  it('calls setData and showToast when creating a new watchlist', () => {
    renderWithContext(<ManageWatchlistsModal {...props} />);
    
    const input = screen.getByPlaceholderText('New Watchlist Name');
    fireEvent.change(input, { target: { value: 'Momentum Watchlist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.watchlists).toHaveLength(3);
    expect(updatedData.watchlists[2].name).toBe('Momentum Watchlist');
    expect(mockShowToast).toHaveBeenCalledWith('Watchlist created', 'success');
  });

  it('calls confirm, deletes watchlist and cleans up stock watchlists on delete click', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    renderWithContext(<ManageWatchlistsModal {...props} />);
    
    // Find delete buttons. All Stocks has none, Tech and Growth have 1 each.
    const deleteBtns = screen.getAllByTitle('Delete Watchlist');
    expect(deleteBtns).toHaveLength(2);
    
    // Delete Tech Watchlist (wl-1)
    fireEvent.click(deleteBtns[0]);
    
    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this watchlist? This will not delete the stocks within it.');
    
    // Wait for promise resolution
    await vi.waitFor(() => expect(props.setData).toHaveBeenCalled());
    
    const updatedData = props.setData.mock.calls[0][0];
    // Tech Watchlist should be removed from watchlists list
    expect(updatedData.watchlists).toHaveLength(1);
    expect(updatedData.watchlists[0].id).toBe('wl-2');
    
    // Tech Watchlist (wl-1) should be cleaned up from AAPL's watchlists array
    expect(updatedData.weeks.US['2024-03-17'].stocks.AAPL.watchlists).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith('Watchlist deleted', 'success');
  });

  it('calls setData when renaming a watchlist', () => {
    renderWithContext(<ManageWatchlistsModal {...props} />);
    
    const input = screen.getByDisplayValue('Tech Watchlist');
    fireEvent.change(input, { target: { value: 'Technology Stocks' } });
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.watchlists[0].name).toBe('Technology Stocks');
  });

  it('sets default watchlist correctly', () => {
    renderWithContext(<ManageWatchlistsModal {...props} />);
    
    // Find radios. All Stocks, Tech, Growth
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    
    // Set Tech Watchlist (radios[1]) as default
    fireEvent.click(radios[1]);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.watchlists[0].isDefault).toBe(true);
    expect(updatedData.watchlists[1].isDefault).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith('Tech Watchlist set as default', 'success');
  });

  it('sets All Stocks as default correctly', () => {
    renderWithContext(<ManageWatchlistsModal {...props} />);
    
    const radios = screen.getAllByRole('radio');
    // Set All Stocks (radios[0]) as default
    fireEvent.click(radios[0]);
    
    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0];
    expect(updatedData.watchlists.every(w => !w.isDefault)).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith('All Stocks set as default', 'success');
  });
});
