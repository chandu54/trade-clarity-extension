import { fetchStockData } from "../utils/yahooFinanceMap.js";

/**
 * Calculates Simple Moving Average
 */
function calculateSMA(data, period) {
  if (!data || data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, bar) => acc + bar.close, 0);
  return sum / period;
}

/**
 * Calculates RSI (14)
 */
function calculateRSI(data, period = 14) {
  if (!data || data.length < period + 1) return null;
  const changes = [];
  const subset = data.slice(-(period + 1));
  for (let i = 1; i < subset.length; i++) {
    changes.push(subset[i].close - subset[i-1].close);
  }
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.reduce((a,b) => a+b, 0) / period;
  const avgLoss = losses.reduce((a,b) => a+b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculates a comprehensive Health Score (0-100) and identifies the Trend Phase
 */
function getInstitutionalTrend(price, smas = {}) {
  const { sma21, sma50, sma200 } = smas;
  
  if (!price || (!sma21 && !sma50)) {
    return { score: 0, phase: "Insufficient Data", color: "var(--muted)" };
  }

  // Standard 3-MA Institutional Scoring if 200MA is available
  if (sma200) {
    let score = 0;
    if (price > sma200) score += 40;
    if (price > sma50) score += 30;
    if (price > sma21) score += 30;

    let phase;
    let color;

    if (score >= 100) {
      const extension = ((price - sma21) / sma21) * 100;
      phase = extension > 8 ? "Bullish Extension" : "Structural Bull";
      color = "#10b981";
    } else if (score >= 70) {
      phase = "Bullish Trend";
      color = "#10b981";
    } else if (score >= 40) {
      phase = price > sma200 ? "Mean Reversion (Bull)" : "Mean Reversion (Bear)";
      color = "#f59e0b";
    } else if (score >= 30) {
      phase = "Bearish Transition";
      color = "#ef4444";
    } else {
      phase = "Structural Bear";
      color = "#ef4444";
    }

    return { score, phase, color };
  }

  // Fallback for emerging sector indices with fewer than 200 candles (evaluate via 21MA & 50MA)
  let score = 50;
  let phase = "Emerging Bull";
  let color = "#10b981";

  if (sma21 && sma50) {
    if (price > sma21 && sma21 > sma50) {
      score = 85;
      phase = "Bullish Trend";
      color = "#10b981";
    } else if (price > sma21) {
      score = 60;
      phase = "Emerging Bull";
      color = "#10b981";
    } else if (price < sma21 && sma21 < sma50) {
      score = 15;
      phase = "Bearish Trend";
      color = "#ef4444";
    } else {
      score = 40;
      phase = "Mean Reversion (Bull)";
      color = "#f59e0b";
    }
  } else if (sma21) {
    if (price > sma21) {
      score = 70;
      phase = "Bullish Trend";
      color = "#10b981";
    } else {
      score = 30;
      phase = "Bearish Trend";
      color = "#ef4444";
    }
  }

  return { score, phase, color };
}

export const INDEX_CONSTITUENTS = {
  "^NSEI": ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "LT"],
  "NIFTY_MIDCAP_100.NS": ["SUZLON", "PERSISTENT", "FEDERALBNK", "POLYCAB", "TRENT", "AUROPHARMA", "MAXHEALTH"],
  "^CNXSC": ["BSE", "CENTRALBK", "ANGELONE", "HUDCO", "MCX", "AMBER", "KEI"],
  "^CRSLDX": ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "LT"],
  "^NSEBANK": ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN", "PNB", "BANKBARODA", "INDUSINDBK"],
  "^CNXIT": ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTIM", "PERSISTENT", "COFORGE"],
  "^CNXMETAL": ["TATASTEEL", "JINDALSTEL", "HINDALCO", "JSWSTEEL", "VEDL", "NMDC", "COALINDIA", "SAIL"],
  "^CNXPHARMA": ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "LUPIN", "TORNTPHARM", "MANKIND", "ZYDUSLIFE"],
  "^CNXAUTO": ["MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "HEROMOTOCO", "EICHERMOT", "TVSMOTOR", "BHARATFORG"],
  "^CNXFMCG": ["ITC", "HINDUNILVR", "NESTLEIND", "BRITANNIA", "TATACONSUM", "VBL", "DABUR", "GODREJCP"],
  "^CNXREALTY": ["DLF", "LODHA", "GODREJPROP", "OBEROIRLTY", "PHOENIXLTD", "PRESTIGE", "SOBHA", "BRIGADE"],
  "^CNXENERGY": ["RELIANCE", "NTPC", "ONGC", "POWERGRID", "BPCL", "IOC", "TATAPOWER", "GAIL"],
  "^CNXINFRA": ["LT", "RELIANCE", "NTPC", "ONGC", "BHARTIARTL", "POWERGRID", "ULTRACEMCO", "GRASIM"],
  "^CNXMEDIA": ["SUNTV", "ZEEL", "PVRINOX", "NAZARA", "DISHTV", "HATHWAY", "NETWORK18"],
  "^CNXPSUBANK": ["SBIN", "PNB", "BANKBARODA", "CANBK", "UNIONBANK", "IOB", "INDIANB"],
  "NIFTY_PVT_BANK.NS": ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "FEDERALBNK", "IDFCFIRSTB"],
  "NIFTY_FIN_SERVICE.NS": ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN", "BAJFINANCE", "BAJAJFINSV", "HDFCLIFE"],
  "^CNXCONSUM": ["BHARTIARTL", "ITC", "M&M", "ASIANPAINT", "TITAN", "VBL", "TRENT"],
  "^CNXPSE": ["NTPC", "ONGC", "POWERGRID", "COALINDIA", "BEL", "HAL", "PFC", "RECLTD"],
  "^CNXSERVICE": ["HDFCBANK", "ICICIBANK", "TCS", "INFY", "BHARTIARTL", "KOTAKBANK", "AXISBANK", "SBIN"],
  "^CNXCMDT": ["RELIANCE", "NTPC", "ONGC", "TATASTEEL", "HINDALCO", "JSWSTEEL", "COALINDIA", "ULTRACEMCO"],
  "^CNXMNC": ["HINDUNILVR", "NESTLEIND", "BRITANNIA", "MARUTI", "ABB", "SIEMENS", "COALINDIA"],
  "HEALTHIETF.NS": ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "LUPIN", "TORNTPHARM", "MANKIND", "MAXHEALTH"],
  "OILIETF.NS": ["RELIANCE", "ONGC", "BPCL", "IOC", "GAIL", "OIL", "PETRONET", "HPCL"],
  "DEFENCE.NS": ["HAL", "BEL", "MAZDOCK", "COCHINSHIP", "BDL", "PARAS", "DATAPATT"],
  "CPSEETF.NS": ["NTPC", "ONGC", "POWERGRID", "COALINDIA", "BEL", "PFC", "RECLTD", "OIL"],
  "NIFTY_CHEMICALS.NS": ["SRF", "PIIND", "UPL", "LINDEINDIA", "SOLARINDS", "DEEPAKNTR", "GUJGASLTD"],
  "NIFTY_EV.NS": ["TATAMOTORS", "M&M", "MARUTI", "BAJAJ-AUTO", "EXIDEIND", "AMARARAJ", "OLECTRA"],
  "^GSPC": ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "BRK-B", "LLY", "AVGO", "JPM"],
  "^IXIC": ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO", "TSLA", "COST", "AMD"],
  "^DJI": ["UNH", "GS", "HD", "MSFT", "CAT", "CRM", "AMGN", "V", "BA", "HON"],
  "^RUT": ["SMCX", "FTAI", "VRT", "MEDP", "ENSG", "SFNC", "ELF", "FN", "WING"],
  "XLK": ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ACN", "CSCO", "AMD"],
  "XLF": ["BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "SPGI"],
  "XLV": ["LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "PFE", "DHR"],
  "XLE": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY"],
  "XLI": ["GE", "CAT", "RTX", "HON", "UNP", "DE", "LMT", "BA", "UPS"],
  "XLB": ["LIN", "APD", "SHW", "FCX", "NEM", "ECL", "CTVA", "DD"],
  "XLU": ["NEE", "SO", "DUK", "CEG", "AEP", "SRE", "D", "PEG"],
  "XLY": ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX"],
  "XLP": ["PG", "COST", "PEP", "KO", "WMT", "PM", "MDLZ", "MO"]
};

export const MARKET_GROUPS = {
  IN: [
    {
      category: "Major Indices",
      symbols: ["^NSEI", "NIFTY_MIDCAP_100.NS", "^CNXSC", "^CRSLDX"],
    },
    {
      category: "Sectoral Health",
      symbols: [
        "^NSEBANK", "^CNXIT", "^CNXMETAL", "^CNXPHARMA", "^CNXAUTO",
        "^CNXFMCG", "^CNXREALTY", "^CNXENERGY", "^CNXINFRA", "^CNXMEDIA",
        "^CNXPSUBANK", "NIFTY_PVT_BANK.NS", "NIFTY_FIN_SERVICE.NS",
        "^CNXCONSUM", "^CNXPSE", "^CNXSERVICE", "^CNXCMDT", "^CNXMNC",
        "HEALTHIETF.NS", "OILIETF.NS", "DEFENCE.NS", "CPSEETF.NS",
        "NIFTY_CHEMICALS.NS", "NIFTY_EV.NS"
      ],
    },
  ],
  US: [
    {
      category: "Major Indices",
      symbols: ["^GSPC", "^IXIC", "^DJI", "^RUT"],
    },
    {
      category: "Sector ETFs",
      symbols: ["XLK", "XLF", "XLV", "XLE", "XLI", "XLB", "XLU", "XLY", "XLP"],
    },
  ],
};

const NSE_SYMBOL_MAP = {
  'NIFTY 50': '^NSEI',
  'NIFTY MIDCAP 100': 'NIFTY_MIDCAP_100.NS',
  'NIFTY SMLCAP 100': '^CNXSC',
  'NIFTY SMALLCAP 100': '^CNXSC',
  'NIFTY 500': '^CRSLDX',
  'NIFTY BANK': '^NSEBANK',
  'NIFTY IT': '^CNXIT',
  'NIFTY METAL': '^CNXMETAL',
  'NIFTY PHARMA': '^CNXPHARMA',
  'NIFTY AUTO': '^CNXAUTO',
  'NIFTY FMCG': '^CNXFMCG',
  'NIFTY REALTY': '^CNXREALTY',
  'NIFTY ENERGY': '^CNXENERGY',
  'NIFTY INFRA': '^CNXINFRA',
  'NIFTY INFRASTRUCTURE': '^CNXINFRA',
  'NIFTY MEDIA': '^CNXMEDIA',
  'NIFTY PSU BANK': '^CNXPSUBANK',
  'NIFTY PVT BANK': 'NIFTY_PVT_BANK.NS',
  'NIFTY PRIVATE BANK': 'NIFTY_PVT_BANK.NS',
  'NIFTY FIN SERVICE': 'NIFTY_FIN_SERVICE.NS',
  'NIFTY FINANCIAL SERVICES': 'NIFTY_FIN_SERVICE.NS',
  'NIFTY CONSUMPTION': '^CNXCONSUM',
  'NIFTY INDIA CONSUMPTION': '^CNXCONSUM',
  'NIFTY PSE': '^CNXPSE',
  'NIFTY SERV SECTOR': '^CNXSERVICE',
  'NIFTY SERVICES SECTOR': '^CNXSERVICE',
  'NIFTY COMMODITIES': '^CNXCMDT',
  'NIFTY MNC': '^CNXMNC',
  'NIFTY HEALTHCARE': 'HEALTHIETF.NS',
  'NIFTY OIL AND GAS': 'OILIETF.NS',
  'NIFTY OIL & GAS': 'OILIETF.NS',
  'NIFTY IND DEFENCE': 'DEFENCE.NS',
  'NIFTY INDIA DEFENCE': 'DEFENCE.NS',
  'NIFTY CPSE': 'CPSEETF.NS',
  'NIFTY CHEMICALS': 'NIFTY_CHEMICALS.NS',
  'NIFTY INDIA CHEMICALS': 'NIFTY_CHEMICALS.NS',
  'NIFTY EV': 'NIFTY_EV.NS',
  'NIFTY EV & NEW AGE AUTOMOTIVE': 'NIFTY_EV.NS'
};

export async function fetchNseAllIndices() {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const targetUrl = 'https://www.nseindia.com/api/allIndices';
  const url = isLocalhost ? '/nse-api/api/allIndices' : targetUrl;

  const tryFetch = async (fetchUrl) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;
    try {
      const res = await fetch(fetchUrl, {
        signal: controller?.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        cache: 'no-cache'
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (timeoutId) clearTimeout(timeoutId);
      return null;
    }
  };

  try {
    let data = await tryFetch(url).catch(() => null);
    if (!data || !Array.isArray(data.data)) {
      data = await tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`).catch(() => null);
    }
    if (!data || !Array.isArray(data.data)) return null;

    const nseMap = {};
    for (const item of data.data) {
      const sym1 = (item.indexSymbol || '').trim();
      const sym2 = (item.index || '').trim();
      const internalSym = NSE_SYMBOL_MAP[sym1] || NSE_SYMBOL_MAP[sym2];
      if (internalSym) {
        const adv = parseInt(item.advances, 10);
        const dec = parseInt(item.declines, 10);
        const unc = parseInt(item.unchanged, 10);

        nseMap[internalSym] = {
          name: sym2 || sym1,
          currentPrice: typeof item.last === 'number' ? item.last : parseFloat(item.last),
          dailyChange: typeof item.variation === 'number' ? item.variation : parseFloat(item.variation),
          dailyChangePct: typeof item.percentChange === 'number' ? item.percentChange : parseFloat(item.percentChange),
          previousClose: typeof item.previousClose === 'number' ? item.previousClose : parseFloat(item.previousClose),
          high52w: typeof item.yearHigh === 'number' ? item.yearHigh : parseFloat(item.yearHigh),
          low52w: typeof item.yearLow === 'number' ? item.yearLow : parseFloat(item.yearLow),
          advances: !isNaN(adv) ? adv : null,
          declines: !isNaN(dec) ? dec : null,
          unchanged: !isNaN(unc) ? unc : 0,
          pe: parseFloat(item.pe) || null,
          pb: parseFloat(item.pb) || null
        };
      }
    }
    return nseMap;
  } catch (e) {
    console.warn('[NSE allIndices] Fetch failed:', e.message);
    return null;
  }
}

export async function fetchMarketPulseData(country = "US", timeframe = "1y") {
  const groups = MARKET_GROUPS[country];
  if (!groups) return [];

  const allSymbols = groups.flatMap((g) => g.symbols);
  
  /**
   * PROXY_MAP: Deep history proxies for indices that Yahoo often truncates or lacks completely.
   * HDFCSML250.NS is the robust, split-adjusted proxy for Smallcap history.
   * MOM100.NS is the clean, split-adjusted proxy for Midcap history.
   * MONIFTY500.NS is the clean, split-adjusted proxy for Nifty 500 history.
   * HEALTHIETF.NS and OILIETF.NS serve as highly active direct proxies for sectoral indices.
   */
  const PROXY_MAP = {
    "^CNXSC": { symbol: "HDFCSML250.NS", ratio: 105, isSelfETF: false }, 
    "NIFTY_MIDCAP_100.NS": { symbol: "MOM100.NS", ratio: 925, isSelfETF: false },
    "^CRSLDX": { symbol: "MONIFTY500.NS", ratio: 980, isSelfETF: false },
    "HEALTHIETF.NS": { symbol: "HEALTHIETF.NS", ratio: 1, isSelfETF: true },
    "OILIETF.NS": { symbol: "OILIETF.NS", ratio: 1, isSelfETF: true },
    "NIFTY_CHEMICALS.NS": { symbol: "SRF.NS", ratio: 13.5, isSelfETF: false },
    "NIFTY_EV.NS": { symbol: "M&M.NS", ratio: 0.97, isSelfETF: false }
  };

  // Unique proxy symbols that are NOT already fetched in allSymbols (prevents duplicate API requests!)
  const proxySymbols = Array.from(new Set(
    Object.values(PROXY_MAP)
      .map(p => p.symbol)
      .filter(sym => !allSymbols.includes(sym))
  ));

  const [chartResults, maResults, proxyResults, proxyMaResults, nseAllIndicesMap] = await Promise.all([
    fetchStockData(allSymbols, country, timeframe),
    fetchStockData(allSymbols, country, "2y"),
    fetchStockData(proxySymbols, country, timeframe),
    fetchStockData(proxySymbols, country, "2y"),
    country === "IN" ? fetchNseAllIndices() : Promise.resolve(null)
  ]);

  const maDataMap = new Map();
  maResults.forEach(res => maDataMap.set(res.symbol, res));

  const proxyChartMap = new Map();
  proxyResults.forEach(res => proxyChartMap.set(res.symbol, res));

  const proxyMaMap = new Map();
  proxyMaResults.forEach(res => proxyMaMap.set(res.symbol, res));

  const benchmarkSym = country === "IN" ? "^NSEI" : "^GSPC";
  const benchmark = chartResults.find(r => r.symbol === benchmarkSym);
  const benchmarkChange = benchmark?.dailyChangePct || 0;

  const processed = chartResults.map((res) => {
    let finalRes = { ...res };
    
    // Enrich with direct official NSE API metrics if available (Prices, Adv/Dec, 52W Peaks, PE)
    if (nseAllIndicesMap && nseAllIndicesMap[finalRes.symbol]) {
      const nseData = nseAllIndicesMap[finalRes.symbol];
      if (nseData.currentPrice > 0) finalRes.currentPrice = nseData.currentPrice;
      if (typeof nseData.dailyChange === 'number') finalRes.dailyChange = nseData.dailyChange;
      if ((timeframe || '').toLowerCase() === '1d' && typeof nseData.dailyChangePct === 'number') {
        finalRes.dailyChangePct = nseData.dailyChangePct;
      }
      if (nseData.previousClose > 0) finalRes.previousClose = nseData.previousClose;
      if (nseData.high52w > 0) finalRes.high52w = nseData.high52w;
      if (nseData.low52w > 0) finalRes.low52w = nseData.low52w;
      finalRes.advances = nseData.advances;
      finalRes.declines = nseData.declines;
      finalRes.unchanged = nseData.unchanged;
      finalRes.pe = nseData.pe;
      finalRes.pb = nseData.pb;
    }

    // 1. DATA SOURCE SELECTION & PROXY SCALING
    let technicalSource = maDataMap.get(finalRes.symbol);
    let scaleFactor = 1;

    if (PROXY_MAP[finalRes.symbol]) {
      const proxyInfo = PROXY_MAP[finalRes.symbol];
      const proxySym = proxyInfo.symbol;
      const proxyMaData = proxyMaMap.get(proxySym) || maDataMap.get(proxySym);
      const proxyChartData = proxyChartMap.get(proxySym) || chartResults.find(r => r.symbol === proxySym);
      const isSelfETF = proxyInfo.isSelfETF;
      
      const hasValidPrice = finalRes.currentPrice && finalRes.currentPrice > 0;
      const indexPrice = isSelfETF 
        ? finalRes.currentPrice * proxyInfo.ratio 
        : (hasValidPrice ? finalRes.currentPrice : (proxyMaData?.currentPrice ? proxyMaData.currentPrice * proxyInfo.ratio : 0));
      const indexPrevClose = isSelfETF
        ? finalRes.prevClose * proxyInfo.ratio
        : ((hasValidPrice && finalRes.prevClose && finalRes.prevClose > 0) 
            ? finalRes.prevClose 
            : (proxyMaData?.prevClose ? proxyMaData.prevClose * proxyInfo.ratio : indexPrice));
      
      finalRes.currentPrice = indexPrice;
      finalRes.prevClose = indexPrevClose;
      finalRes.dailyChange = indexPrice - indexPrevClose;
      
      // Inherit percentage changes directly from the highly accurate proxy ETF if index values are missing or zero
      finalRes.dailyChangePct = isSelfETF ? finalRes.dailyChangePct : (hasValidPrice ? finalRes.dailyChangePct : (proxyMaData?.dailyChangePct || 0));
      finalRes.periodChangePct = isSelfETF ? finalRes.periodChangePct : (hasValidPrice ? finalRes.periodChangePct : (proxyChartData?.periodChangePct || 0));

      if (isSelfETF) {
        scaleFactor = proxyInfo.ratio;
        // Always scale self ETF's candlesticks
        if (finalRes.candlesticks) {
          finalRes.candlesticks = finalRes.candlesticks.map(c => ({
            ...c, 
            open: c.open * scaleFactor, 
            high: c.high * scaleFactor,
            low: c.low * scaleFactor, 
            close: c.close * scaleFactor
          }));
        }
      } else {
        // Use proxy if it provides a deeper history (essential for SMA 200)
        if (proxyMaData && (proxyMaData.candlesticks?.length > (technicalSource?.candlesticks?.length || 0))) {
          technicalSource = proxyMaData;
          scaleFactor = indexPrice / proxyMaData.currentPrice;
          
          // Graft candles for historical views or if index data is truncated
          if (!finalRes.candlesticks || finalRes.candlesticks.length < 5 || (timeframe || '').toLowerCase() !== '1d') {
            finalRes.candlesticks = proxyChartData?.candlesticks.map(c => ({
              ...c, 
              open: c.open * scaleFactor, 
              high: c.high * scaleFactor,
              low: c.low * scaleFactor, 
              close: c.close * scaleFactor
            })) || finalRes.candlesticks;
          }
        }
      }
    }

    // Filter 1D intraday candles to the latest trading session only so 1D charts are clean & un-squished
    if ((timeframe || '').toLowerCase() === '1d' && Array.isArray(finalRes.candlesticks) && finalRes.candlesticks.length > 0) {
      const lastBarDateStr = new Date(finalRes.candlesticks[finalRes.candlesticks.length - 1].time * 1000).toDateString();
      const latestSessionCandles = finalRes.candlesticks.filter(c => new Date(c.time * 1000).toDateString() === lastBarDateStr);
      if (latestSessionCandles.length > 0) {
        finalRes.candlesticks = latestSessionCandles;
      }
    }

    const maCandles = technicalSource?.candlesticks || finalRes.candlesticks || [];
    let techPrice = technicalSource?.currentPrice;
    if (!techPrice && maCandles.length > 0) {
      techPrice = maCandles[maCandles.length - 1].close;
    }
    if (finalRes.currentPrice > 0 && techPrice > 0 && Math.abs(finalRes.currentPrice - techPrice) / techPrice > 0.05) {
      scaleFactor = finalRes.currentPrice / techPrice;
    }

    // 2. CALCULATE SMAs & RSI
    finalRes.sma5 = calculateSMA(maCandles, 5) ? calculateSMA(maCandles, 5) * scaleFactor : null;
    finalRes.sma10 = calculateSMA(maCandles, 10) ? calculateSMA(maCandles, 10) * scaleFactor : null;
    finalRes.sma21 = calculateSMA(maCandles, 21) ? calculateSMA(maCandles, 21) * scaleFactor : null;
    finalRes.sma50 = calculateSMA(maCandles, 50) ? calculateSMA(maCandles, 50) * scaleFactor : null;
    finalRes.sma200 = calculateSMA(maCandles, 200) ? calculateSMA(maCandles, 200) * scaleFactor : null;
    finalRes.rsi = calculateRSI(maCandles, 14);

    // 3. 52-WEEK HIGH / LOW (Calculate from 1-year candle history to bypass broken/split Yahoo metadata)
    let h52 = null;
    let l52 = null;

    const candlesFor52w = technicalSource?.candlesticks || finalRes.candlesticks || [];
    if (candlesFor52w.length > 0) {
      const latestTime = candlesFor52w[candlesFor52w.length - 1].time;
      const oneYearAgo = latestTime - 365 * 24 * 60 * 60;
      const oneYearCandles = candlesFor52w.filter(c => c.time >= oneYearAgo);
      if (oneYearCandles.length > 0) {
        h52 = Math.max(...oneYearCandles.map(c => c.high)) * scaleFactor;
        l52 = Math.min(...oneYearCandles.map(c => c.low)) * scaleFactor;
      }
    }

    // Fallback to metadata if candle calculations are unavailable
    if (h52 === null || l52 === null) {
      if (technicalSource?.high52w) {
        h52 = technicalSource.high52w * scaleFactor;
        l52 = technicalSource.low52w * scaleFactor;
      } else {
        h52 = finalRes.high52w;
        l52 = finalRes.low52w;
      }
    }

    finalRes.high52w = h52;
    finalRes.low52w = l52;
    
    if (h52 > 0) {
      finalRes.dist52wH = ((finalRes.currentPrice - h52) / h52) * 100;
    } else {
      finalRes.dist52wH = 0;
    }

    finalRes.rsRating = finalRes.dailyChangePct - benchmarkChange;
    const smas = { sma21: finalRes.sma21, sma50: finalRes.sma50, sma200: finalRes.sma200 };
    const { score, phase, color } = getInstitutionalTrend(finalRes.currentPrice, smas);
    finalRes.marketPhase = phase;
    finalRes.marketPhaseColor = color;
    finalRes.healthScore = score;

    // Friendly names for Indian indices & sectors
    const NAME_MAP_IN = {
      "^NSEI": "Nifty 50",
      "NIFTY_MIDCAP_100.NS": "Nifty Midcap 100",
      "^CNXSC": "Nifty Smallcap 100",
      "^CRSLDX": "Nifty 500",
      "^NSEBANK": "Nifty Bank",
      "^CNXIT": "Nifty IT",
      "^CNXMETAL": "Nifty Metal",
      "^CNXPHARMA": "Nifty Pharma",
      "^CNXAUTO": "Nifty Auto",
      "^CNXFMCG": "Nifty FMCG",
      "^CNXREALTY": "Nifty Realty",
      "^CNXENERGY": "Nifty Energy",
      "^CNXINFRA": "Nifty Infra",
      "^CNXMEDIA": "Nifty Media",
      "^CNXPSUBANK": "Nifty PSU Bank",
      "NIFTY_PVT_BANK.NS": "Nifty Pvt Bank",
      "NIFTY_FIN_SERVICE.NS": "Nifty Fin Services",
      "^CNXCONSUM": "Nifty Consumption",
      "^CNXPSE": "Nifty PSE",
      "^CNXSERVICE": "Nifty Services",
      "^CNXCMDT": "Nifty Commodities",
      "^CNXMNC": "Nifty MNC",
      "HEALTHIETF.NS": "Nifty Healthcare",
      "OILIETF.NS": "Nifty Oil & Gas",
      "DEFENCE.NS": "Nifty Defence",
      "CPSEETF.NS": "Nifty CPSE",
      "NIFTY_CHEMICALS.NS": "Nifty Chemicals",
      "NIFTY_EV.NS": "Nifty EV & New Age"
    };

    if (NAME_MAP_IN[finalRes.symbol]) {
      finalRes.longName = NAME_MAP_IN[finalRes.symbol];
    } else if (!finalRes.longName && finalRes.name) {
      finalRes.longName = finalRes.name;
    }

    // Friendly names for US Sector ETFs
    if (finalRes.symbol === "XLK") finalRes.longName = "Technology";
    if (finalRes.symbol === "XLF") finalRes.longName = "Financials";
    if (finalRes.symbol === "XLV") finalRes.longName = "Health Care";
    if (finalRes.symbol === "XLE") finalRes.longName = "Energy";
    if (finalRes.symbol === "XLI") finalRes.longName = "Industrials";
    if (finalRes.symbol === "XLB") finalRes.longName = "Materials";
    if (finalRes.symbol === "XLU") finalRes.longName = "Utilities";
    if (finalRes.symbol === "XLY") finalRes.longName = "Consumer Discretionary";
    if (finalRes.symbol === "XLP") finalRes.longName = "Consumer Staples";

    // Friendly names for US Major Indices
    if (finalRes.symbol === "^GSPC") finalRes.longName = "S&P 500";
    if (finalRes.symbol === "^IXIC") finalRes.longName = "Nasdaq";
    if (finalRes.symbol === "^DJI") finalRes.longName = "Dow 30";
    if (finalRes.symbol === "^RUT") finalRes.longName = "Russell 2000";

    return {
      ...finalRes,
      healthScore: score,
      status: { text: phase, color },
      trendPhase: phase,
      isAdvancing: finalRes.dailyChangePct >= 0
    };
  });

  return groups.map((group) => ({
    category: group.category,
    indices: group.symbols
      .map((s) => processed.find((p) => p.symbol === s))
      .filter(Boolean),
  }));
}

export function generateTechnicalThesis(categorizedData) {
  if (!categorizedData || categorizedData.length === 0) return "Awaiting market data...";
  const allIndices = categorizedData.flatMap((g) => g.indices);
  const mainIndex = allIndices[0];
  let regime = mainIndex?.trendPhase?.toUpperCase() || "STRUCTURAL TRANSITION";
  const above200 = (allIndices.filter(idx => idx.currentPrice > idx.sma200).length / allIndices.length) * 100;
  return `Market Regime: ${regime}. Breadth: ${above200.toFixed(0)}% above 200SMA. Breakthroughs near highs observed in ${allIndices.filter(idx => idx.dist52wH > -2).length} key indices.`;
}
