import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConfirm } from './ConfirmContext';
import { useToast } from './ToastContext';
import Modal from './Modal';
import { fetchStockQuotes, fetchStockData } from '../utils/yahooFinanceMap';
import MovingAverageRibbon from './MovingAverageRibbon';
import BirdsEyeGrid from './BirdsEyeGrid';
import { getPortfolioAnalysis } from '../services/ai';
import BenchmarkComparisonChart from './BenchmarkComparisonChart';


// ---------------------------------------------------------------------
// Helper: Parse TradingView sharing URL to direct S3 Image Preview URL
// ---------------------------------------------------------------------
function getTradingViewImage(url) {
  if (!url) return null;
  const match = url.match(/tradingview\.com\/x\/([A-Za-z0-9]+)/);
  if (match && match[1]) {
    return `https://s3.tradingview.com/x/${match[1]}.png`;
  }
  return null;
}

// Helper: Get Sunday date string (YYYY-MM-DD) for a given date string
function getSunday(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = d.getDay();
  const diff = d.getDate() - day; // adjust to Sunday
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------
// JSX SVG Icon Components (Lucide-style vector graphics)
// ---------------------------------------------------------------------
const IconBookOpen = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </svg>
);

const IconTrendingUp = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 7.744-4.043m0 0H15.75m4.25 0v4.25" />
  </svg>
);

const IconTrophy = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3-3h.75a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3H19.5a3 3 0 0 1-3-3v.75m0 16.5v-16.5m0 16.5c0 1.035-.84 1.875-1.875 1.875H9.375A1.875 1.875 0 0 1 7.5 18.75m0 0V2.25m0 16.5c0-1.035.84-1.875 1.875-1.875h5.25c1.035 0 1.875.84 1.875 1.875m-9 0H5.25A2.25 2.25 0 0 1 3 16.5v-2.25a2.25 2.25 0 0 1 2.25-2.25h1.5m0-6.75H5.25A2.25 2.25 0 0 1 3 16.5v-2.25a2.25 2.25 0 0 1 2.25-2.25h1.5m0-6.75V2.25M7.5 2.25h9" />
  </svg>
);

const IconPercent = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6h.008v.008H6V6Zm12 12h.008v.008H18V18Z" />
  </svg>
);

const IconActivity = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const IconPlus = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const IconSearch = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const IconEdit = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

const IconTrash = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const IconExternalLink = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

