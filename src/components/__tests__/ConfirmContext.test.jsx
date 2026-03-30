import { describe, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from '../ConfirmContext';
import { useEffect } from 'react';

const TestComponent = ({ message, onResult }) => {
  const { confirm } = useConfirm();
  
  useEffect(() => {
    if (message) {
      confirm(message).then(onResult);
    }
  }, [message, confirm, onResult]);

  return <div>Test Component</div>;
};

describe('ConfirmContext', () => {
  it('should show confirmation modal and resolve progress', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestComponent message="Are you sure?" onResult={onResult} />
      </ConfirmProvider>
    );

    expect(screen.getByText('Are you sure?')).toBeDefined();
    
    fireEvent.click(screen.getByText('Confirm'));
    
    // Wait for promise resolution
    await act(async () => {
      await Promise.resolve();
    });

    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Are you sure?')).toBeNull();
  });

  it('should resolve false when Cancel is clicked', async () => {
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestComponent message="Delete item?" onResult={onResult} />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Cancel'));
    
    await act(async () => {
      await Promise.resolve();
    });

    expect(onResult).toHaveBeenCalledWith(false);
  });
});
