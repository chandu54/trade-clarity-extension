import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WatchlistFilterDrawer from '../WatchlistFilterDrawer';

describe('WatchlistFilterDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    filters: {},
    setFilter: vi.fn(),
    setFilters: vi.fn(),
    priceTrendFilter: null,
    setPriceTrendFilter: vi.fn(),
    activeFilters: [],
    isSectorFilterable: true,
    sectors: ['Technology', 'Healthcare', 'Finance'],
    isTagFilterable: true,
    availableTags: ['Breakout', 'VCP'],
    filterableParams: [
      ['pe', { label: 'PE Ratio', type: 'number' }],
      ['movingAverages', { label: 'Moving Averages', type: 'select' }]
    ],
    isTradableFilterable: true,
    country: 'IN'
  };

  it('renders correctly when open', () => {
    render(<WatchlistFilterDrawer {...defaultProps} />);
    expect(screen.getByText('Filters')).toBeDefined();
    expect(screen.getByText('General Filters')).toBeDefined();
    expect(screen.getByText('Technical Metrics & Rules')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<WatchlistFilterDrawer {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button or Esc is pressed', () => {
    render(<WatchlistFilterDrawer {...defaultProps} />);
    const closeBtn = screen.getByTitle('Close filter panel (Esc)');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });

  it('calls setFilters and setPriceTrendFilter when Clear All is clicked', () => {
    render(
      <WatchlistFilterDrawer
        {...defaultProps}
        activeFilters={[['__sector__', 'Technology']]}
      />
    );
    const resetBtn = screen.getByTitle('Clear all active filters');
    fireEvent.click(resetBtn);
    expect(defaultProps.setFilters).toHaveBeenCalledWith({});
    expect(defaultProps.setPriceTrendFilter).toHaveBeenCalledWith(null);
  });

  it('toggles price trend filter when Advances/Declines buttons are clicked', () => {
    render(<WatchlistFilterDrawer {...defaultProps} />);
    const advancesBtn = screen.getByText(/Advances/i);
    fireEvent.click(advancesBtn);
    expect(defaultProps.setPriceTrendFilter).toHaveBeenCalledWith('up');
  });
});