const IconRefresh = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const IconChevron = ({ isOpen, className = "w-4 h-4 transition-all duration-200" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth="2.5" 
    stroke="currentColor" 
    className={`${className} ${isOpen ? 'rotate-180' : ''}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
);

const SlProximityBar = ({ pos }) => {
  const { avgEntryPrice, initialStopLoss, currentStopLoss, livePrice, isLong, isClosed } = pos;
  
  if (isClosed) {
    return <span className="text-slate-400 font-semibold text-xs">—</span>;
  }
  
  const E = Number(avgEntryPrice || 0);
  const activeSL = Number(currentStopLoss || initialStopLoss || 0);
  const P = Number(livePrice || 0);
  
  if (E <= 0 || activeSL <= 0 || P <= 0) {
    return <span className="text-slate-400 font-semibold text-xs">—</span>;
  }
  
  // Scale of risk is based on Initial Risk
  const initialRisk = isLong ? (E - Number(initialStopLoss || 0)) : (Number(initialStopLoss || 0) - E);
  if (initialRisk <= 0) {
    return <span className="text-slate-400 font-semibold text-xs">—</span>;
  }
  
  // Proximity distance is based on Active Stop Loss
  const currentDist = isLong ? (P - activeSL) : (activeSL - P);
  const ratio = currentDist / initialRisk;
  
  const isGreen = ratio >= 1.0;
  
  // Calculate percentage distance to SL relative to live price (capped at >= 0%)
  const pctFromSL = P > 0 ? (Math.max(0, currentDist) / P) * 100 : 0;
  
  // Bi-directional progress bar fill:
  // For drawdown (ratio < 1): red fill grows from 0% at Entry to 100% at/below SL
  // For profit (ratio >= 1): green fill grows from 0% at Entry to 100% at 2R (or capping at 100%)
  const fillPct = isGreen
    ? Math.max(0, Math.min(100, (ratio - 1.0) * 100))
    : Math.max(0, Math.min(100, (1.0 - ratio) * 100));
    
  return (
    <div className="flex flex-col gap-1 w-full max-w-[100px]" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center text-[11px] font-extrabold">
        <span className={isGreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-450'}>
          {isGreen ? 'Away' : 'Near SL'}
        </span>
        <span className="font-mono text-slate-600 dark:text-slate-350">
          {pctFromSL.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full bg-slate-200 dark:bg-slate-800/90 rounded-full overflow-hidden border border-slate-300/30 dark:border-slate-700/40">
        <div 
          className={`h-full ${isGreen ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-rose-450 to-rose-500'} transition-all duration-300 rounded-full`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
};

const SUGGESTED_SETUPS = [
  "VCP Breakout (Minervini SEPA)",
  "IPO Base Breakout (CANSLIM)",
  "Pullback to 21 EMA / 50 SMA",
  "Cheat / High Tight Flag",
  "Pocket Pivot / Volatility Contraction",
  "Gap Up / Earnings Breakout",
  "Double Bottom Shakeout"
];

const BENCHMARK_LABELS = {
  '^NSEI': 'Nifty 50 (^NSEI)',
  '^CNXSC': 'Nifty Smallcap 100 (^CNXSC)',
  '^CRSMID': 'Nifty Midcap 100 (^CRSMID)',
  'NIFTYMIDSML400.NS': 'Nifty MidSmallcap 400 (NIFTYMIDSML400.NS)',
  '^NDX': 'Nasdaq US Tech 100 (^NDX)',
  '^GSPC': 'S&P 500 (^GSPC)',
  '^RUT': 'Russell 2000 (^RUT)',
  '^DJI': 'Dow Jones (^DJI)'
};

const INDIA_BENCHMARKS = [
  { symbol: '^NSEI', label: 'Nifty 50' },
  { symbol: '^CNXSC', label: 'Nifty Smallcap 100' },
  { symbol: '^CRSMID', label: 'Nifty Midcap 100' },
  { symbol: 'NIFTYMIDSML400.NS', label: 'Nifty MidSmallcap 400' }
];

const US_BENCHMARKS = [
  { symbol: '^NDX', label: 'Nasdaq US Tech 100' },
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^RUT', label: 'Russell 2000' },
  { symbol: '^DJI', label: 'Dow Jones' }
];

const TICKER_COLORS = {
  '^NSEI': '#a855f7', // Purple
  '^CNXSC': '#f97316', // Orange
  '^CRSMID': '#ec4899', // Pink
  'NIFTYMIDSML400.NS': '#14b8a6', // Teal
  '^NDX': '#10b981', // Emerald
  '^GSPC': '#64748b', // Slate
  '^RUT': '#f59e0b', // Amber
  '^DJI': '#ef4444'  // Crimson/Red
};

export default function JournalView({ country, data, setData }) {
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  // Overlay state
  const [showModal, setShowModal] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [expandedTradeId, setExpandedTradeId] = useState(null);

  // Progressive Disclosure Toggles inside Modal
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [showScalingForm, setShowScalingForm] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [strategyFilter, setStrategyFilter] = useState('All');
  const [dateRangeFilter, setDateRangeFilter] = useState('All Time');
  const [dateFilterType, setDateFilterType] = useState('quick'); // 'quick' | 'custom' | 'week'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');

  // Refs for shortcuts
  const searchInputRef = useRef(null);

  // Live Price State
  const [livePrices, setLivePrices] = useState({});
  const [liveMAs, setLiveMAs] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);

  // Sorting states
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState(null);

  // Column config modal visibility state
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Tab state (persisted in localStorage scoped by country)
  const [activeJournalTab, setActiveJournalTab] = useState(() => {
    try {
      const saved = localStorage.getItem(`trade_clarity_journal_tab_${country}`);
      return saved || 'standard';
    } catch {
      return 'standard';
    }
  });

  useEffect(() => {
    localStorage.setItem(`trade_clarity_journal_tab_${country}`, activeJournalTab);
  }, [activeJournalTab, country]);

  // Default statusFilter to 'Open' when switching to Snapshot tab
  useEffect(() => {
    if (activeJournalTab === 'snapshot') {
      setStatusFilter('Open');
    }
  }, [activeJournalTab]);

  // Snapshot State
  const [snapshotTimeframe, setSnapshotTimeframe] = useState('3mo');
  const [snapshotStockData, setSnapshotStockData] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Benchmark comparison index states
  const [benchmarkPriceDataMap, setBenchmarkPriceDataMap] = useState({});
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState(() => [country === 'IN' ? '^NSEI' : '^GSPC']);
  const [showCompareDropdown, setShowCompareDropdown] = useState(false);
  const compareDropdownRef = useRef(null);

  // Sync index ticker when country changes
  useEffect(() => {
    setSelectedTickers([country === 'IN' ? '^NSEI' : '^GSPC']);
    setBenchmarkPriceDataMap({});
  }, [country]);

  // Click outside compare dropdown logic
  useEffect(() => {
    function handleClickOutside(event) {
      if (compareDropdownRef.current && !compareDropdownRef.current.contains(event.target)) {
        setShowCompareDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // AI portfolio analysis insights states
  const [aiInsights, setAiInsights] = useState('');
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);

  // Column definitions
  const ALL_COLUMNS = {
    symbol: { label: 'Symbol', locked: true },
    mas: { label: 'MAs', locked: false },
    action: { label: 'Action', locked: false },
    qty: { label: 'Qty', locked: false },
    positionSize: { label: 'Position Size', locked: false },
    avgEntry: { label: 'Avg Entry', locked: false },
    stopLoss: { label: 'Stop Loss', locked: false },
    liveExit: { label: 'Live / Exit', locked: false },
    slProximity: { label: 'SL Proximity', locked: false },
    rMultiple: { label: 'R-Multiple', locked: false },
    netPnL: { label: 'Net P&L', locked: false },
    status: { label: 'Status', locked: false },
    actions: { label: 'Actions', locked: true }
  };

  const DEFAULT_COLUMN_ORDER = [
    'symbol', 'mas', 'action', 'qty', 'positionSize', 'avgEntry', 'stopLoss', 'liveExit', 'slProximity', 'rMultiple', 'netPnL', 'status', 'actions'
  ];

  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(`trade_clarity_journal_col_order_${country}`);
      return saved ? JSON.parse(saved) : DEFAULT_COLUMN_ORDER;
    } catch {
      return DEFAULT_COLUMN_ORDER;
    }
  });

  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem(`trade_clarity_journal_col_visibility_${country}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    const initial = {};
    DEFAULT_COLUMN_ORDER.forEach(col => {
      initial[col] = true;
    });
    return initial;
  });

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(`trade_clarity_journal_col_widths_${country}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sync state to localStorage on updates
  useEffect(() => {
    localStorage.setItem(`trade_clarity_journal_col_order_${country}`, JSON.stringify(columnOrder));
  }, [columnOrder, country]);

  useEffect(() => {
    localStorage.setItem(`trade_clarity_journal_col_visibility_${country}`, JSON.stringify(columnVisibility));
  }, [columnVisibility, country]);

  useEffect(() => {
    localStorage.setItem(`trade_clarity_journal_col_widths_${country}`, JSON.stringify(columnWidths));
  }, [columnWidths, country]);

  // Resizing mouse drag handlers
  const handleResizeStart = (colKey, mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    mouseDownEvent.stopPropagation();

    const startX = mouseDownEvent.pageX;
    const headerCell = mouseDownEvent.target.parentElement;
    const startWidth = headerCell.getBoundingClientRect().width;

    const handleMouseMove = (moveEvent) => {
      const currentX = moveEvent.pageX;
      const newWidth = Math.max(60, startWidth + (currentX - startX));
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Sorting toggler handler
  const handleSort = (colKey) => {
    if (colKey === 'actions') return;
    if (sortColumn === colKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (colKey) => {
    if (colKey === 'actions') return null;
    if (sortColumn !== colKey) {
      return <span className="ml-1 opacity-20 group-hover:opacity-60 transition-opacity">↕</span>;
    }
    return (
      <span className="ml-1 text-sky-500 font-bold">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Move columns in modal
  const moveColumn = (index, direction) => {
    const newOrder = [...columnOrder];
    const targetIdx = index;
    const swapIdx = direction === 'up' ? index - 1 : index + 1;

    if (swapIdx < 1 || swapIdx > newOrder.length - 2) return;

    const temp = newOrder[targetIdx];
    newOrder[targetIdx] = newOrder[swapIdx];
    newOrder[swapIdx] = temp;

    setColumnOrder(newOrder);
  };

  const handleFetchAiInsights = async () => {
    const apiKey = data?.aiSettings?.apiKey;
    if (!apiKey) {
      showToast("Google Gemini API Key is missing. Please add it in Settings.", "error");
      return;
    }
    const model = data?.aiSettings?.model;

    setAiInsightsLoading(true);
    try {
      const capitalInfo = {
        capital: accountCapital,
        totalPnL: analyticsDashboardMetrics.totalPnL,
        returnPct: analyticsDashboardMetrics.returnPct,
        winRate: analyticsMetrics.winRate,
        profitFactor: analyticsMetrics.profitFactor,
        avgWin: analyticsMetrics.avgWin,
        avgLoss: analyticsMetrics.avgLoss
      };
      const report = await getPortfolioAnalysis(apiKey, model, analyticsPositions, capitalInfo, country);
      setAiInsights(report);
      showToast("Successfully generated AI Portfolio Insights!", "success");
    } catch (e) {
      showToast(e.message || "Failed to generate AI insights", "error");
    } finally {
      setAiInsightsLoading(false);
    }
  };

  const visibleColsCount = useMemo(() => {
    return columnOrder.filter(c => columnVisibility[c]).length;
  }, [columnOrder, columnVisibility]);

  // Autocomplete watchlist lookup
  const [autocompleteSuggestion, setAutocompleteSuggestion] = useState(null);

  // Global Account Capital & Default Risk Configurations
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const accountCapital = typeof data?.journalCapital === 'object' && data.journalCapital !== null
    ? (data.journalCapital[country] || (country === 'IN' ? 1000000 : 50000))
    : (data?.journalCapital || (country === 'IN' ? 1000000 : 50000));

  // Tabs for the Modal
  const [activeModalTab, setActiveModalTab] = useState('entry');

  // Base Form State (No tags or sector system)
  const initialFormState = {
    symbol: '',
    setup: '',
    initialStopLoss: '',
    currentStopLoss: '',
    notes: '',
    chartUrl: '',
    // Simple Mode entries
    entryPrice: '',
    qty: '',
    entryDate: new Date().toISOString().split('T')[0],
    // Position closure parameters
    isClosed: false,
    exitPrice: '',
    exitDate: new Date().toISOString().split('T')[0],
    postMortem: '',
    transactions: [],
    isScaling: false
  };

  const [formData, setFormData] = useState(initialFormState);

  // Live Price States for Modal symbol input
  const [modalLivePrice, setModalLivePrice] = useState(null);
  const [isFetchingModalPrice, setIsFetchingModalPrice] = useState(false);

  // Stop Loss Matrix dynamic input local states
  const [slPriceInput, setSlPriceInput] = useState('');
  const [slPctInput, setSlPctInput] = useState('');
  const [slCashInput, setSlCashInput] = useState('');

  // Position Sizing Calculator local states
  const [showSizer, setShowSizer] = useState(false);
  const [sizerInvestPct, setSizerInvestPct] = useState(''); // % of capital to invest
  const [sizerInvestCash, setSizerInvestCash] = useState(''); // fixed cash investment
  const [sizerUseCash, setSizerUseCash] = useState(false); // true = fixed cash, false = % of capital

  // Execution Adder State
  const [newExecution, setNewExecution] = useState({
    type: 'Buy',
    price: '',
    qty: '',
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  // Normalize legacy flat entries on render (Scrub tags safely)
  const journalEntries = useMemo(() => {
    const raw = data?.journals?.[country] || [];
    return raw.map(trade => {
      if (trade.transactions && trade.transactions.length > 0) return trade;

      // Migrate legacy parameters
      const initialBuy = {
        id: `tx-init-${trade.id}`,
        type: 'Buy',
        price: Number(trade.entryPrice || 0),
        qty: Number(trade.qty || 0),
        date: trade.entryDate || new Date().toISOString().split('T')[0],
        reason: 'Initial Entry (Migrated)'
      };

      const transactions = [initialBuy];

      if (trade.exitPrice && Number(trade.exitPrice) > 0) {
        transactions.push({
          id: `tx-exit-${trade.id}`,
          type: 'Sell',
          price: Number(trade.exitPrice),
          qty: Number(trade.qty || 0),
          date: trade.exitDate || trade.entryDate || new Date().toISOString().split('T')[0],
          reason: 'Initial Target (Migrated)'
        });
      }

      return {
        ...trade,
        initialStopLoss: Number(trade.stopLoss || 0),
        transactions
      };
    });
  }, [data?.journals, country]);

  // Live Price Fetcher
  const loadLivePrices = useCallback(async () => {
    if (journalEntries.length === 0) return;
    setPricesLoading(true);
    try {
      const symbols = [...new Set(journalEntries.map(e => e.symbol))];
      const results = await fetchStockQuotes(symbols, country);
      const priceMap = {};
      const maMap = {};
      results.forEach(res => {
        if (res && res.currentPrice) {
          priceMap[res.symbol] = res.currentPrice;
          maMap[res.symbol] = res.movingAverages || "";
        }
      });
      setLivePrices(prev => ({ ...prev, ...priceMap }));
      setLiveMAs(prev => ({ ...prev, ...maMap }));
    } catch (e) {
      console.warn("Failed to fetch live prices:", e);
    } finally {
      setPricesLoading(false);
    }
  }, [journalEntries, country]);

  // 2-minute polling sync
  useEffect(() => {
    loadLivePrices();
    const interval = setInterval(loadLivePrices, 120 * 1000);
    return () => clearInterval(interval);
  }, [loadLivePrices]);

  // Comprehensive math calculators based on transaction arrays
  const calculatedPositions = useMemo(() => {
    return journalEntries.map(trade => {
      const buys = trade.transactions.filter(t => t.type === 'Buy');
      const sells = trade.transactions.filter(t => t.type === 'Sell');

      const totalBought = buys.reduce((acc, t) => acc + Number(t.qty || 0), 0);
      const totalSold = sells.reduce((acc, t) => acc + Number(t.qty || 0), 0);
      const openQty = totalBought - totalSold;

      // Weighted average entry price (across ALL buys)
      const totalBuyCost = buys.reduce((acc, t) => acc + (Number(t.price) * Number(t.qty)), 0);
      const avgEntryPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

      // Active cost basis = cost of the currently held shares (FIFO: remaining qty × avg entry)
      const activeCostBasis = openQty > 0 ? openQty * avgEntryPrice : 0;

      const avgExitPrice = totalSold > 0
        ? sells.reduce((acc, t) => acc + (Number(t.price) * Number(t.qty)), 0) / totalSold
        : 0;

      const livePrice = livePrices[trade.symbol] || avgEntryPrice;

      // Realized P&L: exit proceeds - cost basis of sold shares (sold qty × avg entry price)
      const realizedPnL = totalSold > 0
        ? (avgExitPrice * totalSold) - (avgEntryPrice * totalSold)
        : 0;

      // isClosed: true if all shares sold OR if user explicitly marked it closed in the form
      const isClosed = openQty <= 0 || trade.isClosed === true;

      // Floating P&L: only meaningful when trade is still open
      const floatingPnL = !isClosed && openQty > 0 ? (livePrice - avgEntryPrice) * openQty : 0;
      const totalPnL = realizedPnL + floatingPnL;

      const initialStopLoss = Number(trade.initialStopLoss || 0);
      const activeStopLoss = Number(trade.currentStopLoss || trade.initialStopLoss || 0);
      const isLong = buys[0]?.type !== 'Sell';

      // Risk per share based on avg entry vs initial stop
      const initialRiskPerShare = isLong
        ? Math.max(0, avgEntryPrice - initialStopLoss)
        : Math.max(0, initialStopLoss - avgEntryPrice);

      // R-Multiple: total P&L vs initial risk on the total position bought
      const totalInitialRisk = totalBought * initialRiskPerShare;
      let rMultiple = 0;
      if (totalInitialRisk > 0) {
        rMultiple = totalPnL / totalInitialRisk;
      }

      // Locked profit / open risk — based on active (open) qty
      const lockedProfit = openQty > 0
        ? (isLong ? Math.max(0, activeStopLoss - avgEntryPrice) * openQty : Math.max(0, avgEntryPrice - activeStopLoss) * openQty)
        : 0;

      const openRisk = openQty > 0
        ? (isLong ? Math.max(0, avgEntryPrice - activeStopLoss) * openQty : Math.max(0, activeStopLoss - avgEntryPrice) * openQty)
        : 0;

      const activeStopLossPct = avgEntryPrice > 0
        ? (isLong
            ? ((avgEntryPrice - activeStopLoss) / avgEntryPrice) * 100
            : ((activeStopLoss - avgEntryPrice) / avgEntryPrice) * 100)
        : 0;

      return {
        ...trade,
        openQty,
        totalBought,
        totalSold,
        avgEntryPrice,
        avgExitPrice,
        activeCostBasis,   // active investment = openQty × avgEntryPrice
        livePrice,
        realizedPnL,
        floatingPnL,
        totalPnL,
        rMultiple,
        lockedProfit,
        openRisk,
        isClosed,
        isLong,
        activeStopLossPct,
        activeStopLoss
      };
    });
  }, [journalEntries, livePrices]);


  const uniqueStrategies = useMemo(() => {
    const strategies = new Set(SUGGESTED_SETUPS);
    calculatedPositions.forEach(p => {
      if (p.setup && p.setup.trim() !== '' && p.setup !== 'Custom Setup') {
        strategies.add(p.setup);
      }
    });
    return Array.from(strategies);
  }, [calculatedPositions]);

  // Filter positions
  const filteredPositions = useMemo(() => {
    const now = new Date();

    const filtered = calculatedPositions.filter(p => {
      // Strategy Filter logic
      if (strategyFilter !== 'All' && p.setup !== strategyFilter) {
        return false;
      }

      // Date Range logic
      let inDateRange = true;
      
      if (p.transactions.length > 0 && p.transactions[0].date) {
        const tradeDateStr = p.transactions[0].date;
        
        if (dateFilterType === 'quick') {
          if (dateRangeFilter !== 'All Time') {
            const entryDate = new Date(tradeDateStr);
            if (dateRangeFilter === 'This Month') {
              inDateRange = entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
            } else if (dateRangeFilter === 'Last 3 Months') {
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(now.getMonth() - 3);
              inDateRange = entryDate >= threeMonthsAgo;
            } else if (dateRangeFilter === 'This Year') {
              inDateRange = entryDate.getFullYear() === now.getFullYear();
            }
          }
        } else if (dateFilterType === 'custom') {
          if (customStartDate) {
            inDateRange = inDateRange && (tradeDateStr >= customStartDate);
          }
          if (customEndDate) {
            inDateRange = inDateRange && (tradeDateStr <= customEndDate);
          }
        } else if (dateFilterType === 'week') {
          if (selectedWeek) {
            inDateRange = inDateRange && (getSunday(tradeDateStr) === selectedWeek);
          }
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const symbolMatch = p.symbol.toLowerCase().includes(q);
      const setupMatch = p.setup ? p.setup.toLowerCase().includes(q) : false;
      const notesMatch = p.notes ? p.notes.toLowerCase().includes(q) : false;
      const matchSearch = symbolMatch || setupMatch || notesMatch;

      if (!inDateRange) return false;

      if (statusFilter === 'All') return matchSearch;
      if (statusFilter === 'Open') return !p.isClosed && matchSearch;
      if (statusFilter === 'Closed') return p.isClosed && matchSearch;
      if (statusFilter === 'Win') return p.isClosed && p.totalPnL > 0.01 && matchSearch;
      if (statusFilter === 'Loss') return p.isClosed && p.totalPnL < -0.01 && matchSearch;

      return false;
    });

    if (!sortColumn || !sortDirection) return filtered;

    return [...filtered].sort((a, b) => {
      let valA, valB;

      if (sortColumn === 'symbol') {
        valA = a.symbol.toLowerCase();
        valB = b.symbol.toLowerCase();
      } else if (sortColumn === 'mas') {
        valA = liveMAs[a.symbol] || '';
        valB = liveMAs[b.symbol] || '';
      } else if (sortColumn === 'action') {
        valA = a.isLong ? 1 : 0;
        valB = b.isLong ? 1 : 0;
      } else if (sortColumn === 'qty') {
        valA = a.isClosed ? 0 : a.openQty;
        valB = b.isClosed ? 0 : b.openQty;
      } else if (sortColumn === 'positionSize') {
        valA = a.avgEntryPrice * a.totalBought;
        valB = b.avgEntryPrice * b.totalBought;
      } else if (sortColumn === 'avgEntry') {
        valA = a.avgEntryPrice;
        valB = b.avgEntryPrice;
      } else if (sortColumn === 'stopLoss') {
        valA = a.activeStopLoss;
        valB = b.activeStopLoss;
      } else if (sortColumn === 'liveExit') {
        const changePctA = a.avgEntryPrice > 0 
          ? (a.isLong ? (((a.isClosed ? a.avgExitPrice : a.livePrice) - a.avgEntryPrice) / a.avgEntryPrice) * 100 : ((a.avgEntryPrice - (a.isClosed ? a.avgExitPrice : a.livePrice)) / a.avgEntryPrice) * 100)
          : 0;
        const changePctB = b.avgEntryPrice > 0 
          ? (b.isLong ? (((b.isClosed ? b.avgExitPrice : b.livePrice) - b.avgEntryPrice) / b.avgEntryPrice) * 100 : ((b.avgEntryPrice - (b.isClosed ? b.avgExitPrice : b.livePrice)) / b.avgEntryPrice) * 100)
          : 0;
        valA = changePctA;
        valB = changePctB;
      } else if (sortColumn === 'slProximity') {
        const getPctFromSL = (pos) => {
          const E = Number(pos.avgEntryPrice || 0);
          const SL = Number(pos.initialStopLoss || 0);
          const P = Number(pos.livePrice || 0);
          if (E <= 0 || SL <= 0 || P <= 0 || pos.isClosed) return 0;
          const initialRisk = pos.isLong ? (E - SL) : (SL - E);
          if (initialRisk <= 0) return 0;
          const currentDist = pos.isLong ? (P - SL) : (SL - P);
          return P > 0 ? (Math.max(0, currentDist) / P) * 100 : 0;
        };
        valA = getPctFromSL(a);
        valB = getPctFromSL(b);
      } else if (sortColumn === 'rMultiple') {
        valA = a.rMultiple;
        valB = b.rMultiple;
      } else if (sortColumn === 'netPnL') {
        valA = a.totalPnL;
        valB = b.totalPnL;
      } else if (sortColumn === 'status') {
        valA = a.isClosed ? 1 : 0;
        valB = b.isClosed ? 1 : 0;
      }

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [calculatedPositions, searchQuery, statusFilter, strategyFilter, dateFilterType, dateRangeFilter, customStartDate, customEndDate, selectedWeek, sortColumn, sortDirection, liveMAs]);

  // Populate unique weeks from the journal's transactions
  const uniqueJournalWeeks = useMemo(() => {
    const weeks = new Set();
    calculatedPositions.forEach(p => {
      const firstTx = p.transactions[0];
      if (firstTx && firstTx.date) {
        const sun = getSunday(firstTx.date);
        if (sun) weeks.add(sun);
      }
    });
    return [...weeks].sort().reverse();
  }, [calculatedPositions]);

  // Calculate earliest trade date for dynamic index benchmark comparison
  const earliestTradeDate = useMemo(() => {
    if (calculatedPositions.length === 0) return null;
    let earliest = null;
    calculatedPositions.forEach(p => {
      if (p.transactions && p.transactions.length > 0) {
        const d = p.transactions[0].date;
        if (d) {
          if (!earliest || d < earliest) earliest = d;
        }
      }
    });
    return earliest;
  }, [calculatedPositions]);

  const activeAnalyticsStartDate = useMemo(() => {
    return analyticsStartDate || earliestTradeDate;
  }, [analyticsStartDate, earliestTradeDate]);

  const analyticsPositions = useMemo(() => {
    if (!activeAnalyticsStartDate) return calculatedPositions;
    return calculatedPositions.filter(p => {
      const firstTx = p.transactions && p.transactions[0];
      const tradeDate = firstTx?.date || p.entryDate;
      return tradeDate && tradeDate >= activeAnalyticsStartDate;
    });
  }, [calculatedPositions, activeAnalyticsStartDate]);

  const benchmarkTimeframe = useMemo(() => {
    if (!activeAnalyticsStartDate) return '3mo';
    const start = new Date(activeAnalyticsStartDate);
    const now = new Date();
    const diffMs = now - start;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 25) return '1mo';
    if (diffDays <= 85) return '3mo';
    if (diffDays <= 175) return '6mo';
    if (diffDays <= 360) return '1y';
    if (diffDays <= 720) return '2y';
    return '5y';
  }, [activeAnalyticsStartDate]);

  // Dynamic Index Benchmark Return calculation
  const benchmarkIndexReturnMap = useMemo(() => {
    if (!activeAnalyticsStartDate || Object.keys(benchmarkPriceDataMap).length === 0) return {};
    
    const returns = {};
    const targetTime = new Date(activeAnalyticsStartDate).getTime();

    Object.entries(benchmarkPriceDataMap).forEach(([symbol, data]) => {
      const indexCloses = data?.candlesticks || [];
      if (indexCloses.length === 0) return;
      
      let closestCandle = indexCloses[0];
      let minDiff = Infinity;
      
      for (const candle of indexCloses) {
        const candleTime = candle.time * 1000;
        const diff = Math.abs(candleTime - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestCandle = candle;
        }
      }
      
      const startVal = closestCandle.close;
      const currVal = indexCloses[indexCloses.length - 1].close;
      returns[symbol] = startVal > 0 ? ((currVal - startVal) / startVal) * 100 : 0;
    });

    return returns;
  }, [benchmarkPriceDataMap, activeAnalyticsStartDate]);

  const loadBenchmarkData = useCallback(async () => {
    if (!activeAnalyticsStartDate || selectedTickers.length === 0) {
      setBenchmarkPriceDataMap({});
      return;
    }
    setBenchmarkLoading(true);
    try {
      const PROXY_MAP = {
        "^CNXSC": { symbol: "SMALLCAP.NS", ratio: 400 },
        "^CRSMID": { symbol: "MIDCAP.NS", ratio: 3425 },
        "NIFTYMIDSML400.NS": { symbol: "MIDSMALL.NS", ratio: 392 }
      };

      const symbolsToFetch = [...selectedTickers];
      selectedTickers.forEach(ticker => {
        if (PROXY_MAP[ticker]) {
          const proxySym = PROXY_MAP[ticker].symbol;
          if (!symbolsToFetch.includes(proxySym)) {
            symbolsToFetch.push(proxySym);
          }
        }
      });

      const results = await fetchStockData(symbolsToFetch, country, benchmarkTimeframe);
      const resultMap = {};
      results.forEach(res => {
        if (res && res.symbol) {
          resultMap[res.symbol] = res;
        }
      });

      const newMap = {};
      selectedTickers.forEach(ticker => {
        if (PROXY_MAP[ticker]) {
          const { symbol: proxySym, ratio } = PROXY_MAP[ticker];
          const proxyRes = resultMap[proxySym];
          if (proxyRes) {
            const scaledCandlesticks = (proxyRes.candlesticks || []).map(c => ({
              ...c,
              open: c.open * ratio,
              high: c.high * ratio,
              low: c.low * ratio,
              close: c.close * ratio
            }));
            newMap[ticker] = {
              ...proxyRes,
              symbol: ticker,
              longName: ticker === '^CNXSC' ? 'Nifty Smallcap 100' : 
                        ticker === '^CRSMID' ? 'Nifty Midcap 100' : 'Nifty MidSmallcap 400',
              currentPrice: proxyRes.currentPrice * ratio,
              prevClose: proxyRes.prevClose * ratio,
              dailyChange: (proxyRes.currentPrice - proxyRes.prevClose) * ratio,
              dailyChangePct: proxyRes.dailyChangePct,
              periodChangePct: proxyRes.periodChangePct,
              candlesticks: scaledCandlesticks
            };
          } else if (resultMap[ticker]) {
            newMap[ticker] = resultMap[ticker];
          }
        } else if (resultMap[ticker]) {
          newMap[ticker] = resultMap[ticker];
        }
      });

      setBenchmarkPriceDataMap(newMap);
    } catch (e) {
      console.warn("Failed to fetch benchmark data:", e);
      setBenchmarkPriceDataMap({});
    } finally {
      setBenchmarkLoading(false);
    }
  }, [activeAnalyticsStartDate, country, selectedTickers, benchmarkTimeframe]);

  useEffect(() => {
    if (activeJournalTab === 'analytics') {
      loadBenchmarkData();
    }
  }, [loadBenchmarkData, activeJournalTab, selectedTickers]);

  // Load Snapshot Candlestick Data for Snapshot tab
  const loadSnapshotData = useCallback(async () => {
    const symbols = [...new Set(filteredPositions.map(p => p.symbol))];
    if (symbols.length === 0) {
      setSnapshotStockData([]);
      return;
    }
    setSnapshotLoading(true);
    try {
      const results = await fetchStockData(symbols, country, snapshotTimeframe);
      setSnapshotStockData(results);
    } catch (e) {
      console.warn("Failed to fetch snapshot chart data:", e);
    } finally {
      setSnapshotLoading(false);
    }
  }, [filteredPositions, country, snapshotTimeframe]);

  useEffect(() => {
    if (activeJournalTab === 'snapshot') {
      loadSnapshotData();
    }
  }, [loadSnapshotData, activeJournalTab]);

  const mergedSnapshotStockData = useMemo(() => {
    return filteredPositions.map(localData => {
      const s = snapshotStockData.find(chart => chart.symbol === localData.symbol) || {};
      return { ...localData, ...s };
    });
  }, [snapshotStockData, filteredPositions]);

  // (Filtered positions moved above loadSnapshotData to resolve Temporal Dead Zone)

  // Global Portfolio Heat Calculation
  const portfolioHeat = useMemo(() => {
    let totalRisk = 0;
    calculatedPositions.forEach(p => {
      if (!p.isClosed) {
        const riskPerShare = p.isLong 
          ? Math.max(0, p.avgEntryPrice - p.initialStopLoss) 
          : Math.max(0, p.initialStopLoss - p.avgEntryPrice);
        totalRisk += p.openQty * riskPerShare;
      }
    });
    return totalRisk;
  }, [calculatedPositions]);

  // Overall Performance metrics
  const metrics = useMemo(() => {
    const closed = calculatedPositions.filter(p => p.isClosed);
    const total = calculatedPositions.length;

    let wins = 0;
    let losses = 0;
    let grossGains = 0;
    let grossLosses = 0;
    let netR = 0;

    closed.forEach(p => {
      netR += p.rMultiple;
      if (p.totalPnL > 0.01) {
        wins++;
        grossGains += p.totalPnL;
      } else if (p.totalPnL < -0.01) {
        losses++;
        grossLosses += Math.abs(p.totalPnL);
      }
    });

    calculatedPositions.filter(p => !p.isClosed).forEach(p => {
      netR += p.rMultiple;
    });

    const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
    const profitFactor = grossLosses > 0 ? (grossGains / grossLosses).toFixed(2) : grossGains > 0 ? "∞" : "0.00";
    const avgWin = wins > 0 ? (grossGains / wins).toFixed(2) : "0";
    const avgLoss = losses > 0 ? (grossLosses / losses).toFixed(2) : "0";

    return {
      total,
      closed: closed.length,
      wins,
      losses,
      winRate,
      profitFactor,
      netR: netR.toFixed(2),
      avgWin,
      avgLoss,
      grossGains,
      grossLosses
    };
  }, [calculatedPositions]);

  // Win/Loss Streak bullets (latest 8 closed trades)
  const streakSparks = useMemo(() => {
    return calculatedPositions
      .filter(p => p.isClosed)
      .slice(0, 8)
      .reverse();
  }, [calculatedPositions]);

  // Current Active Win/Loss Streak Count
  const currentStreak = useMemo(() => {
    const closed = calculatedPositions.filter(p => p.isClosed);
    if (closed.length === 0) return { type: 'neutral', count: 0 };
    
    let count = 0;
    let type = null;
    
    for (let i = 0; i < closed.length; i++) {
      const p = closed[i];
      const isWin = p.totalPnL > 0.01;
      const isLoss = p.totalPnL < -0.01;
      
      if (!isWin && !isLoss) continue;
      
      const currentType = isWin ? 'win' : 'loss';
      if (type === null) {
        type = currentType;
        count = 1;
      } else if (type === currentType) {
        count++;
      } else {
        break;
      }
    }
    return { type: type || 'neutral', count };
  }, [calculatedPositions]);

  // Profit Distribution percentage calculator
  const profitDistributionPct = useMemo(() => {
    const total = metrics.grossGains + metrics.grossLosses;
    if (total === 0) return 0;
    return (metrics.grossGains / total) * 100;
  }, [metrics.grossGains, metrics.grossLosses]);

  // Performance Rating Badge
  const edgeRating = useMemo(() => {
    const netR = Number(metrics.netR);
    if (netR >= 15) return { text: "INSTITUTIONAL EDGE", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/25" };
    if (netR >= 5) return { text: "CONSISTENT PROCESS", color: "text-teal-600 dark:text-teal-400 bg-teal-500/5 dark:bg-teal-400/10 border-teal-500/25" };
    if (netR > 0) return { text: "PROFITABLE RETURN", color: "text-sky-600 dark:text-sky-400 bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/25" };
    if (netR === 0) return { text: "NEUTRAL BASIS", color: "text-slate-600 dark:text-slate-400 bg-slate-500/5 dark:bg-slate-500/10 border-slate-500/25" };
    return { text: "TEMPERING PROCESS", color: "text-rose-600 dark:text-rose-400 bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/25" };
  }, [metrics.netR]);

  // Dashboard Metrics
  const dashboardMetrics = useMemo(() => {
    let investedCapital = 0;
    let totalPnL = 0;
    let floatingPnL = 0;
    let openRisk = 0;
    let lockedProfit = 0;

    calculatedPositions.forEach(p => {
      totalPnL += p.totalPnL;
      if (!p.isClosed) {
        investedCapital += (p.openQty * p.avgEntryPrice);
        floatingPnL += p.floatingPnL;
        openRisk += p.openRisk;
        lockedProfit += p.lockedProfit;
      }
    });

    const investedPct = accountCapital > 0 ? (investedCapital / accountCapital) * 100 : 0;
    const openRiskPct = accountCapital > 0 ? (openRisk / accountCapital) * 100 : 0;
    const returnPct = accountCapital > 0 ? (totalPnL / accountCapital) * 100 : 0;

    return {
      investedCapital,
      investedPct,
      floatingPnL,
      totalPnL,
      returnPct,
      openRisk,
      openRiskPct,
      lockedProfit
    };
  }, [calculatedPositions, accountCapital]);

  const insightsData = useMemo(() => {
    // 1. Symbol Aggregation (Leaderboards)
    const stockStatsMap = {};
    calculatedPositions.forEach(p => {
      if (!stockStatsMap[p.symbol]) {
        stockStatsMap[p.symbol] = {
          symbol: p.symbol,
          totalPnL: 0,
          investedAmount: 0,
          closedTrades: 0,
          wins: 0,
          costBasis: 0,
          totalTrades: 0,
        };
      }
      const stats = stockStatsMap[p.symbol];
      stats.totalPnL += p.totalPnL;
      stats.totalTrades += 1;
      if (!p.isClosed) {
        stats.investedAmount += (p.openQty * p.avgEntryPrice);
      }
      stats.costBasis += (p.totalBought * p.avgEntryPrice);
      if (p.isClosed) {
        stats.closedTrades += 1;
        if (p.totalPnL > 0.01) stats.wins += 1;
      }
    });

    const stockStats = Object.values(stockStatsMap).map(s => {
      const returnPct = s.costBasis > 0 ? (s.totalPnL / s.costBasis) * 100 : 0;
      return {
        ...s,
        returnPct
      };
    });

    const bestByCash = [...stockStats]
      .filter(s => s.totalPnL > 0)
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, 5);

    const worstByCash = [...stockStats]
      .filter(s => s.totalPnL < 0)
      .sort((a, b) => a.totalPnL - b.totalPnL)
      .slice(0, 5);

    const bestByPct = [...stockStats]
      .filter(s => s.returnPct > 0)
      .sort((a, b) => b.returnPct - a.returnPct)
      .slice(0, 5);

    const worstByPct = [...stockStats]
      .filter(s => s.returnPct < 0)
      .sort((a, b) => a.returnPct - b.returnPct)
      .slice(0, 5);

    const mostInvested = [...stockStats]
      .filter(s => s.investedAmount > 0)
      .sort((a, b) => b.investedAmount - a.investedAmount)
      .slice(0, 5);

    // 2. Setup/Strategy performance ranking
    const strategyStatsMap = {};
    calculatedPositions.forEach(p => {
      const name = p.setup || 'No Setup';
      if (!strategyStatsMap[name]) {
        strategyStatsMap[name] = {
          name,
          totalTrades: 0,
          closedTrades: 0,
          wins: 0,
          losses: 0,
          totalPnL: 0,
          winRate: 0,
        };
      }
      const stats = strategyStatsMap[name];
      stats.totalTrades += 1;
      stats.totalPnL += p.totalPnL;
      if (p.isClosed) {
        stats.closedTrades += 1;
        if (p.totalPnL > 0.01) {
          stats.wins += 1;
        } else if (p.totalPnL < -0.01) {
          stats.losses += 1;
        }
      }
    });

    const strategyStats = Object.values(strategyStatsMap).map(s => {
      s.winRate = s.closedTrades > 0 ? Math.round((s.wins / s.closedTrades) * 100) : 0;
      return s;
    }).sort((a, b) => b.winRate - a.winRate || b.totalPnL - a.totalPnL);

    // 3. Notable Milestone Badges
    const badges = [];
    if (dashboardMetrics.returnPct >= 5) {
      badges.push({
        id: 'green-horizon',
        title: 'Green Horizon',
        description: `Overall portfolio return is +${dashboardMetrics.returnPct.toFixed(1)}%. Great job!`,
        icon: '🟢',
        color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
      });
    }
    const pf = metrics.profitFactor;
    const pfNum = Number(pf);
    if (((!isNaN(pfNum) && pfNum >= 2.0) || (pf === "∞" && metrics.losses === 0 && metrics.wins > 0)) && metrics.closed >= 3) {
      badges.push({
        id: 'profit-factor-master',
        title: 'Process Master',
        description: `Profit Factor is a pristine ${pf}. Outstanding execution consistency.`,
        icon: '🏆',
        color: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400'
      });
    }
    const avgW = Number(metrics.avgWin);
    const avgL = Number(metrics.avgLoss);
    if (avgL > 0 && (avgW / avgL) >= 2.0 && metrics.wins >= 2) {
      badges.push({
        id: 'risk-manager',
        title: 'Risk Sentinel',
        description: `Average win is ${(avgW / avgL).toFixed(1)}x larger than average loss. Excellent risk-reward logic!`,
        icon: '🛡️',
        color: 'border-sky-500/30 bg-sky-500/5 text-sky-400'
      });
    }
    if (currentStreak.type === 'win' && currentStreak.count >= 3) {
      badges.push({
        id: 'streak-master',
        title: 'Streak Titan',
        description: `Active win streak of ${currentStreak.count} trades closed in profit!`,
        icon: '🔥',
        color: 'border-amber-500/30 bg-amber-500/5 text-amber-400'
      });
    }
    if (dashboardMetrics.investedPct >= 50) {
      badges.push({
        id: 'heavy-weight',
        title: 'High Allocator',
        description: `Over 50% of account capital is actively deployed in position layouts.`,
        icon: '⚡',
        color: 'border-purple-500/30 bg-purple-500/5 text-purple-400'
      });
    }
    if (metrics.closed >= 1) {
      badges.push({
        id: 'first-flight',
        title: 'First Flight',
        description: 'Successfully logged and closed your first trading setup.',
        icon: '✈️',
        color: 'border-teal-500/30 bg-teal-500/5 text-teal-400'
      });
    }

    return {
      bestByCash,
      worstByCash,
      bestByPct,
      worstByPct,
      mostInvested,
      strategyStats,
      badges
    };
  }, [calculatedPositions, metrics, currentStreak, dashboardMetrics, country]);

  // Analytics specific Performance metrics
  const analyticsMetrics = useMemo(() => {
    const closed = analyticsPositions.filter(p => p.isClosed);
    const total = analyticsPositions.length;

    let wins = 0;
    let losses = 0;
    let grossGains = 0;
    let grossLosses = 0;
    let netR = 0;

    closed.forEach(p => {
      netR += p.rMultiple;
      if (p.totalPnL > 0.01) {
        wins++;
        grossGains += p.totalPnL;
      } else if (p.totalPnL < -0.01) {
        losses++;
        grossLosses += Math.abs(p.totalPnL);
      }
    });

    analyticsPositions.filter(p => !p.isClosed).forEach(p => {
      netR += p.rMultiple;
    });

    const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
    const profitFactor = grossLosses > 0 ? (grossGains / grossLosses).toFixed(2) : grossGains > 0 ? "∞" : "0.00";
    const avgWin = wins > 0 ? (grossGains / wins).toFixed(2) : "0";
    const avgLoss = losses > 0 ? (grossLosses / losses).toFixed(2) : "0";

    return {
      total,
      closed: closed.length,
      wins,
      losses,
      winRate,
      profitFactor,
      netR: netR.toFixed(2),
      avgWin,
      avgLoss,
      grossGains,
      grossLosses
    };
  }, [analyticsPositions]);

  // Analytics specific win/loss streak bullets
  const analyticsStreakSparks = useMemo(() => {
    return analyticsPositions
      .filter(p => p.isClosed)
      .slice(0, 8)
      .reverse();
  }, [analyticsPositions]);

  // Analytics specific current streak
  const analyticsCurrentStreak = useMemo(() => {
    const closed = analyticsPositions.filter(p => p.isClosed);
    if (closed.length === 0) return { type: 'neutral', count: 0 };
    
    let count = 0;
    let type = null;
    
    for (let i = 0; i < closed.length; i++) {
      const p = closed[i];
      const isWin = p.totalPnL > 0.01;
      const isLoss = p.totalPnL < -0.01;
      
      if (!isWin && !isLoss) continue;
      
      const currentType = isWin ? 'win' : 'loss';
      if (type === null) {
        type = currentType;
        count = 1;
      } else if (type === currentType) {
        count++;
      } else {
        break;
      }
    }
    return { type: type || 'neutral', count };
  }, [analyticsPositions]);

  // Analytics specific dashboard metrics
  const analyticsDashboardMetrics = useMemo(() => {
    let investedCapital = 0;
    let totalPnL = 0;
    let floatingPnL = 0;
    let openRisk = 0;
    let lockedProfit = 0;

    analyticsPositions.forEach(p => {
      totalPnL += p.totalPnL;
      if (!p.isClosed) {
        investedCapital += (p.openQty * p.avgEntryPrice);
        floatingPnL += p.floatingPnL;
        openRisk += p.openRisk;
        lockedProfit += p.lockedProfit;
      }
    });

    const investedPct = accountCapital > 0 ? (investedCapital / accountCapital) * 100 : 0;
    const openRiskPct = accountCapital > 0 ? (openRisk / accountCapital) * 100 : 0;
    const returnPct = accountCapital > 0 ? (totalPnL / accountCapital) * 100 : 0;

    return {
      investedCapital,
      investedPct,
      floatingPnL,
      totalPnL,
      returnPct,
      openRisk,
      openRiskPct,
      lockedProfit
    };
  }, [analyticsPositions, accountCapital]);

  // Analytics specific insights data
  const analyticsInsightsData = useMemo(() => {
    // 1. Symbol Aggregation (Leaderboards)
    const stockStatsMap = {};
    analyticsPositions.forEach(p => {
      if (!stockStatsMap[p.symbol]) {
        stockStatsMap[p.symbol] = {
          symbol: p.symbol,
          totalPnL: 0,
          investedAmount: 0,
          closedTrades: 0,
          wins: 0,
          costBasis: 0,
          totalTrades: 0,
        };
      }
      const stats = stockStatsMap[p.symbol];
      stats.totalPnL += p.totalPnL;
      stats.totalTrades += 1;
      if (!p.isClosed) {
        stats.investedAmount += (p.openQty * p.avgEntryPrice);
      }
      stats.costBasis += (p.totalBought * p.avgEntryPrice);
      if (p.isClosed) {
        stats.closedTrades += 1;
        if (p.totalPnL > 0.01) stats.wins += 1;
      }
    });

    const stockStats = Object.values(stockStatsMap).map(s => {
      const returnPct = s.costBasis > 0 ? (s.totalPnL / s.costBasis) * 100 : 0;
      return {
        ...s,
        returnPct
      };
    });

    const bestByCash = [...stockStats]
      .filter(s => s.totalPnL > 0)
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, 5);

    const worstByCash = [...stockStats]
      .filter(s => s.totalPnL < 0)
      .sort((a, b) => a.totalPnL - b.totalPnL)
      .slice(0, 5);

    const bestByPct = [...stockStats]
      .filter(s => s.returnPct > 0)
      .sort((a, b) => b.returnPct - a.returnPct)
      .slice(0, 5);

    const worstByPct = [...stockStats]
      .filter(s => s.returnPct < 0)
      .sort((a, b) => a.returnPct - b.returnPct)
      .slice(0, 5);

    const mostInvested = [...stockStats]
      .filter(s => s.investedAmount > 0)
      .sort((a, b) => b.investedAmount - a.investedAmount)
      .slice(0, 5);

    // 2. Setup/Strategy performance ranking
    const strategyStatsMap = {};
    analyticsPositions.forEach(p => {
      const name = p.setup || 'No Setup';
      if (!strategyStatsMap[name]) {
        strategyStatsMap[name] = {
          name,
          totalTrades: 0,
          closedTrades: 0,
          wins: 0,
          losses: 0,
          totalPnL: 0,
          winRate: 0,
        };
      }
      const stats = strategyStatsMap[name];
      stats.totalTrades += 1;
      stats.totalPnL += p.totalPnL;
      if (p.isClosed) {
        stats.closedTrades += 1;
        if (p.totalPnL > 0.01) {
          stats.wins += 1;
        } else if (p.totalPnL < -0.01) {
          stats.losses += 1;
        }
      }
    });

    const strategyStats = Object.values(strategyStatsMap).map(s => {
      s.winRate = s.closedTrades > 0 ? Math.round((s.wins / s.closedTrades) * 100) : 0;
      return s;
    }).sort((a, b) => b.winRate - a.winRate || b.totalPnL - a.totalPnL);

    // 3. Notable Milestone Badges
    const badges = [];
    if (analyticsDashboardMetrics.returnPct >= 5) {
      badges.push({
        id: 'green-horizon',
        title: 'Green Horizon',
        description: `Overall portfolio return is +${analyticsDashboardMetrics.returnPct.toFixed(1)}%. Great job!`,
        icon: '🟢',
        color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
      });
    }
    const pf = analyticsMetrics.profitFactor;
    const pfNum = Number(pf);
    if (((!isNaN(pfNum) && pfNum >= 2.0) || (pf === "∞" && analyticsMetrics.losses === 0 && analyticsMetrics.wins > 0)) && analyticsMetrics.closed >= 3) {
      badges.push({
        id: 'profit-factor-master',
        title: 'Process Master',
        description: `Profit Factor is a pristine ${pf}. Outstanding execution consistency.`,
        icon: '🏆',
        color: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400'
      });
    }
    const avgW = Number(analyticsMetrics.avgWin);
    const avgL = Number(analyticsMetrics.avgLoss);
    if (avgL > 0 && (avgW / avgL) >= 2.0 && analyticsMetrics.wins >= 2) {
      badges.push({
        id: 'risk-manager',
        title: 'Risk Sentinel',
        description: `Average win is ${(avgW / avgL).toFixed(1)}x larger than average loss. Excellent risk-reward logic!`,
        icon: '🛡️',
        color: 'border-sky-500/30 bg-sky-500/5 text-sky-400'
      });
    }
    if (analyticsCurrentStreak.type === 'win' && analyticsCurrentStreak.count >= 3) {
      badges.push({
        id: 'streak-master',
        title: 'Streak Titan',
        description: `Active win streak of ${analyticsCurrentStreak.count} trades closed in profit!`,
        icon: '🔥',
        color: 'border-amber-500/30 bg-amber-500/5 text-amber-400'
      });
    }
    if (analyticsDashboardMetrics.investedPct >= 50) {
      badges.push({
        id: 'heavy-weight',
        title: 'High Allocator',
        description: `Over 50% of account capital is actively deployed in position layouts.`,
        icon: '⚡',
        color: 'border-purple-500/30 bg-purple-500/5 text-purple-400'
      });
    }
    if (analyticsMetrics.closed >= 1) {
      badges.push({
        id: 'first-flight',
        title: 'First Flight',
        description: 'Successfully logged and closed your first trading setup.',
        icon: '✈️',
        color: 'border-teal-500/30 bg-teal-500/5 text-teal-400'
      });
    }

    return {
      bestByCash,
      worstByCash,
      bestByPct,
      worstByPct,
      mostInvested,
      strategyStats,
      badges
    };
  }, [analyticsPositions, analyticsMetrics, analyticsCurrentStreak, analyticsDashboardMetrics, country]);



  // Global Account Capital Modifier
  const handleSaveCapital = (newVal) => {
    const cap = Number(newVal);
    if (isNaN(cap) || cap <= 0) {
      showToast("Please enter a valid investment capital amount", "error");
      return;
    }
    setData(prev => {
      const newData = structuredClone(prev);
      if (typeof newData.journalCapital !== 'object' || newData.journalCapital === null) {
        // Migrate from flat number
        newData.journalCapital = {
          IN: country === 'IN' ? cap : (newData.journalCapital || 1000000),
          US: country === 'US' ? cap : (newData.journalCapital || 50000)
        };
      }
      newData.journalCapital[country] = cap;
      return newData;
    });
    setIsEditingCapital(false);
    showToast(`Account Capital updated to ${country === 'IN' ? '₹' : '$'}${cap.toLocaleString()}!`, "success");
  };

  // Debounced Modal Live Price Hydration & Quick-fill
  useEffect(() => {
    if (!showModal) {
      setModalLivePrice(null);
      setIsFetchingModalPrice(false);
      return;
    }
    const sym = formData.symbol?.toUpperCase().trim();
    if (!sym || sym.length < 2) {
      setModalLivePrice(null);
      return;
    }

    const handler = setTimeout(async () => {
      setIsFetchingModalPrice(true);
      try {
        const res = await fetchStockQuotes([sym], country);
        if (res && res[0] && res[0].currentPrice) {
          setModalLivePrice(res[0].currentPrice);
        } else {
          setModalLivePrice(null);
        }
      } catch (e) {
        console.warn("Error fetching modal price:", e);
      } finally {
        setIsFetchingModalPrice(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [formData.symbol, showModal, country]);

  // Reference pricing and quantity for the Stop Loss matrix calculations
  const refEntryPrice = useMemo(() => {
    if (showScalingForm) {
      const buys = formData.transactions?.filter(t => t.type === 'Buy') || [];
      const totalBought = buys.reduce((acc, t) => acc + Number(t.qty || 0), 0);
      return totalBought > 0 
        ? buys.reduce((acc, t) => acc + (Number(t.price) * Number(t.qty)), 0) / totalBought 
        : 0;
    }
    return Number(formData.entryPrice || 0);
  }, [formData.entryPrice, formData.transactions, showScalingForm]);

  const refQty = useMemo(() => {
    if (showScalingForm) {
      const buys = formData.transactions?.filter(t => t.type === 'Buy') || [];
      const sells = formData.transactions?.filter(t => t.type === 'Sell') || [];
      const totalBought = buys.reduce((acc, t) => acc + Number(t.qty || 0), 0);
      const totalSold = sells.reduce((acc, t) => acc + Number(t.qty || 0), 0);
      return totalBought - totalSold;
    }
    return Number(formData.qty || 0);
  }, [formData.qty, formData.transactions, showScalingForm]);

  // Real-time instant Sizing Feedback parameters (uses active/avg values for scaled positions)
  // MUST be declared after refEntryPrice and refQty
  const sizingFeedback = useMemo(() => {
    const entry = refEntryPrice > 0 ? refEntryPrice : Number(formData.entryPrice || 0);
    const stop = Number(formData.initialStopLoss || 0);
    const qty = refQty > 0 ? refQty : Number(formData.qty || 0);

    if (entry <= 0 || stop <= 0) return null;

    const stopDistance = Math.abs(entry - stop);
    const stopLossPct = (stopDistance / entry) * 100;
    const cashRisk = qty * stopDistance;
    const totalCost = qty * entry;

    return { stopLossPct, cashRisk, totalCost };
  }, [refEntryPrice, refQty, formData.entryPrice, formData.initialStopLoss, formData.qty]);

  // Stop Loss Matrix Synchronization effect
  useEffect(() => {
    if (!showModal) return;
    const slPrice = Number(formData.initialStopLoss);
    if (slPrice > 0 && refEntryPrice > 0) {
      const dist = Math.abs(refEntryPrice - slPrice);
      const pct = (dist / refEntryPrice) * 100;
      
      if (document.activeElement?.id !== 'sl-price-input') {
        setSlPriceInput(slPrice.toString());
      }
      if (document.activeElement?.id !== 'sl-pct-input') {
        setSlPctInput(pct.toFixed(2));
      }
      if (refQty > 0 && document.activeElement?.id !== 'sl-cash-input') {
        const cash = refQty * dist;
        setSlCashInput(cash.toFixed(2));
      } else if (refQty <= 0) {
        setSlCashInput('');
      }
    } else {
      if (document.activeElement?.id !== 'sl-price-input') {
        setSlPriceInput(formData.initialStopLoss || '');
      }
      if (document.activeElement?.id !== 'sl-pct-input') {
        setSlPctInput('');
      }
      if (document.activeElement?.id !== 'sl-cash-input') {
        setSlCashInput('');
      }
    }
  }, [formData.initialStopLoss, refEntryPrice, refQty, showModal]);

  const modalIsLong = useMemo(() => {
    return formData.transactions && formData.transactions[0]
      ? formData.transactions[0].type !== 'Sell'
      : true;
  }, [formData.transactions]);

  const isInitialSlInvalid = useMemo(() => {
    const sl = Number(formData.initialStopLoss || 0);
    const ep = refEntryPrice;
    if (sl <= 0 || ep <= 0) return false;
    return modalIsLong ? sl >= ep : sl <= ep;
  }, [formData.initialStopLoss, refEntryPrice, modalIsLong]);

  const isCurrentSlInvalid = useMemo(() => {
    const sl = Number(formData.currentStopLoss || 0);
    const cp = modalLivePrice || refEntryPrice;
    if (sl <= 0 || cp <= 0) return false;
    return modalIsLong ? sl >= cp : sl <= cp;
  }, [formData.currentStopLoss, modalLivePrice, refEntryPrice, modalIsLong]);



  // Stop Loss Matrix interactive input change handlers
  const handleSlPriceChange = (val) => {
    setSlPriceInput(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      setFormData(prev => ({ ...prev, initialStopLoss: num }));
    } else if (!val) {
      setFormData(prev => ({ ...prev, initialStopLoss: '' }));
    }
  };

  const handleSlPctChange = (val) => {
    setSlPctInput(val);
    const num = Number(val);
    if (!isNaN(num) && num >= 0 && refEntryPrice > 0) {
      const s = modalIsLong ? refEntryPrice * (1 - num/100) : refEntryPrice * (1 + num/100);
      setFormData(prev => ({ ...prev, initialStopLoss: Number(s.toFixed(4)) }));
    } else if (!val) {
      setFormData(prev => ({ ...prev, initialStopLoss: '' }));
    }
  };

  const handleSlCashChange = (val) => {
    setSlCashInput(val);
    const num = Number(val);
    if (!isNaN(num) && num >= 0 && refEntryPrice > 0 && refQty > 0) {
      const dist = num / refQty;
      const s = modalIsLong ? refEntryPrice - dist : refEntryPrice + dist;
      setFormData(prev => ({ ...prev, initialStopLoss: Number(s.toFixed(4)) }));
    } else if (!val) {
      setFormData(prev => ({ ...prev, initialStopLoss: '' }));
    }
  };

  const handleSymbolChange = (e) => {
    const sym = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, symbol: sym }));
  };

  // Keyboard shortcut Ctrl+S / Cmd+S save listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showModal && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSavePosition();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, formData, showScalingForm, editingTradeId, refEntryPrice, refQty]);

  // Global keyboard shortcuts: Ctrl+K / Cmd+K to focus search, Alt+R to refresh quotes
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      // Focus Search Bar: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Refresh prices: Alt+R
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        loadLivePrices();
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [loadLivePrices]);

  // Execution Pyramiding controls
  const handleAddExecution = () => {
    if (!newExecution.price || Number(newExecution.price) <= 0) {
      showToast("Valid transaction price is required", "error");
      return;
    }
    if (!newExecution.qty || Number(newExecution.qty) <= 0) {
      showToast("Valid transaction quantity is required", "error");
      return;
    }

    const tx = {
      ...newExecution,
      id: `tx-user-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      price: Number(newExecution.price),
      qty: Number(newExecution.qty),
      reason: newExecution.reason.trim() || (newExecution.type === 'Buy' ? 'Scale In' : 'Scale Out')
    };

    setFormData(prev => ({
      ...prev,
      transactions: [...(prev.transactions || []), tx]
    }));
    setShowScalingForm(true);

    setNewExecution(prev => ({
      ...prev,
      price: '',
      qty: '',
      reason: ''
    }));
    showToast(`${tx.type} execution added to list!`, "success");
  };

  const handleRemoveExecution = (txId) => {
    setFormData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== txId)
    }));
    setShowScalingForm(true);
    showToast("Transaction removed.", "info");
  };

  // Save Trade Position Log (Robust Synchronization Engine)
  const handleSavePosition = () => {
    if (!formData.symbol.trim()) {
      showToast("Symbol is required", "error");
      return;
    }
    if (!formData.initialStopLoss || Number(formData.initialStopLoss) <= 0) {
      showToast("Stop Loss level is required for initial risk assessment", "error");
      return;
    }

    // Stop Loss Restriction check
    const entryPrice = refEntryPrice;
    const initSL = Number(formData.initialStopLoss);
    const currSL = formData.currentStopLoss ? Number(formData.currentStopLoss) : null;

    if (modalIsLong) {
      if (initSL >= entryPrice) {
        showToast("For Long positions, Initial Stop Loss must be less than the Entry Price", "error");
        return;
      }
      if (currSL !== null && currSL >= (modalLivePrice || entryPrice)) {
        showToast("For Long positions, Current/Trailing Stop Loss must be less than the current price", "error");
        return;
      }
    } else {
      if (initSL <= entryPrice) {
        showToast("For Short positions, Initial Stop Loss must be greater than the Entry Price", "error");
        return;
      }
      if (currSL !== null && currSL <= (modalLivePrice || entryPrice)) {
        showToast("For Short positions, Current/Trailing Stop Loss must be greater than the current price", "error");
        return;
      }
    }

    let finalTransactions = [...(formData.transactions || [])];

    const buys = finalTransactions.filter(t => t.type === 'Buy');
    const sells = finalTransactions.filter(t => t.type === 'Sell');
    const totalBought = buys.reduce((acc, t) => acc + Number(t.qty || 0), 0);
    const totalSold = sells.reduce((acc, t) => acc + Number(t.qty || 0), 0);

    const isScalingMode = formData.isScaling || 
                          showScalingForm || 
                          finalTransactions.length > 2 || 
                          buys.length > 1 || 
                          sells.length > 1 ||
                          (buys.length === 1 && sells.length === 1 && buys[0].qty !== sells[0].qty) ||
                          (sells.length > 0 && (totalBought - totalSold > 0));

    if (!isScalingMode) {
      // Simple Mode: Single entry buy and optional single sell
      if (!formData.entryPrice || Number(formData.entryPrice) <= 0) {
        showToast("Entry Price is required to log a transaction", "error");
        return;
      }
      if (!formData.qty || Number(formData.qty) <= 0) {
        showToast("Quantity is required to log a transaction", "error");
        return;
      }

      // Find or build initial Buy transaction
      const existingBuyIndex = finalTransactions.findIndex(t => t.type === 'Buy');
      const buyTx = {
        id: existingBuyIndex >= 0 ? finalTransactions[existingBuyIndex].id : `tx-simple-init-${Date.now().toString(36)}`,
        type: 'Buy',
        price: Number(formData.entryPrice),
        qty: Number(formData.qty),
        date: formData.entryDate || new Date().toISOString().split('T')[0],
        reason: existingBuyIndex >= 0 ? finalTransactions[existingBuyIndex].reason : 'Initial Entry'
      };

      if (existingBuyIndex >= 0) {
        finalTransactions[existingBuyIndex] = buyTx;
      } else {
        finalTransactions.push(buyTx);
      }

      // Handle Sell Transaction for Closed Status
      const existingSellIndex = finalTransactions.findIndex(t => t.type === 'Sell');
      if (formData.isClosed) {
        if (!formData.exitPrice || Number(formData.exitPrice) <= 0) {
          showToast("Exit Price is required for closed positions", "error");
          return;
        }
        const sellTx = {
          id: existingSellIndex >= 0 ? finalTransactions[existingSellIndex].id : `tx-simple-exit-${Date.now().toString(36)}`,
          type: 'Sell',
          price: Number(formData.exitPrice),
          qty: Number(formData.qty),
          date: formData.exitDate || new Date().toISOString().split('T')[0],
          reason: existingSellIndex >= 0 ? finalTransactions[existingSellIndex].reason : 'Position Closed'
        };

        if (existingSellIndex >= 0) {
          finalTransactions[existingSellIndex] = sellTx;
        } else {
          finalTransactions.push(sellTx);
        }
      } else {
        // If switched back to Active, drop any Sell transactions
        if (existingSellIndex >= 0) {
          finalTransactions.splice(existingSellIndex, 1);
        }
      }
    } else {
      // Advanced Scaling Mode
      const openQty = totalBought - totalSold;

      // If they selected Exited, but there is still remaining open qty, append final Sell execution
      if (formData.isClosed && openQty > 0) {
        if (!formData.exitPrice || Number(formData.exitPrice) <= 0) {
          showToast("Exit Price is required to close out the remaining shares", "error");
          return;
        }
        finalTransactions.push({
          id: `tx-simple-exit-pyramid-${Date.now().toString(36)}`,
          type: 'Sell',
          price: Number(formData.exitPrice),
          qty: openQty,
          date: formData.exitDate || new Date().toISOString().split('T')[0],
          reason: 'Position Closed'
        });
      }
    }

    const tradeToSave = {
      id: editingTradeId || `pos-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      symbol: formData.symbol.toUpperCase().trim(),
      setup: formData.setup,
      initialStopLoss: Number(formData.initialStopLoss),
      currentStopLoss: formData.currentStopLoss ? Number(formData.currentStopLoss) : null,
      notes: formData.notes.trim(),
      chartUrl: formData.chartUrl.trim(),
      isScaling: isScalingMode,
      transactions: finalTransactions
    };

    setData(prev => {
      const newData = structuredClone(prev);
      if (!newData.journals) newData.journals = { IN: [], US: [] };
      if (!newData.journals[country]) newData.journals[country] = [];

      if (editingTradeId) {
        newData.journals[country] = newData.journals[country].map(t => t.id === editingTradeId ? tradeToSave : t);
        showToast(`Updated position for ${tradeToSave.symbol}!`, "success");
      } else {
        newData.journals[country] = [tradeToSave, ...newData.journals[country]];
        showToast(`Logged new position for ${tradeToSave.symbol}!`, "success");
      }
      return newData;
    });

    setShowModal(false);
    setEditingTradeId(null);
    setFormData(initialFormState);
    setAutocompleteSuggestion(null);
    setShowScalingForm(false);
    setShowOptionalDetails(false);
  };

  const handleEditClick = (trade, e) => {
    e.stopPropagation();
    setEditingTradeId(trade.id);

    const buys = trade.transactions.filter(t => t.type === 'Buy');
    const sells = trade.transactions.filter(t => t.type === 'Sell');

    const totalBought = buys.reduce((acc, t) => acc + Number(t.qty || 0), 0);
    const totalSold = sells.reduce((acc, t) => acc + Number(t.qty || 0), 0);
    const openQty = totalBought - totalSold;
    const isClosed = openQty <= 0;

    const firstBuy = buys[0] || {};
    const lastSell = sells[sells.length - 1] || {};

    const avgExit = sells.length > 0 
      ? sells.reduce((acc, t) => acc + (Number(t.price) * Number(t.qty)), 0) / totalSold 
      : 0;

    setFormData({
      ...trade,
      currentStopLoss: trade.currentStopLoss || '',
      entryPrice: firstBuy.price || '',
      qty: firstBuy.qty || '',
      entryDate: firstBuy.date || new Date().toISOString().split('T')[0],
      isClosed,
      exitPrice: isClosed ? (avgExit || lastSell.price || '') : '',
      exitDate: lastSell.date || new Date().toISOString().split('T')[0],
    });
    
    // Auto-reveal pyramiding transactions if there's scaled buys/sells
    if (trade.isScaling || (trade.transactions && trade.transactions.length > 2)) {
      setShowScalingForm(true);
    } else {
      setShowScalingForm(false);
    }

    // Auto-reveal optional thesis details if data exists
    if (trade.notes || trade.chartUrl) {
      setShowOptionalDetails(true);
    } else {
      setShowOptionalDetails(false);
    }

    setShowModal(true);
  };

  const handleDeleteClick = async (tradeId, symbol, e) => {
    e.stopPropagation();
    if (await confirm(`Are you sure you want to delete all trade logs and executions for ${symbol}?`)) {
      setData(prev => {
        const newData = structuredClone(prev);
        newData.journals[country] = newData.journals[country].filter(t => t.id !== tradeId);
        return newData;
      });
      showToast(`Deleted ${symbol} position from journal.`, "success");
    }
  };

  const renderMetricsBanner = () => {
    return (
      <div className="flex bg-[var(--panel)] border border-[var(--border)] rounded-xl mb-8 divide-x divide-[var(--border)] shadow-sm overflow-hidden">
        {/* % INVESTED */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
          <div className="flex justify-between items-center w-full">
            <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">% INVESTED</span>
            <div 
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer p-0.5 rounded transition-colors"
              onClick={() => setIsEditingCapital(true)}
              title="Edit Capital"
            >
              <IconEdit className="w-3 h-3" />
            </div>
          </div>
          {isEditingCapital ? (
            <div className="mt-1 flex items-center gap-1 h-8">
              <span className="text-sm font-bold text-slate-400 font-mono">{country === 'IN' ? '₹' : '$'}</span>
              <input 
                type="number"
                defaultValue={accountCapital}
                autoFocus
                className="bg-transparent border-b border-sky-500 text-slate-800 dark:text-slate-100 font-mono text-sm font-bold w-20 focus:outline-none"
                onBlur={(e) => handleSaveCapital(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCapital(e.target.value);
                  if (e.key === 'Escape') setIsEditingCapital(false);
                }}
              />
            </div>
          ) : (
            <div className="mt-1 text-2xl font-black text-sky-500 dark:text-sky-400 font-mono h-8 flex items-center">
              {dashboardMetrics.investedPct.toFixed(1)}%
            </div>
          )}
          <span className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
            {country === 'IN' ? '₹' : '$'}{dashboardMetrics.investedCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })} of {country === 'IN' ? '₹' : '$'}{accountCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* FLOATING P&L */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
          <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">FLOATING P&L</span>
          <div className={`mt-1 text-2xl font-black font-mono h-8 flex items-center ${dashboardMetrics.floatingPnL > 0 ? 'text-emerald-500 dark:text-emerald-400' : dashboardMetrics.floatingPnL < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`}>
            {dashboardMetrics.floatingPnL > 0 ? '+' : ''}{country === 'IN' ? '₹' : '$'}{dashboardMetrics.floatingPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
            Active positions
          </span>
        </div>

        {/* TOTAL P&L */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
          <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">TOTAL P&L</span>
          <div className={`mt-1 text-2xl font-black font-mono h-8 flex items-center ${dashboardMetrics.totalPnL > 0 ? 'text-emerald-500 dark:text-emerald-400' : dashboardMetrics.totalPnL < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`}>
            {dashboardMetrics.totalPnL > 0 ? '+' : ''}{country === 'IN' ? '₹' : '$'}{dashboardMetrics.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
            {dashboardMetrics.returnPct > 0 ? '+' : ''}{dashboardMetrics.returnPct.toFixed(2)}% return · {metrics.profitFactor} PF
          </span>
        </div>

        {/* OPEN RISK */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
          <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">OPEN RISK</span>
          <div className="mt-1 text-2xl font-black text-emerald-500 dark:text-emerald-400 font-mono h-8 flex items-center">
            {dashboardMetrics.openRiskPct.toFixed(1)}%
          </div>
          <span className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
            {country === 'IN' ? '₹' : '$'}{(dashboardMetrics.openRisk).toLocaleString(undefined, { maximumFractionDigits: 0 })} at risk
          </span>
        </div>

        {/* LOCKED PROFIT */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
          <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">LOCKED PROFIT</span>
          <div className="mt-1 text-2xl font-black text-emerald-500 dark:text-emerald-400 font-mono h-8 flex items-center">
            +{country === 'IN' ? '₹' : '$'}{dashboardMetrics.lockedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
            if all SL hit
          </span>
        </div>

        {/* RISK REWARD */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
          <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">RISK REWARD</span>
          <div className={`mt-1 text-2xl font-black font-mono h-8 flex items-center ${Number(metrics.netR) > 0 ? 'text-emerald-500 dark:text-emerald-400' : Number(metrics.netR) < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            {metrics.netR} R
          </div>
          <span className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
            Net R-Multiple
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="market-pulse-container">
      
      {/* HEADER SECTION */}
      <header className="pulse-header flex justify-between items-center mb-4 border-b border-[var(--border)] pb-3">
        <div className="pulse-title-group flex items-center gap-6">
          {/* Tab Pill Selectors */}
          <div className="flex bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg gap-0.5">
            {[
              { id: 'standard', label: 'Standard' },
              { id: 'snapshot', label: 'Snapshot' },
              { id: 'analytics', label: 'Analytics' }
            ].map(tab => {
              const isActive = activeJournalTab === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveJournalTab(tab.id)}
                  role="button"
                  className={`px-3 py-1 text-[11px] font-black rounded cursor-pointer transition-all duration-200 ${
                    isActive 
                      ? 'bg-white dark:bg-slate-800 text-[var(--primary)] dark:text-[var(--primary-light)] shadow-sm border border-slate-200/50 dark:border-slate-700/20' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </div>
              );
            })}
          </div>
        </div>
        
        


        <div className="pulse-controls flex gap-3 items-center">
          {/* Refresh Prices Custom Div Button */}
          <div 
            role="button"
            className="sleek-refresh-btn flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-700 dark:text-slate-300 shadow-sm"
            onClick={loadLivePrices}
          >
            <IconRefresh className={`w-3.5 h-3.5 ${pricesLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Prices</span>
            <kbd className="px-1 py-0.2 text-[8px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded select-none font-mono font-black ml-1">
              Alt+R
            </kbd>
          </div>
          
          {/* Log Position Custom Div Button */}
          <div 
            role="button"
            className="px-3.5 py-1.5 font-extrabold text-xs rounded-md bg-[var(--primary)] text-white hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
            onClick={() => {
              setFormData(initialFormState);
              setEditingTradeId(null);
              setShowScalingForm(false);
              setShowOptionalDetails(false);
              setShowModal(true);
            }}
          >
            <IconPlus className="w-3.5 h-3.5" /> Log Position
          </div>
        </div>
      </header>

      {(activeJournalTab === 'standard' || activeJournalTab === 'snapshot') && (
        <>
          {/* Portfolio Metrics Cards */}
          {renderMetricsBanner()}

          {/* FILTER & SEARCH INTEGRATED CONTROL BAR */}
          <div className="flex justify-between items-center gap-4 flex-wrap p-3 px-4 rounded-xl border border-[var(--border)] bg-slate-50/60 dark:bg-slate-900/35 backdrop-blur-md mb-6 animate-fadeIn">
        
        <div className="flex items-center gap-4 flex-wrap">
          {/* Custom Status Filter Control */}
          <div className="flex bg-slate-100 dark:bg-slate-950/45 border border-[var(--border)] p-0.5 rounded-lg gap-1">
            {['All', 'Open', 'Closed', 'Win', 'Loss'].map(status => {
              const isActive = statusFilter === status;
              return (
                <div
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  role="button"
                  className={`px-4 py-1.5 text-xs font-bold rounded cursor-pointer transition-all duration-200 ${
                    isActive 
                      ? 'bg-white dark:bg-slate-800 text-[var(--primary)] dark:text-[var(--primary-light)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-slate-200/50 dark:border-slate-700/20' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {status}
                </div>
              );
            })}
          </div>

          {/* Custom Strategy Filter Control */}
          <div className="relative flex items-center bg-slate-100 dark:bg-slate-950/45 border border-[var(--border)] p-0.5 rounded-lg">
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              className="filter-bar-select text-slate-700 dark:text-slate-300 font-extrabold text-[11px] cursor-pointer w-[140px] min-w-[140px] max-w-[180px] truncate"
            >
              <option value="All" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Strategies</option>
              {uniqueStrategies.map(strategy => (
                <option key={strategy} value={strategy} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {strategy}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 pointer-events-none text-slate-500 dark:text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-2.5 h-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </span>
          </div>

          {/* Date Filter Mode Selection */}
          <div className="relative flex items-center bg-slate-100 dark:bg-slate-950/45 border border-[var(--border)] p-0.5 rounded-lg">
            <select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
              className="filter-bar-select text-slate-700 dark:text-slate-300 font-extrabold text-[11px] cursor-pointer w-[140px] min-w-[140px] max-w-[180px] truncate"
            >
              <option value="quick" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Quick Range</option>
              <option value="custom" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Custom Dates</option>
              <option value="week" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Specific Week</option>
            </select>
            <span className="absolute right-2.5 pointer-events-none text-slate-500 dark:text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-2.5 h-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </span>
          </div>

          {/* Render Date Selection UI dynamically */}
          {dateFilterType === 'quick' && (
            <div className="flex bg-slate-100 dark:bg-slate-950/45 border border-[var(--border)] p-0.5 rounded-lg gap-1 transition-all">
              <div className="flex items-center pl-2 pr-1 text-slate-500 dark:text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </div>
              {['All Time', 'This Month', 'Last 3 Months', 'This Year'].map(range => {
                const isActive = dateRangeFilter === range;
                return (
                  <div
                    key={range}
                    onClick={() => setDateRangeFilter(range)}
                    role="button"
                    className={`px-3 py-1.5 text-[10px] font-extrabold rounded cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? 'bg-white dark:bg-slate-800 text-[var(--primary)] dark:text-[var(--primary-light)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-slate-200/50 dark:border-slate-700/20' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {range}
                  </div>
                );
              })}
            </div>
          )}

          {dateFilterType === 'custom' && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-950/45 border border-[var(--border)] p-1 rounded-lg gap-2 transition-all">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-800 dark:text-slate-200 font-bold text-[10px] px-2 py-1 rounded focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[9px] font-black text-slate-400 tracking-wider">TO</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-800 dark:text-slate-200 font-bold text-[10px] px-2 py-1 rounded focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {dateFilterType === 'week' && (
            <div className="relative flex items-center bg-slate-100 dark:bg-slate-950/45 border border-[var(--border)] p-0.5 rounded-lg transition-all">
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="filter-bar-select text-slate-700 dark:text-slate-300 font-extrabold text-[11px] cursor-pointer w-[140px] min-w-[140px] max-w-[180px] truncate"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Select Week...</option>
                {uniqueJournalWeeks.map(wk => (
                  <option key={wk} value={wk} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    Week of {wk}
                  </option>
                ))}
              </select>
              <span className="absolute right-2.5 pointer-events-none text-slate-500 dark:text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-2.5 h-2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full max-w-[360px] justify-end">
          {/* High-Precision Search Wrapper */}
          <div className="relative flex items-center w-full">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-[var(--panel)] border border-[var(--border)] focus:border-primary/50 dark:focus:border-sky-500/50 outline-none rounded-lg pl-3 pr-14 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ..."
            />
            {!searchQuery && (
              <kbd className="absolute right-3 px-1.5 py-0.5 text-[9px] font-black text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded pointer-events-none select-none font-mono">
                Ctrl+K
              </kbd>
            )}
            {searchQuery && (
              <div 
                role="button"
                className="absolute right-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                onClick={() => setSearchQuery('')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          {/* Grid Config Button */}
          <div 
            role="button"
            onClick={() => setShowConfigModal(true)}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all shadow-sm h-[32px] w-[32px] shrink-0"
            title="Configure Columns"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>
        </>
      )}

      {/* LEDGER GRID CARD CONTAINER */}
      {activeJournalTab === 'standard' && (
        <div className="bg-[var(--panel)] rounded-xl border border-[var(--border)] overflow-hidden shadow-lg animate-fadeIn">
        {filteredPositions.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-[var(--muted)] flex justify-center mb-4"><IconBookOpen className="w-12 h-12" /></div>
            <h3 className="text-sm font-black text-[var(--text)] mb-2">No Trading Positions Logged</h3>
            <p className="text-[11px] text-[var(--muted)] font-semibold">
              {searchQuery || statusFilter !== 'All' 
                ? "Refine your search keywords above." 
                : "Create a new position above to track your swing setups."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="main-table-v3 w-full">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  {columnOrder.map(colKey => {
                    if (!columnVisibility[colKey]) return null;

                    const width = columnWidths[colKey];
                    const headerStyle = {
                      textAlign: (colKey === 'qty' || colKey === 'positionSize' || colKey === 'avgEntry' || colKey === 'stopLoss' || colKey === 'liveExit' || colKey === 'netPnL' || colKey === 'actions') ? 'right' : 
                                 (colKey === 'rMultiple' || colKey === 'status') ? 'center' : 'left',
                      width: width ? `${width}px` : undefined,
                      minWidth: width ? `${width}px` : undefined,
                      maxWidth: width ? `${width}px` : undefined,
                      position: 'relative',
                      userSelect: 'none'
                    };

                    const isPl = colKey === 'symbol';
                    const isPr = colKey === 'actions';
                    const className = `${isPl ? 'pl-5' : ''} ${isPr ? 'pr-5' : ''} ${colKey === 'slProximity' ? 'pl-4' : ''} text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tracking-widest uppercase py-3.5 select-none relative group`;

                    return (
                      <th 
                        key={colKey}
                        style={headerStyle}
                        className={className}
                      >
                        <div 
                          className={`flex items-center ${headerStyle.textAlign === 'right' ? 'justify-end' : headerStyle.textAlign === 'center' ? 'justify-center' : 'justify-start'} cursor-pointer gap-0.5`}
                          onClick={() => handleSort(colKey)}
                        >
                          <span>{ALL_COLUMNS[colKey].label}</span>
                          {renderSortIndicator(colKey)}
                        </div>

                        {/* Drag Resizing Handle Divider */}
                        {colKey !== 'actions' && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-10 transition-colors"
                            onMouseDown={(e) => handleResizeStart(colKey, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map(pos => {
                  const isExpanded = expandedTradeId === pos.id;
                  
                  const changePct = pos.avgEntryPrice > 0 
                    ? (pos.isLong 
                        ? (((pos.isClosed ? pos.avgExitPrice : pos.livePrice) - pos.avgEntryPrice) / pos.avgEntryPrice) * 100
                        : ((pos.avgEntryPrice - (pos.isClosed ? pos.avgExitPrice : pos.livePrice)) / pos.avgEntryPrice) * 100)
                    : 0;
                  
                  return (
                    <React.Fragment key={pos.id}>
                      {/* position summary row */}
                      <tr 
                        onClick={() => setExpandedTradeId(isExpanded ? null : pos.id)}
                        className={`hover:bg-slate-800/40 transition-all cursor-pointer ${isExpanded ? 'bg-slate-800/20' : 'border-b border-[var(--border)]'}`}
                      >
                        {columnOrder.map(colKey => {
                          if (!columnVisibility[colKey]) return null;

                          const width = columnWidths[colKey];
                          const cellStyle = {
                            textAlign: (colKey === 'qty' || colKey === 'positionSize' || colKey === 'avgEntry' || colKey === 'stopLoss' || colKey === 'liveExit' || colKey === 'netPnL' || colKey === 'actions') ? 'right' : 
                                       (colKey === 'rMultiple' || colKey === 'status') ? 'center' : 'left',
                            width: width ? `${width}px` : undefined,
                            minWidth: width ? `${width}px` : undefined,
                            maxWidth: width ? `${width}px` : undefined,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          };

                          const isPl = colKey === 'symbol';
                          const isPr = colKey === 'actions';
                          const className = `${isPl ? 'pl-5' : ''} ${isPr ? 'pr-5' : ''} ${colKey === 'slProximity' ? 'pl-4 py-4' : colKey === 'symbol' ? 'pl-5 py-4' : 'py-4'}`;

                          let content = null;
                          if (colKey === 'symbol') {
                            content = (
                              <div className="flex flex-col gap-0.5">
                                <span className="tracking-tight">{pos.symbol}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold truncate max-w-[160px]">{pos.setup}</span>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {pos.totalBought > pos.transactions.filter(t => t.type === 'Buy')?.[0]?.qty && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 flex items-center gap-1 shadow-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Pyramid ({pos.transactions.filter(t => t.type === 'Buy').length} entries)
                                    </span>
                                  )}
                                  {pos.totalSold > 0 && !pos.isClosed && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15 flex items-center gap-1 shadow-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      Scaled Out ({pos.transactions.filter(t => t.type === 'Sell').length} exits)
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          } else if (colKey === 'mas') {
                            content = liveMAs[pos.symbol] ? (
                              <div onClick={e => e.stopPropagation()} className="inline-flex">
                                <MovingAverageRibbon value={liveMAs[pos.symbol]} variant="compact" />
                              </div>
                            ) : (
                              <span className="text-slate-400 font-semibold text-xs">—</span>
                            );
                          } else if (colKey === 'action') {
                            content = (
                              <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded ${
                                pos.isLong 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' 
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}>
                                {pos.isLong ? 'LONG' : 'SHORT'}
                              </span>
                            );
                          } else if (colKey === 'qty') {
                            content = pos.isClosed ? (
                              <span className="font-mono text-xs font-bold text-[var(--text)]">0 <span className="text-slate-500 font-normal">/ {pos.totalBought}</span></span>
                            ) : pos.openQty !== pos.totalBought ? (
                              <span className="font-mono text-xs font-bold text-[var(--text)]">{pos.openQty} <span className="text-slate-500 font-normal">/ {pos.totalBought}</span></span>
                            ) : (
                              <span className="font-mono text-xs font-bold text-[var(--text)]">{pos.totalBought}</span>
                            );
                          } else if (colKey === 'positionSize') {
                            const activePct = accountCapital > 0 ? (pos.activeCostBasis / accountCapital) * 100 : 0;
                            content = (
                              <div className="font-mono">
                                <div className="text-xs font-black text-[var(--text)]">
                                  {activePct.toFixed(1)}%
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5" title={`Active position: ${pos.openQty} shares × ₹${pos.avgEntryPrice.toFixed(2)}`}>
                                  {country === 'IN' ? '₹' : '$'}{pos.activeCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            );
                          } else if (colKey === 'avgEntry') {
                            content = (
                              <span className="font-mono text-xs font-bold text-[var(--text)]">
                                {country === 'IN' ? '₹' : '$'}{pos.avgEntryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          } else if (colKey === 'stopLoss') {
                            content = (
                              <div className="font-mono">
                                <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                                  {pos.activeStopLossPct > 0 ? '-' : '+'}{Math.abs(pos.activeStopLossPct).toFixed(1)}%
                                </div>
                                {pos.currentStopLoss ? (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5" title="Current Trailed Stop Loss / Initial Stop Loss">
                                    {country === 'IN' ? '₹' : '$'}{pos.currentStopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <span className="text-[10px] text-slate-400/80 font-semibold ml-1">
                                      (Init: {country === 'IN' ? '₹' : '$'}{pos.initialStopLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5" title="Initial Stop Loss">
                                    {country === 'IN' ? '₹' : '$'}{pos.initialStopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                            );
                          } else if (colKey === 'liveExit') {
                            content = pos.isClosed ? (
                              <div className="font-mono flex flex-col items-end">
                                <span className={`text-xs font-black ${changePct > 0 ? 'text-emerald-500' : changePct < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                  {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5" title="Average Exit Price">
                                  {country === 'IN' ? '₹' : '$'}{pos.avgExitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ) : (
                              <div className="font-mono flex flex-col items-end">
                                <span className={`text-xs font-black ${changePct > 0 ? 'text-emerald-500' : changePct < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                  {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5" title="Live Price">
                                  {country === 'IN' ? '₹' : '$'}{pos.livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {pos.totalSold > 0 && (
                                  <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-bold mt-0.5" title="Average Partial Exit Price">
                                    Exit: {country === 'IN' ? '₹' : '$'}{pos.avgExitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            );
                          } else if (colKey === 'slProximity') {
                            content = <SlProximityBar pos={pos} />;
                          } else if (colKey === 'rMultiple') {
                            content = (
                              <span className={`font-mono text-xs font-black ${pos.rMultiple > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : pos.rMultiple < -0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--muted)]'}`}>
                                {pos.rMultiple > 0.01 ? `+${pos.rMultiple.toFixed(2)}` : pos.rMultiple.toFixed(2)} R
                              </span>
                            );
                          } else if (colKey === 'netPnL') {
                            content = (
                              <span className={`font-mono text-xs font-black ${pos.totalPnL > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : pos.totalPnL < -0.01 ? 'text-rose-600 dark:text-rose-450' : 'text-[var(--muted)]'}`}>
                                {pos.totalPnL > 0 ? '+' : ''}{pos.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          } else if (colKey === 'status') {
                            content = (
                              <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full ${
                                !pos.isClosed 
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/10' 
                                  : pos.totalPnL > 0.01 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' 
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10'
                              }`}>
                                {!pos.isClosed ? 'Open' : pos.totalPnL > 0.01 ? 'Win' : 'Loss'}
                              </span>
                            );
                          } else if (colKey === 'actions') {
                            content = (
                              <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                <div 
                                  role="button"
                                  className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded transition-all cursor-pointer flex items-center justify-center"
                                  onClick={(e) => handleEditClick(pos, e)}
                                  title="Edit Position"
                                >
                                  <IconEdit className="w-3.5 h-3.5" />
                                </div>
                                <div 
                                  role="button"
                                  className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded transition-all cursor-pointer flex items-center justify-center"
                                  onClick={(e) => handleDeleteClick(pos.id, pos.symbol, e)}
                                  title="Delete Position"
                                >
                                  <IconTrash className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <td 
                              key={colKey} 
                              style={cellStyle} 
                              className={className}
                            >
                              {content}
                            </td>
                          );
                        })}
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-900/30">
                          <td colSpan={visibleColsCount} className="p-6 border-b border-[var(--border)]">
                            <div className="flex flex-col gap-4">
                              {/* Header Row */}
                              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                                <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-widest uppercase">Position Thesis & Case Study</h4>
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-450">Logged Executions: {pos.transactions?.length || 0}</span>
                              </div>

                              {/* Layout Grid */}
                              <div className={`grid gap-6 ${pos.chartUrl ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-5'}`}>
                                
                                {/* Column 1: Trade Info & Notes */}
                                <div className={`${pos.chartUrl ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                                  <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between gap-3 min-h-[220px] max-h-[260px] h-full text-left">
                                    <div className="shrink-0">
                                      <span className="block text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">SETUP ARCHITECTURE</span>
                                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{pos.setup || "No setup specified"}</span>
                                    </div>
                                    <div className="border-t border-slate-200/60 dark:border-slate-800/60" />
                                    <div className="grid grid-cols-2 gap-3.5 shrink-0">
                                      <div>
                                        <span className="block text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">INITIAL STOP LOSS</span>
                                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 font-mono">
                                          {country === 'IN' ? '₹' : '$'}{pos.initialStopLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">TRAILING STOP LOSS</span>
                                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 font-mono">
                                          {pos.currentStopLoss 
                                            ? `${country === 'IN' ? '₹' : '$'}${pos.currentStopLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                                            : <span className="text-slate-405 dark:text-slate-500 italic font-medium">None</span>
                                          }
                                        </span>
                                      </div>
                                    </div>
                                    <div className="border-t border-slate-200/60 dark:border-slate-800/60" />
                                    <div className="flex-1 flex flex-col min-h-0">
                                      <span className="block text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">THESIS NOTES</span>
                                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap overflow-y-auto pr-1 flex-1 min-h-0">
                                        {pos.notes ? pos.notes : <span className="text-slate-400 dark:text-slate-500 italic font-medium">No thesis notes added.</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Column 2: Scale Ledger & Transactions Timeline */}
                                <div className={`${pos.chartUrl ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
                                  <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/80 flex flex-col min-h-[220px] max-h-[260px] h-full text-left">
                                    <h5 className="text-[10px] font-black text-amber-700 dark:text-amber-400 tracking-widest uppercase mb-3 flex items-center gap-1.5 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                                      Scale Ledger & Transactions
                                    </h5>
                                    <div className="relative pl-4 border-l border-slate-200 dark:border-slate-800/80 flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-0">
                                      {pos.transactions && pos.transactions.length > 0 ? (
                                        pos.transactions.map((t, idx) => {
                                          const isBuy = t.type === 'Buy';
                                          return (
                                            <div key={t.id || idx} className="relative flex justify-between items-center text-xs py-0.5 shrink-0">
                                              {/* Timeline bullet dot */}
                                              <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border border-white dark:border-slate-950 ${
                                                isBuy ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'
                                              }`} />
                                              
                                              <div className="flex flex-col pr-2">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                  {isBuy ? 'Scaled In' : 'Scaled Out'}: <span className="font-mono">{t.qty}</span> shares @ <span className="font-mono text-slate-800 dark:text-slate-100">{country === 'IN' ? '₹' : '$'}{Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-semibold italic">{t.reason || (isBuy ? 'Buy execution' : 'Sell execution')}</span>
                                              </div>
                                              
                                              <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-200/85 dark:border-slate-800/80 shrink-0">{t.date}</span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-xs text-slate-400 dark:text-slate-500 italic font-medium">No transactions logged.</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Column 3: Setup Chart Snap */}
                                {pos.chartUrl && (
                                  <div className="lg:col-span-1">
                                    <div className="flex flex-col gap-2.5 h-full">
                                      {getTradingViewImage(pos.chartUrl) ? (
                                        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950/40 min-h-[220px] max-h-[260px] h-full group shadow-inner">
                                          <img 
                                            src={getTradingViewImage(pos.chartUrl)} 
                                            alt={`${pos.symbol} chart snapshot`}
                                            className="w-full h-full object-cover group-hover:scale-103 transition-all duration-300"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                          />
                                          <a 
                                            href={pos.chartUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="absolute bottom-3 right-3 bg-slate-900/90 hover:bg-slate-950 text-[10px] font-extrabold px-3 py-1.5 text-white rounded-lg hover:scale-102 transition-all border border-slate-800/80 flex items-center gap-1.5"
                                          >
                                            <IconExternalLink className="w-3 h-3" /> View Full Chart
                                          </a>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-2 items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl min-h-[220px] max-h-[260px] h-full bg-slate-50/50 dark:bg-slate-950/20">
                                          <span className="text-xs text-slate-500 font-semibold">External Attachment Link</span>
                                          <a 
                                            href={pos.chartUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-[var(--primary-light)] font-bold underline"
                                          >
                                            Open Chart attachment ↗
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* SNAPSHOT TAB VIEW */}
      {activeJournalTab === 'snapshot' && (
        <div className="bg-[var(--panel)] p-6 rounded-xl border border-[var(--border)] shadow-lg animate-fadeIn">
          {snapshotLoading ? (
            <div className="py-16 text-center">
              <span className="text-sm font-bold text-sky-500 dark:text-sky-400 animate-pulse">● Loading visual candlestick charts...</span>
            </div>
          ) : mergedSnapshotStockData.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <div className="text-[var(--muted)] flex justify-center mb-4"><IconBookOpen className="w-12 h-12" /></div>
              <h3 className="text-sm font-black text-[var(--text)] mb-2">No Trading Positions Logged</h3>
            </div>
          ) : (
            <BirdsEyeGrid
              stocksCount={snapshotStockData.length}
              timeframe={snapshotTimeframe}
              setTimeframe={setSnapshotTimeframe}
              data={mergedSnapshotStockData}
              country={country}
              accountCapital={accountCapital}
              onTileClick={(stock) => {
                const originalTrade = journalEntries.find(t => t.symbol === stock.symbol);
                if (originalTrade) {
                  handleEditClick(originalTrade, { stopPropagation: () => {} });
                }
              }}
            />
          )}
        </div>
      )}

      {/* ANALYTICS TAB VIEW */}
      {activeJournalTab === 'analytics' && (
        <div className="flex flex-col gap-6 animate-fadeIn">

          {/* Row 1: 30% stats, 70% benchmark chart */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Column 1: Performance stats list & Win/Loss Streak (30%) */}
            <div className="lg:col-span-3 bg-[var(--panel)] p-4 rounded-xl border border-[var(--border)] flex flex-col gap-3.5 shadow-sm">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
                <IconTrendingUp className="w-4 h-4" /> Performance Stats
              </h3>
              
              <div className="flex flex-col gap-3.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Total Positions</span>
                  <span className="text-slate-800 dark:text-slate-100 font-mono font-black">{analyticsMetrics.total}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Closed Positions</span>
                  <span className="text-slate-800 dark:text-slate-100 font-mono font-black">{analyticsMetrics.closed}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Win Rate %</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-mono font-black">{analyticsMetrics.winRate}%</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Profit Factor
                    <span
                      className="group relative cursor-default"
                      title=""
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-400 hover:text-indigo-500 transition-colors">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm.75 3.31a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" clipRule="evenodd" />
                      </svg>
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-semibold leading-snug rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl border border-slate-700/50 text-center">
                        <span className="block font-black text-indigo-400 mb-0.5">Profit Factor</span>
                        Total gross profit ÷ Total gross loss. A value &gt;1 means the system is profitable. &gt;2 is excellent, &gt;3 is exceptional.
                        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                      </span>
                    </span>
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{analyticsMetrics.profitFactor}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Average Win</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-mono font-black">{country === 'IN' ? '₹' : '$'}{Number(analyticsMetrics.avgWin).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Average Loss</span>
                  <span className="text-rose-500 dark:text-rose-400 font-mono font-black">{country === 'IN' ? '₹' : '$'}{Number(analyticsMetrics.avgLoss).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Net R-Multiple</span>
                  <span className={`font-mono font-black ${Number(analyticsMetrics.netR) > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{analyticsMetrics.netR} R</span>
                </div>
              </div>

              {/* Streak Sparkline inside stats panel */}
              <div className="mt-2 pt-4 border-t border-[var(--border)]">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">Win/Loss Streak Log</span>
                  {analyticsCurrentStreak.count > 0 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${analyticsCurrentStreak.type === 'win' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {analyticsCurrentStreak.count} {analyticsCurrentStreak.type === 'win' ? 'Wins' : 'Losses'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {analyticsStreakSparks.length > 0 ? analyticsStreakSparks.map((pos) => {
                    const isWin = pos.totalPnL > 0.01;
                    return (
                      <span 
                        key={pos.id} 
                        className={`w-3 h-3 rounded-full flex-shrink-0 cursor-help ${
                          isWin 
                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' 
                            : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                        }`} 
                        title={`${pos.symbol}: ${isWin ? 'Win' : 'Loss'} (${pos.totalPnL > 0 ? '+' : ''}${pos.totalPnL.toFixed(2)})`}
                      />
                    );
                  }) : (
                    <span className="text-[11px] text-slate-400 font-semibold italic">No closed trades logged</span>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-[var(--panel)] p-3 rounded-xl border border-[var(--border)] flex flex-col gap-2.5 shadow-sm">
              <div ref={compareDropdownRef} className="flex justify-between items-center border-b border-[var(--border)] pb-1.5 relative">
                <h3 className="text-[11px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <IconActivity className="w-3.5 h-3.5" /> Benchmark Comparison
                </h3>
                
                <div className="relative animate-fadeIn">
                  <div
                    role="button"
                    onClick={() => setShowCompareDropdown(!showCompareDropdown)}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-[10px] font-black text-slate-700 dark:text-slate-300 cursor-pointer transition-all"
                  >
                    <span>➕ Compare</span>
                    <IconChevron isOpen={showCompareDropdown} className="w-3 h-3" />
                  </div>
                  
                  {showCompareDropdown && (
                    <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2.5 animate-fadeIn">
                      <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 mb-1.5 px-1">
                        Select Indices
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto themed-scroll">
                        {(country === 'IN' ? INDIA_BENCHMARKS : US_BENCHMARKS).map(index => {
                          const isSelected = selectedTickers.includes(index.symbol);
                          const color = TICKER_COLORS[index.symbol] || '#94a3b8';
                          return (
                            <label 
                              key={index.symbol}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
                            >
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    if (selectedTickers.length > 1) {
                                      setSelectedTickers(selectedTickers.filter(t => t !== index.symbol));
                                    } else {
                                      showToast("At least one benchmark index must be selected.", "warning");
                                    }
                                  } else {
                                    setSelectedTickers([...selectedTickers, index.symbol]);
                                  }
                                }}
                                className="rounded text-sky-600 focus:ring-sky-500 border-slate-350 dark:border-slate-750"
                              />
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              <span className="truncate">{index.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {benchmarkLoading && Object.keys(benchmarkPriceDataMap).length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse font-bold">● Syncing index benchmark...</span>
                </div>
              ) : !earliestTradeDate ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <span className="text-xs text-slate-400 font-semibold">No trade history found.</span>
                  <p className="text-[10px] text-slate-400/80 mt-1 font-semibold">Comparison requires at least one logged position.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between gap-2.5">
                  <BenchmarkComparisonChart 
                    benchmarkPriceDataMap={benchmarkPriceDataMap}
                    selectedTickers={selectedTickers}
                    calculatedPositions={analyticsPositions}
                    accountCapital={accountCapital}
                    country={country}
                    activeAnalyticsStartDate={activeAnalyticsStartDate}
                  />

                  <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Horizon Start</span>
                      <input 
                        type="date"
                        value={analyticsStartDate || earliestTradeDate || ''}
                        min={earliestTradeDate || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (earliestTradeDate && val < earliestTradeDate) {
                            return;
                          }
                          setAnalyticsStartDate(val);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 font-mono rounded px-2.5 py-1 focus:outline-none cursor-pointer transition-all"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-950/20 border border-[var(--border)] flex flex-col gap-1.5 mt-0.5 shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Portfolio Return:</span>
                      <span className={`text-sm font-black font-mono ${analyticsDashboardMetrics.returnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {analyticsDashboardMetrics.returnPct >= 0 ? '+' : ''}{analyticsDashboardMetrics.returnPct.toFixed(2)}%
                      </span>
                    </div>

                    {selectedTickers.map(ticker => {
                      const returnVal = benchmarkIndexReturnMap[ticker];
                      const tickerLabel = BENCHMARK_LABELS[ticker]?.split(' (')[0] || ticker;
                      const color = TICKER_COLORS[ticker] || '#94a3b8';
                      return (
                        <div key={ticker} className="flex justify-between items-center border-t border-slate-200/30 dark:border-slate-800/30 pt-1.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                            {tickerLabel} Return:
                          </span>
                          {returnVal !== undefined ? (
                            <span className={`text-sm font-black font-mono ${returnVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {returnVal >= 0 ? '+' : ''}{returnVal.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-bold font-mono">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Outperformance Banner Card */}
                  {selectedTickers.length > 0 && (() => {
                    const primaryTicker = selectedTickers[0];
                    const primaryReturn = benchmarkIndexReturnMap[primaryTicker];
                    if (primaryReturn === undefined) return null;
                    
                    const diff = analyticsDashboardMetrics.returnPct - primaryReturn;
                    const isBeating = diff >= 0;
                    const indexLabel = BENCHMARK_LABELS[primaryTicker]?.split(' (')[0] || primaryTicker;

                    return (
                      <div className={`p-2 rounded-md border flex items-center justify-between text-[11px] font-extrabold shadow-sm ${
                        isBeating 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {isBeating ? `🚀 Beating ${indexLabel}!` : `⚠️ Underperforming ${indexLabel}`}
                        </div>
                        <span className="font-mono font-black">{isBeating ? '+' : ''}{diff.toFixed(2)}%</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Stock Leaderboard & AI Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top / Worst Performer Leaderboard */}
            <div className="bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
                <IconTrophy className="w-4 h-4 text-amber-500" /> Stock Leaderboard
              </h3>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Column 1: Top Performers */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5 mb-1">
                    <span>🏆 Top Performers</span>
                  </h4>
                  {analyticsInsightsData.bestByCash.length > 0 ? (
                    analyticsInsightsData.bestByCash.slice(0, 3).map((stock) => (
                      <div key={stock.symbol} className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all flex flex-col gap-1.5 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">{stock.symbol}</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            +{country === 'IN' ? '₹' : '$'}{stock.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          <span>Invested: {country === 'IN' ? '₹' : '$'}{stock.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">+{stock.returnPct.toFixed(1)}%</span>
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold italic border-t border-slate-200/40 dark:border-slate-800/30 pt-1 flex justify-between">
                          {stock.closedTrades > 0 ? (
                            <>
                              <span>Win Rate: {Math.round((stock.wins / stock.closedTrades) * 100)}%</span>
                              <span>{stock.wins}W / {stock.closedTrades}T</span>
                            </>
                          ) : (
                            <>
                              <span>Win Rate: —</span>
                              <span>No closed trades</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-8 text-center text-[10px] text-slate-400 font-semibold italic bg-slate-50/50 dark:bg-slate-950/10 border border-dashed border-slate-200 dark:border-slate-800/50 rounded-lg min-h-[100px]">
                      No profitable stocks yet.
                    </div>
                  )}
                </div>

                {/* Column 2: Needs Review */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[10px] font-black text-rose-600 dark:text-rose-500 flex items-center gap-1.5 mb-1">
                    <span>📉 Needs Review</span>
                  </h4>
                  {analyticsInsightsData.worstByCash.length > 0 ? (
                    analyticsInsightsData.worstByCash.slice(0, 3).map((stock) => (
                      <div key={stock.symbol} className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-all flex flex-col gap-1.5 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">{stock.symbol}</span>
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">
                            {country === 'IN' ? '₹' : '$'}{stock.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          <span>Invested: {country === 'IN' ? '₹' : '$'}{stock.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          <span className="font-mono text-rose-600 dark:text-rose-400 font-black">{stock.returnPct.toFixed(1)}%</span>
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold italic border-t border-slate-200/40 dark:border-slate-800/30 pt-1 flex justify-between">
                          {stock.closedTrades > 0 ? (
                            <>
                              <span>Win Rate: {Math.round((stock.wins / stock.closedTrades) * 100)}%</span>
                              <span>{stock.wins}W / {stock.closedTrades}T</span>
                            </>
                          ) : (
                            <>
                              <span>Win Rate: —</span>
                              <span>No closed trades</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-8 text-center text-[10px] text-slate-400 font-semibold italic bg-slate-50/50 dark:bg-slate-950/10 border border-dashed border-slate-200 dark:border-slate-800/50 rounded-lg min-h-[100px]">
                      No losing stocks recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: AI Insights */}
            <div className="bg-[var(--panel)] p-5 rounded-xl border border-[var(--border)] flex flex-col gap-3 shadow-sm">
              {/* Header row: title left, button right */}
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <IconBookOpen className="w-4 h-4" /> AI Insights
                </h3>
                <div
                  role="button"
                  onClick={!(aiInsightsLoading || analyticsPositions.length === 0) ? handleFetchAiInsights : undefined}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                    aiInsightsLoading || analyticsPositions.length === 0
                      ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:brightness-110 text-white shadow-md hover:shadow-indigo-500/20'
                  }`}
                >
                  {aiInsightsLoading ? (
                    <span className="flex items-center gap-1 animate-pulse">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" /></svg>
                      Analysing…
                    </span>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.988-8.102a.5.5 0 00-.707-.707L12 15.658V3a1 1 0 00-2 0v12.904z" /></svg>
                      Analyse Trades
                    </>
                  )}
                </div>
              </div>

              {/* Content area — fills remaining height */}
              <div className="flex-1 min-h-[220px]">
                {aiInsights ? (
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-950/20 border border-[var(--border)] p-4 rounded-xl h-full max-h-[320px] overflow-y-auto themed-scroll shadow-inner">
                    {aiInsights.split('\n').map((line, i) => {
                      // H3 / H4 headers
                      if (/^#{1,4}\s/.test(line)) {
                        const text = line.replace(/^#{1,4}\s+/, '');
                        return <p key={i} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-3 mb-1 first:mt-0">{text}</p>;
                      }
                      // Horizontal rule
                      if (/^---+$/.test(line.trim())) {
                        return <hr key={i} className="border-slate-200 dark:border-slate-800 my-2" />;
                      }
                      // Empty line → spacer
                      if (line.trim() === '') return <div key={i} className="h-1.5" />;
                      // Bullet points
                      const isBullet = /^[\*\-]\s/.test(line);
                      const content = (isBullet ? line.slice(2) : line)
                        .split(/\*\*(.+?)\*\*/g)
                        .map((part, j) => j % 2 === 1
                          ? <strong key={j} className="font-extrabold text-slate-800 dark:text-slate-100">{part}</strong>
                          : part.split(/\*(.+?)\*/g).map((p, k) => k % 2 === 1
                            ? <em key={k} className="italic text-slate-600 dark:text-slate-300">{p}</em>
                            : p
                          )
                        );
                      return isBullet
                        ? <div key={i} className="flex gap-1.5 items-start mb-0.5"><span className="mt-1 w-1 h-1 rounded-full bg-indigo-400 shrink-0" /><p className="font-semibold">{content}</p></div>
                        : <p key={i} className="font-semibold mb-0.5">{content}</p>;
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center h-full min-h-[200px] rounded-xl border border-dashed border-slate-200 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/10">
                    <svg className="w-7 h-7 text-slate-300 dark:text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.988-8.102a.5.5 0 00-.707-.707L12 15.658V3a1 1 0 00-2 0v12.904z" /></svg>
                    <span className="text-slate-400 dark:text-slate-600 text-xs font-bold">No analysis yet</span>
                    <p className="text-[10px] text-slate-400/70 dark:text-slate-600/80 mt-1 font-semibold max-w-[180px] leading-snug">Hit <span className="text-indigo-400 font-black">Analyse Trades</span> above to run a Gemini-powered audit of your setups &amp; risk.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}


      {/* ULTRA-DENSE, SIMPLIFIED PROGRESSIVE PORTAL-MODAL (Max Width: 550px) */}
      {showModal && (
        <Modal 
          isOpen={showModal} 
          onClose={() => {
            setShowModal(false);
            setEditingTradeId(null);
            setFormData(initialFormState);
            setAutocompleteSuggestion(null);
            setShowScalingForm(false);
            setShowOptionalDetails(false);
            setActiveModalTab('entry');
            setShowSizer(false);
            setSizerRiskPct('1');
            setSizerRiskCash('');
            setSizerUseCash(false);
          }} 
          title={editingTradeId ? "Position Parameters" : "Log Trade Position"} 
          subtitle="Swing trading initial entries, risk exposures, and execution logs"
          className="max-w-xl"
        >
          <div className="flex flex-col gap-4 pt-2 pb-4">
            
            {/* TAB NAVIGATION */}
            <div className="flex bg-slate-100 dark:bg-slate-900/45 border border-slate-200 dark:border-slate-850 p-1 rounded-lg gap-1 w-full mb-2">
              {[
                { id: 'entry', label: 'Entry & Risk' },
                { id: 'exit', label: 'Exit & Review' },
                { id: 'scaling', label: 'Pyramiding' },
                { id: 'notes', label: 'Notes & Chart' }
              ].map(tab => (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveModalTab(tab.id);
                    if (tab.id === 'scaling') {
                      setShowScalingForm(true);
                    } else {
                      setShowScalingForm(false);
                    }
                  }}
                  role="button"
                  className={`flex-1 text-center py-2 text-[10px] font-black rounded-md cursor-pointer transition-all duration-200 ${
                    activeModalTab === tab.id 
                      ? 'bg-white dark:bg-slate-800 text-[var(--primary)] dark:text-[var(--primary-light)] shadow-sm border border-slate-200/50 dark:border-slate-700/20' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </div>
              ))}
            </div>

            {/* TAB 1: ENTRY & RISK */}
            {activeModalTab === 'entry' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                {/* Core Identifiers */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative form-field">
                    <label className="block mb-1 text-[9.5px] font-extrabold text-slate-450 dark:text-slate-400 tracking-wide">Ticker Symbol</label>
                    <input
                      type="text"
                      className="grid-text-input py-2 px-3 w-full rounded-md font-bold bg-white dark:bg-slate-950"
                      value={formData.symbol}
                      onChange={handleSymbolChange}
                      placeholder="e.g. RELIANCE"
                      disabled={!!editingTradeId}
                      autoFocus
                    />
                    
                    {formData.symbol && formData.symbol.length >= 2 && (
                      <div className="mt-1 text-[10px] font-bold flex items-center gap-1.5 h-4">
                        {isFetchingModalPrice ? (
                          <span className="text-sky-500 dark:text-sky-400 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                            Syncing live price...
                          </span>
                        ) : modalLivePrice ? (
                          <div 
                            role="button"
                            onClick={() => {
                              if (!showScalingForm) {
                                setFormData(prev => ({ ...prev, entryPrice: modalLivePrice.toString() }));
                                showToast(`Filled Entry Price with Live Price: ${country === 'IN' ? '₹' : '$'}${modalLivePrice}!`, "info");
                              }
                            }}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/10"
                            title="Click to copy to Entry Price"
                          >
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Live Price: <span className="font-mono font-black">{country === 'IN' ? '₹' : '$'}{modalLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-[8px] text-slate-400 dark:text-slate-500 ml-1 font-semibold hover:text-[var(--primary)] transition-colors">(click to autofill Entry)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-semibold">No live exchange price Hydrated</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-field">
                    <label className="block mb-1 text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wide">Strategy / Setup</label>
                    <select
                      className="select-control py-2 px-3 w-full rounded-md bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-semibold"
                      value={formData.setup && !SUGGESTED_SETUPS.includes(formData.setup) ? "Custom Setup" : formData.setup}
                      onChange={(e) => setFormData(prev => ({ ...prev, setup: e.target.value }))}
                    >
                      <option value="" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Select Strategy...</option>
                      {SUGGESTED_SETUPS.map(s => (
                        <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                          {s}
                        </option>
                      ))}
                      <option value="Custom Setup" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Custom / Other Setup</option>
                    </select>
                  </div>
                </div>

                {(formData.setup === "Custom Setup" || (formData.setup && !SUGGESTED_SETUPS.includes(formData.setup))) && (
                  <div className="form-field">
                    <label className="block mb-1.5 text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wide">Custom Strategy Name</label>
                    <input
                      type="text"
                      className="grid-text-input py-2 px-3 w-full rounded-md bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold"
                      value={formData.setup === "Custom Setup" ? "" : formData.setup}
                      onChange={(e) => setFormData(prev => ({ ...prev, setup: e.target.value }))}
                      placeholder="Enter custom strategy"
                    />
                  </div>
                )}

                {/* Standard Core Pricing */}
                {showScalingForm ? (
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/35 flex flex-col gap-1">
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex justify-between">
                      <span>SCALE ENTRIES ENGAGED</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">Buys: {formData.transactions.filter(t=>t.type==='Buy').length} | Sells: {formData.transactions.filter(t=>t.type==='Sell').length}</span>
                    </div>
                    <p className="text-[9.5px] text-slate-650 dark:text-slate-400 font-semibold leading-relaxed">
                      Simple entry fields are locked. Entry averages are driven dynamically from the Pyramiding Scale ledger in the Pyramiding tab.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="form-field">
                      <label className="block mb-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-wide">Entry Price</label>
                      <input
                        type="number"
                        className="grid-text-input py-2 px-3 w-full rounded-md font-mono font-semibold bg-white dark:bg-slate-950"
                        value={formData.entryPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          const epNum = Number(val || 0);
                          setFormData(prev => {
                            let updatedQty = prev.qty;
                            if (epNum > 0) {
                              if (sizerUseCash && sizerInvestCash) {
                                const calculatedQty = Math.floor(Number(sizerInvestCash) / epNum);
                                updatedQty = calculatedQty > 0 ? calculatedQty.toString() : '';
                              } else if (!sizerUseCash && sizerInvestPct && accountCapital > 0) {
                                const calculatedInvest = (accountCapital * Number(sizerInvestPct)) / 100;
                                const calculatedQty = Math.floor(calculatedInvest / epNum);
                                updatedQty = calculatedQty > 0 ? calculatedQty.toString() : '';
                              }
                            }
                            return { ...prev, entryPrice: val, qty: updatedQty };
                          });
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-field">
                      <label className="block mb-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-wide">Quantity</label>
                      <input
                        type="number"
                        className="grid-text-input py-2 px-3 w-full rounded-md font-mono font-semibold bg-white dark:bg-slate-950"
                        value={formData.qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, qty: val }));
                          // Reverse-calculate invest % from qty so the Position Sizing panel stays in sync
                          const qtyNum = Number(val || 0);
                          const ep = Number(formData.entryPrice || 0);
                          if (qtyNum > 0 && ep > 0) {
                            const totalInvest = qtyNum * ep;
                            if (sizerUseCash) {
                              setSizerInvestCash(totalInvest.toFixed(2));
                            } else if (accountCapital > 0) {
                              setSizerInvestPct(((totalInvest / accountCapital) * 100).toFixed(2));
                            }
                          } else if (!val) {
                            setSizerInvestPct('');
                            setSizerInvestCash('');
                          }
                        }}
                        placeholder="e.g. 50"
                      />
                    </div>
                    <div className="form-field">
                      <label className="block mb-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-wide">Entry Date</label>
                      <input
                        type="date"
                        className="grid-text-input py-2 px-3 w-full rounded-md bg-white dark:bg-slate-950"
                        value={formData.entryDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, entryDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* Position Sizing — always visible */}
                {(
                  <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col gap-2.5">
                    <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tracking-wide flex justify-between items-center">
                      <span>⚖️ Position Sizing</span>
                      <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-semibold normal-case">
                        Qty = Investment ÷ Entry Price
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="form-field">
                        <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Investment Basis</label>
                        <select
                          className="select-control py-1.5 px-2.5 w-full rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold text-xs h-8 border border-slate-200 dark:border-slate-800"
                          value={sizerUseCash ? 'cash' : 'pct'}
                          onChange={(e) => setSizerUseCash(e.target.value === 'cash')}
                        >
                          <option value="pct">% of Capital</option>
                          <option value="cash">Fixed Cash Amount</option>
                        </select>
                      </div>

                      <div className="form-field">
                        <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">
                          {sizerUseCash ? `Amount (${country === 'IN' ? '₹' : '$'})` : 'Invest %'}
                        </label>
                        <input
                          id="sizer-invest-input"
                          type="number"
                          className="grid-text-input py-1.5 px-2.5 w-full rounded font-mono text-xs bg-white dark:bg-slate-900 font-bold h-8 border border-slate-200 dark:border-slate-800"
                          value={sizerUseCash ? sizerInvestCash : sizerInvestPct}
                          onChange={(e) => {
                            const val = e.target.value;
                            const ep = refEntryPrice > 0 ? refEntryPrice : Number(formData.entryPrice || 0);
                            if (sizerUseCash) {
                              setSizerInvestCash(val);
                              if (ep > 0 && val) {
                                const calculatedQty = Math.floor(Number(val) / ep);
                                setFormData(prev => ({ ...prev, qty: calculatedQty > 0 ? calculatedQty.toString() : '' }));
                              } else if (!val) {
                                setFormData(prev => ({ ...prev, qty: '' }));
                              }
                            } else {
                              setSizerInvestPct(val);
                              if (ep > 0 && val && accountCapital > 0) {
                                const calculatedInvest = (accountCapital * Number(val)) / 100;
                                const calculatedQty = Math.floor(calculatedInvest / ep);
                                setFormData(prev => ({ ...prev, qty: calculatedQty > 0 ? calculatedQty.toString() : '' }));
                              } else if (!val) {
                                setFormData(prev => ({ ...prev, qty: '' }));
                              }
                            }
                          }}
                          placeholder={sizerUseCash ? '50000' : '5'}
                          min="0"
                        />
                      </div>

                      <div className="form-field">
                        <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Account Capital</label>
                        <div className="py-1.5 px-2.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 h-8 flex items-center">
                          {country === 'IN' ? '₹' : '$'}{accountCapital.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Live feedback: bidirectional position info (uses active position for scaled entries) */}
                    {(() => {
                      // Use active/weighted values for scaled entries
                      const ep = refEntryPrice > 0 ? refEntryPrice : Number(formData.entryPrice || 0);
                      const activeQty = refQty > 0 ? refQty : Number(formData.qty || 0);
                      const isScaled = showScalingForm && (formData.transactions?.length || 0) > 1;

                      const sizerInvest = sizerUseCash
                        ? Number(sizerInvestCash || 0)
                        : (accountCapital * Number(sizerInvestPct || 0)) / 100;

                      // Direction 1: investment % or amount filled → show qty + total
                      if (sizerInvest > 0 && ep > 0) {
                        const qty = Math.floor(sizerInvest / ep);
                        const actual = qty * ep;
                        const pct = accountCapital > 0 ? (actual / accountCapital) * 100 : null;
                        return (
                          <div className="flex flex-wrap items-center gap-2.5 text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/60 dark:bg-indigo-900/30 px-2.5 py-1.5 rounded-lg">
                            <span>Investing: <span className="font-mono font-black">{country === 'IN' ? '₹' : '$'}{actual.toLocaleString()}</span></span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span>Qty: <span className="font-mono font-black">{qty.toLocaleString()}</span> shares</span>
                            {pct !== null && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="text-slate-500 dark:text-slate-400">{pct.toFixed(1)}% of capital</span>
                              </>
                            )}
                          </div>
                        );
                      }

                      // Direction 2: active qty known → show total active investment + % of capital
                      if (activeQty > 0 && ep > 0) {
                        const investAmt = activeQty * ep;
                        const pct = accountCapital > 0 ? (investAmt / accountCapital) * 100 : null;
                        return (
                          <div className="flex flex-wrap items-center gap-2.5 text-[9px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-lg">
                            {isScaled && <span className="text-amber-600 dark:text-amber-400 font-black">Scaled —</span>}
                            <span>Active Investment: <span className="font-mono font-black text-sky-700 dark:text-sky-400">{country === 'IN' ? '₹' : '$'}{investAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
                            {pct !== null && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="font-mono font-black text-amber-700 dark:text-amber-400">{pct.toFixed(1)}% of capital</span>
                              </>
                            )}
                            {isScaled && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <span className="text-slate-400 dark:text-slate-500">Avg ₹{ep.toLocaleString(undefined, { maximumFractionDigits: 2 })} × {activeQty}</span>
                              </>
                            )}
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                )}

                {/* Stop Loss Matrix */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/25 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wide">Stop Loss</span>
                    <span className="text-[8.5px] text-slate-500 dark:text-slate-500 font-semibold font-mono">Edit any field to compute others</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="form-field">
                      <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Stop Loss Price ({country === 'IN' ? '₹' : '$'})</label>
                      <input
                        id="sl-price-input"
                        type="number"
                        className={`grid-text-input py-1.5 px-2.5 w-full rounded font-mono font-bold bg-white dark:bg-slate-950 ${
                          isInitialSlInvalid ? 'border-rose-500 ring-1 ring-rose-500' : ''
                        }`}
                        value={slPriceInput}
                        onChange={(e) => handleSlPriceChange(e.target.value)}
                        placeholder="0.00"
                      />
                      {isInitialSlInvalid && (
                        <span className="text-[8px] text-rose-500 font-black mt-1 block leading-tight">
                          {modalIsLong ? 'Must be less than Entry' : 'Must be greater than Entry'}
                        </span>
                      )}
                    </div>
                    <div className="form-field">
                      <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Stop Loss %</label>
                      <input
                        id="sl-pct-input"
                        type="number"
                        className={`grid-text-input py-1.5 px-2.5 w-full rounded font-mono font-bold bg-white dark:bg-slate-950 ${
                          isInitialSlInvalid ? 'border-rose-500 ring-1 ring-rose-500' : ''
                        }`}
                        value={slPctInput}
                        onChange={(e) => handleSlPctChange(e.target.value)}
                        placeholder="0.00%"
                        disabled={refEntryPrice <= 0}
                        title={refEntryPrice <= 0 ? "Enter Entry Price first to edit %" : ""}
                      />
                    </div>
                    <div className="form-field">
                      <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Max Cash Risk</label>
                      <input
                        id="sl-cash-input"
                        type="number"
                        className="grid-text-input py-1.5 px-2.5 w-full rounded font-mono font-bold bg-white dark:bg-slate-950"
                        value={slCashInput}
                        onChange={(e) => handleSlCashChange(e.target.value)}
                        placeholder={country === 'IN' ? '₹0.00' : '$0.00'}
                        disabled={refEntryPrice <= 0 || refQty <= 0}
                        title={refEntryPrice <= 0 || refQty <= 0 ? "Enter Entry Price and Quantity first to edit Cash Risk" : ""}
                      />
                    </div>
                  </div>
                  
                  {/* Trailing Stop Loss Input Row */}
                  <div className="grid grid-cols-1 gap-3 mt-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
                    <div className="form-field">
                      <label className="block mb-1 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Current / Trailing Stop Loss ({country === 'IN' ? '₹' : '$'})</label>
                      <div className="flex gap-3 items-center">
                        <div className="flex flex-col">
                          <input
                            type="number"
                            className={`grid-text-input py-1.5 px-2.5 w-32 rounded font-mono font-bold bg-white dark:bg-slate-950 text-xs ${
                              isCurrentSlInvalid ? 'border-rose-500 ring-1 ring-rose-500' : ''
                            }`}
                            value={formData.currentStopLoss || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => ({ ...prev, currentStopLoss: val ? Number(val) : '' }));
                            }}
                          />
                          {isCurrentSlInvalid && (
                            <span className="text-[8px] text-rose-500 font-black mt-1 block leading-tight">
                              {modalIsLong ? 'Must be less than Current' : 'Must be greater than Current'}
                            </span>
                          )}
                        </div>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold leading-snug">
                          💡 Set when trailing stops. Keeps the initial risk baseline (for R-Multiple) while updating active SL indicators.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sizing Risk & Investment feedback bar */}
                {sizingFeedback && (
                  <div className="p-2.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-950/45 border border-slate-200 dark:border-slate-850 flex items-center justify-between text-[10.5px] text-slate-700 dark:text-slate-200 font-semibold shadow-inner">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
                      SL Risk: <span className="text-rose-600 dark:text-rose-400 font-mono font-black">-{sizingFeedback.stopLossPct.toFixed(1)}%</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-500">|</span>
                    <span>
                      Max Exposure Risk: <span className="text-amber-700 dark:text-amber-400 font-mono font-black">{country === 'IN' ? '₹' : '$'}{sizingFeedback.cashRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-500">|</span>
                    <span>
                      Investment: <span className="text-sky-700 dark:text-sky-400 font-mono font-black">{country === 'IN' ? '₹' : '$'}{sizingFeedback.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EXIT & REVIEW */}
            {activeModalTab === 'exit' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="form-field">
                  <label className="block mb-1.5 text-[9.5px] font-extrabold text-slate-450 dark:text-slate-505 tracking-wide">Position Status</label>
                  <div className="flex bg-slate-100 dark:bg-slate-900/45 border border-slate-200 dark:border-slate-850 rounded-lg p-1 gap-1.5 w-full">
                    <div
                      role="button"
                      className={`flex-1 text-center py-2 text-xs font-black rounded-md cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                        !formData.isClosed 
                          ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200/50 dark:border-slate-700/20 shadow-sm' 
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, isClosed: false }))}
                    >
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Still Holding
                      </span>
                      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold px-2">I'm still in this trade. P&L tracks live.</span>
                    </div>
                    <div
                      role="button"
                      className={`flex-1 text-center py-2 text-xs font-black rounded-md cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                        formData.isClosed 
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-250 dark:border-amber-500/20 shadow-sm' 
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, isClosed: true }))}
                    >
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Closed / Exited
                      </span>
                      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold px-2">I've exited this trade. Enter exit details.</span>
                    </div>
                  </div>
                </div>

                {/* Open position info panel — shown when Still Holding */}
                {!formData.isClosed && (
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 tracking-wide">
                        📊 Open Position Summary
                      </div>
                      {showScalingForm && (formData.transactions?.length || 0) > 1 && (
                        <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700/40">
                          Scaled Position — using weighted avg
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Entry cost — uses refEntryPrice * refQty for accuracy */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Total Invested</span>
                        <span className="font-mono font-black text-[13px] text-slate-800 dark:text-slate-100">
                          {(() => {
                            const ep = refEntryPrice > 0 ? refEntryPrice : Number(formData.entryPrice || 0);
                            const qty = refQty > 0 ? refQty : Number(formData.qty || 0);
                            if (!ep || !qty) return <span className="text-slate-400 text-xs">—</span>;
                            return `${country === 'IN' ? '₹' : '$'}${(ep * qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                          })()}
                        </span>
                        {showScalingForm && refEntryPrice > 0 && (
                          <span className="text-[8px] text-slate-400 font-semibold">Avg entry: {country === 'IN' ? '₹' : '$'}{refEntryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {refQty} shares</span>
                        )}
                      </div>
                      {/* Live P&L — uses refEntryPrice and refQty */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Floating P&L (Live)</span>
                        <span className="font-mono font-black text-[13px]">
                          {(() => {
                            const ep = refEntryPrice > 0 ? refEntryPrice : Number(formData.entryPrice || 0);
                            const qty = refQty > 0 ? refQty : Number(formData.qty || 0);
                            const live = modalLivePrice;
                            if (!ep || !qty || !live) return <span className="text-slate-400 text-xs">Enter symbol to see live P&L</span>;
                            const pl = (live - ep) * qty;
                            const plPct = ((live - ep) / ep) * 100;
                            return (
                              <span className={pl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {pl >= 0 ? '+' : ''}{country === 'IN' ? '₹' : '$'}{Math.abs(pl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {' '}({pl >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                      {/* Max Risk if SL hits — uses refEntryPrice and refQty */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Max Risk if SL Hits</span>
                        <span className="font-mono font-black text-[13px]">
                          {(() => {
                            const ep = refEntryPrice > 0 ? refEntryPrice : Number(formData.entryPrice || 0);
                            const sl = Number(formData.currentStopLoss || formData.initialStopLoss || 0);
                            const qty = refQty > 0 ? refQty : Number(formData.qty || 0);
                            if (!ep || !sl || !qty) return <span className="text-slate-400 text-xs">—</span>;
                            const risk = Math.abs(ep - sl) * qty;
                            const riskPct = (Math.abs(ep - sl) / ep) * 100;
                            return (
                              <span className="text-rose-600 dark:text-rose-400">
                                -{country === 'IN' ? '₹' : '$'}{risk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {' '}({riskPct.toFixed(1)}%)
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                      {/* Live price */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 tracking-wide">Current Market Price</span>
                        <span className="font-mono font-black text-[13px] text-sky-700 dark:text-sky-400">
                          {modalLivePrice
                            ? `${country === 'IN' ? '₹' : '$'}${modalLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : <span className="text-slate-400 text-xs font-semibold">Enter ticker in Entry tab</span>
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {formData.isClosed && (
                  <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/5 flex flex-col gap-4 border-l-4 border-l-amber-500">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-field">
                        <label className="block mb-1 text-[9px] text-amber-755 dark:text-amber-450 font-bold tracking-wide">Exit Price ({country === 'IN' ? '₹' : '$'})</label>
                        <input
                          type="number"
                          className="grid-text-input py-2 px-3 w-full rounded-md font-mono font-semibold border-amber-300 dark:border-amber-500/30 bg-white dark:bg-slate-950/40"
                          value={formData.exitPrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, exitPrice: e.target.value }))}
                          placeholder="0.00"
                        />
                        {modalLivePrice && (
                          <div 
                            role="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, exitPrice: modalLivePrice.toString() }));
                              showToast(`Filled Exit Price with Live Price: ${country === 'IN' ? '₹' : '$'}${modalLivePrice}!`, "info");
                            }}
                            className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/10 w-fit"
                            title="Click to copy to Exit Price"
                          >
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Live Price: <span className="font-mono font-black">{country === 'IN' ? '₹' : '$'}{modalLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                      <div className="form-field">
                        <label className="block mb-1 text-[9px] text-amber-755 dark:text-amber-450 font-bold tracking-wide">Exit Date</label>
                        <input
                          type="date"
                          className="grid-text-input py-2 px-3 w-full rounded-md border-amber-300 dark:border-amber-500/30 bg-white dark:bg-slate-950/40"
                          value={formData.exitDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, exitDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="block mb-1 text-[9px] text-amber-755 dark:text-amber-450 font-bold tracking-wide">Post-Mortem & Reflections</label>
                      <textarea
                        className="grid-notes-input py-2 px-3 w-full rounded-md text-xs leading-relaxed bg-white dark:bg-slate-950/40"
                        value={formData.postMortem}
                        onChange={(e) => setFormData(prev => ({ ...prev, postMortem: e.target.value }))}
                        placeholder="What did you learn? Did you follow your stops and targets?"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SCALING (PYRAMIDING) */}
            {activeModalTab === 'scaling' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 flex flex-col gap-4">
                  {(formData.transactions || []).length > 0 ? (
                    <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto mb-1">
                      {formData.transactions.map((tx, idx) => (
                        <div key={tx.id || idx} className={`flex justify-between items-center text-[11px] py-2 px-2.5 rounded-lg mb-1 last:mb-0 ${
                          tx.type === 'Buy'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40'
                            : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40'
                        }`}>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black mr-2 ${
                              tx.type === 'Buy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {tx.type.toUpperCase()}
                            </span>
                            {tx.qty} @ {country === 'IN' ? '₹' : '$'}{tx.price.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-[8px] text-slate-400 dark:text-slate-450">{tx.date}</span>
                            <div 
                              role="button"
                              className="text-rose-600 dark:text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 font-black cursor-pointer text-[10px]"
                              onClick={() => handleRemoveExecution(tx.id)}
                            >
                              Remove
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold text-center py-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-md mb-1">
                      No scaling executions logged. Fill out adder below.
                    </div>
                  )}

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50/30 dark:bg-slate-950/30 flex flex-col gap-3 shadow-inner">
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Add Scale-In / Scale-Out Execution</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold tracking-wide">Transaction Type</label>
                        <select
                          className="select-control py-1.5 px-2 w-full rounded text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-semibold"
                          value={newExecution.type}
                          onChange={(e) => setNewExecution(prev => ({ ...prev, type: e.target.value }))}
                        >
                          <option value="Buy" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Buy (Scale In)</option>
                          <option value="Sell" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Sell (Scale Out)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold tracking-wide">Date</label>
                        <input
                          type="date"
                          className="grid-text-input py-1.5 px-2 w-full rounded bg-white dark:bg-slate-950 text-xs"
                          value={newExecution.date}
                          onChange={(e) => setNewExecution(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold tracking-wide">Price ({country === 'IN' ? '₹' : '$'})</label>
                        <input
                          id="pyramiding-price-input"
                          type="number"
                          className="grid-text-input py-1.5 px-2 w-full rounded font-mono bg-white dark:bg-slate-950 text-xs"
                          value={newExecution.price}
                          onChange={(e) => setNewExecution(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="0.00"
                        />
                        {modalLivePrice && (
                          <div 
                            role="button"
                            onClick={() => {
                              setNewExecution(prev => ({ ...prev, price: modalLivePrice.toString() }));
                              showToast(`Filled Transaction Price with Live Price: ${country === 'IN' ? '₹' : '$'}${modalLivePrice}!`, "info");
                            }}
                            className="mt-1 text-[9px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/10 w-fit"
                            title="Click to copy to Price"
                          >
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Live Price: <span className="font-mono font-black">{country === 'IN' ? '₹' : '$'}{modalLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block mb-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold tracking-wide">Qty (Shares)</label>
                        <input
                          type="number"
                          className="grid-text-input py-1.5 px-2 w-full rounded font-mono bg-white dark:bg-slate-950 text-xs"
                          value={newExecution.qty}
                          onChange={(e) => setNewExecution(prev => ({ ...prev, qty: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center pt-1">
                      <input
                        type="text"
                        className="grid-text-input py-1.5 px-2 flex-1 rounded bg-white dark:bg-slate-950 text-xs"
                        value={newExecution.reason}
                        onChange={(e) => setNewExecution(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Reason (e.g. Pivot Breakout, Scaling TP1)"
                      />
                      <div 
                        role="button"
                        className={`px-4 py-1.5 text-xs font-black rounded-lg text-white transition-all cursor-pointer shadow-md flex items-center justify-center gap-1 shrink-0 ${
                          Number(newExecution.price) > 0 && Number(newExecution.qty) > 0
                            ? (newExecution.type === 'Buy'
                                ? 'bg-emerald-600 dark:bg-emerald-500 hover:brightness-110 shadow-lg animate-[pulse_1.2s_ease-in-out_3]'
                                : 'bg-rose-600 dark:bg-rose-500 hover:brightness-110 shadow-lg animate-[pulse_1.2s_ease-in-out_3]')
                            : 'bg-[var(--primary)] hover:brightness-110'
                        }`}
                        onClick={handleAddExecution}
                      >
                        {newExecution.type === 'Buy' ? '+ Add Buy Entry' : '- Add Sell Exit'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: NOTES & CHART */}
            {activeModalTab === 'notes' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-855 bg-slate-50/30 dark:bg-slate-900/10 flex flex-col gap-4">
                  <div className="form-field">
                    <label className="block mb-1 text-[9px] text-slate-400 dark:text-slate-550 font-bold tracking-wide">Chart Snapshot (TradingView URL)</label>
                    <input
                      type="text"
                      className="grid-text-input py-2 px-3 w-full rounded-md text-xs bg-white dark:bg-slate-950"
                      value={formData.chartUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, chartUrl: e.target.value }))}
                      placeholder="e.g. https://www.tradingview.com/x/..."
                    />
                  </div>
                  <div className="form-field">
                    <label className="block mb-1 text-[9px] text-slate-400 dark:text-slate-550 font-bold tracking-wide">Entry Thesis & Motivation</label>
                    <textarea
                      className="grid-notes-input py-2 px-3 w-full rounded-md text-xs leading-relaxed h-32 resize-y bg-white dark:bg-slate-950"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Contraction support, 21EMA bounce breakout..."
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer Actions (Custom interactive divs) */}
          <div className="modal-actions modal-actions-mt flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <div 
              role="button"
              className="px-5 py-2.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/20 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
              onClick={() => {
                setShowModal(false);
                setEditingTradeId(null);
                setFormData(initialFormState);
                setShowScalingForm(false);
                setShowOptionalDetails(false);
                setActiveModalTab('entry');
                setShowSizer(false);
                setSizerRiskPct('1');
                setSizerRiskCash('');
                setSizerUseCash(false);
              }}
            >
              Cancel
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">(Ctrl + S to save)</span>
              <div 
                role="button"
                className="px-5 py-2.5 text-xs font-extrabold rounded-lg bg-[var(--primary)] text-white hover:brightness-110 shadow-lg hover:shadow-sky-500/10 transition-all cursor-pointer"
                onClick={handleSavePosition}
              >
                {editingTradeId ? 'Save Changes' : 'Log Trade Position'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* COLUMN CONFIGURATION MODAL */}
      {showConfigModal && (
        <Modal 
          isOpen={showConfigModal} 
          onClose={() => setShowConfigModal(false)} 
          title="Grid Configuration" 
          subtitle="Manage visible columns and their layout order for the Trading Journal"
        >
          <div className="flex flex-col gap-4 py-2">
            {/* Locked Symbol Column */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/60 opacity-60">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">Symbol</span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-black uppercase">Fixed Start</span>
              </div>
              <label className="switch cursor-not-allowed">
                <input type="checkbox" checked disabled />
                <span className="slider cursor-not-allowed opacity-50" />
              </label>
            </div>

            {/* Reorderable columns */}
            <div className="flex flex-col gap-2 border border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50/20 max-h-[350px] overflow-y-auto">
              {columnOrder.map((colKey, index) => {
                if (colKey === 'symbol' || colKey === 'actions') return null;
                const config = ALL_COLUMNS[colKey];
                const isVisible = columnVisibility[colKey];
                const isFirst = index === 1;
                const isLast = index === columnOrder.length - 2;

                return (
                  <div key={colKey} className="flex justify-between items-center bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-[var(--border)] shadow-sm hover:border-slate-300 dark:hover:border-slate-800 transition-colors animate-fadeIn">
                    <div className="flex items-center gap-3">
                      {/* Drag Handle Icon placeholder */}
                      <div className="text-slate-300 dark:text-slate-700 cursor-grab select-none">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                        </svg>
                      </div>

                      {/* Side-by-side Up / Down Reorder buttons */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-md border border-slate-200/50 dark:border-slate-800/40">
                        <div 
                          role="button"
                          onClick={() => !isFirst && moveColumn(index, 'up')}
                          className={`p-1 hover:bg-white dark:hover:bg-slate-800 rounded transition-all cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ${isFirst ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                          title="Move Up"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </div>
                        <div 
                          role="button"
                          onClick={() => !isLast && moveColumn(index, 'down')}
                          className={`p-1 hover:bg-white dark:hover:bg-slate-800 rounded transition-all cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ${isLast ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                          title="Move Down"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">{config.label}</div>
                      </div>
                    </div>

                    {/* Toggle Visibility switch */}
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={isVisible} 
                        onChange={() => setColumnVisibility(prev => ({ ...prev, [colKey]: !prev[colKey] }))}
                      />
                      <span className="slider" />
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Locked Actions Column */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/60 opacity-60">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">Actions</span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-black uppercase">Fixed End</span>
              </div>
              <label className="switch cursor-not-allowed">
                <input type="checkbox" checked disabled />
                <span className="slider cursor-not-allowed opacity-50" />
              </label>
            </div>
          </div>

          <div className="modal-footer flex justify-between gap-4 border-t border-[var(--border)] pt-4 mt-2">
            <div 
              role="button"
              className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors text-slate-700 dark:text-slate-355 cursor-pointer shadow-sm"
              onClick={() => {
                setColumnOrder(DEFAULT_COLUMN_ORDER);
                const initial = {};
                DEFAULT_COLUMN_ORDER.forEach(col => {
                  initial[col] = true;
                });
                setColumnVisibility(initial);
                setColumnWidths({});
                showToast("Grid settings reset to defaults!", "info");
              }}
            >
              Reset to Default
            </div>
            <div 
              role="button"
              className="px-5 py-2 font-black text-xs rounded-lg bg-[var(--primary)] text-white hover:brightness-110 cursor-pointer shadow transition-all"
              onClick={() => setShowConfigModal(false)}
            >
              Save & Apply
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
