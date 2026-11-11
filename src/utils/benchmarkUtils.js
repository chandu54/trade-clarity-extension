/**
 * Benchmark Utilities for Regional Index Comparison & Relative Strength (RS)
 */
import { fetchStockData } from './yahooFinanceMap.js';

export const BENCHMARK_CONFIGS = {
  IN: {
    main: { symbol: '^NSEI', label: 'Nifty 50', shortLabel: 'Nifty 50' },
    nifty50: { symbol: '^NSEI', label: 'Nifty 50', shortLabel: 'Nifty 50' },
    midcap100: { symbol: 'MOM100.NS', label: 'Nifty Midcap 100', shortLabel: 'Midcap 100', fallback: '^NSEMDCP50' },
    smallcap: { symbol: 'SML100CASE.NS', label: 'Nifty Smallcap 100', shortLabel: 'Smallcap 100', fallback: 'HDFCSML250.NS' },
    smallcap100: { symbol: 'SML100CASE.NS', label: 'Nifty Smallcap 100', shortLabel: 'Smallcap 100', fallback: 'HDFCSML250.NS' },
    midsmallcap: { symbol: 'MIDSMALL.NS', label: 'Nifty MidSmallcap 400', shortLabel: 'MidSmall 400' },
    midsmall400: { symbol: 'MIDSMALL.NS', label: 'Nifty MidSmallcap 400', shortLabel: 'MidSmall 400' },
    nifty500: { symbol: '^CRSLDX', label: 'Nifty 500', shortLabel: 'Nifty 500' }
  },
  US: {
    main: { symbol: '^GSPC', label: 'S&P 500', shortLabel: 'S&P 500' },
    sp500: { symbol: '^GSPC', label: 'S&P 500', shortLabel: 'S&P 500' },
    nasdaq100: { symbol: '^NDX', label: 'Nasdaq 100', shortLabel: 'Nasdaq 100' },
    midcap400: { symbol: 'IJH', label: 'S&P Midcap 400', shortLabel: 'Midcap 400', fallback: '^MID' },
    smallcap: { symbol: '^RUT', label: 'Russell 2000', shortLabel: 'Russell 2000' },
    russell2000: { symbol: '^RUT', label: 'Russell 2000', shortLabel: 'Russell 2000' },
    midsmallcap: { symbol: '^NDX', label: 'Nasdaq 100', shortLabel: 'Nasdaq 100' }
  }
};

/**
 * Get benchmark symbol for a given country and benchmark key ('main', 'smallcap', 'midsmallcap', etc.)
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
    const region = country === 'IN' ? 'IN' : 'US';
    const config = BENCHMARK_CONFIGS[region]?.[benchmarkKey];
    const fallbackSym = config?.fallback || (country === 'IN' ? '^NSEI' : '^GSPC');
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
  if (country === 'IN') {
    return [
      { key: 'none', label: 'None', shortLabel: 'None', symbol: '' },
      { key: 'nifty50', label: 'Nifty 50', shortLabel: 'Nifty 50', symbol: '^NSEI' },
      { key: 'midcap100', label: 'Nifty Midcap 100', shortLabel: 'Midcap 100', symbol: 'MOM100.NS' },
      { key: 'smallcap100', label: 'Nifty Smallcap 100', shortLabel: 'Smallcap 100', symbol: 'SML100CASE.NS' },
      { key: 'midsmall400', label: 'Nifty MidSmallcap 400', shortLabel: 'MidSmall 400', symbol: 'MIDSMALL.NS' },
      { key: 'nifty500', label: 'Nifty 500', shortLabel: 'Nifty 500', symbol: '^CRSLDX' }
    ];
  }

  return [
    { key: 'none', label: 'None', shortLabel: 'None', symbol: '' },
    { key: 'sp500', label: 'S&P 500', shortLabel: 'S&P 500', symbol: '^GSPC' },
    { key: 'nasdaq100', label: 'Nasdaq 100', shortLabel: 'Nasdaq 100', symbol: '^NDX' },
    { key: 'midcap400', label: 'S&P Midcap 400', shortLabel: 'Midcap 400', symbol: 'IJH' },
    { key: 'russell2000', label: 'Russell 2000', shortLabel: 'Russell 2000', symbol: '^RUT' }
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
 * Both series start cleanly at 0% on the first candle of the selected timeframe.
 */
