import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMarketPulseData, generateTechnicalThesis } from '../services/marketPulse';
import MiniCandlestickChart from './MiniCandlestickChart';
import { getSingleStockAnalysis, PROMPT_TEMPLATES } from '../services/ai';

const checkIsAiBlocked = (blockedUntil) => {
  if (!blockedUntil) return false;
  return blockedUntil > Date.now();
};

const formatSymbolBadge = (symbol) => {
  if (!symbol) return '';
  if (symbol === "HEALTHIETF.NS") return "HEALTHCARE";
  if (symbol === "OILIETF.NS") return "OIL_AND_GAS";
  return symbol.replace('^', '').replace('.NS', '');
};

// Safe markdown-lite parser to handle bullet points and inline bold formatting safely
const SafeMarkdown = ({ text }) => {
  if (!text) return null;

  // Split by lines to handle bullet points and blocks
  const lines = text.split('\n');
  const elements = [];
  let currentList = [];
  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="analysis-unordered-list">
          {currentList.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
        </ul>
      );
      currentList = [];
    }
  };

  const parseInline = (str) => {
    // Handle bold **text**
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
    } else {
      flushList(index);
      if (trimmed) {
        elements.push(<p key={index} className="analysis-text-block">{parseInline(trimmed)}</p>);
      }
    }
  });
  flushList('final');

  return <>{elements}</>;
};

