import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import ZerodhaHeaderDock from './ZerodhaHeaderDock';
import ZerodhaWatchlistPanel from './ZerodhaWatchlistPanel';
import ZerodhaContextMenu from './ZerodhaContextMenu';
import { extractKiteSymbol, switchKiteSymbol, isZerodhaChartWindow, extractKiteLiveChartQuote } from './kiteSymbolNavigator';
import { getSundayOfWeek, getLocalDateString } from '../../utils/weekHelpers';

const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

const safeStorage = {
  get: (keys, callback) => {
    if (isExtension) {
      try {
        chrome.storage.local.get(keys, callback);
      } catch (_e) {
        console.warn('[ZerodhaIntegration] Chrome storage unavailable, falling back to localStorage');
      }
    } else {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach((k) => {
        const val = localStorage.getItem(k);
        if (val) {
          try {
            result[k] = JSON.parse(val);
          } catch {
            result[k] = val;
          }
        }
      });
      if (callback) callback(result);
    }
  },
  set: (items, callback) => {
    if (isExtension) {
      try {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            console.error('[ZerodhaIntegration] Storage set error:', chrome.runtime.lastError);
            if (callback) callback(chrome.runtime.lastError);
          } else if (callback) {
            callback(null);
          }
        });
      } catch (_e) {
        console.warn('[ZerodhaIntegration] Chrome storage unavailable');
      }
    } else {
      try {
        Object.entries(items).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        if (callback) callback(null);
      } catch (err) {
        if (callback) callback(err);
      }
    }
  },
};

