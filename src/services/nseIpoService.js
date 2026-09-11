import { evaluateIPOBase } from '../utils/detectIPOBase';
import { mapMovingAverageBucket, calculateSMA, calculateStockMetricsFromCandles } from '../utils/metrics';
import { evaluateVCPTightnessFromCandles } from '../utils/calculateVcpTightness';
import { fetchStockData } from '../utils/yahooFinanceMap';

const NSE_MAIN_CSV_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const NSE_SME_CSV_URL = 'https://archives.nseindia.com/content/equities/SME_EQUITY_L.csv';
const CACHE_KEY = 'nse_ipo_directory_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const HYDRATED_CACHE_KEY = 'nse_ipo_hydrated_cache_v2';
const HYDRATED_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour live metrics cache

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

/**
 * Parses NSE date format (e.g. "16-SEP-2024", "03-OCT-2024")
 */
export function parseNseListingDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = MONTH_MAP[parts[1].toUpperCase()];
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(Date.UTC(year, month, day));
}

/**
 * Parses CSV text from NSE archive files safely handling potential quotes.
 */
export function parseNseCsv(csvText, isSme = false) {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const now = Date.now();
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parser handling quoted columns
    const columns = [];
    let inQuotes = false;
    let current = '';

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    columns.push(current.trim());

    if (columns.length < 4) continue;

    const symbol = columns[0].replace(/"/g, '').trim();
    const name = columns[1].replace(/"/g, '').trim();
    const series = (columns[2] || (isSme ? 'SM' : 'EQ')).replace(/"/g, '').trim();
    const dateStr = columns[3].replace(/"/g, '').trim();

    if (!symbol || !name || !dateStr) continue;

    const listingDate = parseNseListingDate(dateStr);
    if (!listingDate) continue;

    const diffMs = now - listingDate.getTime();
    const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Filter to listings within the last 365 days (1 year)
    if (daysAgo >= 0 && daysAgo <= 365) {
      let tag = 'Recent Listing';
      if (daysAgo < 60) {
        tag = 'Young IPO';
      }

      results.push({
        symbol,
        name,
        series: series || (isSme ? 'SM' : 'EQ'),
        isSme,
        listingDateStr: dateStr,
        listingTimestamp: listingDate.getTime(),
        daysAgo,
        defaultTag: tag
      });
    }
  }

  return results;
}

/**
 * Fetches and aggregates the 1-year IPO directory from NSE Mainboard and SME archives.
 * Caches results in chrome.storage.local for instantaneous loading.
 */
export async function fetchNseIpoDirectory(forceRefresh = false) {
  // 1. Try Cache First
  if (!forceRefresh && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const cached = await new Promise(r => chrome.storage.local.get([CACHE_KEY], r));
      const entry = cached?.[CACHE_KEY];
      if (entry && entry.timestamp && (Date.now() - entry.timestamp < CACHE_TTL_MS) && Array.isArray(entry.data)) {
        return entry.data;
      }
    } catch (_err) {
      // Ignore storage error and proceed to network fetch
    }
  }

  // 2. Network Fetch
  let allIpos = [];

  try {
    const mainRes = await fetch(NSE_MAIN_CSV_URL, { cache: 'no-cache' });
    if (mainRes.ok) {
      const mainText = await mainRes.text();
      const mainList = parseNseCsv(mainText, false);
      allIpos.push(...mainList);
    }
  } catch (err) {
    console.warn('[nseIpoService] Failed to fetch NSE mainboard directory:', err);
  }

  try {
    const smeRes = await fetch(NSE_SME_CSV_URL, { cache: 'no-cache' });
    if (smeRes.ok) {
      const smeText = await smeRes.text();
      const smeList = parseNseCsv(smeText, true);
      allIpos.push(...smeList);
    }
  } catch (err) {
    console.warn('[nseIpoService] Failed to fetch NSE SME directory:', err);
  }

  // Deduplicate by symbol (Mainboard takes precedence)
  const seen = new Set();
  const deduped = [];
  for (const item of allIpos) {
    if (!seen.has(item.symbol)) {
      seen.add(item.symbol);
      deduped.push(item);
    }
  }

  // Sort descending by listingTimestamp (newest listed first)
  deduped.sort((a, b) => b.listingTimestamp - a.listingTimestamp);

  // 3. Save to storage cache
  if (typeof chrome !== 'undefined' && chrome.storage?.local && deduped.length > 0) {
    try {
      chrome.storage.local.set({
        [CACHE_KEY]: {
          timestamp: Date.now(),
          data: deduped
        }
      }, () => {});
    } catch (_err) {
      // Ignore storage write error
    }
  }

  return deduped;
}

/**
 * Helper to compute metrics for a single stock given its candlesticks
 */
export function computeStockIpoMetrics(
  stock,
  candles = [],
  country = 'IN',
  paramDefs = null,
  adrDays = 20,
  liquidityDays = 20
) {
  const validDays = Array.isArray(candles)
    ? candles.filter(c => c && typeof c.close === 'number' && c.close > 0)
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

  // Listing Day Gain: (Listing Day Close - Listing Day Open) / Listing Day Open
  const firstDay = validDays[0];
  const listingDayOpen = firstDay ? (firstDay.open || firstDay.close) : null;
  const listingDayClose = firstDay ? firstDay.close : null;

  let listingDayGainNum = null;
  let listingDayGainStr = '—';
  if (listingDayOpen && listingDayClose && listingDayOpen > 0) {
    listingDayGainNum = ((listingDayClose - listingDayOpen) / listingDayOpen) * 100;
    listingDayGainStr = `${listingDayGainNum >= 0 ? '+' : ''}${listingDayGainNum.toFixed(1)}%`;
  }

  // Current Gain / Return Since Listing Day Close: (Current Price - Listing Day Close) / Listing Day Close
  let gainSinceListingNum = null;
  let gainSinceListingStr = '—';
  if (listingDayClose && lastClose && listingDayClose > 0) {
    gainSinceListingNum = ((lastClose - listingDayClose) / listingDayClose) * 100;
    gainSinceListingStr = `${gainSinceListingNum >= 0 ? '+' : ''}${gainSinceListingNum.toFixed(1)}%`;
  }

  // Canonical ADR & Liquidity calculation matching StockGrid and background.js exactly (20-day window, ((high-low)/low)*100, volume*turnover, and mapLiquidityBucket)
  const {
    avgAdr,
    formattedAdr,
    liquidityValue,
    turnoverCr,
    formattedLiquidity,
    effectiveAdrDays,
    effectiveLiqDays,
  } = calculateStockMetricsFromCandles(validDays, country, paramDefs, adrDays, liquidityDays);

  const adrStr = formattedAdr ? (typeof formattedAdr === 'number' ? `${formattedAdr}%` : String(formattedAdr)) : `${avgAdr.toFixed(1)}%`;
  const liquidityStr = formattedLiquidity || (turnoverCr >= 1 ? `${turnoverCr.toFixed(1)}Cr` : turnoverCr > 0 ? `${(turnoverCr * 100).toFixed(0)}L` : '—');

  // Moving Averages
  const closes = validDays.map(d => d.close);
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

  // SME Migration Detection: Stock is in EQ series with recent listing date, but has > 60 days of historical candles from its prior SME listing
  const isSmeMigration = stock.series === 'EQ' && stock.daysAgo <= 60 && validDays.length > 60;

  let finalIpoStatus = stock.defaultTag;
  if (isIpoBase) {
    if (ipoBaseResult.status === 'BREAKOUT') {
      finalIpoStatus = 'IPO Base (Breakout)';
    } else if (ipoBaseResult.status === 'AT_PIVOT') {
      finalIpoStatus = 'IPO Base (At Pivot)';
    } else {
      finalIpoStatus = 'IPO Base (Forming)';
    }
  } else if (isSmeMigration) {
    finalIpoStatus = 'SME Migration';
  }

  return {
    ...stock,
    price: `₹${lastClose.toFixed(2)}`,
    priceVal: lastClose,
    dailyChangePct: changeStr,
    dailyChangeNum: changePctNum,
    adr: adrStr,
    adrNum: avgAdr,
    effectiveAdrDays: effectiveAdrDays || validDays.length,
    liquidity: liquidityStr,
    liquidityVal: liquidityValue,
    effectiveLiqDays: effectiveLiqDays || validDays.length,
    turnoverCr,
    movingAverages: maBucket,
    above10,
    above21,
    above50,
    vcp: vcpStr,
    vcpTight,
    isIpoBase,
    ipoBaseResult,
    isSmeMigration,
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
 * Hydrates a list of IPO stock items with candle-derived metrics:
 * Price, Daily Change, ADR, Moving Averages, VCP Tightness, and IPO Base Pattern.
 * Supports streaming progressive updates via onProgress(processedCount, totalCount, updatedBatchMap).
 */
export async function hydrateIpoMetricsList(
  ipos,
  country = 'IN',
  onProgress = null,
  paramDefs = null,
  adrDays = 20,
  liquidityDays = 20,
  forceRefresh = false
) {
  if (!Array.isArray(ipos) || ipos.length === 0) return [];

  // Check storage cache first if not forceRefresh
  if (!forceRefresh && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const cached = await new Promise((r) => chrome.storage.local.get([HYDRATED_CACHE_KEY], r));
      const entry = cached?.[HYDRATED_CACHE_KEY];
      if (
        entry &&
        entry.timestamp &&
        Date.now() - entry.timestamp < HYDRATED_CACHE_TTL_MS &&
        Array.isArray(entry.data) &&
        entry.data.length >= Math.floor(ipos.length * 0.8)
      ) {
        if (typeof onProgress === 'function') {
          onProgress(ipos.length, ipos.length, {});
        }
        return entry.data;
      }
    } catch (_err) {
      // Proceed to network fetch
    }
  }

  const symbols = ipos.map((i) => i.symbol);
  let candleMap = {};
  let processedCount = 0;

  const onBatchReceived = (batch) => {
    if (!Array.isArray(batch) || batch.length === 0) return;
    const batchHydratedMap = {};
    batch.forEach((res) => {
      if (res && res.symbol) {
        candleMap[res.symbol] = res.candlesticks || [];
        const origStock = ipos.find((i) => i.symbol === res.symbol);
        if (origStock) {
          batchHydratedMap[res.symbol] = computeStockIpoMetrics(
            origStock,
            res.candlesticks,
            country,
            paramDefs,
            adrDays,
            liquidityDays
          );
        }
      }
    });
    processedCount = Math.min(ipos.length, processedCount + batch.length);
    if (typeof onProgress === 'function') {
      onProgress(processedCount, ipos.length, batchHydratedMap);
    }
  };

  try {
    const rawResults = await fetchStockData(symbols, country, '1y', '1d', null, false, onBatchReceived);
    if (Array.isArray(rawResults)) {
      rawResults.forEach((res) => {
        if (res && res.symbol) {
          candleMap[res.symbol] = res.candlesticks || [];
        }
      });
    } else if (rawResults && typeof rawResults === 'object') {
      Object.entries(rawResults).forEach(([sym, val]) => {
        candleMap[sym] = Array.isArray(val) ? val : (val?.candlesticks || val?.data || []);
      });
    }
  } catch (err) {
    console.warn('[nseIpoService] Failed to fetch batch candle data:', err);
  }

  const hydrated = ipos.map((stock) => {
    return computeStockIpoMetrics(
      stock,
      candleMap[stock.symbol] || [],
      country,
      paramDefs,
      adrDays,
      liquidityDays
    );
  });

  // Save to cache for instantaneous loading on next mount
  if (typeof chrome !== 'undefined' && chrome.storage?.local && hydrated.length > 0) {
    try {
      chrome.storage.local.set({
        [HYDRATED_CACHE_KEY]: {
          timestamp: Date.now(),
          data: hydrated,
        },
      });
    } catch (_err) {
      // Ignore cache write error
    }
  }

  if (typeof onProgress === 'function') {
    onProgress(ipos.length, ipos.length, {});
  }

  return hydrated;
}
