import React, { useMemo, useState, useEffect, useRef } from 'react';

const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="20" x2="22" y2="20" />
    <rect x="6" y="10" width="4" height="8" />
    <rect x="14" y="4" width="4" height="14" />
  </svg>
);

const PieChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 12h8" />
    <path d="M12 12v-8" />
  </svg>
);

const getTooltip = (item) => {
  const maxTooltipStocks = 15;
  const stockList = item.stocks.slice(0, maxTooltipStocks).join(', ');
  const remaining = item.stocks.length - maxTooltipStocks;
  const suffix = remaining > 0 ? `\n...and ${remaining} more` : '';
  return `${item.name}: ${item.value}\nStocks: ${stockList}${suffix}`;
};

const SimplePieChart = ({ data, onSliceClick }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <div className="chart-empty">No data available</div>;

  let currentAngle = 0;
  const gradient = data.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    const color = COLORS[index % COLORS.length];
    return `${color} ${start}deg ${end}deg`;
  }).join(', ');

  const handlePieClick = (e) => {
    if (!onSliceClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    // Calculate click position relative to the center of the chart
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    // Ignore clicks in the donut hole (70% width = 0.7 radius ratio)
    const radius = Math.sqrt(x * x + y * y);
    const maxRadius = rect.width / 2;
    if (radius < maxRadius * 0.7) return;

    // Calculate angle in degrees, normalized to 0-360, starting at 12 o'clock (CSS standard)
    // Math.atan2 returns angle from x-axis (3 o'clock), so we adjust by 90 deg
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // Find which data segment covers this angle
    let currentAngle = 0;
    for (const item of data) {
      const percentage = item.value / total;
      const sliceAngle = percentage * 360;
      
      if (angle >= currentAngle && angle < currentAngle + sliceAngle) {
        onSliceClick(item, e);
        break;
      }
      currentAngle += sliceAngle;
    }
  };

  return (
    <div className="chart-container pie-chart-container">
      <div className="pie-chart-wrapper">
        <div 
          className="pie-chart"
          onClick={handlePieClick}
          style={{
            background: `conic-gradient(${gradient})`,
            cursor: onSliceClick ? 'pointer' : 'default'
          }} 
        >
          <div className="pie-hole">
            <div className="pie-total">
              <span className="pie-total-value">{total}</span>
              <span className="pie-total-label">Total</span>
            </div>
          </div>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((item, index) => (
          <div key={item.name} className="legend-item" title={getTooltip(item)} onClick={e => onSliceClick && onSliceClick(item, e)}>
            <span 
              className="legend-color" 
              style={{ background: COLORS[index % COLORS.length] }} 
            />
            <span className="legend-label" title={item.name}>{item.name}</span>
            <span className="legend-value">{item.value} ({Math.round((item.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SimpleBarChart = ({ data, onBarClick }) => {
  const max = Math.max(...data.map(d => d.value));
  if (max === 0) return <div className="chart-empty">No data available</div>;

  // Reduce gap if there are many items (e.g. 15-20 sectors)
  const dynamicGap = data.length > 10 ? '2px' : '8px';

  return (
    <div className="chart-container bar-chart-container">
      <div className="bar-chart-grid">
        {/* Y-Axis lines could go here if we wanted complex CSS grid */}
        <div className="bar-chart-bars" style={{ gap: dynamicGap }}>
          {data.map((item, index) => {
            const height = (item.value / max) * 100;
            const color = COLORS[index % COLORS.length];
            return (
              <div key={item.name} className="bar-column" onClick={e => onBarClick && onBarClick(item, e)}>
                <div className="bar-wrapper" title={getTooltip(item)}>
                  <div className="bar-value">{item.value}</div>
                  <div 
                    className="bar" 
                    style={{ 
                      height: `${Math.max(height, 1)}%`,
                      background: color
                    }} 
                  />
                </div>
                <div className="bar-label" title={item.name}>{item.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StockListPopup = ({ popupData, onClose }) => {
  if (!popupData) return null;

  const { data, event } = popupData;

  // Position the popup. Adjust so it doesn't go off-screen.
  const style = {
    left: Math.min(event.clientX + 15, window.innerWidth - 280 - 20), // 280px width, 20px padding
    top: Math.min(event.clientY + 15, window.innerHeight - 350 - 20), // 350px max-height, 20px padding
  };

  return (
    <div className="stock-list-popup-overlay" onClick={onClose}>
      <div className="stock-list-popup" style={style} onClick={e => e.stopPropagation()}>
        <div className="stock-list-popup-header">
          <h4>{data.paramLabel ? `${data.paramLabel} - ${data.name}` : data.name}</h4>
          <span className="stock-list-popup-count">{data.value} Stocks</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="stock-list-popup-body">
          {data.stocks.length > 0 ? (
            data.stocks.map((stock, i) => (
              <span key={i} className="stock-tag">{stock}</span>
            ))
          ) : (
            <span className="chart-empty" style={{padding: '10px 0'}}>No stocks for this category.</span>
          )}
        </div>
      </div>
    </div>
  );
};

const ExpandedView = ({ param, onClose, onChartClick }) => {
  return (
    <div className="expanded-view">
      <div className="expanded-header">
        <h3>{param.label} Breakdown</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="expanded-content">
        <div className="expanded-chart-section">
          {param.chartType === 'pie' ? (
            <SimplePieChart data={param.data} onSliceClick={onChartClick} />
          ) : (
            <SimpleBarChart data={param.data} onBarClick={onChartClick} />
          )}
        </div>
        <div className="expanded-details-section">
          {param.data.map(group => (
            <div key={group.name} className="detail-group">
              <div className="detail-group-header">
                <span className="detail-name">{group.name}</span>
                <span className="detail-count">{group.value}</span>
              </div>
              <div className="stock-tag-list">
                {group.stocks.map((stock, i) => (
                  <span key={i} className="stock-tag">{stock}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SimpleTrendChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value));
  const yMax = Math.ceil(max * 1.2) || 5; 
  
  const width = 1000;
  const height = 300;
  const padding = { top: 20, right: 30, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const xRatio = data.length > 1 ? i / (data.length - 1) : 0.5;
    const x = padding.left + xRatio * chartWidth;
    const y = height - padding.bottom - (d.value / yMax) * chartHeight;
    return { x, y, ...d };
  });

  const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaStr = `${padding.left},${height - padding.bottom} ${pointsStr} ${width - padding.right},${height - padding.bottom}`;

  // Generate Y-axis ticks
  const yTicks = [];
  for (let i = 0; i <= 5; i++) {
    const val = Math.round((i / 5) * yMax);
    const y = height - padding.bottom - (i / 5) * chartHeight;
    yTicks.push({ val, y });
  }

  return (
    <div className="chart-container trend-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
        {/* Gradient Definition */}
        <defs>
          <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0"/>
          </linearGradient>
        </defs>

        {/* Y-Axis Grid & Labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line 
              x1={padding.left} 
              y1={t.y} 
              x2={width - padding.right} 
              y2={t.y} 
              stroke="var(--border)" 
              strokeWidth="1" 
              strokeDasharray="4" 
              opacity="0.5"
            />
            <text 
              x={padding.left - 10} 
              y={t.y + 4} 
              textAnchor="end" 
              fontSize="12" 
              fill="var(--muted)"
            >
              {t.val}
            </text>
          </g>
        ))}

        {/* X-Axis Labels */}
        {points.map((p, i) => {
          // Show label if it's sparse enough. 
          // If > 15 points, show every Nth point.
          const step = Math.ceil(data.length / 15);
          if (i % step !== 0) return null;
          
          return (
            <text 
              key={i} 
              x={p.x} 
              y={height - padding.bottom + 20} 
              textAnchor="middle" 
              fontSize="12" 
              fill="var(--muted)"
            >
              {p.name}
            </text>
          );
        })}

        {/* Axis Titles */}
        <text x={width / 2} y={height - 15} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--text)">Date</text>
        <text x={20} y={height / 2} textAnchor="middle" transform={`rotate(-90, 20, ${height / 2})`} fontSize="14" fontWeight="600" fill="var(--text)">Stock Count</text>

        {/* Area Fill */}
        <polygon points={areaStr} fill="url(#trendGradient)" />

        {/* Line Stroke */}
        {data.length > 1 && (
          <polyline points={pointsStr} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data Points */}
        {points.map((p, i) => (
          <g key={i} className="trend-point-group">
            <circle cx={p.x} cy={p.y} r="5" fill="var(--panel)" stroke="var(--primary)" strokeWidth="2" />
            <rect x={p.x - 30} y={p.y - 35} width="60" height="24" rx="4" fill="var(--bg)" stroke="var(--border)" className="trend-tooltip-bg" />
            <text x={p.x} y={p.y - 19} textAnchor="middle" fontSize="12" fill="var(--text)" className="trend-tooltip-text">{p.name}: {p.value}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const STORAGE_KEY = 'tc_analytics_layout';

function getWeekRangeLabel(sundayDateStr) {
  if (!sundayDateStr) return '';
  const [y, m, d] = sundayDateStr.split("-").map(Number);
  const sunday = new Date(y, m - 1, d);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() + 1);
  const friday = new Date(sunday);
  friday.setDate(sunday.getDate() + 5);

  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  return `${formatDate(monday)} to ${formatDate(friday)}`;
}

const AnalyticsDashboard = ({ stocks, allWeeksData, parameters, weekKey, onClose }) => {
  const [expandedParam, setExpandedParam] = useState(null);
  const [stockListPopup, setStockListPopup] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  const [widgetConfig, setWidgetConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } 
    catch { return {}; }
  });

  const trendData = useMemo(() => {
    if (!allWeeksData) return [];
    return Object.entries(allWeeksData)
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by full date key
      .map(([date, weekData]) => {
        // Format date to be shorter (e.g., "10-24")
        const shortDate = date.substring(5); 
        return {
          name: shortDate,
          value: Object.keys(weekData.stocks || {}).length
        };
      });
  }, [allWeeksData]);

  const aggregatedData = useMemo(() => {
    if (!stocks || !parameters) return [];

    const systemMetrics = [];

    // 1. Sector Distribution
    const sectorCounts = {};
    stocks.forEach(stock => {
      const val = stock.sector || "Unspecified";
      if (!sectorCounts[val]) sectorCounts[val] = { value: 0, stocks: [] };
      sectorCounts[val].value++;
      sectorCounts[val].stocks.push(stock.symbol || stock.ticker || "Unknown");
    });
    
    systemMetrics.push({
      id: 'sys_sector',
      label: 'Sector Distribution',
      type: 'pie', // Explicitly use pie chart for sectors
      data: Object.keys(sectorCounts).map(k => ({ name: k, paramLabel: 'Sector', ...sectorCounts[k] })).sort((a, b) => b.value - a.value)
    });

    // 2. Tradable Status
    const tradableCounts = { 'Yes': { value: 0, stocks: [] }, 'No': { value: 0, stocks: [] } };
    stocks.forEach(stock => {
      const val = stock.tradable ? 'Yes' : 'No';
      tradableCounts[val].value++;
      tradableCounts[val].stocks.push(stock.symbol || stock.ticker || "Unknown");
    });
    systemMetrics.push({
      id: 'sys_tradable',
      label: 'Tradable Status',
      type: 'checkbox', // Forces Pie chart usually
      data: Object.keys(tradableCounts).map(k => ({ name: k, paramLabel: 'Tradable', ...tradableCounts[k] }))
    });

    // 3. Tags Distribution
    const tagCounts = {};
    let hasTags = false;
    stocks.forEach(stock => {
      if (stock.tags && Array.isArray(stock.tags) && stock.tags.length > 0) {
        hasTags = true;
        stock.tags.forEach(tag => {
          if (!tagCounts[tag]) tagCounts[tag] = { value: 0, stocks: [] };
          tagCounts[tag].value++;
          tagCounts[tag].stocks.push(stock.symbol || stock.ticker || "Unknown");
        });
      }
    });
    
    if (hasTags) {
      systemMetrics.push({
        id: 'sys_tags',
        label: 'Tags Distribution',
        type: 'select',
        data: Object.keys(tagCounts).map(k => ({ name: k, paramLabel: 'Tag', ...tagCounts[k] })).sort((a, b) => b.value - a.value)
      });
    }

    // 4. Custom Parameters
    const paramMetrics = parameters.map(param => {
      const counts = {}; // Key -> { value: count, stocks: [] }
      stocks.forEach(stock => {
        // Access the parameter value from the stock's params object
        let value = stock.params?.[param.id];
        
        // Handle checkbox booleans
        if (param.type === 'checkbox') {
            value = value ? 'Yes' : 'No';
        }
        
        // Handle empty values
        if (value === undefined || value === null || value === '') {
            value = 'Unspecified';
        }

        const key = String(value);
        if (!counts[key]) {
          counts[key] = { value: 0, stocks: [] };
        }
        counts[key].value += 1;
        counts[key].stocks.push(stock.symbol || stock.ticker || "Unknown");
      });

      const data = Object.keys(counts).map(key => ({
        name: key,
        value: counts[key].value,
        stocks: counts[key].stocks,
        paramLabel: param.label
      }));

      // Sort logic: Special handling for "Liquidity" to sort by defined order/value instead of count
      if (param.label && param.label.toLowerCase().includes('liquidity')) {
        if (param.options && param.options.length > 0) {
          data.sort((a, b) => {
            const idxA = param.options.indexOf(a.name);
            const idxB = param.options.indexOf(b.name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA === -1) return 1; // Put undefined/unspecified at the end
            if (idxB === -1) return -1;
            return 0;
          });
        } else {
          data.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        }
      } else {
        data.sort((a, b) => b.value - a.value); // Default: Sort by count descending
      }

      return {
        ...param,
        data
      };
    });

    return [...systemMetrics, ...paramMetrics];
  }, [stocks, parameters]);

  // Persist config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetConfig));
  }, [widgetConfig]);

  // Handle Click Outside and Escape key for Settings Menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showSettings) {
        setShowSettings(false);
        event.stopPropagation(); // Prevent closing the parent modal if it also listens to Esc
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettings]);

  // Merge data with config to determine order and visibility
  const displayItems = useMemo(() => {
    // 1. Attach config to data
    const items = aggregatedData.map(item => {
      const config = widgetConfig[item.id] || {};
      
      // Determine chart type (user preference > default logic)
      let chartType = config.chartType;
      if (!chartType) {
         chartType = (item.type === 'checkbox' || item.type === 'pie' || item.data.length <= 5) ? 'pie' : 'bar';
      }

      return {
        ...item,
        visible: config.visible !== false, // Default true
        order: config.order !== undefined ? config.order : 9999,
        chartType
      };
    });

    // 2. Sort by order, then by original index (stable sort for new items)
    return items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return aggregatedData.indexOf(a) - aggregatedData.indexOf(b);
    });
  }, [aggregatedData, widgetConfig]);

  const handleToggleVisibility = (id) => {
    setWidgetConfig(prev => ({
      ...prev,
      [id]: { ...prev[id], visible: !(prev[id]?.visible !== false) }
    }));
  };

  const handleToggleChartType = (id, currentType) => {
    setWidgetConfig(prev => ({
      ...prev,
      [id]: { ...prev[id], chartType: currentType === 'pie' ? 'bar' : 'pie' }
    }));
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId === targetId) return;

    const newItems = [...displayItems];
    const sourceIndex = newItems.findIndex(i => i.id === sourceId);
    const targetIndex = newItems.findIndex(i => i.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [moved] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, moved);

    const newConfig = { ...widgetConfig };
    newItems.forEach((item, index) => {
      newConfig[item.id] = { ...newConfig[item.id], order: index, visible: item.visible };
    });
    setWidgetConfig(newConfig);
  };

  const handleChartClick = (item, event) => {
    event.stopPropagation();
    setStockListPopup({ data: item, event });
  };

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={e => e.stopPropagation()}>
        <div className="analytics-header">
          <div>
            <h2>Analytics Dashboard</h2>
            <p className="analytics-subtitle">Weekly performance & distribution metrics • {getWeekRangeLabel(weekKey)}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="icon-btn" 
              onClick={() => window.print()}
              title="Download Report"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V3" />
                <path d="M8 11l4 4 4-4" />
                <line x1="4" y1="21" x2="20" y2="21" />
              </svg>
            </button>
            <div className="settings-wrapper" ref={settingsRef}>
              <button 
                className="icon-btn" 
                onClick={() => setShowSettings(!showSettings)}
                title="Configure Widgets"
              >
                ⚙️
              </button>
              {showSettings && (
                <div className="settings-popover">
                  <h4>Visible Widgets</h4>
                  <div className="settings-list">
                    {displayItems.map(item => (
                      <label key={item.id} className="settings-item">
                        <input 
                          type="checkbox" 
                          checked={item.visible} 
                          onChange={() => handleToggleVisibility(item.id)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="analytics-content">
          {trendData.length > 0 && (
            <div className="chart-card trend-card">
              <h3 className="chart-title">Weekly stock universe trend</h3>
              <SimpleTrendChart data={trendData} />
            </div>
          )}

          {expandedParam ? (
            <ExpandedView 
              param={expandedParam} 
              onClose={() => setExpandedParam(null)} 
              onChartClick={handleChartClick}
            />
          ) : aggregatedData.length === 0 ? (
             <div className="empty-state">
                No parameters defined or no stocks in this week to analyze.
             </div>
          ) : (
            <div className="charts-grid">
              {displayItems.filter(i => i.visible).map((item) => (
                <div 
                  key={item.id} 
                  className="chart-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, item.id)}
                >
                  <div className="chart-card-header">
                    <h3 className="chart-title">{item.label}</h3>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="icon-btn small" 
                        onClick={() => handleToggleChartType(item.id, item.chartType)}
                        title={item.chartType === 'pie' ? "Switch to Bar Chart" : "Switch to Pie Chart"}
                        style={{ padding: '4px', height: '24px', width: '24px' }}
                      >
                        {item.chartType === 'pie' ? <BarChartIcon /> : <PieChartIcon />}
                      </button>
                      <button 
                        className="expand-btn" 
                        onClick={() => setExpandedParam(item)}
                        title="View details"
                      >
                        ⤢
                      </button>
                    </div>
                  </div>
                  <div className="chart-body">
                    {item.chartType === 'pie' ? (
                      <SimplePieChart data={item.data} onSliceClick={handleChartClick} />
                    ) : (
                      <SimpleBarChart data={item.data} onBarClick={handleChartClick} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {stockListPopup && (
        <StockListPopup 
          popupData={stockListPopup} 
          onClose={() => setStockListPopup(null)} 
        />
      )}
    </div>
  );
};

export default AnalyticsDashboard;