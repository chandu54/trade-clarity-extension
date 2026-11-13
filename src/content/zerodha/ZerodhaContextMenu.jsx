import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

const FLAG_COLOR_MAP = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7',
};

export default function ZerodhaContextMenu({
  isOpen,
  x,
  y,
  stock,
  initialSubmenu = null,
  availableSectors = [],
  watchlists = [],
  availableTags = [],
  onClose,
  onToggleWatchlist,
  onSelectSector,
  onSelectFlagColor,
  onToggleTag,
  onToggleTradable,
  onCopySymbol,
  onOpenTradingView,
  onOpenScreener,
  onOpenDashboard,
  onEditStock,
  onDeleteStock,
}) {
  const menuRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const [activeSubmenu, setActiveSubmenu] = useState(initialSubmenu); // 'watchlist' | 'sector' | 'flag' | 'tags' | null
  const [customSectorInput, setCustomSectorInput] = useState('');
  const [pos, setPos] = useState({ top: y, left: x });

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearHoverTimeout();
  }, []);

  const handleRowHover = (targetSubmenu) => {
    clearHoverTimeout();
    if (targetSubmenu === activeSubmenu) return;

    if (activeSubmenu) {
      // Grace window: if a submenu is already open, give 160ms before switching or closing
      // to allow diagonal cursor travel without the submenu abruptly vanishing!
      hoverTimeoutRef.current = setTimeout(() => {
        setActiveSubmenu(targetSubmenu || null);
      }, 160);
    } else {
      // Immediate open if no submenu is open yet
      setActiveSubmenu(targetSubmenu || null);
    }
  };

  const handleRowClick = (targetSubmenu) => {
    clearHoverTimeout();
    setActiveSubmenu((prev) => (prev === targetSubmenu ? null : targetSubmenu));
  };

  useEffect(() => {
    if (isOpen) {
      setActiveSubmenu(initialSubmenu || null);
    } else {
      clearHoverTimeout();
      setActiveSubmenu(null);
      setCustomSectorInput('');
    }
  }, [isOpen, initialSubmenu]);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX;
    let posY = y;

    // If right-clicked on the right half of the screen (e.g. inside right-docked watchlist),
    // open the menu to the LEFT of the cursor so submenus and actions never clip offscreen!
    if (x + rect.width > winWidth - 20 || x > winWidth / 2) {
      posX = Math.max(10, x - rect.width - 4);
    } else {
      posX = Math.min(x, winWidth - rect.width - 10);
    }

    if (posY + rect.height > winHeight - 10) {
      posY = Math.max(10, winHeight - rect.height - 10);
    }

    setPos({ top: posY, left: posX });
  }, [isOpen, x, y]);

  // Global keydown with capture phase to intercept shortcuts before Kite or TradingView consume them
  useEffect(() => {
    if (!isOpen) return;

    // Focus menu container on open so keyboard events immediately register
    if (menuRef.current && typeof menuRef.current.focus === 'function') {
      menuRef.current.focus();
    }

    const handlePointerDown = (e) => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (menuRef.current && !menuRef.current.contains(e.target) && !path.includes(menuRef.current)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      // Don't intercept shortcuts when typing in the inline custom sector input
      if (e.target && e.target.tagName === 'INPUT') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        clearHoverTimeout();
        setActiveSubmenu((prev) => (prev === 'flag' ? null : 'flag'));
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        e.stopPropagation();
        clearHoverTimeout();
        setActiveSubmenu((prev) => (prev === 'watchlist' ? null : 'watchlist'));
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        clearHoverTimeout();
        setActiveSubmenu((prev) => (prev === 'sector' ? null : 'sector'));
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleTradable) onToggleTradable();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        if (onCopySymbol) onCopySymbol();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (onEditStock) onEditStock();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        if (onDeleteStock) onDeleteStock();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, onToggleTradable, onCopySymbol, onEditStock, onDeleteStock]);

  if (!isOpen || !stock) return null;

  const userTags = (availableTags || []).filter((t) => typeof t === 'string' && !t.toUpperCase().startsWith('AI:'));
  const stockTags = Array.isArray(stock.tags) ? stock.tags : [];
  const stockWls = Array.isArray(stock.watchlists) ? stock.watchlists : [];
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  // If the menu is not at the extreme left edge of the screen, open submenus to the left
  // so they never clip off the right edge of the monitor or collide with the right-docked panel!
  const openSubmenuLeft = pos.left > 200;
  const anchorSubmenuBottom = pos.top + 240 > winHeight;

  return (
    <div
      ref={menuRef}
      tabIndex={-1}
      className="tc-context-menu-container"
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        background: '#182030',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
        width: '230px',
        padding: '5px 0',
        zIndex: 2147483647,
        fontSize: '12px',
        userSelect: 'none',
        pointerEvents: 'auto',
        outline: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#cbd5e1',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => {
        clearHoverTimeout();
        hoverTimeoutRef.current = setTimeout(() => {
          setActiveSubmenu(null);
        }, 180);
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '13px' }}>{stock.symbol}</span>
          {stock.flagColor && (
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: FLAG_COLOR_MAP[stock.flagColor],
              }}
            />
          )}
        </div>
        {stock.tradable && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#4ade80',
              padding: '1px 5px',
              borderRadius: '3px',
              letterSpacing: '0.4px',
            }}
          >
            TRADABLE
          </span>
        )}
      </div>

      {/* Menu Item: Edit Setup in TradeClarity */}
      <div
        onClick={() => {
          if (onEditStock) onEditStock();
          onClose();
        }}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#252f44';
          handleRowHover(null);
        }}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span style={{ color: '#fff', fontWeight: 600 }}>Edit Setup in TradeClarity</span>
        </div>
        <kbd style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
          Enter
        </kbd>
      </div>

      {/* Menu Item: Open in TradeClarity Extension Dashboard */}
      {onOpenDashboard && (
        <div
          onClick={() => {
            onOpenDashboard();
            onClose();
          }}
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#252f44';
            handleRowHover(null);
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Open in TradeClarity Tab</span>
          </div>
        </div>
      )}

      {/* Menu Item: Set Flag Color */}
      <div
        onMouseEnter={() => handleRowHover('flag')}
        onClick={() => handleRowClick('flag')}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          background: activeSubmenu === 'flag' ? '#252f44' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <span>Set Flag Color</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <kbd style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
            F
          </kbd>
          <span style={{ fontSize: '10px', color: '#64748b' }}>{openSubmenuLeft ? '◂' : '▸'}</span>
        </div>

        {/* Flag Submenu */}
        {activeSubmenu === 'flag' && (
          <div
            className="tc-context-submenu"
            onMouseEnter={clearHoverTimeout}
            style={{
              position: 'absolute',
              ...(openSubmenuLeft ? { right: 'calc(100% - 2px)' } : { left: 'calc(100% - 2px)' }),
              top: '-4px',
              background: '#182030',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '6px 8px',
              display: 'flex',
              gap: '6px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
              zIndex: 2147483647,
              pointerEvents: 'auto',
            }}
          >
            {/* Invisible Hitbox Bridge to Parent Menu */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(openSubmenuLeft ? { right: '-12px', width: '16px' } : { left: '-12px', width: '16px' }),
                pointerEvents: 'auto',
              }}
            />
            {Object.entries(FLAG_COLOR_MAP).map(([colName, colHex]) => (
              <div
                key={colName}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectFlagColor) onSelectFlagColor(colName);
                  try {
                    localStorage.setItem('tc_recent_flag_color', colName);
                  } catch (_e) {}
                  onClose();
                }}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: colHex,
                  cursor: 'pointer',
                  border: stock.flagColor === colName ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  transform: stock.flagColor === colName ? 'scale(1.15)' : 'none',
                }}
                title={`${colName.charAt(0).toUpperCase() + colName.slice(1).toLowerCase()} Flag`}
              />
            ))}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectFlagColor) onSelectFlagColor(null);
                onClose();
              }}
              style={{
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '0 4px',
                fontWeight: 700,
              }}
              title="Clear Flag"
            >
              ✕
            </div>
          </div>
        )}
      </div>

      {/* Menu Item: Toggle Tradable */}
      <div
        onClick={() => {
          if (onToggleTradable) onToggleTradable();
          onClose();
        }}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#252f44';
          handleRowHover(null);
        }}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </svg>
          <span>{stock.tradable ? 'Mark as Untradable' : 'Mark as Tradable'}</span>
        </div>
        <kbd style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
          T
        </kbd>
      </div>

      {/* Menu Item: Watchlists Submenu */}
      <div
        onMouseEnter={() => handleRowHover('watchlist')}
        onClick={() => handleRowClick('watchlist')}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          background: activeSubmenu === 'watchlist' ? '#252f44' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>Watchlists</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <kbd style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
            W
          </kbd>
          <span style={{ fontSize: '10px', color: '#64748b' }}>{openSubmenuLeft ? '◂' : '▸'}</span>
        </div>

        {activeSubmenu === 'watchlist' && (
          <div
            className="tc-context-submenu"
            onMouseEnter={clearHoverTimeout}
            style={{
              position: 'absolute',
              ...(openSubmenuLeft ? { right: 'calc(100% - 2px)' } : { left: 'calc(100% - 2px)' }),
              ...(anchorSubmenuBottom ? { bottom: '-4px' } : { top: '-4px' }),
              background: '#182030',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              width: '180px',
              padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
              zIndex: 2147483647,
              maxHeight: '220px',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            {/* Invisible Hitbox Bridge to Parent Menu */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(openSubmenuLeft ? { right: '-12px', width: '16px' } : { left: '-12px', width: '16px' }),
                pointerEvents: 'auto',
              }}
            />
            <div style={{ padding: '4px 10px', fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              Assign Watchlist
            </div>
            {watchlists.length === 0 ? (
              <div style={{ padding: '4px 10px', fontSize: '11px', color: '#64748b' }}>No watchlists configured</div>
            ) : (
              watchlists.map((wl) => {
                const wlId = typeof wl === 'string' ? wl : wl.id || wl.name;
                const wlName = typeof wl === 'string' ? wl : wl.name || wl.id;
                const isAssigned = stockWls.includes(wlId) || stockWls.includes(wlName);
                return (
                  <div
                    key={wlId}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleWatchlist) onToggleWatchlist(wlId);
                    }}
                    style={{
                      padding: '4px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '11px',
                      background: isAssigned ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isAssigned ? 'rgba(56, 189, 248, 0.2)' : '#252f44')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isAssigned ? 'rgba(56, 189, 248, 0.12)' : 'transparent')}
                  >
                    <span style={{ color: isAssigned ? '#38bdf8' : '#e2e8f0', fontWeight: isAssigned ? 700 : 400 }}>{wlName}</span>
                    {isAssigned && <span style={{ color: '#38bdf8', fontSize: '10px' }}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Menu Item: Sector Submenu */}
      <div
        onMouseEnter={() => handleRowHover('sector')}
        onClick={() => handleRowClick('sector')}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          background: activeSubmenu === 'sector' ? '#252f44' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>Sector</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <kbd style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
            S
          </kbd>
          <span style={{ fontSize: '10px', color: '#64748b' }}>{openSubmenuLeft ? '◂' : '▸'}</span>
        </div>

        {activeSubmenu === 'sector' && (
          <div
            className="tc-context-submenu"
            onMouseEnter={clearHoverTimeout}
            style={{
              position: 'absolute',
              ...(openSubmenuLeft ? { right: 'calc(100% - 2px)' } : { left: 'calc(100% - 2px)' }),
              ...(anchorSubmenuBottom ? { bottom: '-4px' } : { top: '-4px' }),
              background: '#182030',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              width: '210px',
              padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
              zIndex: 2147483647,
              maxHeight: '260px',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            {/* Invisible Hitbox Bridge to Parent Menu */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(openSubmenuLeft ? { right: '-12px', width: '16px' } : { left: '-12px', width: '16px' }),
                pointerEvents: 'auto',
              }}
            />
            <div style={{ padding: '4px 10px', fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              Assign Sector
            </div>

            {/* Unassigned / Clear Sector Option */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectSector) onSelectSector('');
                onClose();
              }}
              style={{
                padding: '4px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontSize: '11px',
                color: !stock.sector ? '#38bdf8' : '#94a3b8',
                background: !stock.sector ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = !stock.sector ? 'rgba(56, 189, 248, 0.2)' : '#252f44')}
              onMouseLeave={(e) => (e.currentTarget.style.background = !stock.sector ? 'rgba(56, 189, 248, 0.12)' : 'transparent')}
            >
              <span style={{ fontStyle: 'italic' }}>Unassigned</span>
              {!stock.sector && <span style={{ color: '#38bdf8', fontSize: '10px' }}>✓</span>}
            </div>

            {/* Available Sectors List */}
            {availableSectors.map((sec) => {
              const secName = typeof sec === 'string' ? sec : sec.name || sec.id;
              const isCurrent = Boolean(
                stock.sector &&
                secName &&
                stock.sector.trim().toLowerCase() === secName.trim().toLowerCase()
              );
              return (
                <div
                  key={secName}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectSector) onSelectSector(secName);
                    onClose();
                  }}
                  style={{
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '11px',
                    background: isCurrent ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isCurrent ? 'rgba(56, 189, 248, 0.2)' : '#252f44')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isCurrent ? 'rgba(56, 189, 248, 0.12)' : 'transparent')}
                >
                  <span style={{ color: isCurrent ? '#38bdf8' : '#e2e8f0', fontWeight: isCurrent ? 700 : 400 }}>
                    {secName}
                  </span>
                  {isCurrent && <span style={{ color: '#38bdf8', fontSize: '10px' }}>✓</span>}
                </div>
              );
            })}

            {/* Custom Sector Inline Input */}
            <div style={{ padding: '6px 8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="+ Add custom sector..."
                value={customSectorInput}
                onChange={(e) => setCustomSectorInput(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && customSectorInput.trim()) {
                    if (onSelectSector) onSelectSector(customSectorInput.trim());
                    setCustomSectorInput('');
                    onClose();
                  } else if (e.key === 'Escape') {
                    onClose();
                  }
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#0f172a',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '4px',
                  color: '#f8fafc',
                  fontSize: '11px',
                  padding: '4px 6px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Menu Item: Tags Submenu */}
      <div
        onMouseEnter={() => handleRowHover('tags')}
        onClick={() => handleRowClick('tags')}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          background: activeSubmenu === 'tags' ? '#252f44' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span>Tags</span>
        </div>
        <span style={{ fontSize: '10px', color: '#64748b' }}>{openSubmenuLeft ? '◂' : '▸'}</span>

        {activeSubmenu === 'tags' && (
          <div
            className="tc-context-submenu"
            onMouseEnter={clearHoverTimeout}
            style={{
              position: 'absolute',
              ...(openSubmenuLeft ? { right: 'calc(100% - 2px)' } : { left: 'calc(100% - 2px)' }),
              ...(anchorSubmenuBottom ? { bottom: '-4px' } : { top: '-4px' }),
              background: '#182030',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              width: '180px',
              padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
              zIndex: 2147483647,
              maxHeight: '220px',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            {/* Invisible Hitbox Bridge to Parent Menu */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(openSubmenuLeft ? { right: '-12px', width: '16px' } : { left: '-12px', width: '16px' }),
                pointerEvents: 'auto',
              }}
            />
            <div style={{ padding: '4px 10px', fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              Toggle Tag
            </div>
            {userTags.length === 0 ? (
              <div style={{ padding: '4px 10px', fontSize: '11px', color: '#64748b' }}>No custom tags</div>
            ) : (
              userTags.map((tg) => {
                const isTagged = stockTags.includes(tg);
                return (
                  <div
                    key={tg}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleTag) onToggleTag(tg);
                    }}
                    style={{
                      padding: '4px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#252f44')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{tg}</span>
                    <span style={{ color: isTagged ? '#38bdf8' : 'transparent', fontWeight: 700 }}>✓</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

      {/* Copy Symbol */}
      <div
        onClick={() => {
          if (onCopySymbol) onCopySymbol();
          onClose();
        }}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#252f44';
          handleRowHover(null);
        }}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy Ticker</span>
        </div>
        <kbd style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
          C
        </kbd>
      </div>

      {/* Open on TradingView */}
      <div
        onClick={() => {
          if (onOpenTradingView) onOpenTradingView();
          onClose();
        }}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#252f44';
          handleRowHover(null);
        }}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span>Open in TradingView</span>
      </div>

      {/* Open on Screener.in */}
      <div
        onClick={() => {
          if (onOpenScreener) onOpenScreener();
          onClose();
        }}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#252f44';
          handleRowHover(null);
        }}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Open in Screener.in</span>
      </div>

      {/* Remove Stock */}
      {onDeleteStock && (
        <>
          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
          <div
            onClick={() => {
              onDeleteStock();
              onClose();
            }}
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#f87171',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              handleRowHover(null);
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Remove from Watchlist</span>
            </div>
            <kbd style={{ fontSize: '10px', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
              Del
            </kbd>
          </div>
        </>
      )}
    </div>
  );
}
