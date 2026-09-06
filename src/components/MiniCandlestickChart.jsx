import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CrosshairMode, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { calculateNormalizedPctSeries, calculateRsRatioSeries } from '../utils/benchmarkUtils';
import { fetchStockDataByRange } from '../utils/yahooFinanceMap';
import { getDrawingsForSymbol, saveDrawingForSymbol, deleteDrawingForSymbol, clearDrawingsForSymbol } from '../services/storage';
import ChartDrawingToolbar from './ChartDrawingToolbar';

export default function MiniCandlestickChart({ 
  data, 
  country, 
  onClick = () => {}, 
  hideHeaders = false,
  interactive = false,
  disableZoom = false,
  height = '150px',
  accountCapital,
  maSettings = {},
  timeframe = '3mo',
  selectedBenchmark = 'none',
  benchmarkMode = 'pct',
  benchmarkCandles = [],
  stockLineColor = '#3b82f6',
  benchmarkLineColor = '#f97316',
  rsLineColor = '#a855f7',
  activeToolProp,
  onToolChangeProp,
  drawColorProp,
  drawWidthProp,
  drawStyleProp,
  onDrawingsCountChange,
  clearDrawingsTrigger
}) {
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [drawings, setDrawings] = useState([]);
  
  const [internalActiveTool, setInternalActiveTool] = useState('select');
  const activeTool = activeToolProp !== undefined ? activeToolProp : internalActiveTool;
  const setActiveTool = useCallback((tool) => {
    if (onToolChangeProp) onToolChangeProp(tool);
    else setInternalActiveTool(tool);
  }, [onToolChangeProp]);

  const [internalDrawColor, setInternalDrawColor] = useState('#3b82f6');
  const drawColor = drawColorProp !== undefined ? drawColorProp : internalDrawColor;
  const setDrawColor = useCallback((color) => {
    setInternalDrawColor(color);
  }, []);

  const [internalDrawWidth, setInternalDrawWidth] = useState(2);
  const drawWidth = drawWidthProp !== undefined ? drawWidthProp : internalDrawWidth;
  const setDrawWidth = useCallback((width) => {
    setInternalDrawWidth(width);
  }, []);

  const [internalDrawStyle, setInternalDrawStyle] = useState('solid');
  const drawStyle = drawStyleProp !== undefined ? drawStyleProp : internalDrawStyle;
  const setDrawStyle = useCallback((style) => {
    setInternalDrawStyle(style);
  }, []);

  const [trendPreview, setTrendPreview] = useState(null);
  const [, setTick] = useState(0);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maSeriesMapRef = useRef({});
  const maSettingsRef = useRef(maSettings);
  const allCandlesRef = useRef([]);
  const hasMoreHistoryRef = useRef(true);
  const isFetchingRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  const handleClearAllDrawings = useCallback(() => {
    if (data?.symbol) {
      clearDrawingsForSymbol(data.symbol).then(() => setDrawings([]));
      setTrendPreview(null);
    }
  }, [data?.symbol]);

  // Load drawings globally for this symbol from root app storage
  useEffect(() => {
    let isMounted = true;
    if (data?.symbol) {
      getDrawingsForSymbol(data.symbol).then((saved) => {
        if (isMounted) setDrawings(saved || []);
      });
    } else {
      Promise.resolve().then(() => {
        if (isMounted) setDrawings([]);
      });
    }
    return () => { isMounted = false; };
  }, [data?.symbol]);

  useEffect(() => {
    if (onDrawingsCountChange) {
      onDrawingsCountChange(drawings.length);
    }
  }, [drawings.length, onDrawingsCountChange]);

  useEffect(() => {
    if (clearDrawingsTrigger && clearDrawingsTrigger > 0) {
      Promise.resolve().then(() => {
        handleClearAllDrawings();
      });
    }
  }, [clearDrawingsTrigger, handleClearAllDrawings]);

  useEffect(() => {
    if (!data || !chartContainerRef.current) return;

    isUserInteractingRef.current = false;
    const containerEl = chartContainerRef.current;
    const handlePointerInteraction = () => {
      isUserInteractingRef.current = true;
    };

    if (containerEl) {
      containerEl.addEventListener('pointerdown', handlePointerInteraction, { passive: true });
      containerEl.addEventListener('touchstart', handlePointerInteraction, { passive: true });
      containerEl.addEventListener('wheel', handlePointerInteraction, { passive: true });
    }

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

    maSettingsRef.current = maSettings;
    const visibleCandlesticks = getVisibleCandlesticks(candlesticks, timeframe);
    allCandlesRef.current = visibleCandlesticks || [];
    hasMoreHistoryRef.current = true;
    maSeriesMapRef.current = {};

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
        fixLeftEdge: !interactive,
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        entireTextOnly: true,
        scaleMargins: { top: 0.05, bottom: 0.12 },
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
        mouseWheel: interactive,
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

    const isBenchmarkActive = selectedBenchmark !== 'none' && benchmarkCandles && benchmarkCandles.length > 0 && benchmarkMode !== 'normal';
    const isPctMode = isBenchmarkActive && benchmarkMode === 'pct';

    let series = null;

    if (candlesticks && candlesticks.length > 0) {

      if (isPctMode) {
        // Percentage Overlay mode: Render normalized Stock line + Benchmark line starting at 0%
        const { stockSeries, benchmarkSeries } = calculateNormalizedPctSeries(visibleCandlesticks, benchmarkCandles);

        series = chart.addSeries(LineSeries, {
          color: stockLineColor || '#3b82f6', // Stock line primary accent
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`,
          },
          priceLineVisible: false,
        });
        series.setData(stockSeries);

        const benchSeries = chart.addSeries(LineSeries, {
          color: benchmarkLineColor || '#f97316', // Benchmark line secondary accent
          lineWidth: 2,
          lineStyle: 2, // Dashed
          priceFormat: {
            type: 'custom',
            formatter: (val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`,
          },
          priceLineVisible: false,
        });
        benchSeries.setData(benchmarkSeries);

        series.createPriceLine({
          price: 0,
          color: 'rgba(148, 163, 184, 0.5)',
          lineWidth: 1,
          lineStyle: 2,
          title: '0%',
        });
      } else {
        // Standard Candlestick series
        series = chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
        });
        series.setData(visibleCandlesticks);

        // If RS Ratio mode active: Add Mansfield RS line in separate bottom pane
        if (isBenchmarkActive && benchmarkMode === 'rs') {
          const { rsSeries } = calculateRsRatioSeries(visibleCandlesticks, benchmarkCandles);
          if (rsSeries.length > 0) {
            // Keep Candlesticks in top 70% of chart
            chart.priceScale('right').applyOptions({
              scaleMargins: {
                top: 0.05,
                bottom: 0.32,
              },
            });

            // Put RS line in bottom 25% pane on separate scale
            const rsLineSeries = chart.addSeries(LineSeries, {
              color: rsLineColor || '#a855f7', // RS Line accent
              lineWidth: 2,
              priceScaleId: 'rs-scale',
              priceFormat: {
                type: 'custom',
                formatter: (val) => `RS ${val >= 0 ? '+' : ''}${val.toFixed(1)}%`,
              },
              priceLineVisible: false,
            });

            chart.priceScale('rs-scale').applyOptions({
              scaleMargins: {
                top: 0.72,
                bottom: 0.05,
              },
              entireTextOnly: true,
            });

            rsLineSeries.setData(rsSeries);
            rsLineSeries.createPriceLine({
              price: 0,
              color: 'rgba(168, 85, 247, 0.6)',
              lineWidth: 1,
              lineStyle: 2,
              title: 'RS 0%',
            });
          }
        }
      }

      // Add moving average lines if maSettings is provided (when not in Pct mode)
      if (maSettings && !isPctMode) {
        const maColors = {
          '5': '#10b981', // green
          '10': '#06b6d4', // cyan
          '21': '#3b82f6', // blue
          '50': '#f59e0b', // yellow/orange
          '200': '#ef4444' // red
        };

        const visibleTimes = new Set(visibleCandlesticks.map(c => c.time));

        Object.entries(maSettings).forEach(([maKey, config]) => {
          if (config && config.visible) {
            const period = parseInt(maKey, 10);
            if (!isNaN(period)) {
              const fullSmaData = calculateSMA(candlesticks, period);
              const visibleSmaData = fullSmaData.filter(d => visibleTimes.has(d.time));
              if (visibleSmaData.length > 0) {
                const lineSeries = chart.addSeries(LineSeries, {
                  color: config.color || maColors[maKey] || '#8b5cf6',
                  lineWidth: config.thickness || 1.2,
                  title: `${maKey} SMA`,
                  priceLineVisible: false,
                });
                lineSeries.setData(visibleSmaData);
                maSeriesMapRef.current[maKey] = lineSeries;
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
      if (interactive && !hasPosition && typeof series.createPriceLine === 'function') {
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

    const fetchMoreHistory = async (currentLogicalRange) => {
      if (isFetchingRef.current || !hasMoreHistoryRef.current || !data?.symbol) return;
      const currentBars = allCandlesRef.current;
      if (!currentBars || currentBars.length === 0) return;

      const getTimeSec = (t) => {
        if (typeof t === 'number') return t;
        if (typeof t === 'string') return Math.floor(new Date(t).getTime() / 1000);
        if (t && typeof t === 'object' && t.year) {
          return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
        }
        return 0;
      };

      const sortedBars = [...currentBars].sort((a, b) => getTimeSec(a.time) - getTimeSec(b.time));
      const oldestBar = sortedBars[0];
      if (!oldestBar || !oldestBar.time) return;

      const oldestTimeSec = getTimeSec(oldestBar.time);
      if (!oldestTimeSec || isNaN(oldestTimeSec) || oldestTimeSec <= 0) return;

      isFetchingRef.current = true;
      setIsHistoryLoading(true);

      try {
        const period2 = oldestTimeSec - 86400;
        const period1 = Math.max(0, period2 - 90 * 86400);

        const res = await fetchStockDataByRange(data.symbol, country, period1, period2, '1d');

        if (res && Array.isArray(res.candlesticks) && res.candlesticks.length > 0) {
          const barMap = new Map();
          res.candlesticks.forEach(b => {
            const timeKey = typeof b.time === 'object' ? `${b.time.year}-${String(b.time.month).padStart(2,'0')}-${String(b.time.day).padStart(2,'0')}` : String(b.time);
            barMap.set(timeKey, b);
          });
          sortedBars.forEach(b => {
            const timeKey = typeof b.time === 'object' ? `${b.time.year}-${String(b.time.month).padStart(2,'0')}-${String(b.time.day).padStart(2,'0')}` : String(b.time);
            barMap.set(timeKey, b);
          });

          const updatedCandles = Array.from(barMap.values()).sort((a, b) => getTimeSec(a.time) - getTimeSec(b.time));
          const addedCount = updatedCandles.length - sortedBars.length;

          if (addedCount > 0) {
            allCandlesRef.current = updatedCandles;

            if (seriesRef.current && typeof seriesRef.current.setData === 'function') {
              if (!isPctMode) {
                seriesRef.current.setData(updatedCandles);
              }
            }

            if (maSettingsRef.current && maSeriesMapRef.current) {
              Object.entries(maSettingsRef.current).forEach(([maKey, config]) => {
                if (config && config.visible) {
                  const period = parseInt(maKey, 10);
                  if (!isNaN(period)) {
                    const fullSmaData = calculateSMA(updatedCandles, period);
                    const lineSeries = maSeriesMapRef.current[maKey];
                    if (lineSeries) {
                      lineSeries.setData(fullSmaData);
                    }
                  }
                }
              });
            }

            if (currentLogicalRange && chartRef.current) {
              try {
                chartRef.current.timeScale().setVisibleLogicalRange({
                  from: currentLogicalRange.from + addedCount,
                  to: currentLogicalRange.to + addedCount,
                });
              } catch (_e) {
                // Ignore range setting errors if chart unmounted
              }
            }
          } else {
            hasMoreHistoryRef.current = false;
          }
        } else {
          hasMoreHistoryRef.current = false;
        }
      } catch (err) {
        console.warn("[InfiniteScroll] Error lazy fetching historical bars:", err);
      } finally {
        isFetchingRef.current = false;
        setIsHistoryLoading(false);
      }
    };

    if (interactive && data?.symbol) {
      const timeScale = chart.timeScale();
      const handleRangeChange = (logicalRange) => {
        if (!logicalRange) return;
        if (logicalRange.from <= 2 && isUserInteractingRef.current && !isFetchingRef.current && hasMoreHistoryRef.current) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            if (!isFetchingRef.current && hasMoreHistoryRef.current) {
              fetchMoreHistory(logicalRange);
            }
          }, 180);
        }
      };
      timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    }

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

    const handleTimeScaleChange = () => {
      setTick((t) => t + 1);
    };
    const ts = chart.timeScale();
    if (ts && typeof ts.subscribeVisibleTimeScaleChange === 'function') {
      ts.subscribeVisibleTimeScaleChange(handleTimeScaleChange);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (containerEl) {
        containerEl.removeEventListener('pointerdown', handlePointerInteraction);
        containerEl.removeEventListener('touchstart', handlePointerInteraction);
        containerEl.removeEventListener('wheel', handlePointerInteraction);
      }
      if (ts && typeof ts.unsubscribeVisibleTimeScaleChange === 'function') {
        ts.unsubscribeVisibleTimeScaleChange(handleTimeScaleChange);
      }
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.remove();
    };
  }, [data, interactive, disableZoom, maSettings, timeframe, selectedBenchmark, benchmarkMode, benchmarkCandles, stockLineColor, benchmarkLineColor, rsLineColor, country]);

  const getPointPixel = useCallback((time, price) => {
    if (!chartRef.current || !seriesRef.current) return null;
    try {
      const x = chartRef.current.timeScale().timeToCoordinate(time);
      const y = seriesRef.current.priceToCoordinate(price);
      if (x === null || y === null || isNaN(x) || isNaN(y)) return null;
      return { x, y };
    } catch (_e) {
      return null;
    }
  }, []);

  const handleCanvasClick = (e) => {
    if (!interactive || activeTool === 'select' || !chartContainerRef.current || !seriesRef.current || !data?.symbol) return;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = seriesRef.current.coordinateToPrice(y);
    const time = chartRef.current.timeScale().coordinateToTime(x);

    if (price === null || isNaN(price)) return;

    if (activeTool === 'horizontal') {
      const newDrawing = {
        id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'horizontal',
        price: Number(price.toFixed(2)),
        color: drawColor,
        width: drawWidth,
        style: drawStyle,
        createdAt: Date.now()
      };
      saveDrawingForSymbol(data.symbol, newDrawing).then((updated) => setDrawings(updated));
      setActiveTool('select');
    } else if (activeTool === 'trend') {
      if (!time) return;
      if (!trendPreview) {
        setTrendPreview({
          p1: { time, price: Number(price.toFixed(2)) },
          p2: { time, price: Number(price.toFixed(2)) }
        });
      } else {
        const newDrawing = {
          id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'trend',
          p1: trendPreview.p1,
          p2: { time, price: Number(price.toFixed(2)) },
          color: drawColor,
          width: drawWidth,
          style: drawStyle,
          createdAt: Date.now()
        };
        saveDrawingForSymbol(data.symbol, newDrawing).then((updated) => setDrawings(updated));
        setTrendPreview(null);
        setActiveTool('select');
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!interactive || activeTool !== 'trend' || !trendPreview || !chartContainerRef.current || !seriesRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = seriesRef.current.coordinateToPrice(y);
    const time = chartRef.current.timeScale().coordinateToTime(x);
    if (price !== null && time !== null) {
      setTrendPreview((prev) => (prev ? { ...prev, p2: { time, price: Number(price.toFixed(2)) } } : null));
    }
  };

  const handleDeleteDrawing = (id, e) => {
    e.stopPropagation();
    if (data?.symbol && id) {
      deleteDrawingForSymbol(data.symbol, id).then((updated) => setDrawings(updated));
    }
  };

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
      className={`mini-chart-card ${interactive ? 'interactive' : ''} ${hideHeaders ? 'no-headers chart-card-no-headers' : ''}`} 
      onClick={onClick}
    >
      {interactive && activeToolProp === undefined && (
        <div className="mini-chart-toolbar-row flex items-center justify-end px-3 py-1 bg-slate-900/90 border-b border-slate-800/80 z-20 rounded-t-xl">
          <ChartDrawingToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            selectedColor={drawColor}
            onColorChange={setDrawColor}
            selectedWidth={drawWidth}
            onWidthChange={setDrawWidth}
            selectedStyle={drawStyle}
            onStyleChange={setDrawStyle}
            onClearAll={handleClearAllDrawings}
            drawingCount={drawings.length}
          />
        </div>
      )}

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
        className="chart-canvas-container relative"
        style={{ height: chartHeight, cursor: activeTool !== 'select' ? 'crosshair' : (interactive ? 'crosshair' : 'pointer') }}
        onClick={(e) => {
          onClick?.(e);
          handleCanvasClick(e);
        }}
        onMouseMove={handleCanvasMouseMove}
      >
        {isHistoryLoading && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-sky-300 text-[10px] font-medium backdrop-blur-sm border border-sky-500/20 shadow-sm pointer-events-none animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            Loading history...
          </div>
        )}

        {/* SVG Drawing Layer Overlay */}
        {interactive && (drawings.length > 0 || trendPreview) && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden">
            {/* eslint-disable-next-line react-hooks/refs */}
            {drawings.map((d) => {
              if (d.type === 'horizontal') {
                const y = seriesRef.current?.priceToCoordinate(d.price);
                if (y === null || y === undefined || isNaN(y)) return null;
                return (
                  <g key={d.id} className="group pointer-events-auto cursor-pointer">
                    <line
                      x1="0"
                      y1={y}
                      x2="100%"
                      y2={y}
                      stroke={d.color}
                      strokeWidth={d.width}
                      strokeDasharray={d.style === 'dashed' ? '6,4' : 'none'}
                    />
                    {/* Price tag badge */}
                    <g transform={`translate(10, ${Math.max(4, y - 10)})`}>
                      <rect x="0" y="0" width="56" height="15" rx="3" fill={d.color} opacity="0.95" />
                      <text x="28" y="11" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                        {d.price.toFixed(2)}
                      </text>
                    </g>
                    {/* Delete handle on line */}
                    <g 
                      transform={`translate(72, ${Math.max(4, y - 10)})`} 
                      className="cursor-pointer"
                      onClick={(e) => handleDeleteDrawing(d.id, e)}
                    >
                      <rect x="0" y="0" width="15" height="15" rx="3" fill="#ef4444" opacity="0.9" />
                      <text x="7.5" y="11" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                        ×
                      </text>
                    </g>
                  </g>
                );
              } else if (d.type === 'trend') {
                const pt1 = getPointPixel(d.p1?.time, d.p1?.price);
                const pt2 = getPointPixel(d.p2?.time, d.p2?.price);
                if (!pt1 || !pt2) return null;
                const midX = (pt1.x + pt2.x) / 2;
                const midY = (pt1.y + pt2.y) / 2;
                return (
                  <g key={d.id} className="group pointer-events-auto cursor-pointer">
                    <line
                      x1={pt1.x}
                      y1={pt1.y}
                      x2={pt2.x}
                      y2={pt2.y}
                      stroke={d.color}
                      strokeWidth={d.width}
                      strokeDasharray={d.style === 'dashed' ? '6,4' : 'none'}
                    />
                    <circle cx={pt1.x} cy={pt1.y} r={d.width + 1} fill={d.color} />
                    <circle cx={pt2.x} cy={pt2.y} r={d.width + 1} fill={d.color} />
                    {/* Delete handle near midpoint */}
                    <g 
                      transform={`translate(${midX - 7}, ${midY - 7})`}
                      className="cursor-pointer"
                      onClick={(e) => handleDeleteDrawing(d.id, e)}
                    >
                      <circle cx="7" cy="7" r="7" fill="#ef4444" opacity="0.9" />
                      <text x="7" y="10.5" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                        ×
                      </text>
                    </g>
                  </g>
                );
              }
              return null;
            })}

            {/* Trendline Preview while actively drawing */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {trendPreview && (() => {
              const pt1 = getPointPixel(trendPreview.p1?.time, trendPreview.p1?.price);
              const pt2 = getPointPixel(trendPreview.p2?.time, trendPreview.p2?.price);
              if (!pt1 || !pt2) return null;
              return (
                <g className="pointer-events-none">
                  <line
                    x1={pt1.x}
                    y1={pt1.y}
                    x2={pt2.x}
                    y2={pt2.y}
                    stroke={drawColor}
                    strokeWidth={drawWidth}
                    strokeDasharray={drawStyle === 'dashed' ? '6,4' : 'none'}
                    opacity="0.75"
                  />
                  <circle cx={pt1.x} cy={pt1.y} r="4" fill={drawColor} />
                  <circle cx={pt2.x} cy={pt2.y} r="4" fill={drawColor} />
                </g>
              );
            })()}
          </svg>
        )}
      </div>
      
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

function getVisibleCandlesticks(candlesticks, timeframe) {
  if (!candlesticks || candlesticks.length === 0) return [];
  if (!timeframe || timeframe === 'all' || timeframe === '2y' || timeframe === '5y') return candlesticks;

  const daysMap = {
    '1d': 1,
    '5d': 5,
    '1w': 7,
    '1mo': 30,
    '3mo': 90,
    '6mo': 180,
    'ytd': -1,
    '1y': 365
  };

  const days = daysMap[timeframe];
  if (!days) return candlesticks;

  if (timeframe === 'ytd') {
    const currentYear = new Date().getFullYear();
    return candlesticks.filter(c => {
      const date = new Date(c.time * 1000);
      return date.getFullYear() === currentYear;
    });
  }

  const lastCandle = candlesticks[candlesticks.length - 1];
  const lastTime = lastCandle.time;
  const cutoffTime = lastTime - (days * 24 * 60 * 60);

  return candlesticks.filter(c => c.time >= cutoffTime);
}

