class LRUFundamentalsCache {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const item = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key, data) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      fetchedAt: Date.now()
    });

    this.saveToStorage();
  }

  isValid(key, ttlMs = 8 * 60 * 60 * 1000) {
    const item = this.get(key);
    if (!item || !item.data) return false;
    // Don't treat cached failed attempts (all N/A) as valid
    if (item.data.hasRawData === false) return false;
    if (item.data.fundamentals && item.data.fundamentals.marketCap === 'N/A' && item.data.fundamentals.peRatio === 'N/A') return false;
    // Invalidate old caches that do not have quarterlyHistory or lack netProfit / qoqProfitGrowth
    if (!item.data.fundamentals || !Array.isArray(item.data.fundamentals.quarterlyHistory)) return false;
    const qHist = item.data.fundamentals.quarterlyHistory;
    if (qHist.length > 0) {
      const hasQoqOrNet = qHist.some(q => q.netProfit && q.netProfit !== 'N/A');
      if (!hasQoqOrNet) return false;
    }
    return (Date.now() - item.fetchedAt) < ttlMs;
  }

  async saveToStorage() {
    try {
      const serialized = {};
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item && item.data && item.data.hasRawData !== false && (now - item.fetchedAt < 8 * 60 * 60 * 1000)) {
          serialized[key] = item;
        }
      }
      const storageKey = 'trade_clarity_fundamentals_v5_cache';
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [storageKey]: serialized });
      } else if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(storageKey, JSON.stringify(serialized));
      }
    } catch (e) {
      console.warn("Failed to persist fundamentals cache:", e);
    }
  }

  async loadFromStorage() {
    try {
      const storageKey = 'trade_clarity_fundamentals_v5_cache';
      let stored = null;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const res = await new Promise(r => chrome.storage.local.get(storageKey, r));
        stored = res[storageKey];
      } else if (typeof window !== 'undefined' && window.localStorage) {
        stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      }

      if (stored) {
        const now = Date.now();
        Object.entries(stored).forEach(([key, item]) => {
          if (item && item.data && item.data.hasRawData !== false && (now - item.fetchedAt < 8 * 60 * 60 * 1000)) {
            const qHist = item.data.fundamentals?.quarterlyHistory;
            if (Array.isArray(qHist) && qHist.some(q => q.netProfit && q.netProfit !== 'N/A')) {
              this.cache.set(key, item);
            }
          }
        });
      }
    } catch (e) {
      console.warn("Failed to load fundamentals cache from storage:", e);
    }
  }

  async clear() {
    this.cache.clear();
    const storageKey = 'trade_clarity_fundamentals_v5_cache';
    if (typeof chrome !== 'undefined' && typeof chrome.storage?.local?.remove === 'function') {
      await chrome.storage.local.remove(storageKey);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(storageKey);
    }
  }
}

export const globalFundamentalsCache = new LRUFundamentalsCache(200);
globalFundamentalsCache.loadFromStorage();

let sessionCrumb = null;
let sessionCookie = null;
let crumbFetchedAt = 0;

async function getYahooCrumbAndCookie() {
  const now = Date.now();
  if (sessionCrumb && (now - crumbFetchedAt < 12 * 60 * 60 * 1000)) {
    return { crumb: sessionCrumb, cookie: sessionCookie };
  }

  try {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (isLocalhost) {
      return { crumb: null, cookie: null };
    }

    let cookieVal = sessionCookie || '';

    // Step 1: Initialize Yahoo session cookie quietly without triggering CORS errors
    try {
      const fcRes = await fetch('https://fc.yahoo.com', { mode: 'no-cors', credentials: 'include' });
      const setCookie = fcRes.headers ? fcRes.headers.get('set-cookie') : null;
      if (setCookie) {
        const a3Match = setCookie.match(/A3=[^;]+/);
        if (a3Match) cookieVal = a3Match[0];
      }
    } catch {
      // Ignore no-cors cookie preflight failure
    }

    const crumbHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };
    if (cookieVal) {
      crumbHeaders['Cookie'] = cookieVal;
    }

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      credentials: 'include',
      headers: crumbHeaders
    });

    if (crumbRes.ok) {
      const text = await crumbRes.text();
      if (text && !text.includes('<html')) {
        sessionCrumb = text.trim();
        sessionCookie = cookieVal;
        crumbFetchedAt = now;
        return { crumb: sessionCrumb, cookie: sessionCookie };
      }
    }
  } catch (e) {
    console.warn("Yahoo Session Crumb fetch failed:", e.message);
  }

  return { crumb: null, cookie: null };
}

