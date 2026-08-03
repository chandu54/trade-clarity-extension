/**
 * Benchmark Utilities for Regional Index Comparison & Relative Strength (RS)
 */
import { fetchStockData } from './yahooFinanceMap.js';

export const BENCHMARK_CONFIGS = {
  IN: {
    main: { symbol: '^NSEI', label: 'Nifty 50', shortLabel: 'Nifty 50' },
    smallcap: { symbol: '^NSEI', label: 'Nifty 50 (^NSEI)', shortLabel: 'Nifty 50' },
    midsmallcap: { symbol: '^BSESN', label: 'BSE Sensex (^BSESN)', shortLabel: 'Sensex' }
  },
  US: {
    main: { symbol: '^GSPC', label: 'S&P 500', shortLabel: 'S&P 500' },
    smallcap: { symbol: '^RUT', label: 'Russell 2000', shortLabel: 'Russell 2000' },
    midsmallcap: { symbol: '^NDX', label: 'Nasdaq 100', shortLabel: 'Nasdaq 100' }
  }
};

/**
 * Get benchmark symbol for a given country and benchmark key ('main', 'smallcap', 'midsmallcap')
 */
export function getBenchmarkSymbol(country = 'US', benchmarkKey = 'main') {
  const region = country === 'IN' ? 'IN' : 'US';
  const config = BENCHMARK_CONFIGS[region]?.[benchmarkKey];
  return config ? config.symbol : (region === 'IN' ? '^NSEI' : '^GSPC');
}

const benchmarkCandlesMemoryCache = new Map();

/**
 * Fetch benchmark candles with automatic fallback if Yahoo returns 1 single candle,
 * with fast in-memory caching to avoid intermittent flickering when switching stocks.
 */
export async function fetchBenchmarkCandles(country, benchmarkKey, timeframe) {
  if (!benchmarkKey || benchmarkKey === 'none') return [];
  const cacheKey = `${country}_${benchmarkKey}_${timeframe}`;
  const cached = benchmarkCandlesMemoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt < 30 * 60 * 1000) && Array.isArray(cached.candles) && cached.candles.length > 0) {
    return cached.candles;
  }

  const primarySymbol = getBenchmarkSymbol(country, benchmarkKey);
  let results = await fetchStockData([primarySymbol], country, timeframe);
  let candles = results && results[0]?.candlesticks ? results[0].candlesticks : [];

  // Fallback if primary symbol returns fewer than 5 candles (e.g. 1 candle flat issue)
  if (candles.length < 5 && primarySymbol !== '^NSEI' && primarySymbol !== '^GSPC') {
    const fallbackSym = country === 'IN' ? '^CRSMID' : '^GSPC';
    const fallbackResults = await fetchStockData([fallbackSym], country, timeframe);
    const fallbackCandles = fallbackResults && fallbackResults[0]?.candlesticks ? fallbackResults[0].candlesticks : [];
    if (fallbackCandles.length >= 5) {
      candles = fallbackCandles;
    }
  }

  if (Array.isArray(candles) && candles.length > 0) {
    benchmarkCandlesMemoryCache.set(cacheKey, { candles, fetchedAt: Date.now() });
  }

  return candles;
}

/**
 * Get list of available benchmark options for dropdown UI selection
 */
export function getBenchmarkOptions(country = 'US') {
  const region = country === 'IN' ? 'IN' : 'US';
  const config = BENCHMARK_CONFIGS[region] || BENCHMARK_CONFIGS.US;

  return [
    { key: 'none', label: 'None', symbol: '' },
    { key: 'main', label: `Main (${config.main.shortLabel})`, symbol: config.main.symbol },
    { key: 'smallcap', label: `Smallcap (${config.smallcap.shortLabel})`, symbol: config.smallcap.symbol },
    { key: 'midsmallcap', label: `MidSmallcap (${config.midsmallcap.shortLabel})`, symbol: config.midsmallcap.symbol }
  ];
}

/**
 * Helper to convert candlestick time to Date timestamp in ms.
 * Safely converts timestamps provided in seconds (< 1e11) to ms.
 */
export function getCandleTimeMs(time) {
  if (typeof time === 'number') {
    return time < 1e11 ? time * 1000 : time;
  }
  if (typeof time === 'string') return new Date(time).getTime();
  if (time && typeof time === 'object' && time.year) {
    return new Date(time.year, time.month - 1, time.day).getTime();
  }
  return 0;
}

