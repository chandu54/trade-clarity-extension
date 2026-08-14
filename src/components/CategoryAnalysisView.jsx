import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchStockData } from '../utils/yahooFinanceMap';
import { fetchBenchmarkCandles } from '../utils/benchmarkUtils';
import BirdsEyeGrid from './BirdsEyeGrid';
import DeepViewAi from './DeepViewAi';
import EditStockModal from './EditStockModal';
import './CategoryAnalysis.css';

export default function CategoryAnalysisView({
  onClose,
  popupData,
  country,
  weekData,
  aiSettings,
  initialStockData = [],
  sectors = [],
  availableTags = [],
  paramDefinitions = {},
  onUpdateStock = null,
  weekInfo = ""
}) {
  const [activeTab, setActiveTab] = useState('birdsEye');
  const [timeframe, setTimeframe] = useState('3mo');
  const [selectedBenchmark, setSelectedBenchmark] = useState('none');
  const [benchmarkMode, setBenchmarkMode] = useState('pct');
  const [benchmarkCandles, setBenchmarkCandles] = useState([]);
  const [stockData, setStockData] = useState(initialStockData);
  const [loading, setLoading] = useState(initialStockData.length === 0);
  const [selectedStockForEdit, setSelectedStockForEdit] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedBenchmark === 'none') {
      Promise.resolve().then(() => setBenchmarkCandles([]));
      return;
    }

    let isMounted = true;
    fetchBenchmarkCandles(country, selectedBenchmark, timeframe).then(candles => {
      if (isMounted) {
        setBenchmarkCandles(candles);
      }
    }).catch(err => {
      console.warn("Failed to fetch benchmark data:", err);
    });

    return () => { isMounted = false; };
  }, [selectedBenchmark, country, timeframe]);

  // Dynamic indicator logic
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  // ... existing code ...
  const snapshotRef = useRef(null);
  const phenomenaRef = useRef(null);

  const paramLabel = popupData?.data?.paramLabel || '';
  const categoryName = popupData?.data?.name || 'Category';
  const symbols = useMemo(() => popupData?.data?.stocks || [], [popupData?.data?.stocks]);

  const handleCopy = (e) => {
    if (e) e.stopPropagation();
    if (symbols.length === 0) return;
    
    const textToCopy = symbols.join(", ");
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const initialDataRef = useRef(initialStockData);
  const isInitialMount = useRef(true);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadData() {
      if (!symbols || symbols.length === 0) {
        setLoading(false);
        return;
      }

      // Skip duplicate initial fetch on mount if initial stock data is already provided for 3mo
      if (isInitialMount.current && initialDataRef.current && initialDataRef.current.length > 0 && timeframe === '3mo') {
        isInitialMount.current = false;
        setLoading(false);
        return;
      }
      isInitialMount.current = false;

      setLoading(true);

      const onBatch = (batchResults) => {
        if (!isMounted) return;
        setStockData(prev => {
          const map = new Map(prev.map(item => [item.symbol, item]));
          batchResults.forEach(item => {
            if (item && item.symbol) map.set(item.symbol, item);
          });
          return Array.from(map.values());
        });
      };

      try {
        const results = await fetchStockData(symbols, country, timeframe, null, controller.signal, false, onBatch);

        if (isMounted) {
          if (results && results.length > 0) {
            setStockData(results);
          }
          setLoading(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          console.warn("Category analysis fetch failed:", err);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [symbols, country, timeframe]);

  const mergedStockData = useMemo(() => {
    return stockData.map(s => {
      const localData = weekData?.stocks?.[s.symbol] || {};
      return { ...localData, ...s };
    });
  }, [stockData, weekData]);

  const { advancing, declining, topWeights } = useMemo(() => {
    let adv = 0;
    let dec = 0;

    // Sort by performance (Relative Strength) instead of absolute price
    const sortedByPerformance = [...mergedStockData].sort((a, b) => (b.periodChangePct || 0) - (a.periodChangePct || 0));
    const top = sortedByPerformance.slice(0, 3).map(s => s.symbol).join(', ');

    mergedStockData.forEach(d => {
      if (d.isAdvancing) adv++;
      else dec++;
    });

    return { advancing: adv, declining: dec, topWeights: top };
  }, [mergedStockData]);

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
  }, [activeTab, mergedStockData]); // Re-run if stockData changes (badge size might change)

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
                <button 
                  className={`ca-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  title="Copy symbols to clipboard"
                >
                  {copied ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
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
            <div className="ca-tab-indicator">
              <style>{`
                .ca-tab-indicator {
                  --indicator-width: ${indicatorStyle.width}px;
                  --indicator-offset: ${indicatorStyle.left}px;
                }
              `}</style>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="ca-body themed-scroll">
          {loading && <div className="ca-loading-pill">Updating charts…</div>}

          {activeTab === 'birdsEye' && (
            <div className={loading && mergedStockData.length === 0 ? 'ca-grid-loading' : ''}>
              <BirdsEyeGrid
                stocksCount={symbols.length}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                selectedBenchmark={selectedBenchmark}
                setSelectedBenchmark={setSelectedBenchmark}
                benchmarkMode={benchmarkMode}
                setBenchmarkMode={setBenchmarkMode}
                benchmarkCandles={benchmarkCandles}
                data={mergedStockData}
                country={country}
                onTileClick={(stock) => setSelectedStockForEdit(stock)}
              />
            </div>
          )}

          {activeTab === 'deepView' && (
            <DeepViewAi
              categoryName={categoryName}
              symbols={symbols}
              weekData={weekData}
              aiSettings={aiSettings}
              stockData={mergedStockData}
              timeframe={timeframe}
            />
          )}
        </div>

        {selectedStockForEdit && (
          <EditStockModal
            isOpen={!!selectedStockForEdit}
            onClose={() => setSelectedStockForEdit(null)}
            stock={mergedStockData.find(s => s.symbol === selectedStockForEdit.symbol) || selectedStockForEdit}
            paramDefinitions={paramDefinitions}
            sectors={sectors}
            availableTags={availableTags}
            weekInfo={weekInfo}
            country={country}
            aiSettings={aiSettings}
            isDeepView={true}
            onUpdateStock={onUpdateStock}
            sortedStocks={mergedStockData}
            onSelectStock={setSelectedStockForEdit}
            watchlistName={categoryName}
          />
        )}
      </div>
    </div>
  );
}
