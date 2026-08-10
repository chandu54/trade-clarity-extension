import { fetchNseEarningsDate } from './stockAnalysisApi.js';

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

    // 1. Calendar Day Invalidation: If fetched on a previous calendar day -> STALE!
    const fetchedDate = new Date(item.fetchedAt).toDateString();
    const currentDate = new Date(now).toDateString();
    if (fetchedDate !== currentDate) {
      return false;
    }

    // 2. Strict Stale-Data Rule:
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

  async clear() {
    this.cache.clear();
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const storageKey = 'trading_app_data';
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const res = await new Promise(r => chrome.storage.local.get(storageKey, r));
        const appData = res[storageKey] || {};
        delete appData.quoteCache;
        appData.quoteCacheVersion = QUOTE_CACHE_VERSION;
        await chrome.storage.local.set({ [storageKey]: appData });
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        const appData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        delete appData.quoteCache;
        appData.quoteCacheVersion = QUOTE_CACHE_VERSION;
        localStorage.setItem(storageKey, JSON.stringify(appData));
        localStorage.removeItem('trading_app_data.stockQuotes');
      }
    } catch (e) {
      console.warn("Failed to clear quoteCache from storage:", e);
    }
  }
}

export const globalQuoteCache = new LRUQuoteCache(300);
const QUOTE_CACHE_VERSION = 'v5_post_market_close_fix';
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
        appData.quoteCacheVersion = QUOTE_CACHE_VERSION;
        await chrome.storage.local.set({ [storageKey]: appData });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const appData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        appData.quoteCache = serializedCache;
        appData.quoteCacheVersion = QUOTE_CACHE_VERSION;
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

    if (appData) {
      // Purge legacy cache if version mismatch
      if (appData.quoteCacheVersion !== QUOTE_CACHE_VERSION) {
        console.info("[QuoteCache] Legacy cache version detected. Purging quoteCache to enforce exact 1-day change calculations.");
        globalQuoteCache.clear();
        return;
      }

      if (appData.quoteCache) {
        const now = Date.now();
        Object.entries(appData.quoteCache).forEach(([key, item]) => {
          if (item && item.data && item.fetchedAt) {
            if (now - item.fetchedAt < 24 * 60 * 60 * 1000) {
              if (Array.isArray(item.data.candlesticks) && item.data.candlesticks.length >= 2) {
                const curPx = item.data.currentPrice || item.data.candlesticks[item.data.candlesticks.length - 1].close;
                const prevPx = extractPreviousClose(item.data._meta, item.data.candlesticks);
                if (prevPx && prevPx > 0) {
                  const diff = curPx - prevPx;
                  item.data.previousClose = Number(prevPx.toFixed(2));
                  item.data.dailyChangePct = Number(((diff / prevPx) * 100).toFixed(2));
                  item.data.isAdvancing = diff >= 0;
                }
              }
              globalQuoteCache.cache.set(key, item);
            }
          }
        });
      }
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

class RequestQueue {
  constructor(concurrency = 3, minDelayMs = 80) {
    this.concurrency = concurrency;
    this.minDelayMs = minDelayMs;
    this.activeCount = 0;
    this.queue = [];
    this.lastRequestTime = 0;
  }

  enqueue(fn, isHighPriority = false) {
    return new Promise((resolve, reject) => {
      const item = { fn, resolve, reject };
      if (isHighPriority) {
        this.queue.unshift(item);
      } else {
        this.queue.push(item);
      }
      this.dequeue();
    });
  }

  dequeue() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    const delay = Math.max(0, this.minDelayMs - timeSinceLast);

    setTimeout(() => {
      if (this.queue.length === 0) return;
      const { fn, resolve, reject } = this.queue.shift();
      this.activeCount++;
      this.lastRequestTime = Date.now();

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.activeCount--;
          this.dequeue();
        });
    }, delay);
  }
}

const globalRateQueue = new RequestQueue(3, 80);
const inFlightStockRequests = new Map();