/**
 * Find the closest candle in an array to a target timestamp (seconds, ms, string or object).
 * Max threshold set to 5 days to accommodate weekends/trading holidays across markets.
 */
export function findClosestCandle(targetTime, candles = [], maxDiffMs = 5 * 24 * 60 * 60 * 1000) {
  if (!candles || candles.length === 0) return null;
  const targetTimeMs = getCandleTimeMs(targetTime);

  let closest = null;
  let minDiff = Infinity;

  for (let i = 0; i < candles.length; i++) {
    const candleTimeMs = getCandleTimeMs(candles[i].time);
    const diff = Math.abs(candleTimeMs - targetTimeMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candles[i];
    }
  }

  if (minDiff <= maxDiffMs) {
    return closest;
  }
  return null;
}

/**
 * Calculate Normalized Percentage Performance series (% Change) for both stock and benchmark
 * Both series start cleanly at 0% on the first visible candle of the selected timeframe.
 */
export function calculateNormalizedPctSeries(stockCandles = [], benchmarkCandles = []) {
  if (!stockCandles || stockCandles.length === 0 || !benchmarkCandles || benchmarkCandles.length === 0) {
    return { stockSeries: [], benchmarkSeries: [] };
  }

  const stockBase = stockCandles[0]?.close || 0;
  if (stockBase === 0) return { stockSeries: [], benchmarkSeries: [] };

  const startStockTimeMs = getCandleTimeMs(stockCandles[0].time);
  const initialBenchCandle = findClosestCandle(startStockTimeMs, benchmarkCandles) || benchmarkCandles[0];
  const benchBase = initialBenchCandle?.close || 0;

  if (benchBase === 0) return { stockSeries: [], benchmarkSeries: [] };

  const stockSeries = [];
  const benchmarkSeries = [];
  let lastKnownBenchClose = benchBase;

  stockCandles.forEach(stockCandle => {
    const stockTimeMs = getCandleTimeMs(stockCandle.time);
    const stockPct = ((stockCandle.close - stockBase) / stockBase) * 100;
    stockSeries.push({ time: stockCandle.time, value: stockPct });

    const matchedBenchCandle = findClosestCandle(stockTimeMs, benchmarkCandles);
    if (matchedBenchCandle && matchedBenchCandle.close > 0) {
      lastKnownBenchClose = matchedBenchCandle.close;
    }

    const benchPct = ((lastKnownBenchClose - benchBase) / benchBase) * 100;
    benchmarkSeries.push({ time: stockCandle.time, value: benchPct });
  });

  return { stockSeries, benchmarkSeries };
}

/**
 * Calculate Mansfield Relative Strength (RS Ratio Line)
 * RS Ratio(t) = ((Stock_Price(t) / Benchmark_Price(t)) / (Stock_Start / Benchmark_Start) - 1) * 100
 * An upward sloping line > 0 indicates active outperformance.
 */
export function calculateRsRatioSeries(stockCandles = [], benchmarkCandles = []) {
  if (!stockCandles || stockCandles.length === 0 || !benchmarkCandles || benchmarkCandles.length === 0) {
    return { rsSeries: [], baseRatio: 0 };
  }

  const stockBase = stockCandles[0]?.close || 0;
  const startStockTimeMs = getCandleTimeMs(stockCandles[0].time);
  const initialBenchCandle = findClosestCandle(startStockTimeMs, benchmarkCandles) || benchmarkCandles[0];
  const benchBase = initialBenchCandle?.close || 0;

  if (stockBase === 0 || benchBase === 0) {
    return { rsSeries: [], baseRatio: 0 };
  }

  const baseRatio = stockBase / benchBase;
  const rsSeries = [];
  let lastKnownBenchClose = benchBase;

  stockCandles.forEach(stockCandle => {
    const stockTimeMs = getCandleTimeMs(stockCandle.time);
    const matchedBenchCandle = findClosestCandle(stockTimeMs, benchmarkCandles);
    if (matchedBenchCandle && matchedBenchCandle.close > 0) {
      lastKnownBenchClose = matchedBenchCandle.close;
    }

    if (lastKnownBenchClose > 0) {
      const currentRatio = stockCandle.close / lastKnownBenchClose;
      const rsVal = ((currentRatio / baseRatio) - 1) * 100;
      rsSeries.push({ time: stockCandle.time, value: rsVal });
    }
  });

  return { rsSeries, baseRatio };
}

