import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import AddStockModal from "./AddStockModal";
import MultiSelectDropdown from "./MultiSelectDropdown";
import EditStockModal from "./EditStockModal";
import ImportWatchlistModal from "./ImportWatchlistModal";
import TrashIcon from "./icons/TrashIcon";
import { useToast } from "./ToastContext";
import { useConfirm } from "./ConfirmContext";
import { classifySectorsInBulk } from "../services/ai";
import stockMetadata from "../constants/stockMetadata.json";

import {
  doesParamPassCheck,
  isParamRelevantForCountry,
  getActualParamKeyAndDef,
} from "../utils/paramUtils";
import { getLocalDateString } from "../utils/weekHelpers";

import { parseInstitutionalDate } from "../utils/dateUtils";
import MovingAverageRibbon from "./MovingAverageRibbon";
import { fetchStockQuotes } from "../utils/yahooFinanceMap";


const FLAG_COLOR_MAP = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7'
};

function getWeekRangeLabel(sundayDateStr) {
  if (!sundayDateStr) return "";
  const [y, m, d] = sundayDateStr.split("-").map(Number);
  const sunday = new Date(y, m - 1, d);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() + 1);
  const friday = new Date(sunday);
  friday.setDate(sunday.getDate() + 5);

  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  return `${formatDate(monday)} to ${formatDate(friday)}`;
}

