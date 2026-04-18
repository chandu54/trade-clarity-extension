import { describe, it, vi, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MovingAverageFilter } from '../StockGrid';

describe('MovingAverageFilter', () => {
  const defaultProps = {
    value: {},
    onChange: vi.fn(),
    id: 'ma-filter'
  };

  it('renders "All" when no filters are selected', () => {
    render(<MovingAverageFilter {...defaultProps} />);
    expect(screen.getByText('All')).toBeDefined();
  });

  it('renders descriptive text when filters are selected', () => {
    const value = { "50": "above", "5": "below" };
    render(<MovingAverageFilter {...defaultProps} value={value} />);
    expect(screen.getByText('Above 50 | Below 5')).toBeDefined();
  });

  it('opens matrix and allows selecting "Above"', () => {
    const onChange = vi.fn();
    const { container } = render(<MovingAverageFilter {...defaultProps} onChange={onChange} />);
    
    // Open popover
    fireEvent.click(screen.getByRole('button'));
    
    // Find the 'Above' cell for 50 MA. 
    // In our implementation, the first cell in the 50 MA row is 'Above'.
    const rows = Array.from(container.querySelectorAll('.ma-matrix-row'));
    const row50 = rows.find(r => r.textContent.includes('50 MA'));
    const cells = row50.querySelectorAll('.ma-matrix-cell');
    
    // Above is the first cell (index 0)
    fireEvent.click(cells[0]);
    
    expect(onChange).toHaveBeenCalledWith({ "50": "above" });
  });

  it('swaps "Above" to "Below" when toggled on the same row', () => {
    const onChange = vi.fn();
    const value = { "50": "above" };
    const { container } = render(<MovingAverageFilter {...defaultProps} value={value} onChange={onChange} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    const rows = Array.from(container.querySelectorAll('.ma-matrix-row'));
    const row50 = rows.find(r => r.textContent.includes('50 MA'));
    const cells = row50.querySelectorAll('.ma-matrix-cell');
    
    // Click 'Below' (index 1)
    fireEvent.click(cells[1]);
    
    expect(onChange).toHaveBeenCalledWith({ "50": "below" });
  });

  it('clears selection when clicking the active cell', () => {
    const onChange = vi.fn();
    const value = { "50": "above" };
    const { container } = render(<MovingAverageFilter {...defaultProps} value={value} onChange={onChange} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    const rows = Array.from(container.querySelectorAll('.ma-matrix-row'));
    const row50 = rows.find(r => r.textContent.includes('50 MA'));
    const cells = row50.querySelectorAll('.ma-matrix-cell');
    
    // Click 'Above' again (active)
    fireEvent.click(cells[0]);
    
    expect(onChange).toHaveBeenCalledWith("");
  });

  it('resets all filters when "Clear" is clicked', () => {
    const onChange = vi.fn();
    const value = { "50": "above", "5": "below" };
    render(<MovingAverageFilter {...defaultProps} value={value} onChange={onChange} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    
    expect(onChange).toHaveBeenCalledWith("");
  });
});
