import { fetchNseEarningsDate, globalFundamentalsCache } from './stockAnalysisApi.js';

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
const QUOTE_CACHE_VERSION = 'v7_daily_change_fix';
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

// Helper to proxy cross-origin fetch through Chrome Extension background worker in content scripts (e.g. on Zerodha Kite)
export async function safeFetch(url, options = {}) {
  const isTest = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') || (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');
  const isContentScript = !isTest && typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:';
  if (isContentScript) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
          return reject(new DOMException('Aborted', 'AbortError'));
        }

        chrome.runtime.sendMessage(
          {
            action: 'PROXY_FETCH',
            payload: {
              url,
              method: options.method || 'GET',
              headers: options.headers || {},
            },
          },
          (res) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!res) {
              return reject(new Error('No response from background proxy'));
            }
            resolve({
              ok: Boolean(res.ok),
              status: res.status || (res.ok ? 200 : 500),
              statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
              text: async () => res.text || '',
              json: async () => JSON.parse(res.text || '{}'),
            });
          }
        );
      });
    }
    // Prevent direct cross-origin fetch in content scripts which triggers browser CORS violation
    throw new Error(`Cannot proxy fetch to ${url} from page origin`);
  }
  return fetch(url, options);
}

const globalRateQueue = new RequestQueue(3, 80);
const inFlightStockRequests = new Map();

export function extractPreviousClose(meta, rawBars, currentPrice = null) {
  const curPx = currentPrice || meta?.regularMarketPrice || (Array.isArray(rawBars) && rawBars.length > 0 ? rawBars[rawBars.length - 1].close : null);
  const startOfRange = Array.isArray(rawBars) && rawBars.length > 2 ? rawBars[0].close : null;

  // 1. Official regularMarketPreviousClose from Yahoo Finance meta
  // (Valid when present, positive, not corrupted by Yahoo post-market 0% bug, and not start-of-range)
  if (meta && typeof meta.regularMarketPreviousClose === 'number' && meta.regularMarketPreviousClose > 0) {
    const isPostMarketEqual = curPx && Math.abs(meta.regularMarketPreviousClose - curPx) < 0.01;
    const isStartOfRange = startOfRange && Math.abs(meta.regularMarketPreviousClose - startOfRange) < 0.01 && (!meta.previousClose || meta.previousClose === startOfRange);
    if (!isPostMarketEqual && !isStartOfRange) {
      return meta.regularMarketPreviousClose;
    }
  }

  // 2. Candlestick array extraction
  if (Array.isArray(rawBars) && rawBars.length >= 2) {
    const lastBar = rawBars[rawBars.length - 1];
    const prevBar = rawBars[rawBars.length - 2];

    // If last bar's close matches current price (or meta.regularMarketPrice),
    // then lastBar is TODAY'S live candle -> yesterday is the preceding bar!
    // If last bar's close differs from current price,
    // then today's candle is NOT in rawBars yet (lastBar IS yesterday's completed candle) -> lastBar is yesterday!
    if (typeof curPx === 'number' && curPx > 0 && Math.abs(lastBar.close - curPx) < 0.01) {
      const lastBarDateStr = new Date(lastBar.time * 1000).toDateString();
      for (let i = rawBars.length - 2; i >= 0; i--) {
        const d = new Date(rawBars[i].time * 1000).toDateString();
        if (d !== lastBarDateStr && typeof rawBars[i].close === 'number' && rawBars[i].close > 0) {
          return rawBars[i].close;
        }
      }
      return prevBar.close;
    } else {
      return lastBar.close;
    }
  }

  // 3. Fallbacks
  if (meta && typeof meta.previousClose === 'number' && meta.previousClose > 0) {
    if (!startOfRange || Math.abs(meta.previousClose - startOfRange) > 0.01) {
      return meta.previousClose;
    }
  }

  if (Array.isArray(rawBars) && rawBars.length === 1) {
    return rawBars[0].close;
  }

  if (meta && typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0) {
    return meta.chartPreviousClose;
  }

  return null;
}