export function MovingAverageFilter({ value, onChange, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const availableMAs = ["5", "10", "21", "50", "200"];
  
  // value is an object: { "5": "below", "50": "above" }
  const activeConditions = useMemo(() => value || {}, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSetMA = (ma, mode) => {
    const next = { ...activeConditions };
    if (next[ma] === mode) {
      delete next[ma]; // Toggle off if same mode clicked
    } else {
      next[ma] = mode;
    }
    onChange(Object.keys(next).length === 0 ? "" : next);
  };

  const displayText = useMemo(() => {
    const keys = Object.keys(activeConditions);
    if (keys.length === 0) return "All";
    
    const above = keys.filter(k => activeConditions[k] === 'above').sort((a,b)=>a-b);
    const below = keys.filter(k => activeConditions[k] === 'below').sort((a,b)=>a-b);
    
    let parts = [];
    if (above.length > 0) parts.push(`Above ${above.join(", ")}`);
    if (below.length > 0) parts.push(`Below ${below.join(", ")}`);
    
    return parts.join(" | ");
  }, [activeConditions]);

  return (
    <div className="ma-popover-container" ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`ma-popover-trigger ${isOpen ? "open" : ""} ${Object.keys(activeConditions).length > 0 ? "has-value" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title={displayText !== "All" ? displayText : undefined}
      >
        <span className="ma-popover-text">{displayText}</span>
        <span className="ma-popover-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="ma-popover-dropdown matrix-style">
          <div className="ma-matrix-header">
            <span className="col-period">Period</span>
            <span className="col-opt">Above</span>
            <span className="col-opt">Below</span>
          </div>
          <div className="ma-matrix-body">
            {availableMAs.map((ma) => {
              const currentMode = activeConditions[ma];
              return (
                <div key={ma} className="ma-matrix-row">
                  <span className="ma-period-label">{ma} MA</span>
                  <div 
                    className={`ma-matrix-cell ${currentMode === 'above' ? 'active' : ''}`}
                    onClick={() => handleSetMA(ma, 'above')}
                  >
                    <div className="ma-matrix-check"></div>
                  </div>
                  <div 
                    className={`ma-matrix-cell ${currentMode === 'below' ? 'active' : ''}`}
                    onClick={() => handleSetMA(ma, 'below')}
                  >
                    <div className="ma-matrix-check"></div>
                  </div>
                </div>
              );
            })}
          </div>
          {Object.keys(activeConditions).length > 0 && (
            <div className="ma-matrix-footer">
              <button className="ma-matrix-reset" onClick={() => onChange("")}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseTradingViewData(content, sectorList) {
  // We split by comma or newline to handle both:
  // 1. Single-line comma-separated strings (like TradingView export Case 2)
  // 2. Multi-line strings (if pasted from a file)
  const parts = content
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const parsedStocks = [];
  let currentSector = "";
  let hasInvalidFormat = false;

  for (const part of parts) {
    // Check for section header (e.g. ###AUTO)
    if (part.startsWith("###")) {
      const rawSector = part.replace(/^###/, "").trim();
      const match = sectorList.find(
        (s) => s.toLowerCase() === rawSector.toLowerCase(),
      );
      if (match) {
        currentSector = match;
      } else {
        currentSector = "";
      }
      continue;
    }

    // Parse stock symbol (e.g. NSE:RELIANCE -> RELIANCE)
    let symbol = part;
    if (part.includes(":")) {
      const split = part.split(":");
      if (split.length > 1) {
        symbol = split[1].trim();
      }
    }

    // Strict validation: Reject if symbol contains invalid characters
    // Allowed: Alphanumeric, dot, hyphen, underscore, ampersand, exclamation, caret, slash, asterisk, plus
    if (/[^A-Z0-9.\-_&!^/*+]/i.test(symbol) || symbol.length > 20) {
      hasInvalidFormat = true;
      break;
    }

    if (symbol) {
      if (!parsedStocks.some((s) => s.symbol === symbol)) {
        parsedStocks.push({ symbol, sector: currentSector });
      }
    }
  }

  if (hasInvalidFormat) {
    throw new Error(
      "Invalid format. Please ensure it is a valid TradingView export.",
    );
  }

  if (parsedStocks.length === 0) {
    throw new Error("No valid stocks found in the input.");
  }

  return parsedStocks;
}

const cleanNumeric = (val) => {
  if (val === undefined || val === null || val === "") return NaN;
  if (typeof val === "number") return val;
  const s = String(val).toLowerCase();
  
  // Check for units before stripping non-numeric chars
  let multiplier = 1;
  if (s.includes("cr")) multiplier = 10000000;
  else if (s.includes("m")) multiplier = 1000000;
  else if (s.includes("k")) multiplier = 1000;

  // Remove everything except digits, dots, and negative signs
  const cleaned = s.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num * multiplier;
};

const ClearButton = ({ onClick, isSelect }) => (
  <button
    className={`clear-filter-btn ${isSelect ? 'is-select' : 'is-default'}`}
    onClick={onClick}
    title="Clear"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="clear-filter-icon"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  </button>
);

function checkCondition(value, filter, type) {
  if (filter === undefined || filter === "" || filter === null) return true;
  const strFilter = String(filter).trim();
  if (strFilter === "") return true;

  // Handle Range (e.g. 10-20)
  if (
    strFilter.includes("-") &&
    !strFilter.startsWith("-") &&
    !strFilter.startsWith("<") &&
    !strFilter.startsWith(">") &&
    !strFilter.startsWith("=")
  ) {
    const parts = strFilter.split("-");
    if (parts.length === 2) {
      const minStr = parts[0].trim();
      const maxStr = parts[1].trim();
      if (minStr !== "" && maxStr !== "") {
        if (type === "number") {
          const min = cleanNumeric(minStr);
          const max = cleanNumeric(maxStr);
          const numVal = cleanNumeric(value);
          if (!isNaN(min) && !isNaN(max) && !isNaN(numVal)) {
            return numVal >= min && numVal <= max;
          }
        } else if (type === "date") {
          const dVal = parseInstitutionalDate(value);
          const dMin = parseInstitutionalDate(minStr);
          const dMax = parseInstitutionalDate(maxStr);
          if (dVal && dMin && dMax) {
            return dVal >= dMin && dVal <= dMax;
          }
          return value >= minStr && value <= maxStr;
        }
      }
    }
  }

  // Handle Operators
  const operators = [">=", "<=", ">", "<", "==", "="];
  for (const op of operators) {
    if (strFilter.startsWith(op)) {
      const targetVal = strFilter.slice(op.length).trim();
      if (targetVal === "") return true;

      if (type === "number") {
        const numStock = cleanNumeric(value);
        const numTarget = cleanNumeric(targetVal);
        if (isNaN(numStock) || isNaN(numTarget)) return false;
        if (op === ">=") return numStock >= numTarget;
        if (op === "<=") return numStock <= numTarget;
        if (op === ">") return numStock > numTarget;
        if (op === "<") return numStock < numTarget;
        if (op === "==" || op === "=") return numStock === numTarget;
      } else if (type === "date") {
        const dVal = parseInstitutionalDate(value);
        const dTarget = parseInstitutionalDate(targetVal);
        if (!dVal || !dTarget) return false;

        if (op === ">=") return dVal >= dTarget;
        if (op === "<=") return dVal <= dTarget;
        if (op === ">") return dVal > dTarget;
        if (op === "<") return dVal < dTarget;
        if (op === "==" || op === "=") return dVal.getTime() === dTarget.getTime();
      }
    }
  }

  // Plain Numeric check (no operator)
  if (type === "number") {
    const numFilter = cleanNumeric(strFilter);
    if (!isNaN(numFilter)) {
      const numStock = cleanNumeric(value);
      if (!isNaN(numStock)) return numStock === numFilter;
      return false;
    }
  }

  // Fallback: String Includes
  return String(value || "")
    .toLowerCase()
    .includes(strFilter.toLowerCase());
}

export default function StockGrid({
  data,
  weekKey,
  setData,
  isReadOnly,
  country,
  selectedWatchlistId,
  onExportAll,
  onImportAll,
  availableTags,
  aiSettings,
  onQuickLog,
}) {
  const week = data.weeks?.[country]?.[weekKey];
  const params = data.paramDefinitions;
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const allStocks = useMemo(() => Object.values(week?.stocks || {}), [week]);

  const symbolsSerialized = useMemo(() => {
    return allStocks.map((s) => s.symbol).sort().join(",");
  }, [allStocks]);

  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [detectingSectors, setDetectingSectors] = useState(false);
  const fetchQuotesCountRef = useRef(0);
  const fetchAbortControllerRef = useRef(null);

  const applySectorMappings = useCallback((mappings) => {
    setData((prev) => {
      const prevWeek = prev.weeks?.[country]?.[weekKey];
      if (!prevWeek) return prev;
      const newStocks = { ...prevWeek.stocks };
      const newCache = { ...(prev.stockSectorCache || {}) };
      const newSectorsList = [...(prev.uiConfig?.sectors || prev.sectors || [])];

      Object.entries(mappings).forEach(([symbol, sectorName]) => {
        if (newStocks[symbol]) {
          newStocks[symbol] = {
            ...newStocks[symbol],
            sector: sectorName,
          };
          newCache[symbol.toUpperCase()] = sectorName;

          // Register sector in uiConfig if it doesn't exist
          const exists = newSectorsList.some(
            (s) => (s.name || "").toLowerCase() === sectorName.toLowerCase()
          );
          if (!exists) {
            newSectorsList.push({ name: sectorName, countries: [country] });
          } else {
            const existing = newSectorsList.find(
              (s) => (s.name || "").toLowerCase() === sectorName.toLowerCase()
            );
            if (existing && existing.countries && !existing.countries.includes(country)) {
              existing.countries.push(country);
            }
          }
        }
      });

      return {
        ...prev,
        stockSectorCache: newCache,
        uiConfig: {
          ...(prev.uiConfig || {}),
          sectors: newSectorsList,
        },
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
  }, [country, weekKey, setData]);

  const handleDetectSectors = useCallback(async () => {
    const watchlistStocks = allStocks.filter(
      (s) => selectedWatchlistId === "all" || s.watchlists?.includes(selectedWatchlistId)
    );

    const stocksToResolve = watchlistStocks.filter((s) => !s.sector);

    if (stocksToResolve.length === 0) {
      showToast("All stocks in this watchlist already have sectors defined.", "info");
      return;
    }

    setDetectingSectors(true);
    try {
      const resolvedMappings = {};
      const remainingForAi = [];

      // 1. Local / Cache lookup first
      stocksToResolve.forEach((s) => {
        const cached = data.stockSectorCache?.[s.symbol.toUpperCase()];
        if (cached) {
          resolvedMappings[s.symbol] = cached;
        } else {
          const localMeta = stockMetadata[country]?.[s.symbol.toUpperCase()];
          if (localMeta && localMeta.sector) {
            resolvedMappings[s.symbol] = localMeta.sector;
          } else {
            remainingForAi.push(s);
          }
        }
      });

      // 2. AI Fallback if needed
      if (remainingForAi.length > 0) {
        const apiKey = aiSettings?.apiKey;
        const model = aiSettings?.model || "gemini-2.5-flash";

        if (!apiKey || !apiKey.trim()) {
          if (Object.keys(resolvedMappings).length > 0) {
            applySectorMappings(resolvedMappings);
            showToast(`Resolved ${Object.keys(resolvedMappings).length} sectors locally. Please configure Gemini API Key for the remaining ${remainingForAi.length} stocks.`, "warning");
          } else {
            showToast("Gemini API Key is missing. Please configure it in Settings.", "error");
          }
          setDetectingSectors(false);
          return;
        }

        showToast(`Detecting sectors for ${remainingForAi.length} stocks using AI...`, "info");
        
        const availableSectors = data.uiConfig?.sectors || [];
        const aiMappings = await classifySectorsInBulk(
          apiKey,
          model,
          remainingForAi.map((s) => ({ symbol: s.symbol, companyName: s.name || "" })),
          country,
          availableSectors
        );

        Object.entries(aiMappings).forEach(([sym, valObj]) => {
          if (valObj && valObj.sector) {
            resolvedMappings[sym] = valObj.sector;
          }
        });
      }

      if (Object.keys(resolvedMappings).length > 0) {
        applySectorMappings(resolvedMappings);
        showToast(`Successfully resolved sectors for ${Object.keys(resolvedMappings).length} stocks!`, "success");
      } else {
        showToast("No sectors could be resolved for the stocks.", "warning");
      }
    } catch (err) {
      console.error("Manual sector detection failed:", err);
      showToast(`Sector detection failed: ${err.message || err}`, "error");
    } finally {
      setDetectingSectors(false);
    }
  }, [allStocks, selectedWatchlistId, data.stockSectorCache, data.uiConfig?.sectors, country, aiSettings, showToast, applySectorMappings]);


  const fetchQuotesForGrid = useCallback(async (forceRefresh = false) => {
    const symbols = symbolsSerialized ? symbolsSerialized.split(",") : [];
    if (symbols.length === 0) {
      setQuotes({});
      return;
    }

    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;

    setLoadingQuotes(true);
    try {
      const symbolsList = symbols;
      const results = await fetchStockQuotes(symbolsList, country, controller.signal, forceRefresh);
      if (controller.signal.aborted) return;

      if (results && results.length > 0) {
        const mapping = {};
        results.forEach((r) => {
          mapping[r.symbol] = {
            currentPrice: r.currentPrice,
            dailyChangePct: r.dailyChangePct,
            isAdvancing: r.isAdvancing,
            longName: r.longName || r.name,
            earningsDate: r.earningsDate,
          };
        });
        setQuotes(mapping);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch stock quotes for grid:", err);
      }
    } finally {
      if (fetchAbortControllerRef.current === controller) {
        setLoadingQuotes(false);
        fetchAbortControllerRef.current = null;
      }
    }
  }, [symbolsSerialized, country]);

  useEffect(() => {
    let active = true;
    setTimeout(() => {
      if (active) {
        fetchQuotesForGrid();
      }
    }, 0);
    return () => {
      active = false;
      fetchQuotesCountRef.current += 1;
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
    };
  }, [symbolsSerialized, country, weekKey, fetchQuotesForGrid]);

  const [importPendingStocks, setImportPendingStocks] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState("symbol");
  const [sortDir, setSortDir] = useState("asc");
  const [priceTrendFilter, setPriceTrendFilter] = useState(null); // 'up' | 'down' | null

  const [activeTagDropdown, setActiveTagDropdown] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [editingStock, setEditingStock] = useState(null);
  const [activeFlagMenuSymbol, setActiveFlagMenuSymbol] = useState(null);
  const [showAddStock, setShowAddStock] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({
    total: 0,
    completed: 0,
  });
  const [aiProgress, setAiProgress] = useState({
    total: 0,
    completed: 0,
  });
  const [rateLimitWait, setRateLimitWait] = useState(null); // { waitSeconds, completed, total }
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const importTypeRef = useRef("stocks"); // 'stocks', 'backup', or 'tv'
  const [copiedStocks, setCopiedStocks] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const isFiltering = searchQuery.length > 0 || Object.keys(filters).length > 0;

  const updateStockField = (symbol, field, value) => {
    setData((prev) => {
      const prevWeek = prev.weeks?.[country]?.[weekKey];
      if (!prevWeek) return prev;
      const newStocks = { ...prevWeek.stocks };
      
      const newData = { ...prev };
      if (newStocks[symbol]) {
        newStocks[symbol] = {
          ...newStocks[symbol],
          [field]: value,
        };
      }
      
      if (field === "sector") {
        newData.stockSectorCache = {
          ...(prev.stockSectorCache || {}),
          [symbol.toUpperCase()]: value,
        };
      }

      newData.weeks = {
        ...prev.weeks,
        [country]: {
          ...prev.weeks[country],
          [weekKey]: {
            ...prevWeek,
            stocks: newStocks,
          },
        },
      };
      return newData;
    });
  };

  const updateStockParam = (symbol, paramKey, value) => {
    setData((prev) => {
      const prevWeek = prev.weeks?.[country]?.[weekKey];
      if (!prevWeek) return prev;
      const newStocks = { ...prevWeek.stocks };
      if (newStocks[symbol]) {
        newStocks[symbol] = {
          ...newStocks[symbol],
          params: {
            ...(newStocks[symbol].params || {}),
            [paramKey]: value,
          },
        };
      }
      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
  };

  const triggerFullSync = useCallback((force = false) => {
    const allSymbols = Object.keys(week?.stocks || {});
    if (allSymbols.length === 0) return;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    // Extract dynamic parameter keys based on current country
    const adrInfo = getActualParamKeyAndDef(data?.paramDefinitions, 'adr', 'adr', country);
    const liqInfo = getActualParamKeyAndDef(data?.paramDefinitions, 'liquidity', 'liquidity', country);
    const adrKey = adrInfo?.key || 'adr';
    const liqKey = liqInfo?.key || 'liquidity';

    const symbols = allSymbols.filter(symbol => {
      if (force) return true;
      const stock = week.stocks[symbol];
      if (!stock) return true;

      // Check if metrics are missing
      const params = stock.params || {};
      const hasAdr = params[adrKey] !== undefined && params[adrKey] !== null && params[adrKey] !== "";
      const hasLiq = params[liqKey] !== undefined && params[liqKey] !== null && params[liqKey] !== "";
      const hasMa = params['movingAverages'] !== undefined && params['movingAverages'] !== null && params['movingAverages'] !== "";

      if (!hasAdr || !hasLiq || !hasMa) return true;

      // Check if last sync was before today
      if (!stock.lastSyncTime || stock.lastSyncTime < todayStart) return true;

      return false;
    });

    if (symbols.length === 0) {
      console.log("[Sync] All stocks are already up-to-date for today. Skipping sync.");
      return;
    }

    console.log(`[Sync] Triggering incremental sync for ${symbols.length}/${allSymbols.length} stocks...`);

    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: "FETCH_STOCK_METRICS",
        payload: {
          symbols: symbols,
          country,
          weekKey,
          paramDefs: data.paramDefinitions,
          adrDays: data.uiConfig?.adrDays || 20,
          liquidityDays: data.uiConfig?.liquidityDays || 20,
        },
      });

      // Update local timestamp immediately to show activity
      setData(prev => {
        const newData = structuredClone(prev);
        if (newData.weeks?.[country]?.[weekKey]) {
          newData.weeks[country][weekKey].lastUpdatedTime = Date.now();
        }
        return newData;
      });
    }

    // Refresh quotes simultaneously
    fetchQuotesForGrid(force);
  }, [week, country, weekKey, data, setData, fetchQuotesForGrid]);

  // --- AUTOMATED DAILY REFRESH ---
  const autoSyncTriggeredRef = useRef(false);
  const currentWeekSyncDate = data?.weeks?.[country]?.[weekKey]?.lastSyncDate;
  const autoRefreshMetrics = data?.uiConfig?.autoRefreshMetrics;

  useEffect(() => {
    if (!data || !weekKey || !data.weeks?.[country]?.[weekKey]) return;

    const todayStr = getLocalDateString(new Date());
    const weekData = data.weeks[country][weekKey];
    
    // Check setting and date
    const autoRefreshEnabled = autoRefreshMetrics !== false;
    const isSyncedToday = weekData.lastSyncDate === todayStr;

    if (autoRefreshEnabled && !isSyncedToday && !isReadOnly && !autoSyncTriggeredRef.current) {
      autoSyncTriggeredRef.current = true;
      console.log(`[AutoSync] New day detected (${todayStr}). Triggering refresh for ${country} watchlist...`);
      triggerFullSync();
      
      setData(prev => {
        const prevWeek = prev.weeks?.[country]?.[weekKey];
        if (!prevWeek || prevWeek.lastSyncDate === todayStr) return prev;
        
        return {
          ...prev,
          weeks: {
            ...prev.weeks,
            [country]: {
              ...prev.weeks[country],
              [weekKey]: {
                ...prevWeek,
                lastSyncDate: todayStr
              }
            }
          }
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, country, currentWeekSyncDate, autoRefreshMetrics, isReadOnly, triggerFullSync, setData]);

  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target)
      ) {
        setExportMenuOpen(false);
      }
      if (
        importMenuRef.current &&
        !importMenuRef.current.contains(event.target)
      ) {
        setImportMenuOpen(false);
      }
      // Close tag dropdown if click is outside
      if (!event.target.closest(".add-tag-wrapper")) {
        setActiveTagDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const isInputFocused =
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        activeTag === "SELECT";

      // Alt + N -> Add Stock
      if (e.altKey && e.key.toLowerCase() === "n") {
        if (!isInputFocused) {
          e.preventDefault();
          setShowAddStock(true);
        }
      }

      // Ctrl + K (or Cmd + K) -> Focus Search Bar
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        // Expand filters if they are collapsed so the search bar is actually visible
        if (!showFilters) setShowFilters(true);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFilters]);

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [weekKey, pageSize, filters, sortBy, sortDir, searchQuery]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;

    const msgListener = (req) => {
      if (req.action === "FETCH_PROGRESS") {
        setFetchProgress(req.payload);
        if (req.payload.completed >= req.payload.total) {
          setTimeout(() => {
            setFetchProgress({ total: 0, completed: 0 });
            showToast("Metrics updated successfully!", "success");
          }, 1500);
        }
      } else if (req.action === "BULK_AI_PROGRESS") {
        setAiProgress(req.payload);
        setRateLimitWait(null); // clear rate-limit status when new progress arrives
      } else if (req.action === "BULK_AI_RATE_LIMIT_WAIT") {
        setRateLimitWait(req.payload);
        setAiProgress(p => ({
          ...p,
          completed: req.payload.completed !== undefined ? req.payload.completed : p.completed,
          total: req.payload.total !== undefined ? req.payload.total : p.total
        }));
      } else if (req.action === "BULK_AI_ANALYSIS_COMPLETE") {
        setAiProgress({ total: 0, completed: 0 });
        setRateLimitWait(null);
        showToast(`Background Bulk AI Analysis completed for ${req.payload.updatedCount} stocks!`, "success");
      } else if (req.action === "BULK_AI_ANALYSIS_FAILED") {
        setAiProgress({ total: 0, completed: 0 });
        setRateLimitWait(null);
        showToast(`AI Analysis Failed: ${req.payload.error}`, "error");
      }
    };

    chrome.runtime.onMessage.addListener(msgListener);
    return () => chrome.runtime.onMessage.removeListener(msgListener);
  }, [showToast]);

  /* =====================
     BASE DATASET
  ===================== */

  /* =====================
     COLUMN CONFIG
  ===================== */
  const columnConfig = useMemo(() => {
    return data.uiConfig?.columnVisibility || {};
  }, [data.uiConfig?.columnVisibility]);
  const showNotes = columnConfig["__notes__"] !== false;
  const showLivePrice = columnConfig["__livePrice__"] !== false;


  const activeWatchlist = (data.watchlists || []).find(
    (w) => w.id === selectedWatchlistId,
  );

  const visibleParams = useMemo(() => {
    return Object.entries(params)
      .filter(([key, p]) => {
        if (!isParamRelevantForCountry(p, country)) return false;
        if (selectedWatchlistId !== "all" && activeWatchlist) {
          return (activeWatchlist.visibleParams || []).includes(key);
        }
        return columnConfig[key] !== false;
      })
      .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999));
  }, [params, country, selectedWatchlistId, activeWatchlist, columnConfig]);

  const colCount =
    1 + // Stock
    (showLivePrice ? 1 : 0) + // Live Price
    1 + // Sector
    visibleParams.length +
    1 + // Checks Passed
    (showNotes ? 1 : 0) +
    1 + // Tradable
    1; // Delete

  /* =====================
     FILTERABLE PARAMS
  ===================== */
  const filterableParams = useMemo(() => {
    return Object.entries(params)
      .filter(([key, p]) => {
        if (!isParamRelevantForCountry(p, country)) return false;
        if (selectedWatchlistId !== "all" && activeWatchlist) {
          return (activeWatchlist.visibleFilters || []).includes(key);
        }
        return p.filterable;
      })
      .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999));
  }, [params, selectedWatchlistId, activeWatchlist, country]);

  const isSectorFilterable = data.uiConfig?.sectorFilterable === true;
  const isTradableFilterable = data.uiConfig?.tradableFilterable === true;
  const isTagFilterable = data.uiConfig?.tagFilterable === true;
  const showTags = data.uiConfig?.showTags !== false;

  const sectors = useMemo(() => {
    const rawSectors = data.uiConfig?.sectors || [];
    return rawSectors
      .filter((s) => {
        // Handle legacy string format or items with empty countries array
        if (typeof s === "string") return true;
        if (!s.countries || s.countries.length === 0) return true;
        return s.countries.includes(country);
      })
      .map((s) => (typeof s === "string" ? s : s.name))
      .sort((a, b) => a.localeCompare(b));
  }, [data.uiConfig?.sectors, country]);

  /* =====================
     CHECKS PASSED
  ===================== */
  function renderChecksBadge(stock) {
    const checkParams = visibleParams.filter(([, p]) => p.isCheck === true);
    const total = checkParams.length;
    if (total === 0) return <span className="checks-none">—</span>;

    let passed = 0;
    checkParams.forEach(([key, p]) => {
      if (doesParamPassCheck(stock.params?.[key], p)) {
        passed++;
      }
    });

    const ratio = passed / total;
    let statusClass = "poor";
    if (ratio >= 0.8) statusClass = "excellent";
    else if (ratio >= 0.6) statusClass = "good";
    else if (ratio >= 0.4) statusClass = "average";

    return (
      <div
        className={`checks-badge ${statusClass}`}
        title={`${passed} of ${total} checks passed`}
      >
        <span className="passed-count">{passed}</span>
        <span className="separator">/</span>
        <span className="total-count">{total}</span>
      </div>
    );
  }

  // Helper for export/sort logic
  const getChecksCount = useCallback((stock) => {
    const checkParams = visibleParams.filter(([, p]) => p.isCheck === true);
    let passed = 0;
    checkParams.forEach(([key, p]) => {
      if (doesParamPassCheck(stock.params?.[key], p)) {
        passed++;
      }
    });
    return passed;
  }, [visibleParams]);

  /* =====================
     FILTER LOGIC (FULL DATASET)
  ===================== */
  const filteredStocks = useMemo(() => {
    return allStocks.filter((stock) => {
      /* WATCHLIST FILTER */
      if (selectedWatchlistId !== "all") {
        const stockWatchlists = stock.watchlists || [];
        if (!stockWatchlists.includes(selectedWatchlistId)) return false;
      }

      /* SEARCH FILTER */
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const symbolMatch = stock.symbol.toLowerCase().includes(q);
        const nameMatch = (stock.name || "").toLowerCase().includes(q);
        const notesMatch = (stock.notes || "").toLowerCase().includes(q);
        if (!symbolMatch && !nameMatch && !notesMatch) return false;
      }

      /*SECTOR FILTER*/
      if (isSectorFilterable) {
        const sectorFilter = filters.__sector__;
        if (Array.isArray(sectorFilter) && sectorFilter.length > 0) {
          if (!sectorFilter.includes(stock.sector)) return false;
        } else if (typeof sectorFilter === "string" && sectorFilter !== "") {
          if (stock.sector !== sectorFilter) return false;
        }
      }
      /* TRADABLE FILTER */
      const tradableFilter = filters.__tradable__;
      if (tradableFilter !== undefined && tradableFilter !== "") {
        if (stock.tradable !== tradableFilter) {
          return false;
        }
      }
      /* TAG FILTER */
      if (isTagFilterable) {
        const tagFilter = filters.__tag__;
        if (Array.isArray(tagFilter) && tagFilter.length > 0) {
          if (!stock.tags || !stock.tags.some((t) => tagFilter.includes(t)))
            return false;
        } else if (typeof tagFilter === "string" && tagFilter !== "") {
          if (!stock.tags || !stock.tags.includes(tagFilter)) return false;
        }
      }
      /*Param FILTER*/
      const passesParams = filterableParams.every(([key, p]) => {
        const filterVal = filters[key];
        if (
          filterVal === undefined ||
          filterVal === "" ||
          (Array.isArray(filterVal) && filterVal.length === 0)
        )
          return true;

        const stockVal = stock.params?.[key];

        // --- SMART MOVING AVERAGE FILTERING (COMBO CASE SUPPORT) ---
        if (key === "movingAverages" && stockVal && filterVal) {
          const parseMAs = (str) => {
            if (!str || typeof str !== 'string') return [];
            if (str.toLowerCase().includes("below all")) return ["below"];
            return str.match(/\d+/g) || [];
          };

          const stockAboveMAs = parseMAs(stockVal);
          const isStockBelowAll = stockAboveMAs.includes("below");

          if (filterVal && typeof filterVal === 'object' && !Array.isArray(filterVal)) {
            const conditions = Object.entries(filterVal);
            if (conditions.length === 0) return true;

            return conditions.every(([ma, mode]) => {
              if (mode === "below") {
                // Below condition: Price is NOT in the "above" set for that period
                if (isStockBelowAll) return true;
                return !stockAboveMAs.includes(ma);
              } else {
                // Above condition: Price IS in the "above" set for that period
                if (isStockBelowAll) return false;
                return stockAboveMAs.includes(ma);
              }
            });
          }

          // Fallback / Initial State support
          return true;
        }

        if (stockVal === undefined) return false;

        if (p.type === "checkbox") {
          return Boolean(stockVal) === Boolean(filterVal);
        }

        if (p.type === "select") {
          const filterArr = Array.isArray(filterVal)
            ? filterVal
            : filterVal
              ? [filterVal]
              : [];
          if (filterArr.length === 0) return true;
          return filterArr.includes(stockVal);
        }

        if (p.type === "number") {
          let effectiveFilterVal = String(filterVal);
          if (key.toLowerCase().includes("liquidity") || (p.label && p.label.toLowerCase().includes("liquidity"))) {
             if (!/[MCr]/i.test(effectiveFilterVal)) {
                const unit = country === "IN" ? "Cr" : "M";
                // Append unit to any number in the filter (handles ranges and operators)
                effectiveFilterVal = effectiveFilterVal.replace(/(\d+(?:\.\d+)?)/g, `$1${unit}`);
             }
          }
          return checkCondition(stockVal, effectiveFilterVal, "number");
        }

        if (p.type === "date") {
          return checkCondition(stockVal, filterVal, "date");
        }

        if (p.type === "text") {
          return (String(stockVal || ""))
            .toLowerCase()
            .includes(String(filterVal).toLowerCase());
        }

        return true;
      });

      if (!passesParams) return false;

      /* PRICE TREND FILTER */
      if (priceTrendFilter === "up") {
        const q = quotes[stock.symbol];
        if (!q || q.dailyChangePct === undefined || q.dailyChangePct <= 0) return false;
      } else if (priceTrendFilter === "down") {
        const q = quotes[stock.symbol];
        if (!q || q.dailyChangePct === undefined || q.dailyChangePct >= 0) return false;
      }

      return true;
    });
  }, [
    allStocks,
    filters,
    filterableParams,
    isSectorFilterable,
    isTagFilterable,
    searchQuery,
    selectedWatchlistId,
    country,
    priceTrendFilter,
    quotes,
  ]);


  /* =====================
     SORT LOGIC (FULL FILTERED DATA)
  ===================== */
  const sortedStocks = useMemo(() => {
    if (!sortBy) return filteredStocks;

    return [...filteredStocks].sort((a, b) => {
      let aVal, bVal;

      if (sortBy === "__checks__") {
        aVal = getChecksCount(a);
        bVal = getChecksCount(b);
      } else if (sortBy === "__livePrice__") {
        const aNum = quotes[a.symbol]?.dailyChangePct ?? 0;
        const bNum = quotes[b.symbol]?.dailyChangePct ?? 0;
        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      } else {
        aVal = a[sortBy] ?? a.params?.[sortBy];
        bVal = b[sortBy] ?? b.params?.[sortBy];
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;



      // Numeric Sort
      const paramDef = params[sortBy];
      if (paramDef?.type === "number") {
        const aNum = cleanNumeric(aVal);
        const bNum = cleanNumeric(bVal);
        if (isNaN(aNum) && isNaN(bNum)) return 0;
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      }

      if (paramDef?.type === "select" && Array.isArray(paramDef.options)) {
        const aIdx = paramDef.options.indexOf(aVal);
        const bIdx = paramDef.options.indexOf(bVal);
        // If one of the values is not found in options, it will be -1
        return sortDir === "asc" ? aIdx - bIdx : bIdx - aIdx;
      }

      if (typeof aVal === "boolean") {
        return sortDir === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }

      if (paramDef?.type === "date") {
        const dA = parseInstitutionalDate(aVal);
        const dB = parseInstitutionalDate(bVal);
        if (!dA && !dB) return 0;
        if (!dA) return 1;
        if (!dB) return -1;
        return sortDir === "asc" ? dA - dB : dB - dA;
      }

      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredStocks, sortBy, sortDir, quotes, getChecksCount, params]);

  const advancesAndDeclines = useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let totalWithQuotes = 0;

    filteredStocks.forEach((stock) => {
      const q = quotes[stock.symbol];
      if (q && q.dailyChangePct !== undefined) {
        totalWithQuotes++;
        if (q.dailyChangePct > 0) {
          advances++;
        } else if (q.dailyChangePct < 0) {
          declines++;
        } else {
          unchanged++;
        }
      }
    });

    return { advances, declines, unchanged, total: totalWithQuotes };
  }, [filteredStocks, quotes]);

  const totalPages = Math.max(1, Math.ceil(sortedStocks.length / pageSize));

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const stocks = sortedStocks.slice(start, end);

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }


  const activeFilters = useMemo(() => {
    return Object.entries(filters).filter(([_key, value]) => {
      if (value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      // MA toggle filter object: active only if mas has selections
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).length > 0;
      }
      return true;
    });
  }, [filters]);

  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('tradeclarity_stockgrid_col_widths');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleMouseDown = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.target.closest("th");
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;
    let latestWidth = startWidth;

    const handleMouseMove = (moveEvent) => {
      latestWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: latestWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing");

      setColWidths((prev) => {
        const next = { ...prev, [colKey]: latestWidth };
        try {
          localStorage.setItem('tradeclarity_stockgrid_col_widths', JSON.stringify(next));
        } catch (err) {
          console.warn("Failed to save column widths to localStorage:", err);
        }
        return next;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.classList.add("resizing");
  };

  const resetColWidth = (e, colKey) => {
    e.stopPropagation();
    setColWidths((prev) => {
      const newWidths = { ...prev };
      delete newWidths[colKey];
      try {
        localStorage.setItem('tradeclarity_stockgrid_col_widths', JSON.stringify(newWidths));
      } catch (err) {
        console.warn("Failed to save column widths to localStorage:", err);
      }
      return newWidths;
    });
  };

  /* =====================
     CRUD
  ===================== */
  function handleAddStock(input, selectedWlIds = []) {
    const symbols = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (symbols.length === 0) return;

    const currentWeek = data.weeks?.[country]?.[weekKey] || { stocks: {} };
    const currentStocks = currentWeek.stocks || {};
    const newSymbolsAdded = symbols.filter((symbol) => !currentStocks[symbol]);

    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };

      symbols.forEach((symbol) => {
        if (!newStocks[symbol]) {
          newStocks[symbol] = {
            symbol,
            sector: "",
            tradable: false,
            notes: "",
            tags: [],
            params: {},
            watchlists: [...selectedWlIds],
          };
        } else if (selectedWlIds.length > 0) {
          const existing = newStocks[symbol];
          const mergedWls = Array.from(
            new Set([...(existing.watchlists || []), ...selectedWlIds]),
          );
          newStocks[symbol] = {
            ...existing,
            watchlists: mergedWls,
          };
        }
      });

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });

    // Trigger background API hydration immediately if enabled
    if (
      newSymbolsAdded.length > 0 &&
      data?.uiConfig?.enableApiHydration !== false
    ) {
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: "FETCH_STOCK_METRICS",
          payload: {
            symbols: newSymbolsAdded,
            country,
            weekKey,
            paramDefs: data.paramDefinitions,
            adrDays: data.uiConfig?.adrDays || 20,
            liquidityDays: data.uiConfig?.liquidityDays || 20,
          },
        });
      }
    }

    showToast(`Added ${symbols.length} stock(s) to watchlist`, "success");
  }

  function handleUpdateStock(updatedStock) {
    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };
      newStocks[updatedStock.symbol] = updatedStock;

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
              lastUpdatedTime: Date.now(),
            },
          },
        },
      };
    });
  }

  async function deleteStock(symbol) {
    const isWatchlistSpecific = selectedWatchlistId && selectedWatchlistId !== "all" && activeWatchlist;
    const confirmMessage = isWatchlistSpecific
      ? `Remove ${symbol} from watchlist "${activeWatchlist.name}"?`
      : `Delete ${symbol}?`;

    if (!(await confirm(confirmMessage, { confirmSettingsKey: 'skipDeleteConfirm' }))) return false;

    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };

      if (isWatchlistSpecific) {
        const stock = newStocks[symbol];
        if (stock) {
          const updatedWatchlists = (stock.watchlists || []).filter((id) => id !== selectedWatchlistId);
          newStocks[symbol] = {
            ...stock,
            watchlists: updatedWatchlists,
          };
        }
      } else {
        delete newStocks[symbol];
      }

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });

    showToast(isWatchlistSpecific ? `Removed ${symbol} from watchlist` : `Deleted ${symbol}`, "success");
    return true;
  }

  function addTag(stock, tag) {
    if (!tag || stock.tags?.includes(tag)) return;

    setData((prev) => {
      const prevWeek = prev.weeks?.[country]?.[weekKey];
      if (!prevWeek) return prev;
      const newStocks = { ...prevWeek.stocks };
      if (newStocks[stock.symbol]) {
        newStocks[stock.symbol] = {
          ...newStocks[stock.symbol],
          tags: [...(newStocks[stock.symbol].tags || []), tag],
        };
      }
      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
  }

  function removeTag(stock, tagToRemove) {
    setData((prev) => {
      const prevWeek = prev.weeks?.[country]?.[weekKey];
      if (!prevWeek) return prev;
      const newStocks = { ...prevWeek.stocks };
      if (newStocks[stock.symbol]) {
        newStocks[stock.symbol] = {
          ...newStocks[stock.symbol],
          tags: (newStocks[stock.symbol].tags || []).filter((t) => t !== tagToRemove),
        };
      }
      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
  }

  function renderSortIndicator(col) {
    const isActive = sortBy === col;
    return (
      <span className={`sort-indicator-v3 ${isActive ? "active" : ""}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sort-up ${isActive && sortDir === "asc" ? "on" : ""}`}
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sort-down ${isActive && sortDir === "desc" ? "on" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    );
  }

  function getExportFilename(extension, scope) {
    let dateLabel = "all";
    if (weekKey) {
      const [y, m, d] = weekKey.split("-").map(Number);
      const sunday = new Date(y, m - 1, d);
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() + 1);
      const friday = new Date(sunday);
      friday.setDate(sunday.getDate() + 5);

      const formatDate = (date) => {
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
      };
      dateLabel = `${formatDate(monday)}_to_${formatDate(friday)}`;
    }
    return `stocks_export_${scope}_${dateLabel}.${extension}`;
  }

  // Exported for CSV export
  function handleExport(format, scope) {
    setExportMenuOpen(false);
    if (format === "csv") {
      handleExportCSV(scope);
    } else if (format === "json") {
      handleExportJSON(scope);
    }
  }

  function handleExportCSV(scope = "filtered") {
    const exportData = scope === "all" ? allStocks : sortedStocks;

    if (!exportData || exportData.length === 0) {
      showToast("No data to export!", "warning");
      return;
    }
    const headers = [
      "Symbol",
      "Sector",
      ...visibleParams.map(([key]) => data.paramDefinitions[key]?.label || key),
      "Checks Passed",
      "Tags",
      "Tradable",
      "Notes",
    ];

    const rows = exportData.map((stock) => {
      const checks = getChecksCount(stock);
      return [
        stock.symbol,
        stock.sector,
        ...visibleParams.map(([key]) => stock.params?.[key] ?? ""),
        checks,
        (stock.tags || []).join(", "),
        stock.tradable ? "Yes" : "No",
        stock.notes ?? "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", getExportFilename("csv", scope));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported CSV successfully", "success");
  }

  function handleExportJSON(scope = "filtered") {
    const exportData = scope === "all" ? allStocks : sortedStocks;

    if (!exportData || exportData.length === 0) {
      showToast("No data to export!", "warning");
      return;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", getExportFilename("json", scope));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported JSON successfully", "success");
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input value to allow re-importing the same file if needed
    e.target.value = "";

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target.result;

      if (importTypeRef.current === "tv") {
        try {
          const sectorList = sectors || [];
          const parsedStocks = parseTradingViewData(content, sectorList);
          setImportPendingStocks(parsedStocks);
        } catch (err) {
          showToast(err.message || "Failed to parse text file", "error");
        }
        return;
      }

      try {
        const json = JSON.parse(content);

        if (importTypeRef.current === "backup") {
          onImportAll(json);
        } else {
          // Stock Import Validation
          if (!Array.isArray(json)) {
            const example = [
              { symbol: "AAPL", sector: "Technology", tradable: true },
            ];
            alert(
              `Invalid Import File.\n\nExpected a JSON Array of stocks.\n\nExample Format:\n${JSON.stringify(example, null, 2)}`,
            );
            return;
          }
          if (json.length > 0 && !json[0].symbol) {
            const example = [{ symbol: "AAPL", sector: "Technology" }];
            alert(
              `Invalid Stock Data.\n\nItems in the array are missing the 'symbol' property.\n\nExample Format:\n${JSON.stringify(example, null, 2)}`,
            );
            return;
          }
          setImportPendingStocks(json);
        }
      } catch (_err) {
        showToast("Failed to parse JSON file", "error");
      }
    };

    reader.readAsText(file);
  }

  function triggerImport(type) {
    importTypeRef.current = type;
    setImportMenuOpen(false);
    if (fileInputRef.current) {
      if (type === "tv") {
        fileInputRef.current.accept = ".txt,.csv";
      } else {
        fileInputRef.current.accept = ".json";
      }
      fileInputRef.current.click();
    }
  }

  function importStocks(stocksArray) {
    if (!stocksArray || stocksArray.length === 0) return;

    const currentWeekData = data.weeks?.[country]?.[weekKey] || { stocks: {} };
    const currentStocks = currentWeekData.stocks || {};
    const newSymbolsAdded = [];
    let count = 0;

    stocksArray.forEach((s) => {
      if (s.symbol) {
        if (!currentStocks[s.symbol]) {
          newSymbolsAdded.push(s.symbol);
        }
        count++;
      }
    });

    setData((prev) => {
      const prevWeekData = prev.weeks[country]?.[weekKey] || { stocks: {} };
      const newStocks = { ...prevWeekData.stocks };

      stocksArray.forEach((s) => {
        if (s.symbol) {
          const existing = newStocks[s.symbol];

          const base = {
            symbol: s.symbol,
            sector: "",
            tradable: false,
            notes: "",
            tags: [],
            params: {},
          };

          newStocks[s.symbol] = {
            ...base,
            ...existing,
            ...s,
            // Preserve existing populated fields — don't let empty import data wipe them
            sector: s.sector || existing?.sector || "",
            notes: s.notes || existing?.notes || "",
            tradable: (s.tradable !== undefined && s.tradable !== false) ? s.tradable : (existing?.tradable || false),
            params: { ...(existing?.params || {}), ...(s.params || {}) },
            tags: (s.tags && s.tags.length > 0) ? s.tags : (existing?.tags || []),
            watchlists: Array.from(
              new Set([
                ...(existing?.watchlists || []),
                ...(s.watchlists || []),
              ]),
            ),
          };
        }
      });

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeekData,
              stocks: newStocks,
            },
          },
        },
      };
    });

    // Trigger background API hydration immediately if enabled
    if (
      newSymbolsAdded.length > 0 &&
      data?.uiConfig?.enableApiHydration !== false
    ) {
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: "FETCH_STOCK_METRICS",
          payload: {
            symbols: newSymbolsAdded,
            country,
            weekKey,
            paramDefs: data.paramDefinitions,
            adrDays: data.uiConfig?.adrDays || 20,
            liquidityDays: data.uiConfig?.liquidityDays || 20,
          },
        });
      }
    }

    if (count > 0) {
      showToast(`Imported ${count} stocks successfully.`, "success");
    }
  }

  /* =====================
     RENDER
  ===================== */
  return (
    <div 
      className="grid-wrapper stock-grid-container"
      style={{
        "--progress-width": `${(fetchProgress.completed / Math.max(1, fetchProgress.total)) * 100}%`,
        "--ai-progress-width": `${(aiProgress.completed / Math.max(1, aiProgress.total)) * 100}%`,
        "--cw-symbol": colWidths["symbol"] ? `${colWidths["symbol"]}px` : "auto",
        "--cw-livePrice": colWidths["__livePrice__"] ? `${colWidths["__livePrice__"]}px` : "auto",
        "--cw-sector": colWidths["sector"] ? `${colWidths["sector"]}px` : "auto",
        "--cw-checks": colWidths["__checks__"] ? `${colWidths["__checks__"]}px` : "auto",
        "--cw-tradable": colWidths["tradable"] ? `${colWidths["tradable"]}px` : "auto",
        "--cw-notes": colWidths["__notes__"] ? `${colWidths["__notes__"]}px` : "auto",
        ...visibleParams.reduce((acc, [key]) => {
          acc[`--cw-${key}`] = colWidths[key] ? `${colWidths[key]}px` : "auto";
          return acc;
        }, {})
      }}
    >
      {/* FILTER BAR */}
      {(filterableParams.length > 0 ||
        isSectorFilterable ||
        (availableTags.length > 0 && isTagFilterable)) && (
        <div className={`filter-bar ${!showFilters ? "collapsed" : ""}`}>
          <div className="filter-top-row">
            <div className="filter-top-left">
              <div
                className="filter-toggle-group"
                onClick={() => setShowFilters(!showFilters)}
              >
                <span className="filter-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                </span>
                <span className="filter-label">Filters</span>
                {activeFilters.length > 0 && (
                  <span className="active-filter-badge">
                    {activeFilters.length}
                  </span>
                )}
                <span className={`filter-chevron ${showFilters ? "open" : ""}`}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>

              {(activeFilters.length > 0 || priceTrendFilter !== null) && (
                <button
                  className="reset-filters-btn-v2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters({});
                    setPriceTrendFilter(null);
                  }}
                  title="Clear all active filters"
                >
                  Reset Filters
                </button>
              )}

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
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search symbols... (Ctrl+K)"
                  aria-label="Search symbols"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="search-clear-btn"
                    onClick={() => setSearchQuery("")}
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
            </div>

            <div className="active-filters-summary">
              {!showFilters &&
                activeFilters.length > 0 &&
                activeFilters.map(([key, value]) => {
                  let label;
                  if (key === "__sector__") label = "Sector";
                  else if (key === "__tag__") label = "Tag";
                  else if (key === "__tradable__") label = "Tradable";
                  else label = params[key]?.label || key;

                  let displayValue = value;
                  if (typeof value === "boolean")
                    displayValue = value ? "Yes" : "No";
                  else if (value && typeof value === "object" && !Array.isArray(value)) {
                    // MA condition map: { "5": "below", "200": "above" }
                    const keys = Object.keys(value);
                    const above = keys
                      .filter((k) => value[k] === "above")
                      .sort((a, b) => a - b);
                    const below = keys
                      .filter((k) => value[k] === "below")
                      .sort((a, b) => a - b);

                    let parts = [];
                    if (above.length > 0) parts.push(`${above.join(", ")} (Above)`);
                    if (below.length > 0) parts.push(`${below.join(", ")} (Below)`);
                    displayValue = parts.join(" | ");
                  } else if (Array.isArray(value)) {
                    displayValue =
                      value.length > 2
                        ? `${value.length} Selected`
                        : value.join(", ");
                  }

                  return (
                    <span key={key} className="summary-pill">
                      {label}: <strong>{displayValue}</strong>
                    </span>
                  );
                })}
            </div>

            <div className="filter-actions">
              <button
                className="toggle-filters-btn"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Collapse" : "Show All Filters"}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="filter-items">
              {isSectorFilterable && (
                <div className="filter-item">
                  <label htmlFor="sector-filter">Sector</label>
                  <div className="filter-input-wrapper">
                    <MultiSelectDropdown
                      id="sector-filter"
                      options={sectors}
                      value={
                        Array.isArray(filters.__sector__)
                          ? filters.__sector__
                          : filters.__sector__
                            ? [filters.__sector__]
                            : []
                      }
                      onChange={(val) => setFilter("__sector__", val)}
                      placeholder="All"
                    />
                    {filters.__sector__ &&
                      (Array.isArray(filters.__sector__)
                        ? filters.__sector__.length > 0
                        : filters.__sector__ !== "") && (
                        <ClearButton
                          onClick={() => setFilter("__sector__", [])}
                          isSelect
                        />
                      )}
                  </div>
                </div>
              )}

              {(availableTags || []).length > 0 && isTagFilterable && (
                <div className="filter-item">
                  <label htmlFor="tag-filter">Tag</label>
                  <div className="filter-input-wrapper">
                    <MultiSelectDropdown
                      id="tag-filter"
                      options={availableTags}
                      value={
                        Array.isArray(filters.__tag__)
                          ? filters.__tag__
                          : filters.__tag__
                            ? [filters.__tag__]
                            : []
                      }
                      onChange={(val) => setFilter("__tag__", val)}
                      placeholder="All"
                    />
                    {filters.__tag__ &&
                      (Array.isArray(filters.__tag__)
                        ? filters.__tag__.length > 0
                        : filters.__tag__ !== "") && (
                        <ClearButton
                          onClick={() => setFilter("__tag__", [])}
                          isSelect
                        />
                      )}
                  </div>
                </div>
              )}

              {filterableParams.map(([key, p]) => (
                <div key={key} className={`filter-item ${key === "movingAverages" ? "filter-item-ma" : ""}`}>
                  <label htmlFor={`filter-param-${key}`}>
                    {p.label}
                    {(p.type === "number" || p.type === "date") && (
                      <span
                        className="info-help-icon"
                        title="Supports operators: > < >= <= = and ranges (e.g. 10-20)"
                      />
                    )}
                  </label>

                  <div className="filter-input-wrapper">
                    {key === "movingAverages" ? (
                      <MovingAverageFilter
                        id={`filter-param-${key}`}
                        value={filters[key]}
                        onChange={(val) => setFilter(key, val)}
                      />
                    ) : (
                      <>
                        {p.type === "checkbox" && (
                          <>
                            <select
                              id={`filter-param-${key}`}
                              className="select-control filter-select-control"
                              value={filters[key] ?? ""}
                              onChange={(e) =>
                                setFilter(
                                  key,
                                  e.target.value === ""
                                    ? ""
                                    : e.target.value === "true",
                                )
                              }
                            >
                              <option value="">All</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                            {filters[key] !== undefined && filters[key] !== "" && (
                              <ClearButton
                                onClick={() => setFilter(key, "")}
                                isSelect
                              />
                            )}
                          </>
                        )}

                        {p.type === "select" && (
                          <>
                            <MultiSelectDropdown
                              id={`filter-param-${key}`}
                              options={p.options || []}
                              value={
                                Array.isArray(filters[key])
                                  ? filters[key]
                                  : filters[key]
                                    ? [filters[key]]
                                    : []
                              }
                              onChange={(val) => setFilter(key, val)}
                              placeholder="All"
                            />
                            {filters[key] !== undefined &&
                              (Array.isArray(filters[key])
                                ? filters[key].length > 0
                                : filters[key] !== "") && (
                                <ClearButton
                                  onClick={() => setFilter(key, [])}
                                  isSelect
                                />
                              )}
                          </>
                        )}

                        {(p.type === "text" ||
                          p.type === "number" ||
                          p.type === "date") && (
                          <>
                            <input
                              id={`filter-param-${key}`}
                              type="text"
                              className="filter-input input-with-icon-padding"
                              value={filters[key] || ""}
                              onChange={(e) => setFilter(key, e.target.value)}
                              placeholder={
                                (key.toLowerCase().includes("liquidity") || (p.label && p.label.toLowerCase().includes("liquidity")))
                                  ? (country === "IN" ? "Filter (Cr).." : "Filter (M)..")
                                  : "Filter.."
                              }
                            />
                            {filters[key] !== undefined && filters[key] !== "" && (
                              <ClearButton onClick={() => setFilter(key, "")} />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {isTradableFilterable && (
                <div className="filter-item">
                  <label>Tradable</label>
                  <div className="grid-full-width-relative">
                    <select
                      className="select-control input-with-icon-padding"
                      value={filters.__tradable__ ?? ""}
                      onChange={(e) =>
                        setFilter(
                          "__tradable__",
                          e.target.value === ""
                            ? ""
                            : e.target.value === "true",
                        )
                      }
                    >
                      <option value="">All</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                    {filters.__tradable__ !== undefined &&
                      filters.__tradable__ !== "" && (
                        <ClearButton
                          onClick={() => setFilter("__tradable__", "")}
                          isSelect
                        />
                      )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid-header">
        <div className="command-left">
          {(week?.lastUpdatedTime || week?.lastSyncDate) && (
            <div className="last-updated-note flex items-center gap-2 text-[11px] text-slate-400 font-medium py-1">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong className="text-slate-300 font-bold">Last synced:</strong> {week.lastUpdatedTime 
                    ? new Date(week.lastUpdatedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : (week.lastSyncDate ? week.lastSyncDate.split('-').reverse().join('-') : 'Never')}
                </span>
              </div>

              {advancesAndDeclines.total > 0 && (
                <div className="advances-declines-summary flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-700">
                  <span
                    className={`advances-badge-interactive ${priceTrendFilter === "up" ? "active-up" : ""}`}
                    onClick={() => setPriceTrendFilter(prev => prev === "up" ? null : "up")}
                    title="Advances (Price Up)"
                  >
                    ▲ {advancesAndDeclines.advances}
                  </span>
                  <span
                    className={`declines-badge-interactive ${priceTrendFilter === "down" ? "active-down" : ""}`}
                    onClick={() => setPriceTrendFilter(prev => prev === "down" ? null : "down")}
                    title="Declines (Price Down)"
                  >
                    ▼ {advancesAndDeclines.declines}
                  </span>
                  {advancesAndDeclines.unchanged > 0 && (
                    <span className="text-slate-400 font-semibold cursor-default select-none" title="Unchanged">
                      ■ {advancesAndDeclines.unchanged}
                    </span>
                  )}
                </div>
              )}
              
              {!isReadOnly && (
                <>
                  <button 
                    className={`force-sync-btn ${(fetchProgress.total > 0 || loadingQuotes) ? 'is-syncing' : ''}`}
                    onClick={() => triggerFullSync(true)}
                    title="Force refresh all stock metrics"
                    disabled={fetchProgress.total > 0 || loadingQuotes}
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
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.3" />
                    </svg>
                  </button>

                  <button
                    className={`force-sync-btn ${detectingSectors ? 'is-syncing' : ''}`}
                    onClick={handleDetectSectors}
                    title="Detect missing sectors using Cache & AI"
                    disabled={detectingSectors}
                  >
                    {detectingSectors ? (
                      <span className="spinner-mini" style={{ borderTopColor: 'currentColor', width: '10px', height: '10px' }} />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        width="13"
                        height="13"
                      >
                        <rect x="3" y="3" width="7" height="9" rx="1.5" />
                        <rect x="14" y="3" width="7" height="5" rx="1.5" />
                        <rect x="14" y="12" width="7" height="9" rx="1.5" />
                        <rect x="3" y="16" width="7" height="5" rx="1.5" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {(fetchProgress.total > 0 || aiProgress.total > 0) && (
          <div className="sync-badges-container">
            {fetchProgress.total > 0 && (
              <div className={`sync-activity-badge ${fetchProgress.completed >= fetchProgress.total ? "sync-finished" : ""}`}>
                <div className="status-dot" />
                <span>Fetching metrics in background..</span>
                <span className="percent">
                  {Math.round((fetchProgress.completed / fetchProgress.total) * 100)}%
                </span>
              </div>
            )}

            {aiProgress.total > 0 && (
              <div 
                className={`sync-activity-badge ai-badge ${aiProgress.completed >= aiProgress.total ? "sync-finished" : ""}`} 
                style={{ 
                  color: rateLimitWait ? "var(--color-warning, #f59e0b)" : "var(--color-primary)", 
                  borderColor: rateLimitWait ? "var(--color-warning, #f59e0b)" : "var(--color-primary-light)", 
                  cursor: "help" 
                }}
                title={rateLimitWait 
                  ? `Rate limit hit. Resuming in ~${rateLimitWait.waitSeconds}s... (${rateLimitWait.completed}/${rateLimitWait.total} stocks done)`
                  : (aiProgress.startTime && aiProgress.estimatedEndTime 
                    ? `Triggered: ${new Date(aiProgress.startTime).toLocaleTimeString()}\nEstimated Completion: ${new Date(aiProgress.estimatedEndTime).toLocaleTimeString()}` 
                    : "AI Analysis in progress...")}
              >
                <div className="status-dot" style={{ backgroundColor: rateLimitWait ? "var(--color-warning, #f59e0b)" : "var(--color-primary)", boxShadow: `0 0 8px ${rateLimitWait ? "var(--color-warning, #f59e0b)" : "var(--color-primary)"}` }} />
                {rateLimitWait 
                  ? <span>⏳ Rate limit – waiting {rateLimitWait.waitSeconds}s...</span>
                  : <span>AI Deep Analysis running...</span>
                }
                {!rateLimitWait && <span style={{ fontSize: "0.85em", opacity: 0.8, marginLeft: "-4px" }}>(Hover for ETA)</span>}
                <span className="percent">
                  {Math.round((aiProgress.completed / aiProgress.total) * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        <div className="command-right">
          <div className="dropdown-action-group" ref={exportMenuRef}>
            <button
              className="action-pill"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="icon-14"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              <span>Export</span>
            </button>
            {exportMenuOpen && (
              <ul className="action-dropdown shadow">
                <li onClick={() => handleExport("csv", "all")}>CSV / All</li>
                <li onClick={() => handleExport("csv", "filtered")}>
                  CSV / Filtered
                </li>
                <li onClick={() => handleExport("json", "all")}>JSON / All</li>
                <li onClick={() => handleExport("json", "filtered")}>
                  JSON / Filtered
                </li>
                <li className="divider" />
                <li
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportAll();
                  }}
                >
                  JSON / Backup
                </li>
              </ul>
            )}
          </div>

          <div className="dropdown-action-group" ref={importMenuRef}>
            <button
              className="action-pill"
              onClick={() => setImportMenuOpen(!importMenuOpen)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="icon-14"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 3v13.5m0 0-4.5-4.5M12 16.5l4.5-4.5"
                />
              </svg>
              <span>Import</span>
            </button>
            {importMenuOpen && (
              <ul className="action-dropdown shadow">
                <li onClick={() => triggerImport("stocks")}>
                  JSON / Current Week
                </li>
                <li onClick={() => triggerImport("tv")}>TXT / TradingView</li>
                <li className="divider" />
                <li onClick={() => triggerImport("backup")}>
                  JSON / Full Backup
                </li>
              </ul>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              hidden
            />
          </div>



          <button
            className="add-stock-cta"
            onClick={() => setShowAddStock(true)}
          >
            <span className="cta-icon">＋</span>
            Add
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div className="readonly-banner">
          <span className="lock-icon">🔒</span>
          <span>This is a previous week. Editing is disabled.</span>
        </div>
      )}

      {showAddStock && (
        <AddStockModal
          isOpen={true}
          onAdd={handleAddStock}
          onImport={importStocks}
          onClose={() => setShowAddStock(false)}
          existingStocks={week?.stocks}
          sectors={sectors}
          onParseTv={(content) => parseTradingViewData(content, sectors)}
          watchlists={data.watchlists || []}
          selectedWatchlistId={selectedWatchlistId}
        />
      )}

      {importPendingStocks && (
        <ImportWatchlistModal
          isOpen={true}
          stocks={importPendingStocks}
          watchlists={data.watchlists || []}
          selectedWatchlistId={selectedWatchlistId}
          onConfirm={(finalStocks) => {
            importStocks(finalStocks);
            setImportPendingStocks(null);
          }}
          onClose={() => setImportPendingStocks(null)}
        />
      )}

      {editingStock && (
        <EditStockModal
          isOpen={true}
          onClose={() => setEditingStock(null)}
          stock={week?.stocks?.[editingStock.symbol] || editingStock}
          onSave={handleUpdateStock}
          onDeleteStock={async (symbol) => {
            const deleted = await deleteStock(symbol);
            if (deleted) {
              setEditingStock(null);
            }
          }}
          paramDefinitions={data.paramDefinitions}
          sectors={sectors}
          availableTags={availableTags}
          weekInfo={getWeekRangeLabel(weekKey)}
          country={country}
          showTags={showTags}
          isDeepView={true}
          watchlists={data.watchlists || []}
          aiSettings={aiSettings}
          sortedStocks={sortedStocks}
          onSelectStock={setEditingStock}
          watchlistName={selectedWatchlistId === "all" ? "All Stocks" : (activeWatchlist?.name || "Watchlist")}
          onQuickLog={onQuickLog}
        />
      )}







      <div className="grid-scroll relative">
        {/* GRID SYNC PROGRESS BAR */}
        {fetchProgress.total > 0 && (
          <div className={`grid-sync-progress ${fetchProgress.completed >= fetchProgress.total ? "sync-finished" : ""}`}>
            <div className="grid-sync-progress-bar"></div>
          </div>
        )}
        {aiProgress.total > 0 && (
          <div className={`grid-sync-progress ${aiProgress.completed >= aiProgress.total ? "sync-finished" : ""}`} style={{ top: fetchProgress.total > 0 ? "2px" : "0px" }}>
            <div className="grid-sync-progress-bar" style={{ backgroundColor: "var(--color-primary)", width: "var(--ai-progress-width)" }}></div>
          </div>
        )}

        <table className="grid-table">
          <thead>
            <tr>
              <th
                className="sticky-col stock-col resizable-th cw-symbol"
                onClick={() => toggleSort("symbol")}
              >
                <div className="copy-stocks-wrapper">
                  <span>Stock{renderSortIndicator("symbol")}</span>
                  <button
                    className="copy-stocks-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const symbols = sortedStocks
                        .map((s) => s.symbol)
                        .join(", ");
                      navigator.clipboard.writeText(symbols).then(() => {
                        setCopiedStocks(true);
                        setTimeout(() => setCopiedStocks(false), 2000);
                      });
                    }}
                    title="Copy all visible stock symbols"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                    >
                      <rect x="9" y="9" width="10" height="10" />
                      <path d="M5 15V5h10" />
                    </svg>
                  </button>
                  {copiedStocks && (
                    <span className="copy-inline-toast">
                      Copied {sortedStocks.length} stocks!
                    </span>
                  )}
                </div>
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "symbol")}
                  onMouseDown={(e) => handleMouseDown(e, "symbol")}
                />
              </th>
              {showLivePrice && (
                <th
                  className="resizable-th cw-livePrice"
                  onClick={() => toggleSort("__livePrice__")}
                  style={{ cursor: "pointer" }}
                >
                  Live Price {renderSortIndicator("__livePrice__")}
                  <div
                    className="col-resizer"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => resetColWidth(e, "__livePrice__")}
                    onMouseDown={(e) => handleMouseDown(e, "__livePrice__")}
                  />
                </th>
              )}
              <th
                className="sector-col resizable-th cw-sector"
              >
                Sector
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "sector")}
                  onMouseDown={(e) => handleMouseDown(e, "sector")}
                />
              </th>
              {visibleParams.map(([key, p]) => {
                const isSortable =
                  p.type === "number" ||
                  p.type === "date" ||
                  p.type === "select" ||
                  p.type === "checkbox";
                return (
                  <th
                    key={key}
                    className={`resizable-th ${isSortable ? "cursor-pointer" : "cursor-default"} cw-${key}`}
                    onClick={isSortable ? () => toggleSort(key) : undefined}
                  >
                    {p.label}
                    {isSortable && renderSortIndicator(key)}
                    <div
                      className="col-resizer"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => resetColWidth(e, key)}
                      onMouseDown={(e) => handleMouseDown(e, key)}
                    />
                  </th>
                );
              })}


              <th
                className="resizable-th cw-checks"
                onClick={() => toggleSort("__checks__")}
              >
                Checks Passed{renderSortIndicator("__checks__")}
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "__checks__")}
                  onMouseDown={(e) => handleMouseDown(e, "__checks__")}
                />
              </th>
              <th
                className="resizable-th cw-tradable"
                onClick={() => toggleSort("tradable")}
              >
                Tradable {renderSortIndicator("tradable")}
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "tradable")}
                  onMouseDown={(e) => handleMouseDown(e, "tradable")}
                />
              </th>
              {showNotes && (
                <th
                  className="resizable-th notes-col cw-notes"
                >
                  Notes
                  <div
                    className="col-resizer"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => resetColWidth(e, "__notes__")}
                    onMouseDown={(e) => handleMouseDown(e, "__notes__")}
                  />
                </th>
              )}
              <th />
            </tr>
          </thead>

          <tbody>
            {stocks.map((stock) => (
              <tr
                key={stock.symbol}
                className={stock.tradable ? "tradable" : ""}
              >
                <td
                  className={`sticky-col stock-col ${activeTagDropdown === stock.symbol ? "elevated-cell" : ""}`}
                >
                  <div className="stock-cell-content">
                    <div className="stock-header-row">
                      <div className="symbol-cell-content">
                        <div className="flex items-center gap-1">
                          {!isReadOnly && (
                            <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, marginLeft: '-6px' }}>
                              <div 
                                className="stock-grid-flag-trigger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFlagMenuSymbol(activeFlagMenuSymbol === stock.symbol ? null : stock.symbol);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  borderRadius: '4px',
                                  transition: 'background 0.2s',
                                  flexShrink: 0
                                }}
                                title="Flag Stock"
                              >
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  width="12" 
                                  height="12" 
                                  viewBox="0 0 24 24" 
                                  fill={stock.flagColor ? FLAG_COLOR_MAP[stock.flagColor] : 'none'} 
                                  stroke={stock.flagColor ? FLAG_COLOR_MAP[stock.flagColor] : 'currentColor'} 
                                  strokeWidth="2.5" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                  style={{
                                    opacity: stock.flagColor ? 1 : 0.2,
                                    transition: 'opacity 0.2s',
                                  }}
                                >
                                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                  <line x1="4" y1="22" x2="4" y2="15"/>
                                </svg>
                              </div>

                              {activeFlagMenuSymbol === stock.symbol && (
                                <div 
                                  className="flag-row-popover" 
                                  style={{
                                    position: 'absolute',
                                    left: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'var(--panel, #1e293b)',
                                    border: '1px solid var(--border, rgba(255,255,255,0.15))',
                                    borderRadius: '20px',
                                    padding: '4px 8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    zIndex: 1000
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {Object.entries(FLAG_COLOR_MAP).map(([colorName, colorHex]) => (
                                    <button
                                      key={colorName}
                                      className="flag-color-dot"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = { ...stock, flagColor: colorName };
                                        handleUpdateStock(updated);
                                        setActiveFlagMenuSymbol(null);
                                      }}
                                      style={{
                                        background: colorHex,
                                        backgroundColor: colorHex
                                      }}
                                      title={`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Flag`}
                                    />
                                  ))}
                                  <button
                                    className="flag-clear-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updated = { ...stock, flagColor: null };
                                      handleUpdateStock(updated);
                                      setActiveFlagMenuSymbol(null);
                                    }}
                                    title="Clear Flag"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {isReadOnly && stock.flagColor && (
                            <span 
                              style={{
                                width: '6px',
                                height: '14px',
                                borderRadius: '2px',
                                backgroundColor: FLAG_COLOR_MAP[stock.flagColor],
                                display: 'inline-block',
                                flexShrink: 0,
                                marginLeft: '-6px'
                              }}
                              title={`${stock.flagColor.toUpperCase()} Flagged`}
                            />
                          )}
                          <span
                            className={`stock-symbol ${!isReadOnly ? "clickable" : ""}`}
                            onClick={() => {
                              if (!isReadOnly) {
                                setEditingStock(stock);
                              }
                            }}
                            title={!isReadOnly ? "Click to edit details" : ""}
                          >
                            {stock.symbol}
                            {stock.isInvalid && (
                              <span className="symbol-invalid-icon" title="Symbol not found or data unavailable. Please verify the ticker.">!</span>
                            )}
                          </span>
                          {!isReadOnly && (
                            <button
                              className="quick-log-trigger-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onQuickLog(stock.symbol);
                              }}
                              title={`Log ${stock.symbol} to Journal`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="quick-log-icon"
                              >
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {!isReadOnly && showTags && (
                        <div className="add-tag-wrapper">
                          <button
                            className={`add-tag-trigger ${activeTagDropdown === stock.symbol ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTagDropdown(
                                activeTagDropdown === stock.symbol
                                  ? null
                                  : stock.symbol,
                              );
                            }}
                            title={`Add Tag(s) to ${stock.symbol}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="tag-icon-small"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.5 2A2.5 2.5 0 002 4.5v2.879a2.5 2.5 0 00.732 1.767l8.122 8.121a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536L9.146 2.732A2.5 2.5 0 007.38 2H4.5zM5 5a1 1 0 100-2 1 1 0 000 2z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {activeTagDropdown === stock.symbol && (() => {
                            const userSelectableTags = availableTags.filter((t) => !t.toUpperCase().startsWith("AI:"));
                            return (
                              <div className="custom-tag-dropdown">
                                {userSelectableTags.length === 0 && (
                                  <div className="tag-option empty">
                                    No tags defined
                                  </div>
                                )}
                                {userSelectableTags.map((t) => {
                                  const isSelected = stock.tags?.includes(t);
                                  return (
                                    <div
                                      key={t}
                                      className={`tag-option ${isSelected ? "selected" : ""}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSelected) {
                                          removeTag(stock, t);
                                        } else {
                                          addTag(stock, t);
                                        }
                                      }}
                                    >
                                      {t}
                                      {isSelected && <span>✓</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    {showTags && stock.tags && stock.tags.length > 0 && (
                      <div className="stock-tags-inline">
                        {(() => {
                          const MAX_VISIBLE_TAGS = 1;
                          const visibleTags = stock.tags.slice(0, MAX_VISIBLE_TAGS);
                          const overflowCount = stock.tags.length - MAX_VISIBLE_TAGS;
                          const remainingTagsList = stock.tags.slice(MAX_VISIBLE_TAGS).join(', ');

                          return (
                            <>
                              {visibleTags.map((tag) => (
                                <span key={tag} className="tag-pill">
                                  {tag}
                                  <button
                                    className="tag-remove"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeTag(stock, tag);
                                    }}
                                    disabled={isReadOnly}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {overflowCount > 0 && (
                                <span
                                  className="tag-pill tag-overflow-pill"
                                  title={`+${overflowCount} more tag${overflowCount > 1 ? 's' : ''}: ${remainingTagsList}`}
                                >
                                  +{overflowCount}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </td>
                {showLivePrice && (
                  <td className="cw-livePrice">
                    {quotes[stock.symbol] ? (
                      <div className="flex flex-col gap-0.5 items-start">
                        <div className="stock-grid-price-row">
                          <span className="stock-grid-price-val">
                            {(() => {
                              const q = quotes[stock.symbol];
                              const priceVal = q.currentPrice;
                              const currencySymbol = country === 'US' ? '$' : '₹';
                              const locale = country === 'US' ? 'en-US' : 'en-IN';
                              return priceVal > 0 
                                ? `${currencySymbol}${priceVal.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—';
                            })()}
                          </span>
                          {quotes[stock.symbol].dailyChangePct !== undefined ? (
                            <span className={`stock-grid-price-change ${quotes[stock.symbol].isAdvancing ? 'adv' : 'dec'}`}>
                              {quotes[stock.symbol].dailyChangePct >= 0 ? '+' : ''}
                              {quotes[stock.symbol].dailyChangePct.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="stock-grid-price-change decimal">—</span>
                          )}
                        </div>
                        {quotes[stock.symbol].earningsDate && (
                          <span className="text-[9px] font-bold text-slate-450 dark:text-slate-500 font-mono tracking-tight" title="Next Earnings Date">
                            E: {(() => {
                              try {
                                const d = new Date(quotes[stock.symbol].earningsDate);
                                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                              } catch (_e) {
                                return quotes[stock.symbol].earningsDate;
                              }
                            })()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="stock-grid-price-placeholder">—</span>
                    )}
                  </td>
                )}
                <td className="sector-col cw-sector">
                  <div className="input-clear-wrapper type-select">
                    <select
                      className="select-control compact input-with-clear"
                      value={stock.sector || ""}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        updateStockField(stock.symbol, "sector", e.target.value);
                      }}
                    >
                      <option value=""></option>
                      {sectors.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {!isReadOnly && stock.sector && (
                      <ClearButton
                        onClick={() => {
                          updateStockField(stock.symbol, "sector", "");
                        }}
                        isSelect
                      />
                    )}
                  </div>
                </td>

                {visibleParams.map(([key, p]) => (
                  <td key={key} className={`cw-${key}`}>
                    {key === "movingAverages" && stock.params[key] ? (
                      <MovingAverageRibbon value={stock.params[key]} />
                    ) : (
                      <div className="param-standard-renderer">
                        {p.type === "checkbox" && (
                          <input
                            type="checkbox"
                            className="grid-checkbox compact"
                            checked={!!stock.params[key]}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              updateStockParam(stock.symbol, key, e.target.checked);
                            }}
                          />
                        )}

                        {p.type === "select" && (
                          <div className="input-clear-wrapper type-select">
                            <select
                              className="select-control input-with-clear"
                              value={stock.params[key] || ""}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                if (isReadOnly) return;
                                updateStockParam(stock.symbol, key, e.target.value);
                              }}
                            >
                              <option value=""></option>
                              {p.options?.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                            {!isReadOnly && stock.params[key] && (
                              <ClearButton
                                onClick={() => {
                                  updateStockParam(stock.symbol, key, "");
                                }}
                                isSelect
                              />
                            )}
                          </div>
                        )}

                        {p.type === "number" && (
                          <div className="input-clear-wrapper type-number">
                            <input
                              type="text"
                              className="grid-text-input input-with-clear"
                              value={stock.params[key] || ""}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                if (isReadOnly) return;
                                updateStockParam(stock.symbol, key, e.target.value);
                              }}
                            />
                            {!isReadOnly && stock.params[key] && (
                              <ClearButton
                                onClick={() => {
                                  updateStockParam(stock.symbol, key, "");
                                }}
                              />
                            )}
                          </div>
                        )}

                        {p.type === "date" && (
                          <div className="input-clear-wrapper type-date">
                            <input
                              key={stock.params[key] || "empty-date"}
                              type="date"
                              className="grid-text-input input-with-clear"
                              defaultValue={stock.params[key] || ""}
                              disabled={isReadOnly}
                              onBlur={(e) => {
                                if (isReadOnly) return;
                                if (stock.params[key] !== e.target.value) {
                                  updateStockParam(stock.symbol, key, e.target.value);
                                }
                              }}
                            />
                            {!isReadOnly && stock.params[key] && (
                              <ClearButton
                                onClick={() => {
                                  updateStockParam(stock.symbol, key, "");
                                }}
                                isSelect
                              />
                            )}
                          </div>
                        )}

                        {p.type === "text" && (
                          <div className="input-clear-wrapper">
                            <input
                              className="grid-text-input input-with-clear"
                              value={stock.params[key] || ""}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                if (isReadOnly) return;
                                updateStockParam(stock.symbol, key, e.target.value);
                              }}
                            />
                            {!isReadOnly && stock.params[key] && (
                              <ClearButton
                                onClick={() => {
                                  updateStockParam(stock.symbol, key, "");
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                ))}


                <td className="checks-cell cw-checks">{renderChecksBadge(stock)}</td>

                <td className="cw-tradable">
                  <input
                    type="checkbox"
                    className="grid-checkbox"
                    checked={stock.tradable}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      if (isReadOnly) return;
                      updateStockField(stock.symbol, "tradable", e.target.checked);
                    }}
                  />
                </td>
                {showNotes && (
                  <td className="notes-col cw-notes">
                    <div className="input-clear-wrapper">
                      <input
                        className="grid-notes-input input-with-clear"
                        value={stock.notes || ""}
                        title={stock.notes || ""}
                        disabled={isReadOnly}
                        placeholder="Notes.."
                        onChange={(e) => {
                          updateStockField(stock.symbol, "notes", e.target.value);
                        }}
                      />
                      {!isReadOnly && stock.notes && (
                        <ClearButton
                          onClick={() => {
                            updateStockField(stock.symbol, "notes", "");
                          }}
                        />
                      )}
                    </div>
                  </td>
                )}

                <td>
                  <button
                    className="delete-btn"
                    disabled={isReadOnly}
                    onClick={() => deleteStock(stock.symbol)}
                    title={isReadOnly ? "Read-only week" : "Delete stock"}
                  >
                    <TrashIcon size={20} />
                  </button>
                </td>
              </tr>
            ))}
            {stocks.length === 0 && (
              <tr>
                <td colSpan={colCount} className="empty-grid-row">
                  {isFiltering ? "No stocks found matching your filters" : "No stocks added to this week yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination-bar">
          <div className="pagination-left">
            <div className="page-size">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ◀
                </button>

                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  ▶
                </button>
              </div>
            )}
            <span className="total-count">
              <strong>Total Stocks: {filteredStocks.length}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
