import React, { useMemo, useState, useEffect, useRef } from "react";
import CategoryAnalysisView from "./CategoryAnalysisView";

const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];
import { parseInstitutionalDate } from "../utils/dateUtils";
import MovingAverageRibbon from "./MovingAverageRibbon";

const BarChartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="4" height="10" rx="1" />
    <rect x="10" y="4" width="4" height="17" rx="1" />
    <rect x="17" y="8" width="4" height="13" rx="1" />
  </svg>
);

const PieChartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="12" x2="20" y2="12" />
    <line x1="12" y1="12" x2="12" y2="4" />
  </svg>
);

const getTooltip = (item) => {
  const maxTooltipStocks = 15;
  const stockList = item.stocks.slice(0, maxTooltipStocks).join(", ");
  const remaining = item.stocks.length - maxTooltipStocks;
  const suffix = remaining > 0 ? `\n...and ${remaining} more` : "";
  return `${item.name}: ${item.value}\nStocks: ${stockList}${suffix}`;
};

const PrintStockList = ({ stocks, label }) => {
  if (!stocks || stocks.length === 0) return null;
  return (
    <div className="print-stock-list mt-2 pt-2 border-t border-slate-200 border-dashed">
      <div className="print-stock-label text-[10px] font-bold mb-1">
        Stocks:
      </div>
      <div className="print-stock-values text-[11px] leading-relaxed flex flex-wrap gap-x-2">
        {stocks.map((s, i) => (
          <span key={s} className="font-mono font-semibold">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
};

const SimplePieChart = ({ data, onSliceClick, isExpanded }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <div className="chart-empty">No data available</div>;

  let currentAngle = 0;
  const size = 200;
  const radius = size / 2;
  const innerRadius = radius * 0.7;
  const center = radius;

  return (
    <div className="chart-container pie-chart-container">
      <div className="pie-chart-wrapper">
        <svg viewBox={`0 0 ${size} ${size}`} className="pie-svg">
          {data.map((item, index) => {
            const percentage = item.value / total;
            if (percentage <= 0) return null;

            const sliceAngle = percentage * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sliceAngle;
            currentAngle = endAngle;

            let d = "";
            if (percentage >= 0.999) {
              // Fix for 100% slices: arcs fail at 360 degrees, so we draw a full donut manually
              d = `M ${center} ${center - radius} 
                   A ${radius} ${radius} 0 1 1 ${center} ${center + radius} 
                   A ${radius} ${radius} 0 1 1 ${center} ${center - radius} 
                   M ${center} ${center - innerRadius} 
                   A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center + innerRadius} 
                   A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center - innerRadius} Z`;
            } else {
              // Standard donut sector path
              const rad1 = ((startAngle - 90) * Math.PI) / 180;
              const rad2 = ((endAngle - 90) * Math.PI) / 180;

              const x1 = center + radius * Math.cos(rad1);
              const y1 = center + radius * Math.sin(rad1);
              const x2 = center + radius * Math.cos(rad2);
              const y2 = center + radius * Math.sin(rad2);

              const ix1 = center + innerRadius * Math.cos(rad1);
              const iy1 = center + innerRadius * Math.sin(rad1);
              const ix2 = center + innerRadius * Math.cos(rad2);
              const iy2 = center + innerRadius * Math.sin(rad2);

              const largeArc = sliceAngle > 180 ? 1 : 0;

              d = [
                `M ${ix1} ${iy1}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                `L ${ix2} ${iy2}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
                "Z",
              ].join(" ");
            }

            return (
              <path
                key={item.name}
                d={d}
                fill={COLORS[index % COLORS.length]}
                className="pie-slice"
                onClick={(e) => onSliceClick && onSliceClick(item, e)}
                title={getTooltip(item)}
              />
            );
          })}
        </svg>
        <div className="pie-hole-overlay">
          <div className="pie-total">
            <span className="pie-total-value">{total}</span>
            <span className="pie-total-label">Total</span>
          </div>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((item, index) => (
          <div
            key={item.name}
            className="legend-item"
            title={getTooltip(item)}
            onClick={(e) => onSliceClick && onSliceClick(item, e)}
          >
            <span
              className="legend-color"
              style={{ background: COLORS[index % COLORS.length] }}
            />
            <span className="legend-label" title={item.name}>
              {item.name}
            </span>
            <span className="legend-value">
              {item.value} ({Math.round((item.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
      {!isExpanded && (
        <div className="print-only-block mt-4 space-y-2">
          {data.map((item) => (
            <PrintStockList 
              key={item.name} 
              stocks={item.stocks} 
              label={item.name} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SimpleBarChart = ({ data, onBarClick, isExpanded }) => {
  const max = Math.max(...data.map((d) => d.value));
  if (max === 0) return <div className="chart-empty">No data available</div>;

  // Reduce gap if there are many items (e.g. 15-20 sectors)
  const dynamicGap = data.length > 10 ? "2px" : "8px";

  return (
    <div className="chart-container bar-chart-container">
      <div className="bar-chart-grid">
        {/* Y-Axis lines could go here if we wanted complex CSS grid */}
        <div className="bar-chart-bars" style={{ gap: dynamicGap }}>
          {data.map((item, index) => {
            const height = (item.value / max) * 100;
            const color = COLORS[index % COLORS.length];
            return (
              <div
                key={item.name}
                className="bar-column"
                onClick={(e) => onBarClick && onBarClick(item, e)}
              >
                <div className="bar-wrapper" title={getTooltip(item)}>
                  <div className="bar-value">{item.value}</div>
                  <div
                    className="bar"
                    style={{
                      height: `${Math.max(height, 1)}%`,
                      backgroundColor: color,
                      color: color, // support for currentColor print hack
                    }}
                  />
                </div>
                <div className="bar-label" title={item.name}>
                  {item.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!isExpanded && (
        <div className="print-only-block mt-4 space-y-1">
          {data.map((item) => (
            <PrintStockList
              key={item.name}
              stocks={item.stocks}
              label={item.name}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MASummaryWidget = ({ data, onBarClick, isExpanded }) => {
  // data comes in as array of { name: 'Above 200 SMA', value: 12, rawData: { 'Above 5, 10, ...': { value: 5, stocks: [] } }, stocks: [...] }
  if (!data || data.length === 0) return <div className="chart-empty">No MA data available</div>;

  // Aggregate above vs below counts for each MA using the RAW internal data if present
  const internalRawData = [];
  data.forEach(item => {
    if (item.rawData && Object.keys(item.rawData).length > 0) {
      Object.entries(item.rawData).forEach(([rawName, rawVal]) => {
        internalRawData.push({ name: rawName, value: rawVal.value, stocks: rawVal.stocks });
      });
    } else {
      internalRawData.push(item);
    }
  });

  const masToTrack = ["5", "10", "21", "50", "200"];
  const maCounts = masToTrack.reduce((acc, ma) => {
    acc[ma] = { above: 0, below: 0, aboveStocks: [], belowStocks: [] };
    return acc;
  }, {});

  let belowAllCount = 0;
  const belowAllStocks = [];
  
  let aboveAllCount = 0;
  const aboveAllStocks = [];

  internalRawData.forEach((item) => {
    const text = (item.name || "").toLowerCase();
    
    // Check global states
    if (text.includes("below all")) {
      belowAllCount += item.value;
      belowAllStocks.push(...item.stocks);
      // If below all, it's below each individual MA
      masToTrack.forEach(ma => {
        maCounts[ma].below += item.value;
        maCounts[ma].belowStocks.push(...item.stocks);
      });
      return;
    }

    let isAboveAll = true;

    // Check individual MAs
    masToTrack.forEach(ma => {
      const maNum = parseInt(ma);
      const regex = new RegExp(`\\b${ma}\\b`);
      
      // Basic check: does the text explicitly mention this MA is above?
      let isAbove = text.includes("above") && (text.includes("all") || regex.test(text));
      
      // Hierarchy check: if it says "Above 200", it implies 50, 21, 10, 5
      if (!isAbove && text.includes("above")) {
        const matches = text.match(/\d+/g);
        if (matches) {
          const highestNum = Math.max(...matches.map(n => parseInt(n)));
          if (maNum <= highestNum) isAbove = true;
        }
      }

      if (isAbove) {
        maCounts[ma].above += item.value;
        maCounts[ma].aboveStocks.push(...item.stocks);
      } else {
        maCounts[ma].below += item.value;
        maCounts[ma].belowStocks.push(...item.stocks);
        isAboveAll = false;
      }
    });

    if (isAboveAll) {
      aboveAllCount += item.value;
      aboveAllStocks.push(...item.stocks);
    }
  });

  const generateStatusGroup = (label, count, stocks) => {
    return { name: label, value: count, stocks: stocks, paramLabel: "Moving Averages" };
  };

  return (
    <div className="chart-container ma-summary-container">
      <div className="ma-summary-content">
        <div className="ma-summary-stats">
          <div 
            className="ma-stat-card bullish"
            onClick={(e) => onBarClick && onBarClick(generateStatusGroup("Above All MAs", aboveAllCount, aboveAllStocks), e)}
            title="Click to view stocks"
          >
            <div className="ma-stat-badge">BULLISH</div>
            <div className="ma-stat-value">{aboveAllCount}</div>
            <div className="ma-stat-label">Above All</div>
          </div>
          
          <div 
            className="ma-stat-card bearish"
            onClick={(e) => onBarClick && onBarClick(generateStatusGroup("Below All MAs", belowAllCount, belowAllStocks), e)}
            title="Click to view stocks"
          >
            <div className="ma-stat-badge">BEARISH</div>
            <div className="ma-stat-value">{belowAllCount}</div>
            <div className="ma-stat-label">Below All</div>
          </div>
        </div>

        <div className="ma-bars themed-scroll">
          {masToTrack.map(ma => {
            const counts = maCounts[ma];
            const total = counts.above + counts.below;
            if (total === 0) return null;
            
            const abovePct = Math.round((counts.above / total) * 100);
            
            return (
              <div key={ma} className="ma-row">
                <div className="ma-row-details">
                  <div className="ma-row-header">
                    <div className="ma-period-label">
                      <span className="ma-label-text">SMA</span>
                      <span className="ma-label-num">{ma}</span>
                    </div>
                    
                    <div className="ma-row-stats">
                      <span 
                        className="ma-count-chip bullish"
                        onClick={(e) => onBarClick && onBarClick(generateStatusGroup(`Above ${ma} MA`, counts.above, counts.aboveStocks), e)}
                      >
                        {counts.above} ↑
                      </span>
                      <span 
                        className="ma-count-chip bearish"
                        onClick={(e) => onBarClick && onBarClick(generateStatusGroup(`Below ${ma} MA`, counts.below, counts.belowStocks), e)}
                      >
                        {counts.below} ↓
                      </span>
                    </div>
                  </div>
                  
                  <div className="ma-progress-container">
                    <div className="ma-progress-track">
                      <div 
                        className="ma-progress-fill bullish" 
                        style={{ width: `${abovePct}%` }}
                        onClick={(e) => onBarClick && onBarClick(generateStatusGroup(`Above ${ma} MA`, counts.above, counts.aboveStocks), e)}
                      />
                      <div 
                        className="ma-progress-fill bearish" 
                        style={{ width: `${100-abovePct}%` }}
                        onClick={(e) => onBarClick && onBarClick(generateStatusGroup(`Below ${ma} MA`, counts.below, counts.belowStocks), e)}
                      />
                    </div>
                    <div className="ma-progress-marker" style={{ left: '50%' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {!isExpanded && (
        <div className="print-only-block mt-4 space-y-1">
          <PrintStockList stocks={aboveAllStocks} label="Above All MAs" />
          <PrintStockList stocks={belowAllStocks} label="Below All MAs" />
        </div>
      )}
    </div>
  );
};

// Helper to create histogram bins for expanded view
const createHistogramData = (data, label) => {
  if (!data || data.length === 0) return [];
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max)
    return [
      {
        name: `${min}`,
        value: values.length,
        stocks: data.map((d) => d.symbol),
        paramLabel: label,
      },
    ];

  const binCount = 5; // 5 bins for readability
  const range = max - min;
  const step = range / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * step;
    const end = min + (i + 1) * step;
    // Format range nicely
    const name = `${start.toLocaleString(undefined, { maximumFractionDigits: 1 })} - ${end.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
    return {
      name,
      value: 0,
      stocks: [],
      paramLabel: label,
    };
  });

  data.forEach((item) => {
    let idx = Math.floor((item.value - min) / step);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].value++;
    bins[idx].stocks.push(item.symbol);
  });

  return bins.filter((b) => b.value > 0);
};

const DotPlot = ({ data, onPointClick, isExpanded }) => {
  const [hoveredDot, setHoveredDot] = useState(null); // Will store the index of the dot
  if (!data || data.length === 0)
    return <div className="chart-empty">No numeric data</div>;

  const { points, ticks } = useMemo(() => {
    const values = data.map((d) => d.value);
    const minValRaw = Math.min(...values);
    const maxValRaw = Math.max(...values);
    const rawRange = maxValRaw - minValRaw;

    // "Nice numbers" algorithm for clean axes
    const calculateNiceScale = (min, max) => {
      const range = max - min || 1;
      const exponent = Math.floor(Math.log10(range));
      const fraction = range / Math.pow(10, exponent);
      let niceStep;

      if (fraction < 1.5) niceStep = 1;
      else if (fraction < 3) niceStep = 2;
      else if (fraction < 7) niceStep = 5;
      else niceStep = 10;

      const step = niceStep * Math.pow(10, exponent - 1) * 2.5; // Targeting ~4-5 ticks
      const niceMin = Math.floor(min / step) * step;
      const niceMax = Math.ceil(max / step) * step;

      return { niceMin, niceMax, step };
    };

    const { niceMin: minVal, niceMax: maxVal } = calculateNiceScale(
      minValRaw,
      maxValRaw,
    );
    const range = maxVal - minVal || 1;

    // Generate 5 evenly spaced ticks for the Y-axis
    const ticks = [];
    for (let i = 0; i <= 4; i++) {
      const val = minVal + (maxVal - minVal) * (i / 4);
      ticks.push({
        value: val,
        percent: (i / 4) * 100,
      });
    }

    const pointsWithPos = data.map((item, i) => {
      // Create a "scatter" effect on the X-axis so dots don't stack vertically
      const seed =
        (item.symbol || "")
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0) +
        i * 997;
      const randomX =
        Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000);

      return {
        ...item,
        xPercent: 10 + randomX * 80, // Keep dots between 10% and 90% of the width
        yPercent: ((item.value - minVal) / range) * 100,
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
          <div
            key={i}
            className="dot-plot-yaxis-label"
            style={{ bottom: `${t.percent}%` }}
          >
            {t.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        ))}
      </div>

      {/* Plot Area */}
      <div className="dot-plot-area">
        {[0, 25, 50, 75, 100].map((p) => (
          <div
            key={p}
            className="dot-plot-gridline"
            style={{ bottom: `${p}%` }}
          />
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
              title={
                item.symbol
                  ? `${item.symbol}: ${item.value}`
                  : `Value: ${item.value}`
              }
              style={{
                left: `${item.xPercent}%`,
                bottom: `${item.yPercent}%`,
                transform: isHovered
                  ? "translate(-50%, 50%) scale(1.8)"
                  : "translate(-50%, 50%)",
                opacity: isHovered ? 1 : 0.7,
                zIndex: isHovered ? 20 : 10,
              }}
            />
          );
        })}
      </div>
      {!isExpanded && (
        <div className="print-only-block mt-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Metric Values:
          </div>
          <div className="grid grid-cols-4 gap-x-4 gap-y-2">
            {points.map((item, i) => (
              <div
                key={item.symbol || i}
                className="text-[11px] flex justify-between border-b border-slate-100 pb-1"
              >
                <span className="font-bold">{item.symbol}</span>
                <span className="font-mono text-slate-600">
                  {typeof item.value === "number"
                    ? item.value.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DateHeatmapChart = ({ data, onPointClick, isExpanded }) => {
  const [selectedYear, setSelectedYear] = useState("All");

  if (!data || data.length === 0)
    return <div className="chart-empty">No date data</div>;

  // 1. Aggregate dates
  const fullCountMap = {};
  const allYears = new Set();

  data.forEach((item) => {
    const d = parseInstitutionalDate(item.value);
    if (!d) return;

    // Track valid Years present
    const yStr = String(d.getFullYear()).padStart(4, "0");
    allYears.add(yStr);

    const dateStr = `${yStr}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!fullCountMap[dateStr]) {
      fullCountMap[dateStr] = { count: 0, items: [], name: dateStr, value: 0 };
    }
    fullCountMap[dateStr].count += 1;
    fullCountMap[dateStr].items.push(item);
    fullCountMap[dateStr].value = fullCountMap[dateStr].count;
  });

  const validYears = Array.from(allYears).sort((a, b) => b.localeCompare(a));
  const isMultiYear = validYears.length > 1;

  // If "All" is selected but we have multiple years, just default to the most recent year to prevent huge empty grids.
  const activeYear = selectedYear;

  // Filter map to active year
  const countMap = {};
  Object.keys(fullCountMap).forEach((key) => {
    if (activeYear === "All" || key.startsWith(activeYear)) {
      countMap[key] = fullCountMap[key];
    }
  });

  const validDates = Object.keys(countMap).sort();
  if (validDates.length === 0)
    return <div className="chart-empty">Invalid dates</div>;

  // Find overall min and max date strings
  const minDateStr = validDates[0];
  const maxDateStr = validDates[validDates.length - 1];

  // Parse YYYY-MM-DD manually to avoid timezone shift
  const parseLocal = (str) => {
    const [y, m, d] = str.split("-").map(Number);
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
  const maxCount = Math.max(...Object.values(countMap).map((c) => c.count));

  // Generate grid
  const columns = [];
  let curr = new Date(minDate);
  while (curr <= maxDate) {
    const colDates = [];
    for (let i = 0; i < 7; i++) {
      // Build YYYY-MM-DD
      const y = String(curr.getFullYear()).padStart(4, "0");
      const m = String(curr.getMonth() + 1).padStart(2, "0");
      const dStr = String(curr.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${dStr}`;

      colDates.push({
        date: dateKey,
        data: countMap[dateKey] || null,
      });
      curr.setDate(curr.getDate() + 1);
    }
    columns.push(colDates);
  }

  // Theming base color - Emerald for "thick green" contribution chart feel
  const getColor = (count) => {
    // Empty slot
    if (count === 0) return "rgba(100, 116, 139, 0.15)";
    if (maxCount === 1) return "#10b981"; // Medium green for single-stock peaks

    const ratio = count / maxCount;
    // Standard contribution intensity (Light -> Dark Emerald)
    if (ratio <= 0.25) return "#6ee7b7"; // Emerald 300 (Light)
    if (ratio <= 0.5) return "#10b981";  // Emerald 500 (Medium)
    if (ratio <= 0.75) return "#059669"; // Emerald 600 (Dark)
    return "#064e3b"; // Emerald 900 (Deepest)
  };

  // Identify months for labels
  const monthLabels = [];
  let lastMonthKey = "";
  columns.forEach((col, xIndex) => {
    const d = parseLocal(col[0].date);
    const mKey = `${d.getFullYear()}-${d.getMonth()}`;
    if (mKey !== lastMonthKey) {
      // Include Year if it's Jan or if it's the first label and we have multi-year data
      const showYear = d.getMonth() === 0 || (xIndex === 0 && isMultiYear);
      monthLabels.push({
        name: d.toLocaleString("default", { month: "short" }) + (showYear ? ` '${String(d.getFullYear()).slice(2)}` : ""),
        x: xIndex,
      });
    }
    lastMonthKey = mKey;
  });

  return (
    <div
      className="chart-container heatmap-container"
      style={{ position: "relative" }}
    >
      {isMultiYear && (
        <div
          style={{
            position: "absolute",
            top: "-46px",
            right: "40px",
            zIndex: 10,
          }}
        >
          <select
            className="select-control compact"
            value={activeYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{
              padding: "2px 20px 2px 8px",
              fontSize: "11px",
              height: "24px",
            }}
          >
            {validYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            <option value="All">All Years</option>
          </select>
        </div>
      )}

      <div className="heatmap-wrapper">
        {/* Month Labels */}
        <div
          className="heatmap-months"
          style={{ minWidth: `${columns.length * 15}px` }}
        >
          {monthLabels.map((lbl, i) => (
            <span
              key={i}
              className="heatmap-month-label"
              style={{ left: `${lbl.x * 15}px`, transform: "translateX(-50%)" }}
            >
              {lbl.name}
            </span>
          ))}
        </div>

        <div className="heatmap-grid-wrapper">
          {/* Day of week labels */}
          <div className="heatmap-days">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
              <div key={i} className="heatmap-day-label">
                {i % 2 === 1 ? day : ""}
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
                        const stockList = cell.data.items.map((i) => i.symbol);
                        onPointClick(
                          { name: cell.date, value: count, stocks: stockList },
                          e,
                        );
                      }
                    }}
                    title={
                      count > 0 ? `${cell.date}: ${count} stocks` : cell.date
                    }
                    style={{
                      backgroundColor: getColor(count),
                      cursor: count > 0 ? "pointer" : "default",
                      opacity: count > 0 ? 0.9 : 1, // Non active cells stay solid
                    }}
                    onMouseEnter={(e) => {
                      if (count > 0) e.currentTarget.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      if (count > 0) e.currentTarget.style.opacity = "0.9";
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!isExpanded && (
        <div className="print-only-block mt-4 space-y-2">
          {Object.values(countMap)
            .sort((a, b) => b.name.localeCompare(a.name))
            .map((item) => (
              <PrintStockList
                key={item.name}
                stocks={item.items.map((i) => i.symbol)}
                label={item.name}
              />
            ))}
        </div>
      )}
    </div>
  );
};



const ExpandedView = ({ param, onClose, onChartClick }) => {
  const renderChart = () => {
    // This logic determines the best chart for the expanded view.
    // For categorical data, a pie chart gives a great overview of proportions.
    // For distributions, we show the detailed plot.
    switch (param.type) {
      case "numeric-distribution":
        const histData = createHistogramData(param.data, param.label);
        return <SimpleBarChart data={histData} onBarClick={onChartClick} isExpanded={true} />;
      case "date-timeline":
        return (
          <DateHeatmapChart
            data={param.data}
            onPointClick={(point, event) => onChartClick(point, event, param)}
            isExpanded={true}
          />
        );
      default:
        return param.id === "movingAverages" ? (
          <MASummaryWidget data={param.data} onBarClick={onChartClick} isExpanded={true} />
        ) : param.chartType === "bar" ? (
          <SimpleBarChart data={param.data} onBarClick={onChartClick} isExpanded={true} />
        ) : (
          <SimplePieChart data={param.data} onSliceClick={onChartClick} isExpanded={true} />
        );
    }
  };

  const renderDetailsList = () => {
    // For distribution plots, show a simple sorted list of stocks and their values.
    if (param.type === "numeric-distribution") {
      const histData = createHistogramData(param.data, param.label);
      return (
        <div className="detail-list-container themed-scroll flex-1 overflow-y-auto">
          {histData.map((group) => (
            <div
              key={group.name}
              className="detail-group"
              onClick={(e) => onChartClick(group, e)}
              title="Click to see deep analysis"
            >
              <div className="detail-group-header">
                <span className="detail-name">{group.name}</span>
                <span className="detail-count">{group.value} stocks</span>
              </div>
              <div className="stock-tag-list">
                {group.stocks && group.stocks.map((s) => (
                  <span key={s} className="stock-tag">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    } else if (param.type === "date-timeline") {
      const countMap = {};
      param.data.forEach((item) => {
        const d = parseInstitutionalDate(item.value);
        if (!d) return;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!countMap[dateStr])
          countMap[dateStr] = { name: dateStr, value: 0, stocks: [] };
        countMap[dateStr].value++;
        countMap[dateStr].stocks.push(item.symbol);
      });
      const sortedDates = Object.values(countMap).sort((a, b) =>
        b.name.localeCompare(a.name),
      );

      return (
        <div className="detail-list-container themed-scroll flex-1 overflow-y-auto pr-2">
          {sortedDates.map((group) => {
            // Format YYYY-MM-DD back to DD-MM-YYYY for display
            const [y, m, d] = group.name.split("-");
            const displayDate = `${d}-${m}-${y}`;
            const isPeak = group.value > 2;

            return (
              <div
                key={group.name}
                className={`detail-group ${isPeak ? "cluster-peak" : ""}`}
                onClick={(e) => onChartClick(group, e)}
                title="Click to see stocks on this date"
                style={{ padding: '12px', marginBottom: '12px' }}
              >
                <div className="detail-group-header" style={{ alignItems: 'center' }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {displayDate}
                    </span>
                    {isPeak && (
                      <span className="text-[9px] font-extrabold uppercase bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">
                        Peak Cluster
                      </span>
                    )}
                  </div>
                  <span className="detail-count text-slate-500 font-bold text-[12px]">
                    {group.value} Symbols
                  </span>
                </div>
                <div className="stock-tag-list mt-3">
                  {group.stocks &&
                    group.stocks.map((s) => (
                      <span
                        key={s}
                        className="stock-tag font-mono font-bold bg-white border border-slate-200 text-primary px-2 py-1 rounded shadow-sm hover:border-primary transition-colors"
                      >
                        {s}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // For categorical data, show groups and their stock lists.
    return (
      <div className="detail-list-container themed-scroll flex-1 overflow-y-auto">
        {param.data.map((group) => (
          <div
            key={group.name}
            className="detail-group"
            onClick={(e) => onChartClick(group, e)}
            title="Click to see deep analysis"
          >
            <div className="detail-group-header">
              <span className="detail-name">{group.name}</span>
              <span className="detail-count">{group.value} stocks</span>
            </div>
            <div className="stock-tag-list">
              {group.stocks && group.stocks.map((s) => (
                <span key={s} className="stock-tag">{s}</span>
              ))}
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
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="expanded-content flex flex-1 overflow-hidden p-4 gap-4">
        <div className="expanded-chart-section flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
          {renderChart()}
        </div>
        <div className="expanded-details-section w-1/3 min-w-[250px] flex flex-col border-l border-slate-200 dark:border-slate-700 pl-4">
          <h4 className="text-sm font-bold mb-2 text-slate-500 uppercase tracking-wider">
            Details
          </h4>
          {renderDetailsList()}
        </div>
      </div>
    </div>
  );
};

const SimpleTrendChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value));
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

  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
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
        <text
          x={width / 2}
          y={height - 15}
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="var(--text)"
        >
          Date
        </text>
        <text
          x={20}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90, 20, ${height / 2})`}
          fontSize="14"
          fontWeight="600"
          fill="var(--text)"
        >
          Stock Count
        </text>

        {/* Area Fill */}
        <polygon points={areaStr} fill="url(#trendGradient)" />

        {/* Line Stroke */}
        {data.length > 1 && (
          <polyline
            points={pointsStr}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data Points */}
        {points.map((p, i) => (
          <g key={i} className="trend-point-group">
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill="var(--panel)"
              stroke="var(--primary)"
              strokeWidth="2"
            />
            <rect
              x={p.x - 30}
              y={p.y - 35}
              width="60"
              height="24"
              rx="4"
              fill="var(--bg)"
              stroke="var(--border)"
              className="trend-tooltip-bg"
            />
            <text
              x={p.x}
              y={p.y - 19}
              textAnchor="middle"
              fontSize="12"
              fill="var(--text)"
              className="trend-tooltip-text"
            >
              {p.name}: {p.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const STORAGE_KEY = "tc_analytics_layout";

function getWeekRangeLabel(sundayDateStr) {
  if (!sundayDateStr) return "";
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

const AnalyticsDashboard = ({
  country,
  stocks,
  allWeeksData,
  aiSettings,
  parameters,
  weekKey,
  selectedWatchlistId,
  watchlists,
  analyticsLayout,
  onLayoutChange,
  onClose,
  sectors = [],
  availableTags = [],
  paramDefinitions = {},
  onUpdateStock = null,
}) => {
  const [expandedParam, setExpandedParam] = useState(null);
  const [categoryAnalysisData, setCategoryAnalysisData] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  const [widgetConfig, setWidgetConfig] = useState(analyticsLayout || {});

  // Sync widgetConfig with the provided analyticsLayout prop
  useEffect(() => {
    if (analyticsLayout) {
      setWidgetConfig(analyticsLayout);
    }
  }, [analyticsLayout]);

  const trendData = useMemo(() => {
    if (!allWeeksData) return [];
    return Object.entries(allWeeksData)
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by full date key
      .map(([date, weekData]) => {
        // Format date to be shorter (e.g., "10-24")
        const shortDate = date.substring(5);

        let validStocksCount = 0;
        const weekStocks = Object.values(weekData.stocks || {});

        if (selectedWatchlistId && selectedWatchlistId !== "all") {
          validStocksCount = weekStocks.filter((s) =>
            s.watchlists?.includes(selectedWatchlistId),
          ).length;
        } else {
          validStocksCount = weekStocks.length;
        }

        return {
          name: shortDate,
          value: validStocksCount,
        };
      });
  }, [allWeeksData, selectedWatchlistId]);

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    if (!selectedWatchlistId || selectedWatchlistId === "all") return stocks;
    return stocks.filter((s) => s.watchlists?.includes(selectedWatchlistId));
  }, [stocks, selectedWatchlistId]);

  const aggregatedData = useMemo(() => {
    if (!filteredStocks || !parameters || !Array.isArray(parameters)) return [];

    const systemMetrics = [];

    // 1. Sector Distribution
    const sectorCounts = {};
    filteredStocks.forEach((stock) => {
      const val = stock.sector || "Unspecified";
      if (!sectorCounts[val]) sectorCounts[val] = { value: 0, stocks: [] };
      sectorCounts[val].value++;
      sectorCounts[val].stocks.push(stock.symbol || stock.ticker || "Unknown");
    });

    systemMetrics.push({
      id: "sys_sector",
      label: "Sector Distribution",
      type: "pie", // Explicitly use pie chart for sectors
      data: Object.keys(sectorCounts)
        .map((k) => ({ name: k, paramLabel: "Sector", ...sectorCounts[k] }))
        .sort((a, b) => b.value - a.value),
    });

    // 2. Tradable Status
    const tradableCounts = {
      Yes: { value: 0, stocks: [] },
      No: { value: 0, stocks: [] },
    };
    filteredStocks.forEach((stock) => {
      const val = stock.tradable ? "Yes" : "No";
      tradableCounts[val].value++;
      tradableCounts[val].stocks.push(
        stock.symbol || stock.ticker || "Unknown",
      );
    });
    systemMetrics.push({
      id: "sys_tradable",
      label: "Tradable Status",
      type: "checkbox", // Forces Pie chart usually
      data: Object.keys(tradableCounts).map((k) => ({
        name: k,
        paramLabel: "Tradable",
        ...tradableCounts[k],
      })),
    });

    // 3. Tags Distribution
    const tagCounts = {};
    let hasTags = false;
    filteredStocks.forEach((stock) => {
      if (stock.tags && Array.isArray(stock.tags) && stock.tags.length > 0) {
        hasTags = true;
        stock.tags.forEach((tag) => {
          if (!tagCounts[tag]) tagCounts[tag] = { value: 0, stocks: [] };
          tagCounts[tag].value++;
          tagCounts[tag].stocks.push(stock.symbol || stock.ticker || "Unknown");
        });
      }
    });

    if (hasTags) {
      systemMetrics.push({
        id: "sys_tags",
        label: "Tags Distribution",
        type: "select",
        data: Object.keys(tagCounts)
          .map((k) => ({ name: k, paramLabel: "Tag", ...tagCounts[k] }))
          .sort((a, b) => b.value - a.value),
      });
    }

    // 4. Custom Parameters
    const paramMetrics = parameters.map((param) => {
      if (param.type === "number") {
        // For numbers, we want raw data points for the Dot Plot
        const rawData = filteredStocks
          .filter((s) => !isNaN(parseFloat(s.params?.[param.id])))
          .map((s) => ({
            symbol: s.symbol || s.ticker || "Unknown",
            value: parseFloat(s.params?.[param.id]),
          }))
          .sort((a, b) => a.value - b.value);
        return { ...param, data: rawData, type: "numeric-distribution" };
      } else if (param.type === "date") {
        // For dates, we want raw data points for the Timeline
        const rawData = filteredStocks
          .filter((s) => s.params?.[param.id])
          .map((s) => ({
            symbol: s.symbol || s.ticker || "Unknown",
            value: s.params?.[param.id],
          }))
          .sort((a, b) => {
            const dA = parseInstitutionalDate(a.value);
            const dB = parseInstitutionalDate(b.value);
            if (!dA || !dB) return 0;
            return dA - dB;
          });

        let span = 1; // Default span
        if (rawData.length > 0) {
          const validDates = rawData
            .map((d) => parseInstitutionalDate(d.value))
            .filter((d) => d && !isNaN(d.getTime()))
            .map((d) => d.getTime());

          if (validDates.length > 0) {
            const diffDays =
              (Math.max(...validDates) - Math.min(...validDates)) /
              (1000 * 60 * 60 * 24);

            if (diffDays > 150) {
              // > 5 months, take large space
              span = 3;
            } else if (diffDays > 45) {
              // 1.5 - 5 months, take 2 columns
              span = 2;
            }
          }
        }

        return { ...param, data: rawData, type: "date-timeline", span };
      } else {
        const counts = {}; // Key -> { value: count, stocks: [] }
        filteredStocks.forEach((stock) => {
          // Access the parameter value from the stock's params object
          let value = stock.params?.[param.id];

          // Handle checkbox booleans
          if (param.type === "checkbox") {
            value = value ? "Yes" : "No";
          }

          // Handle empty values
          if (value === undefined || value === null || value === "") {
            value = "Unspecified";
          }

          // --- SMART MOVING AVERAGE AGGREGATION ---
          let smartValue = value;
          if (param.id === "movingAverages" && value !== "Unspecified") {
            const valStr = String(value);
            if (valStr.toLowerCase().includes("below all")) {
              smartValue = "Below All MAs";
            } else if (valStr.includes("200")) {
              smartValue = "Above 200 SMA";
            } else if (valStr.includes("50")) {
              smartValue = "Above 50 SMA";
            } else if (valStr.includes("21")) {
              smartValue = "Above 21 SMA";
            } else if (valStr.includes("10")) {
              smartValue = "Above 10 SMA";
            } else if (valStr.includes("5")) {
              smartValue = "Above 5 SMA";
            }
          }

          const key = String(smartValue);
          if (!counts[key]) {
            counts[key] = { value: 0, stocks: [], rawData: {} };
          }
          counts[key].value += 1;
          counts[key].stocks.push(stock.symbol || stock.ticker || "Unknown");

          // Keep track of raw combination counts for the specialized Summary widget
          if (param.id === "movingAverages") {
            const rawKey = String(value);
            if (!counts[key].rawData[rawKey]) {
              counts[key].rawData[rawKey] = { value: 0, stocks: [] };
            }
            counts[key].rawData[rawKey].value += 1;
            counts[key].rawData[rawKey].stocks.push(stock.symbol || stock.ticker || "Unknown");
          }
        });

        let data = Object.keys(counts).map((key) => ({
          name: key,
          value: counts[key].value,
          stocks: counts[key].stocks,
          rawData: counts[key].rawData, // Include raw data for summary processing
          paramLabel: param.label,
        }));

        // Sort logic: Special handling for MAs and Liquidity
        if (param.id === "movingAverages") {
          const maOrder = ["Above 200 SMA", "Above 50 SMA", "Above 21 SMA", "Above 10 SMA", "Above 5 SMA", "Below All MAs", "Unspecified"];
          data.sort((a, b) => {
            const idxA = maOrder.indexOf(a.name);
            const idxB = maOrder.indexOf(b.name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return 0;
          });
        } else if (param.label && param.label.toLowerCase().includes("liquidity")) {
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
            data.sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { numeric: true }),
            );
          }
        } else {
          data.sort((a, b) => b.value - a.value); // Default: Sort by count descending
        }

        return { ...param, data };
      }
    });

    return [...systemMetrics, ...paramMetrics];
  }, [stocks, parameters]);

  // Persist config to central store
  useEffect(() => {
    if (onLayoutChange && JSON.stringify(widgetConfig) !== JSON.stringify(analyticsLayout)) {
      onLayoutChange(widgetConfig);
    }
  }, [widgetConfig, onLayoutChange, analyticsLayout]);

  // Handle Click Outside and Global Escape Key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showSettings &&
        settingsRef.current &&
        !settingsRef.current.contains(event.target)
      ) {
        setShowSettings(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
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

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSettings, expandedParam, onClose]);

  // Merge data with config to determine order and visibility
  const displayItems = useMemo(() => {
    // 1. Attach config to data
    const items = aggregatedData.map((item) => {
      const config = widgetConfig[item.id] || {};

      // Determine chart type (user preference > default logic)
      let chartType = config.chartType;
      if (!chartType) {
        if (item.id === "movingAverages") {
          chartType = "summary";
        } else if (
          item.type === "numeric-distribution" ||
          item.type === "date-timeline"
        ) {
          chartType = "special"; // These don't toggle between pie/bar
        } else {
          chartType =
            item.type === "checkbox" ||
            item.type === "pie" ||
            item.data.length <= 5
              ? "pie"
              : "bar";
        }
      }

      return {
        ...item,
        visible: config.visible !== false, // Default true
        order: config.order !== undefined ? config.order : 9999,
        chartType,
      };
    });

    // 2. Sort by order, then by original index (stable sort for new items)
    return items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return aggregatedData.indexOf(a) - aggregatedData.indexOf(b);
    });
  }, [aggregatedData, widgetConfig]);

  const handleToggleVisibility = (id) => {
    setWidgetConfig((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !(prev[id]?.visible !== false) },
    }));
  };

  const handleToggleChartType = (id, currentType) => {
    setWidgetConfig((prev) => ({
      ...prev,
      [id]: { ...prev[id], chartType: currentType === "pie" ? "bar" : "pie" },
    }));
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (sourceId === targetId) return;

    const newItems = [...displayItems];
    const sourceIndex = newItems.findIndex((i) => i.id === sourceId);
    const targetIndex = newItems.findIndex((i) => i.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [moved] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, moved);

    const newConfig = { ...widgetConfig };
    newItems.forEach((item, index) => {
      newConfig[item.id] = {
        ...newConfig[item.id],
        order: index,
        visible: item.visible,
      };
    });
    setWidgetConfig(newConfig);
  };

  const handleChartClick = (data, event, param = null) => {
    event.stopPropagation();

    const resultData =
      param && data.symbol
        ? {
            name: `${data.symbol}: ${data.value}`,
            stocks: [data.symbol],
            paramLabel: param.label,
          }
        : param && !data.paramLabel
          ? { ...data, paramLabel: param.label }
          : data;

    setCategoryAnalysisData({ data: resultData, event });
  };

  const activeWatchlistName =
    selectedWatchlistId === "all"
      ? "All Stocks"
      : watchlists?.find((w) => w.id === selectedWatchlistId)?.name ||
        "All Stocks";

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="analytics-header">
          <div>
            <h2>Analytics Dashboard</h2>
            <p className="analytics-subtitle">
              Weekly performance for <strong>{activeWatchlistName}</strong> •{" "}
              {getWeekRangeLabel(weekKey)}
            </p>
          </div>
          <div className="analytics-header-actions">
            <button
              className="nav-icon-btn-v2"
              onClick={() => window.print()}
              title="Download Report"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="15" x2="12" y2="3" />
                <polyline points="8 11 12 15 16 11" />
                <line x1="4" y1="21" x2="20" y2="21" />
              </svg>
            </button>
            <div className="settings-wrapper" ref={settingsRef}>
              <button
                className="nav-icon-btn-v2"
                onClick={() => setShowSettings(!showSettings)}
                title="Configure Widgets"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {showSettings && (
                <div className="settings-popover">
                  <h4>Visible Widgets</h4>
                  <div className="settings-list">
                    {displayItems.map((item) => (
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
            <button className="close-btn" onClick={onClose} title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="analytics-content">
          {trendData.length > 0 && (
            <div className="chart-card trend-card">
              <h3 className="chart-title">
                Weekly {activeWatchlistName} trend
              </h3>
              <SimpleTrendChart data={trendData} />
              {/* PDF-Only: List of stocks for the first page summary */}
              <div className="print-only-block trend-print-stocks mt-8 pt-4 border-t border-slate-200">
                <PrintStockList 
                  stocks={filteredStocks.map(s => s.symbol || s.ticker)} 
                  label={`${activeWatchlistName} in Current Selection`} 
                />
              </div>
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
              {displayItems
                .filter((i) => i.visible)
                .map((item) => (
                  <div
                    key={item.id}
                    className={`chart-card ${item.span ? `span-${item.span}` : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", item.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, item.id)}
                  >
                    <div className="chart-card-header">
                      <h3 className="chart-title">{item.label}</h3>
                      <div className="chart-card-actions">
                        {item.type !== "numeric-distribution" &&
                          item.type !== "date-timeline" && 
                          item.id !== "movingAverages" && (
                            <button
                              className="icon-btn small chart-toggle-btn"
                              onClick={() =>
                                handleToggleChartType(item.id, item.chartType)
                              }
                              title={
                                item.chartType === "pie"
                                  ? "Switch to Bar Chart"
                                  : "Switch to Pie Chart"
                              }
                            >
                              {item.chartType === "pie" ? (
                                <BarChartIcon />
                              ) : (
                                <PieChartIcon />
                              )}
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
                      {item.type === "numeric-distribution" ? (
                        <DotPlot
                          data={item.data}
                          onPointClick={(point, event) =>
                            handleChartClick(point, event, item)
                          }
                        />
                      ) : item.type === "date-timeline" ? (
                        <DateHeatmapChart
                          data={item.data}
                          onPointClick={(point, event) =>
                            handleChartClick(point, event, item)
                          }
                        />
                      ) : item.id === "movingAverages" ? (
                        <MASummaryWidget
                          data={item.data}
                          onBarClick={(data, e) => handleChartClick(data, e, item)}
                        />
                      ) : item.chartType === "pie" ? (
                        <SimplePieChart
                          data={item.data}
                          onSliceClick={(data, e) => handleChartClick(data, e, item)}
                        />
                      ) : (
                        <SimpleBarChart
                          data={item.data}
                          onBarClick={(data, e) => handleChartClick(data, e, item)}
                        />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
        {/* PDF-Only Footer: Copyright & Branding */}
        <div className="print-only-block mt-12 py-8 text-center border-t border-slate-100 text-[11px] text-slate-400 font-medium font-sans">
          © {new Date().getFullYear()} TradeClarity.market. All rights reserved.
        </div>
      </div>
      {categoryAnalysisData && (
        <CategoryAnalysisView
          popupData={categoryAnalysisData}
          onClose={() => setCategoryAnalysisData(null)}
          country={country || "IN"}
          weekData={allWeeksData[weekKey] || {}}
          aiSettings={aiSettings}
          sectors={sectors}
          availableTags={availableTags}
          paramDefinitions={paramDefinitions}
          onUpdateStock={onUpdateStock}
          weekInfo={getWeekRangeLabel(weekKey)}
        />
      )}
    </div>
  );
};

export default AnalyticsDashboard;