export function calculateNormalizedPctSeries(stockCandles = [], benchmarkCandles = [], timeframe = 'all') {
  if (!stockCandles || stockCandles.length === 0 || !benchmarkCandles || benchmarkCandles.length === 0) {
    return { stockSeries: [], benchmarkSeries: [] };
  }

  const tf = String(timeframe || 'all').toLowerCase();
  const targetDaysMap = {
    '1d': 1,
    '5d': 5,
    '1w': 5,
    '1mo': 21,
    '3mo': 63,
    '6mo': 126,
    'ytd': -1,
    '1y': 252,
    '2y': 504
  };

  let baseIdx = 0;
  if (tf === 'ytd') {
    const currentYear = new Date().getFullYear();
    const idx = stockCandles.findIndex(c => {
      const tMs = getCandleTimeMs(c.time);
      return new Date(tMs).getFullYear() === currentYear;
    });
    baseIdx = idx !== -1 ? idx : 0;
  } else if (targetDaysMap[tf] && targetDaysMap[tf] > 0) {
    const days = targetDaysMap[tf];
    baseIdx = Math.max(0, stockCandles.length - days);
  }

  const baseCandle = stockCandles[baseIdx];
  const stockBase = baseCandle?.close || 0;
  if (stockBase === 0) return { stockSeries: [], benchmarkSeries: [] };

  const startStockTimeMs = getCandleTimeMs(baseCandle.time);
  const initialBenchCandle = findClosestCandle(startStockTimeMs, benchmarkCandles) || benchmarkCandles[0];
  const benchBase = initialBenchCandle?.close || 0;

  if (benchBase === 0) return { stockSeries: [], benchmarkSeries: [] };

  const stockSeries = [];
  const benchmarkSeries = [];
  let lastKnownBenchClose = benchBase;

  stockCandles.forEach(stockCandle => {
    const stockTimeMs = getCandleTimeMs(stockCandle.time);
    const stockPct = ((stockCandle.close - stockBase) / stockBase) * 100;
    stockSeries.push({ time: stockCandle.time, value: Number(stockPct.toFixed(2)) });

    const matchedBenchCandle = findClosestCandle(stockTimeMs, benchmarkCandles);
    if (matchedBenchCandle && matchedBenchCandle.close > 0) {
      lastKnownBenchClose = matchedBenchCandle.close;
    }

    const benchPct = ((lastKnownBenchClose - benchBase) / benchBase) * 100;
    benchmarkSeries.push({ time: stockCandle.time, value: Number(benchPct.toFixed(2)) });
  });

  return { stockSeries, benchmarkSeries };
}

/**
 * Calculate Mansfield Relative Strength (RS Ratio Line)
 * RS Ratio(t) = ((Stock_Price(t) / Benchmark_Price(t)) / (Stock_Start / Benchmark_Start) - 1) * 100
 * An upward sloping line > 0 indicates active outperformance.
 */
