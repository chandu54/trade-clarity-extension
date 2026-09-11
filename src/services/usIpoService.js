import { evaluateIPOBase } from '../utils/detectIPOBase';
import { mapMovingAverageBucket, calculateSMA, calculateStockMetricsFromCandles } from '../utils/metrics';
import { evaluateVCPTightnessFromCandles } from '../utils/calculateVcpTightness';
import { fetchStockData } from '../utils/yahooFinanceMap';

const CACHE_KEY = 'us_ipo_directory_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const HYDRATED_CACHE_KEY = 'us_ipo_hydrated_cache_v2';
const HYDRATED_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour live metrics cache

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Parses US date string format (e.g. "3/21/2024", "08/29/2024")
 */
export function parseUsListingDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(Date.UTC(year, month, day));
}

/**
 * Formats a Date object to standard readable string (e.g. "21-MAR-2024")
 */
export function formatUsListingDate(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  const m = MONTH_NAMES[dateObj.getUTCMonth()];
  const y = dateObj.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Normalizes US exchange names (e.g. "NASDAQ Global Select" -> "NASDAQ", "NYSE American" -> "AMEX")
 */
export function normalizeUsExchange(rawExchange) {
  const ex = (rawExchange || '').toUpperCase();
  if (ex.includes('NASDAQ')) return 'NASDAQ';
  if (ex.includes('NYSE AMERICAN') || ex.includes('AMEX')) return 'AMEX';
  if (ex.includes('NYSE')) return 'NYSE';
  if (ex.includes('CBOE')) return 'CBOE';
  return 'US';
}

/**
 * Filters out SPAC warrants and units (e.g. ending in W, WS, U, UN)
 */
export function isCommonEquitySymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  const s = symbol.trim().toUpperCase();
  if (s.length > 3) {
    if (s.endsWith('WS') || s.endsWith('WT') || s.endsWith('UN')) return false;
    if (s.endsWith('W') || s.endsWith('U')) return false;
  }
  return true;
}

/**
 * Generates array of YYYY-MM strings for the past 13 months
 */
export function getPast12MonthKeys() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }
  return months;
}

/**
 * Fetches priced IPO rows for a given YYYY-MM from the NASDAQ Calendar API
 */
async function fetchNasdaqMonthRows(monthStr) {
  const url = `https://api.nasdaq.com/api/ipo/calendar?date=${monthStr}`;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return json?.data?.priced?.rows || [];
  } catch (err) {
    console.warn(`Failed to fetch NASDAQ IPO calendar for ${monthStr}:`, err);
    return [];
  }
}

/**
 * Parses raw NASDAQ calendar rows into standardized TradeClarity IPO directory entries
 */
export function parseNasdaqIpoRows(rows) {
  if (!Array.isArray(rows)) return [];
  const now = Date.now();
  const seenSymbols = new Set();
  const results = [];

  for (const row of rows) {
    const rawSymbol = (row.proposedTickerSymbol || '').trim();
    const name = (row.companyName || '').trim();
    const rawExchange = (row.proposedExchange || '').trim();
    const dateStr = (row.pricedDate || '').trim();

    if (!rawSymbol || !name || !dateStr) continue;
    if (!isCommonEquitySymbol(rawSymbol)) continue;

    const symbol = rawSymbol.toUpperCase();
    if (seenSymbols.has(symbol)) continue;

    const listingDate = parseUsListingDate(dateStr);
    if (!listingDate) continue;

    const diffMs = now - listingDate.getTime();
    const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Filter to listings within the last 365 days
    if (daysAgo >= 0 && daysAgo <= 365) {
      seenSymbols.add(symbol);
      const exchange = normalizeUsExchange(rawExchange);
      const formattedDate = formatUsListingDate(listingDate);

      let tag = 'Recent Listing';
      if (daysAgo < 60) {
        tag = 'Young IPO';
      }

      results.push({
        symbol,
        name,
        series: exchange, // Exchange used as series badge (NASDAQ, NYSE, AMEX)
        isSme: false,
        listingDateStr: formattedDate,
        rawListingDate: dateStr,
        listingTimestamp: listingDate.getTime(),
        daysAgo,
        defaultTag: tag
      });
    }
  }

  return results;
}

