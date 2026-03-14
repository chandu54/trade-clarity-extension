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
    <rect x="3" y="11" width="4" height="10" rx="1" />
    <rect x="10" y="4" width="4" height="17" rx="1" />
    <rect x="17" y="8" width="4" height="13" rx="1" />
  </svg>
);

const PieChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="12" x2="20" y2="12" />
    <line x1="12" y1="12" x2="12" y2="4" />
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

// Helper to create histogram bins for expanded view
const createHistogramData = (data, label) => {
  if (!data || data.length === 0) return [];
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return [{ name: `${min}`, value: values.length, stocks: data.map(d => d.symbol), paramLabel: label }];

  const binCount = 5; // 5 bins for readability
  const range = max - min;
  const step = range / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = min + (i * step);
    const end = min + ((i + 1) * step);
    // Format range nicely
    const name = `${start.toLocaleString(undefined, {maximumFractionDigits: 1})} - ${end.toLocaleString(undefined, {maximumFractionDigits: 1})}`;
    return {
      name,
      value: 0,
      stocks: [],
      paramLabel: label
    };
  });

  data.forEach(item => {
    let idx = Math.floor((item.value - min) / step);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].value++;
    bins[idx].stocks.push(item.symbol);
  });

  return bins.filter(b => b.value > 0);
};

