import React from 'react';
import MiniCandlestickChart from './MiniCandlestickChart';
import { getBenchmarkOptions } from '../utils/benchmarkUtils';

export default function BirdsEyeGrid({ 
  stocksCount, 
  timeframe, 
  setTimeframe, 
  selectedBenchmark = 'none',
  setSelectedBenchmark = () => {},
  benchmarkMode = 'pct',
  setBenchmarkMode = () => {},
  benchmarkCandles = [],
  data, 
  country, 
  onTileClick, 
  accountCapital 
}) {
  if (!data || data.length === 0) {
    return (
      <div className="birds-eye-controls">
        <span className="constituent-label">No constituent stocks</span>
      </div>
    );
  }

  return (
    <>
      <div className="birds-eye-controls flex items-center justify-between flex-wrap gap-2">
        <span className="constituent-label">{stocksCount} constituent stocks</span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="timeframe-toggles">
            <button 
              className={`tf-btn ${timeframe === '1d' ? 'active' : ''}`}
              onClick={() => setTimeframe('1d')}
            >
              1D
            </button>
            <button 
              className={`tf-btn ${timeframe === '1w' ? 'active' : ''}`}
              onClick={() => setTimeframe('1w')}
            >
              1W
            </button>
            <button 
              className={`tf-btn ${timeframe === '1mo' ? 'active' : ''}`}
              onClick={() => setTimeframe('1mo')}
            >
              1M
            </button>
            <button 
              className={`tf-btn ${timeframe === '3mo' ? 'active' : ''}`}
              onClick={() => setTimeframe('3mo')}
            >
              3M
            </button>
            <button 
              className={`tf-btn ${timeframe === '6mo' ? 'active' : ''}`}
              onClick={() => setTimeframe('6mo')}
            >
              6M
            </button>
            <button 
              className={`tf-btn ${timeframe === '1y' ? 'active' : ''}`}
              onClick={() => setTimeframe('1y')}
            >
              1Y
            </button>
          </div>

          <div className="benchmark-picker-dropdown flex items-center gap-1.5 ml-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Benchmark:</span>
            <select
              value={selectedBenchmark}
              onChange={(e) => {
                const key = e.target.value;
                setSelectedBenchmark(key);
                if (key === 'none') {
                  setBenchmarkMode('normal');
                } else if (benchmarkMode === 'normal') {
                  setBenchmarkMode('pct');
                }
              }}
              className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Compare Benchmark Index"
              aria-label="Compare Benchmark"
            >
              {getBenchmarkOptions(country).map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            {selectedBenchmark !== 'none' && (
              <div className="benchmark-mode-toggle ml-1">
                <button
                  type="button"
                  className={`benchmark-mode-btn ${benchmarkMode === 'pct' ? 'active-pct' : ''}`}
                  onClick={() => setBenchmarkMode('pct')}
                  title="Percentage Performance Overlay (% Change)"
                >
                  % Change
                </button>
                <button
                  type="button"
                  className={`benchmark-mode-btn ${benchmarkMode === 'rs' ? 'active-rs' : ''}`}
                  onClick={() => setBenchmarkMode('rs')}
                  title="Mansfield Relative Strength Ratio Line"
                >
                  RS Line
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="birds-eye-grid">
        {data.map((item) => (
          <MiniCandlestickChart 
            key={item.symbol} 
            data={item} 
            country={country}
            onClick={() => onTileClick(item)} 
            accountCapital={accountCapital}
            timeframe={timeframe}
            selectedBenchmark={selectedBenchmark}
            benchmarkMode={benchmarkMode}
            benchmarkCandles={benchmarkCandles}
          />
        ))}
      </div>
    </>
  );
}
