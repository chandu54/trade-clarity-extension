import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getSundayOfWeek, getLocalDateString } from '../../utils/weekHelpers';
import { fetchStockQuotes } from '../../utils/yahooFinanceMap';
import { calculateDaysAway, globalFundamentalsCache } from '../../utils/stockAnalysisApi';
import { formatSectionTitle } from '../../utils/paramUtils';

const FLAG_COLOR_MAP = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7',
};

export default function ZerodhaWatchlistPanel({
  appData,
  region = 'IN',
  activeSymbol,
  onSelectStock,
  onOpenContextMenu,
  onUpdateStockFlag,
  _onOpenEditModal,
  onAddStock,
  onReorderStocks,
  onMoveStockToSection,
  onVisibleStocksChange,
  onQuotesChange,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
  const [selectedWatchlist, setSelectedWatchlist] = useState('ALL');
  const [grouping, setGrouping] = useState('sector'); // 'none' | 'sector' | 'flag' | 'tag'
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('tc_zerodha_collapsed_groups');
      if (saved) return JSON.parse(saved);
    } catch (_e) {}
    return {};
  });
  const [flagMenuSymbol, setFlagMenuSymbol] = useState(null);
  const [flagMenuPos, setFlagMenuPos] = useState({ x: 0, y: 0 });
  const [recentFlagColor, setRecentFlagColor] = useState(() => {
    try {
      const saved = localStorage.getItem('tc_recent_flag_color');
      if (saved && FLAG_COLOR_MAP[saved]) return saved;
    } catch (_e) {}
    return 'red';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveQuotes, setLiveQuotes] = useState({});

  // Resizable Panel Width State (clamped 240px - 700px, persisted)
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('tc_zerodha_panel_width');
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 240 && parsed <= 700) {
        return parsed;
      }
    } catch (_e) {}
    return 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  // Drag and Drop reordering state
  const [draggedSymbol, setDraggedSymbol] = useState(null);
  const [dragOverSymbol, setDragOverSymbol] = useState(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState(null);

  const activeRowRef = useRef(null);
  const groupMenuRef = useRef(null);
  const panelAsideRef = useRef(null);

  // Compute Sunday-based Week Key
  const weekKey = useMemo(() => {
    return getSundayOfWeek(selectedDate);
  }, [selectedDate]);

  // Extract stocks bucket for current week and region
  const weekStocksMap = useMemo(() => {
    if (!appData?.weeks) return {};
    const regionBucket = appData.weeks[region] || appData.weeks;
    return regionBucket?.[weekKey]?.stocks || {};
  }, [appData, region, weekKey]);

  // Saved custom order for current week
  const customOrder = useMemo(() => {
    if (!appData?.weeks) return null;
    const regionBucket = appData.weeks[region] || appData.weeks;
    return regionBucket?.[weekKey]?.customOrder || null;
  }, [appData, region, weekKey]);

  // Available Watchlists list
  const availableWatchlists = useMemo(() => {
    const list = [{ id: 'ALL', name: 'All Stocks' }];
    if (Array.isArray(appData?.watchlists)) {
      appData.watchlists.forEach((w) => {
        const id = typeof w === 'string' ? w : w.id || w.name;
        const name = typeof w === 'string' ? w : w.name || w.id;
        if (id && !list.some((item) => item.id === id)) {
          list.push({ id, name });
        }
      });
    }
    Object.values(weekStocksMap).forEach((st) => {
      if (Array.isArray(st.watchlists)) {
        st.watchlists.forEach((wName) => {
          if (wName && !list.some((item) => item.id === wName)) {
            list.push({ id: wName, name: wName });
          }
        });
      }
    });
    return list;
  }, [appData, weekStocksMap]);

  // Filter and sort stocks list
  const stockList = useMemo(() => {
    let stocks = Object.values(weekStocksMap);

    // Apply custom ordering if saved
    if (Array.isArray(customOrder) && customOrder.length > 0) {
      stocks.sort((a, b) => {
        const idxA = customOrder.indexOf(a.symbol);
        const idxB = customOrder.indexOf(b.symbol);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.symbol || '').localeCompare(b.symbol || '');
      });
    }

    // Watchlist filter (matches both ID and name for backwards compatibility)
    if (selectedWatchlist !== 'ALL') {
      const targetWl = (appData?.watchlists || []).find((w) => w.id === selectedWatchlist || w.name === selectedWatchlist);
      const targetName = targetWl?.name;
      stocks = stocks.filter((s) => {
        if (Array.isArray(s.watchlists)) {
          return s.watchlists.includes(selectedWatchlist) || (targetName && s.watchlists.includes(targetName));
        }
        return false;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      stocks = stocks.filter((s) => {
        return (
          s.symbol?.toLowerCase().includes(q) ||
          s.name?.toLowerCase().includes(q) ||
          s.sector?.toLowerCase().includes(q) ||
          (Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q)))
        );
      });
    }

    // Inject live quotes into stocks
    return stocks.map((s) => {
      const clean = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      const quote = liveQuotes[clean] || liveQuotes[s.symbol];
      if (quote) {
        const curPx = quote.currentPrice ?? quote.price ?? s.currentPrice;
        const chgPct = quote.dailyChangePct ?? quote.changePct ?? s.dailyChangePct;
        return {
          ...s,
          currentPrice: curPx,
          dailyChangePct: chgPct,
          isAdvancing: quote.isAdvancing ?? (chgPct !== undefined ? chgPct >= 0 : s.isAdvancing),
        };
      }
      return s;
    });
  }, [weekStocksMap, customOrder, selectedWatchlist, searchQuery, liveQuotes]);

  // Group stocks into categories
  const groupedStocks = useMemo(() => {
    if (grouping === 'none') {
      return [{ key: 'all', title: '', stocks: stockList }];
    }

    const groups = {};

    stockList.forEach((s) => {
      let groupKey = 'Unassigned';
      let title = 'Unassigned';
      let flagColor = null;

      if (grouping === 'sector') {
        const rawSec = s.sector || 'Unassigned';
        title = formatSectionTitle(rawSec);
        groupKey = title;
      } else if (grouping === 'flag') {
        if (s.flagColor && FLAG_COLOR_MAP[s.flagColor]) {
          groupKey = s.flagColor;
          const colorName = s.flagColor.charAt(0).toUpperCase() + s.flagColor.slice(1).toLowerCase();
          title = `${colorName} Flag`;
          flagColor = s.flagColor;
        } else {
          groupKey = 'no_flag';
          title = 'No Flag';
        }
      } else if (grouping === 'tag') {
        if (Array.isArray(s.tags) && s.tags.length > 0) {
          const rawTag = s.tags[0];
          title = formatSectionTitle(rawTag);
          groupKey = title;
        } else {
          groupKey = 'no_tags';
          title = 'No Tags';
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { key: groupKey, title, flagColor, stocks: [] };
      }
      groups[groupKey].stocks.push(s);
    });

    return Object.values(groups).sort((a, b) => {
      const isAEnd = a.key === 'Unassigned' || a.key === 'no_flag' || a.key === 'no_tags';
      const isBEnd = b.key === 'Unassigned' || b.key === 'no_flag' || b.key === 'no_tags';
      if (isAEnd && !isBEnd) return 1;
      if (!isAEnd && isBEnd) return -1;
      return a.title.localeCompare(b.title);
    });
  }, [stockList, grouping]);

  // Market Breadth calculation (Advancing vs Declining)
  const calculateBreadth = useCallback((stocks) => {
    let adv = 0;
    let dec = 0;
    stocks.forEach((s) => {
      const chg = typeof s.dailyChangePct === 'number' ? s.dailyChangePct : null;
      if (chg !== null) {
        if (chg >= 0) adv++;
        else dec++;
      } else if (s.isAdvancing !== false) {
        adv++;
      } else {
        dec++;
      }
    });
    return { adv, dec, total: stocks.length };
  }, []);

  const totalBreadth = useMemo(() => calculateBreadth(stockList), [stockList, calculateBreadth]);

  // Compute exact flattened list of visible stocks as ordered on the screen
  const visibleStocksOrdered = useMemo(() => {
    const result = [];
    groupedStocks.forEach((group) => {
      if (!collapsedGroups[group.key]) {
        group.stocks.forEach((s) => {
          result.push(s);
        });
      }
    });
    return result;
  }, [groupedStocks, collapsedGroups]);

  // Notify parent of ordered visible stocks for seamless keyboard arrow navigation
  useEffect(() => {
    if (onVisibleStocksChange) {
      onVisibleStocksChange(visibleStocksOrdered);
    }
  }, [visibleStocksOrdered, onVisibleStocksChange]);

  // Handle quote refresh
  const handleRefreshQuotes = async () => {
    const symbols = stockList.map((s) => s.symbol).filter(Boolean);
    if (symbols.length === 0) return;

    setIsRefreshing(true);
    try {
      const countrySuffix = region === 'IN' ? '.NS' : '';
      const mappedSymbols = symbols.map((sym) => (sym.includes('.') ? sym : `${sym}${countrySuffix}`));
      const quotesList = await fetchStockQuotes(mappedSymbols, region, null, true);

      const normalizedQuotes = {};
      if (Array.isArray(quotesList)) {
        quotesList.forEach((qData) => {
          if (!qData || !qData.symbol) return;
          const clean = qData.symbol.replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
          normalizedQuotes[clean] = qData;
          normalizedQuotes[qData.symbol] = qData;
        });
      }

      setLiveQuotes((prev) => {
        const updated = { ...prev, ...normalizedQuotes };
        if (typeof onQuotesChange === 'function') {
          onQuotesChange(updated);
        }
        return updated;
      });
    } catch (err) {
      console.warn('[ZerodhaWatchlistPanel] Failed to refresh quotes:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-fetch quotes if any stocks in the selected watchlist are missing live quotes
  useEffect(() => {
    if (!stockList || stockList.length === 0) return;
    const hasUnfetched = stockList.some((s) => {
      const clean = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      return !liveQuotes[clean] && !liveQuotes[s.symbol];
    });
    if (hasUnfetched && !isRefreshing) {
      handleRefreshQuotes();
    }
  }, [selectedWatchlist, stockList]);

  // Seamless side-by-side docking: compresses Kite's body and chart canvas
  useEffect(() => {
    const isZerodha = typeof window !== 'undefined' && window.location.hostname.includes('zerodha.com');
    if (!isZerodha) return;

    const dockWidth = isCollapsed ? 38 : panelWidth;
    document.documentElement.style.setProperty('--tc-dock-width', `${panelWidth}px`);
    const widthStr = `calc(100vw - ${dockWidth}px)`;
    const marginStr = `${dockWidth}px`;

    // 1. Toggle root class for CSS-based layout
    document.documentElement.classList.toggle('tc-dock-active', !isCollapsed);
    document.documentElement.classList.toggle('tc-dock-collapsed', isCollapsed);

    // 2. Direct inline style enforcement on body & containers
    const prevMarginRight = document.body.style.marginRight;
    const prevWidth = document.body.style.width;
    const prevMaxWidth = document.body.style.maxWidth;

    document.body.style.marginRight = marginStr;
    document.body.style.width = widthStr;
    document.body.style.maxWidth = widthStr;
    document.body.style.boxSizing = 'border-box';

    // Target Kite's container elements directly
    const kiteContainers = document.querySelectorAll(
      '#app, .container, .page-content, header, .header, .chart-container, .tv-chart-container, #tv_chart_container, iframe'
    );
    kiteContainers.forEach((el) => {
      el.style.maxWidth = widthStr;
      if (el.tagName === 'IFRAME') el.style.width = widthStr;
    });

    // 3. Dispatch resize events so TradingView redraws to the exact new width
    const triggerResize = () => {
      window.dispatchEvent(new Event('resize'));
      document.querySelectorAll('iframe').forEach((iframe) => {
        try {
          iframe.contentWindow?.dispatchEvent(new Event('resize'));
        } catch (_e) {
          // Cross-origin iframe
        }
      });
    };

    triggerResize();
    const t1 = setTimeout(triggerResize, 60);
    const t2 = setTimeout(triggerResize, 200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.style.marginRight = prevMarginRight;
      document.body.style.width = prevWidth;
      document.body.style.maxWidth = prevMaxWidth;
      kiteContainers.forEach((el) => {
        el.style.maxWidth = '';
        if (el.tagName === 'IFRAME') el.style.width = '';
      });
      document.documentElement.classList.remove('tc-dock-active', 'tc-dock-collapsed');
      triggerResize();
    };
  }, [isCollapsed, panelWidth]);

  // Draggable Left Edge Resizer for smooth width adjustment
  const handleMouseDownResize = (e) => {
    // Only handle primary left-click
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.documentElement.classList.add('tc-resizing');

    // Disable pointer-events on all iframes so TradingView doesn't swallow mouse movements during drag
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      iframe.style.pointerEvents = 'none';
    });

    const onMouseMove = (moveEvent) => {
      const cursorWidth = window.innerWidth - moveEvent.clientX;
      const maxLimit = Math.min(Math.round(window.innerWidth * 0.7), 800);
      const newWidth = Math.max(280, Math.min(cursorWidth, maxLimit));
      setPanelWidth(newWidth);
      panelWidthRef.current = newWidth;
      document.documentElement.style.setProperty('--tc-dock-width', `${newWidth}px`);

      if (panelAsideRef.current) {
        panelAsideRef.current.style.width = `${newWidth}px`;
      }
      const widthStr = `calc(100vw - ${newWidth}px)`;
      document.body.style.width = widthStr;
      document.body.style.maxWidth = widthStr;
      document.body.style.marginRight = `${newWidth}px`;
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.documentElement.classList.remove('tc-resizing');

      iframes.forEach((iframe) => {
        iframe.style.pointerEvents = '';
      });

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);

      try {
        localStorage.setItem('tc_zerodha_panel_width', String(panelWidthRef.current));
      } catch (_e) {
        /* ignore */
      }

      // Fire resize so chart adapts to final dropped width
      window.dispatchEvent(new Event('resize'));
      iframes.forEach((iframe) => {
        try {
          iframe.contentWindow?.dispatchEvent(new Event('resize'));
        } catch (_err) {
          /* ignore */
        }
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onMouseUp);
  };

  // Auto-scroll active stock row into view
  useEffect(() => {
    if (typeof activeRowRef.current?.scrollIntoView === 'function') {
      activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSymbol]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (flagMenuSymbol && !e.target.closest('.tc-flag-palette-popover')) {
        setFlagMenuSymbol(null);
      }
      if (isGroupMenuOpen && groupMenuRef.current && !groupMenuRef.current.contains(e.target)) {
        setIsGroupMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [flagMenuSymbol, isGroupMenuOpen]);

  // Drag and Drop handlers (with section migration support)
  const handleDragStart = (e, symbol) => {
    setDraggedSymbol(symbol);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', symbol);
  };

  const handleDragEnd = () => {
    setDraggedSymbol(null);
    setDragOverSymbol(null);
    setDragOverGroupKey(null);
  };

  const handleRowDragOver = (e, targetSymbol) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSymbol !== targetSymbol) {
      setDragOverSymbol(targetSymbol);
    }
    if (dragOverGroupKey !== null) {
      setDragOverGroupKey(null);
    }
  };

  const handleRowDragLeave = (e, targetSymbol) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverSymbol === targetSymbol) {
      setDragOverSymbol(null);
    }
  };

  const handleHeaderDragOver = (e, groupKey) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroupKey !== groupKey) {
      setDragOverGroupKey(groupKey);
    }
    if (dragOverSymbol !== null) {
      setDragOverSymbol(null);
    }
  };

  const handleHeaderDragLeave = (e, groupKey) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverGroupKey === groupKey) {
      setDragOverGroupKey(null);
    }
  };

  const handleHeaderDrop = (e, targetGroup) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSymbol) {
      handleDragEnd();
      return;
    }

    const draggedStock = stockList.find((s) => s.symbol === draggedSymbol);
    if (!draggedStock) {
      handleDragEnd();
      return;
    }

    let targetSection = null;
    if (grouping === 'sector') {
      targetSection = {
        grouping: 'sector',
        sector: targetGroup.key === 'Unassigned' ? '' : targetGroup.key,
      };
    } else if (grouping === 'flag') {
      targetSection = {
        grouping: 'flag',
        flagColor: targetGroup.flagColor || 'no_flag',
      };
    } else if (grouping === 'tag') {
      targetSection = {
        grouping: 'tag',
        tag: targetGroup.key === 'no_tags' ? '' : targetGroup.key,
      };
    }

    // Auto expand the target section on drop so moved stock is immediately visible
    setCollapsedGroups((prev) => {
      const updated = { ...prev, [targetGroup.key]: false };
      try {
        localStorage.setItem('tc_zerodha_collapsed_groups', JSON.stringify(updated));
      } catch (_e) {}
      return updated;
    });

    const currentSymbols = (Array.isArray(customOrder) && customOrder.length > 0)
      ? [...customOrder]
      : stockList.map((s) => s.symbol);

    const fromIdx = currentSymbols.indexOf(draggedSymbol);
    if (fromIdx !== -1) {
      currentSymbols.splice(fromIdx, 1);
    }

    // Insert at beginning of target section
    const firstOther = targetGroup.stocks.find((s) => s.symbol !== draggedSymbol);
    if (firstOther) {
      const toIdx = currentSymbols.indexOf(firstOther.symbol);
      if (toIdx !== -1) {
        currentSymbols.splice(toIdx, 0, draggedSymbol);
      } else {
        currentSymbols.push(draggedSymbol);
      }
    } else {
      currentSymbols.push(draggedSymbol);
    }

    if (onMoveStockToSection) {
      onMoveStockToSection(draggedSymbol, targetSection, currentSymbols);
    } else if (onReorderStocks) {
      if (targetSection?.grouping === 'flag' && onUpdateStockFlag) {
        onUpdateStockFlag(draggedSymbol, targetSection.flagColor === 'no_flag' ? null : targetSection.flagColor);
      }
      onReorderStocks(currentSymbols, weekKey);
    }

    handleDragEnd();
  };

  const handleRowDrop = (e, targetStock, targetGroup) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSymbol || draggedSymbol === targetStock.symbol) {
      handleDragEnd();
      return;
    }

    const draggedStock = stockList.find((s) => s.symbol === draggedSymbol);
    let targetSection = null;

    if (grouping === 'sector') {
      const targetSec = targetStock.sector || (targetGroup?.key !== 'all' ? targetGroup?.key : '') || '';
      if (draggedStock?.sector !== targetSec) {
        targetSection = {
          grouping: 'sector',
          sector: targetSec === 'Unassigned' ? '' : targetSec,
        };
      }
    } else if (grouping === 'flag') {
      const targetFlag = targetStock.flagColor || null;
      if (draggedStock?.flagColor !== targetFlag) {
        targetSection = {
          grouping: 'flag',
          flagColor: targetFlag || 'no_flag',
        };
      }
    } else if (grouping === 'tag') {
      const targetTag = Array.isArray(targetStock.tags) && targetStock.tags[0] ? targetStock.tags[0] : '';
      targetSection = {
        grouping: 'tag',
        tag: targetTag,
      };
    }

    const currentSymbols = (Array.isArray(customOrder) && customOrder.length > 0)
      ? [...customOrder]
      : stockList.map((s) => s.symbol);

    const fromIndex = currentSymbols.indexOf(draggedSymbol);
    const toIndex = currentSymbols.indexOf(targetStock.symbol);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...currentSymbols];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);

      if (onMoveStockToSection) {
        onMoveStockToSection(draggedSymbol, targetSection, newOrder);
      } else if (onReorderStocks) {
        if (targetSection?.grouping === 'flag' && onUpdateStockFlag) {
          onUpdateStockFlag(draggedSymbol, targetSection.flagColor === 'no_flag' ? null : targetSection.flagColor);
        }
        onReorderStocks(newOrder, weekKey);
      }
    } else {
      if (onMoveStockToSection && targetSection) {
        onMoveStockToSection(draggedSymbol, targetSection, currentSymbols);
      }
    }

    handleDragEnd();
  };

  return (
    <aside
      ref={panelAsideRef}
      className={`tc-zerodha-watchlist-panel ${isCollapsed ? 'collapsed' : ''} ${draggedSymbol ? 'tc-is-dragging' : ''}`}
      onKeyDown={(e) => {
        // Prevent typing and panel shortcuts from triggering Kite's global shortcuts (e.g. B, S, /)
        e.stopPropagation();
      }}
      onKeyUp={(e) => {
        e.stopPropagation();
      }}
      onKeyPress={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        height: '100vh',
        width: isCollapsed ? '38px' : `${panelWidth}px`,
        background: '#131823',
        borderLeft: '1px solid #2a2e39',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2147483645,
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.4)',
        transition: isResizing ? 'none' : 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        boxSizing: 'border-box',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes tc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .tc-is-dragging * {
          pointer-events: none !important;
        }
        .tc-is-dragging .tc-watchlist-section-header,
        .tc-is-dragging [id^="tc-stock-row-"] {
          pointer-events: auto !important;
        }
        html.tc-resizing body,
        html.tc-resizing .tc-zerodha-watchlist-panel,
        html.tc-resizing iframe {
          transition: none !important;
          user-select: none !important;
        }
        html.tc-resizing iframe {
          pointer-events: none !important;
        }
        .tc-resizing,
        .tc-resizing * {
          cursor: col-resize !important;
        }
        .tc-dock-toggle-pill,
        .tc-dock-toggle-pill * {
          cursor: pointer !important;
        }
      `}</style>
      {/* Draggable Left Border Resizer Handle (Clean transparent grab overlay, never obscures UI) */}
      {!isCollapsed && (
        <div
          className="tc-panel-resizer-handle"
          onMouseDown={handleMouseDownResize}
          title="Drag left/right to resize watchlist width"
          style={{
            position: 'absolute',
            left: '-4px',
            top: 0,
            bottom: 0,
            width: '8px',
            cursor: 'col-resize',
            zIndex: 100,
            background: 'transparent',
            userSelect: 'none',
          }}
        />
      )}

      {/* Vertically Centered Left-Border Dock Expand/Collapse Action Pill */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed((prev) => !prev);
        }}
        title={isCollapsed ? 'Expand Watchlist Panel' : 'Collapse Sidebar'}
        className="tc-dock-toggle-pill"
        style={{
          position: 'absolute',
          left: isCollapsed ? '-5px' : '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '9px',
          height: '34px',
          borderRadius: '12px',
          background: '#0284c7',
          border: '1px solid rgba(56, 189, 248, 0.55)',
          boxShadow: '-1px 0 6px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 105,
          transition: 'all 0.15s ease',
          userSelect: 'none',
          padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#38bdf8';
          e.currentTarget.style.boxShadow = '-1px 0 10px rgba(56, 189, 248, 0.7)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#0284c7';
          e.currentTarget.style.boxShadow = '-1px 0 6px rgba(0, 0, 0, 0.45)';
        }}
      >
        <svg
          width="7"
          height="7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block', pointerEvents: 'none' }}
        >
          {isCollapsed ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
        </svg>
      </div>

      {/* COLLAPSED RAIL VIEW */}
      {isCollapsed ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 0',
            gap: '12px',
            height: '100%',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsCollapsed(false)}
            title="Expand TradeClarity Watchlists"
            style={{
              width: '28px',
              height: '28px',
              minWidth: '28px',
              maxWidth: '28px',
              minHeight: '28px',
              maxHeight: '28px',
              borderRadius: '6px',
              background: '#1c2233',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#27344f';
              e.currentTarget.style.borderColor = '#38bdf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1c2233';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', width: '14px', height: '14px', flexShrink: 0 }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          <div
            style={{
              width: '22px',
              height: '22px',
              background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
            }}
          >
            TC
          </div>
        </div>
      ) : (
        /* EXPANDED CONTENT VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header Bar */}
          <div
            style={{
              padding: '6px 10px',
              background: '#10141e',
              borderBottom: '1px solid #2a2e39',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            {/* Left Brand Lockup, Count & Total Adv/Decline Breadth */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, minWidth: 0 }}>
              <div
                className="tc-brand-logo"
                title="TradeClarity.market"
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  cursor: 'default',
                  userSelect: 'none',
                  lineHeight: 1.1,
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  TradeClarity
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 900,
                    color: '#00d1ff',
                    margin: '0 1px',
                    textShadow: '0 0 10px rgba(0, 209, 255, 0.45)',
                    display: 'inline-block',
                    transform: 'scale(1.15)',
                  }}
                >
                  .
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 300,
                    color: '#cbd5e1',
                    letterSpacing: '0.06em',
                    opacity: 0.9,
                    display: 'inline-block',
                  }}
                >
                  market
                </span>
              </div>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                ({stockList.length})
              </span>

              {/* Total Adv vs Decline Market Breadth Pill */}
              {totalBreadth.total > 0 && (
                <div
                  title={`Watchlist Breadth: ${totalBreadth.adv} Advancing (${Math.round((totalBreadth.adv / totalBreadth.total) * 100)}%), ${totalBreadth.dec} Declining`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    cursor: 'default',
                    flexShrink: 0,
                    lineHeight: '13px',
                  }}
                >
                  <span style={{ color: '#22c55e' }}>{totalBreadth.adv}▲</span>
                  <span style={{ color: '#64748b', fontSize: '9px' }}>:</span>
                  <span style={{ color: '#ef4444' }}>{totalBreadth.dec}▼</span>
                </div>
              )}
            </div>

            {/* TOP-RIGHT ACTION ICONS: Refresh, Add Stock, Open in Extension (Compact 24x24 buttons with 4px gap) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {/* 1. Refresh Live Quotes */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleRefreshQuotes}
                title={isRefreshing ? "Refreshing Live Quotes..." : "Refresh Live Market Quotes"}
                style={{
                  width: '24px',
                  height: '24px',
                  minWidth: '24px',
                  maxWidth: '24px',
                  minHeight: '24px',
                  maxHeight: '24px',
                  borderRadius: '5px',
                  background: '#1c2233',
                  border: isRefreshing ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isRefreshing ? 'wait' : 'pointer',
                  boxSizing: 'border-box',
                  padding: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#27344f';
                  e.currentTarget.style.borderColor = '#38bdf8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1c2233';
                  e.currentTarget.style.borderColor = isRefreshing ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)';
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    display: 'block',
                    animation: isRefreshing ? 'tc-spin 0.75s linear infinite' : 'none',
                    transformOrigin: 'center center',
                  }}
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.3" />
                </svg>
              </div>

              {/* 2. Add Stock to Watchlist */}
              {onAddStock && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={onAddStock}
                  title="Add Stock to Watchlist"
                  style={{
                    width: '24px',
                    height: '24px',
                    minWidth: '24px',
                    maxWidth: '24px',
                    minHeight: '24px',
                    maxHeight: '24px',
                    borderRadius: '5px',
                    background: '#1c2233',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#27344f';
                    e.currentTarget.style.borderColor = '#38bdf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1c2233';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ display: 'block' }}
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              )}

              {/* Hyperlink Button: Open Current Viewing Symbol in TradeClarity Extension */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  const clean = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
                  if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
                    chrome.runtime.sendMessage({
                      action: 'OPEN_DASHBOARD',
                      symbol: clean,
                    }, (_res) => {
                      if (chrome.runtime.lastError) {
                        window.open(chrome.runtime.getURL(`dashboard.html?symbol=${encodeURIComponent(clean)}`), '_blank');
                      }
                    });
                  } else {
                    window.open(chrome.runtime.getURL(`dashboard.html?symbol=${encodeURIComponent(clean)}`), '_blank');
                  }
                }}
                title={`Open ${activeSymbol || 'current symbol'} in TradeClarity Extension`}
                style={{
                  width: '24px',
                  height: '24px',
                  minWidth: '24px',
                  maxWidth: '24px',
                  minHeight: '24px',
                  maxHeight: '24px',
                  borderRadius: '5px',
                  background: '#1c2233',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  padding: 0,
                  transition: 'all 0.15s ease',
                  color: '#38bdf8',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#27344f';
                  e.currentTarget.style.borderColor = '#38bdf8';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1c2233';
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                  e.currentTarget.style.color = '#38bdf8';
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </div>
            </div>
          </div>

          {/* COMPACT & ELEGANT CONTROLS STRIP */}
          <div
            style={{
              padding: '6px 10px',
              background: '#151b27',
              borderBottom: '1px solid #2a2e39',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* ROW 1: Watchlist Dropdown + Date / Week Picker in ONE LINE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={selectedWatchlist}
                onChange={(e) => setSelectedWatchlist(e.target.value)}
                style={{
                  flex: 1,
                  background: '#1c2233',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '5px',
                  color: '#ffffff',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  height: '28px',
                  boxSizing: 'border-box',
                }}
              >
                {availableWatchlists.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              {/* Date & Week Key Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '5px',
                  padding: '2px 6px',
                  height: '28px',
                  boxSizing: 'border-box',
                }}
                title={`Sunday Week Key: ${weekKey}`}
              >
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100px',
                  }}
                />
              </div>
            </div>

            {/* ROW 2: Filter Input + Sleek Grouping Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Filter Ticker Input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#1a2030',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '5px',
                  padding: '0 8px',
                  flex: 1,
                  height: '28px',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: '11px', color: '#64748b' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Filter ticker or sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: '11px',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                />
                {searchQuery && (
                  <span
                    onClick={() => setSearchQuery('')}
                    style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '11px', fontWeight: 700 }}
                  >
                    ✕
                  </span>
                )}
              </div>

              {/* FINETUNED GROUPING POPOVER (Clean Vector Icon & Minimalist Design) */}
              <div ref={groupMenuRef} style={{ position: 'relative' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsGroupMenuOpen(!isGroupMenuOpen);
                  }}
                  title="Group Watchlist"
                  style={{
                    background: isGroupMenuOpen ? 'rgba(56, 189, 248, 0.2)' : '#1c2233',
                    border: isGroupMenuOpen ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '5px',
                    color: isGroupMenuOpen ? '#38bdf8' : '#cbd5e1',
                    padding: '0 8px',
                    height: '28px',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  <span>
                    {grouping === 'sector'
                      ? 'Sector'
                      : grouping === 'flag'
                      ? 'Flag'
                      : grouping === 'tag'
                      ? 'Tag'
                      : 'Flat'}
                  </span>
                  <span style={{ fontSize: '8px', color: '#64748b' }}>▾</span>
                </div>

                {/* Grouping Dropdown Popover */}
                {isGroupMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '4px',
                      background: '#182030',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '6px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
                      width: '145px',
                      zIndex: 10005,
                      padding: '4px 0',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ padding: '4px 10px', fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                      Group By:
                    </div>

                    {[
                      { id: 'sector', label: 'Sector' },
                      { id: 'flag', label: 'Flag Color' },
                      { id: 'tag', label: 'Tag' },
                      { id: 'none', label: 'Flat List' },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setGrouping(opt.id);
                          setIsGroupMenuOpen(false);
                        }}
                        style={{
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: grouping === opt.id ? '#38bdf8' : '#cbd5e1',
                          background: grouping === opt.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (grouping !== opt.id) e.currentTarget.style.background = '#252f44';
                        }}
                        onMouseLeave={(e) => {
                          if (grouping !== opt.id) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span>{opt.label}</span>
                        {grouping === opt.id && <span style={{ fontWeight: 800 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* QUICK EXPAND ALL / COLLAPSE ALL SECTIONS BUTTON */}
              {grouping !== 'none' && groupedStocks.length > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const allCollapsed = groupedStocks.every((g) => collapsedGroups[g.key]);
                    const nextState = {};
                    if (!allCollapsed) {
                      groupedStocks.forEach((g) => {
                        nextState[g.key] = true;
                      });
                    }
                    setCollapsedGroups(nextState);
                    try {
                      localStorage.setItem('tc_zerodha_collapsed_groups', JSON.stringify(nextState));
                    } catch (_e) {}
                  }}
                  title={
                    groupedStocks.every((g) => collapsedGroups[g.key])
                      ? 'Expand All Sections'
                      : 'Collapse All Sections'
                  }
                  style={{
                    width: '28px',
                    height: '28px',
                    minWidth: '28px',
                    borderRadius: '5px',
                    background: '#1c2233',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: 0,
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#38bdf8';
                    e.currentTarget.style.color = '#38bdf8';
                    e.currentTarget.style.background = '#27344f';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.background = '#1c2233';
                  }}
                >
                  {groupedStocks.every((g) => collapsedGroups[g.key]) ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="7 13 12 18 17 13" />
                      <polyline points="7 6 12 11 17 6" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 11 12 6 7 11" />
                      <polyline points="17 18 12 13 7 18" />
                    </svg>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stock List Scroll Area with Drag & Drop Reordering */}
          <div
            id="tc-stock-list-container"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '2px 0',
            }}
          >
            {groupedStocks.map((group, groupIdx) => {
              const isGroupCollapsed = collapsedGroups[group.key] || false;
              const showGroupHeader = group.title !== '';
              const isHeaderDropTarget = dragOverGroupKey === group.key;
              const groupBreadth = calculateBreadth(group.stocks);
              const isFirst = groupIdx === 0;

              return (
                <div key={group.key} style={{ marginTop: showGroupHeader && !isFirst ? '8px' : '0' }}>
                  {showGroupHeader && (
                    <div
                      className="tc-watchlist-section-header"
                      onClick={() => {
                        setCollapsedGroups((prev) => {
                          const updated = {
                            ...prev,
                            [group.key]: !prev[group.key],
                          };
                          try {
                            localStorage.setItem('tc_zerodha_collapsed_groups', JSON.stringify(updated));
                          } catch (_e) {}
                          return updated;
                        });
                      }}
                      onDragOver={(e) => handleHeaderDragOver(e, group.key)}
                      onDragLeave={(e) => handleHeaderDragLeave(e, group.key)}
                      onDrop={(e) => handleHeaderDrop(e, group)}
                      title={`${isGroupCollapsed ? 'Expand' : 'Collapse'} ${group.title} section (or drop here to move)`}
                      style={{
                        padding: '0 10px',
                        height: '30px',
                        minHeight: '30px',
                        background: isHeaderDropTarget
                          ? 'rgba(56, 189, 248, 0.25)'
                          : 'linear-gradient(90deg, #1b2438 0%, #151b29 100%)',
                        borderLeft: isHeaderDropTarget
                          ? '3px solid #38bdf8'
                          : '3px solid #0284c7',
                        borderTop: '1px solid rgba(255, 255, 255, 0.09)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isHeaderDropTarget) e.currentTarget.style.background = 'linear-gradient(90deg, #243049 0%, #1c2438 100%)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isHeaderDropTarget) e.currentTarget.style.background = 'linear-gradient(90deg, #1b2438 0%, #151b29 100%)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        {/* Interactive Collapse / Expand Chevron Icon */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '14px',
                            height: '14px',
                            color: '#38bdf8',
                            transition: 'transform 0.18s ease',
                            transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>

                        {/* Category / Sector Icon */}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ opacity: 0.85, flexShrink: 0 }}
                        >
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>

                        {group.flagColor ? (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: FLAG_COLOR_MAP[group.flagColor],
                              boxShadow: `0 0 6px ${FLAG_COLOR_MAP[group.flagColor]}`,
                            }}
                          />
                        ) : null}

                        {/* Bold Distinctive Sector Title */}
                        <span
                          style={{
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.2px',
                          }}
                        >
                          {group.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isHeaderDropTarget && (
                          <span style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 700, textTransform: 'none' }}>
                            Drop to move
                          </span>
                        )}

                        {/* Sector Adv vs Decline Breadth Pill */}
                        {groupBreadth.total > 0 && (
                          <span
                            title={`Sector Breadth: ${groupBreadth.adv} Advancing, ${groupBreadth.dec} Declining`}
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'rgba(0, 0, 0, 0.4)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span style={{ color: '#22c55e' }}>{groupBreadth.adv}▲</span>
                            <span style={{ color: '#64748b', fontSize: '8px' }}>:</span>
                            <span style={{ color: '#ef4444' }}>{groupBreadth.dec}▼</span>
                          </span>
                        )}

                        {/* Elevated Count Badge */}
                        <span
                          style={{
                            background: '#1e293b',
                            color: '#38bdf8',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '6px',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                          }}
                        >
                          {group.stocks.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {!isGroupCollapsed &&
                    group.stocks.map((s) => {
                      const cleanActive = (activeSymbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
                      const cleanStock = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
                      const isActive = cleanStock === cleanActive;
                      const liveQuote = liveQuotes[cleanStock] || liveQuotes[s.symbol];
                      const hasLivePrice = liveQuote && typeof liveQuote.currentPrice === 'number' && liveQuote.currentPrice > 0;
                      const priceVal = hasLivePrice ? liveQuote.currentPrice : (s.currentPrice ?? 0);
                      const changeVal = (liveQuote && typeof liveQuote.dailyChangePct === 'number')
                        ? liveQuote.dailyChangePct
                        : (s.dailyChangePct ?? 0);
                      const isAdv = (liveQuote && typeof liveQuote.isAdvancing === 'boolean')
                        ? liveQuote.isAdvancing
                        : (s.isAdvancing ?? changeVal >= 0);
                      const isBeingDragged = draggedSymbol === s.symbol;
                      const isDropTarget = dragOverSymbol === s.symbol;

                      // Earnings resolution - comprehensive matching EditStockModal
                      const cachedFund = globalFundamentalsCache.get(`${cleanStock}_${region}`) ||
                                         globalFundamentalsCache.get(`${cleanStock}.NS_${region}`) ||
                                         globalFundamentalsCache.get(`${cleanStock}_IN`) ||
                                         globalFundamentalsCache.get(`${cleanStock}.NS_IN`);
                      const rawEarningsDate = s.earningsDate ||
                                              s.params?.earningsDate ||
                                              s.parameters?.earningsDate ||
                                              liveQuote?.earningsDate ||
                                              cachedFund?.data?.catalysts?.earningsDate ||
                                              null;

                      let earningsDays = null;
                      if (rawEarningsDate) {
                        earningsDays = calculateDaysAway(rawEarningsDate);
                      }
                      if (earningsDays === null) {
                        if (typeof s.earningsDaysAway === 'number') {
                          earningsDays = s.earningsDaysAway;
                        } else if (typeof s.params?.earningsDaysAway === 'number') {
                          earningsDays = s.params.earningsDaysAway;
                        } else if (typeof s.parameters?.earningsDaysAway === 'number') {
                          earningsDays = s.parameters.earningsDaysAway;
                        } else if (typeof liveQuote?.earningsDaysAway === 'number') {
                          earningsDays = liveQuote.earningsDaysAway;
                        } else if (typeof cachedFund?.data?.catalysts?.earningsDaysAway === 'number') {
                          earningsDays = cachedFund.data.catalysts.earningsDaysAway;
                        }
                      }

                      // Smart & clean earnings badge (avoids cluttering rows when > 45d away or > 14d past)
                      let earningsBadge = null;
                      if (typeof earningsDays === 'number') {
                        if (earningsDays >= 0 && earningsDays <= 7) {
                          earningsBadge = (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(249, 115, 22, 0.22)',
                                color: '#fb923c',
                                border: '1px solid rgba(249, 115, 22, 0.45)',
                                whiteSpace: 'nowrap',
                                lineHeight: '12px',
                                flexShrink: 0,
                              }}
                              title={`Upcoming Earnings: ${rawEarningsDate || ''} (in ${earningsDays}d)`}
                            >
                              ⚡ {earningsDays === 0 ? 'TODAY' : `${earningsDays}d`}
                            </span>
                          );
                        } else if (earningsDays >= 8 && earningsDays <= 21) {
                          earningsBadge = (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                whiteSpace: 'nowrap',
                                lineHeight: '12px',
                                flexShrink: 0,
                              }}
                              title={`Next Earnings Date: ${rawEarningsDate || ''} (in ${earningsDays}d)`}
                            >
                              📅 {earningsDays}d
                            </span>
                          );
                        } else if (earningsDays >= 22 && earningsDays <= 45) {
                          earningsBadge = (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 500,
                                padding: '0 3px',
                                color: '#64748b',
                                whiteSpace: 'nowrap',
                                lineHeight: '12px',
                                flexShrink: 0,
                                opacity: 0.8,
                              }}
                              title={`Next Earnings Date: ${rawEarningsDate || ''} (in ${earningsDays}d)`}
                            >
                              {earningsDays}d
                            </span>
                          );
                        } else if (earningsDays < 0 && earningsDays >= -14) {
                          earningsBadge = (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 500,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: 'rgba(148, 163, 184, 0.12)',
                                color: '#94a3b8',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                whiteSpace: 'nowrap',
                                lineHeight: '12px',
                                flexShrink: 0,
                              }}
                              title={`Reported Earnings: ${rawEarningsDate || ''} (${Math.abs(earningsDays)}d ago)`}
                            >
                              ✓ Rep
                            </span>
                          );
                        }
                      } else if (rawEarningsDate) {
                        earningsBadge = (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 500,
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: 'rgba(148, 163, 184, 0.12)',
                              color: '#94a3b8',
                              border: '1px solid rgba(148, 163, 184, 0.25)',
                              whiteSpace: 'nowrap',
                              lineHeight: '12px',
                              flexShrink: 0,
                            }}
                            title={`Earnings Date: ${rawEarningsDate}`}
                          >
                            📅 {String(rawEarningsDate).replace(/,\s*\d{4}$/, '')}
                          </span>
                        );
                      }

                      const primaryTag = Array.isArray(s.tags)
                        ? s.tags.find((t) => t && t !== 'Recent Listing' && t !== 'Established')
                        : null;

                      return (
                        <div
                          key={s.symbol}
                          id={`tc-stock-row-${s.symbol}`}
                          ref={isActive ? activeRowRef : null}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, s.symbol)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleRowDragOver(e, s.symbol)}
                          onDragLeave={(e) => handleRowDragLeave(e, s.symbol)}
                          onDrop={(e) => handleRowDrop(e, s, group)}
                          onClick={() => onSelectStock(s)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onOpenContextMenu) onOpenContextMenu(e, s);
                          }}
                          title={`${s.symbol}${s.name ? ` • ${s.name}` : ''}${s.sector ? ` • ${s.sector}` : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 8px',
                            height: '28px',
                            minHeight: '28px',
                            maxHeight: '28px',
                            boxSizing: 'border-box',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                            background: isActive
                              ? '#1e293b'
                              : isDropTarget
                              ? 'rgba(56, 189, 248, 0.08)'
                              : 'transparent',
                            borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                            opacity: isBeingDragged ? 0.35 : 1,
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive && !isDropTarget) e.currentTarget.style.background = '#1c2233';
                            const grip = e.currentTarget.querySelector('.tc-drag-grip');
                            if (grip) grip.style.opacity = '0.85';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive && !isDropTarget) e.currentTarget.style.background = 'transparent';
                            const grip = e.currentTarget.querySelector('.tc-drag-grip');
                            if (grip) grip.style.opacity = '0.25';
                          }}
                        >
                          {/* Smooth Zero-Jitter Drop Position Indicator Line */}
                          {isDropTarget && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '2px',
                                background: '#38bdf8',
                                zIndex: 10,
                                boxShadow: '0 0 6px rgba(56, 189, 248, 0.9)',
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                          {/* Left: Drag grip, Flag icon, Symbol name, Earnings badge, Tag */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              minWidth: 0,
                              flex: 1,
                              overflow: 'hidden',
                              marginRight: '6px',
                            }}
                          >
                            {/* Grip Drag Handle - subtle until hovered */}
                            <span
                              className="tc-drag-grip"
                              title="Drag to reorder"
                              style={{
                                color: '#64748b',
                                cursor: 'grab',
                                fontSize: '11px',
                                userSelect: 'none',
                                marginRight: '-2px',
                                lineHeight: '1',
                                opacity: 0.25,
                                flexShrink: 0,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              ⋮⋮
                            </span>

                            {/* Flag Icon (TradingView-style ribbon banner) */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const hasFlag = Boolean(s.flagColor);
                                if (!hasFlag) {
                                  // First by default apply the last applied colour (TradingView behavior)
                                  if (onUpdateStockFlag) {
                                    onUpdateStockFlag(s.symbol, recentFlagColor);
                                  }
                                }
                                // Position palette right above or below the clicked flag icon
                                setFlagMenuSymbol(s.symbol);
                                const posX = Math.max(10, e.clientX - 60);
                                const posY = e.clientY > 50 ? e.clientY - 38 : e.clientY + 22;
                                setFlagMenuPos({ x: posX, y: posY });
                              }}
                              title={
                                s.flagColor
                                  ? `${s.flagColor.charAt(0).toUpperCase() + s.flagColor.slice(1).toLowerCase()} Flag (Click to change/clear)`
                                  : `Flag stock (${recentFlagColor.charAt(0).toUpperCase() + recentFlagColor.slice(1).toLowerCase()})`
                              }
                              style={{
                                cursor: 'pointer',
                                padding: '1px 2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                opacity: s.flagColor ? 1 : 0.45,
                                transition: 'opacity 0.15s, transform 0.12s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = s.flagColor ? '1' : '0.45';
                              }}
                            >
                              {/* TradingView Bookmark Ribbon Flag (Exact match to TV watchlist) */}
                              <svg
                                width="10"
                                height="12"
                                viewBox="0 0 12 14"
                                style={{ display: 'block', pointerEvents: 'none' }}
                              >
                                <path
                                  d="M0 1h11l-3.5 6 3.5 6H0z"
                                  fill={s.flagColor ? FLAG_COLOR_MAP[s.flagColor] : 'none'}
                                  stroke={s.flagColor ? FLAG_COLOR_MAP[s.flagColor] : '#64748b'}
                                  strokeWidth="1.2"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>

                            {/* Symbol Name (Refined, crisp TradingView-grade medium weight with ellipsis if constrained) */}
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? '#ffffff' : '#e2e8f0',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                letterSpacing: '0.15px',
                                transition: 'color 0.12s',
                                flexShrink: 1,
                                minWidth: 0,
                              }}
                              title={s.symbol}
                            >
                              {s.symbol}
                            </span>

                            {/* Smart Earnings Badge */}
                            {earningsBadge}

                            {/* Tag Pill */}
                            {primaryTag && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  lineHeight: '12px',
                                }}
                              >
                                {formatSectionTitle(primaryTag)}
                              </span>
                            )}
                          </div>

                          {/* Right: Price & % Change aligned in dedicated fixed columns with tabular numbers */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {priceVal > 0 ? (
                              <>
                                <span
                                  style={{
                                    width: '64px',
                                    minWidth: '64px',
                                    textAlign: 'right',
                                    fontWeight: 600,
                                    color: '#f1f5f9',
                                    fontSize: '11.5px',
                                  }}
                                >
                                  ₹{priceVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span
                                  style={{
                                    width: '50px',
                                    minWidth: '50px',
                                    textAlign: 'right',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    color: isAdv ? '#22c55e' : '#ef4444',
                                  }}
                                >
                                  {isAdv ? '+' : ''}
                                  {changeVal.toFixed(2)}%
                                </span>
                              </>
                            ) : (
                              <span style={{ width: '120px', textAlign: 'right', fontSize: '11px', fontWeight: 500, color: '#64748b' }}>-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flag Popover Menu (TradingView-Style Floating Color Palette) */}
      {flagMenuSymbol && (() => {
        const targetStock = stockList.find((st) => st.symbol === flagMenuSymbol);
        const currentFlag = targetStock?.flagColor;

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="tc-flag-palette-popover"
            style={{
              position: 'fixed',
              left: `${flagMenuPos.x}px`,
              top: `${flagMenuPos.y}px`,
              background: '#182030',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              borderRadius: '24px',
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75), 0 0 12px rgba(56, 189, 248, 0.25)',
              zIndex: 10001,
              userSelect: 'none',
            }}
          >
            {Object.entries(FLAG_COLOR_MAP).map(([colorName, colorHex]) => {
              const isSelected = currentFlag === colorName;
              return (
                <div
                  key={colorName}
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetSym = flagMenuSymbol;
                    setFlagMenuSymbol(null);
                    if (isSelected) {
                      // Clicking currently active color clears the flag
                      if (onUpdateStockFlag) onUpdateStockFlag(targetSym, null);
                    } else {
                      if (onUpdateStockFlag) onUpdateStockFlag(targetSym, colorName);
                      setRecentFlagColor(colorName);
                      try {
                        localStorage.setItem('tc_recent_flag_color', colorName);
                      } catch (_e) {}
                    }
                  }}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: colorHex,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: isSelected ? `0 0 8px ${colorHex}` : 'none',
                    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.12s ease',
                    boxSizing: 'border-box',
                  }}
                  title={
                    isSelected
                      ? `${colorName.charAt(0).toUpperCase() + colorName.slice(1).toLowerCase()} Flag (Click to clear)`
                      : `Set ${colorName.charAt(0).toUpperCase() + colorName.slice(1).toLowerCase()} Flag`
                  }
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1.2)';
                      e.currentTarget.style.boxShadow = `0 0 8px ${colorHex}`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                />
              );
            })}
            <div
              onClick={(e) => {
                e.stopPropagation();
                const targetSym = flagMenuSymbol;
                setFlagMenuSymbol(null);
                if (onUpdateStockFlag) onUpdateStockFlag(targetSym, null);
              }}
              style={{
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '0 3px',
                fontWeight: 700,
                transition: 'color 0.12s',
              }}
              title="Clear Flag"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              ✕
            </div>
          </div>
        );
      })()}
    </aside>
  );
}
