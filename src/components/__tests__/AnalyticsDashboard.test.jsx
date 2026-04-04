import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalyticsDashboard from '../AnalyticsDashboard';
import { ToastContext } from '../ToastContext';
import { ConfirmContext } from '../ConfirmContext';

const mockShowToast = vi.fn();
const mockConfirm = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      <ConfirmContext.Provider value={{ confirm: mockConfirm }}>
        {ui}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

describe('AnalyticsDashboard', () => {
  const mockStocks = [
    { symbol: 'AAPL', sector: 'Tech', params: { rs: 80, volume: 100 }, tradable: true },
    { symbol: 'MSFT', sector: 'Tech', params: { rs: 90, volume: 200 }, tradable: false }
  ];

  const mockParameters = [
    { id: 'rs', label: 'RS', type: 'number' },
    { id: 'volume', label: 'Volume', type: 'number' }
  ];

  const props = {
    country: 'US',
    stocks: mockStocks,
    allWeeksData: { US: {} },
    aiSettings: {},
    parameters: mockParameters,
    weekKey: '2024-03-17',
    selectedWatchlistId: 'all',
    watchlists: [],
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with overview stats', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    expect(screen.getByText('Analytics Dashboard')).toBeDefined();
    // Total stocks count (2) should be displayed
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('renders correctly for a specific country (e.g. IN)', () => {
    const indiaProps = { ...props, country: 'IN' };
    renderWithContext(<AnalyticsDashboard {...indiaProps} />);
    // Verify the country is passed down or reflected in UI if title uses it
    expect(screen.getByText('Analytics Dashboard')).toBeDefined();
  });

  it('only renders charts for the parameters provided in props', () => {
    // If only one param is passed (e.g. filtered by country elsewhere)
    const limitedParams = [{ id: 'rs', label: 'RS', type: 'number' }];
    renderWithContext(<AnalyticsDashboard {...props} parameters={limitedParams} />);
    
    expect(screen.getByText('RS')).toBeDefined();
    expect(screen.queryByText('Volume')).toBeNull();
  });

  it('renders sector distribution based on stocks passed', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    expect(screen.getByText('Sector Distribution')).toBeDefined();
    // Check if 'Tech' is present (our mock stocks are in Tech)
    expect(screen.getAllByText(/Tech/i).length).toBeGreaterThan(0);
  });

  it('opens expanded view when clicking a parameter card', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    
    // Find the RS header
    const rsHeader = screen.getByText('RS');
    const card = rsHeader.closest('.chart-card');
    const expandBtn = card.querySelector('.expand-btn');
    
    fireEvent.click(expandBtn);
    
    // Expanded view should show the breakdown title
    expect(screen.getByText('RS Breakdown')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });
});