export function evaluateFundamentalHealth(fundamentals = {}, catalysts = {}) {
  const pros = [];
  const cons = [];

  // 1. Earnings Growth Check
  const eg = fundamentals.rawEarningsGrowth;
  if (typeof eg === 'number') {
    if (eg >= 0.20) {
      pros.push(`Strong Profit Surge: Earnings up ${(eg * 100).toFixed(1)}% YoY (exceeds 20% growth benchmark)`);
    } else if (eg > 0) {
      pros.push(`Positive Earnings Growth: Earnings up ${(eg * 100).toFixed(1)}% YoY`);
    } else {
      cons.push(`Profit Contraction: Earnings declined ${(Math.abs(eg) * 100).toFixed(1)}% YoY`);
    }
  }

  // 2. Revenue Growth Check
  const rg = fundamentals.rawRevenueGrowth;
  if (typeof rg === 'number') {
    if (rg >= 0.15) {
      pros.push(`Top-Line Expansion: Revenue growing ${(rg * 100).toFixed(1)}% YoY`);
    } else if (rg < 0) {
      cons.push(`Revenue Shrinkage: Sales dropped ${(Math.abs(rg) * 100).toFixed(1)}% YoY`);
    }
  }

  // 3. Forward P/E Expansion Check
  const tPE = fundamentals.rawTrailingPE;
  const fPE = fundamentals.rawForwardPE;
  if (typeof tPE === 'number' && typeof fPE === 'number' && tPE > 0 && fPE > 0) {
    if (fPE < tPE * 0.85) {
      pros.push(`Expected Earnings Expansion: Forward P/E (${fPE.toFixed(1)}) is significantly lower than current P/E (${tPE.toFixed(1)})`);
    }
  }

  // 4. Return on Equity (ROE) Check
  const roe = fundamentals.rawROE;
  if (typeof roe === 'number') {
    if (roe >= 0.15) {
      pros.push(`High Capital Efficiency: ROE of ${(roe * 100).toFixed(1)}% exceeds 15% benchmark`);
    } else if (roe < 0.05 && roe > 0) {
      cons.push(`Sub-par Capital Efficiency: Low ROE of ${(roe * 100).toFixed(1)}%`);
    }
  }

  // 5. Debt Risk Check
  const de = fundamentals.rawDebtToEquity;
  if (typeof de === 'number') {
    if (de > 2.5) {
      cons.push(`Heavy Debt Load: Debt-to-Equity is high at ${de.toFixed(2)}x`);
    } else if (de < 0.5 && de > 0) {
      pros.push(`Low Debt Risk: Conservative Debt-to-Equity ratio of ${de.toFixed(2)}x`);
    }
  }

  // 6. Upcoming Earnings Notice & Gap Risk
  if (catalysts.earningsDaysAway !== null && catalysts.earningsDaysAway !== undefined) {
    const days = catalysts.earningsDaysAway;
    if (days >= 0 && days <= 7) {
      cons.push(`⚠️ Imminent Earnings Notice: Company reports earnings in ${days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''}`} (${catalysts.earningsDate})`);
    } else if (days > 7 && days <= 30) {
      pros.push(`Upcoming Earnings Release scheduled for ${catalysts.earningsDate} (in ${days} days)`);
    }
  }

  let baseScore = 5;
  baseScore += pros.length * 1.5;
  baseScore -= cons.length * 1.0;
  const score = Math.max(1, Math.min(10, Math.round(baseScore * 10) / 10));

  let verdict = "NEUTRAL SETUP";
  if (score >= 8.0) verdict = "STRONG GROWTH SETUP";
  else if (score >= 6.5) verdict = "MODERATE GROWTH SETUP";
  else if (score <= 4.0) verdict = "WEAK FUNDAMENTAL PROFILE";

  return { pros, cons, score, verdict };
}

export function formatLargeNumber(val, country = 'US') {
  if (val === undefined || val === null || isNaN(val)) return 'N/A';
  const num = Number(val);

  if (country === 'IN') {
    const symbolStr = '₹';
    if (Math.abs(num) >= 1e12) {
      return `${symbolStr}${(num / 1e12).toFixed(2)} Lakh Cr`;
    }
    if (Math.abs(num) >= 1e7) {
      return `${symbolStr}${(num / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    }
    if (Math.abs(num) >= 1e5) {
      return `${symbolStr}${(num / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakh`;
    }
    return `${symbolStr}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  } else {
    const symbolStr = '$';
    if (Math.abs(num) >= 1e12) return `${symbolStr}${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `${symbolStr}${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `${symbolStr}${(num / 1e6).toFixed(2)}M`;
    if (Math.abs(num) >= 1e3) return `${symbolStr}${(num / 1e3).toFixed(2)}K`;
    return `${symbolStr}${num.toFixed(2)}`;
  }
}

export async function fetchStockSummary(symbol, country = 'US', forceRefresh = false) {
  if (!symbol) return null;

  let ticker = symbol;
  if (country === 'IN' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO') && !symbol.startsWith('^')) {
    ticker = `${symbol}.NS`;
  }

  const cacheKey = `${ticker}_${country}`;
  if (!forceRefresh && globalFundamentalsCache.isValid(cacheKey)) {
    return globalFundamentalsCache.get(cacheKey).data;
  }

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query2.finance.yahoo.com';

  let rawSummary = null;
  let rawNews = [];
  let rawEvents = {};

  try {
    const { crumb, cookie } = await getYahooCrumbAndCookie();
    const modules = 'summaryDetail,financialData,defaultKeyStatistics,assetProfile,calendarEvents,incomeStatementHistoryQuarterly,earnings,earningsHistory';
    let summaryUrl = `${baseUrl}/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
    if (crumb) {
      summaryUrl += `&crumb=${encodeURIComponent(crumb)}`;
    }

    const headers = {};
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const summaryRes = await fetch(summaryUrl, { headers, credentials: 'include' });
    if (summaryRes.ok) {
      const summaryJson = await summaryRes.json();
      rawSummary = summaryJson.quoteSummary?.result?.[0] || null;
    }

    // Automatic fallback: If rawSummary is null/empty and symbol doesn't end with .NS/.BO, retry with .NS (Indian stock)
    if (!rawSummary && !ticker.endsWith('.NS') && !ticker.endsWith('.BO') && !ticker.startsWith('^')) {
      const nsTicker = `${ticker}.NS`;
      let nsSummaryUrl = `${baseUrl}/v10/finance/quoteSummary/${encodeURIComponent(nsTicker)}?modules=${modules}`;
      if (crumb) {
        nsSummaryUrl += `&crumb=${encodeURIComponent(crumb)}`;
      }
      try {
        const nsRes = await fetch(nsSummaryUrl, { headers, credentials: 'include' });
        if (nsRes.ok) {
          const nsJson = await nsRes.json();
          const nsSummary = nsJson.quoteSummary?.result?.[0] || null;
          if (nsSummary) {
            rawSummary = nsSummary;
            ticker = nsTicker; // Successfully resolved as Indian stock!
          }
        }
      } catch (nsErr) {
        console.warn(`[stockAnalysisApi] Failed .NS fallback fetch for ${nsTicker}:`, nsErr.message);
      }
    }
  } catch (e) {
    console.warn(`[stockAnalysisApi] Failed quoteSummary fetch for ${ticker}:`, e.message);
  }

  // 2. Fetch News Catalysts
  try {
    const newsUrl = `${baseUrl}/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=10`;
    const newsRes = await fetch(newsUrl, { credentials: 'include' });
    if (newsRes.ok) {
      const newsJson = await newsRes.json();
      rawNews = newsJson.news || [];
    }
  } catch (e) {
    console.warn(`[stockAnalysisApi] Failed news fetch for ${ticker}:`, e.message);
  }

  // 3. Fetch Chart Events (Dividends & Splits)
  try {
    const chartUrl = `${baseUrl}/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&events=div%7Csplit`;
    const chartRes = await fetch(chartUrl, { credentials: 'include' });
    if (chartRes.ok) {
      const chartJson = await chartRes.json();
      rawEvents = chartJson.chart?.result?.[0]?.events || {};
    }
  } catch (e) {
    console.warn(`[stockAnalysisApi] Failed chart events fetch for ${ticker}:`, e.message);
  }

  // Map Summary Data
  const summaryDetail = rawSummary?.summaryDetail || {};
  const financialData = rawSummary?.financialData || {};
  const keyStats = rawSummary?.defaultKeyStatistics || {};
  const assetProfile = rawSummary?.assetProfile || {};
  const calendarEvents = rawSummary?.calendarEvents || {};

  // Accurate Earnings date parsing
  let earningsDateStr = null;
  let earningsDaysAway = null;
  let isEarningsEstimate = false;
  if (calendarEvents.earnings?.earningsDate?.[0]?.raw || calendarEvents.earnings?.earningsDate?.[0]?.fmt) {
    const rawSec = calendarEvents.earnings.earningsDate[0].raw;
    const fmtStr = calendarEvents.earnings.earningsDate[0].fmt;
    const d = rawSec ? new Date(rawSec * 1000) : new Date(fmtStr);
    if (!isNaN(d.getTime())) {
      earningsDateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const diffMs = d.getTime() - Date.now();
      earningsDaysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    isEarningsEstimate = !!calendarEvents.earnings?.isEarningsDateEstimate;
  }

  const effectiveCountry = (country === 'IN' || ticker?.endsWith('.NS') || ticker?.endsWith('.BO') || symbol?.endsWith('.NS') || symbol?.endsWith('.BO')) ? 'IN' : 'US';

  // 3-tier Fallback Parser for Quarterly Financial Performance (with Profit, OPM, EBITDA & Revenue)
  let quarterlyHistory = [];
  const rawHistory = rawSummary?.earningsHistory?.history || [];
  const rawFinChart = rawSummary?.earnings?.financialsChart?.quarterly || [];
  const rawIncomeStmt = rawSummary?.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];

  const incomeMap = {};
  if (Array.isArray(rawIncomeStmt)) {
    rawIncomeStmt.forEach(s => {
      const qDate = s.endDate?.fmt || '';
      const rev = s.totalRevenue?.raw;
      const opInc = s.operatingIncome?.raw;
      const netInc = s.netIncome?.raw;
      const ebitdaVal = s.ebitda?.raw || opInc;
      const opMargin = (rev && opInc) ? `${((opInc / rev) * 100).toFixed(1)}%` : ((rev && netInc) ? `${((netInc / rev) * 100).toFixed(1)}%` : null);
      if (qDate) {
        incomeMap[qDate] = {
          rawRev: rev,
          rawNet: netInc,
          rawOpInc: opInc,
          rawEbitda: ebitdaVal,
          netProfit: netInc !== undefined ? formatLargeNumber(netInc, effectiveCountry) : null,
          opm: opMargin,
          ebitda: ebitdaVal !== undefined ? formatLargeNumber(ebitdaVal, effectiveCountry) : null,
          revenue: rev !== undefined ? formatLargeNumber(rev, effectiveCountry) : null
        };
      }
    });
  }

  if (Array.isArray(rawFinChart)) {
    rawFinChart.forEach((fc, idx) => {
      const rev = fc.revenue?.raw;
      const netInc = fc.earnings?.raw;
      const key = fc.date || `idx_${idx}`;
      if (!incomeMap[key]) {
        incomeMap[key] = {
          rawRev: rev,
          rawNet: netInc,
          netProfit: netInc !== undefined ? formatLargeNumber(netInc, effectiveCountry) : null,
          opm: (rev && netInc) ? `${((netInc / rev) * 100).toFixed(1)}%` : null,
          ebitda: null,
          revenue: rev !== undefined ? formatLargeNumber(rev, effectiveCountry) : null
        };
      }
    });
  }

  if (rawHistory.length > 0) {
    quarterlyHistory = rawHistory.map((h, idx) => {
      const qDate = h.quarter?.fmt || 'N/A';
      const incData = incomeMap[qDate] || (rawIncomeStmt[idx] ? {
        rawRev: rawIncomeStmt[idx].totalRevenue?.raw,
        rawNet: rawIncomeStmt[idx].netIncome?.raw,
        netProfit: rawIncomeStmt[idx].netIncome?.raw !== undefined ? formatLargeNumber(rawIncomeStmt[idx].netIncome.raw, effectiveCountry) : null,
        opm: (rawIncomeStmt[idx].totalRevenue?.raw && rawIncomeStmt[idx].operatingIncome?.raw) ? `${((rawIncomeStmt[idx].operatingIncome.raw / rawIncomeStmt[idx].totalRevenue.raw) * 100).toFixed(1)}%` : null,
        ebitda: (rawIncomeStmt[idx].ebitda?.raw || rawIncomeStmt[idx].operatingIncome?.raw) !== undefined ? formatLargeNumber(rawIncomeStmt[idx].ebitda?.raw || rawIncomeStmt[idx].operatingIncome?.raw, effectiveCountry) : null,
        revenue: rawIncomeStmt[idx].totalRevenue?.raw !== undefined ? formatLargeNumber(rawIncomeStmt[idx].totalRevenue.raw, effectiveCountry) : null
      } : (rawFinChart[idx] ? {
        rawRev: rawFinChart[idx].revenue?.raw,
        rawNet: rawFinChart[idx].earnings?.raw,
        netProfit: rawFinChart[idx].earnings?.raw !== undefined ? formatLargeNumber(rawFinChart[idx].earnings.raw, effectiveCountry) : null,
        opm: (rawFinChart[idx].revenue?.raw && rawFinChart[idx].earnings?.raw) ? `${((rawFinChart[idx].earnings.raw / rawFinChart[idx].revenue.raw) * 100).toFixed(1)}%` : null,
        revenue: rawFinChart[idx].revenue?.raw !== undefined ? formatLargeNumber(rawFinChart[idx].revenue.raw, effectiveCountry) : null
      } : {}));

      return {
        quarter: qDate,
        epsActual: h.epsActual?.fmt ?? (h.epsActual?.raw !== undefined ? h.epsActual.raw.toFixed(2) : 'N/A'),
        epsEstimate: h.epsEstimate?.fmt ?? (h.epsEstimate?.raw !== undefined ? h.epsEstimate.raw.toFixed(2) : 'N/A'),
        surprisePercent: h.surprisePercent?.fmt ?? (h.surprisePercent?.raw !== undefined ? `${(h.surprisePercent.raw * 100).toFixed(1)}%` : null),
        netProfit: incData.netProfit || 'N/A',
        opm: incData.opm || 'N/A',
        ebitda: incData.ebitda || 'N/A',
        revenue: incData.revenue || 'N/A',
        rawRev: incData.rawRev,
        rawNet: incData.rawNet
      };
    });
  } else if (rawFinChart.length > 0) {
    quarterlyHistory = rawFinChart.map(q => ({
      quarter: q.date || 'N/A',
      epsActual: 'N/A',
      epsEstimate: 'N/A',
      surprisePercent: null,
      revenue: formatLargeNumber(q.revenue?.raw, effectiveCountry),
      netProfit: formatLargeNumber(q.earnings?.raw, effectiveCountry),
      opm: (q.revenue?.raw && q.earnings?.raw) ? `${((q.earnings.raw / q.revenue.raw) * 100).toFixed(1)}%` : 'N/A',
      ebitda: 'N/A',
      rawRev: q.revenue?.raw,
      rawNet: q.earnings?.raw
    }));
  } else if (rawIncomeStmt.length > 0) {
    quarterlyHistory = rawIncomeStmt.map(s => {
      const rev = s.totalRevenue?.raw;
      const opInc = s.operatingIncome?.raw;
      const netInc = s.netIncome?.raw;
      const opMargin = (rev && opInc) ? `${((opInc / rev) * 100).toFixed(1)}%` : ((rev && netInc) ? `${((netInc / rev) * 100).toFixed(1)}%` : 'N/A');
      return {
        quarter: s.endDate?.fmt || 'N/A',
        epsActual: 'N/A',
        epsEstimate: 'N/A',
        surprisePercent: null,
        revenue: s.totalRevenue?.fmt || formatLargeNumber(rev, effectiveCountry),
        netProfit: s.netIncome?.fmt || formatLargeNumber(netInc, effectiveCountry),
        opm: opMargin,
        ebitda: formatLargeNumber(s.ebitda?.raw || opInc, effectiveCountry),
        rawRev: rev,
        rawNet: netInc
      };
    });
  }

  // Calculate QoQ Growth (%) for Revenue and Net Profit across quarters
  for (let i = 0; i < quarterlyHistory.length; i++) {
    const curr = quarterlyHistory[i];
    const prev = quarterlyHistory[i - 1]; // Previous quarter in sequence

    if (prev && typeof curr.rawRev === 'number' && typeof prev.rawRev === 'number' && prev.rawRev > 0) {
      const growth = ((curr.rawRev - prev.rawRev) / Math.abs(prev.rawRev)) * 100;
      curr.qoqRevenueGrowth = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    } else {
      curr.qoqRevenueGrowth = 'N/A';
    }

    if (prev && typeof curr.rawNet === 'number' && typeof prev.rawNet === 'number' && Math.abs(prev.rawNet) > 0) {
      const growth = ((curr.rawNet - prev.rawNet) / Math.abs(prev.rawNet)) * 100;
      curr.qoqProfitGrowth = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    } else {
      curr.qoqProfitGrowth = 'N/A';
    }
  }

  // Latest Dividend parsing
  let latestDiv = null;
  if (rawEvents.dividends && Object.keys(rawEvents.dividends).length > 0) {
    const sortedDivs = Object.values(rawEvents.dividends).sort((a, b) => b.date - a.date);
    const topDiv = sortedDivs[0];
    if (topDiv) {
      latestDiv = {
        amount: topDiv.amount,
        date: new Date(topDiv.date * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      };
    }
  }

  // Splits parsing
  const splitsList = rawEvents.splits ? Object.values(rawEvents.splits).map(s => ({
    numerator: s.numerator,
    denominator: s.denominator,
    splitRatio: s.splitRatio,
    date: new Date(s.date * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  })) : [];

  const fundamentals = {
    marketCap: formatLargeNumber(summaryDetail.marketCap?.raw, effectiveCountry),
    rawMarketCap: summaryDetail.marketCap?.raw || null,

    peRatio: summaryDetail.trailingPE?.fmt || (summaryDetail.trailingPE?.raw ? summaryDetail.trailingPE.raw.toFixed(2) : 'N/A'),
    rawTrailingPE: summaryDetail.trailingPE?.raw || null,

    forwardPE: summaryDetail.forwardPE?.fmt || (summaryDetail.forwardPE?.raw ? summaryDetail.forwardPE.raw.toFixed(2) : 'N/A'),
    rawForwardPE: summaryDetail.forwardPE?.raw || null,

    priceToBook: keyStats.priceToBook?.fmt || (keyStats.priceToBook?.raw ? keyStats.priceToBook.raw.toFixed(2) : 'N/A'),
    epsTrailing: keyStats.trailingEps?.fmt || (keyStats.trailingEps?.raw ? keyStats.trailingEps.raw.toFixed(2) : 'N/A'),

    revenueGrowth: financialData.revenueGrowth?.fmt || (financialData.revenueGrowth?.raw ? `${(financialData.revenueGrowth.raw * 100).toFixed(1)}%` : 'N/A'),
    rawRevenueGrowth: financialData.revenueGrowth?.raw || null,

    earningsGrowth: financialData.earningsGrowth?.fmt || (financialData.earningsGrowth?.raw ? `${(financialData.earningsGrowth.raw * 100).toFixed(1)}%` : 'N/A'),
    rawEarningsGrowth: financialData.earningsGrowth?.raw || null,

    profitMargins: financialData.profitMargins?.fmt || (financialData.profitMargins?.raw ? `${(financialData.profitMargins.raw * 100).toFixed(1)}%` : 'N/A'),
    operatingMargins: financialData.operatingMargins?.fmt || (financialData.operatingMargins?.raw ? `${(financialData.operatingMargins.raw * 100).toFixed(1)}%` : 'N/A'),

    returnOnEquity: financialData.returnOnEquity?.fmt || (financialData.returnOnEquity?.raw ? `${(financialData.returnOnEquity.raw * 100).toFixed(1)}%` : 'N/A'),
    rawROE: financialData.returnOnEquity?.raw || null,

    totalDebt: formatLargeNumber(financialData.totalDebt?.raw, effectiveCountry),
    debtToEquity: financialData.debtToEquity?.fmt || (financialData.debtToEquity?.raw ? (financialData.debtToEquity.raw / 100).toFixed(2) : 'N/A'),
    rawDebtToEquity: financialData.debtToEquity?.raw ? (financialData.debtToEquity.raw / 100) : null,

    sector: assetProfile.sector || 'N/A',
    industry: assetProfile.industry || 'N/A',

    quarterlyHistory,
    effectiveCountry
  };

  // Strict news relevance filtering: Only include news where symbol/ticker is related or in title
  const cleanSymbol = ticker.replace(/\.(NS|BO)$/, '').toUpperCase();
  const filteredNews = rawNews.filter(n => {
    const tickers = (n.relatedTickers || []).map(t => t.toUpperCase());
    const title = (n.title || '').toUpperCase();
    if (tickers.includes(ticker.toUpperCase()) || tickers.includes(cleanSymbol)) return true;
    if (title.includes(cleanSymbol) || title.includes(symbol.toUpperCase())) return true;
    return false;
  });

  const catalysts = {
    earningsDate: earningsDateStr,
    earningsDaysAway,
    isEarningsEstimate,
    dividendYield: summaryDetail.dividendYield?.fmt || (summaryDetail.dividendYield?.raw ? `${(summaryDetail.dividendYield.raw * 100).toFixed(2)}%` : null),
    latestDividend: latestDiv,
    splits: splitsList,
    newsFeed: filteredNews.slice(0, 5).map(n => ({
      id: n.uuid || n.link,
      title: n.title,
      publisher: n.publisher,
      date: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A',
      link: n.link
    }))
  };

  const hasRawData = !!rawSummary;

  const parsedData = {
    symbol,
    country,
    fetchedAt: Date.now(),
    hasRawData,
    fundamentals,
    catalysts
  };

  if (hasRawData) {
    globalFundamentalsCache.set(cacheKey, parsedData);
  }
  return parsedData;
}