const TECH_SECTORS = new Set([
  'it', 'ai stocks', 'electronics', 'communications', 'software',
  'technology', 'semiconductors', 'data center', 'internet'
]);

export function isTechSector(sectorName = '') {
  if (!sectorName) return false;
  return TECH_SECTORS.has(String(sectorName).trim().toLowerCase());
}

/**
 * Get smart benchmark symbol per market and sector rules:
 * - IN: Nifty Mid/Smallcap (^CRSMID)
 * - US Tech Sector: Nasdaq 100 (^NDX)
 * - US Non-Tech Sector: S&P 500 (^GSPC)
 */
export function getSmartBenchmarkSymbol(stockOrSector = {}, country = 'US', modePreference = 'auto') {
  const region = country === 'IN' ? 'IN' : 'US';
  if (modePreference === 'main') {
    return region === 'IN' ? '^NSEI' : '^GSPC';
  }
  if (modePreference === 'smallcap') {
    return region === 'IN' ? '^NSEI' : '^RUT';
  }

  // Smart Auto (default)
  if (region === 'IN') {
    return '^NSEI';
  } else {
    const sectorName = typeof stockOrSector === 'string' 
      ? stockOrSector 
      : (stockOrSector?.sector || stockOrSector?.industry || '');
    return isTechSector(sectorName) ? '^NDX' : '^GSPC';
  }
}

/**
 * Calculate Relative Strength Category based on 3M Outperformance % vs Benchmark:
 * - > +15%: Very Strong
 * - +5% to +15%: Strong
 * - -3% to +5%: Neutral
 * - -15% to -3%: Weak
 * - < -15%: Very Weak
 */
export function calculateStockRsCategory(stock3mPct = 0, bench3mPct = 0, thresholds = {}) {
  const diff = Number(stock3mPct) - Number(bench3mPct);
  const veryStrong = typeof thresholds.rsThresholdVeryStrong === 'number' ? thresholds.rsThresholdVeryStrong : 25;
  const strong = typeof thresholds.rsThresholdStrong === 'number' ? thresholds.rsThresholdStrong : 15;
  const neutral = typeof thresholds.rsThresholdNeutral === 'number' ? thresholds.rsThresholdNeutral : -3;
  const weak = typeof thresholds.rsThresholdWeak === 'number' ? thresholds.rsThresholdWeak : -15;

  let category;

  if (diff > veryStrong) {
    category = 'Very Strong';
  } else if (diff > strong) {
    category = 'Strong';
  } else if (diff >= neutral) {
    category = 'Neutral';
  } else if (diff >= weak) {
    category = 'Weak';
  } else {
    category = 'Very Weak';
  }

  return {
    category,
    outperformancePct: Number(diff.toFixed(2))
  };
}

/**
 * Calculate RS Outperformance & Category for a stock's candlesticks vs benchmark candles,
 * with full corner-case support for fresh IPOs (<5 trading days) and recent IPOs (<63 trading days).
 */
