import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, CandlestickSeries } from 'lightweight-charts';

export default function MiniCandlestickChart({ data, country, onClick = () => {} }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  if (!data) return null;

  const {
    symbol,
    longName,
    currentPrice = 0,
    prevClose = 0,
    dailyChangePct = 0,
    periodChangePct = 0,
    isAdvancing,
    candlesticks = []
  } = data;

  const isUp = isAdvancing;

  const handleOpenTradingView = (e) => {
    e.stopPropagation();
    const exchange = country === 'IN' ? 'NSE' : 'NASDAQ';
    window.open(`https://www.tradingview.com/chart/?symbol=${exchange}:${symbol}`, '_blank');
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.7)';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor,
        attributionLogo: false,
        fontSize: 9,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      timeScale: { visible: false },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        entireTextOnly: true,
        scaleMargins: { top: 0.05, bottom: 0.05 },
        ticksVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    const pricePrecision = currentPrice >= 1000 ? 0 : currentPrice >= 100 ? 1 : 2;
    const priceMinMove = currentPrice >= 1000 ? 1 : currentPrice >= 100 ? 0.1 : 0.01;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: pricePrecision,
        minMove: priceMinMove,
      },
    });

    if (candlesticks && candlesticks.length > 0) {
      series.setData(candlesticks);
      chart.timeScale().fitContent();

      series.createPriceLine({
        price: prevClose,
        color: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '',
        axisLabelTextColor: '#fff',
        axisLabelColor: isUp ? '#10b981' : '#ef4444',
      });
    }

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [candlesticks, prevClose, isUp, currentPrice]);

  return (
    <div className="mini-chart-card" onClick={onClick}>
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
      
      <div className="chart-container-wrapper" ref={chartContainerRef} />
      
      <div className="card-bottom-row">
        <span className="card-name" title={longName}>{longName}</span>
        <span className="card-price">
          ₹{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