/**
 * Fetches the 1-year US IPO directory from the NASDAQ calendar API (covering NASDAQ, NYSE, AMEX).
 * Caches results in chrome.storage.local for instantaneous load.
 */
export async function fetchUsIpoDirectory(forceRefresh = false) {
  // 1. Try Cache First
  if (!forceRefresh && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const cached = await new Promise((r) => chrome.storage.local.get([CACHE_KEY], r));
      const entry = cached?.[CACHE_KEY];
      if (entry && entry.timestamp && Date.now() - entry.timestamp < CACHE_TTL_MS && Array.isArray(entry.data)) {
        return entry.data;
      }
    } catch (_err) {
      // Ignore storage error and proceed
    }
  } else if (!forceRefresh && typeof window !== 'undefined' && window.localStorage) {
    try {
      const local = localStorage.getItem(CACHE_KEY);
      if (local) {
        const entry = JSON.parse(local);
        if (entry && entry.timestamp && Date.now() - entry.timestamp < CACHE_TTL_MS && Array.isArray(entry.data)) {
          return entry.data;
        }
      }
    } catch (_err) {
      // Fall through
    }
  }

  // 2. Fetch all 13 months concurrently
  const monthKeys = getPast12MonthKeys();
  const monthlyPromises = monthKeys.map((m) => fetchNasdaqMonthRows(m));
  const monthlyResults = await Promise.all(monthlyPromises);
  const combinedRows = monthlyResults.flat();

  const directory = parseNasdaqIpoRows(combinedRows);

  // Sort by listingTimestamp descending (newest first)
  directory.sort((a, b) => b.listingTimestamp - a.listingTimestamp);

  // 3. Cache Directory
  const cachePayload = { timestamp: Date.now(), data: directory };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: cachePayload });
    } catch (_err) {
      // Ignore
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
    } catch (_err) {
      // Ignore
    }
  }

  return directory;
}

/**
 * Hydrates an individual US IPO stock using candle history from Yahoo Finance
 */
