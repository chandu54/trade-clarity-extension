import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImportWatchlistModal from '../ImportWatchlistModal';

describe('ImportWatchlistModal', () => {
  const props = {
    isOpen: true,
    stocks: [
      { symbol: 'AAPL', sector: 'Technology' },
      { symbol: 'MSFT', sector: 'Technology' }
    ],
    watchlists: [
      { id: 'wl1', name: 'Tech Watchlist' },
      { id: 'wl2', name: 'Growth Watchlist' }
    ],
    selectedWatchlistId: 'wl1',
    onConfirm: vi.fn(),
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with stocks list count and watchlists', () => {
    render(<ImportWatchlistModal {...props} />);
    expect(screen.getByText('Import Stocks')).toBeInTheDocument();
    expect(screen.getByText('Importing 2 stocks. Select watchlists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tech Watchlist')).toBeInTheDocument();
    expect(screen.getByLabelText('Growth Watchlist')).toBeInTheDocument();
  });

  it('pre-selects the active watchlist checkbox by default', () => {
    render(<ImportWatchlistModal {...props} />);
    expect(screen.getByLabelText('Tech Watchlist').checked).toBe(true);
    expect(screen.getByLabelText('Growth Watchlist').checked).toBe(false);
  });

  it('updates selected watchlists when checkboxes are toggled', () => {
    render(<ImportWatchlistModal {...props} />);
    
    // Toggle Growth Watchlist ON
    fireEvent.click(screen.getByLabelText('Growth Watchlist'));
    expect(screen.getByLabelText('Growth Watchlist').checked).toBe(true);
    
    // Toggle Tech Watchlist OFF
    fireEvent.click(screen.getByLabelText('Tech Watchlist'));
    expect(screen.getByLabelText('Tech Watchlist').checked).toBe(false);
  });

  it('calls onConfirm with mapped watchlists on import button click', () => {
    render(<ImportWatchlistModal {...props} />);
    
    // Toggle Growth Watchlist ON (Tech Watchlist is already ON)
    fireEvent.click(screen.getByLabelText('Growth Watchlist'));
    
    fireEvent.click(screen.getByRole('button', { name: /Import 2 Stocks/i }));
    
    expect(props.onConfirm).toHaveBeenCalledWith([
      { symbol: 'AAPL', sector: 'Technology', watchlists: ['wl1', 'wl2'] },
      { symbol: 'MSFT', sector: 'Technology', watchlists: ['wl1', 'wl2'] }
    ]);
  });

  it('calls onClose on cancel button click', () => {
    render(<ImportWatchlistModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
