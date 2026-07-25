import { mapMovingAverageBucket } from './metrics.js';

// LRU Cache implementation following Chrome Extension storage best practices
export class LRUQuoteCache {
  constructor(maxSize = 300) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const item = this.cache.get(key);
    // Refresh position to make it most recently used
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key, data, isMarketOpen) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // LRU Eviction: Remove oldest least recently used key
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      fetchedAt: Date.now(),
      isMarketOpen
    });

    saveQuoteCacheToStorage();
  }

  isValid(key, timeframe, country = 'US') {
    const item = this.get(key);
    if (!item || !item.data) return false;

    const now = Date.now();
    const age = now - item.fetchedAt;

    // Strict Stale-Data Rule:
    // If cached when market was CLOSED, but market is NOW OPEN -> Must consider STALE & re-fetch live data!
    if (!item.isMarketOpen) {
      if (isMarketOpenForCountry(country)) {
        return false; // Market is now open -> stale!
      }
      const regular = item.data._meta?.currentTradingPeriod?.regular;
      if (regular && regular.start && regular.end) {
        const nowSec = Math.floor(now / 1000);
        if (nowSec >= regular.start && nowSec <= regular.end) {
          return false; // Market opened since last fetch -> stale!
        }
      }
    }

    const ttl = getCacheTTL(item.isMarketOpen, timeframe);
    return age < ttl;
  }

  clear() {
    this.cache.clear();
    saveQuoteCacheToStorage();
  }
}

export const globalQuoteCache = new LRUQuoteCache(300);
const inflightRequestsMap = new Map();

let saveTimer = null;
export async function saveQuoteCacheToStorage() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const serializedCache = {};
      for (const [key, item] of globalQuoteCache.cache.entries()) {
        if (item && item.data && (Date.now() - item.fetchedAt < 24 * 60 * 60 * 1000)) {
          serializedCache[key] = {
            data: item.data,
            fetchedAt: item.fetchedAt,
            isMarketOpen: item.isMarketOpen
          };
        }
      }
      
      const storageKey = 'trading_app_data';
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const res = await new Promise(r => chrome.storage.local.get(storageKey, r));
        const appData = res[storageKey] || {};
        appData.quoteCache = serializedCache;
        await chrome.storage.local.set({ [storageKey]: appData });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const appData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        appData.quoteCache = serializedCache;
        localStorage.setItem(storageKey, JSON.stringify(appData));
      }
    } catch (e) {
      console.warn("Failed to persist quoteCache to storage:", e);
    }
  }, 500);
}

export async function loadQuoteCacheFromStorage() {
  try {
    const storageKey = 'trading_app_data';
    let appData = null;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await new Promise(r => chrome.storage.local.get(storageKey, r));
      appData = res[storageKey];
    } else if (typeof window !== 'undefined' && window.localStorage) {
      appData = JSON.parse(localStorage.getItem(storageKey) || 'null');
    }

    if (appData && appData.quoteCache) {
      const now = Date.now();
      Object.entries(appData.quoteCache).forEach(([key, item]) => {
        if (item && item.data && item.fetchedAt) {
          if (now - item.fetchedAt < 24 * 60 * 60 * 1000) {
            globalQuoteCache.cache.set(key, item);
          }
        }
      });
    }
  } catch (e) {
    console.warn("Failed to load quoteCache from storage:", e);
  }
}

// Auto-load on module initialization
loadQuoteCacheFromStorage();

export function isMarketOpenForCountry(country = 'US') {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;

  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (country === 'IN') {
    // NSE/BSE: 9:15 AM to 3:30 PM IST = 3:45 UTC (225m) to 10:00 UTC (600m)
    return mins >= 225 && mins <= 600;
  }
  // US (NYSE/NASDAQ): 9:30 AM to 4:00 PM EST = 14:30 UTC (870m) to 21:00 UTC (1260m)
  return mins >= 870 && mins <= 1260;
}

export function isMarketOpenFromMeta(meta) {
  if (!meta) return false;
  const regular = meta.currentTradingPeriod?.regular;
  if (regular && regular.start && regular.end) {
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= regular.start && nowSec <= regular.end;
  }
  return isMarketOpenForCountry('US');
}