export function calculateUsIpoMetrics(stock, candles, paramDefs = {}, adrDays = 20, liquidityDays = 20) {
  const validDays = Array.isArray(candles)
    ? candles.filter((c) => c && typeof c.close === 'number' && c.close > 0)
    : [];

  if (validDays.length === 0) {
    return {
      ...stock,
      price: 'N/A',
      priceVal: 0,
      dailyChangePct: '0.00%',
      dailyChangeNum: 0,
      adr: 'N/A',
      adrNum: 0,
      formattedAdr: '',
      liquidity: 'N/A',
      liquidityVal: 0,
      formattedLiquidity: '',
      turnoverCr: 0,
      turnoverMillion: 0,
      movingAverages: 'N/A',
      above10: false,
      above21: false,
      above50: false,
      vcp: 'N/A',
      vcpTight: false,
      isIpoBase: false,
      ipoStatus: stock.defaultTag,
      validDaysCount: 0,
      listingDayOpen: null,
      listingDayClose: null,
      listingDayGainPct: '—',
      listingDayGainNum: null,
      gainSinceListingPct: '—',
      gainSinceListingNum: null
    };
  }

  const lastClose = validDays[validDays.length - 1].close;
  const prevClose = validDays.length > 1 ? validDays[validDays.length - 2].close : lastClose;
  const changePctNum = prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : 0;
  const changeStr = `${changePctNum >= 0 ? '+' : ''}${changePctNum.toFixed(2)}%`;

  // Listing Day Gain
  const firstDay = validDays[0];
  const listingDayOpen = firstDay ? firstDay.open || firstDay.close : null;
  const listingDayClose = firstDay ? firstDay.close : null;

  let listingDayGainNum = null;
  let listingDayGainStr = '—';
  if (listingDayOpen && listingDayClose && listingDayOpen > 0) {
    listingDayGainNum = ((listingDayClose - listingDayOpen) / listingDayOpen) * 100;
    listingDayGainStr = `${listingDayGainNum >= 0 ? '+' : ''}${listingDayGainNum.toFixed(1)}%`;
  }

  // Current Gain Since Listing Day Close
  let gainSinceListingNum = null;
  let gainSinceListingStr = '—';
  if (listingDayClose && lastClose && listingDayClose > 0) {
    gainSinceListingNum = ((lastClose - listingDayClose) / listingDayClose) * 100;
    gainSinceListingStr = `${gainSinceListingNum >= 0 ? '+' : ''}${gainSinceListingNum.toFixed(1)}%`;
  }

  // Canonical ADR & Liquidity calculation with country='US' (calculates turnover in millions USD)
  const {
    avgAdr,
    formattedAdr,
    liquidityValue,
    formattedLiquidity,
    effectiveAdrDays,
    effectiveLiqDays
  } = calculateStockMetricsFromCandles(validDays, 'US', paramDefs, adrDays, liquidityDays);

  const adrStr = formattedAdr
    ? typeof formattedAdr === 'number'
      ? `${formattedAdr}%`
      : String(formattedAdr)
    : `${avgAdr.toFixed(1)}%`;

  // For US, liquidityValue is turnover in millions USD
  const turnoverMillion = liquidityValue || 0;
  let liquidityStr = formattedLiquidity;
  if (!liquidityStr) {
    if (turnoverMillion >= 1000) {
      liquidityStr = `$${(turnoverMillion / 1000).toFixed(2)}B`;
    } else if (turnoverMillion >= 1) {
      liquidityStr = `$${turnoverMillion.toFixed(1)}M`;
    } else if (turnoverMillion > 0) {
      liquidityStr = `$${(turnoverMillion * 1000).toFixed(0)}K`;
    } else {
      liquidityStr = '—';
    }
  }

  // Moving Averages
  const closes = validDays.map((d) => d.close);
  const maBucket = mapMovingAverageBucket(closes, lastClose);
  const ma10 = calculateSMA(closes, 10);
  const ma21 = calculateSMA(closes, 21);
  const ma50 = calculateSMA(closes, 50);
  const above10 = ma10 !== null && lastClose > ma10;
  const above21 = ma21 !== null && lastClose > ma21;
  const above50 = ma50 !== null && lastClose > ma50;

  // VCP Tightness
  const vcpResult = evaluateVCPTightnessFromCandles(validDays);
  const vcpTight = vcpResult.isTight;
  const vcpStr = vcpResult.displayText || 'Moderate';

  // IPO Base Pattern
  const ipoBaseResult = evaluateIPOBase(stock.symbol, validDays);
  const isIpoBase = ipoBaseResult.isIPOBase;

  let finalIpoStatus = stock.defaultTag;
  if (isIpoBase) {
    if (ipoBaseResult.status === 'BREAKOUT') {
      finalIpoStatus = 'IPO Base (Breakout)';
    } else if (ipoBaseResult.status === 'AT_PIVOT') {
      finalIpoStatus = 'IPO Base (At Pivot)';
    } else {
      finalIpoStatus = 'IPO Base (Forming)';
    }
  }

  return {
    ...stock,
    price: `$${lastClose.toFixed(2)}`,
    priceVal: lastClose,
    dailyChangePct: changeStr,
    dailyChangeNum: changePctNum,
    adr: adrStr,
    adrNum: avgAdr,
    effectiveAdrDays: effectiveAdrDays || validDays.length,
    liquidity: liquidityStr,
    liquidityVal: liquidityValue,
    effectiveLiqDays: effectiveLiqDays || validDays.length,
    turnoverCr: turnoverMillion, // store numeric turnover for uniform filter evaluation
    turnoverMillion,
    movingAverages: maBucket,
    above10,
    above21,
    above50,
    vcp: vcpStr,
    vcpTight,
    isIpoBase,
    ipoBaseResult,
    ipoStatus: finalIpoStatus,
    validDaysCount: validDays.length,
    listingDayOpen,
    listingDayClose,
    listingDayGainPct: listingDayGainStr,
    listingDayGainNum,
    gainSinceListingPct: gainSinceListingStr,
    gainSinceListingNum
  };
}

