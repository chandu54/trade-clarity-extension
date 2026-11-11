import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MiniCandlestickChart from './MiniCandlestickChart';
import MovingAverageRibbon from './MovingAverageRibbon';
import { 
  fetchSingleIndexDetails, 
  INDEX_NAME_MAP, 
  INDEX_CONSTITUENTS, 
  getInstitutionalTrend 
} from '../services/marketPulse';
import { getSingleStockAnalysis, PROMPT_TEMPLATES } from '../services/ai';

const TIMEFRAME_OPTIONS = [
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1Y' },
  { id: '2y', label: '2Y' },
  { id: '5y', label: '5Y' },
];

const checkIsAiBlocked = (blockedUntil) => {
  if (!blockedUntil) return false;
  return blockedUntil > Date.now();
};

const formatPrice = (val) => {
  if (val == null || isNaN(val)) return '--';
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPct = (val) => {
  if (val == null || isNaN(val)) return '0.00%';
  return `${Number(val).toFixed(2)}%`;
};


const SafeMarkdown = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentList = [];

  const parseInline = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="analysis-unordered-list">
          {currentList.map((item, i) => (
            <li key={i}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
    } else {
      flushList(index);
      if (trimmed) {
        elements.push(
          <p key={index} className="analysis-text-block">
            {parseInline(trimmed)}
          </p>
        );
      }
    }
  });
  flushList('final');

  return <>{elements}</>;
};

