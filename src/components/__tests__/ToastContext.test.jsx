import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';
import { useEffect } from 'react';

const TestComponent = ({ message, type, duration }) => {
  const { showToast, hideToast } = useToast();
  
  return (
    <div>
      <button onClick={() => showToast(message, type, duration)}>Show Toast</button>
      <button onClick={hideToast}>Hide Toast</button>
    </div>
  );
};

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should show toast when showToast is called', () => {
    render(
      <ToastProvider>
        <TestComponent message="Toast Message" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Toast Message')).toBeDefined();
  });

  it('should hide toast when hideToast is called', () => {
    render(
      <ToastProvider>
        <TestComponent message="Toast Message" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Toast Message')).toBeDefined();

    fireEvent.click(screen.getByText('Hide Toast'));
    expect(screen.queryByText('Toast Message')).toBeNull();
  });

  it('should auto-hide toast after duration', () => {
    render(
      <ToastProvider>
        <TestComponent message="Auto Hide" duration={2000} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Auto Hide')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Auto Hide')).toBeNull();
  });
});