export function extractPreviousClose(meta, rawBars, currentPrice = null) {
  const curPx = currentPrice || meta?.regularMarketPrice || (Array.isArray(rawBars) && rawBars.length > 0 ? rawBars[rawBars.length - 1].close : null);

  // 1. Official regularMarketPreviousClose if present, valid, AND distinctly different from currentPrice
  // (At market close, Yahoo sets regularMarketPreviousClose equal to currentPrice; we reject that to avoid 0.00% change).
  if (meta && typeof meta.regularMarketPreviousClose === 'number' && meta.regularMarketPreviousClose > 0) {
    if (!curPx || Math.abs(meta.regularMarketPreviousClose - curPx) > 0.01) {
      return meta.regularMarketPreviousClose;
    }
  }

  // 2. Extract from rawBars (the candle series):
  // Find the last candle whose calendar date is BEFORE the latest candle's calendar date!
  if (Array.isArray(rawBars) && rawBars.length >= 2) {
    const lastBar = rawBars[rawBars.length - 1];
    const lastBarDateStr = new Date(lastBar.time * 1000).toDateString();

    for (let i = rawBars.length - 1; i >= 0; i--) {
      const d = new Date(rawBars[i].time * 1000).toDateString();
      if (d !== lastBarDateStr) {
        return rawBars[i].close;
      }
    }

    return rawBars[rawBars.length - 2].close;
  }

  if (Array.isArray(rawBars) && rawBars.length === 1) {
    return rawBars[0].close;
  }

  // 3. Fallbacks (only if distinct from currentPrice)
  if (meta && typeof meta.previousClose === 'number' && meta.previousClose > 0) {
    if (!curPx || Math.abs(meta.previousClose - curPx) > 0.01) {
      return meta.previousClose;
    }
  }

  if (meta && typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0) {
    if (!curPx || Math.abs(meta.chartPreviousClose - curPx) > 0.01) {
      return meta.chartPreviousClose;
    }
  }

  return null;
}