export default function ZerodhaIntegration() {
  const [isChart, setIsChart] = useState(() => isZerodhaChartWindow());
  const [appData, setAppData] = useState(null);
  const appDataRef = useRef(appData);
  appDataRef.current = appData;
  const [activeSymbol, setActiveSymbol] = useState(() => extractKiteSymbol() || 'SONACOMS');
  const [region] = useState('IN');
  const [selectedDate] = useState(() => getLocalDateString(new Date()));
  const [headerPortalNode, setHeaderPortalNode] = useState(null);
  const [visibleStocks, setVisibleStocks] = useState([]);

  // Check chart window status on single page app navigation
  useEffect(() => {
    const handleUrl = () => {
      setIsChart(isZerodhaChartWindow());
    };
    window.addEventListener('popstate', handleUrl);
    window.addEventListener('hashchange', handleUrl);
    const interval = setInterval(handleUrl, 500);
    return () => {
      window.removeEventListener('popstate', handleUrl);
      window.removeEventListener('hashchange', handleUrl);
      clearInterval(interval);
    };
  }, []);

  // Guards to prevent background URL poll from overriding user's intentional keyboard/click navigation
  const lastUserNavigatedSymbolRef = useRef(null);
  const lastUserNavigatedTimeRef = useRef(0);
  const handleDeleteStockRef = useRef(null);

  // Setup Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [editSector, setEditSector] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTradable, setEditTradable] = useState(false);
  const [editTags, setEditTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    stock: null,
    initialSubmenu: null,
  });

  // Live quotes cache shared across Watchlist and Header Dock
  const [liveQuotes, setLiveQuotes] = useState({});

  const weekKey = useMemo(() => getSundayOfWeek(selectedDate), [selectedDate]);

  // Load initial appData from storage
  const loadData = useCallback(() => {
    safeStorage.get('trading_app_data', (res) => {
      if (res?.trading_app_data) {
        setAppData(res.trading_app_data);
      }
    });
  }, []);

  useEffect(() => {
    loadData();

    if (isExtension) {
      const handleStorageChange = (changes, area) => {
        if (area === 'local' && changes.trading_app_data?.newValue) {
          setAppData(changes.trading_app_data.newValue);
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, [loadData]);

  // Track Kite Active Symbol from URL, Title, and Search navigation (0ms two-way sync)
  useEffect(() => {
    const checkSymbol = () => {
      const sym = extractKiteSymbol();
      if (!sym) return;

      // If user recently clicked a stock inside TradeClarity, wait only until the URL catches up to that clicked symbol
      if (Date.now() - lastUserNavigatedTimeRef.current < 3500) {
        if (lastUserNavigatedSymbolRef.current) {
          const cleanLast = lastUserNavigatedSymbolRef.current.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          if (sym !== cleanLast) {
            // URL has not yet caught up to what the user clicked in TradeClarity
            return;
          }
        }
      }

      if (sym !== activeSymbol) {
        setActiveSymbol(sym);
      }
    };

    checkSymbol();
    const interval = setInterval(checkSymbol, 800);

    const titleEl = document.querySelector('title');
    let observer = null;
    if (titleEl) {
      observer = new MutationObserver(checkSymbol);
      observer.observe(titleEl, { childList: true });
    }

    // Intercept pushState & replaceState to detect Zerodha's search bar symbol navigation with 0ms latency
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    history.pushState = function (...args) {
      const res = origPushState.apply(this, args);
      window.dispatchEvent(new Event('tc:urlchange'));
      return res;
    };
    history.replaceState = function (...args) {
      const res = origReplaceState.apply(this, args);
      window.dispatchEvent(new Event('tc:urlchange'));
      return res;
    };

    window.addEventListener('tc:urlchange', checkSymbol);
    window.addEventListener('popstate', checkSymbol);

    return () => {
      clearInterval(interval);
      if (observer) observer.disconnect();
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      window.removeEventListener('tc:urlchange', checkSymbol);
      window.removeEventListener('popstate', checkSymbol);
    };
  }, [activeSymbol]);

  // Synchronize real-time LTP and % change directly from Kite's chart on screen
  useEffect(() => {
    const handleBridgeQuote = (e) => {
      const detail = e.detail;
      if (!detail || typeof detail.price !== 'number' || detail.price <= 0) return;
      const clean = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      if (!clean) return;

      setLiveQuotes((prev) => {
        const existing = prev[clean] || {};
        if (existing.currentPrice === detail.price && existing.dailyChangePct === detail.changePct) {
          return prev;
        }
        return {
          ...prev,
          [clean]: {
            ...existing,
            symbol: clean,
            currentPrice: detail.price,
            priceDiff: detail.diff,
            dailyChangePct: detail.changePct,
            isAdvancing: detail.changePct >= 0,
          },
        };
      });
    };

    document.addEventListener('tc_zerodha_quote_update', handleBridgeQuote);

    // Fast DOM inspection fallback (legend C <price> <change> (<pct>%), buy button, etc.)
    const pollQuote = () => {
      const quote = extractKiteLiveChartQuote();
      if (quote && quote.currentPrice > 0) {
        const clean = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
        if (!clean) return;

        setLiveQuotes((prev) => {
          const existing = prev[clean] || {};
          if (existing.currentPrice === quote.currentPrice && existing.dailyChangePct === quote.dailyChangePct) {
            return prev;
          }
          return {
            ...prev,
            [clean]: {
              ...existing,
              symbol: clean,
              currentPrice: quote.currentPrice,
              priceDiff: quote.priceDiff,
              dailyChangePct: quote.dailyChangePct,
              isAdvancing: quote.isAdvancing,
            },
          };
        });
      }
    };

    const interval = setInterval(pollQuote, 1000);
    pollQuote();

    return () => {
      document.removeEventListener('tc_zerodha_quote_update', handleBridgeQuote);
      clearInterval(interval);
    };
  }, [activeSymbol]);

  // Stocks in current week's bucket
  const currentWeekStocksList = useMemo(() => {
    if (!appData?.weeks) return [];
    const regionBucket = appData.weeks[region] || appData.weeks;
    const stocksMap = regionBucket?.[weekKey]?.stocks || {};
    const customOrder = regionBucket?.[weekKey]?.customOrder || [];

    let list = Object.values(stocksMap);
    if (Array.isArray(customOrder) && customOrder.length > 0) {
      list.sort((a, b) => {
        const idxA = customOrder.indexOf(a.symbol);
        const idxB = customOrder.indexOf(b.symbol);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.symbol || '').localeCompare(b.symbol || '');
      });
    }
    return list;
  }, [appData, region, weekKey]);

  // Stock data for active symbol in current week (or across weeks if from another watchlist/week)
  const activeStockData = useMemo(() => {
    if (!appData?.weeks || !activeSymbol) return null;
    const regionBucket = appData.weeks[region] || appData.weeks;
    const cleanActive = activeSymbol.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();

    // 1. Check weekKey stocks first
    const stocksMap = regionBucket?.[weekKey]?.stocks || {};
    if (stocksMap[activeSymbol]) return stocksMap[activeSymbol];
    if (stocksMap[cleanActive]) return stocksMap[cleanActive];
    const inCurrentWeek = Object.values(stocksMap).find((s) => {
      const cleanS = (s?.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      return cleanS === cleanActive;
    });
    if (inCurrentWeek) return inCurrentWeek;

    // 2. Search across ALL other weeks in regionBucket
    for (const wk of Object.keys(regionBucket)) {
      if (wk !== weekKey && regionBucket[wk]?.stocks) {
        for (const k of Object.keys(regionBucket[wk].stocks)) {
          if (k.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase() === cleanActive) {
            return regionBucket[wk].stocks[k];
          }
        }
      }
    }
    return null;
  }, [appData, region, weekKey, activeSymbol]);

  // Global Arrow Keys Navigation & Quick Shortcuts (W: Watchlists, S: Sector)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if context menu is open, user is typing in any text box, or modal is open
      if (contextMenu.isOpen) return;

      const activeEl = document.activeElement?.shadowRoot?.activeElement || document.activeElement;
      const targetEl = e.target?.shadowRoot?.activeElement || e.target;
      const tag = activeEl?.tagName || targetEl?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        activeEl?.isContentEditable ||
        targetEl?.isContentEditable ||
        isEditModalOpen
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const navList = visibleStocks.length > 0 ? visibleStocks : currentWeekStocksList;

      // Quick Delete Shortcut: 'Delete' or 'Backspace' removes the active stock from watchlist
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeSymbol && handleDeleteStockRef.current) {
          e.preventDefault();
          e.stopPropagation();
          handleDeleteStockRef.current(activeSymbol);
          return;
        }
      }

      const key = e.key.toLowerCase();

      // Quick Shortcuts: 'W' for Watchlist management, 'S' for Sector assignment
      if (key === 'w' || key === 's') {
        const cleanActive = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
        const targetStock = activeStockData || navList.find((s) => {
          const sym = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          return sym === cleanActive;
        }) || (activeSymbol ? { symbol: activeSymbol } : navList[0]);

        if (targetStock) {
          e.preventDefault();
          e.stopPropagation();

          const clean = (targetStock.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          const rowEl = document.getElementById(`tc-stock-row-${clean}`) || document.getElementById(`tc-stock-row-${targetStock.symbol}`);
          const rect = rowEl?.getBoundingClientRect();

          const posX = rect ? Math.max(10, rect.left - 240) : Math.max(10, window.innerWidth - 380);
          const posY = rect ? Math.min(rect.top, window.innerHeight - 300) : 150;

          setContextMenu({
            isOpen: true,
            x: posX,
            y: posY,
            stock: targetStock,
            initialSubmenu: key === 'w' ? 'watchlist' : 'sector',
          });
          return;
        }
      }

      if (navList.length === 0) return;

      let direction = 0;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        direction = 1;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        direction = -1;
      } else if (e.key === ' ' && !e.target?.closest('button')) {
        direction = 1;
      }

      if (direction !== 0) {
        e.preventDefault();
        e.stopPropagation();

        const cleanActive = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
        const currentIdx = navList.findIndex((s) => {
          const sym = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          return sym === cleanActive;
        });

        let nextIdx = 0;
        if (currentIdx !== -1) {
          nextIdx = (currentIdx + direction + navList.length) % navList.length;
        } else if (direction === -1) {
          nextIdx = navList.length - 1;
        }

        const nextStock = navList[nextIdx];
        if (nextStock && nextStock.symbol) {
          lastUserNavigatedSymbolRef.current = nextStock.symbol;
          lastUserNavigatedTimeRef.current = Date.now();
          setActiveSymbol(nextStock.symbol);
          switchKiteSymbol(nextStock.symbol);
          // Auto scroll into view
          const el = document.getElementById(`tc-stock-row-${nextStock.symbol}`);
          if (typeof el?.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [currentWeekStocksList, visibleStocks, activeSymbol, activeStockData, isEditModalOpen, contextMenu.isOpen]);

  // Mount Header Dock Portal (appended to document.body so dock can be freely dragged anywhere on screen)
  useEffect(() => {
    let portalContainer = document.getElementById('trade-clarity-header-dock-container');

    if (!portalContainer) {
      portalContainer = document.createElement('div');
      portalContainer.id = 'trade-clarity-header-dock-container';
      portalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 99999;
        pointer-events: none;
      `;
      document.body.appendChild(portalContainer);
    }

    setHeaderPortalNode(portalContainer);

    return () => {
      if (portalContainer && portalContainer.parentNode) {
        portalContainer.parentNode.removeChild(portalContainer);
      }
    };
  }, []);

  // Handle selecting a stock from the watchlist
  const handleSelectStock = (stock) => {
    if (!stock?.symbol) return;
    lastUserNavigatedSymbolRef.current = stock.symbol;
    lastUserNavigatedTimeRef.current = Date.now();
    setActiveSymbol(stock.symbol);
    switchKiteSymbol(stock.symbol);
  };

  // Reorder stocks via Drag & Drop
  const handleReorderStocks = (newOrderArray, targetWeekKey) => {
    if (!appData) return;
    const updated = structuredClone(appData);
    let targetWeeks = updated.weeks;
    if (updated.weeks.US || updated.weeks.IN) {
      if (!updated.weeks[region]) updated.weeks[region] = {};
      targetWeeks = updated.weeks[region];
    }
    const wk = targetWeekKey || weekKey;
    if (targetWeeks[wk]) {
      targetWeeks[wk].customOrder = newOrderArray;
      updated._lastModified = Date.now();
      safeStorage.set({ trading_app_data: updated }, () => {
        setAppData(updated);
      });
    }
  };

  // Move stock to another section (sector/flag/tag) and reorder via Drag & Drop
  const handleMoveStockToSection = useCallback(
    (draggedSymbol, targetSection, newOrderArray) => {
      if (!draggedSymbol || !appData) return;
      const clean = draggedSymbol.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      const updated = structuredClone(appData);
      let targetWeeks = updated.weeks;
      if (updated.weeks?.US || updated.weeks?.IN) {
        if (!updated.weeks[region]) updated.weeks[region] = {};
        targetWeeks = updated.weeks[region];
      }

      if (!targetWeeks[weekKey]) {
        targetWeeks[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
      }

      let foundStock = targetWeeks[weekKey]?.stocks?.[clean] || targetWeeks[weekKey]?.stocks?.[draggedSymbol];
      if (!foundStock && targetWeeks) {
        for (const wk of Object.keys(targetWeeks)) {
          if (targetWeeks[wk]?.stocks) {
            for (const k of Object.keys(targetWeeks[wk].stocks)) {
              if (k.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase() === clean) {
                foundStock = targetWeeks[wk].stocks[k];
                break;
              }
            }
          }
          if (foundStock) break;
        }
      }

      if (!foundStock) {
        targetWeeks[weekKey].stocks[clean] = { symbol: clean, sector: '', tradable: false, notes: '', tags: [], params: {} };
        foundStock = targetWeeks[weekKey].stocks[clean];
      }

      // Apply section attribute update
      if (targetSection) {
        if (targetSection.grouping === 'sector') {
          foundStock.sector = targetSection.sector === 'Unassigned' ? '' : (targetSection.sector || '');
        } else if (targetSection.grouping === 'flag') {
          foundStock.flagColor = targetSection.flagColor === 'no_flag' ? null : targetSection.flagColor;
        } else if (targetSection.grouping === 'tag') {
          if (targetSection.tag && targetSection.tag !== 'no_tags') {
            const currentTags = Array.isArray(foundStock.tags) ? [...foundStock.tags] : [];
            if (!currentTags.includes(targetSection.tag)) {
              foundStock.tags = [targetSection.tag, ...currentTags];
            }
          }
        }
      }

      // Apply customOrder in weekKey
      if (Array.isArray(newOrderArray)) {
        targetWeeks[weekKey].customOrder = newOrderArray;
      }

      updated._lastModified = Date.now();
      safeStorage.set({ trading_app_data: updated }, () => {
        setAppData(updated);
      });
    },
    [appData, region, weekKey]
  );

  // Extract all available watchlists comprehensively across appData and all stocks
  const allWatchlists = useMemo(() => {
    const map = new Map();
    if (Array.isArray(appData?.watchlists)) {
      appData.watchlists.forEach((w) => {
        if (typeof w === 'string') {
          map.set(w, { id: w, name: w });
        } else if (w && typeof w === 'object') {
          const id = w.id || w.name;
          const name = w.name || w.id;
          if (id) map.set(id, { id, name });
        }
      });
    }
    if (Array.isArray(appData?.uiConfig?.watchlists)) {
      appData.uiConfig.watchlists.forEach((w) => {
        if (typeof w === 'string') {
          if (!map.has(w)) map.set(w, { id: w, name: w });
        } else if (w && typeof w === 'object') {
          const id = w.id || w.name;
          const name = w.name || w.id;
          if (id && !map.has(id)) map.set(id, { id, name });
        }
      });
    }
    const weeksObj = appData?.weeks?.[region] || appData?.weeks || {};
    Object.values(weeksObj).forEach((wk) => {
      if (wk?.stocks) {
        Object.values(wk.stocks).forEach((st) => {
          if (Array.isArray(st.watchlists)) {
            st.watchlists.forEach((w) => {
              if (w && !map.has(w)) map.set(w, { id: w, name: w });
            });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [appData, region]);

  // Extract all available tags comprehensively across appData and all stocks
  const allTags = useMemo(() => {
    const set = new Set();
    if (Array.isArray(appData?.uiConfig?.tags)) {
      appData.uiConfig.tags.forEach((t) => typeof t === 'string' && set.add(t));
    }
    if (Array.isArray(appData?.tags)) {
      appData.tags.forEach((t) => typeof t === 'string' && set.add(t));
    }
    const weeksObj = appData?.weeks?.[region] || appData?.weeks || {};
    Object.values(weeksObj).forEach((wk) => {
      if (wk?.stocks) {
        Object.values(wk.stocks).forEach((st) => {
          if (Array.isArray(st.tags)) {
            st.tags.forEach((t) => t && typeof t === 'string' && set.add(t));
          }
        });
      }
    });
    return Array.from(set).filter((t) => !t.toUpperCase().startsWith('AI:'));
  }, [appData, region]);

  // Extract all available sectors comprehensively across appData and all stocks
  const allSectors = useMemo(() => {
    const set = new Set();
    if (Array.isArray(appData?.sectors)) {
      appData.sectors.forEach((sec) => typeof sec === 'string' && sec.trim() && set.add(sec.trim()));
    }
    if (Array.isArray(appData?.uiConfig?.sectors)) {
      appData.uiConfig.sectors.forEach((sec) => typeof sec === 'string' && sec.trim() && set.add(sec.trim()));
    }
    if (appData?.stockSectorCache && typeof appData.stockSectorCache === 'object') {
      Object.values(appData.stockSectorCache).forEach((sec) => {
        if (typeof sec === 'string' && sec.trim()) set.add(sec.trim());
      });
    }
    const weeksObj = appData?.weeks?.[region] || appData?.weeks || {};
    Object.values(weeksObj).forEach((wk) => {
      if (wk?.stocks) {
        Object.values(wk.stocks).forEach((st) => {
          if (st?.sector && typeof st.sector === 'string' && st.sector.trim()) {
            set.add(st.sector.trim());
          }
        });
      }
    });
    if (set.size === 0) {
      ['Auto', 'Banking', 'Capital Goods', 'Chemicals', 'Consumer Durables', 'Energy', 'FMCG', 'Healthcare', 'IT', 'Metals', 'Pharma', 'Telecom'].forEach((s) => set.add(s));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [appData, region]);

  // Unified resilient stock updater across current week and all historical weeks
  const updateStockInAppData = useCallback(
    (symbol, updater) => {
      const currentData = appDataRef.current || appData;
      if (!symbol || !currentData) return;
      const clean = symbol.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      const updated = structuredClone(currentData);
      let targetWeeks = updated.weeks;
      if (updated.weeks?.US || updated.weeks?.IN) {
        if (!updated.weeks[region]) updated.weeks[region] = {};
        targetWeeks = updated.weeks[region];
      }

      // Try finding the stock in weekKey first, then search across all weeks in targetWeeks
      let foundStock = null;
      let foundWeekKey = weekKey;

      if (targetWeeks?.[weekKey]?.stocks) {
        for (const k of Object.keys(targetWeeks[weekKey].stocks)) {
          if (k.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase() === clean) {
            foundStock = targetWeeks[weekKey].stocks[k];
            foundWeekKey = weekKey;
            break;
          }
        }
      }

      if (!foundStock && targetWeeks) {
        for (const wk of Object.keys(targetWeeks)) {
          if (targetWeeks[wk]?.stocks) {
            for (const k of Object.keys(targetWeeks[wk].stocks)) {
              if (k.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase() === clean) {
                foundStock = targetWeeks[wk].stocks[k];
                foundWeekKey = wk;
                break;
              }
            }
          }
          if (foundStock) break;
        }
      }

      // If stock not found in any week, create it in weekKey
      if (!foundStock) {
        if (!targetWeeks[weekKey]) targetWeeks[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
        targetWeeks[weekKey].stocks[clean] = { symbol: clean, sector: '', tradable: false, notes: '', tags: [], params: {} };
        foundStock = targetWeeks[weekKey].stocks[clean];
        foundWeekKey = weekKey;
      }

      updater(foundStock, targetWeeks[foundWeekKey], updated);

      updated._lastModified = Date.now();
      appDataRef.current = updated;
      setAppData(updated);
      safeStorage.set({ trading_app_data: updated });
    },
    [region, weekKey, appData]
  );

  // Handle updating stock flag color
  const handleUpdateStockFlag = (symbol, flagColor) => {
    updateStockInAppData(symbol, (sObj) => {
      sObj.flagColor = flagColor;
      setContextMenu((prev) => (prev.stock?.symbol === symbol ? {
        ...prev,
        stock: { ...prev.stock, flagColor }
      } : prev));
    });
  };

  // Open Edit Modal for a stock
  const handleOpenEditModal = (stock = null) => {
    const target = stock || activeStockData || { symbol: activeSymbol };
    setEditingStock(target);
    setEditSector(target.sector || '');
    setEditNotes(target.notes || '');
    setEditTradable(Boolean(target.tradable));
    setEditTags(Array.isArray(target.tags) ? [...target.tags] : []);
    setIsEditModalOpen(true);
  };

  // Save stock edits
  const handleSaveEditModal = () => {
    if (!editingStock?.symbol || !appData) return;
    const symbol = editingStock.symbol;
    updateStockInAppData(symbol, (currentStock) => {
      currentStock.sector = editSector;
      currentStock.notes = editNotes;
      currentStock.tradable = editTradable;
      currentStock.tags = editTags;
    });
    setIsEditModalOpen(false);
  };

  // Quick Add Stock to Watchlist (supports optional direct symbol without prompt)
  const handleAddStock = (customSymbol = null) => {
    let cleanSym = '';
    if (typeof customSymbol === 'string' && customSymbol.trim()) {
      cleanSym = customSymbol.trim().toUpperCase();
    } else {
      const symInput = prompt('Enter symbol to add to Weekly Watchlist (e.g. TATAMOTORS):');
      if (!symInput || !symInput.trim()) return;
      cleanSym = symInput.trim().toUpperCase();
    }

    const updated = structuredClone(appData || { weeks: {} });
    let targetWeeks = updated.weeks;
    if (updated.weeks?.US || updated.weeks?.IN) {
      if (!updated.weeks[region]) updated.weeks[region] = {};
      targetWeeks = updated.weeks[region];
    }
    if (!targetWeeks[weekKey]) targetWeeks[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
    if (!targetWeeks[weekKey].stocks[cleanSym]) {
      targetWeeks[weekKey].stocks[cleanSym] = {
        symbol: cleanSym,
        sector: 'Unassigned',
        tradable: false,
        notes: '',
        tags: [],
        params: {},
      };
    }
    updated._lastModified = Date.now();

    safeStorage.set({ trading_app_data: updated }, () => {
      setAppData(updated);
      setActiveSymbol(cleanSym);
      switchKiteSymbol(cleanSym);
    });
  };

  // Context Menu handlers
  const handleOpenContextMenu = (e, stock) => {
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      stock,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false, initialSubmenu: null }));
  };

  const handleSelectSector = (newSector) => {
    if (!contextMenu.stock?.symbol) return;
    const sym = contextMenu.stock.symbol;
    const clean = sym.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
    const trimmedSector = (newSector || '').trim();

    updateStockInAppData(sym, (sObj, _weekObj, rootAppData) => {
      sObj.sector = trimmedSector;
      if (rootAppData) {
        if (!rootAppData.stockSectorCache) rootAppData.stockSectorCache = {};
        rootAppData.stockSectorCache[clean] = trimmedSector;
      }
    });

    setContextMenu((prev) => (prev.stock?.symbol === sym ? {
      ...prev,
      stock: { ...prev.stock, sector: trimmedSector },
    } : prev));
  };

  const handleToggleWatchlist = (wlId) => {
    if (!contextMenu.stock?.symbol) return;
    const sym = contextMenu.stock.symbol;
    updateStockInAppData(sym, (sObj) => {
      const wls = Array.isArray(sObj.watchlists) ? [...sObj.watchlists] : [];
      const matchedWl = allWatchlists.find((w) => w.id === wlId || w.name === wlId);
      const targetId = matchedWl?.id || wlId;
      const targetName = matchedWl?.name;

      const idx = wls.findIndex((x) => x === targetId || (targetName && x === targetName));
      if (idx !== -1) {
        wls.splice(idx, 1);
      } else {
        wls.push(targetId);
      }
      sObj.watchlists = wls;

      // Update active context menu stock immediately so checkmarks toggle live
      setContextMenu((prev) => (prev.stock?.symbol === sym ? {
        ...prev,
        stock: { ...prev.stock, watchlists: wls }
      } : prev));
    });
  };

  const handleToggleTag = (tag) => {
    if (!contextMenu.stock?.symbol) return;
    const sym = contextMenu.stock.symbol;
    updateStockInAppData(sym, (sObj) => {
      const tags = Array.isArray(sObj.tags) ? [...sObj.tags] : [];
      const idx = tags.indexOf(tag);
      if (idx !== -1) tags.splice(idx, 1);
      else tags.push(tag);
      sObj.tags = tags;

      setContextMenu((prev) => (prev.stock?.symbol === sym ? {
        ...prev,
        stock: { ...prev.stock, tags }
      } : prev));
    });
  };

  const handleToggleTradable = () => {
    if (!contextMenu.stock?.symbol) return;
    const sym = contextMenu.stock.symbol;
    updateStockInAppData(sym, (sObj) => {
      sObj.tradable = !sObj.tradable;

      setContextMenu((prev) => (prev.stock?.symbol === sym ? {
        ...prev,
        stock: { ...prev.stock, tradable: sObj.tradable }
      } : prev));
    });
    handleCloseContextMenu();
  };

  const handleDeleteStock = useCallback(
    (targetSymbol) => {
      const symbol =
        (typeof targetSymbol === 'string' && targetSymbol) ||
        targetSymbol?.symbol ||
        contextMenu.stock?.symbol ||
        activeSymbol;
      if (!symbol) return;

      const navList = visibleStocks.length > 0 ? visibleStocks : currentWeekStocksList;
      const cleanActive = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      const cleanTarget = (symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();

      let nextStockToSelect = null;
      if (cleanActive === cleanTarget && navList.length > 1) {
        const currentIdx = navList.findIndex((s) => {
          const sym = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          return sym === cleanTarget;
        });
        if (currentIdx !== -1) {
          const nextIdx = currentIdx < navList.length - 1 ? currentIdx + 1 : currentIdx - 1;
          nextStockToSelect = navList[nextIdx];
        }
      }

      updateStockInAppData(symbol, (_sObj, weekObj) => {
        if (weekObj?.stocks) {
          delete weekObj.stocks[symbol];
          const clean = symbol.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          delete weekObj.stocks[clean];
          Object.keys(weekObj.stocks).forEach((k) => {
            if (k.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase() === clean) {
              delete weekObj.stocks[k];
            }
          });
          if (Array.isArray(weekObj.customOrder)) {
            weekObj.customOrder = weekObj.customOrder.filter((s) => {
              const sc = (s || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
              return s !== symbol && sc !== clean;
            });
          }
        }
      });

      if (nextStockToSelect && nextStockToSelect.symbol) {
        lastUserNavigatedSymbolRef.current = nextStockToSelect.symbol;
        lastUserNavigatedTimeRef.current = Date.now();
        setActiveSymbol(nextStockToSelect.symbol);
        switchKiteSymbol(nextStockToSelect.symbol);
        const el = document.getElementById(`tc-stock-row-${nextStockToSelect.symbol}`);
        if (typeof el?.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }

      handleCloseContextMenu();
    },
    [contextMenu.stock, activeSymbol, visibleStocks, currentWeekStocksList, updateStockInAppData]
  );
  handleDeleteStockRef.current = handleDeleteStock;

  if (!isChart) {
    return null;
  }

  const cleanActiveSym = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
  const activeQuote = liveQuotes[cleanActiveSym] || liveQuotes[activeSymbol] || liveQuotes[`${cleanActiveSym}.NS`] || null;

  return (
    <>
      {/* 1. TOP HEADER DOCK (Portaled into Kite Navbar) */}
      {headerPortalNode &&
        createPortal(
          <ZerodhaHeaderDock
            symbol={activeSymbol}
            stockData={activeStockData}
            liveQuote={activeQuote}
            currentPrice={activeQuote?.currentPrice}
            dailyChangePct={activeQuote?.dailyChangePct}
            region={region}
            onOpenEditModal={() => handleOpenEditModal(activeStockData)}
          />,
          headerPortalNode
        )}

      {/* 2. RIGHT WATCHLIST SIDEBAR PANEL */}
      <ZerodhaWatchlistPanel
        appData={appData}
        region={region}
        activeSymbol={activeSymbol}
        onSelectStock={handleSelectStock}
        onOpenContextMenu={handleOpenContextMenu}
        onUpdateStockFlag={handleUpdateStockFlag}
        onOpenEditModal={handleOpenEditModal}
        onAddStock={handleAddStock}
        onDeleteStock={handleDeleteStock}
        onReorderStocks={handleReorderStocks}
        onMoveStockToSection={handleMoveStockToSection}
        onVisibleStocksChange={setVisibleStocks}
        onQuotesChange={setLiveQuotes}
      />

      {/* 3. DEDICATED HIGH-Z-INDEX ZERODHA CONTEXT MENU */}
      <ZerodhaContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        stock={contextMenu.stock}
        initialSubmenu={contextMenu.initialSubmenu}
        watchlists={allWatchlists}
        availableSectors={allSectors}
        availableTags={allTags}
        onClose={handleCloseContextMenu}
        onToggleWatchlist={handleToggleWatchlist}
        onSelectSector={handleSelectSector}
        onSelectFlagColor={(col) => {
          if (contextMenu.stock) handleUpdateStockFlag(contextMenu.stock.symbol, col);
          handleCloseContextMenu();
        }}
        onToggleTag={handleToggleTag}
        onToggleTradable={handleToggleTradable}
        onCopySymbol={() => {
          if (contextMenu.stock?.symbol) {
            navigator.clipboard?.writeText(contextMenu.stock.symbol);
          }
          handleCloseContextMenu();
        }}
        onOpenTradingView={() => {
          if (contextMenu.stock?.symbol) {
            window.open(`https://www.tradingview.com/chart/?symbol=NSE:${contextMenu.stock.symbol}`, '_blank');
          }
          handleCloseContextMenu();
        }}
        onOpenScreener={() => {
          if (contextMenu.stock?.symbol) {
            window.open(`https://www.screener.in/company/${contextMenu.stock.symbol}/`, '_blank');
          }
          handleCloseContextMenu();
        }}
        onOpenDashboard={() => {
          if (contextMenu.stock?.symbol) {
            const clean = contextMenu.stock.symbol.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
            if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
              chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD', symbol: clean }, (_res) => {
                if (chrome.runtime.lastError) {
                  window.open(chrome.runtime.getURL(`dashboard.html?symbol=${encodeURIComponent(clean)}`), '_blank');
                }
              });
            } else {
              window.open(chrome.runtime.getURL(`dashboard.html?symbol=${encodeURIComponent(clean)}`), '_blank');
            }
          }
          handleCloseContextMenu();
        }}
        onEditStock={() => {
          handleOpenEditModal(contextMenu.stock);
          handleCloseContextMenu();
        }}
        onDeleteStock={handleDeleteStock}
      />

      {/* 4. EDIT SETUP MODAL OVERLAY */}
      {isEditModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              width: '520px',
              background: '#131823',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '10px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '12px 16px',
                background: '#182030',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  Edit Setup · {editingStock?.symbol}
                </span>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>({weekKey})</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Sector
                  </label>
                  <input
                    type="text"
                    value={editSector}
                    onChange={(e) => setEditSector(e.target.value)}
                    placeholder="e.g. Auto Components, IT"
                    style={{
                      background: '#1c2233',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '5px',
                      color: '#fff',
                      padding: '6px 8px',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Tradable
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditTradable(!editTradable)}
                    style={{
                      background: editTradable ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      border: editTradable ? '1px solid #22c55e' : '1px solid #ef4444',
                      color: editTradable ? '#4ade80' : '#f87171',
                      borderRadius: '5px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {editTradable ? '✓ Tradable' : '✗ Untradable'}
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Notes & Analysis Thesis
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Record trade setup, catalyst, stop loss, resistance..."
                  style={{
                    background: '#1c2233',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '5px',
                    color: '#fff',
                    padding: '8px',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Tags
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {editTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {tag}
                      <span
                        onClick={() => setEditTags(editTags.filter((t) => t !== tag))}
                        style={{ cursor: 'pointer', fontWeight: 700 }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagInput.trim()) {
                        e.preventDefault();
                        if (!editTags.includes(newTagInput.trim())) {
                          setEditTags([...editTags, newTagInput.trim()]);
                        }
                        setNewTagInput('');
                      }
                    }}
                    placeholder="+ Add tag (Enter)"
                    style={{
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '2px 6px',
                      fontSize: '10px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '10px 16px',
                background: '#10141e',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  background: '#252f44',
                  color: '#cbd5e1',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