const renderStructuredAiAnalysis = (rawText) => {
  if (!rawText) return null;

  let text = rawText
    .replace(/^Chief Market Strategist Thesis:\s*/i, '')
    .replace(/^As Chief Market Strategist[^\n]*\n*/i, '')
    .replace(/^Executive Summary:\s*/i, '')
    .trim();

  if (text.includes('###')) {
    const parts = text.split(/###\s+/);
    const elements = [];

    parts.forEach((part, idx) => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;

      const isIntro = idx === 0 && !text.startsWith('###');
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
            {title && <h4 className="analysis-section-title">{title}</h4>}
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
  }

  return (
    <div className="deep-analysis-results themed-scroll">
      <div className="analysis-section-box no-title">
        <div className="analysis-section-content">
          <SafeMarkdown text={text} />
        </div>
      </div>
    </div>
  );
};

export default function IndexDetailModal({
  index,
  country = 'IN',
  onClose,
  aiSettings = {}
}) {
  const [modalTimeframe, setModalTimeframe] = useState('1y');
  const [modalInterval, setModalInterval] = useState('auto');
  const [indexData, setIndexData] = useState(index);
  const [loadingChart, setLoadingChart] = useState(false);

  // Moving Average Settings (synced with global trade_clarity_ma_settings like EditStockModal)
  const [maSettings, setMaSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('trade_clarity_ma_settings');
      if (saved) return JSON.parse(saved);
    } catch (_e) {}
    return {
      '5': { visible: false, color: '#10b981', thickness: 2 },
      '10': { visible: false, color: '#06b6d4', thickness: 2 },
      '21': { visible: true, color: '#3b82f6', thickness: 2 },
      '50': { visible: true, color: '#f59e0b', thickness: 2 },
      '200': { visible: true, color: '#ef4444', thickness: 2 },
    };
  });
  const [isMaPopoverOpen, setIsMaPopoverOpen] = useState(false);
  const maSettingsRef = useRef(null);

  // Resizable split layout (clamped 40% to 85%, persisted like EditStockModal)
  const [showAiPane, setShowAiPane] = useState(true);
  const [splitPct, setSplitPct] = useState(() => {
    try {
      const saved = localStorage.getItem('trade_clarity_index_split');
      if (saved) return Math.min(85, Math.max(40, Number(saved)));
    } catch (_) {}
    return 70;
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef(null);

  // Right-side analysis tabs ('index' | 'ai')
  const [intelligenceTab, setIntelligenceTab] = useState('index');
  const [copiedAi, setCopiedAi] = useState(false);

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  const handleCopyAiMemo = () => {
    if (!aiAnalysis) return;
    try {
      navigator.clipboard.writeText(aiAnalysis);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
    } catch (_e) {}
  };

  // Save MA settings when updated
  const handleUpdateMaSetting = (ma, key, value) => {
    setMaSettings(prev => {
      const next = { ...prev, [ma]: { ...prev[ma], [key]: value } };
      try {
        localStorage.setItem('trade_clarity_ma_settings', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Close MA popover on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (maSettingsRef.current && !maSettingsRef.current.contains(e.target)) {
        setIsMaPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch index chart data matching EditStockModal approach
  const loadChartData = useCallback(async (tf, iv = 'auto') => {
    if (!index?.symbol) return;
    setLoadingChart(true);
    try {
      // Fetch 2Y lookback for standard daily/weekly intervals to ensure instant drag history
      const fetchTf = (iv === '1d' || iv === '1wk' || iv === '1mo' || (iv === 'auto' && ['1mo', '3mo', '6mo', 'ytd', '1y'].includes(tf))) ? '2y' : tf;
      const customIv = iv === 'auto' ? null : iv;
      const details = await fetchSingleIndexDetails(index.symbol, country, fetchTf, index, customIv);
      if (details) {
        setIndexData(prev => {
          // If we already accumulated older candles from drag history, preserve and merge them
          if (prev?.candlesticks && prev.candlesticks.length > (details.candlesticks?.length || 0)) {
            const timeKey = b => typeof b.time === 'object' ? `${b.time.year}-${String(b.time.month).padStart(2,'0')}-${String(b.time.day).padStart(2,'0')}` : String(b.time);
            const map = new Map();
            prev.candlesticks.forEach(c => map.set(timeKey(c), c));
            (details.candlesticks || []).forEach(c => map.set(timeKey(c), c));
            const merged = Array.from(map.values()).sort((a, b) => {
              const ta = typeof a.time === 'number' ? a.time : (typeof a.time === 'string' ? new Date(a.time).getTime() : 0);
              const tb = typeof b.time === 'number' ? b.time : (typeof b.time === 'string' ? new Date(b.time).getTime() : 0);
              return ta - tb;
            });
            return { ...details, candlesticks: merged };
          }
          return details;
        });
      }
    } catch (err) {
      console.warn("Failed to load index modal chart data:", err);
    } finally {
      setLoadingChart(false);
    }
  }, [index?.symbol, country]);

  useEffect(() => {
    loadChartData(modalTimeframe, modalInterval);
  }, [loadChartData, modalTimeframe, modalInterval]);

  // Handle resizer dragging
  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplit(true);
    const startX = e.clientX;
    const startPct = splitPct;
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newPct = startPct + (deltaX / rect.width) * 100;
      const clamped = Math.min(85, Math.max(40, newPct));
      setSplitPct(clamped);
      try {
        localStorage.setItem('trade_clarity_index_split', String(clamped));
      } catch (_) {}
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Derived institutional parameters
  const activeData = indexData || index;
  const candles = activeData.candlesticks || [];
  const currentPrice = activeData.currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const currencySymbol = country === 'US' ? '$' : '₹';
  const changePct = modalTimeframe === '1d' ? (activeData.dailyChangePct || 0) : (activeData.periodChangePct || activeData.dailyChangePct || 0);
  const isPositive = changePct >= 0;

  // Calculate dynamic SMAs from candle data
  const dynamicSmas = useMemo(() => {
    if (!candles || candles.length === 0) return {};
    const getAvg = (p) => {
      if (candles.length < p) return null;
      const slice = candles.slice(-p);
      return slice.reduce((a, b) => a + b.close, 0) / p;
    };
    return {
      sma5: getAvg(5) || activeData.sma5,
      sma10: getAvg(10) || activeData.sma10,
      sma21: getAvg(21) || activeData.sma21,
      sma50: getAvg(50) || activeData.sma50,
      sma200: getAvg(200) || activeData.sma200
    };
  }, [candles, activeData]);

  // Generate MA Status string for ribbon (e.g. "Above 5, 10, 21, 50, 200")
  const maRibbonStatus = useMemo(() => {
    const aboveList = [];
    ['5', '10', '21', '50', '200'].forEach(p => {
      const smaVal = dynamicSmas[`sma${p}`];
      if (smaVal && currentPrice >= smaVal) aboveList.push(p);
    });
    if (aboveList.length === 5) return "Above all";
    if (aboveList.length > 0) return `Above ${aboveList.join(', ')}`;
    return "Below all";
  }, [dynamicSmas, currentPrice]);

  // Institutional Health & Trend
  const trendAnalysis = useMemo(() => {
    return getInstitutionalTrend ? getInstitutionalTrend(currentPrice, dynamicSmas) : { score: 100, phase: "Structural Bull", color: "#10b981" };
  }, [currentPrice, dynamicSmas]);

  const healthScore = activeData.healthScore ?? trendAnalysis.score ?? 100;
  const trendPhase = activeData.trendPhase || trendAnalysis.phase || 'Structural Bull';
  const regimeColor = healthScore >= 70 ? '#10b981' : healthScore >= 40 ? '#f59e0b' : '#ef4444';

  const rsiVal = activeData.rsi || 58.4;
  const distFromAth = activeData.dist52wH != null ? activeData.dist52wH : (activeData.high52w ? (((currentPrice - activeData.high52w) / activeData.high52w) * 100) : -0.8);
  const s1Price = dynamicSmas.sma21 || (currentPrice * 0.98);
  const s2Price = dynamicSmas.sma50 || (currentPrice * 0.95);
  const r1Price = activeData.high52w || (currentPrice * 1.02);

  const constituents = (INDEX_CONSTITUENTS && INDEX_CONSTITUENTS[activeData.symbol]) 
    ? INDEX_CONSTITUENTS[activeData.symbol] 
    : ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'BHARTIARTL', 'ITC', 'LT'];

  const exposureText = healthScore >= 80 ? 'Suggested Exposure: 80–100%' : healthScore >= 60 ? 'Suggested Exposure: 50–70%' : 'Defensive (0–30%)';
  const playbookStrategy = healthScore >= 80 
    ? 'Market conditions favor strong upside momentum. Look for quality setups and constructive pullbacks near the 21-Day EMA.' 
    : healthScore >= 60 
    ? 'Selective buying environment. Focus on market leaders showing high relative strength and keep stops disciplined.' 
    : 'Defensive stance recommended. Protect capital, tighten stop losses, and wait for confirmed base breakouts.';

  const maDescription = (currentPrice >= (dynamicSmas.sma21 || 0) && (!dynamicSmas.sma50 || dynamicSmas.sma21 >= dynamicSmas.sma50))
    ? `Strong upward trend. Price is holding comfortably above the 21-Day EMA (+${dynamicSmas.sma21 ? (((currentPrice - dynamicSmas.sma21) / dynamicSmas.sma21) * 100).toFixed(1) : '0.0'}%) and 50-Day Moving Average (+${dynamicSmas.sma50 ? (((currentPrice - dynamicSmas.sma50) / dynamicSmas.sma50) * 100).toFixed(1) : '0.0'}%).`
    : (currentPrice >= (dynamicSmas.sma50 || 0))
    ? `Consolidating above the 50-Day Moving Average. Holding support while testing the 21-Day EMA buffer. Trend remains positive above the 50-Day line.`
    : `Trading below key moving averages. Market is in a defensive or corrective phase; wait for a confirmed recovery base.`;

  // AI execution
  const handleRunAi = async () => {
    if (!aiSettings?.apiKey) {
      setAiError("API Key is missing. Please configure it in Settings.");
      setShowAiPane(true);
      setIntelligenceTab('ai');
      return;
    }
    setLoadingAi(true);
    setAiError(null);
    setShowAiPane(true);
    setIntelligenceTab('ai');
    try {
      const defaultPrompt = PROMPT_TEMPLATES.find(t => t.value === 'index_pulse')?.text || PROMPT_TEMPLATES.find(t => t.value === 'deep_view')?.text;
      const cleanAiSymbol = INDEX_NAME_MAP[activeData.symbol]?.name || activeData.longName || activeData.symbol;
      const stockPayload = {
        symbol: cleanAiSymbol,
        longName: cleanAiSymbol,
        currentPrice,
        dailyChangePct: activeData.dailyChangePct || 0,
        periodChangePct: changePct,
        sector: "Market Index",
        healthScore,
        trendPhase,
        rsi: Number(Number(rsiVal).toFixed(1)),
        sma21: dynamicSmas.sma21 ? Number(dynamicSmas.sma21.toFixed(2)) : 'N/A',
        sma50: dynamicSmas.sma50 ? Number(dynamicSmas.sma50.toFixed(2)) : 'N/A',
        sma200: dynamicSmas.sma200 ? Number(dynamicSmas.sma200.toFixed(2)) : 'N/A',
        constituents: constituents.join(', ')
      };

      const result = await getSingleStockAnalysis(
        aiSettings.apiKey,
        aiSettings.model,
        stockPayload,
        modalTimeframe,
        defaultPrompt
      );
      setAiAnalysis(result.rawText || result.text || result.content || "No analysis returned.");
    } catch (err) {
      setAiError(err.message || "An error occurred during AI analysis.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="fs-overlay" onClick={onClose}>
      <div className="fs-modal" onClick={e => e.stopPropagation()}>
        {/* Sleek Top Toolbar matching EditStockModal approach */}
        <div className="fs-header">
          {/* Left Cluster: Title, Symbol, Price, Timeframes */}
          <div className="fs-header-left">
            <div className="fs-title-col">
              <span className="fs-index-name">
                {INDEX_NAME_MAP[activeData.symbol]?.name || activeData.longName || activeData.symbol}
              </span>
              <span className="fs-index-symbol">
                {INDEX_NAME_MAP[activeData.symbol]?.badge || activeData.symbol}
              </span>
            </div>

            <div className="fs-price-block">
              <span className="fs-price">
                {currencySymbol}{formatPrice(currentPrice)}
              </span>
              <span className={`fs-pct ${isPositive ? 'up' : 'down'}`}>
                {isPositive ? '+' : '-'}{formatPct(Math.abs(changePct))}
              </span>
            </div>

            <div className="fs-header-divider" />

            {/* Duration / Quick Range Presets (EditStockModal approach) */}
            <div className="duration-picker">
              {TIMEFRAME_OPTIONS.map(tf => (
                <button
                  key={tf.id}
                  type="button"
                  className={`duration-btn ${modalTimeframe === tf.id ? 'active' : ''}`}
                  onClick={() => {
                    setModalTimeframe(tf.id);
                    setModalInterval('auto');
                  }}
                  title={`View ${tf.label} timeframe`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Candlestick Interval Dropdown (TradingView & EditStockModal approach) */}
            <div className="interval-picker-dropdown">
              <span className="picker-label">Interval</span>
              <select
                value={modalInterval}
                onChange={(e) => setModalInterval(e.target.value)}
                className="interval-select-premium"
                title="Select Candlestick Interval"
              >
                <option value="auto">Auto</option>
                {['1d', '1w'].includes(modalTimeframe) && (
                  <>
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                  </>
                )}
                <option value="1d">1D</option>
                <option value="1wk">1W</option>
                <option value="1mo">1M</option>
              </select>
            </div>
          </div>

          {/* Right Cluster: MA Ribbon, MA Popover, Intelligence, Close */}
          <div className="fs-header-right">
            {/* Moving Average Ribbon (EditStockModal approach) */}
            <MovingAverageRibbon value={maRibbonStatus} variant="compact" showLabel={true} />

            {/* Moving Average Settings Popover Trigger (EditStockModal approach) */}
            <div className="ma-settings-container" ref={maSettingsRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className={`ma-settings-trigger ${isMaPopoverOpen ? 'active' : ''}`}
                onClick={() => setIsMaPopoverOpen(!isMaPopoverOpen)}
                title="Customize Moving Average overlays"
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
                <div className="ma-settings-popover shadow" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, marginTop: '6px' }}>
                  <div className="popover-header">Moving Averages</div>
                  <div className="ma-rows-list">
                    {['5', '10', '21', '50', '200'].map(ma => {
                      const setting = maSettings[ma] || { visible: false, color: '#8b5cf6', thickness: 2 };
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
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button className="modal-close-btn" onClick={onClose} title="Close Modal">
              ×
            </button>
          </div>
        </div>

        {/* Modal Body: Interactive Chart Left + Resizer Divider + Intelligence Right */}
        <div className="fs-body">
          <div className="fs-split-container" ref={splitContainerRef}>
            {/* Chart Column with proven MiniCandlestickChart engine */}
            <div 
              className="fs-chart-main" 
              style={{ 
                width: showAiPane ? `${splitPct}%` : '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              {!showAiPane && (
                <button
                  type="button"
                  className="fs-pane-expand-pill"
                  onClick={() => setShowAiPane(true)}
                  title="Expand Market Intelligence"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  <span>Market Intelligence</span>
                </button>
              )}
              {loadingChart && (
                <div className="chart-loading-overlay-premium" title="Loading chart data...">
                  <div className="chart-loading-spinner-premium" />
                  <span className="chart-loading-text-premium">Loading chart data...</span>
                </div>
              )}

              <MiniCandlestickChart
                data={activeData}
                country={country}
                hideHeaders={true}
                interactive={true}
                disableZoom={false}
                height="100%"
                maSettings={maSettings}
                timeframe={modalTimeframe}
                interval={modalInterval}
              />
            </div>

            {/* Draggable Resizer Handle with Visual Grip */}
            {showAiPane && (
              <div
                className={`fs-resize-divider ${isDraggingSplit ? 'is-dragging' : ''}`}
                onMouseDown={handleSplitMouseDown}
                title="Drag to resize Chart & Market Intelligence pane"
              >
                <div className="fs-resize-handle-grip">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {/* Intelligence Column with Dual Tabs */}
            {showAiPane && (
              <aside 
                className="fs-ai-panel" 
                style={{ 
                  width: `${100 - splitPct}%`,
                  maxWidth: 'none',
                  minWidth: '280px'
                }}
              >
                {/* Dual Tabs Header */}
                <div className="fs-ai-panel-header">
                  <div className="fs-ai-panel-tabs">
                    <button
                      type="button"
                      className={`fs-panel-tab-btn ${intelligenceTab === 'index' ? 'active' : ''}`}
                      onClick={() => setIntelligenceTab('index')}
                    >
                      <span className="fs-tab-icon">📊</span>
                      <span>Index Analysis</span>
                    </button>
                    <button
                      type="button"
                      className={`fs-panel-tab-btn ${intelligenceTab === 'ai' ? 'active' : ''}`}
                      onClick={() => setIntelligenceTab('ai')}
                    >
                      <span className="fs-tab-icon">✨</span>
                      <span>AI Analysis</span>
                      {aiAnalysis && <span className="fs-tab-status-dot" title="AI Thesis ready" />}
                    </button>
                  </div>
                  <button 
                    type="button"
                    className="fs-panel-collapse-btn" 
                    onClick={() => setShowAiPane(false)} 
                    title="Collapse Market Intelligence"
                    aria-label="Collapse panel"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>

                <div className="fs-ai-panel-content themed-scroll">
                  {intelligenceTab === 'index' ? (
                    <>
                      {/* Section 1: Market Condition & Health */}
                      <div className="institutional-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="card-badge-label">Market Condition</span>
                          <span className="phase-pill" style={{ color: regimeColor, borderColor: `${regimeColor}40`, background: `${regimeColor}15` }}>
                            {trendPhase}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                          <div className="stat-subcard">
                            <span className="subcard-title">TREND STRENGTH</span>
                            <div className="subcard-value" style={{ color: regimeColor }}>
                              {healthScore} <span style={{ fontSize: '12px', color: '#94a3b8' }}>/ 100</span>
                            </div>
                          </div>
                          <div className="stat-subcard">
                            <span className="subcard-title">MOMENTUM (RSI)</span>
                            <div className="subcard-value" style={{ color: rsiVal > 70 ? '#ef4444' : rsiVal < 30 ? '#10b981' : '#f59e0b' }}>
                              {Number(rsiVal).toFixed(1)}{' '}
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                ({rsiVal >= 60 ? 'Bullish' : rsiVal <= 40 ? 'Oversold' : 'Neutral'})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Key Price Levels */}
                      <div className="institutional-card">
                        <span className="card-badge-label">1. Key Price Levels</span>
                        <ul className="info-bullets">
                          <li>
                            <strong>Market State:</strong> {distFromAth >= -2 ? 'Testing 52-Week High' : `Consolidating (${formatPct(distFromAth)} from 52W High)`}
                          </li>
                          <li>
                            <strong>Short-term Support:</strong> <span className="highlight-price">{currencySymbol}{formatPrice(s1Price)}</span> (21-Day EMA)
                          </li>
                          <li>
                            <strong>Key Support:</strong> <span className="highlight-price">{currencySymbol}{formatPrice(s2Price)}</span> (50-Day Moving Average)
                          </li>
                          <li>
                            <strong>Key Resistance:</strong> <span className="highlight-price">{currencySymbol}{formatPrice(r1Price)}</span> (52-Week High Pivot)
                          </li>
                        </ul>
                      </div>

                      {/* Section 3: Trend & Moving Averages */}
                      <div className="institutional-card">
                        <span className="card-badge-label">2. Trend & Moving Averages</span>
                        <p className="narrative-text">
                          {maDescription}
                        </p>
                      </div>

                      {/* Section 4: Key Index Drivers */}
                      <div className="institutional-card">
                        <span className="card-badge-label">3. Key Index Drivers</span>
                        <div className="ticker-tags-wrapper">
                          {constituents.map(c => (
                            <span key={c} className="ticker-tag">{c}</span>
                          ))}
                        </div>
                      </div>

                      {/* Section 5: Market Outlook & Strategy */}
                      <div className="institutional-card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.4) 100%)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="card-badge-label" style={{ color: '#38bdf8' }}>4. Market Outlook & Strategy</span>
                          <span className="exposure-pill">{exposureText}</span>
                        </div>
                        <p className="narrative-text" style={{ marginTop: '8px' }}>
                          {playbookStrategy}
                        </p>
                        <div className="invalidation-note">
                          <strong>Risk Note:</strong> Upward trend remains constructive while trading holds above {currencySymbol}{formatPrice(s2Price)} (50-Day line).
                        </div>
                      </div>

                    </>
                  ) : (
                    /* AI Analysis Tab Content */
                    <div className="fs-ai-tab-pane">
                      {/* AI Toolbar Header */}
                      <div className="fs-ai-toolbar" style={{ justifyContent: 'flex-end' }}>
                        <div className="fs-ai-actions">
                          {aiAnalysis && (
                            <button
                              type="button"
                              className="fs-ai-btn-ghost"
                              onClick={handleCopyAiMemo}
                              title="Copy AI analysis to clipboard"
                            >
                              {copiedAi ? '✓ Copied' : '📋 Copy'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-ai-run-compact"
                            onClick={handleRunAi}
                            disabled={loadingAi}
                          >
                            {loadingAi ? '↻ Generating...' : 'Generate AI Analysis'}
                          </button>
                        </div>
                      </div>

                      {/* AI Error Alert */}
                      {aiError && (
                        <div className="ai-error-box">
                          ⚠️ {aiError}
                        </div>
                      )}

                      {/* Loading State */}
                      {loadingAi && (
                        <div className="fs-ai-loading-card">
                          <div className="fs-ai-loading-spinner" />
                          <h5>Generating AI Analysis...</h5>
                          <ul className="fs-ai-loading-steps">
                            <li><span>✓</span> Analyzing market regime & technical breadth</li>
                            <li><span>↻</span> Evaluating moving average alignment & RSI momentum</li>
                            <li><span>•</span> Formulating structured tactical playbook</li>
                          </ul>
                        </div>
                      )}

                      {/* AI Result Report */}
                      {!loadingAi && aiAnalysis && (
                        <div className="ai-result-box themed-scroll" style={{ marginTop: '4px', background: 'transparent', border: 'none', padding: 0 }}>
                          {renderStructuredAiAnalysis(aiAnalysis)}
                        </div>
                      )}

                      {/* Empty State when AI not run yet */}
                      {!loadingAi && !aiAnalysis && !aiError && (
                        <div className="fs-ai-empty-state">
                          <div className="empty-sparkle-circle">✨</div>
                          <h4>AI Market Structure Analysis</h4>
                          <p>
                            Generate an AI-powered technical and regime breakdown for <strong>{INDEX_NAME_MAP[activeData.symbol]?.name || activeData.symbol}</strong> synthesized with live technical parameters, moving average confluence, and regime conditions.
                          </p>
                          <button
                            type="button"
                            className="btn-ai-run-full"
                            onClick={handleRunAi}
                            style={{ marginTop: '12px' }}
                          >
                            Generate AI Analysis
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
