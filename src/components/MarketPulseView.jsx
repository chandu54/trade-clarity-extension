import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMarketPulseData, generateTechnicalThesis } from '../services/marketPulse';
import MiniCandlestickChart from './MiniCandlestickChart';

const formatSymbolBadge = (symbol) => {
  if (!symbol) return '';
  if (symbol === "HEALTHIETF.NS") return "HEALTHCARE";
  if (symbol === "OILIETF.NS") return "OIL_AND_GAS";
  return symbol.replace('^', '').replace('.NS', '');
};

export default function MarketPulseView({ country }) {
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
  const searchInputRef = React.useRef(null);

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
            <div className="matrix-header">
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
                      RS Rating <span className="info-icon" title="Relative Strength vs Benchmark. Shows if the index is outperforming (+) or underperforming (-) the Nifty 50 today." />
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
                  {orderedData.flatMap(group => 
                    group.indices.map((idx, i) => {
                      const sma21Dist = idx.sma21 ? ((idx.currentPrice - idx.sma21) / idx.sma21) * 100 : null;
                      const sma50Dist = idx.sma50 ? ((idx.currentPrice - idx.sma50) / idx.sma50) * 100 : null;
                      const sma200Dist = idx.sma200 ? ((idx.currentPrice - idx.sma200) / idx.sma200) * 100 : null;

                      const healthClass = idx.healthScore >= 70 ? 'bull' : idx.healthScore >= 40 ? 'warn' : 'bear';
                      const rsClass = idx.rsRating >= 0.5 ? 'dist-bull-strong' : idx.rsRating >= 0 ? 'dist-bull' : 'dist-bear';
                      const rsiClass = idx.rsi >= 70 ? 'dist-bear' : idx.rsi <= 30 ? 'dist-bull' : 'dist-null';

                      return (
                        <tr key={idx.symbol} className="matrix-row">
                          {i === 0 && (
                            <td rowSpan={group.indices.length} className="matrix-category-cell">
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
                                <span className="symbol-badge">
                                  {formatSymbolBadge(idx.symbol)}
                                </span>
                              </div>
                              <div className="price-row">
                                <span className="price">{formatPrice(idx.currentPrice)}</span>
                                <span className={`change ${idx.dailyChange >= 0 ? 'up' : 'down'}`}>
                                  {idx.dailyChange >= 0 ? '+' : ''}{formatPct(idx.dailyChangePct)}
                                </span>
                              </div>
                            </div>
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pulse-thesis-card">
              <div className="thesis-title">
                <span className="accent"></span>
                Technical Thesis
              </div>
              <div className="thesis-content">
                {thesis}
              </div>
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
                  <button 
                    className="fs-analyze-btn"
                    onClick={() => {
                      const url = country === 'IN' 
                        ? `https://www.tradingview.com/chart/?symbol=NSE:${fullScreenIndex.symbol.replace('.NS', '').replace('^', '')}` 
                        : `https://www.tradingview.com/chart/?symbol=${fullScreenIndex.symbol.replace('^', '')}`;
                      window.open(url, '_blank');
                    }}
                  >
                    Analyze ↗
                  </button>
                </div>
              </div>

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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