export function calculateStockRsForCandles(stockCandles = [], benchmarkCandles = [], thresholds = {}) {
  if (!stockCandles || stockCandles.length === 0) {
    return { category: 'Neutral', outperformancePct: 0, note: 'No data', isIpo: false };
  }

  // Align stockCandles to benchmarkCandles time window so both are calculated over the exact same period
  let effectiveStockCandles = stockCandles;
  if (benchmarkCandles && benchmarkCandles.length > 0) {
    const benchStartMs = getCandleTimeMs(benchmarkCandles[0].time);
    const startIdx = stockCandles.findIndex(c => getCandleTimeMs(c.time) >= benchStartMs);
    if (startIdx >= 0) {
      effectiveStockCandles = stockCandles.slice(startIdx);
    } else if (stockCandles.length > benchmarkCandles.length) {
      effectiveStockCandles = stockCandles.slice(-benchmarkCandles.length);
    }
  }

  const tradingDays = effectiveStockCandles.length;

  // Corner Case 1: Ultra-New IPO (< 5 trading days)
  if (tradingDays < 5) {
    return {
      category: 'Neutral',
      outperformancePct: 0,
      note: `New IPO (${tradingDays}d)`,
      isIpo: true,
      tradingDays
    };
  }

  // Stock performance from aligned start candle to latest candle
  const stockStartClose = effectiveStockCandles[0]?.close || 0;
  const stockLatestClose = effectiveStockCandles[effectiveStockCandles.length - 1]?.close || 0;

  if (stockStartClose === 0 || stockLatestClose === 0) {
    return { category: 'Neutral', outperformancePct: 0, note: 'Invalid prices', isIpo: false };
  }

  const stockPerfPct = ((stockLatestClose - stockStartClose) / stockStartClose) * 100;

  // Benchmark performance over matching time window
  let benchPerfPct = 0;
  if (benchmarkCandles && benchmarkCandles.length > 0) {
    const benchStartClose = benchmarkCandles[0]?.close || 0;
    const benchLatestClose = benchmarkCandles[benchmarkCandles.length - 1]?.close || 0;

    if (benchStartClose > 0 && benchLatestClose > 0) {
      benchPerfPct = ((benchLatestClose - benchStartClose) / benchStartClose) * 100;
    }
  }

  const { category, outperformancePct } = calculateStockRsCategory(stockPerfPct, benchPerfPct, thresholds);

  const isIpo = tradingDays < 63;
  const note = isIpo ? `Since IPO (${tradingDays}d)` : '3M Window';

  return {
    category,
    outperformancePct,
    stockPerfPct: Number(stockPerfPct.toFixed(2)),
    benchPerfPct: Number(benchPerfPct.toFixed(2)),
    isIpo,
    note,
    tradingDays
  };
}

/**
 * Hydrate stock RS parameter fields ('rs') based on 3M benchmark relative performance
 */
export async function hydrateStockRsValues(stocks = [], country = 'US', uiConfig = {}) {
  if (!Array.isArray(stocks) || stocks.length === 0) return stocks;

  const benchmarkSetting = typeof uiConfig === 'string' ? uiConfig : (uiConfig?.rsBenchmarkSetting || 'auto');
  const timeframe = uiConfig?.rsTimeframe || '3mo';
  const thresholds = typeof uiConfig === 'object' ? uiConfig : {};

  try {
    const benchmarkSymbolMap = new Map();
    stocks.forEach(stock => {
      if (!stock || !stock.symbol) return;
      const sym = getSmartBenchmarkSymbol(stock, country, benchmarkSetting);
      if (!benchmarkSymbolMap.has(sym)) {
        benchmarkSymbolMap.set(sym, []);
      }
      benchmarkSymbolMap.get(sym).push(stock);
    });

    const stockSymbols = stocks.map(s => s.symbol).filter(Boolean);
    const benchmarkSymbols = Array.from(benchmarkSymbolMap.keys());
    const allSymbolsToFetch = Array.from(new Set([...stockSymbols, ...benchmarkSymbols]));

    const allResults = await fetchStockData(allSymbolsToFetch, country, timeframe);

    const performanceMap = {};
    if (Array.isArray(allResults)) {
      allResults.forEach(res => {
        if (res && res.symbol) {
          performanceMap[res.symbol] = res.periodChangePct || 0;
        }
      });
    }

    const mainBenchSym = country === 'IN' ? '^NSEI' : '^GSPC';
    const mainBenchReturn = performanceMap[mainBenchSym] || 0;

    return stocks.map(stock => {
      if (!stock || !stock.symbol) return stock;
      const benchSym = getSmartBenchmarkSymbol(stock, country, benchmarkSetting);
      const bench3mPct = (performanceMap[benchSym] !== undefined && performanceMap[benchSym] !== 0)
        ? performanceMap[benchSym]
        : mainBenchReturn;

      const stock3mPct = performanceMap[stock.symbol] !== undefined
        ? performanceMap[stock.symbol]
        : (typeof stock.periodChangePct === 'number' 
            ? stock.periodChangePct 
            : (typeof stock.change3m === 'number' ? stock.change3m : 0));
      
      const { category } = calculateStockRsCategory(stock3mPct, bench3mPct, thresholds);

      const existingParams = stock.parameters || stock.params || {};
      const updatedParams = {
        ...existingParams,
        rs: category,
        'in.rs': category,
        'us.rs': category
      };

      return {
        ...stock,
        parameters: updatedParams,
        params: updatedParams
      };
    });
  } catch (err) {
    console.warn("Failed to hydrate stock RS values:", err);
    return stocks;
  }
}