export function calculateRsRatioSeries(stockCandles = [], benchmarkCandles = [], timeframe = 'all') {
  if (!stockCandles || stockCandles.length === 0 || !benchmarkCandles || benchmarkCandles.length === 0) {
    return { rsSeries: [], baseRatio: 0 };
  }

  const tf = String(timeframe || 'all').toLowerCase();
  const targetDaysMap = {
    '1d': 1,
    '5d': 5,
    '1w': 5,
    '1mo': 21,
    '3mo': 63,
    '6mo': 126,
    'ytd': -1,
    '1y': 252,
    '2y': 504
  };

  let baseIdx = 0;
  if (tf === 'ytd') {
    const currentYear = new Date().getFullYear();
    const idx = stockCandles.findIndex(c => {
      const tMs = getCandleTimeMs(c.time);
      return new Date(tMs).getFullYear() === currentYear;
    });
    baseIdx = idx !== -1 ? idx : 0;
  } else if (targetDaysMap[tf] && targetDaysMap[tf] > 0) {
    const days = targetDaysMap[tf];
    baseIdx = Math.max(0, stockCandles.length - days);
  }

  const baseCandle = stockCandles[baseIdx];
  const stockBase = baseCandle?.close || 0;
  const startStockTimeMs = getCandleTimeMs(baseCandle.time);
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
      rsSeries.push({ time: stockCandle.time, value: Number(rsVal.toFixed(2)) });
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
  if (modePreference === 'main' || modePreference === 'nifty50' || modePreference === 'sp500') {
    return region === 'IN' ? '^NSEI' : '^GSPC';
  }
  if (modePreference === 'smallcap' || modePreference === 'smallcap100' || modePreference === 'russell2000') {
    return region === 'IN' ? 'SML100CASE.NS' : '^RUT';
  }
  if (modePreference === 'midcap' || modePreference === 'midcap100' || modePreference === 'midcap400') {
    return region === 'IN' ? 'MOM100.NS' : 'IJH';
  }
  if (modePreference === 'midsmallcap' || modePreference === 'midsmall400') {
    return region === 'IN' ? 'MIDSMALL.NS' : '^NDX';
  }
  if (modePreference === 'nifty500') {
    return region === 'IN' ? '^CRSLDX' : '^GSPC';
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
 * - > +25%: Very Strong
 * - +15% to +25%: Strong
 * - -3% to +15%: Neutral
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
export function calculateStockRsForCandles(stockCandles = [], benchmarkCandles = [], thresholds = {}, targetDays = 63) {
  if (!stockCandles || stockCandles.length === 0) {
    return { category: 'Neutral', outperformancePct: 0, note: 'No data', isIpo: false };
  }

  // Determine the evaluation window of stock candles (e.g. last 63 trading days for 3M, or full array if shorter)
  const daysToUse = Math.min(targetDays, stockCandles.length);
  const effectiveStockCandles = stockCandles.slice(-daysToUse);
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
  const stockStart = effectiveStockCandles[0];
  const stockLatest = effectiveStockCandles[effectiveStockCandles.length - 1];
  const stockStartClose = stockStart?.close || 0;
  const stockLatestClose = stockLatest?.close || 0;

  if (stockStartClose === 0 || stockLatestClose === 0) {
    return { category: 'Neutral', outperformancePct: 0, note: 'Invalid prices', isIpo: false };
  }

  const stockPerfPct = ((stockLatestClose - stockStartClose) / stockStartClose) * 100;

  // Benchmark performance over EXACT matching calendar window
  let benchPerfPct = 0;
  if (benchmarkCandles && benchmarkCandles.length > 0) {
    const startStockTimeMs = getCandleTimeMs(stockStart.time);
    const endStockTimeMs = getCandleTimeMs(stockLatest.time);

    const matchedBenchStart = findClosestCandle(startStockTimeMs, benchmarkCandles) || benchmarkCandles[0];
    const matchedBenchEnd = findClosestCandle(endStockTimeMs, benchmarkCandles) || benchmarkCandles[benchmarkCandles.length - 1];

    const benchStartClose = matchedBenchStart?.close || 0;
    const benchLatestClose = matchedBenchEnd?.close || 0;

    if (benchStartClose > 0 && benchLatestClose > 0) {
      benchPerfPct = ((benchLatestClose - benchStartClose) / benchStartClose) * 100;
    }
  }

  const { category, outperformancePct } = calculateStockRsCategory(stockPerfPct, benchPerfPct, thresholds);

  const isIpo = tradingDays < 63;
  const note = isIpo ? `Since IPO (${tradingDays}d)` : `${targetDays <= 30 ? '1M' : (targetDays <= 65 ? '3M' : (targetDays <= 130 ? '6M' : '1Y'))} Window`;

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
export async function hydrateStockRsValues(stocks = [], country = 'US', uiConfig = {}, forceRefresh = false) {
  if (!Array.isArray(stocks) || stocks.length === 0) return stocks;

  const benchmarkSetting = typeof uiConfig === 'string' ? uiConfig : (uiConfig?.rsBenchmarkSetting || 'auto');
  const timeframe = uiConfig?.rsTimeframe || '3mo';
  const thresholds = typeof uiConfig === 'object' ? uiConfig : {};

  try {
    const benchmarkSymbolMap = new Map();
    const symbolsNeedingFetch = new Set();
    const now = Date.now();
    const RS_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours freshness

    stocks.forEach(stock => {
      if (!stock || !stock.symbol) return;
      const sym = getSmartBenchmarkSymbol(stock, country, benchmarkSetting);
      if (!benchmarkSymbolMap.has(sym)) {
        benchmarkSymbolMap.set(sym, []);
      }
      benchmarkSymbolMap.get(sym).push(stock);

      const existingRs = stock.params?.rs || stock.parameters?.rs || stock.params?.['in.rs'] || stock.params?.['us.rs'];
      const rsUpdatedAt = stock.params?.rsUpdatedAt || stock.parameters?.rsUpdatedAt || 0;
      const rsTf = stock.params?.rsTimeframe || stock.parameters?.rsTimeframe;
      const isFresh = existingRs && rsTf === timeframe && (now - rsUpdatedAt < RS_CACHE_TTL_MS);

      if (forceRefresh || !isFresh) {
        symbolsNeedingFetch.add(stock.symbol);
      }
    });

    // If every stock already has a fresh and valid RS, skip all network queries immediately
    if (!forceRefresh && symbolsNeedingFetch.size === 0) {
      return stocks;
    }

    const benchmarkSymbols = Array.from(benchmarkSymbolMap.keys());
    const allSymbolsToFetch = Array.from(new Set([...symbolsNeedingFetch, ...benchmarkSymbols]));

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

      // If this stock was fresh and did not need to be fetched, preserve it intact!
      if (!symbolsNeedingFetch.has(stock.symbol)) {
        return stock;
      }

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
        'us.rs': category,
        rsUpdatedAt: now,
        rsTimeframe: timeframe
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
