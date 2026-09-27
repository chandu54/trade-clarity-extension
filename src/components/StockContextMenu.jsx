import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

const FLAG_COLOR_MAP = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
};

export default function StockContextMenu({
  isOpen,
  x,
  y,
  stock,
  country = "IN",
  watchlists = [],
  availableTags = [],
  onClose,
  onToggleWatchlist,
  onSelectFlagColor,
  onToggleTag,
  onToggleTradable,
  onCopySymbol,
  onOpenTradingView,
  onQuickLog,
  onAnalyzeStock,
  onEditStock,
  onDeleteStock,
}) {
  const menuRef = useRef(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // 'watchlist' | 'flag' | 'tags' | null
  const [position, setPosition] = useState({ top: y, left: x });

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    if (x + rect.width > winWidth - 10) {
      posX = Math.max(10, winWidth - rect.width - 10);
    }
    if (y + rect.height > winHeight - 10) {
      posY = Math.max(10, winHeight - rect.height - 10);
    }

    setPosition({ top: posY, left: posX });
  }, [isOpen, x, y]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Check if user is typing in an input
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      if (key === "w") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "watchlist" ? null : "watchlist"));
      } else if (key === "f") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "flag" ? null : "flag"));
      } else if (key === "g") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "tags" ? null : "tags"));
      } else if (key === "t" && onToggleTradable && stock) {
        e.preventDefault();
        onToggleTradable(stock.symbol);
        onClose();
      } else if (key === "c" && onCopySymbol && stock) {
        e.preventDefault();
        onCopySymbol(stock.symbol);
        onClose();
      } else if (key === "o" && onOpenTradingView && stock) {
        e.preventDefault();
        onOpenTradingView(stock.symbol, country);
        onClose();
      } else if (key === "l" && onQuickLog && stock) {
        e.preventDefault();
        onQuickLog(stock.symbol);
        onClose();
      } else if (key === "a" && onAnalyzeStock && stock) {
        e.preventDefault();
        onAnalyzeStock(stock);
        onClose();
      } else if ((key === "e" || key === "enter") && onEditStock && stock) {
        e.preventDefault();
        onEditStock(stock);
        onClose();
      } else if ((key === "delete" || key === "backspace") && onDeleteStock && stock) {
        e.preventDefault();
        onDeleteStock(stock.symbol);
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [
    isOpen,
    stock,
    country,
    onClose,
    onToggleTradable,
    onCopySymbol,
    onOpenTradingView,
    onQuickLog,
    onAnalyzeStock,
    onEditStock,
    onDeleteStock,
  ]);

  if (!isOpen || !stock) return null;

  const stockWatchlists = stock.watchlists || [];
  const stockTags = stock.tags || [];
  const isTradable = Boolean(stock.tradable);
  const userSelectableTags = (availableTags || []).filter(
    (t) => !t.toUpperCase().startsWith("AI:")
  );

  return createPortal(
    <div
      ref={menuRef}
      className="stock-context-menu"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="context-menu-header">
        <span className="context-menu-symbol">{stock.symbol}</span>
        {stock.flagColor && (
          <span
            className="context-menu-flag-indicator"
            style={{ backgroundColor: FLAG_COLOR_MAP[stock.flagColor] }}
            title={`${stock.flagColor} flag`}
          />
        )}
        {isTradable && <span className="context-menu-tradable-badge">TRADABLE</span>}
      </div>

      <div className="context-menu-items">
        {/* Watchlist Submenu Item */}
        <div
          className={`context-menu-item has-submenu ${activeSubmenu === "watchlist" ? "submenu-open" : ""}`}
          onMouseEnter={() => setActiveSubmenu("watchlist")}
          onClick={(e) => {
            e.stopPropagation();
            setActiveSubmenu((prev) => (prev === "watchlist" ? null : "watchlist"));
          }}
        >
          <div className="context-menu-item-left">
            <svg
              className="context-menu-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>Watchlists</span>
          </div>
          <div className="context-menu-item-right">
            <kbd className="context-menu-kbd">W</kbd>
            <svg className="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {activeSubmenu === "watchlist" && (
            <div className="context-sub-menu" onClick={(e) => e.stopPropagation()}>
              <div className="context-sub-menu-title">Add to Watchlist</div>
              {watchlists && watchlists.length > 0 ? (
                watchlists.map((wl) => {
                  const inWl = stockWatchlists.includes(wl.id);
                  return (
                    <div
                      key={wl.id}
                      className={`context-sub-menu-item ${inWl ? "is-selected" : ""}`}
                      onClick={() => {
                        if (onToggleWatchlist) {
                          onToggleWatchlist(stock.symbol, wl.id);
                        }
                      }}
                    >
                      <span className="checkbox-icon">
                        {inWl ? "✓" : ""}
                      </span>
                      <span className="sub-menu-label">{wl.name}</span>
                    </div>
                  );
                })
              ) : (
                <div className="context-sub-menu-empty">No watchlists configured</div>
              )}
            </div>
          )}
        </div>

        {/* Flag Submenu Item */}
        <div
          className={`context-menu-item has-submenu ${activeSubmenu === "flag" ? "submenu-open" : ""}`}
          onMouseEnter={() => setActiveSubmenu("flag")}
          onClick={(e) => {
            e.stopPropagation();
            setActiveSubmenu((prev) => (prev === "flag" ? null : "flag"));
          }}
        >
          <div className="context-menu-item-left">
            <svg
              className="context-menu-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <span>Set Flag</span>
          </div>
          <div className="context-menu-item-right">
            <kbd className="context-menu-kbd">F</kbd>
            <svg className="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {activeSubmenu === "flag" && (
            <div className="context-sub-menu flag-picker-submenu" onClick={(e) => e.stopPropagation()}>
              <div className="context-sub-menu-title">Pick Flag Color</div>
              <div className="flag-picker-row">
                {Object.entries(FLAG_COLOR_MAP).map(([colorName, colorHex]) => (
                  <div
                    key={colorName}
                    role="button"
                    tabIndex={0}
                    className={`context-flag-dot ${stock.flagColor === colorName ? "active" : ""}`}
                    style={{ background: colorHex, backgroundColor: colorHex }}
                    title={`${colorName.toUpperCase()} Flag`}
                    onClick={() => {
                      if (onSelectFlagColor) onSelectFlagColor(stock.symbol, colorName);
                      onClose();
                    }}
                  />
                ))}
                <div
                  role="button"
                  tabIndex={0}
                  className="context-flag-clear-btn"
                  title="Clear Flag"
                  onClick={() => {
                    if (onSelectFlagColor) onSelectFlagColor(stock.symbol, null);
                    onClose();
                  }}
                >
                  ✕
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Apply Tags Submenu Item */}
        <div
          className={`context-menu-item has-submenu ${activeSubmenu === "tags" ? "submenu-open" : ""}`}
          onMouseEnter={() => setActiveSubmenu("tags")}
          onClick={(e) => {
            e.stopPropagation();
            setActiveSubmenu((prev) => (prev === "tags" ? null : "tags"));
          }}
        >
          <div className="context-menu-item-left">
            <svg
              className="context-menu-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <span>Apply Tags</span>
          </div>
          <div className="context-menu-item-right">
            <kbd className="context-menu-kbd">G</kbd>
            <svg className="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {activeSubmenu === "tags" && (
            <div className="context-sub-menu" onClick={(e) => e.stopPropagation()}>
              <div className="context-sub-menu-title">Apply Tags</div>
              {userSelectableTags && userSelectableTags.length > 0 ? (
                userSelectableTags.map((t) => {
                  const isSelected = stockTags.includes(t);
                  return (
                    <div
                      key={t}
                      className={`context-sub-menu-item ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        if (onToggleTag) {
                          onToggleTag(stock.symbol, t);
                        }
                      }}
                    >
                      <span className="checkbox-icon">{isSelected ? "✓" : ""}</span>
                      <span className="sub-menu-label">{t}</span>
                    </div>
                  );
                })
              ) : (
                <div className="context-sub-menu-empty">No tags available</div>
              )}
            </div>
          )}
        </div>

        {/* Toggle Tradable */}
        {onToggleTradable && (
          <div
            className="context-menu-item"
            onClick={() => {
              onToggleTradable(stock.symbol);
              onClose();
            }}
          >
            <div className="context-menu-item-left">
              <svg
                className="context-menu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>{isTradable ? "Mark as Untradable" : "Mark as Tradable"}</span>
            </div>
            <kbd className="context-menu-kbd">T</kbd>
          </div>
        )}

        <div className="context-menu-divider" />

        {/* Copy Symbol */}
        {onCopySymbol && (
          <div
            className="context-menu-item"
            onClick={() => {
              onCopySymbol(stock.symbol);
              onClose();
            }}
          >
            <div className="context-menu-item-left">
              <svg
                className="context-menu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy Symbol</span>
            </div>
            <kbd className="context-menu-kbd">C</kbd>
          </div>
        )}

        {/* Open in TradingView */}
        {onOpenTradingView && (
          <div
            className="context-menu-item"
            onClick={() => {
              onOpenTradingView(stock.symbol, country);
              onClose();
            }}
          >
            <div className="context-menu-item-left">
              <svg
                className="context-menu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>TradingView Chart</span>
            </div>
            <kbd className="context-menu-kbd">O</kbd>
          </div>
        )}

        {/* Quick Log to Journal */}
        {onQuickLog && (
          <div
            className="context-menu-item"
            onClick={() => {
              onQuickLog(stock.symbol);
              onClose();
            }}
          >
            <div className="context-menu-item-left">
              <svg
                className="context-menu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="12" y1="6" x2="12" y2="12" />
                <line x1="9" y1="9" x2="15" y2="9" />
              </svg>
              <span>Log to Journal</span>
            </div>
            <kbd className="context-menu-kbd">L</kbd>
          </div>
        )}

        {/* AI Setup Analysis */}
        {onAnalyzeStock && (
          <div
            className="context-menu-item"
            onClick={() => {
              onAnalyzeStock(stock);
              onClose();
            }}
          >
            <div className="context-menu-item-left">
              <svg
                className="context-menu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
              </svg>
              <span>AI Setup Analysis</span>
            </div>
            <kbd className="context-menu-kbd">A</kbd>
          </div>
        )}

        {/* Edit Details */}
        {onEditStock && (
          <div
            className="context-menu-item"
            onClick={() => {
              onEditStock(stock);
              onClose();
            }}
          >
            <div className="context-menu-item-left">
              <svg
                className="context-menu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              <span>Edit Details</span>
            </div>
            <kbd className="context-menu-kbd">E</kbd>
          </div>
        )}

        {/* Delete Stock */}
        {onDeleteStock && (
          <>
            <div className="context-menu-divider" />
            <div
              className="context-menu-item is-danger"
              onClick={() => {
                onDeleteStock(stock.symbol);
                onClose();
              }}
            >
              <div className="context-menu-item-left">
                <svg
                  className="context-menu-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Remove Stock</span>
              </div>
              <kbd className="context-menu-kbd">Del</kbd>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
