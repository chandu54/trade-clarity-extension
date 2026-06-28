import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WeeklyFeedbackModal from '../WeeklyFeedbackModal';
import { ToastContext } from '../ToastContext';
import * as aiService from '../../services/ai';

vi.mock('../../services/ai', () => ({
  getWeeklyJournalFeedback: vi.fn()
}));

const mockShowToast = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      {ui}
    </ToastContext.Provider>
  );
};

describe('WeeklyFeedbackModal', () => {
  const mockData = {
    aiSettings: {
      apiKey: 'test-api-key',
      model: 'gemini-2.5-flash'
    },
    journals: {
      US: [{ id: '1', symbol: 'AAPL', setup: 'Breakout' }]
    },
    weeks: {
      US: {
        '2026-06-21': {
          feedback: {
            wentRight: 'Kept stop loss tight',
            wentWrong: 'Fomoed TSLA',
            improvement: 'Follow rules',
            successfulTrades: '5',
            aiFeedback: 'Good work'
          }
        }
      }
    }
  };

  const props = {
    isOpen: true,
    onClose: vi.fn(),
    data: mockData,
    setData: vi.fn(),
    country: 'US',
    weekKey: '2026-06-21'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and displays existing feedback entries', () => {
    renderWithContext(<WeeklyFeedbackModal {...props} />);
    expect(screen.getByText('Weekly Journal Feedback')).toBeInTheDocument();
    expect(screen.getByText('Kept stop loss tight')).toBeInTheDocument();
    expect(screen.getByText('Fomoed TSLA')).toBeInTheDocument();
    expect(screen.getByText('Good work')).toBeInTheDocument();
  });

  it('saves updated feedback successfully', () => {
    renderWithContext(<WeeklyFeedbackModal {...props} />);
    
    // Change input
    const input = screen.getByText('Kept stop loss tight');
    fireEvent.change(input, { target: { value: 'Did great' } });
    
    fireEvent.click(screen.getByText('Save Weekly Journal'));

    expect(props.setData).toHaveBeenCalled();
    const updatedData = props.setData.mock.calls[0][0](mockData);
    expect(updatedData.weeks.US['2026-06-21'].feedback.wentRight).toBe('Did great');
    expect(mockShowToast).toHaveBeenCalledWith('Weekly feedback saved successfully', 'success');
  });

  it('blocks AI generation if API Key is missing', () => {
    const dataWithoutKey = {
      ...mockData,
      aiSettings: { apiKey: '' }
    };
    renderWithContext(<WeeklyFeedbackModal {...props} data={dataWithoutKey} />);
    
    fireEvent.click(screen.getByText('✨ Generate AI Notes'));
    
    expect(mockShowToast).toHaveBeenCalledWith('API Key missing. Please configure AI settings first.', 'error');
  });

  it('calls AI service and populates generated text box', async () => {
    aiService.getWeeklyJournalFeedback.mockResolvedValueOnce('AI Advice: Be patient');
    renderWithContext(<WeeklyFeedbackModal {...props} />);
    
    fireEvent.click(screen.getByText('✨ Generate AI Notes'));

    expect(screen.getByText('Generating...')).toBeInTheDocument();
    
    await act(async () => {
      await Promise.resolve(); // wait for async generator call
    });

    expect(aiService.getWeeklyJournalFeedback).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Generated AI feedback', 'success');
  });
});