export async function fetchStockData(symbols, country, timeframe = '6mo', customInterval = null, signal = null, forceRefresh = false, onBatch = null) {
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
  const tfKey = (timeframe || '6mo').toLowerCase();
  const tf = validTimeframes[tfKey] || validTimeframes['6mo'];
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
              res = await globalRateQueue.enqueue(() => safeFetch(fetchUrl, { signal }), isSingleStockCall);
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
        // Fallback for Indian stocks: If .NS fails (e.g. 404 for BSE-only or SME stocks), try .BO (Bombay Stock Exchange)
        if (country === 'IN' && ticker.endsWith('.NS')) {
          const bseTicker = ticker.replace(/\.NS$/, '.BO');
          const bseUrl = `${baseUrl}/v8/finance/chart/${encodeURIComponent(bseTicker)}?range=${tf.range}&interval=${fetchInterval}`;
          try {
            const bseRes = await globalRateQueue.enqueue(() => safeFetch(bseUrl, { signal }), isSingleStockCall);
            if (bseRes.ok) {
              response = bseRes;
              ticker = bseTicker;
            }
          } catch (_e) {}
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

      // Build candlesticks with strict validation and consistent OHLC prices
      let rawBars = [];
      for (let i = 0; i < timestamps.length; i++) {
        let closePrice = null;
        if (closes[i] !== null && closes[i] !== undefined && closes[i] > 0) {
          closePrice = closes[i];
        } else if (adjIndicators[i] !== null && adjIndicators[i] !== undefined && adjIndicators[i] > 0) {
          closePrice = adjIndicators[i];
        }
        
        if (timestamps[i] != null && closePrice != null && closePrice > 0) {
          const openPrice = (opens[i] != null && opens[i] > 0) ? opens[i] : closePrice;
          const highPrice = (highs[i] != null && highs[i] > 0) ? highs[i] : Math.max(openPrice, closePrice);
          const lowPrice = (lows[i] != null && lows[i] > 0) ? lows[i] : Math.min(openPrice, closePrice);
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

      // Superset daily timeframe cache reuse:
      // If requesting shorter daily bars (e.g. 5d, 1d, 1mo, 3mo), check if a longer daily timeframe is already cached and valid!
      if (fetchInterval === '1d') {
        const tfHierarchy = ['1d', '5d', '1w', '1mo', '3mo', '6mo', '1y', '2y'];
        const reqIdx = tfHierarchy.indexOf(tfKey);
        if (reqIdx !== -1 && reqIdx < tfHierarchy.length - 1) {
          const barCounts = { '1d': 2, '5d': 5, '1w': 5, '1mo': 22, '3mo': 65, '6mo': 130, '1y': 260 };
          const neededBars = barCounts[tfKey] || 5;

          for (let i = reqIdx + 1; i < tfHierarchy.length; i++) {
            const superTf = tfHierarchy[i];
            const superKey = `${symbol}:${country || 'US'}:${superTf}:1d`;
            if (globalQuoteCache.isValid(superKey, superTf, country)) {
              const superItem = globalQuoteCache.get(superKey);
              if (superItem && superItem.data && Array.isArray(superItem.data.candlesticks) && superItem.data.candlesticks.length >= neededBars) {
                const fullCandles = superItem.data.candlesticks;
                const curPx = superItem.data.currentPrice || fullCandles[fullCandles.length - 1].close;
                const prevPx = extractPreviousClose(superItem.data._meta, fullCandles, curPx) || curPx;
                const diff = curPx - prevPx;
                const dailyChangePct = prevPx > 0 ? Number(((diff / prevPx) * 100).toFixed(2)) : 0;
                
                const slicedCandles = fullCandles.slice(-neededBars);
                const periodStartPx = tfKey === '1d' ? prevPx : slicedCandles[0].close;
                const periodChangePct = tfKey === '1d' ? dailyChangePct : (periodStartPx > 0 ? Number((((curPx - periodStartPx) / periodStartPx) * 100).toFixed(2)) : 0);

                const synthesized = {
                  ...superItem.data,
                  currentPrice: Number(curPx.toFixed(2)),
                  previousClose: Number(prevPx.toFixed(2)),
                  periodStartPrice: Number(periodStartPx.toFixed(2)),
                  periodChangePct,
                  dailyChangePct,
                  isAdvancing: diff >= 0,
                  candlesticks: slicedCandles
                };
                globalQuoteCache.set(cacheKey, synthesized, superItem.isMarketOpen ?? false);
                return synthesized;
              }
            }
          }
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
  const BATCH_SIZE = 6;
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
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results.filter(r => !r.error);
}

export async function fetchStockQuotes(symbols, country, signal = null, forceRefresh = false, onBatch = null) {
  if (!symbols || !symbols.length) return [];

  // When executed in a Chrome content script (e.g. on kite.zerodha.com), delegate directly to background service worker
  // to leverage MV3 host permissions and completely avoid page CORS restrictions!
  const isTest = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') || (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');
  const isContentScript = !isTest && typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:';
  if (isContentScript && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const chunkSize = 15;
      const chunks = [];
      for (let i = 0; i < symbols.length; i += chunkSize) {
        chunks.push(symbols.slice(i, i + chunkSize));
      }

      const allResults = [];
      for (const chunk of chunks) {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: 'FETCH_STOCK_QUOTES',
              payload: { symbols: chunk, country, forceRefresh },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
              }
              resolve(res);
            }
          );
        });

        if (response && response.success && Array.isArray(response.results)) {
          allResults.push(...response.results);
          if (typeof onBatch === 'function' && response.results.length > 0) {
            onBatch(response.results);
          }
        }
      }

      if (allResults.length > 0) {
        return allResults;
      }
    } catch (_e) {
      // Fallback to fetchStockData with safeFetch proxy
    }
  }

  try {
    const results = await fetchStockData(symbols, country, '5d', '1d', signal, forceRefresh, onBatch);

    // Fallback enrichment: Check local fundamentals cache first, then query NSE Calendar if Indian stock
    if (Array.isArray(results)) {
      results.forEach(r => {
        if (!r || r.earningsDate) return;
        const sym = r.symbol;
        const cacheKey = `${sym}${country === 'IN' && !sym.endsWith('.NS') && !sym.endsWith('.BO') ? '.NS' : ''}_${country || 'US'}`;
        const cached = globalFundamentalsCache.get(cacheKey);
        if (cached?.data?.catalysts?.earningsDate) {
          r.earningsDate = cached.data.catalysts.earningsDate;
          r.earningsDaysAway = cached.data.catalysts.earningsDaysAway;
        }
      });

      if (country === 'IN') {
        const stillMissing = results.filter(r => r && !r.earningsDate);
        if (stillMissing.length > 0) {
          await Promise.all(stillMissing.map(async (r) => {
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
    }

    return results;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Failed to fetch stock quotes via chart API:", error);
    }
    return [];
  }
}

export async function fetchStockDataByRange(symbol, country, period1, period2, customInterval = '1d', signal = null) {
  if (!symbol) return { symbol: '', candlesticks: [], error: 'Invalid symbol' };

  const PROXY_MAP = {
    "^CNXSC": { symbol: "HDFCSML250.NS", ratio: 105 }, 
    "NIFTY_MIDCAP_100.NS": { symbol: "MOM100.NS", ratio: 925 },
    "^CRSLDX": { symbol: "MONIFTY500.NS", ratio: 980 },
    "HEALTHIETF.NS": { symbol: "HEALTHIETF.NS", ratio: 1 },
    "OILIETF.NS": { symbol: "OILIETF.NS", ratio: 1 },
    "NIFTY_CHEMICALS.NS": { symbol: "SRF.NS", ratio: 13.5 },
    "NIFTY_EV.NS": { symbol: "M&M.NS", ratio: 0.97 }
  };

  const proxyInfo = PROXY_MAP[symbol];
  let ticker = proxyInfo ? proxyInfo.symbol : symbol;
  if (country === 'IN' && !ticker.endsWith('.NS') && !ticker.endsWith('.BO') && !ticker.startsWith('^')) {
    ticker = `${ticker}.NS`;
  }

  const p1 = Math.max(0, Math.floor(Number(period1) || 0));
  const p2 = Math.floor(Number(period2) || Math.floor(Date.now() / 1000));
  if (p1 >= p2) {
    return { symbol, candlesticks: [], _meta: {} };
  }

  const cacheKey = `${ticker}:${country || 'US'}:range:${p1}:${p2}:${customInterval}`;
  if (globalQuoteCache.cache.has(cacheKey)) {
    const item = globalQuoteCache.get(cacheKey);
    if (item && item.data) return item.data;
  }

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query1.finance.yahoo.com';
  const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${p1}&period2=${p2}&interval=${customInterval}&includeAdjustedClose=true`;
  const fallbackUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${p1}&period2=${p2}&interval=${customInterval}&includeAdjustedClose=true`;

  const isSingleStockCall = true;
  try {
    let attempts = 0;
    let response = null;
    while (attempts < 3) {
      attempts++;
      try {
        const fetchUrl = (attempts % 2 === 1 || isLocalhost) ? url : fallbackUrl;
        response = await globalRateQueue.enqueue(() => safeFetch(fetchUrl, { signal }), isSingleStockCall);
        if (response.status === 429 && !isLocalhost) {
          await new Promise(r => setTimeout(r, 1200 * attempts));
          continue;
        }
        break;
      } catch (err) {
        if (attempts >= 3) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!response || !response.ok) {
      return { symbol, candlesticks: [], error: `Failed with status ${response?.status}` };
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return { symbol, candlesticks: [], error: 'No chart result' };

    const quote = result.indicators?.quote?.[0] || {};
    const adjIndicators = result.indicators?.adjclose?.[0]?.adjclose || [];
    const timestamps = result.timestamp || [];
    const closes = quote.close || [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];

    let rawBars = [];
    for (let i = 0; i < timestamps.length; i++) {
      let closePrice = null;
      if (closes[i] !== null && closes[i] !== undefined && closes[i] > 0) {
        closePrice = closes[i];
      } else if (adjIndicators[i] !== null && adjIndicators[i] !== undefined && adjIndicators[i] > 0) {
        closePrice = adjIndicators[i];
      }
      
      if (timestamps[i] != null && closePrice != null && closePrice > 0) {
        const openPrice = (opens[i] != null && opens[i] > 0) ? opens[i] : closePrice;
        const highPrice = (highs[i] != null && highs[i] > 0) ? highs[i] : Math.max(openPrice, closePrice);
        const lowPrice = (lows[i] != null && lows[i] > 0) ? lows[i] : Math.min(openPrice, closePrice);
        rawBars.push({
          time: Math.floor(timestamps[i]),
          open: Number(openPrice.toFixed(2)),
          high: Number(highPrice.toFixed(2)),
          low: Number(lowPrice.toFixed(2)),
          close: Number(closePrice.toFixed(2)),
          volume: quote.volume?.[i] || 0
        });
      }
    }

    if (proxyInfo && proxyInfo.ratio && proxyInfo.ratio !== 1 && rawBars.length > 0) {
      rawBars = rawBars.map(b => ({
        ...b,
        open: Number((b.open * proxyInfo.ratio).toFixed(2)),
        high: Number((b.high * proxyInfo.ratio).toFixed(2)),
        low: Number((b.low * proxyInfo.ratio).toFixed(2)),
        close: Number((b.close * proxyInfo.ratio).toFixed(2))
      }));
    }

    const resObj = {
      symbol,
      candlesticks: rawBars,
      _meta: result.meta || {}
    };

    if (rawBars.length > 0) {
      globalQuoteCache.set(cacheKey, resObj, false);
    }

    return resObj;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return { symbol, candlesticks: [], error: err.message };
  }
}