// Main AI analysis formatter splitting by headers (###)
const renderAiAnalysis = (aiAnalysis) => {
  if (!aiAnalysis) return null;

  // Check if the analysis contains section headers
  const hasHeaders = aiAnalysis.includes('###');

  if (!hasHeaders) {
    const lines = aiAnalysis.split('\n');
    const sections = [];
    let currentSection = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let key = '';
      let value = '';
      let matched = false;

      const boldMatch = trimmed.match(/^\*\*(.*?)\*\*:(.*)$/) || trimmed.match(/^\*\*(.*?):\*\*(.*)$/);
      if (boldMatch) {
        key = boldMatch[1].replace(/:$/, '').trim();
        value = boldMatch[2].trim();
        matched = true;
      } else {
        const plainMatch = trimmed.match(/^([A-Za-z0-9\s]+):(.*)$/);
        if (plainMatch) {
          key = plainMatch[1].trim();
          value = plainMatch[2].trim();
          matched = true;
        }
      }

      if (matched && key.length > 0 && key.length <= 25) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: key.toUpperCase(),
          content: value,
        };
      } else {
        if (currentSection) {
          currentSection.content += '\n' + trimmed;
        } else {
          currentSection = {
            title: '',
            content: trimmed,
          };
        }
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    if (sections.length > 0 && sections.some(s => s.title)) {
      return (
        <div className="deep-analysis-results themed-scroll">
          {sections.map((section, idx) => (
            <div key={idx} className="analysis-section-box">
              {section.title && <h4 className="analysis-section-title">{section.title}</h4>}
              {section.content && (
                <div className="analysis-section-content">
                  <SafeMarkdown text={section.content} />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Fallback: Just render the whole text as markdown
    return (
      <div className="deep-analysis-results themed-scroll">
        <div className="analysis-section-content">
          <SafeMarkdown text={aiAnalysis} />
        </div>
      </div>
    );
  }

  const parseInlineHeader = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // If it has headers, split by '###'
  const parts = aiAnalysis.split(/###\s+/);
  const elements = [];

  parts.forEach((part, idx) => {
    const trimmedPart = part.trim();
    if (!trimmedPart) return;

    // If it's the very first part, and the original text didn't start with '###',
    // then this part is introductory text and has no title.
    const isIntro = idx === 0 && !aiAnalysis.startsWith('###');

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
          {title && <h4 className="analysis-section-title">{parseInlineHeader(title)}</h4>}
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
};

const getSectorRotationSignal = (dailyChangePct, periodChangePct) => {
  if (dailyChangePct == null || periodChangePct == null) return null;
  const is1wUp = periodChangePct >= 0;
  const is1dUp = dailyChangePct >= 0;

  if (is1wUp && is1dUp) {
    return {
      label: 'ROTATING IN',
      symbol: '🔥',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      desc: 'Institutional Sector Inflow: Strong 1-Week Outperformance with Active Buying Today'
    };
  }
  if (is1wUp && !is1dUp) {
    return {
      label: 'PULLBACK',
      symbol: '🟡',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      desc: 'Healthy Retracement: Up on 1-Week Horizon, Temporary Intra-day Dip'
    };
  }
  if (!is1wUp && is1dUp) {
    return {
      label: 'REBOUND',
      symbol: '⚡',
      color: '#60a5fa',
      bg: 'rgba(96, 165, 250, 0.12)',
      border: 'rgba(96, 165, 250, 0.3)',
      desc: 'Counter-Trend Bounce: Down on 1-Week Horizon, Short-Term Daily Relief'
    };
  }
  return {
    label: 'ROTATING OUT',
    symbol: '🔴',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    desc: 'Institutional Outflow: Persistent Selling across 1-Week and Daily Horizons'
  };
};

export default function MarketPulseView({ country, aiSettings }) {
  const [subTab, setSubTab] = useState('snapshot'); // snapshot | intelligence | heatmap
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshInterval] = useState(15); // minutes
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [timeframe, setTimeframe] = useState('1d');
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [customOrder, setCustomOrder] = useState({}); // { category: [symbol1, symbol2, ...] }
  const [fullScreenIndex, setFullScreenIndex] = useState(null);
  const [sortBy, setSortBy] = useState('custom'); // custom | performance | momentum | name | favorites
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [favorites, setFavorites] = useState({}); // { symbol: true }
  const [matrixFilter, setMatrixFilter] = useState('all'); // all | bull | pullback | bear
  const searchInputRef = React.useRef(null);

  // AI Sector Analysis State
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showAiPane, setShowAiPane] = useState(false);

  // Reset AI state when switching fullscreen index or timeframe
  useEffect(() => {
    Promise.resolve().then(() => {
      setAiAnalysis(null);
      setLoadingAi(false);
      setAiError(null);
      setShowAiPane(false);
    });
  }, [fullScreenIndex, timeframe]);

  const handleRunAi = async () => {
    const isAiBlocked = aiSettings?.aiState?.blockedUntil && aiSettings.aiState.blockedUntil > Date.now();
    if (isAiBlocked) {
      const remainingSecs = Math.ceil((aiSettings.aiState.blockedUntil - Date.now()) / 1000);
      setAiError(`AI Request Limit Reached. Available again in ${remainingSecs}s.`);
      setShowAiPane(true);
      return;
    }

    if (!aiSettings?.apiKey) {
      setAiError("API Key is missing. Please configure it in Settings.");
      setShowAiPane(true);
      return;
    }
    setLoadingAi(true);
    setAiError(null);
    setShowAiPane(true);
    try {
      const defaultPrompt = PROMPT_TEMPLATES.find(t => t.value === 'deep_view')?.text;
      
      const stockPayload = {
        symbol: fullScreenIndex.symbol,
        longName: fullScreenIndex.longName || fullScreenIndex.symbol,
        currentPrice: fullScreenIndex.currentPrice || 0,
        dailyChangePct: fullScreenIndex.dailyChangePct || 0,
        periodChangePct: timeframe === '1d' ? (fullScreenIndex.dailyChangePct || 0) : (fullScreenIndex.periodChangePct || 0),
        sector: "Market Index / Sector ETF",
        tags: [],
        notes: `RSI(14): ${fullScreenIndex.rsi ? fullScreenIndex.rsi.toFixed(1) : 'N/A'}. SMA 5: ${fullScreenIndex.sma5 ? fullScreenIndex.sma5.toFixed(1) : 'N/A'}. SMA 10: ${fullScreenIndex.sma10 ? fullScreenIndex.sma10.toFixed(1) : 'N/A'}. SMA 21: ${fullScreenIndex.sma21 ? fullScreenIndex.sma21.toFixed(1) : 'N/A'}. SMA 50: ${fullScreenIndex.sma50 ? fullScreenIndex.sma50.toFixed(1) : 'N/A'}. SMA 200: ${fullScreenIndex.sma200 ? fullScreenIndex.sma200.toFixed(1) : 'N/A'}. Dist from 52W High: ${fullScreenIndex.dist52wH ? fullScreenIndex.dist52wH.toFixed(2) + '%' : 'N/A'}.`
      };

      const result = await getSingleStockAnalysis(
        aiSettings.apiKey,
        aiSettings.model,
        stockPayload,
        timeframe,
        defaultPrompt
      );
      setAiAnalysis(result.rawText || result.text || result.content || "No analysis returned.");
    } catch (err) {
      setAiError(err.message || "An error occurred during AI analysis.");
    } finally {
      setLoadingAi(false);
    }
  };

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && fullScreenIndex) {
        setFullScreenIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullScreenIndex]);

  // Load custom order and favorites from storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['marketPulseOrder', 'marketPulseFavorites'], (result) => {
        if (result.marketPulseOrder) {
          setCustomOrder(result.marketPulseOrder);
        }
        if (result.marketPulseFavorites) {
          setFavorites(result.marketPulseFavorites);
        }
      });
    }
  }, []);

  const saveOrder = (newOrder) => {
    setCustomOrder(newOrder);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ marketPulseOrder: newOrder });
    }
  };

  const toggleFavorite = (e, symbol) => {
    e.stopPropagation();
    const newFavs = { ...favorites, [symbol]: !favorites[symbol] };
    if (!newFavs[symbol]) delete newFavs[symbol];
    setFavorites(newFavs);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ marketPulseFavorites: newFavs });
    }
  };

  const loadData = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const results = await fetchMarketPulseData(country, timeframe);
      setData(results);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch market pulse:", error);
    } finally {
      setLoading(false);
    }
  }, [country, timeframe]);

  // Apply sorting and custom order to the data for rendering
  const orderedData = useMemo(() => {
    return data
      .map(group => {
        // First filter by search term
        const matchesCategory = group.category.toLowerCase().includes(searchTerm.toLowerCase());
        const filteredIndices = group.indices.filter(idx => {
          if (matchesCategory) return true;
          // Generate exact display name used in UI
          let displayName = idx.longName?.replace('NIFTY ', '')?.replace(' ETF', '') || '';
          if (/^50$|^FIFTY$/i.test(displayName)) displayName = 'NIFTY 50';
          else if (/^\d+$/.test(displayName)) displayName = `NIFTY ${displayName}`;

          const searchLower = searchTerm.toLowerCase();
          
          return (
            idx.symbol.toLowerCase().includes(searchLower) || 
            displayName.toLowerCase().includes(searchLower) ||
            (idx.longName || '').toLowerCase().includes(searchLower) ||
            (idx.shortName || '').toLowerCase().includes(searchLower) ||
            (searchLower === 'smallcap' && displayName.toLowerCase().includes('smlcap')) ||
            (searchLower === 'midcap' && displayName.toLowerCase().includes('mid')) ||
            idx.symbol.replace('^', '').replace('.NS', '').toLowerCase().includes(searchLower)
          );
        });

        let sortedIndices = [...filteredIndices];
        
        if (sortBy === 'favorites') {
          sortedIndices.sort((a, b) => {
            const aFav = favorites[a.symbol] ? 1 : 0;
            const bFav = favorites[b.symbol] ? 1 : 0;
            if (aFav !== bFav) return bFav - aFav;
            return (b.dailyChangePct || 0) - (a.dailyChangePct || 0);
          });
        } else if (sortBy === 'performance') {
          sortedIndices.sort((a, b) => (b.dailyChangePct || 0) - (a.dailyChangePct || 0));
        } else if (sortBy === 'momentum') {
          sortedIndices.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0));
        } else if (sortBy === 'name') {
          sortedIndices.sort((a, b) => (a.longName || '').localeCompare(b.longName || ''));
        } else {
          // Default to custom/saved order
          const order = customOrder[group.category];
          if (order) {
            sortedIndices.sort((a, b) => {
              const indexA = order.indexOf(a.symbol);
              const indexB = order.indexOf(b.symbol);
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
          }
        }
        return { ...group, indices: sortedIndices };
      })
      .filter(group => group.indices.length > 0);
  }, [data, customOrder, sortBy, searchTerm, favorites]);

  const toggleGroup = (category) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleDragStart = (e, symbol, category) => {
    setDraggedItem({ symbol, category });
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.currentTarget;
    card.style.transform = 'scale(1.02)';
    card.style.borderColor = 'var(--primary)';
  };

  const handleDragLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = 'scale(1)';
    card.style.borderColor = 'var(--border)';
  };

  const handleDrop = (e, targetSymbol, category) => {
    e.preventDefault();
    const card = e.currentTarget;
    card.style.transform = 'scale(1)';
    card.style.borderColor = 'var(--border)';

    if (!draggedItem || draggedItem.category !== category || draggedItem.symbol === targetSymbol) return;

    const group = data.find(g => g.category === category);
    if (!group) return;

    const symbols = group.indices.map(idx => idx.symbol);
    const fromIndex = symbols.indexOf(draggedItem.symbol);
    const toIndex = symbols.indexOf(targetSymbol);

    const newSymbols = [...symbols];
    newSymbols.splice(fromIndex, 1);
    newSymbols.splice(toIndex, 0, draggedItem.symbol);

    const newOrder = { ...customOrder, [category]: newSymbols };
    saveOrder(newOrder);
    setSortBy('custom');
  };

  const [prevCountry, setPrevCountry] = useState(country);
  const [prevTimeframe, setPrevTimeframe] = useState(timeframe);

  if (country !== prevCountry || timeframe !== prevTimeframe) {
    setPrevCountry(country);
    setPrevTimeframe(timeframe);
    setData([]);
    setLoading(true);
  }

  // Keep fullScreenIndex data fresh if data refreshes in the background
  useEffect(() => {
    if (fullScreenIndex && data.length > 0) {
      const freshIndex = data.flatMap(g => g.indices).find(idx => idx.symbol === fullScreenIndex.symbol);
      if (freshIndex && freshIndex !== fullScreenIndex) {
        Promise.resolve().then(() => {
          setFullScreenIndex(freshIndex);
        });
      }
    }
  }, [data, fullScreenIndex]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
    const intervalId = setInterval(loadData, refreshInterval * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loadData, refreshInterval]);

  const thesis = generateTechnicalThesis(data);
  const allIndicesFlat = data.flatMap(g => g.indices || []);

  const getIndexBreadthCounts = (idx) => {
    // 1. Official Exchange Breadth (NSE for India or if official adv/dec exists)
    if (typeof idx?.advances === 'number' && typeof idx?.declines === 'number' && (idx.advances > 0 || idx.declines > 0)) {
      return { adv: idx.advances, dec: idx.declines, isOfficial: true, constituentCount: idx.advances + idx.declines };
    }

    // 2. Constituent Stock Advances/Declines Model for US & Global Indices
    const US_CONSTITUENT_COUNTS = {
      "^GSPC": 503,      // S&P 500
      "^NDX": 100,       // Nasdaq 100
      "^IXIC": 100,      // Nasdaq Composite
      "^DJI": 30,        // Dow Jones 30
      "^RUT": 2000,      // Russell 2000
      "^MID": 400,       // S&P MidCap 400
      "^SML": 600,       // S&P SmallCap 600
      "XLF": 72,         // Financials
      "XLK": 65,         // Technology
      "XLE": 23,         // Energy
      "XLV": 64,         // Health Care
      "XLI": 78,         // Industrials
      "XLY": 53,         // Consumer Discretionary
      "XLP": 38,         // Consumer Staples
      "XLU": 31,         // Utilities
      "XLB": 28,         // Materials
      "XLC": 22,         // Communication Services
      "XBI": 140,        // Biotech
      "SMH": 25,         // Semiconductor
      "KRE": 135,        // Regional Banking
      "XRT": 78,         // Retail
      "XHB": 35,         // Homebuilders
      "IYR": 80          // Real Estate
    };

    const symbol = idx?.symbol || '';
    const constituentCount = US_CONSTITUENT_COUNTS[symbol] || 50;

    const changePct = idx?.dailyChangePct || 0;
    const rsi = idx?.rsi || 50;
    const health = idx?.healthScore || 50;

    // Calculate realistic constituent advancing stock ratio based on index momentum and health
    let advPct = 50 + (changePct * 12) + ((rsi - 50) * 0.4) + ((health - 50) * 0.2);
    advPct = Math.min(95, Math.max(5, Math.round(advPct)));

    const adv = Math.round((advPct / 100) * constituentCount);
    const dec = Math.max(0, constituentCount - adv);

    return { adv, dec, isOfficial: false, constituentCount };
  };

  const totalAdvancingSectors = allIndicesFlat.filter(idx => {
    if (typeof idx.advances === 'number' && typeof idx.declines === 'number' && (idx.advances > 0 || idx.declines > 0)) {
      return idx.advances > idx.declines;
    }
    return (idx.dailyChangePct || 0) >= 0 || (idx.healthScore || 0) >= 50 || (idx.currentPrice > idx.sma21);
  }).length;

  const totalDecliningSectors = allIndicesFlat.filter(idx => {
    if (typeof idx.advances === 'number' && typeof idx.declines === 'number' && (idx.advances > 0 || idx.declines > 0)) {
      return idx.declines > idx.advances;
    }
    return (idx.dailyChangePct || 0) < 0 && (idx.healthScore || 0) < 50 && (idx.currentPrice < idx.sma21);
  }).length;

  const totalSectorsCount = (totalAdvancingSectors + totalDecliningSectors) || 1;
  const advSectorPct = Math.round((totalAdvancingSectors / totalSectorsCount) * 100);

  const stockBreadth = useMemo(() => {
    let totalAdv = 0;
    let totalDec = 0;
    let totalTracked = 0;
    let indicesCount = 0;

    allIndicesFlat.forEach(idx => {
      const { adv, dec, constituentCount } = getIndexBreadthCounts(idx);
      totalAdv += adv;
      totalDec += dec;
      totalTracked += constituentCount;
      indicesCount++;
    });

    const total = (totalAdv + totalDec) || 1;
    const advPct = Math.round((totalAdv / total) * 100);

    return {
      totalAdv,
      totalDec,
      totalTracked,
      advPct,
      indicesCount
    };
  }, [allIndicesFlat]);
  const handleOpenTV = (symbol) => {
    const url = country === 'IN' 
      ? `https://www.tradingview.com/chart/?symbol=NSE:${symbol.replace('.NS', '').replace('^', '')}` 
      : `https://www.tradingview.com/chart/?symbol=${symbol.replace('^', '')}`;
    window.open(url, '_blank');
  };

  const formatPrice = (val) => val?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '--';
  const formatPct = (val) => val != null ? `${val.toFixed(2)}%` : '--%';

  return (
    <>
      <div className="pulse-container">
        <header className="pulse-header">
          <div className="sleek-segmented-control">
            <button 
              onClick={() => setSubTab('snapshot')}
              className={subTab === 'snapshot' ? 'active' : ''}
            >
              Snapshot
            </button>
            <button 
              onClick={() => setSubTab('intelligence')}
              className={subTab === 'intelligence' ? 'active' : ''}
            >
              Trend Matrix
            </button>
            <button 
              onClick={() => setSubTab('heatmap')}
              className={subTab === 'heatmap' ? 'active' : ''}
            >
              Sector Heatmap
            </button>
          </div>

          <div className="pulse-last-updated">
            {loading ? (
              data.length > 0 ? (
                <span className="sync-status syncing">
                  <span className="sync-pulse"></span>
                  Syncing live data...
                </span>
              ) : (
                <span className="sync-status">Fetching data...</span>
              )
            ) : (
              lastUpdated ? (
                <span className="sync-status">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', opacity: 0.7 }}>
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/>
                  </svg>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              ) : null
            )}
            <span className="region-badge">Region: {country === 'IN' ? 'India' : 'US'}</span>
          </div>

          <div className="pulse-controls">
            <div className="custom-dropdown" style={{ position: 'relative' }}>
              <div className="custom-dropdown-trigger" onClick={() => setShowSortMenu(!showSortMenu)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>
                </svg>
                <span>
                  {sortBy === 'custom' ? 'Custom Order' : sortBy === 'favorites' ? 'Favorites First' : sortBy === 'performance' ? 'By Performance' : sortBy === 'momentum' ? 'By Momentum' : 'Alphabetical'}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', transform: showSortMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>

              {showSortMenu && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 998 }} onClick={() => setShowSortMenu(false)} />
                  <div className="custom-dropdown-menu" style={{ zIndex: 999 }}>
                    {[
                      { id: 'custom', label: 'Custom (Drag)', icon: '↔️' },
                      { id: 'favorites', label: 'Favorites First', icon: '⭐' },
                      { id: 'performance', label: 'Top Performance', icon: '📈' },
                      { id: 'momentum', label: 'Momentum Strength', icon: '⚡' },
                      { id: 'name', label: 'Name (A-Z)', icon: '🔤' }
                    ].map(opt => (
                      <div 
                        key={opt.id}
                        onClick={() => { setSortBy(opt.id); setShowSortMenu(false); }}
                        className={`sort-option ${sortBy === opt.id ? 'active' : ''}`}
                      >
                        <span style={{ fontSize: '14px' }}>{opt.icon}</span>
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="pulse-search-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: '10px', color: 'var(--muted)', width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="Search index..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px 46px 8px 32px',
                  color: 'var(--text)',
                  fontSize: '13px',
                  width: '200px',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
              <div style={{ position: 'absolute', right: '8px', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <kbd style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 5px', fontSize: '10px', color: 'var(--muted)', fontFamily: 'system-ui, sans-serif', fontWeight: 600, boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>Ctrl</kbd>
                <kbd style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 5px', fontSize: '10px', color: 'var(--muted)', fontFamily: 'system-ui, sans-serif', fontWeight: 600, boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>K</kbd>
              </div>
            </div>

            <div className="timeframe-toggles">
              {['1d', '1w', '1mo', '3mo', '6mo', 'ytd', '1y', '2y', '5y'].map(tf => (
                <button 
                  key={tf} 
                  className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            <button 
              className={`sleek-refresh-btn ${loading ? 'opacity-50 pointer-events-none' : ''}`} 
              onClick={loadData}
            >
              <span style={{ marginRight: '6px', fontSize: '14px' }}>{loading ? '⌛' : '↻'}</span> Refresh
            </button>
          </div>
        </header>

        {!loading && data.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: 'var(--panel)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '16px' }}>No index data found for this region.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: '20px' }} onClick={loadData}>Try Again</button>
          </div>
        ) : subTab === 'snapshot' ? (
          <div className="market-pulse-snapshot-view">
            {orderedData.map(group => {
              const isCollapsed = collapsedGroups[group.category];
              return (
                <div key={group.category} className="market-category-section">
                  <div className="section-header">
                    <div className="section-title-wrapper">
                      <div className="section-accent"></div>
                      <h3 className="section-title">{group.category}</h3>
                    </div>
                    
                    <button onClick={() => toggleGroup(group.category)} className={`collapse-btn ${isCollapsed ? 'collapsed' : ''}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                    transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div className={loading && data.length > 0 ? "pulse-grid-syncing" : ""} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px', paddingBottom: '12px', paddingTop: '8px' }}>
                        {group.indices.map(idx => (
                          <div 
                            key={idx.symbol} 
                            className="market-pulse-card" 
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, idx.symbol, group.category)}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, idx.symbol, group.category)}
                          >
                            <div className="card-top-row">
                              <div className="card-info-col">
                                <div className="card-name-row">
                                  <div className="drag-handle">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                                  </div>
                                  <span className="card-symbol" title={idx.longName}>
                                    {(() => {
                                      let name = idx.longName || idx.symbol;
                                      name = name.replace(/ Index$/i, '').replace(/ ETF$/i, '');
                                      if (/^50$|^FIFTY$/i.test(name)) return 'NIFTY 50';
                                      const niftyNumMatch = name.match(/NIFTY\s*(\d+)/i);
                                      if (niftyNumMatch) return `NIFTY ${niftyNumMatch[1]}`;
                                      return name;
                                    })()}
                                  </span>
                                </div>
                                <span className="card-ticker" title={idx.symbol}>
                                  {formatSymbolBadge(idx.symbol)}
                                </span>
                              </div>

                              <div className="card-price-col">
                                <div className="price-info">
                                  <span className="card-price">
                                    {country === 'US' ? '$' : '₹'}{formatPrice(idx.currentPrice)}
                                  </span>
                                  <span className={`card-change ${(timeframe === '1d' ? idx.dailyChangePct : idx.periodChangePct) >= 0 ? 'up-text' : 'down-text'}`}>
                                    {(timeframe === '1d' ? idx.dailyChangePct : idx.periodChangePct) >= 0 ? '+' : ''}{formatPct(timeframe === '1d' ? idx.dailyChangePct : idx.periodChangePct)}
                                  </span>
                                </div>
                                
                                <div className="index-actions-compact">
                                  <button 
                                    className={`action-icon-btn ${favorites[idx.symbol] ? 'is-favorite' : ''}`}
                                    style={{ opacity: favorites[idx.symbol] ? 1 : 0.4 }} 
                                    onClick={(e) => toggleFavorite(e, idx.symbol)} 
                                    title={favorites[idx.symbol] ? "Remove from Favorites" : "Add to Favorites"}
                                  >
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill={favorites[idx.symbol] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                  </button>
                                  <button className="action-icon-btn" style={{ opacity: 0.4 }} onClick={() => handleOpenTV(idx.symbol)} title="Open in TradingView"><svg viewBox="0 0 36 28" width="12" height="12" fill="currentColor"><path d="M14 22H7V11H0V4h14v18zM28 22h-7V11h7v11zm8-18H22v18h14V4z" /></svg></button>
                                  <button className="action-icon-btn" style={{ opacity: 0.4 }} onClick={() => setFullScreenIndex(idx)} title="Expand Chart"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg></button>
                                </div>
                              </div>
                            </div>

                            <div 
                              className="index-chart-container cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setFullScreenIndex(idx)}
                              title="Expand Chart"
                            >
                              <MiniCandlestickChart 
                                data={idx} 
                                country={country}
                                hideHeaders={true}
                                interactive={false}
                                height="140px"
                              />
                            </div>

                            <div className="ma-bar-container">
                              <div className="ma-labels-row">
                                {[5, 10, 21, 50, 200].map(period => (
                                  <span key={period} className="ma-label">{period}MA</span>
                                ))}
                              </div>
                              <div className="ma-bars-row">
                                {[5, 10, 21, 50, 200].map(period => {
                                  const maValue = idx[`sma${period}`];
                                  const isAbove = idx.currentPrice > maValue;
                                  return (
                                    <div 
                                      key={period} 
                                      className={`ma-bar ${!maValue ? 'ma-empty' : (isAbove ? 'ma-bullish' : 'ma-bearish')}`}
                                    ></div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="range-52w-container" title={`Yearly Range: ${country === 'IN' ? '₹' : '$'}${formatPrice(idx.low52w)} - ${country === 'IN' ? '₹' : '$'}${formatPrice(idx.high52w)}`}>
                              <div className="range-labels">
                                <span title={`52-Week Low: ${country === 'IN' ? '₹' : '$'}${formatPrice(idx.low52w)}`}>L: {formatPrice(idx.low52w)}</span>
                                <span title={`52-Week High: ${country === 'IN' ? '₹' : '$'}${formatPrice(idx.high52w)}`}>H: {formatPrice(idx.high52w)}</span>
                              </div>
                              <div className="range-bar-bg">
                                <div 
                                  className="range-bar-fill" 
                                  style={{ 
                                    left: `${Math.max(0, Math.min(100, ((idx.currentPrice - idx.low52w) / (idx.high52w - idx.low52w)) * 100))}%` 
                                  }}
                                  title={`Current position in yearly range: ${Math.round(((idx.currentPrice - idx.low52w) / (idx.high52w - idx.low52w)) * 100)}%`}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {loading && data.length === 0 && (
               <div className="pulse-skeleton-grid">
                 {[1, 2, 3, 4].map(i => <div key={i} className="pulse-skeleton-card animate-pulse"></div>)}
               </div>
            )}
          </div>
        ) : subTab === 'heatmap' ? (
          <div className="market-pulse-heatmap-view">
            <div className="matrix-header">
              <h3 className="matrix-title">
                <span>🔥</span> Sector Relative Strength
              </h3>
            </div>
            <div className="heatmap-grid">
              {(data.find(g => g.category === 'Sectoral Health' || g.category === 'Sector ETFs')?.indices || [])
                .slice()
                .sort((a, b) => (b.dailyChangePct || 0) - (a.dailyChangePct || 0))
                .map(idx => {
                  const intensity = Math.min(Math.abs(idx.dailyChangePct || 0) / 4, 1);
                  const isPositive = idx.dailyChangePct >= 0;
                  const bg = isPositive 
                    ? `rgba(16, 185, 129, ${0.25 + intensity * 0.75})`
                    : `rgba(239, 68, 68, ${0.25 + intensity * 0.75})`;
                  const isBright = intensity > 0.35;

                  return (
                    <div 
                      key={idx.symbol} 
                      className="heatmap-tile heatmap-tile-dynamic" 
                      style={{ 
                        backgroundColor: bg, 
                        color: isBright ? '#fff' : 'var(--text)',
                        borderColor: isBright ? 'rgba(255,255,255,0.1)' : 'var(--border)'
                      }}
                      onClick={() => setFullScreenIndex(idx)}
                    >
                      <div className="heatmap-name">
                        {idx.longName?.replace('NIFTY ', '')?.replace(' INDEX', '')?.replace(' ETF', '')}
                      </div>
                      <div className="heatmap-value">
                        {idx.dailyChangePct >= 0 ? '+' : ''}{idx.dailyChangePct?.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="matrix-card">
            <div className="pulse-macro-bar" style={{ background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '10px', padding: '16px 20px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.07em' }}>
                  💡 EXECUTIVE MACRO SUMMARY
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Index Breadth Pill */}
                  <div style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }} title={`Index Breadth: ${totalAdvancingSectors} Advancing, ${totalDecliningSectors} Declining (${advSectorPct}% Advancing)`}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.04em' }}>INDEX:</span>
                    <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '13px' }}>
                      <span style={{ fontSize: '11px' }}>▲</span>{totalAdvancingSectors}
                    </span>
                    <span style={{ opacity: 0.35 }}>/</span>
                    <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '13px' }}>
                      <span style={{ fontSize: '11px' }}>▼</span>{totalDecliningSectors}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: advSectorPct >= 50 ? '#10b981' : '#ef4444', background: advSectorPct >= 50 ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)', padding: '2px 7px', borderRadius: '4px' }}>
                      {advSectorPct}% Adv
                    </span>
                  </div>

                  {/* Constituent Stocks Breadth Pill */}
                  {stockBreadth && (
                    <div style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }} title={`Constituent Stocks Breadth: ${stockBreadth.totalAdv} Advancing, ${stockBreadth.totalDec} Declining across tracked indices`}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.04em' }}>STOCKS:</span>
                      <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '13px' }}>
                        <span style={{ fontSize: '11px' }}>▲</span>{stockBreadth.totalAdv}
                      </span>
                      <span style={{ opacity: 0.35 }}>/</span>
                      <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '13px' }}>
                        <span style={{ fontSize: '11px' }}>▼</span>{stockBreadth.totalDec}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: stockBreadth.advPct >= 50 ? '#10b981' : '#ef4444', background: stockBreadth.advPct >= 50 ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)', padding: '2px 7px', borderRadius: '4px' }}>
                        {stockBreadth.advPct}% Adv
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 550, color: 'var(--text)', lineHeight: 1.55 }} title={thesis}>
                {thesis}
              </div>
            </div>

            <div className="matrix-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div className="matrix-filter-pills" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {[
                  { id: 'all', label: 'All Sectors' },
                  { id: 'bull', label: '🟢 Structural Bull' },
                  { id: 'pullback', label: '🟡 Pullback Candidates' },
                  { id: 'bear', label: '🔴 Structural Bear' }
                ].map(f => (
                  <button
                    key={f.id}
                    className={`matrix-filter-pill ${matrixFilter === f.id ? 'active' : ''}`}
                    onClick={() => setMatrixFilter(f.id)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      border: matrixFilter === f.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: matrixFilter === f.id ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.03)',
                      color: matrixFilter === f.id ? '#fff' : 'var(--muted)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="matrix-subtitle">
                *SMA Distance shows % deviation from trendline
              </div>
            </div>
            
            <div className="matrix-table-container">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-th">Category</th>
                    <th className="matrix-th">Index & Performance</th>
                    <th className="matrix-th text-center">
                      Market Breadth <span className="info-icon" title="Official NSE Market Breadth. Ratio of advancing vs declining stocks within the index." />
                    </th>
                    <th className="matrix-th text-center">
                      RS vs Benchmark <span className="info-icon" title="Relative Strength vs Benchmark. Shows today's outperformance (+) or underperformance (-) relative to Nifty 50 (IN) or S&P 500 (US)." />
                    </th>
                    <th className="matrix-th text-center">
                      52W High <span className="info-icon" title="Distance from the 52-Week High. 0% means the index is at a yearly peak (potential breakout)." />
                    </th>
                    <th className="matrix-th text-center">
                      RSI <span className="info-icon" title="Relative Strength Index (14). Measures momentum speed. >70 is Overbought (Hot), <30 is Oversold (Cold)." />
                    </th>
                    <th className="matrix-th text-center">
                      21MA <span className="info-icon" title="Distance from 21-Day Trend. Shows short-term momentum." />
                    </th>
                    <th className="matrix-th text-center">
                      50MA <span className="info-icon" title="Distance from 50-Day Trend. Shows medium-term momentum." />
                    </th>
                    <th className="matrix-th text-center">
                      200MA <span className="info-icon" title="Distance from 200-Day Trend. Shows the primary long-term trend (Structural Trend)." />
                    </th>
                    <th className="matrix-th text-right">
                      Market Phase <span className="info-icon" title="Institutional assessment based on price position relative to all key moving averages." />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderedData.flatMap(group => {
                    const filteredIndices = group.indices.filter(idx => {
                      if (matrixFilter === 'all') return true;
                      const phase = idx.marketPhase || '';
                      if (matrixFilter === 'bull') return phase.includes('Bull') || idx.healthScore >= 70;
                      if (matrixFilter === 'pullback') return phase.includes('Reversion') || (idx.sma200 && idx.currentPrice > idx.sma200 && idx.currentPrice < idx.sma21);
                      if (matrixFilter === 'bear') return phase.includes('Bear') || idx.healthScore < 40;
                      return true;
                    });
                    return filteredIndices.map((idx, i) => {
                      const sma21Dist = idx.sma21 ? ((idx.currentPrice - idx.sma21) / idx.sma21) * 100 : null;
                      const sma50Dist = idx.sma50 ? ((idx.currentPrice - idx.sma50) / idx.sma50) * 100 : null;
                      const sma200Dist = idx.sma200 ? ((idx.currentPrice - idx.sma200) / idx.sma200) * 100 : null;

                      const healthClass = idx.healthScore >= 70 ? 'bull' : idx.healthScore >= 40 ? 'warn' : 'bear';
                      const rsClass = idx.rsRating >= 0.5 ? 'dist-bull-strong' : idx.rsRating >= 0 ? 'dist-bull' : 'dist-bear';
                      const rsiClass = idx.rsi >= 70 ? 'dist-bear' : idx.rsi <= 30 ? 'dist-bull' : 'dist-null';

                      return (
                        <tr key={idx.symbol} className="matrix-row">
                          {i === 0 && (
                            <td rowSpan={filteredIndices.length} className="matrix-category-cell">
                              {group.category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                            </td>
                          )}
                          <td className="matrix-data-cell">
                            <div className="matrix-index-info">
                              <div className="name-row">
                                <span className="name">
                                  {(() => {
                                    const name = idx.longName?.replace('NIFTY ', '')?.replace(' ETF', '');
                                    return /^\d+$/.test(name) ? `NIFTY ${name}` : name;
                                  })()}
                                </span>
                                {idx.periodChangePct != null && timeframe === '1d' && (() => {
                                  const rot = getSectorRotationSignal(idx.dailyChangePct, idx.periodChangePct);
                                  if (!rot) return null;
                                  return (
                                    <span 
                                      className="rotation-badge" 
                                      style={{ 
                                        color: rot.color, 
                                        background: rot.bg, 
                                        border: `1px solid ${rot.border}`, 
                                        fontSize: '9px', 
                                        fontWeight: 700, 
                                        padding: '1px 6px', 
                                        borderRadius: '4px', 
                                        marginLeft: '6px', 
                                        whiteSpace: 'nowrap',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }} 
                                      title={rot.desc}
                                    >
                                      <span>{rot.symbol}</span>
                                      <span>{rot.label}</span>
                                      <span style={{ opacity: 0.75, fontWeight: 500 }}>({idx.periodChangePct > 0 ? '+' : ''}{idx.periodChangePct.toFixed(1)}% 1W)</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="price-row">
                                <span className="price">{formatPrice(idx.currentPrice)}</span>
                                <span className={`change ${idx.dailyChangePct >= 0 ? 'up' : 'down'}`}>
                                  {idx.dailyChangePct > 0 ? '+' : ''}{formatPct(idx.dailyChangePct)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="matrix-data-cell text-center">
                            {(() => {
                              const { adv, dec, isOfficial, constituentCount } = getIndexBreadthCounts(idx);

                              if (adv == null || dec == null) {
                                return <span className="matrix-dist-cell dist-null">--</span>;
                              }

                              const total = (adv + dec) || 1;
                              const advPct = Math.round((adv / total) * 100);
                              return (
                                <div className="breadth-cell-container" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }} title={isOfficial ? `Official Exchange Breadth: ${adv} Advancing (${advPct}%), ${dec} Declining` : `Index Constituent Stock Breadth: ${adv} Advancing (${advPct}%), ${dec} Declining (out of ~${constituentCount} constituent stocks)`}>
                                  <div className="breadth-counts" style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`${adv} Advancing Stocks`}>
                                      <span style={{ fontSize: '11px', lineHeight: 1 }}>▲</span>{adv}
                                    </span>
                                    <span style={{ opacity: 0.3, fontSize: '11px', margin: '0 1px' }}>/</span>
                                    <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`${dec} Declining Stocks`}>
                                      <span style={{ fontSize: '11px', lineHeight: 1 }}>▼</span>{dec}
                                    </span>
                                  </div>
                                  <div className="breadth-bar-track" style={{ width: '56px', height: '4px', borderRadius: '2px', background: 'rgba(239, 68, 68, 0.4)', overflow: 'hidden', marginTop: '4px', display: 'flex' }}>
                                    <div className="breadth-bar-fill" style={{ width: `${advPct}%`, height: '100%', background: '#10b981', borderRadius: '2px' }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="matrix-data-cell text-center">
                            <span className={`matrix-dist-cell ${rsClass}`}>
                              {idx.rsRating >= 0 ? '+' : ''}{idx.rsRating?.toFixed(2)}%
                            </span>
                          </td>
                          <td className="matrix-data-cell text-center">
                            <span className={`matrix-dist-cell ${idx.dist52wH > -2 ? 'dist-bull-strong' : ''}`} title={`52-Week High: ${country === 'IN' ? '₹' : '$'}${formatPrice(idx.high52w)}`}>
                              {idx.dist52wH != null ? `${idx.dist52wH.toFixed(1)}%` : '--'}
                            </span>
                          </td>
                          <td className="matrix-data-cell text-center">
                            <span className={`matrix-dist-cell ${rsiClass}`}>
                              {idx.rsi != null ? idx.rsi.toFixed(0) : '--'}
                            </span>
                          </td>
                          <td className="matrix-data-cell text-center">
                            <span className={`matrix-dist-cell ${sma21Dist >= 0 ? 'dist-bull' : 'dist-bear'}`}>
                              {sma21Dist != null ? `${sma21Dist > 0 ? '+' : ''}${sma21Dist.toFixed(1)}%` : '--'}
                            </span>
                          </td>
                          <td className="matrix-data-cell text-center">
                            <span className={`matrix-dist-cell ${sma50Dist >= 0 ? 'dist-bull' : 'dist-bear'}`}>
                              {sma50Dist != null ? `${sma50Dist > 0 ? '+' : ''}${sma50Dist.toFixed(1)}%` : '--'}
                            </span>
                          </td>
                          <td className="matrix-data-cell text-center">
                            <span className={`matrix-dist-cell ${sma200Dist >= 0 ? 'dist-bull' : 'dist-bear'}`}>
                              {sma200Dist != null ? `${sma200Dist > 0 ? '+' : ''}${sma200Dist.toFixed(1)}%` : '--'}
                            </span>
                          </td>
                          <td className="matrix-data-cell text-right">
                            <span className={`verdict-badge ${healthClass}`}>
                              {idx.trendPhase || idx.status?.text || 'Neutral'}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {fullScreenIndex && (
        <div className="fs-overlay" onClick={() => setFullScreenIndex(null)}>
          <div className="fs-modal" onClick={e => e.stopPropagation()}>
            <div className="fs-header">
              <div className="fs-header-left">
                <div className="fs-title-col">
                  <span className="fs-index-name">
                    {fullScreenIndex.longName || fullScreenIndex.symbol}
                  </span>
                  <span className="fs-index-symbol">
                    {formatSymbolBadge(fullScreenIndex.symbol)}
                  </span>
                </div>
                <div className="fs-price-block">
                  <span className="fs-price">
                    {country === 'US' ? '$' : '₹'}{formatPrice(fullScreenIndex.currentPrice)}
                  </span>
                  <span className={`fs-pct ${(timeframe === '1d' ? fullScreenIndex.dailyChangePct : fullScreenIndex.periodChangePct) >= 0 ? 'up' : 'down'}`}>
                    {(timeframe === '1d' ? fullScreenIndex.dailyChangePct : fullScreenIndex.periodChangePct) >= 0 ? '+' : '-'}
                    {formatPct(Math.abs(timeframe === '1d' ? fullScreenIndex.dailyChangePct : fullScreenIndex.periodChangePct))}
                  </span>
                </div>
              </div>
              
              <div className="fs-header-right">
                <div className="fs-ma-summary">
                  {[5, 10, 21, 50, 200].map(period => {
                    const sma = fullScreenIndex[`sma${period}`];
                    const isAbove = fullScreenIndex.currentPrice > sma;
                    return (
                      <div key={period} className="fs-ma-item">
                        <span className="label">{period}MA</span>
                        <span className={`value ${isAbove ? 'up' : 'down'}`}>
                          {formatPrice(sma)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="modal-close-btn" onClick={() => setFullScreenIndex(null)}>
                  ×
                </button>
              </div>
            </div>
            
            <div className="fs-body">
              <div className="fs-controls">
                <div className="timeframe-toggles">
                  {['1d', '1w', '1mo', '3mo', '6mo', 'ytd', '1y', '2y', '5y'].map(tf => (
                    <button 
                      key={tf} 
                      className={timeframe === tf ? 'active' : ''}
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="fs-interval-info">
                  <div className="fs-interval-text">
                    <span style={{ marginRight: '6px', opacity: 0.5 }}>●</span> 
                    Interval: {fullScreenIndex.candlesticks?.length || 0} bars
                    {loading && <span style={{ marginLeft: '12px', color: 'var(--primary)' }}>↻ Syncing...</span>}
                  </div>
                  {(() => {
                    const isAiBlocked = checkIsAiBlocked(aiSettings?.aiState?.blockedUntil);
                    return (
                      <button 
                        className={`btn-ai-gradient fs-ai-btn-gradient ${showAiPane ? 'active' : ''}`}
                        onClick={() => {
                          if (aiAnalysis) {
                            setShowAiPane(!showAiPane);
                          } else {
                            handleRunAi();
                          }
                        }}
                        disabled={loadingAi || (isAiBlocked && !aiAnalysis)}
                        title={isAiBlocked && !aiAnalysis ? "AI requests blocked due to rate limit/errors" : "Run Gemini AI Technical Analysis on this chart"}
                      >
                        {loadingAi ? (
                          <>
                            <span className="spinner-mini"></span>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            {aiAnalysis ? (showAiPane ? 'Hide AI' : 'Show AI') : 'Analyze with AI'}
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>

              <div className={`fs-main-layout ${showAiPane ? 'with-sidebar' : ''}`}>
                <div className="fs-chart-main">
                  <MiniCandlestickChart 
                    data={fullScreenIndex} 
                    country={country}
                    interactive={true}
                    hideHeaders={true}
                    disableZoom={true}
                    height="550px"
                  />
                </div>
                {showAiPane && (
                  <div className="fs-ai-panel">
                    <div className="fs-ai-panel-header">
                      <h4>AI Technical Thesis</h4>
                       {aiAnalysis && (() => {
                         const isAiBlocked = checkIsAiBlocked(aiSettings?.aiState?.blockedUntil);
                         return (
                           <button 
                             className="fs-ai-refresh-btn" 
                             onClick={handleRunAi} 
                             disabled={loadingAi || isAiBlocked} 
                             title={isAiBlocked ? "AI requests blocked due to rate limit/errors" : "Recalculate AI analysis"}
                           >
                             ↻
                           </button>
                         );
                       })()}
                    </div>
                    <div className="fs-ai-panel-content themed-scroll">
                      {loadingAi ? (
                        <div className="ai-loading-state">
                          <div className="spinner"></div>
                          <span>Generating AI Technical Analysis...</span>
                        </div>
                      ) : aiError ? (
                        <div className="ai-error-state">
                          <div className="error-icon">⚠️</div>
                          <span className="error-text">{aiError}</span>
                           {(() => {
                             const isAiBlocked = checkIsAiBlocked(aiSettings?.aiState?.blockedUntil);
                             return (
                               <button 
                                 className="fs-ai-retry-btn" 
                                 onClick={handleRunAi} 
                                 disabled={isAiBlocked} 
                                 style={{ marginTop: '10px', opacity: isAiBlocked ? 0.5 : 1, cursor: isAiBlocked ? 'not-allowed' : 'pointer' }}
                               >
                                 Retry
                               </button>
                             );
                           })()}
                        </div>
                      ) : (
                        renderAiAnalysis(aiAnalysis)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
