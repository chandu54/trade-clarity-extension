import React, { useEffect, useRef, useMemo } from 'react';
import { createChart, CrosshairMode, AreaSeries, LineSeries } from 'lightweight-charts';

const TICKER_COLORS = {
  '^NSEI': '#a855f7', // Purple
  '^CNXSC': '#f97316', // Orange
  '^CRSMID': '#ec4899', // Pink
  'NIFTYMIDSML400.NS': '#14b8a6', // Teal
  '^NDX': '#10b981', // Emerald
  '^GSPC': '#64748b', // Slate
  '^RUT': '#f59e0b', // Amber
  '^DJI': '#ef4444'  // Crimson/Red
};

const indexLabelsMap = {
  '^NSEI': 'Nifty 50',
  '^CNXSC': 'Nifty Smallcap 100',
  '^CRSMID': 'Nifty Midcap 100',
  'NIFTYMIDSML400.NS': 'Nifty MidSmallcap 400',
  '^NDX': 'Nasdaq US Tech 100',
  '^GSPC': 'S&P 500',
  '^RUT': 'Russell 2000',
  '^DJI': 'Dow Jones'
};

export default function BenchmarkComparisonChart({ 
  benchmarkPriceDataMap, 
  selectedTickers,
  calculatedPositions, 
  accountCapital, 
  country,
  activeAnalyticsStartDate
}) {
  const chartContainerRef = useRef(null);
  const tooltipRef = useRef(null);
  const chartRef = useRef(null);

  // Compute daily performance curves aligned with the index timestamps
  const { portfolioData, indexSeriesDataMap } = useMemo(() => {
    const refSymbol = selectedTickers.find(ticker => benchmarkPriceDataMap?.[ticker]?.candlesticks?.length > 0);
    if (!refSymbol) return { portfolioData: [], indexSeriesDataMap: {} };

    const rawRefCandles = benchmarkPriceDataMap[refSymbol].candlesticks || [];
    if (rawRefCandles.length === 0) return { portfolioData: [], indexSeriesDataMap: {} };

    const getCandleTimeMs = (time) => {
      if (typeof time === 'number') return time * 1000;
      if (typeof time === 'string') return new Date(time).getTime();
      if (time && typeof time === 'object' && time.year) {
        return new Date(time.year, time.month - 1, time.day).getTime();
      }
      return 0;
    };

    const activeStartMs = activeAnalyticsStartDate ? new Date(activeAnalyticsStartDate).getTime() : 0;

    let refCandles = rawRefCandles.filter(c => {
      if (!activeAnalyticsStartDate) return true;
      const timeMs = getCandleTimeMs(c.time);
      return timeMs >= activeStartMs - 12 * 60 * 60 * 1000; // leeway for timezone alignment
    });

    if (refCandles.length < 2) {
      refCandles = rawRefCandles.slice(-5); // fallback to latest 5 candles to ensure chart displays
    }

    if (refCandles.length === 0) return { portfolioData: [], indexSeriesDataMap: {} };

    const portfolioData = [];
    const indexSeriesDataMap = {};
    selectedTickers.forEach(ticker => {
      indexSeriesDataMap[ticker] = [];
    });

    const baselines = {};
    selectedTickers.forEach(ticker => {
      const candles = benchmarkPriceDataMap?.[ticker]?.candlesticks || [];
      if (candles.length > 0) {
        if (!activeAnalyticsStartDate) {
          baselines[ticker] = candles[0].close;
        } else {
          // Find candle closest to activeStartMs
          let closestCandle = candles[0];
          let minDiff = Infinity;
          for (const candle of candles) {
            const timeMs = getCandleTimeMs(candle.time);
            const diff = Math.abs(timeMs - activeStartMs);
            if (diff < minDiff) {
              minDiff = diff;
              closestCandle = candle;
            }
          }
          baselines[ticker] = closestCandle?.close || candles[0].close;
        }
      }
    });

    // Sort closed positions by exit date
    const closedTrades = calculatedPositions
      .filter(p => p.isClosed)
      .sort((a, b) => {
        const aSells = a.transactions?.filter(t => t.type === 'Sell') || [];
        const bSells = b.transactions?.filter(t => t.type === 'Sell') || [];
        const aDate = aSells[aSells.length - 1]?.date || a.entryDate || '';
        const bDate = bSells[bSells.length - 1]?.date || b.entryDate || '';
        return aDate.localeCompare(bDate);
      });

    const activeTrades = calculatedPositions.filter(p => !p.isClosed);

    refCandles.forEach((refCandle, idx) => {
      let dateStr = '';
      if (typeof refCandle.time === 'number') {
        dateStr = new Date(refCandle.time * 1000).toISOString().split('T')[0];
      } else if (typeof refCandle.time === 'string') {
        dateStr = refCandle.time;
      } else if (refCandle.time && typeof refCandle.time === 'object' && refCandle.time.year) {
        dateStr = `${refCandle.time.year}-${String(refCandle.time.month).padStart(2, '0')}-${String(refCandle.time.day).padStart(2, '0')}`;
      }

      let cumulativeRealizedPnL = 0;
      closedTrades.forEach(trade => {
        const sells = trade.transactions?.filter(t => t.type === 'Sell') || [];
        const exitDate = sells[sells.length - 1]?.date || trade.entryDate || '';
        if (exitDate && exitDate <= dateStr) {
          cumulativeRealizedPnL += (trade.totalPnL || 0);
        }
      });

      let totalPnL = cumulativeRealizedPnL;
      if (idx === refCandles.length - 1) {
        activeTrades.forEach(trade => {
          totalPnL += (trade.totalPnL || 0);
        });
      }

      const portfolioReturn = accountCapital > 0 ? (totalPnL / accountCapital) * 100 : 0;
      portfolioData.push({ time: refCandle.time, value: portfolioReturn });

      selectedTickers.forEach(ticker => {
        const candles = benchmarkPriceDataMap?.[ticker]?.candlesticks || [];
        if (candles.length === 0 || !baselines[ticker]) return;

        let candle = candles.find(c => c.time === refCandle.time);
        if (!candle) {
          let minDiff = Infinity;
          for (const c of candles) {
            const diff = Math.abs(c.time - refCandle.time);
            if (diff < minDiff) {
              minDiff = diff;
              candle = c;
            }
          }
        }

        if (candle) {
          const indexReturn = ((candle.close - baselines[ticker]) / baselines[ticker]) * 100;
          indexSeriesDataMap[ticker].push({ time: refCandle.time, value: indexReturn });
        }
      });
    });

    return { portfolioData, indexSeriesDataMap };
  }, [benchmarkPriceDataMap, selectedTickers, calculatedPositions, accountCapital, activeAnalyticsStartDate]);

  useEffect(() => {
    const hasData = Object.values(indexSeriesDataMap).some(arr => arr.length > 0);
    if (!chartContainerRef.current || !hasData) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
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
          style: 2,
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        fixLeftEdge: true,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(56, 189, 248, 0.4)',
          width: 1,
          style: 1,
        },
        horzLine: {
          color: 'rgba(56, 189, 248, 0.4)',
          width: 1,
          style: 1,
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    // Area series for Portfolio
    const portfolioSeries = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.25)',
      bottomColor: 'rgba(59, 130, 246, 0.01)',
      lineWidth: 2.5,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: {
        type: 'custom',
        formatter: (val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
      },
    });
    portfolioSeries.setData(portfolioData);

    const activeSeriesMap = {};
    selectedTickers.forEach(ticker => {
      const data = indexSeriesDataMap[ticker] || [];
      if (data.length === 0) return;

      const color = TICKER_COLORS[ticker] || '#94a3b8';
      const series = chart.addSeries(LineSeries, {
        color: color,
        lineWidth: 1.5,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
        },
      });
      series.setData(data);
      activeSeriesMap[ticker] = series;
    });

    chart.timeScale().fitContent();

    // Tooltip logic for mouse hover
    chart.subscribeCrosshairMove((param) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        tooltip.style.display = 'none';
        return;
      }

      const pVal = param.seriesData.get(portfolioSeries)?.value;
      const indexVals = {};
      let hasIndexData = false;
      selectedTickers.forEach(ticker => {
        const series = activeSeriesMap[ticker];
        if (series) {
          const val = param.seriesData.get(series)?.value;
          if (val !== undefined) {
            indexVals[ticker] = val;
            hasIndexData = true;
          }
        }
      });

      if (pVal !== undefined && hasIndexData) {
        let dateStr = '';
        if (typeof param.time === 'number') {
          dateStr = new Date(param.time * 1000).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        } else if (typeof param.time === 'string') {
          dateStr = param.time;
        } else if (param.time && typeof param.time === 'object' && param.time.year) {
          dateStr = `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`;
        }

        let tooltipHtml = `
          <div class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">${dateStr}</div>
          <div class="flex justify-between gap-6 text-xs font-semibold py-0.5 border-b border-slate-100 dark:border-slate-800/80 pb-1 mb-1">
            <span class="text-blue-500 flex items-center gap-1 font-bold">● Portfolio</span>
            <span class="font-mono font-bold text-slate-800 dark:text-slate-100">${pVal >= 0 ? '+' : ''}${pVal.toFixed(2)}%</span>
          </div>
        `;

        Object.entries(indexVals).forEach(([ticker, val]) => {
          const indexName = indexLabelsMap[ticker] || ticker;
          const color = TICKER_COLORS[ticker] || '#94a3b8';
          tooltipHtml += `
            <div class="flex justify-between gap-6 text-[11px] font-medium py-0.5">
              <span class="flex items-center gap-1.5" style="color: ${color}">● ${indexName}</span>
              <span class="font-mono font-bold text-slate-700 dark:text-slate-200">${val >= 0 ? '+' : ''}${val.toFixed(2)}%</span>
            </div>
          `;
        });

        tooltip.style.display = 'block';
        tooltip.innerHTML = tooltipHtml;

        const tooltipWidth = 190;
        const tooltipHeight = 110 + (Object.keys(indexVals).length * 20);
        const x = param.point.x;
        const y = param.point.y;

        const left = x + 15;
        const top = y + 15;

        tooltip.style.left = `${Math.min(chartContainerRef.current.clientWidth - tooltipWidth - 10, left)}px`;
        tooltip.style.top = `${Math.min(chartContainerRef.current.clientHeight - tooltipHeight - 10, top)}px`;
      } else {
        tooltip.style.display = 'none';
      }
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
      chartRef.current.timeScale().fitContent();
    };

    window.addEventListener('resize', handleResize);

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
      window.removeEventListener('resize', handleResize);
      themeObserver.disconnect();
      chart.remove();
    };
  }, [portfolioData, indexSeriesDataMap, selectedTickers]);

  return (
    <div className="relative w-full h-[220px]">
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
      />
      <div 
        ref={tooltipRef}
        className="absolute hidden z-50 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl pointer-events-none min-w-[180px]"
        style={{ left: 0, top: 0 }}
      />
    </div>
  );
}
