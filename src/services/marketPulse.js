import { fetchStockData } from "../utils/yahooFinanceMap";

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
function getInstitutionalTrend(price, smas) {
  const { sma21, sma50, sma200 } = smas;
  if (!sma21 || !sma50 || !sma200) return { score: 0, phase: "Insufficent Data", color: "var(--muted)" };

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
        "HEALTHIETF.NS", "OILIETF.NS"
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
    "HEALTHIETF.NS": { symbol: "HEALTHIETF.NS", ratio: 1000, isSelfETF: true },
    "OILIETF.NS": { symbol: "OILIETF.NS", ratio: 1000, isSelfETF: true }
  };

  // Unique proxy symbols that are NOT already fetched in allSymbols (prevents duplicate API requests!)
  const proxySymbols = Array.from(new Set(
    Object.values(PROXY_MAP)
      .map(p => p.symbol)
      .filter(sym => !allSymbols.includes(sym))
  ));

  const [chartResults, maResults, proxyResults, proxyMaResults] = await Promise.all([
    fetchStockData(allSymbols, country, timeframe),
    fetchStockData(allSymbols, country, "2y"),
    fetchStockData(proxySymbols, country, timeframe),
    fetchStockData(proxySymbols, country, "2y")
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
          if (!finalRes.candlesticks || finalRes.candlesticks.length < 5 || timeframe !== "1D") {
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

    const maCandles = technicalSource?.candlesticks || finalRes.candlesticks || [];

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

    // Friendly names for major indices
    if (finalRes.symbol === "^CNXSC") finalRes.longName = "Nifty Smallcap 100";
    if (finalRes.symbol === "NIFTY_MIDCAP_100.NS") finalRes.longName = "Nifty Midcap 100";
    if (finalRes.symbol === "^CRSLDX") finalRes.longName = "Nifty 500";
    if (finalRes.symbol === "HEALTHIETF.NS") finalRes.longName = "Nifty Healthcare";
    if (finalRes.symbol === "OILIETF.NS") finalRes.longName = "Nifty Oil & Gas";

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
