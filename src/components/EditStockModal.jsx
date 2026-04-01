import { useState, useEffect } from "react";
import Modal from "./Modal";
import MiniCandlestickChart from "./MiniCandlestickChart";
import { fetchStockData } from "../utils/yahooFinanceMap";
import { getSingleStockAnalysis } from "../services/ai";

export default function EditStockModal({
  isOpen,
  onClose,
  stock,
  onSave,
  paramDefinitions,
  sectors,
  availableTags,
  weekInfo,
  country,
  showTags = true,
  aiSettings = {},
  isDeepView = false,
  onUpdateStock = null,
  watchlists = []
}) {
  const [formData, setFormData] = useState(null);
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true);
  const [timeframe, setTimeframe] = useState('3mo');
  const [interval, setInterval] = useState('auto');
  const [loadingChart, setLoadingChart] = useState(false);

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

  useEffect(() => {
    if (stock) {
      setFormData(structuredClone(stock));
      setAiAnalysis(stock.aiAnalysis || null);
      setAiAnalysisDate(stock.aiAnalysisDate || null);
      setAiError(null);
    }
  }, [stock]);

  // On-demand data loading for Chart (e.g. when clicked from Stock Grid or duration changed)
  useEffect(() => {
    if (!isOpen || !formData || !formData.symbol) return;

    const loadChartData = async () => {
      setLoadingChart(true);
      try {
        const results = await fetchStockData([formData.symbol], country, timeframe, interval);
        if (results && results.length > 0) {
          setFormData(prev => ({
            ...prev,
            ...results[0],
            // Ensure we don't overwrite user changes to params/notes if they already exist
            params: prev.params || results[0].params,
            notes: prev.notes || results[0].notes
          }));
        }
      } catch (err) {
        console.error("Failed to fetch candlestick data:", err);
      } finally {
        setLoadingChart(false);
      }
    };

    // Refetch if missing data OR if this is being triggered by a timeframe/interval change
    loadChartData();
  }, [isOpen, formData?.symbol, country, timeframe, interval]);

  // Reset interval to 'auto' when timeframe changes to ensure compatible range/interval defaults
  useEffect(() => {
    setInterval('auto');
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

  const handleRunAi = async () => {
    if (!aiSettings?.apiKey) {
      setAiError("API Key not configured in Settings.");
      return;
    }

    setLoadingAi(true);
    setAiError(null);
    try {
      const result = await getSingleStockAnalysis(
        aiSettings.apiKey,
        aiSettings.model,
        formData,
        timeframe
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

  const sortedParams = Object.entries(paramDefinitions || {}).sort(
    (a, b) => (a[1].order || 0) - (b[1].order || 0)
  );

  const renderAiAnalysis = () => {
    if (!aiAnalysis) return null;

    const parseMarkdown = (text) => {
      // Handle Bold
      let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Handle Bullet Points
      html = html.replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>');
      // Wrap lists
      if (html.includes('<li>')) {
        const parts = html.split(/(<li>.*<\/li>)/gms);
        html = parts.map(p => p.startsWith('<li>') ? `<ul class="analysis-list">${p}</ul>` : p).join('');
      }
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const sections = aiAnalysis.split(/###\s+/).filter(Boolean);
    return (
      <div className="deep-analysis-results themed-scroll">
        {sections.map((section, idx) => {
          const lines = section.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();
          return (
            <div key={idx} className="analysis-section-box">
              <h4 className="analysis-section-title">{title}</h4>
              <div className="analysis-section-content">
                {parseMarkdown(content)}
              </div>
            </div>
          );
        })}
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

        {sortedParams.map(([key, def]) => (
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
        {watchlists.length > 0 && (showTags && availableTags.length > 0) && (
          <div className="separator-v2-premium" />
        )}

        {/* Column 2: Tags */}
        {showTags && availableTags.length > 0 && (
          <div className="research-col-tags-v2">
            <div className="pill-group-wrapper-v2">
              {availableTags.map((tag) => {
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
        {(watchlists.length > 0 || (showTags && availableTags.length > 0)) && (
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
                  {typeof weekInfo === 'string' && weekInfo.trim() !== '' && (
                    <span className="header-week-info-badge">{weekInfo}</span>
                  )}
                </div>
                <p className="modal-subtitle-hero">{formData.longName}</p>
              </div>
              <div className="terminal-header-actions-wrapper">
                <div className="header-utility-icons-premium">
                  <a
                    href={country === 'IN' ? `https://www.tradingview.com/chart/?symbol=NSE:${formData.symbol}` : `https://www.tradingview.com/chart/?symbol=NASDAQ:${formData.symbol}`}
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
                    href={`https://www.screener.in/company/${formData.symbol}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-icon-action-btn"
                    title="View on Screener"
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

            <div
              className={`deep-view-top ${isParamsCollapsed ? 'collapsed' : ''}`}
              style={!isParamsCollapsed ? { height: `${topHeight}px` } : {}}
            >
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
              style={{ gridTemplateColumns: `${leftWidth}% 6px 1fr` }}
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
                  </div>
                </div>
                <div className="chart-wrapper-large">
                  <MiniCandlestickChart
                    data={formData}
                    country={country}
                    hideHeaders={true}
                    interactive={true}
                    disableZoom={false}
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
                  {aiAnalysisDate && !loadingAi && (
                    <span className="ai-last-run-timestamp">Last Run: {aiAnalysisDate}</span>
                  )}
                  {!loadingAi && (
                    <button
                      onClick={handleRunAi}
                      className="btn-premium-primary btn-premium-primary-sm"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      </svg>
                      Analyze
                    </button>
                  )}
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

            <div className="modal-pinned-footer">
              <div className="footer-context-hub">
                {/* Secondary metadata can go here if needed in future */}
              </div>
              <div className="footer-actions">
                <button onClick={onClose} className="btn-premium-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-premium-primary">Save</button>
              </div>
            </div>
          </>
        ) : (
          <div className="standard-modal-interior-v2">
            <h2 className="standard-modal-title-v2">Edit {formData.symbol} ({formData.longName})</h2>
            <div className="standard-modal-body-v2 themed-scroll">
              {renderFormContent()}
            </div>
            <div className="standard-modal-footer-v2">
              <button onClick={onClose} className="btn-premium-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-premium-primary">Save Changes</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
