import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import MovingAverageRibbon from '../../components/MovingAverageRibbon';
import { calculateDaysAway, globalFundamentalsCache, fetchNseEarningsDate, fetchStockSummary } from '../../utils/stockAnalysisApi';

export default function ZerodhaHeaderDock({
  symbol,
  stockData,
  currentPrice,
  dailyChangePct,
  _onOpenEditModal,
}) {
  const priceVal = currentPrice ?? stockData?.currentPrice ?? 0;
  const changeVal = dailyChangePct ?? stockData?.dailyChangePct ?? 0;
  const isUp = changeVal >= 0;

  // Draggable position state (default to top navbar next to Fundamentals)
  const [dockPos, setDockPos] = useState(() => {
    try {
      const saved = localStorage.getItem('tc_zerodha_dock_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.top === 'number' && typeof parsed.left === 'number') {
          return parsed;
        }
      }
    } catch (_e) {}
    return { top: 6, left: 275 };
  });

  // Minimized / Maximized State
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('tc_zerodha_dock_minimized') === 'true';
    } catch (_e) {}
    return false;
  });

  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    hasMoved: false,
  });

  // Drag listeners
  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragRef.current.hasMoved = true;
    }
    const newLeft = Math.max(5, Math.min(window.innerWidth - 60, dragRef.current.startLeft + deltaX));
    const newTop = Math.max(5, Math.min(window.innerHeight - 36, dragRef.current.startTop + deltaY));
    setDockPos({ top: newTop, left: newLeft });
  }, []);

  const handleMouseUpRef = useRef(null);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    if (handleMouseUpRef.current) {
      document.removeEventListener('mouseup', handleMouseUpRef.current);
    }
    setDockPos((current) => {
      try {
        localStorage.setItem('tc_zerodha_dock_pos', JSON.stringify(current));
      } catch (_e) {
        /* ignore */
      }
      return current;
    });
  }, [handleMouseMove]);

  handleMouseUpRef.current = handleMouseUp;

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('[role="button"]') || e.target.closest('.tc-no-drag')) {
      return;
    }
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: dockPos.left,
      startTop: dockPos.top,
      hasMoved: false,
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ADR formatting
  const adrVal = stockData?.params?.adr || stockData?.params?.ADR;
  const formattedAdr = useMemo(() => {
    if (adrVal === undefined || adrVal === null || adrVal === '') return null;
    const str = String(adrVal).trim();
    if (!str) return null;
    return str.endsWith('%') ? str : `${str}%`;
  }, [adrVal]);

  // Liquidity formatting
  const liqVal = stockData?.params?.liquidity || stockData?.params?.Liquidity;
  const formattedLiq = useMemo(() => {
    if (liqVal === undefined || liqVal === null || liqVal === '') return null;
    return String(liqVal).trim();
  }, [liqVal]);

  // RS formatting
  const rsVal = stockData?.params?.rs || stockData?.params?.RS || stockData?.parameters?.rs;
  const rsEmoji = useMemo(() => {
    if (!rsVal) return null;
    const lower = String(rsVal).toLowerCase();
    if (lower.includes('very strong')) return '🔥🔥';
    if (lower.includes('strong')) return '🔥';
    if (lower.includes('neutral')) return '⚖️';
    if (lower.includes('very weak')) return '👎👎';
    if (lower.includes('weak')) return '👎';
    return '📈';
  }, [rsVal]);

  // Earnings info & countdown - comprehensive resolution matching EditStockModal
  const cleanSym = (symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
  const cachedFundamentals = globalFundamentalsCache.get(`${cleanSym}_IN`) ||
                             globalFundamentalsCache.get(`${cleanSym}.NS_IN`) ||
                             globalFundamentalsCache.get(`${cleanSym}_US`) ||
                             globalFundamentalsCache.get(`${cleanSym}.NS_US`);

  // Dynamically fetch earnings date if not present on stock object or in cache
  const [fetchedEarnings, setFetchedEarnings] = useState(null);

  useEffect(() => {
    setFetchedEarnings(null);
    if (!cleanSym) return;

    const existingDate = stockData?.earningsDate ||
                         stockData?.params?.earningsDate ||
                         stockData?.parameters?.earningsDate;
    if (existingDate || typeof stockData?.earningsDaysAway === 'number') {
      return;
    }

    const cached = globalFundamentalsCache.get(`${cleanSym}_IN`) ||
                   globalFundamentalsCache.get(`${cleanSym}.NS_IN`) ||
                   globalFundamentalsCache.get(`${cleanSym}_US`) ||
                   globalFundamentalsCache.get(`${cleanSym}.NS_US`);
    if (cached?.data?.catalysts?.earningsDate || typeof cached?.data?.catalysts?.earningsDaysAway === 'number') {
      return;
    }

    let isMounted = true;
    // 1. Try official NSE calendar
    fetchNseEarningsDate(cleanSym).then((nseRes) => {
      if (!isMounted) return;
      if (nseRes?.dateStr) {
        setFetchedEarnings({
          earningsDate: nseRes.dateStr,
          earningsDaysAway: nseRes.daysAway,
        });
        return;
      }
      // 2. Fallback to Yahoo Finance fundamentals/catalysts
      fetchStockSummary(cleanSym, 'IN').then((sum) => {
        if (!isMounted) return;
        if (sum?.catalysts?.earningsDate) {
          setFetchedEarnings({
            earningsDate: sum.catalysts.earningsDate,
            earningsDaysAway: sum.catalysts.earningsDaysAway,
          });
        }
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [cleanSym, stockData?.earningsDate, stockData?.params?.earningsDate, stockData?.earningsDaysAway]);

  const earningsDate = stockData?.earningsDate ||
                       stockData?.params?.earningsDate ||
                       stockData?.parameters?.earningsDate ||
                       cachedFundamentals?.data?.catalysts?.earningsDate ||
                       fetchedEarnings?.earningsDate ||
                       null;

  const earningsInfo = useMemo(() => {
    const rawDays = typeof stockData?.earningsDaysAway === 'number'
      ? stockData.earningsDaysAway
      : typeof cachedFundamentals?.data?.catalysts?.earningsDaysAway === 'number'
        ? cachedFundamentals.data.catalysts.earningsDaysAway
        : typeof fetchedEarnings?.earningsDaysAway === 'number'
          ? fetchedEarnings.earningsDaysAway
          : null;

    if (!earningsDate && rawDays === null) return null;

    const daysAway = earningsDate ? calculateDaysAway(earningsDate) : rawDays;
    const isImminent = typeof daysAway === 'number' && daysAway >= 0 && daysAway <= 7;
    const displayDate = earningsDate ? String(earningsDate).replace(/,\s*\d{4}$/, '') : (rawDays !== null ? `${rawDays}d` : '');
    return {
      displayDate,
      daysAway,
      isImminent,
    };
  }, [earningsDate, stockData?.earningsDaysAway, cachedFundamentals, fetchedEarnings]);

  // 1. MINIMIZED VIEW: TradingView-style small glowing circular icon / pill
  if (isMinimized) {
    return (
      <div
        className="tc-zerodha-minimized-fab"
        onMouseDown={handleMouseDown}
        onClick={() => {
          if (!dragRef.current.hasMoved) {
            setIsMinimized(false);
            try {
              localStorage.setItem('tc_zerodha_dock_minimized', 'false');
            } catch (_e) {}
          }
        }}
        title={`TradeClarity: ${symbol || ''} (Click to expand metrics, drag to move)`}
        style={{
          position: 'fixed',
          top: `${dockPos.top}px`,
          left: `${dockPos.left}px`,
          zIndex: 99999,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          padding: '0 10px',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(56, 189, 248, 0.45)',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.65)',
          cursor: 'grab',
          userSelect: 'none',
          color: '#f8fafc',
          fontSize: '11px',
          fontWeight: 800,
          backdropFilter: 'blur(10px)',
          transition: 'box-shadow 0.2s, border-color 0.2s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#38bdf8';
          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.96)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)';
          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.94)';
        }}
      >
        {/* Glowing cyan dot indicator like TradingView */}
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#38bdf8',
            boxShadow: '0 0 8px rgba(56, 189, 248, 0.95)',
            flexShrink: 0,
          }}
        />
        <span>TC: {symbol || '—'}</span>
        {priceVal > 0 && (
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: isUp ? '#22c55e' : '#ef4444',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isUp ? '+' : ''}{changeVal.toFixed(2)}%
          </span>
        )}
      </div>
    );
  }

  // 2. EXPANDED VIEW: Full draggable metrics dock with minimize button
  return (
    <div
      className="tc-zerodha-header-dock"
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        top: `${dockPos.top}px`,
        left: `${dockPos.left}px`,
        zIndex: 99999,
        pointerEvents: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        height: '32px',
        maxHeight: '34px',
        padding: '0 8px 0 6px',
        background: 'rgba(24, 28, 39, 0.94)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.55)',
        fontSize: '11px',
        color: '#d1d4dc',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        boxSizing: 'border-box',
        flexShrink: 0,
        backdropFilter: 'blur(10px)',
        cursor: 'grab',
      }}
    >
      {/* Draggable Grip Handle */}
      <span
        title="Drag to reposition header dock"
        style={{
          color: '#64748b',
          fontSize: '11px',
          userSelect: 'none',
          lineHeight: '1',
          opacity: 0.45,
          cursor: 'grab',
          marginRight: '-2px',
        }}
      >
        ⋮⋮
      </span>

      {/* Symbol Name */}
      <span
        style={{
          fontWeight: 700,
          color: '#ffffff',
          fontSize: '12px',
          letterSpacing: '0.2px',
        }}
      >
        {symbol || '—'}
      </span>

      {/* Price & Change */}
      {priceVal > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
            ₹{priceVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: '10px',
              color: isUp ? '#22c55e' : '#ef4444',
            }}
          >
            {isUp ? '+' : ''}{changeVal.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Vertical divider */}
      <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.15)' }} />

      {/* ADR Pill */}
      {formattedAdr && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderLeft: '2.5px solid #38bdf8',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
          title={`Average Daily Range (ADR): ${formattedAdr}`}
        >
          <span style={{ color: '#94a3b8', fontSize: '9px' }}>ADR</span>
          <span style={{ color: '#f8fafc' }}>{formattedAdr}</span>
        </div>
      )}

      {/* Liquidity Pill */}
      {formattedLiq && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderLeft: '2.5px solid #06b6d4',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
          title={`Liquidity / Turnover: ${formattedLiq}`}
        >
          <span style={{ color: '#06b6d4' }}>💧</span>
          <span style={{ color: '#f8fafc' }}>{formattedLiq}</span>
        </div>
      )}

      {/* Relative Strength Pill */}
      {rsVal && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderLeft: '2.5px solid #f59e0b',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
          title={`Relative Strength (RS vs Nifty): ${rsVal}`}
        >
          <span style={{ color: '#94a3b8', fontSize: '9px' }}>RS</span>
          <span>{rsEmoji}</span>
        </div>
      )}

      {/* Earnings Pill */}
      {earningsInfo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: earningsInfo.isImminent
              ? 'rgba(249, 115, 22, 0.18)'
              : earningsInfo.daysAway < 0
                ? 'rgba(15, 23, 42, 0.6)'
                : 'rgba(15, 23, 42, 0.7)',
            border: earningsInfo.isImminent
              ? '1px solid rgba(249, 115, 22, 0.5)'
              : earningsInfo.daysAway < 0
                ? '1px solid rgba(148, 163, 184, 0.25)'
                : '1px solid rgba(56, 189, 248, 0.25)',
            borderLeft: earningsInfo.isImminent
              ? '2.5px solid #f97316'
              : earningsInfo.daysAway < 0
                ? '2.5px solid #94a3b8'
                : '2.5px solid #38bdf8',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
          title={`Earnings: ${earningsDate}${typeof earningsInfo.daysAway === 'number' ? ` (${earningsInfo.daysAway >= 0 ? `in ${earningsInfo.daysAway}d` : `${Math.abs(earningsInfo.daysAway)}d ago`})` : ''}`}
        >
          <span>{earningsInfo.daysAway < 0 ? '✓' : '📅'}</span>
          <span style={{ color: '#f8fafc' }}>
            {earningsInfo.daysAway < 0 ? `Reported ${earningsInfo.displayDate}` : earningsInfo.displayDate}
          </span>
          {typeof earningsInfo.daysAway === 'number' && earningsInfo.daysAway >= 0 && (
            <span
              style={{
                color: earningsInfo.isImminent ? '#fb923c' : '#38bdf8',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              ({earningsInfo.daysAway}d)
            </span>
          )}
        </div>
      )}

      {/* Moving Average Ribbon */}
      {stockData?.params?.movingAverages && (
        <div style={{ display: 'flex', alignItems: 'center' }} title="Moving Averages: 10, 21, 50, 200 SMA Status">
          <MovingAverageRibbon value={stockData.params.movingAverages} variant="compact" showLabel={false} />
        </div>
      )}

      {/* Hyperlink Button: Open Current Symbol in TradeClarity Extension */}
      <div
        role="button"
        className="tc-no-drag"
        onClick={(e) => {
          e.stopPropagation();
          const clean = (symbol || '').replace(/^(NSE|BSE|NFO|MCX):/i, '').replace(/\.(NS|BO)$/i, '').toUpperCase();
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
        title={`Open ${symbol || 'stock'} in TradeClarity Extension`}
        style={{
          cursor: 'pointer',
          padding: '2px 5px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38bdf8',
          fontSize: '11px',
          fontWeight: 700,
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          marginLeft: '4px',
          transition: 'all 0.15s',
          lineHeight: '1',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)';
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#38bdf8';
          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>

      {/* Minimize Button */}
      <div
        role="button"
        className="tc-no-drag"
        onClick={(e) => {
          e.stopPropagation();
          setIsMinimized(true);
          try {
            localStorage.setItem('tc_zerodha_dock_minimized', 'true');
          } catch (_e) {}
        }}
        title="Minimize metrics dock to floating circle"
        style={{
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '11px',
          fontWeight: 700,
          background: 'rgba(255, 255, 255, 0.06)',
          marginLeft: '4px',
          transition: 'all 0.15s',
          lineHeight: '1',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        }}
      >
        —
      </div>
    </div>
  );
}
