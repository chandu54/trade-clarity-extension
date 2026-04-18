import { describe, it, vi, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditingRulesModal from '../EditingRulesModal';

describe('EditingRulesModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    data: {
      uiConfig: {
        lockPreviousWeeks: true,
        enableApiHydration: true,
        autoRefreshMetrics: true
      }
    },
    setData: vi.fn()
  };

  it('renders correctly when open', () => {
    render(<EditingRulesModal {...defaultProps} />);
    expect(screen.getByText('Rules')).toBeDefined();
    expect(screen.getByText('Auto-Refresh Metrics Daily')).toBeDefined();
  });

  it('toggles "Auto-Refresh Metrics Daily" correctly', () => {
    const setData = vi.fn();
    render(<EditingRulesModal {...defaultProps} setData={setData} />);
    
    // Find the third switch (Auto-Refresh is at the bottom)
    const switches = screen.getAllByRole('checkbox');
    const autoRefreshToggle = switches[2];
    
    fireEvent.click(autoRefreshToggle);
    
    // It should call setData with autoRefreshMetrics: false
    // Since default was true (and modal renders it checked)
    expect(setData).toHaveBeenCalled();
    const callArg = setData.mock.calls[0][0];
    expect(callArg.uiConfig.autoRefreshMetrics).toBe(false);
  });

  it('toggles "Read-only Previous Weeks" correctly', () => {
    const setData = vi.fn();
    render(<EditingRulesModal {...defaultProps} setData={setData} />);
    
    const switches = screen.getAllByRole('checkbox');
    const readOnlyToggle = switches[0];
    
    fireEvent.click(readOnlyToggle);
    
    expect(setData).toHaveBeenCalled();
    const callArg = setData.mock.calls[0][0];
    expect(callArg.uiConfig.lockPreviousWeeks).toBe(false);
  });

  it('closes when clicking the Close button', () => {
    const onClose = vi.fn();
    render(<EditingRulesModal {...defaultProps} onClose={onClose} />);
    
    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);
    
    expect(onClose).toHaveBeenCalled();
  });
});
