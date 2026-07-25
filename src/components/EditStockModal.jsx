import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Modal from "./Modal";
import MiniCandlestickChart from "./MiniCandlestickChart";
import { fetchStockData, fetchStockQuotes } from "../utils/yahooFinanceMap";
import { getSingleStockAnalysis, PROMPT_TEMPLATES } from "../services/ai";
import { isParamRelevantForCountry, getActualParamKeyAndDef } from "../utils/paramUtils";
import MovingAverageRibbon from "./MovingAverageRibbon";

const checkIsAiBlocked = (blockedUntil) => {
  if (!blockedUntil) return false;
  return blockedUntil > Date.now();
};

const getRemainingBlockedSeconds = (blockedUntil) => {
  if (!blockedUntil) return 0;
  return Math.ceil((blockedUntil - Date.now()) / 1000);
};

const FLAG_COLOR_MAP = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7'
};

const hasUserModified = (original, updated, paramDefinitions) => {
  if (!original || !updated) return false;

  const normalize = (val) => {
    if (val === undefined || val === null || val === false || val === "") return "";
    return String(val);
  };

  // Sector
  if ((original.sector || "") !== (updated.sector || "")) {
    console.log("[hasUserModified] Sector changed:", original.sector, "->", updated.sector);
    return true;
  }

  // Tradable
  if (Boolean(original.tradable) !== Boolean(updated.tradable)) {
    console.log("[hasUserModified] Tradable changed:", original.tradable, "->", updated.tradable);
    return true;
  }

  // Notes
  if ((original.notes || "") !== (updated.notes || "")) {
    console.log("[hasUserModified] Notes changed:", original.notes, "->", updated.notes);
    return true;
  }

  // AI Analysis
  if ((original.aiAnalysis || "") !== (updated.aiAnalysis || "")) {
    console.log("[hasUserModified] AI Analysis changed");
    return true;
  }
  if ((original.aiAnalysisDate || "") !== (updated.aiAnalysisDate || "")) {
    console.log("[hasUserModified] AI Analysis Date changed");
    return true;
  }

  // Params - only compare checklist keys defined in paramDefinitions
  const origParams = original.params || {};
  const updParams = updated.params || {};
  const checklistKeys = Object.keys(paramDefinitions || {});
  for (const key of checklistKeys) {
    const v1 = origParams[key];
    const v2 = updParams[key];
    const norm1 = normalize(v1);
    const norm2 = normalize(v2);
    if (norm1 !== norm2) {
      console.log(`[hasUserModified] Param [${key}] changed:`, v1, "->", v2);
      return true;
    }
  }

  // Tags
  const origTags = original.tags || [];
  const updTags = updated.tags || [];
  if (origTags.length !== updTags.length) {
    console.log("[hasUserModified] Tags length changed:", origTags.length, "->", updTags.length);
    return true;
  }
  const sortedOrigTags = [...origTags].sort();
  const sortedUpdTags = [...updTags].sort();
  for (let i = 0; i < sortedOrigTags.length; i++) {
    if (sortedOrigTags[i] !== sortedUpdTags[i]) {
      console.log("[hasUserModified] Tag value changed:", sortedOrigTags[i], "->", sortedUpdTags[i]);
      return true;
    }
  }

  // Watchlists
  const origWls = original.watchlists || [];
  const updWls = updated.watchlists || [];
  if (origWls.length !== updWls.length) {
    console.log("[hasUserModified] Watchlists length changed:", origWls.length, "->", updWls.length);
    return true;
  }
  const sortedOrigWls = [...origWls].sort();
  const sortedUpdWls = [...updWls].sort();
  for (let i = 0; i < sortedOrigWls.length; i++) {
    if (sortedOrigWls[i] !== sortedUpdWls[i]) {
      console.log("[hasUserModified] Watchlist ID changed:", sortedOrigWls[i], "->", sortedUpdWls[i]);
      return true;
    }
  }

  // Flag Color
  if ((original.flagColor || "") !== (updated.flagColor || "")) {
    console.log("[hasUserModified] Flag Color changed:", original.flagColor, "->", updated.flagColor);
    return true;
  }

  return false;
};

