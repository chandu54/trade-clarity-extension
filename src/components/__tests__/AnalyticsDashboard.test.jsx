import { describe, it, vi, beforeEach } from 'vitest';
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
    // Title is now "Analytics Dashboard"
    expect(screen.getByText('Analytics Dashboard')).toBeDefined();
    // Check total stocks count (it's in a specific card now, but search for it)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('renders sector breakdown chart', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    // Title is now "Sector Distribution"
    expect(screen.getByText('Sector Distribution')).toBeDefined();
    // Use regex to find Tech (might be in tooltips or list)
    expect(screen.getAllByText(/Tech/i).length).toBeGreaterThan(0);
  });

  it('opens expanded view when clicking a parameter', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    
    // Find the RS card title
    const rsTitle = screen.getByText('RS');
    expect(rsTitle).toBeDefined();
    
    // Target the "View details" button in that card
    const cardHeaders = screen.getAllByRole('heading', { level: 3 });
    const rsHeader = cardHeaders.find(h => h.textContent === 'RS');
    const container = rsHeader.closest('.chart-card');
    const expandBtn = container.querySelector('.expand-btn');
    
    fireEvent.click(expandBtn);
    
    // "Breakdown" is added by ExpandedView
    expect(screen.getByText('RS Breakdown')).toBeDefined();
  });

  it('closes the dashboard when close button is clicked', () => {
    renderWithContext(<AnalyticsDashboard {...props} />);
    // Target by class since we haven't added the title yet, or just check for the multiplication sign
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });
});
