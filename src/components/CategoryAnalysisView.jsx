import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchStockData } from '../utils/yahooFinanceMap';
import BirdsEyeGrid from './BirdsEyeGrid';
import DeepViewAi from './DeepViewAi';
import './CategoryAnalysis.css';

export default function CategoryAnalysisView({
  onClose,
  popupData,
  country,
  weekData,
  aiSettings,
  initialStockData = []
}) {
  const [activeTab, setActiveTab] = useState('birdsEye');
  const [timeframe, setTimeframe] = useState('3mo');
  const [stockData, setStockData] = useState(initialStockData);
  const [loading, setLoading] = useState(initialStockData.length === 0);

  // Dynamic indicator logic
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const snapshotRef = useRef(null);
  const phenomenaRef = useRef(null);

  const paramLabel = popupData?.data?.paramLabel || '';
  const categoryName = popupData?.data?.name || 'Category';
  const categoryTitle = paramLabel ? `${paramLabel} — ${categoryName}` : categoryName;
  const symbols = popupData?.data?.stocks || [];

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!symbols || symbols.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const results = await fetchStockData(symbols, country, timeframe);

      if (isMounted) {
        setStockData(results);
        setLoading(false);
      }
    }

    loadData();

    return () => { isMounted = false; };
  }, [symbols, country, timeframe]);

  const { advancing, declining, topWeights } = useMemo(() => {
    let adv = 0;
    let dec = 0;
    
    // Sort by performance (Relative Strength) instead of absolute price
    const sortedByPerformance = [...stockData].sort((a, b) => (b.periodChangePct || 0) - (a.periodChangePct || 0));
    const top = sortedByPerformance.slice(0, 3).map(s => s.symbol).join(', ');

    stockData.forEach(d => {
      if (d.isAdvancing) adv++;
      else dec++;
    });

    return { advancing: adv, declining: dec, topWeights: top };
  }, [stockData]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Update underline when tab changes
  useEffect(() => {
    const activeRef = activeTab === 'birdsEye' ? snapshotRef.current : phenomenaRef.current;
    if (activeRef) {
      setIndicatorStyle({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth
      });
    }
  }, [activeTab, stockData]); // Re-run if stockData changes (badge size might change)

  return (
    <div className="category-analysis-overlay" onClick={e => e.stopPropagation()}>
      <div className="category-analysis-modal">
        {/* Header */}
        <div className="ca-header">
          <div className="ca-header-left">
            <div className="ca-category-chip">
              <span className="ca-category-type">{paramLabel || 'Category'}</span>
              <span className="ca-category-name">{categoryName}</span>
            </div>

            <div className="ca-breadth-bar">
              <div className="ca-breadth-item">
                <span className="ca-breadth-label">Stocks</span>
                <span className="ca-breadth-val">{symbols.length}</span>
              </div>
              <div className="ca-breadth-sep" />
              <div className="ca-breadth-item">
                <span className="ca-breadth-label">Adv</span>
                <span className="ca-breadth-val adv">{advancing}</span>
                <svg className="ca-arrow-icon adv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
              </div>
              <div className="ca-breadth-item">
                <span className="ca-breadth-label">Dec</span>
                <span className="ca-breadth-val dec">{declining}</span>
                <svg className="ca-arrow-icon dec" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>

            <div className="ca-header-top-picks">
              <span className="ca-top-picks-label">Top Picks</span>
              <span className="ca-top-picks-val">{topWeights || '—'}</span>
            </div>
          </div>

          <button className="ca-close-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="ca-tabs-container">
          <div className="ca-tabs">
            <button
              ref={snapshotRef}
              className={`ca-tab ${activeTab === 'birdsEye' ? 'active' : ''}`}
              onClick={() => setActiveTab('birdsEye')}
            >
              Snapshot <span className="ca-tab-badge">{symbols.length}</span>
            </button>
            <button
              ref={phenomenaRef}
              className={`ca-tab ${activeTab === 'deepView' ? 'active' : ''}`}
              onClick={() => setActiveTab('deepView')}
            >
              Phenomena
            </button>
            <div 
              className="ca-tab-indicator" 
              style={{ 
                width: indicatorStyle.width, 
                transform: `translateX(${indicatorStyle.left}px)` 
              }} 
            />
          </div>
        </div>

        {/* Content */}
        <div className="ca-body themed-scroll">
          {loading && <div className="ca-loading-pill">Updating charts…</div>}

          {activeTab === 'birdsEye' && (
            <div className={loading ? 'ca-grid-loading' : ''}>
              <BirdsEyeGrid
                stocksCount={symbols.length}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                data={stockData}
                country={country}
                onTileClick={() => setActiveTab('deepView')}
              />
            </div>
          )}

          {activeTab === 'deepView' && (
            <DeepViewAi
              categoryName={categoryName}
              symbols={symbols}
              weekData={weekData}
              aiSettings={aiSettings}
              stockData={stockData}
              timeframe={timeframe}
            />
          )}
        </div>
      </div>
    </div>
  );
}
