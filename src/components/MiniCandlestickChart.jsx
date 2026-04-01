import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, CandlestickSeries } from 'lightweight-charts';

export default function MiniCandlestickChart({ 
  data, 
  country, 
  onClick = () => {}, 
  hideHeaders = false,
  interactive = false,
  disableZoom = false
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  if (!data) return null;

  const {
    symbol,
    longName,
    currentPrice = 0,
    prevClose = 0,
    periodChangePct = 0,
    isAdvancing,
    candlesticks = []
  } = data;

  const isUp = isAdvancing;

  // Currency formatting based on country
  const currencySymbol = country === 'US' ? '$' : '₹';
  const locale = country === 'US' ? 'en-US' : 'en-IN';
  const formattedPrice = currentPrice.toLocaleString(locale, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

  const handleOpenTradingView = (e) => {
    e.stopPropagation();
    const exchange = country === 'IN' ? 'NSE' : 'NASDAQ';
    window.open(`https://www.tradingview.com/chart/?symbol=${exchange}:${symbol}`, '_blank');
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Theme-Aware Chart Colors (Respecting Global CSS Variables)
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a';
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(0,0,0,0.1)';

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
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        entireTextOnly: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        ticksVisible: false,
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
        mouseWheel: !disableZoom,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: !disableZoom,
        pinch: !disableZoom,
        axisPressedMouseMove: true,
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
      chart.timeScale().fitContent();

      if (interactive) {
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

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
      // Ensure we immediately fit content if it's a new or significant resize
      chartRef.current.timeScale().fitContent();
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candlesticks, prevClose, interactive]);

  const cardStyle = hideHeaders ? { height: '100%', border: 'none', background: 'transparent', boxShadow: 'none' } : {};

  return (
    <div className={`mini-chart-card ${hideHeaders ? 'no-headers' : ''}`} onClick={onClick} style={cardStyle}>
      {!hideHeaders && (
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
        className="chart-container-wrapper" 
        ref={chartContainerRef} 
        style={{ width: '100%', height: hideHeaders ? '100%' : '140px' }}
      />
      
      {!hideHeaders && (
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