const DotPlot = ({ data, onPointClick }) => {
  const [hoveredDot, setHoveredDot] = useState(null); // Will store the index of the dot
  if (!data || data.length === 0) return <div className="chart-empty">No numeric data</div>;

  const { points, ticks } = useMemo(() => {
    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    // Generate 5 evenly spaced ticks for the Y-axis
    const ticks = [];
    for(let i=0; i<=4; i++) {
        ticks.push({
            value: minVal + (range * (i/4)),
            percent: (i/4) * 100
        });
    }

    const pointsWithPos = data.map((item, i) => {
      // Create a "scatter" effect on the X-axis so dots don't stack vertically
      const seed = (item.symbol || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + (i * 997);
      const randomX = (Math.sin(seed) * 10000) - Math.floor(Math.sin(seed) * 10000);

      return {
        ...item,
        xPercent: 10 + (randomX * 80), // Keep dots between 10% and 90% of the width
        yPercent: ((item.value - minVal) / range) * 100
      };
    });

    return { points: pointsWithPos, ticks };
  }, [data]);

  return (
    <div
      className="chart-container dot-plot-container"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Y-Axis Labels */}
      <div className="dot-plot-yaxis">
        {ticks.map((t, i) => (
            <div key={i} className="dot-plot-yaxis-label" style={{ bottom: `${t.percent}%` }}>
              {t.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
        ))}
      </div>

      {/* Plot Area */}
      <div className="dot-plot-area">
        {[0, 25, 50, 75, 100].map(p => (
          <div key={p} className="dot-plot-gridline" style={{ bottom: `${p}%` }} />
        ))}

        {points.map((item, i) => {
          const isHovered = hoveredDot === i;
          return (
            <div
              key={item.symbol || i}
              className="dot-plot-dot"
              onMouseEnter={() => setHoveredDot(i)}
              onMouseLeave={() => setHoveredDot(null)}
              onClick={(e) => onPointClick && onPointClick(item, e)}
              title={item.symbol ? `${item.symbol}: ${item.value}` : `Value: ${item.value}`}
              style={{
                left: `${item.xPercent}%`,
                bottom: `${item.yPercent}%`,
                transform: isHovered ? 'translate(-50%, 50%) scale(1.8)' : 'translate(-50%, 50%)',
                opacity: isHovered ? 1 : 0.7,
                zIndex: isHovered ? 20 : 10,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const DateHeatmapChart = ({ data, onPointClick }) => {
  const [selectedYear, setSelectedYear] = useState("All");

  if (!data || data.length === 0) return <div className="chart-empty">No date data</div>;

  // 1. Aggregate dates
  const fullCountMap = {};
  const allYears = new Set();
  
  data.forEach(item => {
    // Attempt to standardize date string (YYYY-MM-DD)
    const d = new Date(item.value);
    if (isNaN(d.getTime())) return;
    
    // Track valid Years present
    const yStr = String(d.getFullYear()).padStart(4, '0');
    allYears.add(yStr);

    const dateStr = `${yStr}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!fullCountMap[dateStr]) {
      fullCountMap[dateStr] = { count: 0, items: [], name: dateStr, value: 0 };
    }
    fullCountMap[dateStr].count += 1;
    fullCountMap[dateStr].items.push(item);
    fullCountMap[dateStr].value = fullCountMap[dateStr].count;
  });

  const validYears = Array.from(allYears).sort((a,b) => b.localeCompare(a));
  const isMultiYear = validYears.length > 1;
  
  // If "All" is selected but we have multiple years, just default to the most recent year to prevent huge empty grids.
  const activeYear = selectedYear === "All" ? (isMultiYear ? validYears[0] : "All") : selectedYear;

  // Filter map to active year
  const countMap = {};
  Object.keys(fullCountMap).forEach(key => {
    if (activeYear === "All" || key.startsWith(activeYear)) {
      countMap[key] = fullCountMap[key];
    }
  });

  const validDates = Object.keys(countMap).sort();
  if (validDates.length === 0) return <div className="chart-empty">Invalid dates</div>;

  // Find overall min and max date strings
  const minDateStr = validDates[0];
  const maxDateStr = validDates[validDates.length - 1];

  // Parse YYYY-MM-DD manually to avoid timezone shift
  const parseLocal = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setFullYear(y); // Fixes JS legacy Date behavior for years 0-99 mapping to 19xx
    return date;
  };

  let minDate = parseLocal(minDateStr);
  let maxDate = parseLocal(maxDateStr);

  // If difference is small, ensure at least 4 weeks are shown for a good looking grid.
  // If difference is extremely large (e.g. user typo'd a year to 1922 and forced "All"), cap strictly at exactly 1 year.
  const diffDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
  if (diffDays < 28) {
    minDate = new Date(maxDate.getTime() - 28 * 24 * 60 * 60 * 1000);
  } else if (diffDays > 365) {
    minDate = new Date(maxDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  // Adjust minDate to previous Sunday
  const minDay = minDate.getDay();
  minDate.setDate(minDate.getDate() - minDay);

  // Adjust maxDate to next Saturday
  const maxDay = maxDate.getDay();
  maxDate.setDate(maxDate.getDate() + (6 - maxDay));

  // Determine Max Count for color scaling
  const maxCount = Math.max(...Object.values(countMap).map(c => c.count));

  // Generate grid
  const columns = [];
  let curr = new Date(minDate);
  while (curr <= maxDate) {
    const colDates = [];
    for (let i = 0; i < 7; i++) {
      // Build YYYY-MM-DD
      const y = String(curr.getFullYear()).padStart(4, '0');
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const dStr = String(curr.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dStr}`;

      colDates.push({
        date: dateKey,
        data: countMap[dateKey] || null
      });
      curr.setDate(curr.getDate() + 1);
    }
    columns.push(colDates);
  }

  // Theming base color - Emerald for "thick green" contribution chart feel
  const getColor = (count) => {
    // Empty slot
    if (count === 0) return 'rgba(100, 116, 139, 0.15)';
    if (maxCount === 1) return '#10b981'; // Fixed color if max is 1

    const ratio = count / maxCount;
    // Dark to bright green scaling
    if (ratio <= 0.25) return '#064e3b'; // Emerald 900
    if (ratio <= 0.5) return '#059669';  // Emerald 600
    if (ratio <= 0.75) return '#10b981'; // Emerald 500
    return '#34d399';                    // Emerald 400 (Thickest)
  };

  // Identify months for labels
  const monthLabels = [];
  let lastMonth = -1;
  columns.forEach((col, xIndex) => {
    const d = parseLocal(col[0].date);
    if (d.getMonth() !== lastMonth && xIndex > 0) {
      monthLabels.push({ name: d.toLocaleString('default', { month: 'short' }), x: xIndex });
    }
    lastMonth = d.getMonth();
  });

  return (
    <div className="chart-container heatmap-container" style={{ position: 'relative' }}>
      
      {isMultiYear && (
        <div style={{ position: 'absolute', top: '-46px', right: '40px', zIndex: 10 }}>
          <select 
            className="select-control compact" 
            value={activeYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ padding: '2px 20px 2px 8px', fontSize: '11px', height: '24px' }}
          >
            {validYears.map(y => <option key={y} value={y}>{y}</option>)}
            <option value="All">All Years</option>
          </select>
        </div>
      )}

      <div className="heatmap-wrapper">
        {/* Month Labels */}
        <div className="heatmap-months" style={{ minWidth: `${columns.length * 15}px` }}>
          {monthLabels.map((lbl, i) => (
            <span key={i} className="heatmap-month-label" style={{ left: `${lbl.x * 15}px`, transform: 'translateX(-50%)' }}>
              {lbl.name}
            </span>
          ))}
        </div>

      <div className="heatmap-grid-wrapper">
        
        {/* Day of week labels */}
        <div className="heatmap-days">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="heatmap-day-label">
              {i % 2 === 1 ? day : ''}
            </div>
          ))}
        </div>

        {/* Heatmap Grid */}
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="heatmap-column">
            {col.map((cell, rowIdx) => {
              const count = cell.data ? cell.data.count : 0;
              return (
                <div
                  key={rowIdx}
                  className="heatmap-cell"
                  onClick={(e) => {
                    if (count > 0 && onPointClick) {
                      // Transform into PieChart data shape { name, value, stocks }
                      const stockList = cell.data.items.map(i => i.symbol);
                      onPointClick({ name: cell.date, value: count, stocks: stockList }, e);
                    }
                  }}
                  title={count > 0 ? `${cell.date}: ${count} stocks` : cell.date}
                  style={{
                    backgroundColor: getColor(count),
                    cursor: count > 0 ? 'pointer' : 'default',
                    opacity: count > 0 ? 0.9 : 1, // Non active cells stay solid
                  }}
                  onMouseEnter={(e) => { if (count > 0) e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { if (count > 0) e.currentTarget.style.opacity = '0.9'; }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

const StockListPopup = ({ popupData, onClose }) => {
  const { data, event } = popupData;
  const popupRef = useRef(null);
  const [style, setStyle] = useState({ opacity: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (popupRef.current && event) {
      const popupRect = popupRef.current.getBoundingClientRect();
      let left = event.clientX + 15;
      let top = event.clientY + 15;

      // Adjust if popup goes off-screen
      if (left + popupRect.width > window.innerWidth - 20) {
        left = event.clientX - popupRect.width - 15;
      }
      if (top + popupRect.height > window.innerHeight - 20) {
        top = event.clientY - popupRect.height - 15;
      }

      setStyle({ left: `${left}px`, top: `${top}px`, opacity: 1 });
    }
  }, [popupData, event]);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (data && data.stocks) {
      const textToCopy = data.stocks.join(", ");
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (!popupData) return null;

  // Position the popup. Adjust so it doesn't go off-screen.

  return (
    <div className="stock-list-popup-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div ref={popupRef} className="stock-list-popup" style={style} onClick={e => e.stopPropagation()}>
        <div className="stock-list-popup-header">
          <h4>{data.paramLabel ? `${data.paramLabel} - ${data.name}` : data.name}</h4>
          <span className="stock-list-popup-count">{data.stocks.length} Stocks</span>
          <div className="stock-list-popup-actions">
            <button 
              className="popup-copy-btn" 
              onClick={handleCopy} 
              title="Copy stock names"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="stock-list-popup-body">
          {data.stocks.length > 0 ? (
            data.stocks.map((stock, i) => (
              <span key={i} className="stock-tag">{stock}</span>
            ))
          ) : (
            <span className="chart-empty chart-empty-padded">No stocks in this category.</span>
          )}
        </div>
      </div>
    </div>
  );
};

const ExpandedView = ({ param, onClose, onChartClick }) => {
  const renderChart = () => {
    // This logic determines the best chart for the expanded view.
    // For categorical data, a pie chart gives a great overview of proportions.
    // For distributions, we show the detailed plot.
    switch (param.type) {
      case 'numeric-distribution':
        const histData = createHistogramData(param.data, param.label);
        return <SimpleBarChart data={histData} onBarClick={onChartClick} />;
      case 'date-timeline':
        return <DateHeatmapChart data={param.data} onPointClick={(point, event) => onChartClick(point, event, param)} />;
      default:
        return param.chartType === 'bar' ? (
          <SimpleBarChart data={param.data} onBarClick={onChartClick} />
        ) : (
          <SimplePieChart data={param.data} onSliceClick={onChartClick} />
        );
    }
  };

  const renderDetailsList = () => {
    // For distribution plots, show a simple sorted list of stocks and their values.
    if (param.type === 'numeric-distribution') {
      const histData = createHistogramData(param.data, param.label);
      return (
        <div className="detail-list-container themed-scroll flex-1 overflow-y-auto">
          {histData.map(group => (
            <div key={group.name} className="detail-group" onClick={(e) => onChartClick(group, e)} title="Click to see stock list">
              <div className="detail-group-header">
                <span className="detail-name">{group.name}</span>
                <span className="detail-count">{group.value}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    else if (param.type === 'date-timeline') {
      const countMap = {};
      param.data.forEach(item => {
        const d = new Date(item.value);
        if (isNaN(d.getTime())) return;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!countMap[dateStr]) countMap[dateStr] = { name: dateStr, value: 0, stocks: [] };
        countMap[dateStr].value++;
        countMap[dateStr].stocks.push(item.symbol);
      });
      const sortedDates = Object.values(countMap).sort((a, b) => b.name.localeCompare(a.name));

      return (
        <div className="detail-list-container themed-scroll flex-1 overflow-y-auto">
          {sortedDates.map(group => (
            <div key={group.name} className="detail-group" onClick={(e) => onChartClick(group, e)} title="Click to see stock list">
              <div className="detail-group-header">
                <span className="detail-name">{group.name}</span>
                <span className="detail-count">{group.value}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // For categorical data, show groups and their stock lists.
    return (
      <div className="detail-list-container themed-scroll flex-1 overflow-y-auto">
        {param.data.map(group => (
          <div key={group.name} className="detail-group" onClick={(e) => onChartClick(group, e)} title="Click to see stock list">
            <div className="detail-group-header">
              <span className="detail-name">{group.name}</span>
              <span className="detail-count">{group.value}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="expanded-view flex flex-col h-full">
      <div className="expanded-header flex-none">
        <h3>{param.label} Breakdown</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="expanded-content flex flex-1 overflow-hidden p-4 gap-4">
        <div className="expanded-chart-section flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
          {renderChart()}
        </div>
        <div className="expanded-details-section w-1/3 min-w-[250px] flex flex-col border-l border-slate-200 dark:border-slate-700 pl-4">
          <h4 className="text-sm font-bold mb-2 text-slate-500 uppercase tracking-wider">Details</h4>
          {renderDetailsList()}
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
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
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
      if (param.type === 'number') {
        // For numbers, we want raw data points for the Dot Plot
        const rawData = stocks
          .filter(s => !isNaN(parseFloat(s.params?.[param.id])))
          .map(s => ({
            symbol: s.symbol || s.ticker || "Unknown",
            value: parseFloat(s.params?.[param.id])
          }))
          .sort((a, b) => a.value - b.value);
        return { ...param, data: rawData, type: 'numeric-distribution' };
      } else if (param.type === 'date') {
        // For dates, we want raw data points for the Timeline
        const rawData = stocks
          .filter(s => s.params?.[param.id])
          .map(s => ({ symbol: s.symbol || s.ticker || "Unknown", value: s.params?.[param.id] }))
          .sort((a, b) => new Date(a.value) - new Date(b.value));
          
        let span = 1; // Default span
        if (rawData.length > 0) {
          const validDates = rawData.map(d => new Date(d.value).getTime()).filter(t => !isNaN(t));
          if (validDates.length > 0) {
            const diffDays = (Math.max(...validDates) - Math.min(...validDates)) / (1000 * 60 * 60 * 24);
            
            if (diffDays > 180) { // > 6 months, take full row
              span = 3;
            } else if (diffDays > 90) { // 3-6 months, take 2 columns
              span = 2;
            }
          }
        }
        
        return { ...param, data: rawData, type: 'date-timeline', span };
      } else {
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

        return { ...param, data };
      }
    });

    return [...systemMetrics, ...paramMetrics];
  }, [stocks, parameters]);

  // Persist config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetConfig));
  }, [widgetConfig]);

  // Handle Click Outside and Global Escape Key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
          event.stopPropagation();
          return;
        }
        if (stockListPopup) {
          setStockListPopup(null);
          event.stopPropagation();
          return;
        }
        if (expandedParam) {
          setExpandedParam(null);
          event.stopPropagation();
          return;
        }
        // If nothing sub-level is open, close the dashboard itself
        onClose();
        event.stopPropagation();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettings, stockListPopup, expandedParam, onClose]);

  // Merge data with config to determine order and visibility
  const displayItems = useMemo(() => {
    // 1. Attach config to data
    const items = aggregatedData.map(item => {
      const config = widgetConfig[item.id] || {};

      // Determine chart type (user preference > default logic)
      let chartType = config.chartType;
      if (!chartType) {
        if (item.type === 'numeric-distribution' || item.type === 'date-timeline') {
          chartType = 'special'; // These don't toggle between pie/bar
        } else {
          chartType = (item.type === 'checkbox' || item.type === 'pie' || item.data.length <= 5) ? 'pie' : 'bar';
        }
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

  const handleChartClick = (data, event, param = null) => {
    event.stopPropagation();

    if (param && data.symbol) { // It's a single point from DotPlot
      const popupItem = {
        name: `${data.symbol}: ${data.value}`,
        stocks: [data.symbol],
        paramLabel: param.label
      };
      setStockListPopup({ data: popupItem, event });
    } else { // It's a group from pie/bar/heatmap
      setStockListPopup({ data: param && !data.paramLabel ? { ...data, paramLabel: param.label } : data, event });
    }
  };

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={e => e.stopPropagation()}>
        <div className="analytics-header">
          <div>
            <h2>Analytics Dashboard</h2>
            <p className="analytics-subtitle">Weekly performance & distribution metrics • {getWeekRangeLabel(weekKey)}</p>
          </div>
          <div className="analytics-header-actions">
            <button
              className="icon-btn"
              onClick={() => window.print()}
              title="Download Report"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="15" x2="12" y2="3" />
                <polyline points="8 11 12 15 16 11" />
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
                  className={`chart-card ${item.span ? `span-${item.span}` : ''}`}
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
                    <div className="chart-card-actions">
                      {item.type !== 'numeric-distribution' && item.type !== 'date-timeline' && (
                        <button
                          className="icon-btn small chart-toggle-btn"
                          onClick={() => handleToggleChartType(item.id, item.chartType)}
                          title={item.chartType === 'pie' ? "Switch to Bar Chart" : "Switch to Pie Chart"}
                        >
                          {item.chartType === 'pie' ? <BarChartIcon /> : <PieChartIcon />}
                        </button>
                      )}
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
                    {item.type === 'numeric-distribution' ? (
                      <DotPlot data={item.data} onPointClick={(point, event) => handleChartClick(point, event, item)} />
                    ) : item.type === 'date-timeline' ? (
                      <DateHeatmapChart data={item.data} onPointClick={(point, event) => handleChartClick(point, event, item)} />
                    ) : item.chartType === 'pie' ? (
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
