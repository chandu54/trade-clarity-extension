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
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('aggregates Macro Themes correctly and displays them in distribution and expanded view', () => {
    const thematicStocks = [
      {
        symbol: 'NVDA',
        sector: 'Semiconductors',
        macroTheme: 'AI & Data Centers',
        dependentIndustries: ['Data Center GPU', 'Hyperscale AI'],
        params: { rs: 95 }
      },
      {
        symbol: 'AMD',
        sector: 'Semiconductors',
        macroTheme: 'AI & Data Centers',
        dependentIndustries: ['AI Accelerators'],
        params: { rs: 88 }
      },
      {
        symbol: 'HAL',
        sector: 'Defense',
        // Missing macroTheme to test backward-compatibility fallback to dependentIndustries[0]
        dependentIndustries: ['Aerospace & Defense', 'Fighter Jets'],
        params: { rs: 82 }
      }
    ];

    renderWithContext(<AnalyticsDashboard {...props} stocks={thematicStocks} />);
    
    // Both consolidated macro themes should be rendered (normalized into canonical baskets)
    expect(screen.getByText('AI & Data Centers')).toBeDefined();
    expect(screen.getByText('Aerospace & Defense')).toBeDefined();

    // Verify AI & Data Centers shows 2 stocks
    const aiThemeCard = screen.getByText('AI & Data Centers').closest('.ai-scope-tag-row');
    expect(aiThemeCard.textContent).toContain('2 stocks');

    // Test expanding Macro Theme Distribution
    const macroThemeHeader = screen.getByText('Macro Theme Distribution');
    const chartCard = macroThemeHeader.closest('.chart-card');
    const expandBtn = chartCard.querySelector('.expand-btn');
    fireEvent.click(expandBtn);

    // Explorer should open with title "Macro Theme Distribution Breakdown"
    expect(screen.getByText(/Macro Theme Distribution Breakdown/i)).toBeDefined();
    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AMD').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Data Center GPU/i).length).toBeGreaterThan(0);
  });

  it('aggregates multi-thematic stocks across multiple theme baskets with role badges and theses', () => {
    const multiThematicStocks = [
      {
        symbol: 'AVALON',
        sector: 'Electronics',
        macroTheme: 'AI & Data Centers',
        thematicVectors: [
          {
            theme: 'AI & Data Centers',
            role: 'Pick-and-Shovel Enabler',
            conviction: 'High',
            thesis: 'Produces server boards for AI data centers',
          },
          {
            theme: 'Aerospace & Defense',
            role: 'Component Supplier',
            conviction: 'High',
            thesis: 'Manufactures radar PCBs for defense primes',
          },
        ],
        params: { rs: 85 },
      },
    ];

    renderWithContext(<AnalyticsDashboard {...props} stocks={multiThematicStocks} />);

    // AVALON should appear in BOTH baskets
    expect(screen.getByText('AI & Data Centers')).toBeDefined();
    expect(screen.getByText('Aerospace & Defense')).toBeDefined();

    // Expand Macro Theme Distribution
    const macroThemeHeader = screen.getByText('Macro Theme Distribution');
    const chartCard = macroThemeHeader.closest('.chart-card');
    const expandBtn = chartCard.querySelector('.expand-btn');
    fireEvent.click(expandBtn);

    // Both roles and theses should be rendered (present on stock card badge as well as role filter dropdown)
    expect(screen.getAllByText('Pick-and-Shovel Enabler').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Component Supplier').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/"Produces server boards for AI data centers"/i)).toBeDefined();
    expect(screen.getByText(/"Manufactures radar PCBs for defense primes"/i)).toBeDefined();
  });

  it('supports searching by stock name and filtering by Roles in expanded view', () => {
    const testStocks = [
      {
        symbol: 'TITAN',
        name: 'Titan Company Limited',
        sector: 'Consumer',
        thematicVectors: [
          { theme: 'Jewellery', role: 'Brand / Maker', conviction: 'High', thesis: 'Tanishq jewellery retail' }
        ]
      },
      {
        symbol: 'POLYCAB',
        name: 'Polycab India Limited',
        sector: 'Electricals',
        thematicVectors: [
          { theme: 'Power & Grid', role: 'Parts Supplier', conviction: 'High', thesis: 'Power transmission cables' }
        ]
      }
    ];

    renderWithContext(<AnalyticsDashboard {...props} stocks={testStocks} />);

    // Expand Macro Theme Distribution
    const macroThemeHeader = screen.getByText('Macro Theme Distribution');
    const chartCard = macroThemeHeader.closest('.chart-card');
    const expandBtn = chartCard.querySelector('.expand-btn');
    fireEvent.click(expandBtn);

    // Verify search input placeholder includes stock name
    const searchInput = screen.getByPlaceholderText(/Search category, ticker, stock name.../i);
    expect(searchInput).toBeDefined();

    // Verify company name is displayed in card
    expect(screen.getByText('Titan Company Limited')).toBeDefined();
    expect(screen.getByText('Polycab India Limited')).toBeDefined();

    // Test Search by company name "Titan Company"
    fireEvent.change(searchInput, { target: { value: 'Titan Company' } });
    const explorer = document.querySelector('.ai-scope-exp-body');
    expect(explorer.textContent).toContain('TITAN');
    expect(explorer.textContent).not.toContain('POLYCAB');

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(explorer.textContent).toContain('POLYCAB');

    // Test Role Filter dropdown
    const roleSelect = screen.getByLabelText('Filter by Value Chain Role');
    expect(roleSelect).toBeDefined();
    expect(screen.getByText('All Roles')).toBeDefined();

    // Filter to "Parts Supplier"
    fireEvent.change(roleSelect, { target: { value: 'Parts Supplier' } });
    expect(explorer.textContent).toContain('POLYCAB');
    expect(explorer.textContent).not.toContain('TITAN');
  });

  it('highlights search query matches across all theme card surfaces (category, ticker, name, role, thesis, sector)', () => {
    const testStocks = [
      {
        symbol: 'CRWD',
        name: 'CrowdStrike Holdings',
        sector: 'Cybersecurity',
        thematicVectors: [
          {
            theme: 'Cloud Resiliency & Cybersecurity',
            role: 'Pick-and-Shovel Enabler',
            conviction: 'High',
            thesis: 'AI security for cloud workloads',
            subFocus: 'Workload Protection'
          }
        ]
      }
    ];

    renderWithContext(<AnalyticsDashboard {...props} stocks={testStocks} />);

    // Expand Macro Theme Distribution
    const macroThemeHeader = screen.getByText('Macro Theme Distribution');
    const chartCard = macroThemeHeader.closest('.chart-card');
    const expandBtn = chartCard.querySelector('.expand-btn');
    fireEvent.click(expandBtn);

    const searchInput = screen.getByPlaceholderText(/Search category, ticker, stock name.../i);

    // 1. Search category name: "Cloud"
    fireEvent.change(searchInput, { target: { value: 'Cloud' } });
    const categoryMark = document.querySelector('.ai-scope-tag-pill mark.ai-search-highlight');
    expect(categoryMark).not.toBeNull();
    expect(categoryMark.textContent).toBe('Cloud');

    // 2. Search ticker: "CRWD"
    fireEvent.change(searchInput, { target: { value: 'CRWD' } });
    const tickerMark = document.querySelector('.ai-scope-exp-card mark.ai-search-highlight');
    expect(tickerMark).not.toBeNull();
    expect(tickerMark.textContent).toBe('CRWD');

    // 3. Search company name: "CrowdStrike"
    fireEvent.change(searchInput, { target: { value: 'CrowdStrike' } });
    const nameMark = document.querySelector('.ai-scope-exp-card mark.ai-search-highlight');
    expect(nameMark).not.toBeNull();
    expect(nameMark.textContent).toBe('CrowdStrike');

    // 4. Search role badge: "Enabler"
    fireEvent.change(searchInput, { target: { value: 'Enabler' } });
    const roleMark = document.querySelector('.ai-scope-exp-card mark.ai-search-highlight');
    expect(roleMark).not.toBeNull();
    expect(roleMark.textContent).toBe('Enabler');

    // 5. Search catalyst / subFocus: "Protection"
    fireEvent.change(searchInput, { target: { value: 'Protection' } });
    const catalystMark = document.querySelector('.ai-scope-exp-card mark.ai-search-highlight');
    expect(catalystMark).not.toBeNull();
    expect(catalystMark.textContent).toBe('Protection');

    // 6. Search thesis quote: "workloads"
    fireEvent.change(searchInput, { target: { value: 'workloads' } });
    const thesisMark = document.querySelector('.ai-scope-exp-card mark.ai-search-highlight');
    expect(thesisMark).not.toBeNull();
    expect(thesisMark.textContent).toBe('workloads');

    // 7. Search sector spread: "Cybersecurity"
    fireEvent.change(searchInput, { target: { value: 'Cybersecurity' } });
    const sectorMark = document.querySelector('.ai-scope-exp-card mark.ai-search-highlight');
    expect(sectorMark).not.toBeNull();
    expect(sectorMark.textContent).toBe('Cybersecurity');
  });

  it('automatically expands collapsed stocks and sorts matching stocks first when search is active', () => {
    const basketStocks = [
      { symbol: 'STK1', name: 'Alpha Corp', thematicVectors: [{ theme: 'DefenseIndigenization', thesis: 'Domestic logistics' }] },
      { symbol: 'STK2', name: 'Beta Corp', thematicVectors: [{ theme: 'DefenseIndigenization', thesis: 'Domestic logistics' }] },
      { symbol: 'STK3', name: 'Gamma Corp', thematicVectors: [{ theme: 'DefenseIndigenization', thesis: 'Domestic logistics' }] },
      { symbol: 'STK4', name: 'Delta Corp', thematicVectors: [{ theme: 'DefenseIndigenization', thesis: 'Domestic logistics' }] },
      { symbol: 'SECMATCH1', name: 'Security One', thematicVectors: [{ theme: 'DefenseIndigenization', thesis: 'Indigenization radar systems' }] },
      { symbol: 'SECMATCH2', name: 'Security Two', thematicVectors: [{ theme: 'DefenseIndigenization', thesis: 'Indigenization missiles' }] },
    ];

    renderWithContext(<AnalyticsDashboard {...props} stocks={basketStocks} />);

    // Expand Macro Theme Distribution
    const macroThemeHeader = screen.getByText('Macro Theme Distribution');
    const chartCard = macroThemeHeader.closest('.chart-card');
    const expandBtn = chartCard.querySelector('.expand-btn');
    fireEvent.click(expandBtn);

    // Initially without search, stocks 5 and 6 are collapsed beyond the first 4 stocks
    const cardBody = document.querySelector('.ai-scope-exp-card');
    expect(cardBody.textContent).toContain('+2 more stocks');

    // Type search query "Indigenization" (matches category name, so all 6 stocks are kept, and matches thesis of SECMATCH1 & 2)
    const searchInput = screen.getByPlaceholderText(/Search category, ticker, stock name.../i);
    fireEvent.change(searchInput, { target: { value: 'Indigenization' } });

    // With active search:
    // 1. The card automatically expands and shows all stocks
    expect(cardBody.textContent).toContain('SECMATCH1');
    expect(cardBody.textContent).toContain('SECMATCH2');

    // 2. Matching stocks appear before non-matching stocks in the DOM
    const symbols = Array.from(cardBody.querySelectorAll('.font-mono.font-bold.text-\\[11px\\]')).map(el => el.textContent);
    expect(symbols.indexOf('SECMATCH1')).toBeLessThan(symbols.indexOf('STK1'));
    expect(symbols.indexOf('SECMATCH2')).toBeLessThan(symbols.indexOf('STK1'));

    // 3. Highlighted marks exist on matching elements
    const marks = cardBody.querySelectorAll('mark.ai-search-highlight');
    expect(marks.length).toBeGreaterThanOrEqual(2);

    // 4. Clearing search restores collapsed state
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(cardBody.textContent).toContain('+2 more stocks');
  });
});