export default function EditStockModal({
  isOpen,
  onClose,
  stock,
  onSave,
  paramDefinitions,
  sectors,
  availableTags,
  weekInfo: _weekInfo,
  country,
  showTags = true,
  aiSettings = {},
  isDeepView = false,
  onUpdateStock = null,
  watchlists = [],
  sortedStocks = [],
  onSelectStock = null,
  watchlistName = "Watchlist",
  onQuickLog = null,
  onDeleteStock = null
}) {
  const [formData, setFormData] = useState(() => stock ? structuredClone(stock) : null);
  const [activeFlagMenuSymbol, setActiveFlagMenuSymbol] = useState(null);

  const adrInfo = useMemo(() => getActualParamKeyAndDef(paramDefinitions, 'adr', 'adr', country), [paramDefinitions, country]);
  const liqInfo = useMemo(() => getActualParamKeyAndDef(paramDefinitions, 'liquidity', 'liquidity', country), [paramDefinitions, country]);
  const adrKey = adrInfo?.key || 'adr';
  const liqKey = liqInfo?.key || 'liquidity';

  const adrValue = formData?.params?.[adrKey];
  const liqValue = formData?.params?.[liqKey];

  const formattedAdrValue = useMemo(() => {
    if (adrValue === undefined || adrValue === null || adrValue === '') return null;
    const str = String(adrValue).trim();
    if (!str) return null;
    return str.endsWith('%') ? str : `${str}%`;
  }, [adrValue]);

  const formattedLiqValue = useMemo(() => {
    if (liqValue === undefined || liqValue === null || liqValue === '') return null;
    return String(liqValue).trim();
  }, [liqValue]);

  const handleUpdateStockFlag = useCallback((symbol, color) => {
    if (symbol === formData?.symbol) {
      setFormData(prev => {
        const updated = { ...prev, flagColor: color };
        if (onUpdateStock) {
          onUpdateStock(updated);
        } else if (onSave) {
          onSave(updated);
        }
        return updated;
      });
    } else {
      const targetStock = sortedStocks.find(s => s.symbol === symbol);
      if (targetStock) {
        const updated = { ...targetStock, flagColor: color };
        if (onUpdateStock) {
          onUpdateStock(updated);
        } else if (onSave) {
          onSave(updated);
        }
      }
    }
  }, [formData?.symbol, sortedStocks, onUpdateStock, onSave]);

  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true);
  const [timeframe, setTimeframe] = useState('3mo');
  const [interval, setInterval] = useState('auto');
  const [loadingChart, setLoadingChart] = useState(false);
  const [maSettings, setMaSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('trade_clarity_ma_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to parse saved MA settings:", e);
    }
    return {
      '5': { visible: false, color: '#10b981', thickness: 1 },
      '10': { visible: false, color: '#06b6d4', thickness: 1 },
      '21': { visible: false, color: '#3b82f6', thickness: 1 },
      '50': { visible: true, color: '#f59e0b', thickness: 2 },
      '200': { visible: true, color: '#ef4444', thickness: 2 }
    };
  });
  const [isMaPopoverOpen, setIsMaPopoverOpen] = useState(false);
  const [isGroupingPopoverOpen, setIsGroupingPopoverOpen] = useState(false);
  const [sidebarGrouping, setSidebarGrouping] = useState('none'); // 'none' | 'sector' | 'tag' | 'flag'
  const [activeGroupKey, setActiveGroupKey] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({}); // { [groupKey]: boolean }
  const maSettingsRef = useRef(null);
  const groupingPopoverRef = useRef(null);
  const handleSetSidebarGrouping = useCallback((mode) => {
    setSidebarGrouping(mode);
    setActiveGroupKey(null);
    setIsGroupingPopoverOpen(false);
  }, []);

  const groupedStocks = useMemo(() => {
    if (!sortedStocks) return [];
    if (sidebarGrouping === 'none') {
      return [{ key: 'all', title: '', stocks: sortedStocks }];
    }
    
    const groups = {};
    if (sidebarGrouping === 'sector') {
      sortedStocks.forEach(s => {
        const sec = s.sector || 'Unassigned';
        if (!groups[sec]) groups[sec] = { key: sec, title: sec, stocks: [] };
        groups[sec].stocks.push(s);
      });
    } else if (sidebarGrouping === 'tag') {
      sortedStocks.forEach(s => {
        const tags = s.tags && s.tags.length > 0 ? s.tags : ['No Tags'];
        tags.forEach(t => {
          if (!groups[t]) groups[t] = { key: t, title: t, stocks: [] };
          groups[t].stocks.push(s);
        });
      });
    } else if (sidebarGrouping === 'flag') {
      sortedStocks.forEach(s => {
        const flagKey = s.flagColor || 'none';
        const flagTitle = s.flagColor ? `${s.flagColor.toUpperCase()} FLAG` : 'No Flag';
        if (!groups[flagKey]) groups[flagKey] = { key: flagKey, title: flagTitle, flagColor: s.flagColor || null, stocks: [] };
        groups[flagKey].stocks.push(s);
      });
    }
    
    return Object.values(groups)
      .sort((a, b) => {
        if (a.key === 'Unassigned' || a.key === 'No Tags' || a.key === 'none' || a.key === 'No Flag') return 1;
        if (b.key === 'Unassigned' || b.key === 'No Tags' || b.key === 'none' || b.key === 'No Flag') return -1;
        return a.title.localeCompare(b.title);
      });
  }, [sortedStocks, sidebarGrouping]);

  // Auto-expand the active stock's parent group(s)
  useEffect(() => {
    if (!formData?.symbol || sidebarGrouping === 'none') return;
    (groupedStocks || []).forEach(g => {
      const hasActive = g.stocks.some(s => s.symbol === formData.symbol);
      const isTargetGroup = activeGroupKey ? g.key === activeGroupKey : hasActive;
      if (isTargetGroup) {
        setCollapsedGroups(prev => {
          if (prev[g.key] === false) return prev;
          return { ...prev, [g.key]: false };
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.symbol, sidebarGrouping, activeGroupKey]);

  const handleUpdateMaSetting = useCallback((ma, key, value) => {
    setMaSettings(prev => {
      const next = { ...prev };
      next[ma] = {
        ...next[ma],
        [key]: value
      };
      try {
        localStorage.setItem('trade_clarity_ma_settings', JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save MA settings:", e);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (maSettingsRef.current && !maSettingsRef.current.contains(event.target)) {
        setIsMaPopoverOpen(false);
      }
      if (groupingPopoverRef.current && !groupingPopoverRef.current.contains(event.target)) {
        setIsGroupingPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



  // Resizability State
  const [topHeight, setTopHeight] = useState(340); // px
  const [leftWidth, setLeftWidth] = useState(65);   // %
  const [isResizingV, setIsResizingV] = useState(false);
  const [isResizingH, setIsResizingH] = useState(false);

  // AI State Restoration
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisDate, setAiAnalysisDate] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Watchlist Navigation & Workspace State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [sidebarStockData, setSidebarStockData] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const prevSymbolRef = useRef(null);
  const sidebarListRef = useRef(null);

  const userSelectableTags = (availableTags || []).filter(
    (tag) => !tag.toUpperCase().startsWith("AI:")
  );

  useEffect(() => {
    if (!isOpen || !formData?.symbol) return;
    requestAnimationFrame(() => {
      if (sidebarListRef.current) {
        const activeEl = sidebarListRef.current.querySelector('.sidebar-item-premium.active');
        if (activeEl && typeof activeEl.scrollIntoView === 'function') {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });
  }, [formData?.symbol, isOpen]);

  useEffect(() => {
    if (stock && stock.symbol) {
      if (prevSymbolRef.current !== stock.symbol) {
        setFormData(structuredClone(stock));
        setAiAnalysis(stock.aiAnalysis || null);
        setAiAnalysisDate(stock.aiAnalysisDate || null);
        setAiError(null);
        prevSymbolRef.current = stock.symbol;
      }
    } else {
      prevSymbolRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock?.symbol]);

  const sortedSymbolsSerialized = useMemo(() => {
    return (sortedStocks || []).map(s => s.symbol).join(",");
  }, [sortedStocks]);

  const fetchSidebarQuotes = useCallback(async (signal = null, forceRefresh = false) => {
    if (!sortedSymbolsSerialized) return;
    const symbols = sortedSymbolsSerialized.split(",").filter(Boolean);
    if (symbols.length === 0) return;
    setLoadingQuotes(true);
    try {
      const results = await fetchStockQuotes(symbols, country, signal, forceRefresh);
      if (results && results.length > 0) {
        const mapping = {};
        results.forEach(r => {
          mapping[r.symbol] = {
            dailyChangePct: r.dailyChangePct,
            isAdvancing: r.isAdvancing,
            currentPrice: r.currentPrice,
            earningsDate: r.earningsDate
          };
        });
        setSidebarStockData(mapping);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch sidebar quote data:", err);
      }
    } finally {
      setLoadingQuotes(false);
    }
  }, [sortedSymbolsSerialized, country]);

  // Fetch 1d daily quotes in background on mount or symbols list changes (once sidebar is visible)
  useEffect(() => {
    if (!isOpen || !sortedSymbolsSerialized) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSidebarQuotes(controller.signal);
    return () => {
      controller.abort();
    };
  }, [isOpen, sortedSymbolsSerialized, fetchSidebarQuotes]);

  // Manual refresh callback
  const handleRefreshSidebarQuotes = useCallback(() => {
    fetchSidebarQuotes(null, true);
  }, [fetchSidebarQuotes]);

  const symbolToFetch = formData?.symbol;

  // On-demand data loading for Chart (e.g. when clicked from Stock Grid or duration changed)
  useEffect(() => {
    if (!isOpen || !symbolToFetch) return;

    let isCurrent = true;

    const loadChartData = async () => {
      setLoadingChart(true);
      try {
        const fetchTimeframe = (interval === '1d' || interval === '1wk' || (interval === 'auto' && ['1mo', '3mo', '6mo', 'ytd', '1y'].includes(timeframe))) ? '2y' : timeframe;
        const results = await fetchStockData([symbolToFetch], country, fetchTimeframe, interval);
        if (isCurrent && results && results.length > 0) {
          // Double check that the symbol fetched matches the current stock prop
          if (symbolToFetch === stock.symbol) {
            setFormData(prev => {
              // Only apply if the symbol in prev still matches the fetched symbol
              if (prev && prev.symbol === symbolToFetch) {
                return {
                  ...prev,
                  ...results[0],
                  // Ensure we don't overwrite user changes to params/notes if they already exist
                  params: prev.params || results[0].params,
                  notes: prev.notes || results[0].notes
                };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch candlestick data:", err);
      } finally {
        if (isCurrent) {
          setLoadingChart(false);
        }
      }
    };

    // Refetch if missing data OR if this is being triggered by a timeframe/interval change
    loadChartData();

    return () => {
      isCurrent = false;
    };
  }, [isOpen, symbolToFetch, country, timeframe, interval, stock.symbol]);

  // Reset interval to 'auto' when timeframe changes to ensure compatible range/interval defaults
  useEffect(() => {
    const resetTimeout = setTimeout(() => {
      setInterval('auto');
    }, 0);
    return () => clearTimeout(resetTimeout);
  }, [timeframe]);

  // Resizer Event Handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingV) {
        // Calculate relative to modal top
        setTopHeight(Math.max(80, Math.min(500, e.clientY - 120)));
      }
      if (isResizingH) {
        // Calculate relative to window width
        setLeftWidth(Math.max(30, Math.min(80, (e.clientX / window.innerWidth) * 100)));
      }
    };
    const handleMouseUp = () => {
      setIsResizingV(false);
      setIsResizingH(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingV || isResizingH) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isResizingV ? 'row-resize' : 'col-resize';
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingV, isResizingH]);

  const effectiveNavigationItems = useMemo(() => {
    if (sidebarGrouping === 'none' || !groupedStocks || groupedStocks.length === 0) {
      return (sortedStocks || []).map(s => ({ stock: s, groupKey: null }));
    }
    const items = [];
    groupedStocks.forEach(group => {
      group.stocks.forEach(s => {
        items.push({ stock: s, groupKey: group.key });
      });
    });
    return items.length > 0 ? items : (sortedStocks || []).map(s => ({ stock: s, groupKey: null }));
  }, [sortedStocks, groupedStocks, sidebarGrouping]);

  const currentIndex = useMemo(() => {
    if (!effectiveNavigationItems || effectiveNavigationItems.length === 0) return -1;
    if (activeGroupKey) {
      const exactIdx = effectiveNavigationItems.findIndex(
        item => item.stock.symbol === stock?.symbol && item.groupKey === activeGroupKey
      );
      if (exactIdx !== -1) return exactIdx;
    }
    return effectiveNavigationItems.findIndex(item => item.stock.symbol === stock?.symbol);
  }, [effectiveNavigationItems, stock?.symbol, activeGroupKey]);

  const handleSelectStock = useCallback((targetStock, groupKey = null) => {
    if (groupKey !== undefined) {
      setActiveGroupKey(groupKey);
    }
    if (formData) {
      const finalData = {
        ...formData,
        aiAnalysis,
        aiAnalysisDate
      };
      if (hasUserModified(stock, finalData, paramDefinitions)) {
        if (onUpdateStock) {
          onUpdateStock(finalData);
        } else if (onSave) {
          onSave(finalData);
        }
      }
    }
    if (onSelectStock) {
      onSelectStock(targetStock);
    }
  }, [formData, aiAnalysis, aiAnalysisDate, stock, paramDefinitions, onUpdateStock, onSave, onSelectStock]);

  const handleNavigate = useCallback((direction) => {
    if (!effectiveNavigationItems || effectiveNavigationItems.length <= 1 || currentIndex === -1) return;
    let nextIndex = currentIndex;
    if (direction === 'next') {
      nextIndex = currentIndex + 1;
    } else if (direction === 'prev') {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex >= 0 && nextIndex < effectiveNavigationItems.length) {
      const nextItem = effectiveNavigationItems[nextIndex];
      handleSelectStock(nextItem.stock, nextItem.groupKey);
    }
  }, [effectiveNavigationItems, currentIndex, handleSelectStock]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsNavDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Focus on search input when Ctrl+K or Cmd+K is pressed
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
        if (isOpen && searchInputRef.current) {
          e.preventDefault();
          e.stopPropagation();
          searchInputRef.current.focus();
          searchInputRef.current.select();
          setIsNavDropdownOpen(true);
          return;
        }
      }

      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || activeEl.isContentEditable) {
          return;
        }
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigate('prev');
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentIndex, effectiveNavigationItems, formData, aiAnalysis, aiAnalysisDate, isOpen, handleNavigate]);

  const filteredNavStocks = (sortedStocks || []).filter(s => {
    const q = navSearchQuery.toLowerCase().trim();
    if (!q) return false;
    const name = s.longName || s.name || '';
    return s.symbol.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  // Note: We MUST NOT return null early if we want the Modal's ESC listener to function.
  // The Modal itself handles its own null rendering via the isOpen prop.
  // However, we still need formData to render the content, so we gate the interior.

  const handleSave = () => {
    const finalData = {
      ...formData,
      aiAnalysis,
      aiAnalysisDate
    };

    if (onUpdateStock) {
      onUpdateStock(finalData);
    } else {
      onSave(finalData);
    }
    onClose();
  };

  const handleDeleteStockItem = useCallback(async (targetSymbol) => {
    if (!onDeleteStock || !targetSymbol) return;
    const isCurrentActive = targetSymbol === formData.symbol;
    
    // Find index of target stock before deletion
    const list = sortedStocks || [];
    const currentIndex = list.findIndex(s => s.symbol === targetSymbol);

    await onDeleteStock(targetSymbol);

    if (isCurrentActive) {
      const remaining = list.filter(s => s.symbol !== targetSymbol);
      if (remaining.length > 0) {
        // Select stock below (same index in remaining), or stock above if last item
        const nextIndex = (currentIndex >= 0 && currentIndex < remaining.length)
          ? currentIndex 
          : Math.max(0, remaining.length - 1);
        handleSelectStock(remaining[nextIndex]);
      } else {
        onClose();
      }
    }
  }, [onDeleteStock, formData.symbol, sortedStocks, handleSelectStock, onClose]);

  const handleDelete = useCallback(async () => {
    if (formData.symbol) {
      await handleDeleteStockItem(formData.symbol);
    }
  }, [formData.symbol, handleDeleteStockItem]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Del") {
        const activeTag = document.activeElement?.tagName;
        const isEditingInput = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
        
        if (e.altKey || e.ctrlKey || !isEditingInput) {
          e.preventDefault();
          handleDelete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDelete]);

  const [selectedPromptId, setSelectedPromptId] = useState(aiSettings?.promptLibrary?.defaults?.stock || "default");

  // Library Management
  const stockLibrary = aiSettings?.promptLibrary?.stock || [];
  const allStrategies = [
    { id: "default", label: `Deep Analysis ${(!aiSettings?.promptLibrary?.defaults?.stock || aiSettings?.promptLibrary?.defaults?.stock === "system" || aiSettings?.promptLibrary?.defaults?.stock === "default") ? "(Active)" : ""}`, text: PROMPT_TEMPLATES.find(t => t.value === 'deep_view')?.text || "" },
    { id: "daily_move", label: `Daily Price Action ${aiSettings?.promptLibrary?.defaults?.stock === "daily_move" ? "(Active)" : ""}`, text: PROMPT_TEMPLATES.find(t => t.value === 'daily_move')?.text || "" },
    ...stockLibrary.map(p => ({ ...p, label: `${p.label} ${aiSettings?.promptLibrary?.defaults?.stock === p.id ? "(Active)" : ""}` }))
  ];

  const handleRunAi = async () => {
    const isAiBlocked = checkIsAiBlocked(aiSettings?.aiState?.blockedUntil);
    if (isAiBlocked) {
      const remainingSecs = getRemainingBlockedSeconds(aiSettings.aiState.blockedUntil);
      setAiError(`AI Request Limit Reached. Available again in ${remainingSecs}s.`);
      return;
    }

    if (!aiSettings?.apiKey) {
      setAiError("API Key not configured in Settings.");
      return;
    }

    setLoadingAi(true);
    setAiError(null);
    try {
      const strategy = allStrategies.find(s => s.id === selectedPromptId) || allStrategies[0];
      const result = await getSingleStockAnalysis(
        aiSettings.apiKey,
        aiSettings.model,
        formData,
        timeframe,
        strategy.text
      );
      setAiAnalysis(result.rawText);
      setAiAnalysisDate(new Date().toLocaleString());
    } catch (err) {
      setAiError(err.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleParamChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      params: { ...prev.params, [key]: value },
    }));
  };

  const toggleWatchlist = (wlId) => {
    const currentWls = formData.watchlists || [];
    if (currentWls.includes(wlId)) {
      setFormData((prev) => ({
        ...prev,
        watchlists: currentWls.filter((id) => id !== wlId),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        watchlists: [...currentWls, wlId],
      }));
    }
  };

  const toggleTag = (tag) => {
    const currentTags = formData.tags || [];
    if (currentTags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: currentTags.filter((t) => t !== tag),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        tags: [...currentTags, tag],
      }));
    }
  };

  const sortedParams = Object.entries(paramDefinitions || {})
    .filter(([, def]) => isParamRelevantForCountry(def, country))
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

  const SafeMarkdown = ({ text }) => {
    if (!text) return null;

    // Split by lines to handle bullet points and blocks
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    const flushList = (key) => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="analysis-unordered-list">
            {currentList.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
          </ul>
        );
        currentList = [];
      }
    };

    const parseInline = (str) => {
      // Handle bold **text**
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        currentList.push(trimmed.slice(2));
      } else {
        flushList(index);
        if (trimmed) {
          elements.push(<p key={index} className="analysis-text-block">{parseInline(trimmed)}</p>);
        }
      }
    });
    flushList('final');

    return <>{elements}</>;
  };

  const renderAiAnalysis = () => {
    if (!aiAnalysis) return null;

    // Check if the analysis contains section headers
    const hasHeaders = aiAnalysis.includes('###');

    if (!hasHeaders) {
      const lines = aiAnalysis.split('\n');
      const sections = [];
      let currentSection = null;

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let key = '';
        let value = '';
        let matched = false;

        const boldMatch = trimmed.match(/^\*\*(.*?)\*\*:(.*)$/) || trimmed.match(/^\*\*(.*?):\*\*(.*)$/);
        if (boldMatch) {
          key = boldMatch[1].replace(/:$/, '').trim();
          value = boldMatch[2].trim();
          matched = true;
        } else {
          const plainMatch = trimmed.match(/^([A-Za-z0-9\s]+):(.*)$/);
          if (plainMatch) {
            key = plainMatch[1].trim();
            value = plainMatch[2].trim();
            matched = true;
          }
        }

        if (matched && key.length > 0 && key.length <= 25) {
          if (currentSection) {
            sections.push(currentSection);
          }
          currentSection = {
            title: key.toUpperCase(),
            content: value,
          };
        } else {
          if (currentSection) {
            currentSection.content += '\n' + trimmed;
          } else {
            currentSection = {
              title: '',
              content: trimmed,
            };
          }
        }
      });

      if (currentSection) {
        sections.push(currentSection);
      }

      if (sections.length > 0 && sections.some(s => s.title)) {
        return (
          <div className="deep-analysis-results themed-scroll">
            {sections.map((section, idx) => (
              <div key={idx} className="analysis-section-box">
                {section.title && <h4 className="analysis-section-title">{section.title}</h4>}
                {section.content && (
                  <div className="analysis-section-content">
                    <SafeMarkdown text={section.content} />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      // Fallback: Just render the whole text as markdown
      return (
        <div className="deep-analysis-results themed-scroll">
          <div className="analysis-section-content">
            <SafeMarkdown text={aiAnalysis} />
          </div>
        </div>
      );
    }

    const parseInlineHeader = (str) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    // If it has headers, split by '###'
    const parts = aiAnalysis.split(/###\s+/);
    const elements = [];

    parts.forEach((part, idx) => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;

      // If it's the very first part, and the original text didn't start with '###',
      // then this part is introductory text and has no title.
      const isIntro = idx === 0 && !aiAnalysis.startsWith('###');

      if (isIntro) {
        elements.push(
          <div key={idx} className="analysis-section-box no-title">
            <div className="analysis-section-content">
              <SafeMarkdown text={trimmedPart} />
            </div>
          </div>
        );
      } else {
        const lines = trimmedPart.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        elements.push(
          <div key={idx} className="analysis-section-box">
            {title && <h4 className="analysis-section-title">{parseInlineHeader(title)}</h4>}
            {content && (
              <div className="analysis-section-content">
                <SafeMarkdown text={content} />
              </div>
            )}
          </div>
        );
      }
    });

    return (
      <div className="deep-analysis-results themed-scroll">
        {elements}
      </div>
    );
  };

  const renderFormContent = () => (
    <>
      <div className="property-grid-enterprise">
        <div className="property-row-item">
          <label>Sector</label>
          <select
            value={formData.sector || ""}
            onChange={(e) => handleChange("sector", e.target.value)}
          >
            <option value="">Select...</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="property-row-item">
          <label>Tradable</label>
          <label className="checkbox-label-premium">
            <input
              type="checkbox"
              checked={formData.tradable}
              onChange={(e) => handleChange("tradable", e.target.checked)}
            />
          </label>
        </div>

        {sortedParams.filter(([key]) => key !== 'movingAverages' && key !== adrKey && key !== liqKey).map(([key, def]) => (
          <div key={key} className="property-row-item">
            <label>{def.label}</label>
            {def.type === "checkbox" ? (
              <label className="checkbox-label-premium">
                <input
                  type="checkbox"
                  checked={formData.params?.[key] === true}
                  onChange={(e) => handleParamChange(key, e.target.checked)}
                />
              </label>
            ) : def.type === "select" ? (
              <select
                value={formData.params?.[key] || ""}
                onChange={(e) => handleParamChange(key, e.target.value)}
              >
                <option value="">Select...</option>
                {def.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.params?.[key] || ""}
                onChange={(e) => handleParamChange(key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="combined-research-row-premium">
        {/* Column 1: Watchlists */}
        {watchlists.length > 0 && (
          <div className="research-col-watchlists-v2">
            <div className="pill-group-wrapper-v2">
              {watchlists.map((wl) => {
                const isSelected = formData.watchlists?.includes(wl.id);
                return (
                  <div
                    key={wl.id}
                    className={`tag-chip-selectable ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleWatchlist(wl.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleWatchlist(wl.id);
                      }
                    }}
                    title={`Watchlist: ${wl.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="watchlist-pill-icon">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>{wl.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Separator 1 */}
        {watchlists.length > 0 && (showTags && userSelectableTags.length > 0) && (
          <div className="separator-v2-premium" />
        )}

        {/* Column 2: Tags */}
        {showTags && userSelectableTags.length > 0 && (
          <div className="research-col-tags-v2">
            <div className="pill-group-wrapper-v2">
              {userSelectableTags.map((tag) => {
                const isSelected = formData.tags?.includes(tag);
                return (
                  <div
                    key={tag}
                    className={`tag-chip-selectable ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTag(tag);
                      }
                    }}
                  >
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span>{tag}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Separator 2 */}
        {(watchlists.length > 0 || (showTags && userSelectableTags.length > 0)) && (
          <div className="separator-v2-premium" />
        )}

        {/* Column 3: Notes (Always expands) */}
        <div className="research-col-notes-v2">
          <textarea
            className="description-area-premium"
            rows={1}
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Technical triggers, conviction level, and entry plan..."
          />
        </div>
      </div>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={isDeepView ? "deep-view-modal-wrapper" : ""}
    >
      <div className={`edit-stock-container ${isDeepView ? 'deep-view-layout' : 'standard-layout'}`}>
        {!formData ? (
          <div className="terminal-initializing-overlay">
            <div className="ai-loading-shimmer-v2">
              <div className="shimmer-bone-title" />
              <div className="shimmer-bone-body" />
              <p className="loading-txt-premium">Initializing Research Terminal...</p>
            </div>
          </div>
        ) : isDeepView ? (
          <>
            <div className="modal-header header-premium">
              <div className="modal-title-group-premium">
                <div className="terminal-header-title-wrapper">
                  <h1 className="symbol-header-hero">{formData.symbol}</h1>
                  {(formData.longName || formData.name) && (
                    <span className="modal-header-company-name">
                      {formData.longName || formData.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="terminal-header-actions-wrapper">
                {/* Previous / Next Navigation Arrows */}
                {effectiveNavigationItems && effectiveNavigationItems.length > 1 && currentIndex !== -1 && (
                  <div className="nav-arrows-group-premium">
                    <button
                      type="button"
                      className="nav-arrow-btn-premium"
                      onClick={() => handleNavigate('prev')}
                      title="Previous Stock (Left / Up Arrow)"
                      disabled={currentIndex <= 0}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="nav-counter-premium">
                      {currentIndex + 1} / {effectiveNavigationItems.length}
                    </span>
                    <button
                      type="button"
                      className="nav-arrow-btn-premium"
                      onClick={() => handleNavigate('next')}
                      title="Next Stock (Right / Down Arrow)"
                      disabled={currentIndex >= effectiveNavigationItems.length - 1}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Search Bar */}
                {sortedStocks && sortedStocks.length > 0 && (
                  <div className="nav-search-container-premium" ref={searchRef}>
                    <div className="nav-search-input-wrapper-premium">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search stock... (Ctrl+K)"
                        value={navSearchQuery}
                        onChange={(e) => {
                          setNavSearchQuery(e.target.value);
                          setIsNavDropdownOpen(true);
                        }}
                        onFocus={() => setIsNavDropdownOpen(true)}
                        className="nav-search-input-premium"
                      />
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="nav-search-icon-premium">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      {navSearchQuery && (
                        <button
                          type="button"
                          className="nav-search-clear-btn-premium"
                          onClick={() => setNavSearchQuery('')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {isNavDropdownOpen && filteredNavStocks.length > 0 && (
                      <div className="nav-search-dropdown-premium themed-scroll">
                        {filteredNavStocks.map((s) => (
                          <div
                            key={s.symbol}
                            className={`nav-search-item-premium ${s.symbol === formData.symbol ? 'active' : ''}`}
                            onClick={() => {
                              handleSelectStock(s);
                              setNavSearchQuery('');
                              setIsNavDropdownOpen(false);
                            }}
                          >
                            <span className="nav-search-item-symbol">{s.symbol}</span>
                            <span className="nav-search-item-name">{s.longName || s.name || ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="header-utility-icons-premium">
                  <a
                    href={country === 'IN' ? `https://www.tradingview.com/chart/?symbol=NSE:${formData.symbol}` : `https://www.tradingview.com/chart/?symbol=${formData.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-icon-action-btn"
                    title="View on TradingView"
                  >
                    <svg width="20" height="16" viewBox="0 0 36 28" fill="currentColor">
                      <path d="M14 22H7V11H0V4h14v18zM28 22h-7V11h7v11zm8-18H22v18h14V4z" />
                    </svg>
                  </a>
                  <a
                    href={country === 'IN' ? `https://www.screener.in/company/${formData.symbol}/` : `https://finance.yahoo.com/quote/${formData.symbol}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-icon-action-btn"
                    title={country === 'IN' ? "View on Screener" : "View on Yahoo Finance"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                  </a>
                </div>
                <div className="header-action-divider-v2-premium" />
                <button className="modal-close-btn" onClick={onClose} title="Close Terminal">
                  ×
                </button>
              </div>
            </div>

            <div className="workspace-main-wrapper">
              {sortedStocks && sortedStocks.length > 0 && isSidebarCollapsed && (
                <div
                  className="watchlist-sidebar-collapsed-trigger-premium"
                  onClick={() => setIsSidebarCollapsed(false)}
                >
                  <div className="sidebar-collapsed-icon-wrapper-premium" title="Expand Watchlist Sidebar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 17 18 12 13 7" />
                      <polyline points="6 17 11 12 6 7" />
                    </svg>
                  </div>
                </div>
              )}

              {sortedStocks && sortedStocks.length > 0 && !isSidebarCollapsed && (
                <div className="watchlist-sidebar-premium">
                  <div className="sidebar-header-premium">
                    <span className="sidebar-title-premium">{watchlistName}</span>
                    <div className="sidebar-header-actions-premium">
                      <button
                        type="button"
                        className={`sidebar-refresh-btn-premium ${loadingQuotes ? 'is-refreshing' : ''}`}
                        onClick={handleRefreshSidebarQuotes}
                        title={loadingQuotes ? "Updating quotes..." : "Refresh quotes"}
                        disabled={loadingQuotes}
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="12" 
                          height="12" 
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
                      <div className="grouping-popover-wrapper-premium" ref={groupingPopoverRef}>
                        <button
                          type="button"
                          className={`sidebar-refresh-btn-premium ${sidebarGrouping !== 'none' ? 'active-group' : ''}`}
                          onClick={() => setIsGroupingPopoverOpen(!isGroupingPopoverOpen)}
                          title="Group & Categorize watchlist"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                            <polyline points="2 17 12 22 22 17"/>
                            <polyline points="2 12 12 17 22 12"/>
                          </svg>
                        </button>
                        
                        {isGroupingPopoverOpen && (
                          <div className="grouping-popover-dropdown-premium">
                            <div className="popover-section-title-premium">Group by:</div>
                            <div 
                              className={`popover-option-premium ${sidebarGrouping === 'none' ? 'selected' : ''}`}
                              onClick={() => handleSetSidebarGrouping('none')}
                            >
                              <span className="popover-option-dot-premium" />
                              <span>None (Flat List)</span>
                            </div>
                            <div 
                              className={`popover-option-premium ${sidebarGrouping === 'sector' ? 'selected' : ''}`}
                              onClick={() => handleSetSidebarGrouping('sector')}
                            >
                              <span className="popover-option-dot-premium" />
                              <span>Sector</span>
                            </div>
                            <div 
                              className={`popover-option-premium ${sidebarGrouping === 'tag' ? 'selected' : ''}`}
                              onClick={() => handleSetSidebarGrouping('tag')}
                            >
                              <span className="popover-option-dot-premium" />
                              <span>Tag</span>
                            </div>
                            <div 
                              className={`popover-option-premium ${sidebarGrouping === 'flag' ? 'selected' : ''}`}
                              onClick={() => handleSetSidebarGrouping('flag')}
                            >
                              <span className="popover-option-dot-premium" />
                              <span>Flag Color</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <span className="sidebar-count-premium">{sortedStocks.length}</span>
                      <button
                        type="button"
                        className="sidebar-close-btn-premium"
                        onClick={() => setIsSidebarCollapsed(true)}
                        title="Collapse Sidebar"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="11 17 6 12 11 7" />
                          <polyline points="18 17 13 12 18 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="sidebar-list-premium themed-scroll" ref={sidebarListRef}>
                    {groupedStocks.map((group) => {
                      const isCollapsed = collapsedGroups[group.key] ?? false;
                      const hasTitle = group.title !== '';

                      return (
                        <div key={group.key} className="sidebar-group-wrapper-premium">
                          {hasTitle && (
                            <div 
                              className={`sidebar-group-header-premium ${isCollapsed ? 'collapsed' : ''}`}
                              onClick={() => {
                                setCollapsedGroups(prev => ({
                                  ...prev,
                                  [group.key]: !prev[group.key]
                                }));
                              }}
                            >
                              <span className="group-title-text-premium">
                                {sidebarGrouping === 'flag' ? (
                                  group.flagColor ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        width="13" 
                                        height="13" 
                                        viewBox="0 0 24 24" 
                                        fill={FLAG_COLOR_MAP[group.flagColor]} 
                                        stroke={FLAG_COLOR_MAP[group.flagColor]} 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                      >
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                        <line x1="4" y1="22" x2="4" y2="15"/>
                                      </svg>
                                    </span>
                                  ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 0.65 }}>
                                      <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        width="13" 
                                        height="13" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                      >
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                        <line x1="4" y1="22" x2="4" y2="15"/>
                                      </svg>
                                      <span>No Flag</span>
                                    </span>
                                  )
                                ) : (
                                  group.title
                                )}
                              </span>
                              <span className="group-meta-info-premium">
                                <span className="group-count-badge-premium">{group.stocks.length}</span>
                                <svg 
                                  className="group-chevron-icon-premium" 
                                  width="8" 
                                  height="8" 
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
                          )}
                          
                          <div className={`sidebar-group-content-premium ${isCollapsed ? 'collapsed' : ''}`}>
                            {group.stocks.map((s) => {
                              const isActive = s.symbol === formData.symbol && (sidebarGrouping === 'none' || !activeGroupKey || group.key === activeGroupKey);
                              const sidebarData = sidebarStockData[s.symbol] || {};
                              const hasChange = sidebarData.dailyChangePct !== undefined;
                              const changeVal = hasChange ? sidebarData.dailyChangePct : (s.dailyChangePct || 0);
                              const changeText = hasChange ? `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%` : '';
                              const isAdv = sidebarData.isAdvancing ?? s.isAdvancing ?? (changeVal >= 0);
                              
                              const priceVal = sidebarData.currentPrice !== undefined ? sidebarData.currentPrice : (s.currentPrice || 0);
                              const currencySymbol = country === 'US' ? '$' : '₹';
                              const locale = country === 'US' ? 'en-US' : 'en-IN';
                              const priceText = priceVal > 0 
                                ? `${currencySymbol}${priceVal.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '';

                              return (
                                <div
                                  key={`${group.key}-${s.symbol}`}
                                  className={`sidebar-item-premium ${isActive ? 'active' : ''}`}
                                  onClick={() => handleSelectStock(s, group.key)}
                                  title={`${s.symbol} - ${priceText || 'No price available'}`}
                                  style={{ position: 'relative' }}
                                >
                                  <div 
                                    className="sidebar-row-flag-trigger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveFlagMenuSymbol(activeFlagMenuSymbol === s.symbol ? null : s.symbol);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      marginRight: '4px',
                                      cursor: 'pointer',
                                      padding: '2px 3px',
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
                                      fill={s.flagColor ? FLAG_COLOR_MAP[s.flagColor] : 'none'} 
                                      stroke={s.flagColor ? FLAG_COLOR_MAP[s.flagColor] : 'currentColor'} 
                                      strokeWidth="2.5" 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round"
                                      style={{
                                        opacity: s.flagColor ? 1 : 0.25,
                                        transition: 'opacity 0.2s',
                                      }}
                                    >
                                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                                      <line x1="4" y1="22" x2="4" y2="15"/>
                                    </svg>
                                  </div>

                                  {activeFlagMenuSymbol === s.symbol && (
                                    <div 
                                      className="flag-row-popover" 
                                      style={{
                                        position: 'absolute',
                                        left: '32px',
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
                                            handleUpdateStockFlag(s.symbol, colorName);
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
                                          handleUpdateStockFlag(s.symbol, null);
                                          setActiveFlagMenuSymbol(null);
                                        }}
                                        title="Clear Flag"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  )}

                                  <div className="sidebar-item-left-premium">
                                    <span className="sidebar-item-symbol-premium">{s.symbol}</span>
                                  </div>
                                  
                                  <div className="sidebar-item-right-premium flex flex-col items-end">
                                    {priceText && (
                                      <span className="sidebar-item-price-premium-v2">{priceText}</span>
                                    )}
                                    {hasChange ? (
                                      <span className={`sidebar-item-change-premium-v2 ${isAdv ? 'up' : 'down'}`}>
                                        {changeText}
                                      </span>
                                    ) : (
                                      <span className="sidebar-item-change-placeholder-premium">—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="workspace-content-premium">
                <div
                  className={`deep-view-top ${isParamsCollapsed ? 'collapsed' : ''}`}
                >
              <style>{`
                .deep-view-top { --top-section-height: ${!isParamsCollapsed ? `${topHeight}px` : '0px'}; }
                .deep-view-bottom { --grid-split: ${leftWidth}% 6px 1fr; }
              `}</style>
              <div className="section-header-row">
                <button
                  className={`icon-btn-collapse ${isParamsCollapsed ? 'collapsed' : ''}`}
                  onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
                  title={isParamsCollapsed ? 'Expand Parameters' : 'Collapse Parameters'}
                >
                  {isParamsCollapsed ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  )}
                </button>
                <span className="section-title">Parameters</span>

                <div className="params-summary-metrics-inline">
                  <div className="params-summary-divider-line" />

                  {(() => {
                    const price = (sidebarStockData[formData.symbol]?.currentPrice !== undefined)
                      ? sidebarStockData[formData.symbol].currentPrice
                      : (formData.currentPrice || 0);

                    const changePct = (sidebarStockData[formData.symbol]?.dailyChangePct !== undefined)
                      ? sidebarStockData[formData.symbol].dailyChangePct
                      : (formData.dailyChangePct || 0);

                    if (price > 0) {
                      const currencySymbol = country === 'US' ? '$' : '₹';
                      const formattedPrice = price.toLocaleString(country === 'US' ? 'en-US' : 'en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      });
                      const formattedChange = changePct.toFixed(2);
                      const isUp = changePct >= 0;

                      return (
                        <div className="modal-header-price-tag">
                          <span className="price-num">{currencySymbol}&nbsp;{formattedPrice}</span>
                          <span className={`price-change-pct ${isUp ? 'up' : 'down'}`}>
                            {isUp ? '+' : ''}{formattedChange}%
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {formattedAdrValue && (
                    <span
                      className="header-metric-pill-v2 adr"
                      title={`Average Daily Range (ADR): ${formattedAdrValue}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="metric-pill-icon">
                        <path d="M12 3v18" />
                        <path d="m8 7 4-4 4 4" />
                        <path d="m8 17 4 4 4-4" />
                      </svg>
                      <span className="metric-pill-label">ADR</span>
                      <span className="metric-pill-value">{formattedAdrValue}</span>
                    </span>
                  )}

                  {formattedLiqValue && (
                    <span
                      className="header-metric-pill-v2 liquidity"
                      title={`Liquidity: ${formattedLiqValue}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="metric-pill-icon water-drop">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                      </svg>
                      <span className="metric-pill-value">{formattedLiqValue}</span>
                    </span>
                  )}

                  {formData.earningsDate && (
                    <span className="header-earnings-badge-v2 font-mono" title="Next Earnings Date">
                      Earnings: {(() => {
                        try {
                          const d = new Date(formData.earningsDate);
                          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                        } catch (_e) {
                          return formData.earningsDate;
                        }
                      })()}
                    </span>
                  )}

                  {formData.params?.movingAverages && (
                    <>
                      <div className="params-summary-divider-line" />
                      <div className="self-center">
                        <MovingAverageRibbon value={formData.params.movingAverages} variant="compact" showLabel={true} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!isParamsCollapsed && (
                <div className="params-content-grid themed-scroll">
                  {renderFormContent()}
                </div>
              )}
            </div>

            {!isParamsCollapsed && (
              <div
                className="resizer-v-handle"
                onMouseDown={() => setIsResizingV(true)}
                title="Resize Parameters"
              />
            )}

            <div
              className="deep-view-bottom"
            >
              <div className="deep-view-left-panel">
                <div className="panel-header">
                  <span className="section-title">Chart</span>
                  <div className="chart-header-controls">
                    <div className="duration-picker">
                      <span className="picker-label">Range</span>
                      {[
                        { id: '1d', label: '1D', title: '1 Day Intraday' },
                        { id: '1w', label: '1W', title: '1 Week History' },
                        { id: '1mo', label: '1MO', title: '1 Month History' },
                        { id: '3mo', label: '3MO', title: '3 Months History' },
                        { id: '6mo', label: '6MO', title: '6 Months History' },
                        { id: '1y', label: '1Y', title: '1 Year History' }
                      ].map(df => (
                        <button
                          key={df.id}
                          className={`duration-btn ${timeframe === df.id ? 'active' : ''}`}
                          onClick={() => setTimeframe(df.id)}
                          title={df.title}
                        >
                          {df.label}
                        </button>
                      ))}
                    </div>
                    <div className="interval-picker-dropdown">
                      <span className="picker-label">Interval</span>
                      <select
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        className="interval-select-premium"
                      >
                        <option value="auto">Auto</option>
                        {(() => {
                          const options = [
                            { val: '5m', label: '5m', minRange: ['1d', '1w'] },
                            { val: '15m', label: '15m', minRange: ['1d', '1w', '1mo'] },
                            { val: '1h', label: '1h', minRange: ['1d', '1w', '1mo'] },
                            { val: '1d', label: '1d', minRange: ['1w', '1mo', '3mo', '6mo', '1y'] },
                            { val: '1wk', label: '1wk', minRange: ['1mo', '3mo', '6mo', '1y'] },
                            { val: '1mo', label: '1mo', minRange: ['3mo', '6mo', '1y'] }
                          ];
                          return options
                            .filter(opt => opt.minRange.includes(timeframe))
                            .map(opt => (
                              <option key={opt.val} value={opt.val}>{opt.label}</option>
                            ));
                        })()}
                      </select>
                    </div>
                    <div className="ma-settings-container" ref={maSettingsRef}>
                      <button
                        type="button"
                        className={`ma-settings-trigger ${isMaPopoverOpen ? 'active' : ''}`}
                        onClick={() => setIsMaPopoverOpen(!isMaPopoverOpen)}
                        title="Moving Average Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="icon-12">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        <span>MAs</span>
                        <span className="ma-active-count-badge">
                          {Object.values(maSettings).filter(s => s.visible).length}
                        </span>
                      </button>
                      
                      {isMaPopoverOpen && (
                        <div className="ma-settings-popover shadow">
                          <div className="popover-header">Moving Averages</div>
                          <div className="ma-rows-list">
                            {['5', '10', '21', '50', '200'].map(ma => {
                              const setting = maSettings[ma] || { visible: false, color: '#8b5cf6', thickness: 1 };
                              return (
                                <div className="ma-setting-row" key={ma}>
                                  <label className="ma-checkbox-label">
                                    <input
                                      type="checkbox"
                                      className="ma-checkbox"
                                      checked={setting.visible}
                                      onChange={(e) => handleUpdateMaSetting(ma, 'visible', e.target.checked)}
                                    />
                                    <span className="ma-label-text">{ma}-day SMA</span>
                                  </label>
                                  <div className="ma-controls-group">
                                    <div className="ma-color-picker-wrapper" style={{ backgroundColor: setting.color }}>
                                      <input
                                        type="color"
                                        value={setting.color}
                                        onChange={(e) => handleUpdateMaSetting(ma, 'color', e.target.value)}
                                        className="ma-color-input"
                                        title={`Change ${ma} SMA color`}
                                      />
                                    </div>
                                    <select
                                      value={setting.thickness}
                                      onChange={(e) => handleUpdateMaSetting(ma, 'thickness', Number(e.target.value))}
                                      className="ma-thickness-select"
                                      title={`Change ${ma} SMA line thickness`}
                                    >
                                      <option value={1}>1px</option>
                                      <option value={2}>2px</option>
                                      <option value={3}>3px</option>
                                      <option value={4}>4px</option>
                                    </select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="chart-wrapper-large">
                  {loadingChart && (
                    <div className="chart-loading-overlay-premium" title="Chart loading...">
                      <div className="chart-loading-spinner-premium" />
                      <span className="chart-loading-text-premium">Loading chart...</span>
                    </div>
                  )}
                  <MiniCandlestickChart
                    data={formData}
                    country={country}
                    hideHeaders={true}
                    interactive={true}
                    disableZoom={false}
                    height="100%"
                    maSettings={maSettings}
                    timeframe={timeframe}
                  />
                </div>
              </div>

              <div
                className="resizer-h-handle"
                onMouseDown={() => setIsResizingH(true)}
                title="Resize Workspace"
              />

              <div className="deep-view-right-panel themed-scroll">
                <div className="panel-header">
                  <div className="terminal-header-title-wrapper">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ai-sparkle-icon">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                    <span className="section-title">AI Quick Analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={selectedPromptId} 
                      onChange={e => setSelectedPromptId(e.target.value)}
                      className="select-control strategy-select-compact"
                    >
                      {allStrategies.map(p => (
                        <option key={p.id} value={p.id}>{p.label.replace(/\s*\(Active\)\s*/, '')}</option>
                      ))}
                    </select>
                    {!loadingAi && (() => {
                      const isAiBlocked = checkIsAiBlocked(aiSettings?.aiState?.blockedUntil);
                      return (
                        <button
                          onClick={handleRunAi}
                          disabled={isAiBlocked}
                          className="btn-ai-gradient strategy-btn-compact"
                          style={isAiBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                          title={isAiBlocked ? "AI requests blocked due to rate limit/errors" : "Analyze stock with AI"}
                        >
                          Analyze
                        </button>
                      );
                    })()}
                  </div>
                </div>
                <div className="ai-content-area">
                  {loadingAi && (
                    <div className="ai-loading-shimmer-v2">
                      <div className="shimmer-bone-title" />
                      <div className="shimmer-bone-body" />
                      <div className="shimmer-bone-body short" />
                      <p className="loading-txt-premium">Analysing...</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="error-display-premium">
                      <div className="error-icon-v2">⚠️</div>
                      <h3>{aiError}</h3>
                    </div>
                  )}

                  <div className="ai-analysis-container themed-scroll">
                    {renderAiAnalysis()}
                    {aiAnalysis && (
                      <div className="ai-disclaimer-v2 ai-analysis-disclaimer-box">
                         AI can make mistakes. Verify with your own research. For informational purposes only.
                      </div>
                    )}
                  </div>

                  {!aiAnalysis && !loadingAi && !aiError && (
                    <div className="action-placeholder-deep-dive">
                      <div className="sparkle-icon-wrapper">✨</div>
                      <p className="placeholder-secondary">Select <strong>'Analyze'</strong> above to begin deep search.</p>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>

            <div className="modal-pinned-footer">
              <div className="footer-context-hub">
                {onDeleteStock && (
                  <button 
                    onClick={handleDelete} 
                    className="btn-premium-danger"
                    title="Delete Stock (Shortcut: Alt + Del or Del)"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Delete Stock <span style={{ opacity: 0.7, fontSize: '10px', marginLeft: '4px' }}>(Alt+Del)</span>
                  </button>
                )}
              </div>
              <div className="footer-actions">
                {onQuickLog && (
                  <button 
                    onClick={() => {
                      onClose();
                      onQuickLog(formData.symbol);
                    }} 
                    className="btn-premium-secondary quick-log-modal-btn"
                  >
                    Log Position
                  </button>
                )}
                <button onClick={onClose} className="btn-premium-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-premium-primary">Save</button>
              </div>
            </div>
          </>
        ) : (
          <div className="standard-modal-interior-v2">
            <h2 className="standard-modal-title-v2">Edit {formData.symbol} ({formData.longName || formData.name || ''})</h2>
            <div className="standard-modal-body-v2 themed-scroll">
              {renderFormContent()}
            </div>
             <div className="standard-modal-footer-v2">
              {onDeleteStock && (
                <button 
                  onClick={handleDelete} 
                  className="btn-premium-danger"
                  title="Delete Stock (Shortcut: Alt + Del or Del)"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginRight: 'auto'
                  }}
                >
                  Delete Stock <span style={{ opacity: 0.7, fontSize: '10px', marginLeft: '4px' }}>(Alt+Del)</span>
                </button>
              )}
              {onQuickLog && (
                <button 
                  onClick={() => {
                    onClose();
                    onQuickLog(formData.symbol);
                  }} 
                  className="btn-premium-secondary quick-log-modal-btn"
                >
                  Log Position
                </button>
              )}
              <button onClick={onClose} className="btn-premium-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-premium-primary">Save Changes</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
