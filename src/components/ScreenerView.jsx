import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchNseIpoDirectory, hydrateIpoMetricsList } from '../services/nseIpoService';
import { MovingAverageRibbon } from './MovingAverageRibbon';
import { MovingAverageFilter } from './StockGrid';
import { checkNumericFilterCondition } from '../utils/paramUtils';

export default function ScreenerView({
  country = 'IN',
  onSwitchCountry,
  _currentWeekKey,
  currentWeekStocks = {},
  onImportStocks,
  onNavigateToWatchlist,
  data,
}) {
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [hydrationProgress, setHydrationProgress] = useState({ current: 0, total: 0 });
  const [rawIpos, setRawIpos] = useState([]);
  const [hydratedIpos, setHydratedIpos] = useState([]);
  const [selectedSymbols, setSelectedSymbols] = useState(new Set());
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [priceTrendFilter, setPriceTrendFilter] = useState(null); // 'up' | 'down' | null
  const [setupFilter, setSetupFilter] = useState('ALL'); // ALL, IPO_BASE, TIGHT_VCP, ABOVE_MAS
  const [ageFilter, setAgeFilter] = useState('365'); // 30, 60, 180, 365
  const [seriesFilter, setSeriesFilter] = useState('ALL'); // ALL, EQ, SM
  const [adrFilter, setAdrFilter] = useState(''); // Free-form numeric filter (e.g. >5, 3-5, <=4)
  const [liquidityFilter, setLiquidityFilter] = useState(''); // Free-form turnover filter (e.g. >50, 50-60, >=20)
  const [maConditions, setMaConditions] = useState({});
  const [sortBy, setSortBy] = useState('listing_desc'); // listing_desc, listing_asc, change_desc, adr_desc, liquidity_desc, listing_gain_desc, since_listing_desc, symbol_asc
  
  // UI & Pagination states
  const [showDrawer, setShowDrawer] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [justImportedCount, setJustImportedCount] = useState(null);
  const [isProgressMinimized, setIsProgressMinimized] = useState(false);
  const drawerRef = useRef(null);
  const isHydratingRef = useRef(false);

  // Sync paramDefs & config without triggering full hydration loops
  const paramDefsRef = useRef(data?.paramDefinitions || null);
  const adrDaysRef = useRef(data?.uiConfig?.adrDays || 20);
  const liquidityDaysRef = useRef(data?.uiConfig?.liquidityDays || 20);

  useEffect(() => {
    paramDefsRef.current = data?.paramDefinitions || null;
    adrDaysRef.current = data?.uiConfig?.adrDays || 20;
    liquidityDaysRef.current = data?.uiConfig?.liquidityDays || 20;
  }, [data?.paramDefinitions, data?.uiConfig?.adrDays, data?.uiConfig?.liquidityDays]);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showDrawer) {
        setShowDrawer(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDrawer]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (showDrawer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showDrawer]);

  // 1. Initial Load / Refresh Handler (Stabilized: depends ONLY on country to prevent continuous loops)
  const loadDirectoryAndHydrate = useCallback(async (forceRefresh = false) => {
    if (country !== 'IN') return;
    if (isHydratingRef.current) return;
    isHydratingRef.current = true;

    setLoadingDirectory(true);
    setErrorMessage(null);
    setJustImportedCount(null);

    try {
      const directory = await fetchNseIpoDirectory(forceRefresh);
      setRawIpos(directory);
      setLoadingDirectory(false);
      setLastScanTime(new Date());

      // Hydrate metrics from candle data
      if (directory.length > 0) {
        setHydrating(true);
        setHydrationProgress({ current: 0, total: directory.length });

        // Initialize hydrated map with default items so table renders immediately
        const initialHydrated = directory.map((d) => ({ ...d }));
        setHydratedIpos(initialHydrated);

        const paramDefs = paramDefsRef.current;
        const adrDays = adrDaysRef.current;
        const liquidityDays = liquidityDaysRef.current;

        const hydrated = await hydrateIpoMetricsList(
          directory,
          'IN',
          (current, total, batchHydratedMap) => {
            setHydrationProgress({ current, total });
            if (batchHydratedMap && Object.keys(batchHydratedMap).length > 0) {
              setHydratedIpos((prev) => {
                const prevMap = new Map((prev || []).map((item) => [item.symbol, item]));
                Object.entries(batchHydratedMap).forEach(([sym, updatedItem]) => {
                  prevMap.set(sym, updatedItem);
                });
                return directory.map((d) => prevMap.get(d.symbol) || d);
              });
            }
          },
          paramDefs,
          adrDays,
          liquidityDays,
          forceRefresh
        );

        setHydratedIpos(hydrated);
        setHydrating(false);
      } else {
        setHydratedIpos([]);
        setHydrating(false);
      }
    } catch (err) {
      console.error('[ScreenerView] Error loading directory:', err);
      setErrorMessage(err.message || 'Failed to fetch NSE IPO directory.');
      setLoadingDirectory(false);
      setHydrating(false);
    } finally {
      isHydratingRef.current = false;
    }
  }, [country]);

  useEffect(() => {
    if (country === 'IN') {
      Promise.resolve().then(() => {
        loadDirectoryAndHydrate(false);
      });
    }
  }, [country, loadDirectoryAndHydrate]);

  // Advances & Declines computation
  const advancesAndDeclines = useMemo(() => {
    const source = hydratedIpos.length > 0 ? hydratedIpos : rawIpos;
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let totalWithQuotes = 0;

    source.forEach((item) => {
      if (item.dailyChangeNum !== undefined && item.dailyChangeNum !== null && !isNaN(item.dailyChangeNum)) {
        totalWithQuotes++;
        if (item.dailyChangeNum > 0) advances++;
        else if (item.dailyChangeNum < 0) declines++;
        else unchanged++;
      }
    });

    return { advances, declines, unchanged, total: totalWithQuotes };
  }, [hydratedIpos, rawIpos]);

  // Dynamic counts for criteria
  const counts = useMemo(() => {
    const source = hydratedIpos.length > 0 ? hydratedIpos : rawIpos;
    let ipoBases = 0;
    let tightVcps = 0;
    let aboveMas = 0;
    let adrGt5 = 0;
    let adr3To5 = 0;
    let adrLt3 = 0;
    let liqGte50 = 0;
    let liqGte20 = 0;
    let liqGte10 = 0;
    let liqGte2 = 0;

    source.forEach((item) => {
      if (item.isIpoBase) ipoBases++;
      if (item.vcpTight) tightVcps++;
      if (item.above10 && item.above21) aboveMas++;

      const adrVal = item.adrNum;
      if (adrVal !== null && adrVal !== undefined && !isNaN(adrVal)) {
        if (adrVal > 5) adrGt5++;
        else if (adrVal >= 3) adr3To5++;
        else if (adrVal > 0) adrLt3++;
      }

      const turnoverVal = item.turnoverCr;
      if (turnoverVal !== null && turnoverVal !== undefined && !isNaN(turnoverVal)) {
        if (turnoverVal >= 50) liqGte50++;
        if (turnoverVal >= 20) liqGte20++;
        if (turnoverVal >= 10) liqGte10++;
        if (turnoverVal >= 2) liqGte2++;
      }
    });

    return {
      all: source.length,
      ipoBases,
      tightVcps,
      aboveMas,
      adrGt5,
      adr3To5,
      adrLt3,
      liqGte50,
      liqGte20,
      liqGte10,
      liqGte2,
    };
  }, [hydratedIpos, rawIpos]);

  // Display items filtering
  const displayItems = useMemo(() => {
    const source = hydratedIpos.length > 0 ? hydratedIpos : rawIpos;

    return source.filter((item) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesSymbol = item.symbol?.toLowerCase().includes(q);
        const matchesName = item.name?.toLowerCase().includes(q);
        if (!matchesSymbol && !matchesName) return false;
      }

      // 2. Price trend filter (Advances / Declines)
      if (priceTrendFilter === 'up' && !(item.dailyChangeNum > 0)) return false;
      if (priceTrendFilter === 'down' && !(item.dailyChangeNum < 0)) return false;

      // 3. Age filter
      const maxAge = parseInt(ageFilter, 10);
      if (!isNaN(maxAge) && item.daysAgo > maxAge) {
        return false;
      }

      // 4. Series filter
      if (seriesFilter === 'EQ' && item.isSme) return false;
      if (seriesFilter === 'SM' && !item.isSme) return false;

      // 5. Setup criteria
      if (setupFilter === 'IPO_BASE' && !item.isIpoBase) return false;
      if (setupFilter === 'TIGHT_VCP' && !item.vcpTight) return false;
      if (setupFilter === 'ABOVE_MAS' && !(item.above10 && item.above21)) return false;

      // 6. MA conditions filter
      const maKeys = Object.keys(maConditions || {});
      if (maKeys.length > 0) {
        for (const ma of maKeys) {
          const mode = maConditions[ma];
          if (ma === '10') {
            if (mode === 'above' && !item.above10) return false;
            if (mode === 'below' && item.above10) return false;
          } else if (ma === '21') {
            if (mode === 'above' && !item.above21) return false;
            if (mode === 'below' && item.above21) return false;
          } else if (ma === '50') {
            if (mode === 'above' && !item.above50) return false;
            if (mode === 'below' && item.above50) return false;
          }
        }
      }

      // 7. ADR Volatility free-form filter (supports >5, 3-5, <=4, etc.)
      if (adrFilter.trim() && !checkNumericFilterCondition(item.adrNum, adrFilter)) {
        return false;
      }

      // 8. Liquidity Turnover free-form filter (supports >50, 50-60, >=20, etc.)
      if (liquidityFilter.trim() && !checkNumericFilterCondition(item.turnoverCr, liquidityFilter)) {
        return false;
      }

      return true;
    });
  }, [hydratedIpos, rawIpos, searchQuery, priceTrendFilter, ageFilter, seriesFilter, setupFilter, adrFilter, liquidityFilter, maConditions]);

  // Sorted items
  const sortedItems = useMemo(() => {
    const list = [...displayItems];

    list.sort((a, b) => {
      // Symbol
      if (sortBy === 'symbol_asc') return (a.symbol || '').localeCompare(b.symbol || '');
      if (sortBy === 'symbol_desc') return (b.symbol || '').localeCompare(a.symbol || '');

      // Listing Date (default is listing_desc)
      if (sortBy === 'listing_desc') return b.listingTimestamp - a.listingTimestamp;
      if (sortBy === 'listing_asc') return a.listingTimestamp - b.listingTimestamp;

      // Price & Day %
      if (sortBy === 'change_desc') return (b.dailyChangeNum ?? -999) - (a.dailyChangeNum ?? -999);
      if (sortBy === 'change_asc') return (a.dailyChangeNum ?? 999) - (b.dailyChangeNum ?? 999);

      // ADR %
      if (sortBy === 'adr_desc') return (b.adrNum ?? -999) - (a.adrNum ?? -999);
      if (sortBy === 'adr_asc') return (a.adrNum ?? 999) - (b.adrNum ?? 999);

      // Liquidity Turnover
      if (sortBy === 'liquidity_desc') return (b.turnoverCr ?? -999) - (a.turnoverCr ?? -999);
      if (sortBy === 'liquidity_asc') return (a.turnoverCr ?? 999) - (b.turnoverCr ?? 999);

      // Listing Day Gain
      if (sortBy === 'listing_gain_desc') return (b.listingDayGainNum ?? -999) - (a.listingDayGainNum ?? -999);
      if (sortBy === 'listing_gain_asc') return (a.listingDayGainNum ?? 999) - (b.listingDayGainNum ?? 999);

      // Gain Since Listing Day
      if (sortBy === 'since_listing_desc') return (b.gainSinceListingNum ?? -999) - (a.gainSinceListingNum ?? -999);
      if (sortBy === 'since_listing_asc') return (a.gainSinceListingNum ?? 999) - (b.gainSinceListingNum ?? 999);

      return 0;
    });

    return list;
  }, [displayItems, sortBy]);

  // Header sort toggle handler
  const handleSortToggle = (colKey) => {
    setSortBy((prev) => {
      if (colKey === 'symbol') {
        if (prev === 'symbol_asc') return 'symbol_desc';
        if (prev === 'symbol_desc') return 'listing_desc';
        return 'symbol_asc';
      }
      if (colKey === 'listing') {
        if (prev === 'listing_desc') return 'listing_asc';
        return 'listing_desc';
      }
      const descKey = `${colKey}_desc`;
      const ascKey = `${colKey}_asc`;
      if (prev === descKey) return ascKey;
      if (prev === ascKey) return 'listing_desc';
      return descKey;
    });
    setCurrentPage(1);
  };

  const renderSortIndicator = (colKey) => {
    const isDesc = sortBy === `${colKey}_desc`;
    const isAsc = sortBy === `${colKey}_asc`;
    if (isDesc) {
      return <span className="text-blue-500 dark:text-blue-400 font-bold ml-1 text-[11px]">▼</span>;
    }
    if (isAsc) {
      return <span className="text-blue-500 dark:text-blue-400 font-bold ml-1 text-[11px]">▲</span>;
    }
    return (
      <span className="text-[var(--muted-foreground)] opacity-25 group-hover:opacity-75 transition-opacity ml-1 text-[10px]">
        ⇅
      </span>
    );
  };

  // Active filters count & list
  const activeFilters = useMemo(() => {
    const filters = [];
    if (priceTrendFilter === 'up') filters.push({ key: 'trend', label: 'Trend: Advances', clear: () => setPriceTrendFilter(null) });
    if (priceTrendFilter === 'down') filters.push({ key: 'trend', label: 'Trend: Declines', clear: () => setPriceTrendFilter(null) });
    if (ageFilter !== '365') {
      const label = ageFilter === '30' ? 'Age: Last 30 Days' : ageFilter === '60' ? 'Age: Last 60 Days' : 'Age: Last 180 Days';
      filters.push({ key: 'age', label, clear: () => setAgeFilter('365') });
    }
    if (seriesFilter !== 'ALL') {
      filters.push({ key: 'series', label: seriesFilter === 'EQ' ? 'Series: Mainboard (EQ)' : 'Series: SME (SM)', clear: () => setSeriesFilter('ALL') });
    }
    if (setupFilter !== 'ALL') {
      const label = setupFilter === 'IPO_BASE' ? 'Setup: IPO Base' : setupFilter === 'TIGHT_VCP' ? 'Setup: Tight VCP' : 'Setup: Above 10, 20 EMA';
      filters.push({ key: 'setup', label, clear: () => setSetupFilter('ALL') });
    }
    if (adrFilter.trim()) {
      filters.push({ key: 'adr', label: `ADR: ${adrFilter.trim()}%`, clear: () => setAdrFilter('') });
    }
    if (liquidityFilter.trim()) {
      filters.push({ key: 'liquidity', label: `Liquidity: ${liquidityFilter.trim()} Cr`, clear: () => setLiquidityFilter('') });
    }
    if (Object.keys(maConditions).length > 0) {
      filters.push({ key: 'ma', label: 'Moving Averages Filter', clear: () => setMaConditions({}) });
    }
    if (searchQuery.trim()) {
      filters.push({ key: 'search', label: `Search: "${searchQuery}"`, clear: () => setSearchQuery('') });
    }
    return filters;
  }, [priceTrendFilter, ageFilter, seriesFilter, setupFilter, adrFilter, liquidityFilter, maConditions, searchQuery]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setPriceTrendFilter(null);
    setAgeFilter('365');
    setSeriesFilter('ALL');
    setSetupFilter('ALL');
    setAdrFilter('');
    setLiquidityFilter('');
    setMaConditions({});
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Selection handlers
  const handleToggleSelect = (symbol) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedSymbols.size === sortedItems.length && sortedItems.length > 0) {
      setSelectedSymbols(new Set());
    } else {
      setSelectedSymbols(new Set(sortedItems.map((i) => i.symbol)));
    }
  };

  // Import Handler
  const handleImportSelected = () => {
    const selectedList = sortedItems.filter((i) => selectedSymbols.has(i.symbol));
    if (selectedList.length === 0) return;

    if (onImportStocks) {
      onImportStocks(selectedList);
      setJustImportedCount(selectedList.length);
      setSelectedSymbols(new Set());
    }
  };

  /* =========================================================================
     US PLACEHOLDER VIEW (Clean, Shippable State)
     ========================================================================= */
  if (country === 'US') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-8 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5 text-3xl shadow-inner">
          🇺🇸
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 text-xs font-semibold mb-3">
          <span>⚡ Under Active Development</span>
        </div>
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
          US IPO Radar Coming Soon (v3.2)
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6">
          We are currently integrating automated SEC EDGAR &amp; NASDAQ/NYSE IPO feeds for US equities.
          In the meantime, the 1-Year IPO Master Radar is fully live and hydrated for Indian Equities (NSE Mainboard &amp; SME).
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSwitchCountry && onSwitchCountry('IN')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Switch to India (NSE) Radar</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================================
     INDIA (NSE) IPO MASTER RADAR VIEW
     ========================================================================= */
  const isAllSelected = sortedItems.length > 0 && selectedSymbols.size === sortedItems.length;
  const isPartiallySelected = selectedSymbols.size > 0 && selectedSymbols.size < sortedItems.length;

  return (
    <div className="w-full space-y-3 font-sans pb-8">
      {/* 1. TOP COMMAND BAR (Matches StockGrid Pattern) */}
      <div className="grid-header">
        {/* Left Wing: Title + Status + Text on top + Last Synced + Advances & Declines + Refresh Button */}
        <div className="command-left">
          <div className="flex items-center gap-2 mr-2 flex-wrap">
            <span className="font-bold text-xs text-[var(--foreground)] tracking-tight">IPO Master Radar</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
              NSE Official
            </span>
            <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
              ({counts.all} stocks • 1-Year Master Record)
            </span>
          </div>

          <div className="last-updated-note flex items-center gap-2 text-[11px] text-[var(--muted-foreground)] font-medium py-1">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong className="text-[var(--foreground)] font-bold">Last synced:</strong>{' '}
                {lastScanTime
                  ? lastScanTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </span>
            </div>

            {/* Interactive Advances & Declines badges */}
            {advancesAndDeclines.total > 0 && (
              <div className="advances-declines-summary flex items-center gap-1.5 ml-2 pl-2 border-l border-[var(--border)]">
                <span
                  className={`advances-badge-interactive ${priceTrendFilter === 'up' ? 'active-up' : ''}`}
                  onClick={() => {
                    setPriceTrendFilter((prev) => (prev === 'up' ? null : 'up'));
                    setCurrentPage(1);
                  }}
                  title="Filter by Advances (Price Up)"
                >
                  ▲ {advancesAndDeclines.advances}
                </span>
                <span
                  className={`declines-badge-interactive ${priceTrendFilter === 'down' ? 'active-down' : ''}`}
                  onClick={() => {
                    setPriceTrendFilter((prev) => (prev === 'down' ? null : 'down'));
                    setCurrentPage(1);
                  }}
                  title="Filter by Declines (Price Down)"
                >
                  ▼ {advancesAndDeclines.declines}
                </span>
                {advancesAndDeclines.unchanged > 0 && (
                  <span
                    className="text-[var(--muted-foreground)] font-semibold text-[11px] cursor-default select-none"
                    title="Unchanged"
                  >
                    ■ {advancesAndDeclines.unchanged}
                  </span>
                )}
              </div>
            )}

            {/* Force Refresh Button */}
            <button
              className={`force-sync-btn ${loadingDirectory || hydrating ? 'is-syncing' : ''}`}
              onClick={() => loadDirectoryAndHydrate(true)}
              disabled={loadingDirectory || hydrating}
              title={loadingDirectory || hydrating ? 'Syncing in progress...' : 'Force rescan official NSE archives and rehydrate metrics'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={loadingDirectory || hydrating ? 'animate-spin' : ''}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Wing: Primary CTA + Search Box + Drawer Funnel Button */}
        <div className="command-right">
          {/* Top Import CTA (Always on top for enterprise UX) */}
          <button
            onClick={handleImportSelected}
            disabled={selectedSymbols.size === 0}
            className={`action-pill font-semibold text-xs transition-all flex items-center gap-1.5 ${
              selectedSymbols.size > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm !border-blue-500 cursor-pointer'
                : 'opacity-40 pointer-events-none'
            }`}
            title={selectedSymbols.size > 0 ? `Import ${selectedSymbols.size} selected stock(s)` : 'Select stocks from table to import'}
          >
            <span>＋</span>
            <span>Tag &amp; Import ({selectedSymbols.size}) to Current Week</span>
          </button>

          {onNavigateToWatchlist && (
            <button
              onClick={onNavigateToWatchlist}
              className="action-pill text-xs hover:text-blue-600 transition-colors"
              title="View IPO Watchlist"
            >
              <span>View Watchlist →</span>
            </button>
          )}

          {/* Search Box */}
          <div className="search-box-v2">
            <span className="search-icon-v2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search symbols or company..."
              aria-label="Search symbols or company"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                title="Clear search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Right-Hand Filter Drawer Button */}
          <button
            type="button"
            className={`action-pill funnel-filter-btn ${activeFilters.length > 0 ? 'active' : ''}`}
            onClick={() => setShowDrawer(true)}
            title="Open Screener Filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="icon-14"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
            {activeFilters.length > 0 && (
              <span className="funnel-badge">{activeFilters.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* 2. ACTIVE FILTERS SUMMARY BAR */}
      {activeFilters.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--panel)] border border-[var(--border)] text-xs flex-wrap animate-fadeIn">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--muted-foreground)] font-medium">Active filters:</span>
            {activeFilters.map((f) => (
              <span
                key={f.key + f.label}
                className="active-filter-chip"
              >
                <span>{f.label}</span>
                <button
                  type="button"
                  onClick={f.clear}
                  className="chip-remove-btn"
                  title="Remove filter"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <button
            className="drawer-reset-btn text-xs"
            onClick={handleClearAllFilters}
            title="Clear all active filters"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* 3. STREAMING HYDRATION PROGRESS BAR (Minimizable) */}
      {hydrating && (
        isProgressMinimized ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3.5 py-1.5 flex items-center justify-between text-xs transition-all">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[var(--foreground)] text-[11px] font-medium">Hydrating metrics:</span>
              <span className="font-mono text-blue-600 dark:text-cyan-300 font-semibold text-[11px]">
                {hydrationProgress.current} / {hydrationProgress.total} stocks ({Math.round((hydrationProgress.current / Math.max(hydrationProgress.total, 1)) * 100)}%)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-28 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-300 ease-out"
                  style={{
                    width: `${(hydrationProgress.current / Math.max(hydrationProgress.total, 1)) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsProgressMinimized(false)}
                className="text-[11px] text-blue-500 hover:text-blue-400 font-medium cursor-pointer flex items-center gap-1 hover:underline"
                title="Expand progress bar"
              >
                <span>Expand</span>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-blue-600 dark:text-blue-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Hydrating live metrics (Price, ADR, MAs, VCP, Bases, Listing Gains)...
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-blue-600 dark:text-cyan-300 font-semibold">
                  {hydrationProgress.current} / {hydrationProgress.total} stocks
                </span>
                <button
                  type="button"
                  onClick={() => setIsProgressMinimized(true)}
                  className="text-[11px] text-blue-500 hover:text-blue-400 font-medium cursor-pointer flex items-center gap-1 hover:underline"
                  title="Minimize progress bar"
                >
                  <span>Minimize</span>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{
                  width: `${(hydrationProgress.current / Math.max(hydrationProgress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-500 dark:text-red-400 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Import Toast */}
      {justImportedCount !== null && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>
              Successfully imported <strong>{justImportedCount}</strong> IPO stock{justImportedCount > 1 ? 's' : ''} into Current Week&apos;s IPO Watchlist!
            </span>
          </div>
          {onNavigateToWatchlist && (
            <button
              onClick={onNavigateToWatchlist}
              className="underline hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold cursor-pointer"
            >
              Go to Watchlist →
            </button>
          )}
        </div>
      )}

      {/* 4. MAIN DATA TABLE CONTAINER */}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] themed-scroll">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--table-header-bg,var(--panel))] sticky top-0 z-10 border-b border-[var(--border)] text-[var(--muted-foreground)] text-xs font-semibold">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center select-none" onClick={(e) => e.stopPropagation()}>
                  <label
                    className="inline-flex items-center justify-center cursor-pointer p-0.5"
                    title={isAllSelected ? 'Deselect all filtered stocks' : 'Select all filtered stocks'}
                  >
                    <input
                      type="checkbox"
                      id="screener-select-all-checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onChange={handleSelectAllFiltered}
                      aria-label="Select all filtered stocks"
                      className="sr-only"
                    />
                    <div
                      className={`rounded flex items-center justify-center transition-all ${
                        isAllSelected
                          ? 'bg-blue-600 border border-blue-600 text-white shadow-sm'
                          : isPartiallySelected
                          ? 'bg-blue-600/20 border border-blue-500 text-blue-500'
                          : 'border-[1.5px] border-slate-400 dark:border-slate-500 bg-transparent hover:border-blue-500'
                      }`}
                      style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }}
                    >
                      {isAllSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {!isAllSelected && isPartiallySelected && (
                        <svg
                          className="w-3 h-3 text-blue-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                    </div>
                  </label>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('symbol')}
                  title="Click to sort by Symbol (A-Z / Z-A)"
                >
                  <div className="flex items-center gap-1">
                    <span>Symbol</span>
                    {renderSortIndicator('symbol')}
                  </div>
                </th>
                <th className="py-3 px-3">Company Name</th>
                <th className="py-3 px-2">Series</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('listing')}
                  title="Click to sort by Listing Date (Newest / Oldest)"
                >
                  <div className="flex items-center gap-1">
                    <span>Listing Date</span>
                    {renderSortIndicator('listing')}
                  </div>
                </th>
                <th className="py-3 px-2">Age</th>
                <th className="py-3 px-3">Pattern / Tag</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('change')}
                  title="Click to sort by % Day Change (Highest / Lowest)"
                >
                  <div className="flex items-center gap-1">
                    <span>Price &amp; Day %</span>
                    {renderSortIndicator('change')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('listing_gain')}
                  title="Click to sort by Day 1 Listing Gain (Highest / Lowest)"
                >
                  <div className="flex items-center gap-1">
                    <span>Listing Gain</span>
                    {renderSortIndicator('listing_gain')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('since_listing')}
                  title="Click to sort by Gain Since Listing Day Close (Highest / Lowest)"
                >
                  <div className="flex items-center gap-1">
                    <span>Since Listing</span>
                    {renderSortIndicator('since_listing')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('adr')}
                  title="Click to sort by ADR Volatility % (Highest / Lowest)"
                >
                  <div className="flex items-center gap-1">
                    <span>ADR</span>
                    {renderSortIndicator('adr')}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--foreground)] transition-colors group select-none"
                  onClick={() => handleSortToggle('liquidity')}
                  title="Click to sort by Daily Turnover / Liquidity (Highest / Lowest)"
                >
                  <div className="flex items-center gap-1">
                    <span>Liquidity</span>
                    {renderSortIndicator('liquidity')}
                  </div>
                </th>
                <th className="py-3 px-3">Moving Averages</th>
                <th className="py-3 px-3">VCP Tightness</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70 text-xs">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-[var(--muted-foreground)]">
                    {loadingDirectory ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl animate-spin">🔄</span>
                        <span className="font-medium text-sm">Scanning official NSE archives...</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-[var(--foreground)]">No IPOs matched your active criteria.</p>
                        <p className="text-xs">Try adjusting your filters in the right-hand panel or extending the listing age window.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isSelected = selectedSymbols.has(item.symbol);
                  const inCurrentWeek = Boolean(currentWeekStocks[item.symbol]);
                  const isChangePositive = item.dailyChangeNum > 0;
                  const isChangeNegative = item.dailyChangeNum < 0;

                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => handleToggleSelect(item.symbol)}
                      className={`cursor-pointer transition-colors duration-150 hover:bg-blue-500/5 ${
                        isSelected ? 'bg-blue-500/10 dark:bg-blue-500/15' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-2.5 px-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label
                          className="inline-flex items-center justify-center cursor-pointer p-0.5"
                          title={isSelected ? `Deselect ${item.symbol}` : `Select ${item.symbol}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.symbol)}
                            className="sr-only"
                            aria-label={`Select ${item.symbol}`}
                          />
                          <div
                            className={`rounded flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-blue-600 border border-blue-600 text-white shadow-sm'
                                : 'border-[1.5px] border-slate-400 dark:border-slate-500 bg-transparent hover:border-blue-500'
                            }`}
                            style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </label>
                      </td>

                      {/* Symbol */}
                      <td className="py-2.5 px-3 font-bold text-[var(--foreground)] tracking-wide font-mono text-[13px]">
                        {item.symbol}
                      </td>

                      {/* Company Name */}
                      <td className="py-2.5 px-3 text-[var(--muted-foreground)] truncate max-w-[220px]" title={item.name}>
                        {item.name}
                      </td>

                      {/* Series Badge */}
                      <td className="py-2.5 px-2">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] rounded font-mono font-semibold ${
                            item.isSme
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                              : 'bg-slate-200 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600/30'
                          }`}
                        >
                          {item.series || (item.isSme ? 'SM' : 'EQ')}
                        </span>
                      </td>

                      {/* Listing Date */}
                      <td
                        className="py-2.5 px-3 font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap"
                        title={
                          item.isSmeMigration
                            ? `Migrated to Main Board (Series EQ) on ${item.listingDateStr} (Prior SME listing)`
                            : `Listed on ${item.listingDateStr}`
                        }
                      >
                        {item.listingDateStr}
                      </td>

                      {/* Age */}
                      <td
                        className="py-2.5 px-2 font-mono font-semibold text-cyan-600 dark:text-cyan-400 text-xs"
                        title={
                          item.isSmeMigration
                            ? `${item.daysAgo}d on NSE Mainboard (${item.validDaysCount} trading days of total history)`
                            : `${item.daysAgo} days since listing`
                        }
                      >
                        {item.daysAgo}d
                      </td>

                      {/* Pattern / Tag Badge (Clean, enterprise grade - no fancy emojis/stars) */}
                      <td className="py-2.5 px-3">
                        {item.isIpoBase ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                            {item.ipoStatus ? item.ipoStatus.replace(/^[★\s]+/, '') : 'IPO Base'}
                          </span>
                        ) : item.isSmeMigration ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[10px] font-semibold"
                            title={`Migrated from NSE Emerge (SME) to Main Board (EQ) on ${item.listingDateStr}`}
                          >
                            SME Migration
                          </span>
                        ) : item.daysAgo < 60 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-500/15 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-[10px] font-semibold">
                            Young IPO
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-500/15 border border-slate-500/30 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                            Recent Listing
                          </span>
                        )}
                      </td>

                      {/* Price & Change */}
                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-semibold text-[var(--foreground)] text-xs">
                          {item.price || '—'}
                        </div>
                        <div
                          className={`text-[10px] font-semibold ${
                            isChangePositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isChangeNegative
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[var(--muted-foreground)]'
                          }`}
                        >
                          {item.dailyChangePct || '0.00%'}
                        </div>
                      </td>

                      {/* Listing Day Gain */}
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={`font-semibold text-xs ${
                            item.listingDayGainNum > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.listingDayGainNum < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[var(--muted-foreground)]'
                          }`}
                          title={
                            item.listingDayOpen && item.listingDayClose
                              ? `Day 1 Open: ₹${item.listingDayOpen.toFixed(2)} → Day 1 Close: ₹${item.listingDayClose.toFixed(2)}`
                              : undefined
                          }
                        >
                          {item.listingDayGainPct || '—'}
                        </span>
                      </td>

                      {/* Gain Since Listing */}
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={`font-semibold text-xs ${
                            item.gainSinceListingNum > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.gainSinceListingNum < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[var(--muted-foreground)]'
                          }`}
                          title={
                            item.listingDayClose && item.priceVal
                              ? `Listing Day Close: ₹${item.listingDayClose.toFixed(2)} → Current: ₹${item.priceVal.toFixed(2)}`
                              : undefined
                          }
                        >
                          {item.gainSinceListingPct || '—'}
                        </span>
                      </td>

                      {/* ADR */}
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className="font-semibold text-[var(--foreground)] text-xs"
                          title={
                            item.adrNum > 0
                              ? `ADR: ${item.adrNum.toFixed(2)}% (${item.effectiveAdrDays || item.validDaysCount || 20}d avg)`
                              : undefined
                          }
                        >
                          {typeof item.adr === 'string' && item.adr.includes('%')
                            ? item.adr
                            : item.adr && item.adr !== 'N/A'
                            ? `${item.adr}%`
                            : item.adrNum
                            ? `${item.adrNum.toFixed(1)}%`
                            : '—'}
                        </span>
                      </td>

                      {/* Liquidity */}
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className="font-semibold text-[var(--foreground)] text-xs"
                          title={
                            item.turnoverCr > 0
                              ? `Daily Turnover: ₹${item.turnoverCr >= 1 ? `${item.turnoverCr.toFixed(2)}Cr` : `${(item.turnoverCr * 100).toFixed(0)}L`}/day (${item.effectiveLiqDays || item.validDaysCount || 20}d avg)`
                              : undefined
                          }
                        >
                          {item.liquidity || (item.turnoverCr > 0 ? `₹${item.turnoverCr.toFixed(1)}Cr` : '—')}
                        </span>
                      </td>

                      {/* Moving Averages (Centralized MovingAverageRibbon) */}
                      <td className="py-2.5 px-3">
                        <MovingAverageRibbon value={item.movingAverages} variant="compact" />
                      </td>

                      {/* VCP Tightness */}
                      <td className="py-2.5 px-3 font-mono">
                        {item.vcpTight ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                            {item.vcp || 'Tight'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--muted-foreground)]">
                            {item.vcp || '—'}
                          </span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-2.5 px-3 text-right">
                        {inCurrentWeek ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold">
                            In Watchlist
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)] opacity-40 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. BOTTOM PAGINATION BAR (Exact StockGrid Styling) */}
        <div className="pagination-bar">
          <div className="pagination-left">
            <div className="page-size">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination-nav-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  title="Previous Page"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="pagination-nav-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  title="Next Page"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}

            <span className="total-count">
              <strong>Total Stocks: {sortedItems.length}</strong>
              {selectedSymbols.size > 0 && ` (${selectedSymbols.size} selected)`}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
         RIGHT-HAND SLIDE-OVER FILTER DRAWER
         ===================================================================== */}
      {showDrawer && (
        <div
          className="watchlist-filter-drawer-backdrop"
          onClick={() => setShowDrawer(false)}
        >
          <div
            className="watchlist-filter-drawer-panel"
            ref={drawerRef}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Screener Filters"
          >
            {/* DRAWER HEADER */}
            <div className="drawer-header">
              <div className="drawer-title-group">
                <span className="drawer-funnel-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                </span>
                <div>
                  <h3 className="drawer-title">Screener Filters</h3>
                  <p className="drawer-subtitle">Refine IPO candidates &amp; setups</p>
                </div>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => setShowDrawer(false)}
                title="Close filter panel (Esc)"
                aria-label="Close filters"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ACTION BAR: ACTIVE COUNT + CLEAR ALL */}
            <div className="drawer-action-bar">
              <span className="drawer-active-count">
                Active: <strong>{activeFilters.length}</strong> filter{activeFilters.length === 1 ? '' : 's'}
              </span>
              {activeFilters.length > 0 && (
                <button
                  className="drawer-reset-btn"
                  onClick={handleClearAllFilters}
                  title="Clear all active filters"
                >
                  Clear All Filters
                </button>
              )}
            </div>

            {/* DRAWER BODY */}
            <div className="drawer-body p-4 space-y-6 overflow-y-auto">
              {/* SECTION 1: LISTING AGE */}
              <div className="drawer-section space-y-2">
                <div className="drawer-section-header">
                  <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                    Listing Horizon
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '30', label: 'Last 30 Days (Fresh)' },
                    { id: '60', label: 'Last 60 Days (Young)' },
                    { id: '180', label: 'Last 180 Days' },
                    { id: '365', label: '1 Year (All Listings)' },
                  ].map((tab) => {
                    const active = ageFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setAgeFilter(tab.id);
                          setCurrentPage(1);
                        }}
                        className={`drawer-chip-btn ${active ? 'is-active' : ''}`}
                      >
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: TECHNICAL SETUPS */}
              <div className="drawer-section space-y-2">
                <div className="drawer-section-header">
                  <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                    Technical Setups
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {[
                    { id: 'ALL', label: 'All Setups', count: counts.all },
                    { id: 'IPO_BASE', label: 'IPO Base Setups', count: counts.ipoBases },
                    { id: 'TIGHT_VCP', label: 'Tight VCP (<4%)', count: counts.tightVcps },
                    { id: 'ABOVE_MAS', label: 'Above 10, 20 EMA', count: counts.aboveMas },
                  ].map((s) => {
                    const active = setupFilter === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSetupFilter(s.id);
                          setCurrentPage(1);
                        }}
                        className={`drawer-chip-btn ${active ? 'is-active' : ''}`}
                      >
                        <span>{s.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            active
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 font-bold'
                              : 'bg-slate-200 dark:bg-slate-800 text-[var(--muted-foreground)]'
                          }`}
                        >
                          {s.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: MARKET SERIES */}
              <div className="drawer-section space-y-2">
                <div className="drawer-section-header">
                  <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                    Market Series
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ALL', label: 'All Series' },
                    { id: 'EQ', label: 'Mainboard (EQ)' },
                    { id: 'SM', label: 'SME (SM)' },
                  ].map((ser) => {
                    const active = seriesFilter === ser.id;
                    return (
                      <button
                        key={ser.id}
                        type="button"
                        onClick={() => {
                          setSeriesFilter(ser.id);
                          setCurrentPage(1);
                        }}
                        className={`drawer-chip-btn justify-center text-center ${active ? 'is-active' : ''}`}
                      >
                        <span>{ser.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: ADR VOLATILITY */}
              <div className="drawer-section space-y-1.5">
                <div className="drawer-section-header flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                    ADR Volatility %
                  </h4>
                  <span
                    className="text-[10px] text-[var(--muted-foreground)] font-mono"
                    title="Supports operators: > < >= <= = and ranges (e.g. >5, 3-5, <3)"
                  >
                    e.g. &gt;5, 3-5, &lt;3
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={adrFilter}
                    onChange={(e) => {
                      setAdrFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter ADR (e.g. >5, 3-5, <=4)..."
                    className="w-full bg-[var(--card-bg,var(--panel))] text-[var(--foreground)] border border-[var(--border)] rounded-xl px-3 py-2 pr-8 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {adrFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdrFilter('');
                        setCurrentPage(1);
                      }}
                      className="input-inline-clear-btn"
                      title="Clear ADR filter"
                      aria-label="Clear ADR filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 5: LIQUIDITY TURNOVER */}
              <div className="drawer-section space-y-1.5">
                <div className="drawer-section-header flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                    Liquidity (₹ Cr / day)
                  </h4>
                  <span
                    className="text-[10px] text-[var(--muted-foreground)] font-mono"
                    title="Supports operators: > < >= <= = and ranges (e.g. >50, 50-60, >=20)"
                  >
                    e.g. &gt;50, 50-60, &gt;=20
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={liquidityFilter}
                    onChange={(e) => {
                      setLiquidityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Filter turnover in Cr (e.g. >50, 50-60, >=20)..."
                    className="w-full bg-[var(--card-bg,var(--panel))] text-[var(--foreground)] border border-[var(--border)] rounded-xl px-3 py-2 pr-8 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {liquidityFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setLiquidityFilter('');
                        setCurrentPage(1);
                      }}
                      className="input-inline-clear-btn"
                      title="Clear Liquidity filter"
                      aria-label="Clear Liquidity filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 6: MOVING AVERAGES FILTER */}
              <div className="drawer-section space-y-2">
                <div className="drawer-section-header">
                  <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                    Moving Averages Criteria
                  </h4>
                </div>
                <div className="p-2 bg-[var(--card-bg,var(--panel))] border border-[var(--border)] rounded-xl">
                  <MovingAverageFilter
                    value={maConditions}
                    onChange={(newVal) => {
                      setMaConditions(newVal || {});
                      setCurrentPage(1);
                    }}
                    id="screener-drawer-ma-filter"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