export async function fetchStockData(symbols, country, timeframe = '3mo', customInterval = null, signal = null, forceRefresh = false, onBatch = null) {
  if (!symbols || !symbols.length) return [];

  const isSingleStockCall = symbols.length === 1;

  const validTimeframes = {
    '1d': { range: '5d', interval: '15m' },
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
  const tfKey = (timeframe || '3mo').toLowerCase();
  const tf = validTimeframes[tfKey] || validTimeframes['3mo'];
  const fetchInterval = customInterval && customInterval !== 'auto' ? customInterval : tf.interval;

  const fetchSymbolData = async (symbol) => {
    let ticker = symbol;
    if (country === 'IN' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO') && !symbol.startsWith('^')) {
      ticker = `${symbol}.NS`;
    }

    let earningsDate = null;

    try {
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query1.finance.yahoo.com';
      const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${tf.range}&interval=${fetchInterval}`;
      const fallbackUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${tf.range}&interval=${fetchInterval}`;

      let response;
      if (inFlightStockRequests.has(url)) {
        response = await inFlightStockRequests.get(url);
      } else {
        const fetchPromise = (async () => {
          let attempts = 0;
          let res = null;
          while (attempts < 3) {
            attempts++;
            try {
              const fetchUrl = (attempts % 2 === 1 || isLocalhost) ? url : fallbackUrl;
              res = await globalRateQueue.enqueue(() => fetch(fetchUrl, { signal }), isSingleStockCall);
              if (res.status === 429 && !isLocalhost) {
                console.warn(`[RateLimit] Yahoo returned 429 for ${ticker}. Retrying with backoff (attempt ${attempts}/3)...`);
                await new Promise(r => setTimeout(r, 1200 * attempts));
                continue;
              }
              break;
            } catch (err) {
              if (attempts >= 3) throw err;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          return res;
        })();
        inFlightStockRequests.set(url, fetchPromise);
        try {
          response = await fetchPromise;
        } finally {
          inFlightStockRequests.delete(url);
        }
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${ticker} (status ${response.status})`);
      }
      
      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) return { symbol, error: 'No data' };

      const meta = result.meta || {};
      const isMarketOpen = isMarketOpenFromMeta(meta);

      // Extract earningsDate from meta (earningsTimestamp or earningsTimestampStart as fallback)
      const earningsTs = meta.earningsTimestamp || meta.earningsTimestampStart || null;
      if (earningsTs) {
        const earningsD = new Date(earningsTs * 1000);
        if (!isNaN(earningsD.getTime())) {
          earningsDate = earningsD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

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
            open: Number(openPrice.toFixed(2)),
            high: Number(highPrice.toFixed(2)),
            low: Number(lowPrice.toFixed(2)),
            close: Number(closePrice.toFixed(2)),
            volume: quote.volume?.[i] || 0
          });
        }
      }

      if (rawBars.length === 0) {
        return { symbol, error: 'No valid candle bars' };
      }

      const currentPrice = meta.regularMarketPrice || rawBars[rawBars.length - 1].close;
      
      // Robustly extract actual previous day's close for 1-day percentage change
      let previousClose = extractPreviousClose(meta, rawBars, currentPrice) || currentPrice;

      const priceDiff = currentPrice - previousClose;
      const dailyChangePct = previousClose > 0 ? (priceDiff / previousClose) * 100 : 0;
      const isAdvancing = priceDiff >= 0;

      const periodStartPrice = tfKey === '1d' ? previousClose : rawBars[0].close;
      const periodChangePct = tfKey === '1d' ? dailyChangePct : (periodStartPrice > 0 ? ((currentPrice - periodStartPrice) / periodStartPrice) * 100 : 0);

      return {
        symbol,
        currentPrice: Number(currentPrice.toFixed(2)),
        previousClose: Number(previousClose.toFixed(2)),
        periodStartPrice: Number(periodStartPrice.toFixed(2)),
        periodChangePct: Number(periodChangePct.toFixed(2)),
        dailyChangePct: Number(dailyChangePct.toFixed(2)),
        isAdvancing,
        name: meta.longName || meta.shortName || symbol,
        candlesticks: rawBars,
        earningsDate,
        _isMarketOpen: isMarketOpen,
        _meta: meta
      };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      return { symbol, error: err.message };
    }
  };

  const getCachedOrFetch = async (symbol) => {
    const cacheKey = `${symbol}:${country || 'US'}:${timeframe}:${fetchInterval}`;

    if (!forceRefresh) {
      if (globalQuoteCache.isValid(cacheKey, timeframe, country)) {
        const item = globalQuoteCache.get(cacheKey);
        if (item && item.data) {
          // Recompute periodChangePct & dailyChangePct from stored candlesticks so any legacy cached entries are corrected instantly
          if (Array.isArray(item.data.candlesticks) && item.data.candlesticks.length > 0) {
            const candles = item.data.candlesticks;
            const curPx = item.data.currentPrice || candles[candles.length - 1].close;
            const startPx = candles[0].close;
            if (startPx > 0) {
              item.data.periodChangePct = Number((((curPx - startPx) / startPx) * 100).toFixed(2));
            }
            if (candles.length >= 2) {
              const prevPx = extractPreviousClose(item.data._meta, candles, curPx);
              if (prevPx && prevPx > 0) {
                const diff = curPx - prevPx;
                item.data.previousClose = Number(prevPx.toFixed(2));
                item.data.dailyChangePct = Number(((diff / prevPx) * 100).toFixed(2));
                item.data.isAdvancing = diff >= 0;
              }
            }
          }
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
      const validBatch = batchResults.filter(r => r && !r.error);
      results.push(...batchResults);

      if (typeof onBatch === 'function' && validBatch.length > 0) {
        onBatch(validBatch);
      }
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

export async function fetchStockQuotes(symbols, country, signal = null, forceRefresh = false, onBatch = null) {
  if (!symbols || !symbols.length) return [];

  try {
    const results = await fetchStockData(symbols, country, '5d', '1d', signal, forceRefresh, onBatch);

    // Fallback enrichment for Indian stocks: If Yahoo did not provide earningsDate, query NSE Calendar API
    if (country === 'IN' && Array.isArray(results)) {
      const missingEarnings = results.filter(r => r && !r.earningsDate);
      if (missingEarnings.length > 0) {
        await Promise.all(missingEarnings.map(async (r) => {
          try {
            const nseData = await fetchNseEarningsDate(r.symbol);
            if (nseData?.dateStr) {
              r.earningsDate = nseData.dateStr;
              r.earningsDaysAway = nseData.daysAway;
            }
          } catch (_e) {
            // Silently swallow fallback errors
          }
        }));
      }
    }

    return results;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Failed to fetch stock quotes via chart API:", error);
    }
    return [];
  }
}


