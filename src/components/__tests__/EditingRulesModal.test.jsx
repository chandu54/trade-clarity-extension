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
        autoRefreshMetrics: true,
        rsAutoCalc: true
      }
    },
    setData: vi.fn()
  };

  it('renders correctly when open', () => {
    render(<EditingRulesModal {...defaultProps} />);
    expect(screen.getByText('Rules')).toBeDefined();
    expect(screen.getByText('Auto-Refresh Metrics Daily')).toBeDefined();
    expect(screen.getByText('Auto-Identify Stock Sectors')).toBeDefined();
    expect(screen.getByText('Relative Strength (RS) & Benchmark Rules')).toBeDefined();
  });

  it('toggles "Auto-Identify Stock Sectors" correctly', () => {
    const setData = vi.fn();
    render(<EditingRulesModal {...defaultProps} setData={setData} />);
    
    const switches = screen.getAllByRole('checkbox');
    // switches:
    // 0: lockPreviousWeeks
    // 1: enableApiHydration
    // 2: rsAutoCalc
    // 3: autoIdentifySectors
    // 4: autoRefreshMetrics
    const autoIdentifyToggle = switches[3];
    
    fireEvent.click(autoIdentifyToggle);
    
    expect(setData).toHaveBeenCalled();
    const callArg = setData.mock.calls[0][0];
    expect(callArg.uiConfig.autoIdentifySectors).toBe(false);
  });

  it('toggles "Auto-Refresh Metrics Daily" correctly', () => {
    const setData = vi.fn();
    render(<EditingRulesModal {...defaultProps} setData={setData} />);
    
    const switches = screen.getAllByRole('checkbox');
    const autoRefreshToggle = switches[4];
    
    fireEvent.click(autoRefreshToggle);
    
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