/**
 * Hydrates a list of US IPO stock items with candle-derived metrics:
 * Price, Daily Change, ADR, Moving Averages, VCP Tightness, and IPO Base Pattern.
 * Supports streaming progressive updates via onProgress(processedCount, totalCount, updatedBatchMap).
 */
export async function hydrateUsIpoMetricsList(
  stocks,
  onProgress = null,
  paramDefs = {},
  adrDays = 20,
  liquidityDays = 20,
  forceRefresh = false
) {
  if (!Array.isArray(stocks) || stocks.length === 0) return [];

  // 1. Check Hydration Cache
  if (!forceRefresh) {
    let cachedHydration = null;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await new Promise((r) => chrome.storage.local.get([HYDRATED_CACHE_KEY], r));
        cachedHydration = stored?.[HYDRATED_CACHE_KEY];
      } catch (_e) {
        // Ignore
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(HYDRATED_CACHE_KEY);
        if (stored) cachedHydration = JSON.parse(stored);
      } catch (_e) {
        // Ignore
      }
    }

    if (
      cachedHydration &&
      cachedHydration.timestamp &&
      Date.now() - cachedHydration.timestamp < HYDRATED_CACHE_TTL_MS &&
      Array.isArray(cachedHydration.data) &&
      cachedHydration.data.length > 0
    ) {
      if (onProgress) {
        const map = {};
        cachedHydration.data.forEach((item) => {
          map[item.symbol] = item;
        });
        onProgress(cachedHydration.data.length, stocks.length, map);
      }
      return cachedHydration.data;
    }
  }

  const results = [];
  const batchSize = 15;
  let processedCount = 0;

  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const symbols = batch.map((s) => s.symbol);

    try {
      // US Equities: country='US' pulls direct ticker without .NS
      const candlesList = await fetchStockData(symbols, 'US', '6mo', '1d', null, forceRefresh);
      const candleMap = {};
      candlesList.forEach((c) => {
        if (c && c.symbol) {
          candleMap[c.symbol] = c.candlesticks || [];
        }
      });

      const batchMap = {};
      for (const stock of batch) {
        const candles = candleMap[stock.symbol] || [];
        const hydrated = calculateUsIpoMetrics(stock, candles, paramDefs, adrDays, liquidityDays);
        results.push(hydrated);
        batchMap[stock.symbol] = hydrated;
      }

      processedCount += batch.length;
      if (onProgress) {
        onProgress(processedCount, stocks.length, batchMap);
      }
    } catch (err) {
      console.warn('Batch hydration failed for symbols:', symbols, err);
      for (const stock of batch) {
        const fallback = calculateUsIpoMetrics(stock, [], paramDefs, adrDays, liquidityDays);
        results.push(fallback);
      }
      processedCount += batch.length;
      if (onProgress) {
        onProgress(processedCount, stocks.length, {});
      }
    }
  }

  // 3. Save to Cache
  const payload = { timestamp: Date.now(), data: results };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [HYDRATED_CACHE_KEY]: payload });
    } catch (_e) {
      // Ignore
    }
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(HYDRATED_CACHE_KEY, JSON.stringify(payload));
    } catch (_e) {
      // Ignore
    }
  }

  return results;
}