function getCacheTTL(isMarketOpen, timeframe) {
  if (!isMarketOpen) {
    // Market Closed (Weekends / After-hours): 8 Hours max (or until market opens)
    return 8 * 60 * 60 * 1000;
  }
  // Market Open: 3 minutes for live quotes, 15 minutes for historical
  if (['1d', '5d', '1w'].includes(timeframe)) {
    return 3 * 60 * 1000;
  }
  return 15 * 60 * 1000;
}

export function clearQuoteCache() {
  globalQuoteCache.clear();
  inflightRequestsMap.clear();
}

export async function fetchStockData(symbols, country, timeframe = '3mo', customInterval = null, signal = null, forceRefresh = false) {
  if (!symbols || !symbols.length) return [];

  const validTimeframes = {
    '1d': { range: '5d', interval: '5m' },
    '5d': { range: '5d', interval: '15m' },
    '1w': { range: '5d', interval: '15m' },
    '1mo': { range: '1mo', interval: '1d' },
    '3mo': { range: '3mo', interval: '1d' },
    '6mo': { range: '6mo', interval: '1d' },
    'ytd': { range: 'ytd', interval: '1d' },
    '1y': { range: '1y', interval: '1d' },
    '2y': { range: '2y', interval: '1d' },
    '5y': { range: '5y', interval: '1wk' }
  };
  const tf = validTimeframes[timeframe] || validTimeframes['3mo'];
  const fetchInterval = customInterval && customInterval !== 'auto' ? customInterval : tf.interval;

  const fetchSymbolData = async (symbol) => {
    let ticker = symbol;
    if (country === 'IN' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO') && !symbol.startsWith('^')) {
      ticker = `${symbol}.NS`;
    }

    const earningsDate = null;

    try {
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query1.finance.yahoo.com';
      const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${tf.range}&interval=${fetchInterval}`;
      let response = await fetch(url, { signal, cache: 'no-cache' });
      
      if (response.status === 429 && !isLocalhost) {
        const fallbackUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${tf.range}&interval=${fetchInterval}`;
        response = await fetch(fallbackUrl, { signal, cache: 'no-cache' });
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${ticker} (status ${response.status})`);
      }
      
      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) return { symbol, error: 'No data' };

      const meta = result.meta || {};
      const isMarketOpen = isMarketOpenFromMeta(meta);

      const quote = result.indicators?.quote?.[0] || {};
      const adjIndicators = result.indicators?.adjclose?.[0]?.adjclose || [];
      const timestamps = result.timestamp || [];
      const closes = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];

      // Build candlesticks with strict validation and optional adjusted close support
      let rawBars = [];
      for (let i = 0; i < timestamps.length; i++) {
        let closePrice = null;
        if (adjIndicators[i] !== null && adjIndicators[i] !== undefined && adjIndicators[i] > 0) {
          closePrice = adjIndicators[i];
        } else if (closes[i] !== null && closes[i] !== undefined && closes[i] > 0) {
          closePrice = closes[i];
        }
        
        if (timestamps[i] != null && closePrice != null && closePrice > 0) {
          const openPrice = (opens[i] != null && opens[i] > 0) ? opens[i] : closePrice;
          const highPrice = (highs[i] != null && highs[i] > 0) ? highs[i] : closePrice;
          const lowPrice = (lows[i] != null && lows[i] > 0) ? lows[i] : closePrice;
          rawBars.push({
            time: timestamps[i],
            open: openPrice,
            high: highPrice,
            low: lowPrice,
            close: closePrice
          });
        }
      }

      const uniqueBars = [];
      const seenTimes = new Set();
      
      for (const bar of rawBars) {
        if (!seenTimes.has(bar.time)) {
          seenTimes.add(bar.time);
          uniqueBars.push(bar);
        }
      }

      // Find actual previous day's close robustly from the 5d historical data
      let calculatedPrevClose = null;
      let lastDayStart = null;
      if (uniqueBars.length > 0) {
        const lastCandleTime = new Date(uniqueBars[uniqueBars.length - 1].time * 1000);
        lastDayStart = new Date(lastCandleTime.getFullYear(), lastCandleTime.getMonth(), lastCandleTime.getDate()).getTime() / 1000;
        
        for (let i = uniqueBars.length - 1; i >= 0; i--) {
          if (uniqueBars[i].time < lastDayStart) {
            calculatedPrevClose = uniqueBars[i].close;
            break;
          }
        }
      }

      let candlesticks = uniqueBars.sort((a, b) => a.time - b.time);
      
      // Filter for '1d' timeframe to only show the last traded day
      if (timeframe === '1d' && lastDayStart) {
        candlesticks = candlesticks.filter(c => c.time >= lastDayStart);
      }

      const currentPrice = meta.regularMarketPrice || (candlesticks.length > 0 ? candlesticks[candlesticks.length - 1].close : 0);
      const prevClose = meta.previousClose || calculatedPrevClose || currentPrice;
      const isAdvancing = currentPrice >= prevClose;
      const dailyChange = currentPrice - prevClose;
      const dailyChangePct = prevClose > 0 ? (dailyChange / prevClose) * 100 : 0;
      
      let periodChangePct = 0;
      if (timeframe === '1d') {
        periodChangePct = dailyChangePct;
      } else {
        const periodStartPrice = meta.chartPreviousClose || (candlesticks.length > 0 ? candlesticks[0].close : currentPrice);
        periodChangePct = periodStartPrice > 0 ? ((currentPrice - periodStartPrice) / periodStartPrice) * 100 : 0;
      }

      let movingAverages = "";
      if (candlesticks.length > 0) {
        movingAverages = mapMovingAverageBucket(candlesticks.map(c => c.close), currentPrice);
      }

      return {
        symbol,
        longName: meta.longName || meta.shortName || symbol,
        currentPrice: currentPrice || 0,
        prevClose: prevClose || 0,
        dailyChange: dailyChange || 0,
        dailyChangePct: dailyChangePct || 0,
        periodChangePct: periodChangePct || 0,
        isAdvancing,
        high52w: meta.fiftyTwoWeekHigh || null,
        low52w: meta.fiftyTwoWeekLow || null,
        candlesticks,
        movingAverages,
        earningsDate,
        _isMarketOpen: isMarketOpen,
        _meta: meta
      };
    } catch (error) {
      return { symbol, error: error.message };
    }
  };

  const getCachedOrFetch = async (symbol) => {
    const cacheKey = `${symbol}:${country || 'US'}:${timeframe}:${fetchInterval}`;

    if (!forceRefresh) {
      if (globalQuoteCache.isValid(cacheKey, timeframe, country)) {
        const item = globalQuoteCache.get(cacheKey);
        if (item) {
          return item.data;
        }
      }
    }

    if (inflightRequestsMap.has(cacheKey)) {
      return await inflightRequestsMap.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetchSymbolData(symbol);
        if (res && !res.error) {
          globalQuoteCache.set(cacheKey, res, res._isMarketOpen ?? false);
        }
        return res;
      } finally {
        inflightRequestsMap.delete(cacheKey);
      }
    })();

    inflightRequestsMap.set(cacheKey, fetchPromise);
    return await fetchPromise;
  };

  // Process in small batches to respect rate limits
  const BATCH_SIZE = 5;
  const results = [];
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    const batch = symbols.slice(i, i + BATCH_SIZE);
    let networkRequestMade = false;

    const fetchItem = async (sym) => {
      const cacheKey = `${sym}:${country || 'US'}:${timeframe}:${fetchInterval}`;
      if (!forceRefresh && globalQuoteCache.isValid(cacheKey, timeframe, country)) {
        const item = globalQuoteCache.get(cacheKey);
        if (item) return item.data;
      }
      networkRequestMade = true;
      return await getCachedOrFetch(sym);
    };

    try {
      const batchResults = await Promise.all(batch.map(fetchItem));
      results.push(...batchResults);
    } catch (e) {
      if (e.name === 'AbortError') break;
      throw e;
    }
    
    if (i + BATCH_SIZE < symbols.length && networkRequestMade) {
      if (signal?.aborted) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return results.filter(r => !r.error);
}

export async function fetchStockQuotes(symbols, country, signal = null, forceRefresh = false) {
  if (!symbols || !symbols.length) return [];

  try {
    return await fetchStockData(symbols, country, '5d', '1d', signal, forceRefresh);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Failed to fetch stock quotes via chart API:", error);
    }
    return [];
  }
}


