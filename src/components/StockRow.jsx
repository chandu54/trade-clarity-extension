import React, { memo } from "react";
import TrashIcon from "./icons/TrashIcon";
import MovingAverageRibbon from "./MovingAverageRibbon";
import {
  normalizeMacroTheme,
  extractStockThematicVectors,
} from "../constants/thematicCatalog";
import { doesParamPassCheck } from "../utils/paramUtils";

const FLAG_COLOR_MAP = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
};

const ClearButton = ({ onClick, isSelect }) => (
  <button
    type="button"
    className={`clear-filter-btn ${isSelect ? "is-select" : "is-default"}`}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Clear"
    tabIndex={-1}
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

function areStockRowPropsEqual(prev, next) {
  if (prev.stock !== next.stock) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.totalStocks !== next.totalStocks) return false;
  if (prev.isReadOnly !== next.isReadOnly) return false;
  if (prev.country !== next.country) return false;
  if (prev.quote !== next.quote) return false;
  if (prev.isTagDropdownActive !== next.isTagDropdownActive) return false;
  if (prev.isFlagMenuActive !== next.isFlagMenuActive) return false;
  if (prev.showLivePrice !== next.showLivePrice) return false;
  if (prev.showTags !== next.showTags) return false;
  if (prev.showBusinessScope !== next.showBusinessScope) return false;
  if (prev.showDependentIndustries !== next.showDependentIndustries) return false;
  if (prev.showMacroTheme !== next.showMacroTheme) return false;
  if (prev.showNotes !== next.showNotes) return false;
  if (prev.visibleParams !== next.visibleParams) return false;
  if (prev.sectors !== next.sectors) return false;
  if (prev.availableTags !== next.availableTags) return false;

  return true;
}

