import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MovingAverageRibbon from '../MovingAverageRibbon';

describe('MovingAverageRibbon', () => {
  it('should render nothing if no value is provided', () => {
    const { container } = render(<MovingAverageRibbon value="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should mark all badges as ABOVE when value is "Above all"', () => {
    render(<MovingAverageRibbon value="Above all" />);
    const mas = ["5", "10", "21", "50", "200"];
    
    mas.forEach(ma => {
      const badge = screen.getByText(ma);
      // Verify semantic 'above' class is applied
      expect(badge.className).toContain('above');
    });
  });

  it('should mark only specified badges as ABOVE', () => {
    render(<MovingAverageRibbon value="Above 5, 21" />);
    
    const ma5 = screen.getByText('5');
    const ma21 = screen.getByText('21');
    const ma50 = screen.getByText('50');

    expect(ma5.className).toContain('above');
    expect(ma21.className).toContain('above');
    expect(ma50.className).toContain('below');
  });

  it('should handle "compact" variant for the widget', () => {
    render(<MovingAverageRibbon value="Above 200" variant="compact" />);
    
    const ma200 = screen.getByText('200');
    const ma50 = screen.getByText('50');

    // Verify both semantic status and variant class
    expect(ma200.className).toContain('above');
    expect(ma200.className).toContain('compact-badge');
    expect(ma50.className).toContain('below');
  });

  it('should show the "MA" label when showLabel is true', () => {
    render(<MovingAverageRibbon value="Above all" showLabel={true} />);
    expect(screen.getByText('Moving Averages')).toBeDefined();
  });

  it('should show the compact "MA" label when variant is compact and showLabel is true', () => {
    render(<MovingAverageRibbon value="Above all" variant="compact" showLabel={true} />);
    expect(screen.getByText('MA')).toBeDefined();
  });

  it('should be case insensitive', () => {
    render(<MovingAverageRibbon value="ABOVE ALL" />);
    const ma5 = screen.getByText('5');
    expect(ma5.className).toContain('above');
  });
});
