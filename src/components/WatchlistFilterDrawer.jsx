import { useEffect, useRef } from "react";
import MultiSelectDropdown from "./MultiSelectDropdown";
import { MovingAverageFilter, ClearButton } from "./StockGrid";

export default function WatchlistFilterDrawer({
  isOpen,
  onClose,
  filters = {},
  setFilter,
  setFilters,
  priceTrendFilter,
  setPriceTrendFilter,
  activeFilters = [],
  isSectorFilterable,
  sectors = [],
  isTagFilterable,
  availableTags = [],
  filterableParams = [],
  isTradableFilterable,
  country = "IN",
}) {
  const drawerRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when open on mobile/tablet screens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalActiveCount = activeFilters.length + (priceTrendFilter ? 1 : 0);

  const handleClearAll = () => {
    setFilters({});
    setPriceTrendFilter(null);
  };

  return (
    <div className="watchlist-filter-drawer-backdrop" onClick={onClose}>
      <div
        className="watchlist-filter-drawer-panel"
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Watchlist Filters"
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
              <h3 className="drawer-title">Filters</h3>
              <p className="drawer-subtitle">Refine Watchlist stocks</p>
            </div>
          </div>
          <button
            className="drawer-close-btn"
            onClick={onClose}
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

        {/* ACTIVE FILTERS SUMMARY BAR & CLEAR ALL */}
        <div className="drawer-action-bar">
          <span className="drawer-active-count">
            Active: <strong>{totalActiveCount}</strong> filter{totalActiveCount === 1 ? "" : "s"}
          </span>
          {totalActiveCount > 0 && (
            <button
              className="drawer-reset-btn"
              onClick={handleClearAll}
              title="Clear all active filters"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* DRAWER BODY - SCROLLABLE SECTIONS */}
        <div className="drawer-body">
          {/* SECTION 1: GENERAL FILTERS */}
          <div className="drawer-section">
            <div className="drawer-section-header">
              <h4>General Filters</h4>
            </div>

            <div className="drawer-section-grid">
              {/* Sector Filter */}
              {isSectorFilterable && (
                <div className="drawer-filter-item">
                  <label htmlFor="drawer-sector-filter">Sector</label>
                  <div className="filter-input-wrapper">
                    <MultiSelectDropdown
                      id="drawer-sector-filter"
                      options={sectors}
                      value={
                        Array.isArray(filters.__sector__)
                          ? filters.__sector__
                          : filters.__sector__
                            ? [filters.__sector__]
                            : []
                      }
                      onChange={(val) => setFilter("__sector__", val)}
                      placeholder="All Sectors"
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

              {/* Tag Filter */}
              {(availableTags || []).length > 0 && isTagFilterable && (
                <div className="drawer-filter-item">
                  <label htmlFor="drawer-tag-filter">Tag</label>
                  <div className="filter-input-wrapper">
                    <MultiSelectDropdown
                      id="drawer-tag-filter"
                      options={availableTags}
                      value={
                        Array.isArray(filters.__tag__)
                          ? filters.__tag__
                          : filters.__tag__
                            ? [filters.__tag__]
                            : []
                      }
                      onChange={(val) => setFilter("__tag__", val)}
                      placeholder="All Tags"
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

              {/* Tradable Filter */}
              {isTradableFilterable && (
                <div className="drawer-filter-item">
                  <label htmlFor="drawer-tradable-filter">Tradable Only</label>
                  <div className="filter-input-wrapper">
                    <select
                      id="drawer-tradable-filter"
                      className="select-control filter-select-control"
                      value={filters.__tradable__ ?? ""}
                      onChange={(e) =>
                        setFilter(
                          "__tradable__",
                          e.target.value === ""
                            ? ""
                            : e.target.value === "true"
                        )
                      }
                    >
                      <option value="">All Stocks</option>
                      <option value="true">Tradable Only (Yes)</option>
                      <option value="false">Untradable Only (No)</option>
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

              {/* Price Trend Quick Filter */}
              <div className="drawer-filter-item">
                <label>Daily Price Action</label>
                <div className="trend-toggle-buttons">
                  <button
                    type="button"
                    className={`trend-btn trend-up ${priceTrendFilter === "up" ? "active" : ""}`}
                    onClick={() => setPriceTrendFilter(priceTrendFilter === "up" ? null : "up")}
                  >
                    ▲ Advances (Up)
                  </button>
                  <button
                    type="button"
                    className={`trend-btn trend-down ${priceTrendFilter === "down" ? "active" : ""}`}
                    onClick={() => setPriceTrendFilter(priceTrendFilter === "down" ? null : "down")}
                  >
                    ▼ Declines (Down)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: TECHNICAL METRICS & PARAMETERS */}
          <div className="drawer-section">
            <div className="drawer-section-header">
              <h4>Technical Metrics & Rules</h4>
            </div>

            <div className="drawer-section-grid">
              {filterableParams.map(([key, p]) => (
                <div
                  key={key}
                  className={`drawer-filter-item ${key === "movingAverages" ? "drawer-filter-item-ma" : ""}`}
                >
                  <label htmlFor={`drawer-param-${key}`}>
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
                        id={`drawer-param-${key}`}
                        value={filters[key]}
                        onChange={(val) => setFilter(key, val)}
                      />
                    ) : (
                      <>
                        {p.type === "checkbox" && (
                          <>
                            <select
                              id={`drawer-param-${key}`}
                              className="select-control filter-select-control"
                              value={filters[key] ?? ""}
                              onChange={(e) =>
                                setFilter(
                                  key,
                                  e.target.value === ""
                                    ? ""
                                    : e.target.value === "true"
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
                              id={`drawer-param-${key}`}
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
                              id={`drawer-param-${key}`}
                              type="text"
                              className="filter-input input-with-icon-padding"
                              value={filters[key] || ""}
                              onChange={(e) => setFilter(key, e.target.value)}
                              placeholder={
                                key.toLowerCase().includes("liquidity") ||
                                (p.label && p.label.toLowerCase().includes("liquidity"))
                                  ? country === "IN"
                                    ? "Filter (Cr).."
                                    : "Filter (M).."
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
            </div>
          </div>
        </div>

        {/* DRAWER FOOTER */}
        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-footer-btn reset-btn"
            onClick={handleClearAll}
            disabled={totalActiveCount === 0}
          >
            Clear All
          </button>
          <button
            type="button"
            className="drawer-footer-btn apply-btn"
            onClick={onClose}
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