export const StockRow = memo(function StockRow({
  stock,
  rowIndex,
  totalStocks,
  quote,
  country,
  isReadOnly,
  sectors,
  visibleParams,
  availableTags,
  showLivePrice,
  showTags,
  showBusinessScope,
  showDependentIndustries,
  showMacroTheme,
  showNotes,
  isTagDropdownActive,
  isFlagMenuActive,
  onToggleTagDropdown,
  onToggleFlagMenu,
  onSelectFlagColor,
  onEditStock,
  onQuickLog,
  onAddTag,
  onRemoveTag,
  onUpdateField,
  onUpdateParam,
  onDeleteStock,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
}) {
  const checkParams = visibleParams.filter(([, p]) => p.isCheck === true);
  const totalChecks = checkParams.length;

  let checksBadge = <span className="checks-none">—</span>;
  if (totalChecks > 0) {
    let passed = 0;
    checkParams.forEach(([key, p]) => {
      if (doesParamPassCheck(stock.params?.[key], p)) {
        passed++;
      }
    });
    const ratio = passed / totalChecks;
    let statusClass = "poor";
    if (ratio >= 0.8) statusClass = "excellent";
    else if (ratio >= 0.6) statusClass = "good";
    else if (ratio >= 0.4) statusClass = "average";

    checksBadge = (
      <div
        className={`checks-badge ${statusClass}`}
        title={`${passed} of ${totalChecks} checks passed`}
      >
        <span className="passed-count">{passed}</span>
        <span className="separator">/</span>
        <span className="total-count">{totalChecks}</span>
      </div>
    );
  }

  return (
    <tr
      className={stock.tradable ? "tradable" : ""}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, stock);
        }
      }}
      onMouseEnter={() => {
        if (onMouseEnter) onMouseEnter(stock);
      }}
      onMouseLeave={() => {
        if (onMouseLeave) onMouseLeave(stock);
      }}
    >
      <td
        className={`sticky-col stock-col ${isTagDropdownActive ? "elevated-cell" : ""}`}
      >
        <div className="stock-cell-content">
          <div className="stock-header-row">
            <div className="symbol-cell-content">
              <div className="flex items-center gap-1">
                {!isReadOnly && (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      flexShrink: 0,
                      marginLeft: "-6px",
                    }}
                  >
                    <div
                      className="stock-grid-flag-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFlagMenu(stock.symbol);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: "2px",
                        borderRadius: "4px",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                      title="Flag Stock"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill={stock.flagColor ? FLAG_COLOR_MAP[stock.flagColor] : "none"}
                        stroke={stock.flagColor ? FLAG_COLOR_MAP[stock.flagColor] : "currentColor"}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          opacity: stock.flagColor ? 1 : 0.2,
                          transition: "opacity 0.2s",
                        }}
                      >
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                    </div>

                    {isFlagMenuActive && (
                      <div
                        className="flag-row-popover"
                        style={{
                          position: "absolute",
                          left: "20px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "var(--panel, #1e293b)",
                          border: "1px solid var(--border, rgba(255,255,255,0.15))",
                          borderRadius: "20px",
                          padding: "4px 8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          zIndex: 1000,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(FLAG_COLOR_MAP).map(([colorName, colorHex]) => (
                          <button
                            key={colorName}
                            className="flag-color-dot"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectFlagColor(stock.symbol, colorName);
                            }}
                            style={{
                              background: colorHex,
                              backgroundColor: colorHex,
                            }}
                            title={`${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Flag`}
                          />
                        ))}
                        <button
                          className="flag-clear-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFlagColor(stock.symbol, null);
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
                      width: "6px",
                      height: "14px",
                      borderRadius: "2px",
                      backgroundColor: FLAG_COLOR_MAP[stock.flagColor],
                      display: "inline-block",
                      flexShrink: 0,
                      marginLeft: "-6px",
                    }}
                    title={`${stock.flagColor.toUpperCase()} Flagged`}
                  />
                )}
                <span
                  className={`stock-symbol ${!isReadOnly ? "clickable" : ""}`}
                  onClick={() => {
                    if (!isReadOnly) {
                      onEditStock(stock);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (onContextMenu) {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(e, stock);
                    }
                  }}
                  title={!isReadOnly ? "Click to edit details" : ""}
                >
                  {stock.symbol}
                  {stock.isInvalid && (
                    <span
                      className="symbol-invalid-icon"
                      title="Symbol not found or data unavailable. Please verify the ticker."
                    >
                      !
                    </span>
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
              <div
                className={`add-tag-wrapper ${isTagDropdownActive ? "active-dropdown" : ""}`}
              >
                <button
                  className={`add-tag-trigger ${isTagDropdownActive ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTagDropdown(stock.symbol);
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
                {isTagDropdownActive && (() => {
                  const userSelectableTags = availableTags.filter(
                    (t) => !t.toUpperCase().startsWith("AI:")
                  );
                  const isNearBottom = rowIndex >= totalStocks - 2;
                  return (
                    <div
                      className={`custom-tag-dropdown ${isNearBottom ? "open-upward" : ""}`}
                    >
                      {userSelectableTags.length === 0 && (
                        <div className="tag-option empty">No tags defined</div>
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
                                onRemoveTag(stock, t);
                              } else {
                                onAddTag(stock, t);
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
                const remainingTagsList = stock.tags.slice(MAX_VISIBLE_TAGS).join(", ");

                return (
                  <>
                    {visibleTags.map((tag) => (
                      <span key={tag} className="tag-pill">
                        {tag}
                        <button
                          className="tag-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTag(stock, tag);
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
                        title={`+${overflowCount} more tag${overflowCount > 1 ? "s" : ""}: ${remainingTagsList}`}
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
          {quote ? (
            <div className="flex flex-col gap-0.5 items-start">
              <div className="stock-grid-price-row">
                <span className="stock-grid-price-val">
                  {(() => {
                    const priceVal = quote.currentPrice;
                    const currencySymbol = country === "US" ? "$" : "₹";
                    const locale = country === "US" ? "en-US" : "en-IN";
                    return priceVal > 0
                      ? `${currencySymbol}${priceVal.toLocaleString(locale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—";
                  })()}
                </span>
                {quote.dailyChangePct !== undefined ? (
                  <span
                    className={`stock-grid-price-change ${quote.isAdvancing ? "adv" : "dec"}`}
                  >
                    {quote.dailyChangePct >= 0 ? "+" : ""}
                    {quote.dailyChangePct.toFixed(2)}%
                  </span>
                ) : (
                  <span className="stock-grid-price-change decimal">—</span>
                )}
              </div>
              {(() => {
                const earningsDateVal =
                  quote?.earningsDate || stock.earningsDate || stock.params?.earningsDate;
                if (!earningsDateVal) return null;
                return (
                  <span
                    className="text-[9px] font-bold text-slate-450 dark:text-slate-500 font-mono tracking-tight"
                    title={`Next Earnings Date: ${earningsDateVal}`}
                  >
                    E:{" "}
                    {(() => {
                      try {
                        const d = new Date(earningsDateVal);
                        return isNaN(d.getTime())
                          ? earningsDateVal
                          : d.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            });
                      } catch (_e) {
                        return earningsDateVal;
                      }
                    })()}
                  </span>
                );
              })()}
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
              onUpdateField(stock.symbol, "sector", e.target.value);
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
                onUpdateField(stock.symbol, "sector", "");
              }}
              isSelect
            />
          )}
        </div>
      </td>

      {visibleParams.map(([key, p]) => {
        const baseKey = key.replace(/^(in|us)\./, "");
        const countryKey = `${country.toLowerCase()}.${baseKey}`;
        const val =
          stock.params?.[key] ??
          stock.params?.[baseKey] ??
          stock.params?.[countryKey] ??
          "";

        return (
          <td key={key} className={`cw-${key}`}>
            {key === "movingAverages" && val ? (
              <MovingAverageRibbon value={val} />
            ) : baseKey === "vcp_tightness" && val ? (
              <div className="vcp-tightness-badge-cell">
                <span
                  className={`vcp-badge ${
                    val.includes("Tight")
                      ? "tight"
                      : val.includes("Moderate")
                      ? "moderate"
                      : "wide"
                  }`}
                >
                  {stock.params?.vcp_tightness_display || val}
                </span>
              </div>
            ) : (
              <div className="param-standard-renderer">
                {p.type === "checkbox" && (
                  <input
                    type="checkbox"
                    className="grid-checkbox compact"
                    checked={!!val}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      if (isReadOnly) return;
                      onUpdateParam(stock.symbol, key, e.target.checked);
                    }}
                  />
                )}

                {p.type === "select" && (
                  <div className="input-clear-wrapper type-select">
                    <select
                      className="select-control input-with-clear"
                      value={val}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        onUpdateParam(stock.symbol, key, e.target.value);
                      }}
                    >
                      <option value=""></option>
                      {p.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    {!isReadOnly && val && (
                      <ClearButton
                        onClick={() => {
                          onUpdateParam(stock.symbol, key, "");
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
                      value={val}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        onUpdateParam(stock.symbol, key, e.target.value);
                      }}
                    />
                    {!isReadOnly && val && (
                      <ClearButton
                        onClick={() => {
                          onUpdateParam(stock.symbol, key, "");
                        }}
                      />
                    )}
                  </div>
                )}

                {p.type === "date" && (
                  <div className="input-clear-wrapper type-date">
                    <input
                      key={val || "empty-date"}
                      type="date"
                      className="grid-text-input input-with-clear"
                      defaultValue={val}
                      disabled={isReadOnly}
                      onBlur={(e) => {
                        if (isReadOnly) return;
                        if (val !== e.target.value) {
                          onUpdateParam(stock.symbol, key, e.target.value);
                        }
                      }}
                    />
                    {!isReadOnly && val && (
                      <ClearButton
                        onClick={() => {
                          onUpdateParam(stock.symbol, key, "");
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
                      value={val}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        onUpdateParam(stock.symbol, key, e.target.value);
                      }}
                    />
                    {!isReadOnly && val && (
                      <ClearButton
                        onClick={() => {
                          onUpdateParam(stock.symbol, key, "");
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </td>
        );
      })}

      <td className="checks-cell cw-checks">{checksBadge}</td>

      <td className="cw-tradable">
        <input
          type="checkbox"
          className="grid-checkbox"
          checked={stock.tradable}
          disabled={isReadOnly}
          onChange={(e) => {
            if (isReadOnly) return;
            onUpdateField(stock.symbol, "tradable", e.target.checked);
          }}
        />
      </td>

      {showBusinessScope && (
        <td className="cw-businessScope">
          <div
            className="flex flex-wrap gap-1 items-center max-w-[220px] max-h-[44px] overflow-hidden"
            title={(stock.businessScope || []).join(", ")}
          >
            {Array.isArray(stock.businessScope) && stock.businessScope.length > 0 ? (
              stock.businessScope.slice(0, 2).map((item, i) => (
                <span
                  key={i}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/60 inline-block truncate max-w-[110px]"
                >
                  {item}
                </span>
              ))
            ) : (
              <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                —
              </span>
            )}
            {Array.isArray(stock.businessScope) && stock.businessScope.length > 2 && (
              <span
                className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold px-1 py-0.5"
                title={stock.businessScope.slice(2).join(", ")}
              >
                +{stock.businessScope.length - 2}
              </span>
            )}
          </div>
        </td>
      )}

      {showDependentIndustries && (
        <td className="cw-dependentIndustries">
          <div
            className="flex flex-wrap gap-1 items-center max-w-[220px] max-h-[44px] overflow-hidden"
            title={(stock.dependentIndustries || []).join(", ")}
          >
            {Array.isArray(stock.dependentIndustries) &&
            stock.dependentIndustries.length > 0 ? (
              stock.dependentIndustries.slice(0, 2).map((item, i) => (
                <span
                  key={i}
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/70 inline-flex items-center truncate max-w-[125px]"
                >
                  <span className="text-sky-500 dark:text-sky-400 mr-1 select-none text-[9px]">
                    ✦
                  </span>
                  <span className="truncate">{item}</span>
                </span>
              ))
            ) : (
              <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                —
              </span>
            )}
            {Array.isArray(stock.dependentIndustries) &&
              stock.dependentIndustries.length > 2 && (
                <span
                  className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded font-semibold shrink-0 border border-slate-300/50 dark:border-slate-600/50"
                  title={stock.dependentIndustries.slice(2).join(", ")}
                >
                  +{stock.dependentIndustries.length - 2}
                </span>
              )}
          </div>
        </td>
      )}

      {showMacroTheme && (
        <td className="cw-macroTheme">
          {(() => {
            const rawTheme =
              stock.macroTheme ||
              (Array.isArray(stock.dependentIndustries) &&
                stock.dependentIndustries[0]) ||
              "";
            const theme = normalizeMacroTheme(rawTheme) || rawTheme;
            const vectors = extractStockThematicVectors(stock);
            const additionalVectors = vectors.filter(
              (v) => v.theme.toLowerCase() !== theme.toLowerCase()
            );

            return theme ? (
              <div
                className="flex items-center gap-1.5 max-w-[210px] overflow-hidden"
                title={theme}
              >
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-500/30 truncate max-w-[155px]">
                  <span className="text-[10px] shrink-0">🌐</span>
                  <span className="truncate">{theme}</span>
                </span>
                {additionalVectors.length > 0 && (
                  <span
                    className="text-[10px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/60 border border-violet-200 dark:border-violet-700/60 px-1.5 py-0.5 rounded-md shrink-0 cursor-default"
                    title={additionalVectors
                      .map((v) => v.theme)
                      .filter(Boolean)
                      .join(", ")}
                  >
                    +{additionalVectors.length}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                —
              </span>
            );
          })()}
        </td>
      )}

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
                onUpdateField(stock.symbol, "notes", e.target.value);
              }}
            />
            {!isReadOnly && stock.notes && (
              <ClearButton
                onClick={() => {
                  onUpdateField(stock.symbol, "notes", "");
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
          onClick={() => onDeleteStock(stock.symbol)}
          title={isReadOnly ? "Read-only week" : "Delete stock"}
        >
          <TrashIcon size={20} />
        </button>
      </td>
    </tr>
  );
}, areStockRowPropsEqual);
