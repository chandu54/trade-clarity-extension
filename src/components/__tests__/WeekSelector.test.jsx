import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeekSelector from '../WeekSelector';
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

describe('WeekSelector', () => {
  const mockData = {
    watchlists: [
      { id: 'wl-1', name: 'Tech Watchlist' }
    ],
    weeks: {
      US: {
        '2026-06-21': {
          stocks: {
            AAPL: { symbol: 'AAPL', watchlists: ['wl-1'] }
          }
        }
      }
    },
    paramDefinitions: {}
  };

  const props = {
    data: mockData,
    setData: vi.fn(),
    country: 'US',
    weekKey: '2026-06-21',
    setWeekKey: vi.fn(),
    selectedWatchlistId: 'wl-1',
    setSelectedWatchlistId: vi.fn(),
    onClearWeek: vi.fn(),
    onAnalyze: vi.fn(),
    onBulkAnalyze: vi.fn(),
    onShowAnalytics: vi.fn(),
    onShowWeeklyFeedback: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders elements and triggers navigation/action buttons correctly', () => {
    renderWithContext(<WeekSelector {...props} />);
    
    // Check buttons
    expect(screen.getByTitle('Analytics Dashboard (Alt + A)')).toBeInTheDocument();
    expect(screen.getByText('Clear Watchlist')).toBeInTheDocument();
    
    // Trigger Analytics
    fireEvent.click(screen.getByTitle('Analytics Dashboard (Alt + A)'));
    expect(props.onShowAnalytics).toHaveBeenCalled();

    // Trigger AI Feedback
    fireEvent.click(screen.getByTitle('Weekly Journal & Reflection'));
    expect(props.onShowWeeklyFeedback).toHaveBeenCalled();
  });

  it('asks for confirmation and clears watchlist stocks on click', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    renderWithContext(<WeekSelector {...props} />);

    const clearBtn = screen.getByTitle('Remove all stocks from this watchlist for the current week');
    fireEvent.click(clearBtn);

    expect(mockConfirm).toHaveBeenCalledWith('Remove all stocks from watchlist "Tech Watchlist" for this week?');
    
    await vi.waitFor(() => expect(props.setData).toHaveBeenCalled());
    
    const updatedData = props.setData.mock.calls[0][0];
    // AAPL should have wl-1 removed from its watchlists
    expect(updatedData.weeks.US['2026-06-21'].stocks.AAPL.watchlists).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith('Watchlist "Tech Watchlist" cleared for this week', 'success');
  });

  it('updates selected date and calls setWeekKey on input change', () => {
    const { container } = renderWithContext(<WeekSelector {...props} />);
    const dateInput = container.querySelector('input[type="date"]');
    
    // Change date from Sunday to Monday of next week
    fireEvent.change(dateInput, { target: { value: '2026-06-29' } });
    
    // Sunday of 2026-06-29 is 2026-06-28
    expect(props.setWeekKey).toHaveBeenCalledWith('2026-06-28');
  });
});
