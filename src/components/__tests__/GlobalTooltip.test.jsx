import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GlobalTooltip from '../GlobalTooltip';

describe('GlobalTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should not render initially', () => {
    render(<GlobalTooltip />);
    expect(document.querySelector('.global-tooltip')).toBeNull();
  });

  it('should show tooltip on mouseover an element with title', () => {
    render(<GlobalTooltip />);
    const btn = document.createElement('button');
    btn.title = 'Help Text';
    document.body.appendChild(btn);

    fireEvent.mouseOver(btn);
    
    expect(screen.getByText('Help Text')).toBeDefined();
    expect(btn.getAttribute('title')).toBeNull();
    expect(btn.getAttribute('data-tooltip')).toBe('Help Text');
  });

  it('should hide tooltip on mouseout', () => {
    render(<GlobalTooltip />);
    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Tooltip');
    document.body.appendChild(btn);

    fireEvent.mouseOver(btn);
    expect(screen.getByText('Tooltip')).toBeDefined();

    fireEvent.mouseOut(btn);
    expect(screen.queryByText('Tooltip')).toBeNull();
  });

  it('should hide tooltip on escape key', () => {
    render(<GlobalTooltip />);
    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Tooltip');
    document.body.appendChild(btn);

    fireEvent.mouseOver(btn);
    expect(screen.getByText('Tooltip')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Tooltip')).toBeNull();
  });

  it('should hide tooltip on scroll', () => {
    render(<GlobalTooltip />);
    const btn = document.createElement('button');
    btn.setAttribute('data-tooltip', 'Tooltip');
    document.body.appendChild(btn);

    fireEvent.mouseOver(btn);
    expect(screen.getByText('Tooltip')).toBeDefined();

    fireEvent.scroll(window);
    expect(screen.queryByText('Tooltip')).toBeNull();
  });
});
