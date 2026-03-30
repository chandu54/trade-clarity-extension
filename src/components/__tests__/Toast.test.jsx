import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should render message correctly', () => {
    render(<Toast message="Test Message" onClose={vi.fn()} />);
    expect(screen.getByText('Test Message')).toBeDefined();
  });

  it('should call onClose after duration', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} duration={3000} />);
    
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} />);
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
