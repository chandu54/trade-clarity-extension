import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getSundayOfWeek, getLocalDateString } from '../../utils/weekHelpers';
import { fetchStockQuotes } from '../../utils/yahooFinanceMap';
import { calculateDaysAway, globalFundamentalsCache } from '../../utils/stockAnalysisApi';

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
  onVisibleStocksChange,
  onQuotesChange,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
  const [selectedWatchlist, setSelectedWatchlist] = useState('ALL');
  const [grouping, setGrouping] = useState('sector'); // 'none' | 'sector' | 'flag' | 'tag'
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [flagMenuSymbol, setFlagMenuSymbol] = useState(null);
  const [flagMenuPos, setFlagMenuPos] = useState({ x: 0, y: 0 });
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

  const activeRowRef = useRef(null);
  const groupMenuRef = useRef(null);

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
        groupKey = s.sector || 'Unassigned';
        title = groupKey;
      } else if (grouping === 'flag') {
        if (s.flagColor && FLAG_COLOR_MAP[s.flagColor]) {
          groupKey = s.flagColor;
          title = `${s.flagColor.toUpperCase()} FLAG`;
          flagColor = s.flagColor;
        } else {
          groupKey = 'no_flag';
          title = 'No Flag';
        }
      } else if (grouping === 'tag') {
        if (Array.isArray(s.tags) && s.tags.length > 0) {
          groupKey = s.tags[0];
          title = groupKey;
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

    return Object.values(groups).sort((a, b) => a.title.localeCompare(b.title));
  }, [stockList, grouping]);

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

  // Auto-fetch quotes if any stocks in the selected watchlist are missing prices
  useEffect(() => {
    if (!stockList || stockList.length === 0) return;
    const hasUnfetched = stockList.some((s) => {
      const clean = (s.symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
      const hasPrice = (liveQuotes[clean]?.currentPrice && liveQuotes[clean].currentPrice > 0) || (s.currentPrice && s.currentPrice > 0);
      return !hasPrice;
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
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.documentElement.classList.add('tc-resizing');

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(240, Math.min(window.innerWidth - moveEvent.clientX, 700));
      setPanelWidth(newWidth);
      document.documentElement.style.setProperty('--tc-dock-width', `${newWidth}px`);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.documentElement.classList.remove('tc-resizing');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      try {
        localStorage.setItem('tc_zerodha_panel_width', String(panelWidthRef.current));
      } catch (_e) {
        /* ignore */
      }

      // Fire resize so chart adapts to final dropped width
      window.dispatchEvent(new Event('resize'));
      document.querySelectorAll('iframe').forEach((iframe) => {
        try {
          iframe.contentWindow?.dispatchEvent(new Event('resize'));
        } catch (_err) {
          /* ignore */
        }
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
      if (flagMenuSymbol) setFlagMenuSymbol(null);
      if (isGroupMenuOpen && groupMenuRef.current && !groupMenuRef.current.contains(e.target)) {
        setIsGroupMenuOpen(false);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [flagMenuSymbol, isGroupMenuOpen]);

  // Drag and Drop handlers
  const handleDragStart = (e, symbol) => {
    setDraggedSymbol(symbol);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', symbol);
  };

  const handleDragOver = (e, targetSymbol) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSymbol !== targetSymbol) {
      setDragOverSymbol(targetSymbol);
    }
  };

  const handleDrop = (e, targetSymbol) => {
    e.preventDefault();
    if (!draggedSymbol || draggedSymbol === targetSymbol) {
      setDraggedSymbol(null);
      setDragOverSymbol(null);
      return;
    }

    const currentSymbols = visibleStocksOrdered.map((s) => s.symbol);
    const fromIndex = currentSymbols.indexOf(draggedSymbol);
    const toIndex = currentSymbols.indexOf(targetSymbol);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...currentSymbols];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);

      if (onReorderStocks) {
        onReorderStocks(newOrder, weekKey);
      }
    }

    setDraggedSymbol(null);
    setDragOverSymbol(null);
  };

  return (
    <aside
      className={`tc-zerodha-watchlist-panel ${isCollapsed ? 'collapsed' : ''}`}
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
      {/* Draggable Left Border Resizer Handle */}
      {!isCollapsed && (
        <div
          className="tc-panel-resizer-handle"
          onMouseDown={handleMouseDownResize}
          title="Drag to resize watchlist width"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '6px',
            cursor: 'col-resize',
            zIndex: 100,
            background: isResizing ? '#38bdf8' : 'transparent',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.35)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) e.currentTarget.style.background = 'transparent';
          }}
        />
      )}

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
              padding: '8px 12px',
              background: '#10141e',
              borderBottom: '1px solid #2a2e39',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>
                TradeClarity.market
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>({stockList.length})</span>
            </div>

            {/* THREE TOP-RIGHT ACTION ICONS (Built with div role="button" to avoid any global CSS padding/min-width bleed) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* 1. Refresh Live Quotes */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleRefreshQuotes}
                title="Refresh Live Market Quotes"
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
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    display: 'block',
                    transition: 'transform 0.4s ease',
                    transform: isRefreshing ? 'rotate(180deg)' : 'none',
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
                    width: '28px',
                    height: '28px',
                    minWidth: '28px',
                    maxWidth: '28px',
                    minHeight: '28px',
                    maxHeight: '28px',
                    borderRadius: '6px',
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
                    width="14"
                    height="14"
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
                  width: '28px',
                  height: '28px',
                  minWidth: '28px',
                  maxWidth: '28px',
                  minHeight: '28px',
                  maxHeight: '28px',
                  borderRadius: '6px',
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
                  width="13"
                  height="13"
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

              {/* 3. Collapse Sidebar Rail */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsCollapsed(true)}
                title="Collapse Sidebar"
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
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block' }}
                >
                  <polyline points="9 18 15 12 9 6" />
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
            {groupedStocks.map((group) => {
              const isGroupCollapsed = collapsedGroups[group.key] || false;
              const showGroupHeader = group.title !== '';

              return (
                <div key={group.key}>
                  {showGroupHeader && (
                    <div
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.key]: !prev[group.key],
                        }))
                      }
                      style={{
                        padding: '5px 12px',
                        background: 'rgba(18, 22, 34, 0.95)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {group.flagColor ? (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: FLAG_COLOR_MAP[group.flagColor],
                            }}
                          />
                        ) : null}
                        <span>{group.title}</span>
                      </div>
                      <span
                        style={{
                          background: '#252e42',
                          color: '#94a3b8',
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                        }}
                      >
                        {group.stocks.length}
                      </span>
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
                      } else if (typeof s.earningsDaysAway === 'number') {
                        earningsDays = s.earningsDaysAway;
                      } else if (typeof cachedFund?.data?.catalysts?.earningsDaysAway === 'number') {
                        earningsDays = cachedFund.data.catalysts.earningsDaysAway;
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
                              ✓ Reported
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
                          onDragOver={(e) => handleDragOver(e, s.symbol)}
                          onDrop={(e) => handleDrop(e, s.symbol)}
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
                            padding: '0 10px',
                            height: '28px',
                            minHeight: '28px',
                            maxHeight: '28px',
                            boxSizing: 'border-box',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                            background: isActive ? '#1e293b' : 'transparent',
                            borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                            borderTop: isDropTarget ? '2px solid #38bdf8' : 'none',
                            opacity: isBeingDragged ? 0.35 : 1,
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = '#1c2233';
                            const grip = e.currentTarget.querySelector('.tc-drag-grip');
                            if (grip) grip.style.opacity = '0.85';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                            const grip = e.currentTarget.querySelector('.tc-drag-grip');
                            if (grip) grip.style.opacity = '0.25';
                          }}
                        >
                          {/* Left: Drag grip, Flag icon, Symbol name, Earnings badge, Tag */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, marginRight: '8px' }}>
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
                                transition: 'opacity 0.15s',
                              }}
                            >
                              ⋮⋮
                            </span>

                            {/* Flag Icon */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setFlagMenuSymbol(s.symbol);
                                setFlagMenuPos({ x: e.clientX, y: e.clientY });
                              }}
                              title="Set Flag Color"
                              style={{
                                cursor: 'pointer',
                                padding: '1px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: s.flagColor ? 1 : 0.35,
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                if (!s.flagColor) e.currentTarget.style.opacity = '0.9';
                              }}
                              onMouseLeave={(e) => {
                                if (!s.flagColor) e.currentTarget.style.opacity = '0.35';
                              }}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill={s.flagColor ? FLAG_COLOR_MAP[s.flagColor] : 'none'}
                                stroke={s.flagColor ? FLAG_COLOR_MAP[s.flagColor] : '#94a3b8'}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                <line x1="4" y1="22" x2="4" y2="15" />
                              </svg>
                            </div>

                            {/* Symbol Name */}
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: '#f8fafc',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.2px',
                              }}
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
                                {primaryTag}
                              </span>
                            )}
                          </div>

                          {/* Right: Price & % Change aligned in dedicated fixed columns with tabular numbers */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {priceVal > 0 ? (
                              <>
                                <span
                                  style={{
                                    width: '74px',
                                    minWidth: '74px',
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
                                    width: '56px',
                                    minWidth: '56px',
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
                              <span style={{ width: '138px', textAlign: 'right', fontSize: '11px', fontWeight: 500, color: '#64748b' }}>-</span>
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

      {/* Flag Popover Menu */}
      {flagMenuSymbol && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${flagMenuPos.x - 120}px`,
            top: `${flagMenuPos.y - 12}px`,
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
          }}
        >
          {Object.entries(FLAG_COLOR_MAP).map(([colorName, colorHex]) => (
            <div
              key={colorName}
              onClick={() => {
                if (onUpdateStockFlag) onUpdateStockFlag(flagMenuSymbol, colorName);
                setFlagMenuSymbol(null);
              }}
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: colorHex,
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
              title={`${colorName.toUpperCase()} Flag`}
            />
          ))}
          <div
            onClick={() => {
              if (onUpdateStockFlag) onUpdateStockFlag(flagMenuSymbol, null);
              setFlagMenuSymbol(null);
            }}
            style={{
              color: '#94a3b8',
              fontSize: '11px',
              cursor: 'pointer',
              padding: '0 3px',
              fontWeight: 700,
            }}
            title="Clear Flag"
          >
            ✕
          </div>
        </div>
      )}
    </aside>
  );
}
