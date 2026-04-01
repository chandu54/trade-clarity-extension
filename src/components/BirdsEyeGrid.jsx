import React from 'react';
import MiniCandlestickChart from './MiniCandlestickChart';

export default function BirdsEyeGrid({ stocksCount, timeframe, setTimeframe, data, country, onTileClick }) {
  if (!data || data.length === 0) {
    return (
      <div className="birds-eye-controls">
        <span className="constituent-label">No constituent stocks</span>
      </div>
    );
  }

  return (
    <>
      <div className="birds-eye-controls">
        <span className="constituent-label">{stocksCount} constituent stocks</span>
        <div className="timeframe-toggles">
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
      </div>

      <div className="birds-eye-grid">
        {data.map((item) => (
          <MiniCandlestickChart 
            key={item.symbol} 
            data={item} 
            country={country}
            onClick={() => onTileClick(item)} 
          />
        ))}
      </div>
    </>
  );
}
