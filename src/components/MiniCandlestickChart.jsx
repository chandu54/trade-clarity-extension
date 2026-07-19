import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, CandlestickSeries, LineSeries } from 'lightweight-charts';

export default function MiniCandlestickChart({ 
  data, 
  country, 
  onClick = () => {}, 
  hideHeaders = false,
  interactive = false,
  disableZoom = false,
  height = '150px',
  accountCapital,
  maSettings = {}
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!data || !chartContainerRef.current) return;

    const {
      prevClose = 0,
      candlesticks = [],
      avgEntryPrice,
      avgExitPrice,
      activeStopLoss,
      transactions,
      isClosed: propIsClosed,
      totalBought = 0,
      openQty = 0
    } = data;

    const hasPosition = typeof avgEntryPrice === 'number' && avgEntryPrice > 0;
    const isClosed = propIsClosed || (totalBought > 0 && openQty <= 0);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Theme-Aware Chart Colors (Respecting Global CSS Variables)
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: textColor,
        attributionLogo: false,
        fontSize: 10,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { 
          visible: true, 
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          style: 2, // Dashed
        },
      },
      timeScale: { 
        visible: interactive,
        borderVisible: false,
        timeVisible: true,
        rightOffset: 8,
        fixLeftEdge: true,
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        entireTextOnly: true,
        scaleMargins: { top: 0.05, bottom: 0.05 },
        ticksVisible: false,
        minimumWidth: 60,
        alignLabels: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { 
          visible: interactive,
          labelVisible: interactive,
          color: 'rgba(56, 189, 248, 0.4)',
          style: 1, 
        },
        horzLine: { 
          visible: true,
          labelVisible: true,
          color: 'rgba(56, 189, 248, 0.4)',
          style: 1,
        },
      },
      handleScroll: {
        mouseWheel: interactive && !disableZoom,
        pressedMouseMove: interactive,
        horzTouchDrag: interactive,
        vertTouchDrag: interactive,
      },
      handleScale: {
        mouseWheel: interactive && !disableZoom,
        pinch: interactive && !disableZoom,
        axisPressedMouseMove: interactive,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    if (candlesticks && candlesticks.length > 0) {
      series.setData(candlesticks);

      // Add moving average lines if maSettings is provided
      if (maSettings) {
        const maColors = {
          '5': '#10b981', // green
          '10': '#06b6d4', // cyan
          '21': '#3b82f6', // blue
          '50': '#f59e0b', // yellow/orange
          '200': '#ef4444' // red
        };

        Object.entries(maSettings).forEach(([maKey, config]) => {
          if (config && config.visible) {
            const period = parseInt(maKey, 10);
            if (!isNaN(period)) {
              const smaData = calculateSMA(candlesticks, period);
              if (smaData.length > 0) {
                const lineSeries = chart.addSeries(LineSeries, {
                  color: config.color || maColors[maKey] || '#8b5cf6',
                  lineWidth: config.thickness || 1.2,
                  title: `${maKey} SMA`,
                  priceLineVisible: false,
                });
                lineSeries.setData(smaData);
              }
            }
          }
        });
      }



      // Add price lines for entry & stop‑loss only when the card represents a position
      if (hasPosition) {
        if (avgEntryPrice) {
          series.createPriceLine({
            price: avgEntryPrice,
            color: '#3b82f6', // entry blue
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'ENTRY',
          });
        }
        if (isClosed && avgExitPrice) {
          series.createPriceLine({
            price: avgExitPrice,
            color: '#fbbf24', // EXIT yellow/orange
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'EXIT',
          });
        } else if (!isClosed && activeStopLoss) {
          series.createPriceLine({
            price: activeStopLoss,
            color: '#ef4444', // SL red
            lineWidth: 1,
            lineStyle: 3, // Dotted
            axisLabelVisible: true,
            title: 'SL',
          });
        }

          // Add markers for Buy & Sell transactions
          if (transactions) {
            // Clear any existing markers (prevents duplicate markers on re‑render)
            if (typeof series.setMarkers === 'function') {
              series.setMarkers([]);
            }
            const markers = [];
            
            transactions.forEach(t => {
              if (t.date) {
                const matchedCandle = candlesticks.find(c => {
                  let cTimeStr = '';
                  if (typeof c.time === 'number') {
                    cTimeStr = new Date(c.time * 1000).toISOString().split('T')[0];
                  } else if (typeof c.time === 'string') {
                    cTimeStr = c.time;
                  } else if (c.time && typeof c.time === 'object' && c.time.year) {
                    cTimeStr = `${c.time.year}-${String(c.time.month).padStart(2, '0')}-${String(c.time.day).padStart(2, '0')}`;
                  }
                  return cTimeStr === t.date;
                });

                if (matchedCandle) {
                  const isBuy = t.type === 'Buy';
                  markers.push({
                    time: matchedCandle.time,
                    position: isBuy ? 'belowBar' : 'aboveBar',
                    color: isBuy ? '#3b82f6' : '#fbbf24',
                    shape: isBuy ? 'arrowUp' : 'arrowDown',
                    size: 1.1,
                  });
                }
              }
            });

            if (markers.length > 0) {
              markers.sort((a, b) => {
                const aTime = typeof a.time === 'string' ? a.time : (typeof a.time === 'number' ? a.time : 0);
                const bTime = typeof b.time === 'string' ? b.time : (typeof b.time === 'number' ? b.time : 0);
                return aTime > bTime ? 1 : -1;
              });
              // Guard against missing setMarkers method (older lightweight-charts versions)
              if (typeof series.setMarkers === 'function') {
                series.setMarkers(markers);
              } else if (typeof series.update === 'function') {
                series.applyOptions({ markers });
              }
            }
          }
      }

      chart.timeScale().fitContent();

      // Only draw default prevClose line if it's not an active journal position card
      if (interactive && !hasPosition) {
        series.createPriceLine({
          price: prevClose,
          color: 'rgba(128, 128, 128, 0.5)',
          lineWidth: 1,
          lineStyle: 3, // Dotted
          axisLabelVisible: true,
          title: '', 
        });
      }
    }

    chartRef.current = chart;
    seriesRef.current = series;

    let lastWidth = 0;
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height: observedHeight } = entries[0].contentRect;
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(observedHeight);
      
      if (roundedWidth !== lastWidth || roundedHeight !== lastHeight) {
        lastWidth = roundedWidth;
        lastHeight = roundedHeight;
        chartRef.current.applyOptions({ width: roundedWidth, height: roundedHeight });
        chartRef.current.timeScale().fitContent();
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme' && chartRef.current) {
          const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';
          const newTextColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a';
          chartRef.current.applyOptions({
            layout: { textColor: newTextColor },
            grid: { horzLines: { color: isDarkNow ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' } }
          });
        }
      });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.remove();
    };
  }, [data, interactive, disableZoom, maSettings]);

  if (!data) return null;

  const {
    symbol,
    longName,
    currentPrice = 0,
    periodChangePct = 0
  } = data;

  // Currency formatting based on country
  const currencySymbol = country === 'US' ? '$' : '₹';
  const locale = country === 'US' ? 'en-US' : 'en-IN';
  const formattedPrice = currentPrice.toLocaleString(locale, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  const handleOpenTradingView = (e) => {
    e.stopPropagation();
    const url = country === 'IN' 
      ? `https://www.tradingview.com/chart/?symbol=NSE:${symbol}` 
      : `https://www.tradingview.com/chart/?symbol=${symbol}`;
    window.open(url, '_blank');
  };

  // Position detection
  const hasPosition = typeof data.avgEntryPrice === 'number' && data.avgEntryPrice > 0;

  // Position specific calculations
  const openQty = Number(data.openQty || 0);
  const totalBought = Number(data.totalBought || 0);
  const totalSold = Number(data.totalSold || 0);
  const isClosed = data.isClosed || (totalBought > 0 && openQty <= 0);
  const cmpVal = currentPrice || data.livePrice || 0;
  const comparisonVal = isClosed ? (data.avgExitPrice || cmpVal) : cmpVal;
  const positionValue = comparisonVal * openQty;

  const positionSizePct = (accountCapital > 0) 
    ? (positionValue / accountCapital) * 100 
    : 0;

  const returnPct = data.avgEntryPrice > 0 
    ? (data.isLong !== false 
        ? ((comparisonVal - data.avgEntryPrice) / data.avgEntryPrice) * 100 
        : ((data.avgEntryPrice - comparisonVal) / data.avgEntryPrice) * 100)
    : 0;

  const rMultiple = Number(data.rMultiple || 0);
  const totalPnL = Number(data.totalPnL || 0);

  // Formatting compact currencies
  const formatPositionValue = (val) => {
    const absVal = Math.abs(val);
    if (country === 'US') {
      if (absVal >= 1e6) return `${currencySymbol}${(absVal / 1e6).toFixed(1)}M`;
      if (absVal >= 1e3) return `${currencySymbol}${(absVal / 1e3).toFixed(1)}K`;
      return `${currencySymbol}${absVal.toFixed(2)}`;
    } else {
      if (absVal >= 1e7) return `${currencySymbol}${(absVal / 1e7).toFixed(1)}Cr`;
      if (absVal >= 1e5) return `${currencySymbol}${(absVal / 1e5).toFixed(1)}L`;
      if (absVal >= 1e3) return `${currencySymbol}${(absVal / 1e3).toFixed(1)}K`;
      return `${currencySymbol}${absVal.toFixed(2)}`;
    }
  };

  const formatPnLValue = (val) => {
    const absVal = Math.abs(val);
    const sign = val >= 0 ? '+' : '-';
    if (country === 'US') {
      if (absVal >= 1e6) return `${sign}${currencySymbol}${(absVal / 1e6).toFixed(2)}M`;
      if (absVal >= 1e3) return `${sign}${currencySymbol}${(absVal / 1e3).toFixed(1)}K`;
      return `${sign}${currencySymbol}${absVal.toFixed(2)}`;
    } else {
      if (absVal >= 1e7) return `${sign}${currencySymbol}${(absVal / 1e7).toFixed(2)}Cr`;
      if (absVal >= 1e5) return `${sign}${currencySymbol}${(absVal / 1e5).toFixed(2)}L`;
      if (absVal >= 1e3) return `${sign}${currencySymbol}${(absVal / 1e3).toFixed(1)}K`;
      return `${sign}${currencySymbol}${absVal.toFixed(2)}`;
    }
  };

  const getHoldingDuration = () => {
    if (!data.transactions || data.transactions.length === 0) return 'Holding 0d';
    const buys = data.transactions.filter(t => t.type === 'Buy');
    if (buys.length === 0) return 'Holding 0d';
    const firstBuyDateStr = buys.reduce((earliest, b) => {
      if (!b.date) return earliest;
      if (!earliest) return b.date;
      return b.date < earliest ? b.date : earliest;
    }, '');
    if (!firstBuyDateStr) return 'Holding 0d';
    
    const startDate = new Date(firstBuyDateStr);
    startDate.setHours(0, 0, 0, 0);
    
    let endDate = new Date();
    if (data.isClosed && data.transactions.length > 0) {
      const lastTxDateStr = data.transactions.reduce((latest, t) => {
        if (!t.date) return latest;
        if (!latest) return t.date;
        return t.date > latest ? t.date : latest;
      }, '');
      if (lastTxDateStr) {
        endDate = new Date(lastTxDateStr);
      }
    }
    endDate.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    return `Holding ${diffDays}d`;
  };

  const formattedValue = formatPositionValue(positionValue);
  const formattedPnL = formatPnLValue(totalPnL);
  const holdingDuration = getHoldingDuration();

  const formattedEntryPrice = data.avgEntryPrice ? data.avgEntryPrice.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  }) : '0.00';
  const formattedExitPrice = data.avgExitPrice ? data.avgExitPrice.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) : '0.00';
  const formattedCMP = cmpVal.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const chartHeight = hasPosition ? '110px' : height;

  return (
    <div 
      className={`mini-chart-card ${hideHeaders ? 'no-headers chart-card-no-headers' : ''}`} 
      onClick={onClick}
    >
      {!hideHeaders && hasPosition ? (
        <div className="flex flex-col gap-1 pb-1.5 border-b border-slate-100 dark:border-slate-800/60 w-full">
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-[15px] text-slate-900 dark:text-slate-50 tracking-wide">{symbol}</span>
                {openQty > 0 && totalSold > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 uppercase tracking-wider">
                    PARTIAL - {openQty} of {totalBought} sh
                  </span>
                )}
                {data.setup && (
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30 uppercase tracking-wider truncate max-w-[100px]" title={data.setup}>
                    {data.setup}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                Position size & value: <span className="font-semibold text-slate-800 dark:text-slate-200">{positionSizePct.toFixed(1)}%</span>
                <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formattedValue}</span>
                <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{holdingDuration}</span>
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span className={`text-base font-black tracking-tight leading-none ${returnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
              </span>
              <span className={`text-[10px] font-extrabold mt-0.5 leading-none ${returnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {returnPct >= 0 ? '+' : ''}{rMultiple.toFixed(1)}R
              </span>
              <div className={`mt-1 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold tracking-wide leading-none ${returnPct >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20'}`}>
                {formattedPnL}
              </div>
            </div>
          </div>
        </div>
      ) : !hideHeaders && (
        <div className="card-top-row">
          <span className="card-symbol">{symbol}</span>
          <div className="card-changes">
            <span className={`period-pct ${periodChangePct >= 0 ? 'up-text' : 'down-text'}`}>
              {periodChangePct > 0 ? '+' : ''}{periodChangePct.toFixed(1)}%
            </span>
            <button className="tv-launch-btn" onClick={handleOpenTradingView} title="Open in TradingView">
              <svg width="16" height="16" viewBox="0 0 36 28" fill="currentColor">
                <path d="M14 22H7V11H0V4h14v18zM28 22h-7V11h7v11zm8-18H22v18h14V4z" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <div 
        ref={chartContainerRef} 
        className="chart-canvas-container"
        style={{ height: chartHeight, cursor: interactive ? 'crosshair' : 'pointer' }}
        onClick={onClick}
      />
      
      {!hideHeaders && hasPosition ? (
        <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/60 font-mono">
          <span>Entry <span className="text-slate-800 dark:text-slate-200">{currencySymbol}{formattedEntryPrice}</span></span>
          {isClosed ? (
            <span>Exit <span className="text-slate-800 dark:text-slate-200">{currencySymbol}{formattedExitPrice}</span></span>
          ) : (
            <span>CMP <span className="text-slate-800 dark:text-slate-200">{currencySymbol}{formattedCMP}</span></span>
          )}
        </div>
      ) : !hideHeaders && (
        <div className="card-bottom-row">
          <span className="card-name" title={longName}>{longName}</span>
          <span className="card-price">
            {currencySymbol}{formattedPrice}
          </span>
        </div>
      )}
    </div>
  );
}

function calculateSMA(candlesticks, period) {
  const smaData = [];
  for (let i = 0; i < candlesticks.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candlesticks[i - j].close;
    }
    smaData.push({
      time: candlesticks[i].time,
      value: sum / period
    });
  }
  return smaData;
}

