
import { fetchStockData } from "../utils/yahooFinanceMap.js";

export const PROXY_MAP = {
  "^CNXSC": { symbol: "HDFCSML250.NS", ratio: 105, isSelfETF: false }, 
  "NIFTY_MIDCAP_100.NS": { symbol: "MOM100.NS", ratio: 925, isSelfETF: false },
  "^CRSLDX": { symbol: "MONIFTY500.NS", ratio: 980, isSelfETF: false },
  "HEALTHIETF.NS": { symbol: "HEALTHIETF.NS", ratio: 1, isSelfETF: true },
  "OILIETF.NS": { symbol: "OILIETF.NS", ratio: 1, isSelfETF: true },
  "NIFTY_CHEMICALS.NS": { symbol: "SRF.NS", ratio: 13.5, isSelfETF: false },
  "NIFTY_EV.NS": { symbol: "M&M.NS", ratio: 0.97, isSelfETF: false }
};

export const INDEX_NAME_MAP = {
  "^NSEI": { name: "Nifty 50", badge: "NIFTY 50 • NSE INDIA" },
  "NIFTY_MIDCAP_100.NS": { name: "Nifty Midcap 100", badge: "NIFTY MIDCAP 100 • NSE INDIA" },
  "^CNXSC": { name: "Nifty Smallcap 100", badge: "NIFTY SMALLCAP 100 • NSE INDIA" },
  "^CRSLDX": { name: "Nifty 500", badge: "NIFTY 500 • NSE INDIA" },
  "^NSEBANK": { name: "Nifty Bank", badge: "NIFTY BANK • NSE INDIA" },
  "^CNXIT": { name: "Nifty IT", badge: "NIFTY IT • NSE INDIA" },
  "^CNXMETAL": { name: "Nifty Metal", badge: "NIFTY METAL • NSE INDIA" },
  "^CNXPHARMA": { name: "Nifty Pharma", badge: "NIFTY PHARMA • NSE INDIA" },
  "^CNXAUTO": { name: "Nifty Auto", badge: "NIFTY AUTO • NSE INDIA" },
  "^CNXFMCG": { name: "Nifty FMCG", badge: "NIFTY FMCG • NSE INDIA" },
  "^CNXREALTY": { name: "Nifty Realty", badge: "NIFTY REALTY • NSE INDIA" },
  "^CNXENERGY": { name: "Nifty Energy", badge: "NIFTY ENERGY • NSE INDIA" },
  "^CNXINFRA": { name: "Nifty Infra", badge: "NIFTY INFRA • NSE INDIA" },
  "^CNXMEDIA": { name: "Nifty Media", badge: "NIFTY MEDIA • NSE INDIA" },
  "^CNXPSUBANK": { name: "Nifty PSU Bank", badge: "NIFTY PSU BANK • NSE INDIA" },
  "NIFTY_PVT_BANK.NS": { name: "Nifty Pvt Bank", badge: "NIFTY PVT BANK • NSE INDIA" },
  "NIFTY_FIN_SERVICE.NS": { name: "Nifty Fin Services", badge: "NIFTY FIN SERVICES • NSE INDIA" },
  "^CNXCONSUM": { name: "Nifty Consumption", badge: "NIFTY CONSUMPTION • NSE INDIA" },
  "^CNXPSE": { name: "Nifty PSE", badge: "NIFTY PSE • NSE INDIA" },
  "^CNXSERVICE": { name: "Nifty Services", badge: "NIFTY SERVICES • NSE INDIA" },
  "^CNXCMDT": { name: "Nifty Commodities", badge: "NIFTY COMMODITIES • NSE INDIA" },
  "^CNXMNC": { name: "Nifty MNC", badge: "NIFTY MNC • NSE INDIA" },
  "HEALTHIETF.NS": { name: "Nifty Healthcare", badge: "NIFTY HEALTHCARE • NSE INDIA" },
  "OILIETF.NS": { name: "Nifty Oil & Gas", badge: "NIFTY OIL & GAS • NSE INDIA" },
  "DEFENCE.NS": { name: "Nifty Defence", badge: "NIFTY DEFENCE • NSE INDIA" },
  "CPSEETF.NS": { name: "Nifty CPSE", badge: "NIFTY CPSE • NSE INDIA" },
  "NIFTY_CHEMICALS.NS": { name: "Nifty Chemicals", badge: "NIFTY CHEMICALS • NSE INDIA" },
  "NIFTY_EV.NS": { name: "Nifty EV & Auto", badge: "NIFTY EV & AUTO • NSE INDIA" },
  "^GSPC": { name: "S&P 500", badge: "S&P 500 • US BENCHMARK" },
  "^IXIC": { name: "Nasdaq Composite", badge: "NASDAQ • US TECH INDEX" },
  "^DJI": { name: "Dow Jones 30", badge: "DOW JONES 30 • US BLUECHIP" },
  "^RUT": { name: "Russell 2000", badge: "RUSSELL 2000 • US SMALLCAP" },
  "XLK": { name: "Technology ETF", badge: "TECH SECTOR • SPDR XLK" },
  "XLF": { name: "Financials ETF", badge: "FINANCIALS • SPDR XLF" },
  "XLV": { name: "Health Care ETF", badge: "HEALTH CARE • SPDR XLV" },
  "XLE": { name: "Energy ETF", badge: "ENERGY • SPDR XLE" },
  "XLI": { name: "Industrials ETF", badge: "INDUSTRIALS • SPDR XLI" },
  "XLB": { name: "Materials ETF", badge: "MATERIALS • SPDR XLB" },
  "XLU": { name: "Utilities ETF", badge: "UTILITIES • SPDR XLU" },
  "XLY": { name: "Consumer Discretionary", badge: "DISCRETIONARY • SPDR XLY" },
  "XLP": { name: "Consumer Staples", badge: "STAPLES • SPDR XLP" }
};


export function filterToLatestActiveSession(candlesticks, referenceDate = null) {
  if (!Array.isArray(candlesticks) || candlesticks.length === 0) return candlesticks || [];
  
  const dateGroups = new Map();
  candlesticks.forEach(c => {
    const dStr = new Date(c.time * 1000).toDateString();
    if (!dateGroups.has(dStr)) dateGroups.set(dStr, []);
    dateGroups.get(dStr).push(c);
  });
  
  const dates = Array.from(dateGroups.keys());
  if (dates.length === 0) return candlesticks;

  const latestDateStr = dates[dates.length - 1];
  const latestGroup = dateGroups.get(latestDateStr) || [];
  const latestDate = new Date(latestGroup[0]?.time * 1000);
  const dayOfWeek = latestDate.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const refDateStr = referenceDate ? new Date(referenceDate).toDateString() : new Date().toDateString();
  const isToday = latestDateStr === refDateStr;

  // Discard weekend dummy ticks, or past holiday dummy bars with < 5 candles.
  // Never discard today's active weekday session even if only 1-4 candles have formed so far.
  if (isWeekend || (!isToday && latestGroup.length < 5)) {
    for (let i = dates.length - 1; i >= 0; i--) {
      const group = dateGroups.get(dates[i]);
      if (group && group.length >= 5) {
        return group;
      }
    }
  }

  return latestGroup.length > 0 ? latestGroup : candlesticks;
}

export async function fetchSingleIndexDetails(symbol, country = 'IN', timeframe = '2y', baseIndexData = null, customInterval = null) {
  if (!symbol) return null;

  const proxyInfo = PROXY_MAP[symbol];
  const symbolsToFetch = [symbol];
  if (proxyInfo && proxyInfo.symbol && !symbolsToFetch.includes(proxyInfo.symbol)) {
    symbolsToFetch.push(proxyInfo.symbol);
  }

  const [chartResults, maResults] = await Promise.all([
    fetchStockData(symbolsToFetch, country, timeframe, customInterval),
    fetchStockData(symbolsToFetch, country, '2y', '1d')
  ]);

  const rawIndexChart = chartResults.find(r => r.symbol === symbol) || chartResults[0];
  const rawIndexMa = maResults.find(r => r.symbol === symbol) || maResults[0];
  const proxyChart = proxyInfo ? chartResults.find(r => r.symbol === proxyInfo.symbol) : null;
  const proxyMa = proxyInfo ? maResults.find(r => r.symbol === proxyInfo.symbol) : null;

  let finalRes = { ...(baseIndexData || {}), ...(rawIndexChart || {}) };
  let technicalSource = rawIndexMa || rawIndexChart;
  let scaleFactor = 1;

  if (proxyInfo) {
    const isSelfETF = proxyInfo.isSelfETF;
    const hasValidPrice = finalRes.currentPrice && finalRes.currentPrice > 0;
    const proxyPrice = proxyMa?.currentPrice || proxyChart?.currentPrice || 0;
    const indexPrice = isSelfETF 
      ? finalRes.currentPrice * proxyInfo.ratio 
      : (hasValidPrice ? finalRes.currentPrice : (proxyPrice ? proxyPrice * proxyInfo.ratio : 0));
    
    finalRes.currentPrice = indexPrice || finalRes.currentPrice;

    if (isSelfETF) {
      scaleFactor = proxyInfo.ratio;
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
      if (proxyChart && proxyChart.candlesticks && proxyChart.candlesticks.length > 0) {
        technicalSource = proxyMa || proxyChart;
        scaleFactor = (proxyPrice > 0 && indexPrice > 0) ? (indexPrice / proxyPrice) : proxyInfo.ratio;
        finalRes.candlesticks = proxyChart.candlesticks.map(c => ({
          ...c,
          open: Number((c.open * scaleFactor).toFixed(2)),
          high: Number((c.high * scaleFactor).toFixed(2)),
          low: Number((c.low * scaleFactor).toFixed(2)),
          close: Number((c.close * scaleFactor).toFixed(2))
        }));
      }
    }
  }

  // Filter 1D intraday candles to the latest active trading session so 1D charts are clean and full
  if (((timeframe || '').toLowerCase() === '1d' || customInterval === '15m') && Array.isArray(finalRes.candlesticks) && finalRes.candlesticks.length > 0) {
    finalRes.candlesticks = filterToLatestActiveSession(finalRes.candlesticks);
  }

  const maCandles = technicalSource?.candlesticks || finalRes.candlesticks || [];
  let techPrice = technicalSource?.currentPrice;
  if (!techPrice && maCandles.length > 0) {
    techPrice = maCandles[maCandles.length - 1].close;
  }
  if (finalRes.currentPrice > 0 && techPrice > 0 && Math.abs(finalRes.currentPrice - techPrice) / techPrice > 0.05) {
    scaleFactor = finalRes.currentPrice / techPrice;
  }

  finalRes.sma5 = calculateSMA(maCandles, 5) ? Number((calculateSMA(maCandles, 5) * scaleFactor).toFixed(2)) : (baseIndexData?.sma5 || null);
  finalRes.sma10 = calculateSMA(maCandles, 10) ? Number((calculateSMA(maCandles, 10) * scaleFactor).toFixed(2)) : (baseIndexData?.sma10 || null);
  finalRes.sma21 = calculateSMA(maCandles, 21) ? Number((calculateSMA(maCandles, 21) * scaleFactor).toFixed(2)) : (baseIndexData?.sma21 || null);
  finalRes.sma50 = calculateSMA(maCandles, 50) ? Number((calculateSMA(maCandles, 50) * scaleFactor).toFixed(2)) : (baseIndexData?.sma50 || null);
  finalRes.sma200 = calculateSMA(maCandles, 200) ? Number((calculateSMA(maCandles, 200) * scaleFactor).toFixed(2)) : (baseIndexData?.sma200 || null);
  finalRes.rsi = calculateRSI(maCandles, 14) || baseIndexData?.rsi || null;
  finalRes.distributionDays = calculateDistributionDays(maCandles, 25);
  finalRes.geometry = analyzePriceActionGeometry(maCandles, 15, finalRes.currentPrice, finalRes.high52w);

  if (INDEX_NAME_MAP[symbol]) {
    finalRes.longName = INDEX_NAME_MAP[symbol].name;
  }

  return finalRes;
}

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
 * Calculates William O'Neil / IBD Distribution Days in the trailing lookback window (default 25 sessions)
 * A distribution day occurs when the index closes down >= 0.20% on volume higher than the prior day.
 * Days are invalidated if price advances 5% or more above that day's close.
 */
export function calculateDistributionDays(candlesticks, lookback = 25) {
  if (!Array.isArray(candlesticks) || candlesticks.length < 2) {
    return { count: 0, lookback, status: "Low Risk", label: "Low", color: "#10b981", days: [], hasVolumeData: false };
  }

  // Work with trailing candles (with buffer)
  const windowCandles = candlesticks.slice(-(lookback + 10));
  const distDays = [];
  let volumeFound = false;

  for (let i = 1; i < windowCandles.length; i++) {
    const curr = windowCandles[i];
    const prev = windowCandles[i - 1];

    if (!curr || !prev || curr.close == null || prev.close == null || prev.close <= 0) continue;

    const dropPct = ((curr.close - prev.close) / prev.close) * 100;
    const hasVolume = curr.volume != null && prev.volume != null && curr.volume > 0 && prev.volume > 0;
    if (hasVolume) volumeFound = true;

    // Standard IBD rule: drop >= 0.2% on higher volume
    const isVolumeDistribution = dropPct <= -0.2 && hasVolume && curr.volume > prev.volume;

    // Churning / Stagnation rule: flat change on heavier volume with close in lower half
    const range = (curr.high || curr.close) - (curr.low || curr.close);
    const closeLocation = range > 0 ? (curr.close - (curr.low || curr.close)) / range : 0.5;
    const isChurning = hasVolume && Math.abs(dropPct) < 0.2 && closeLocation < 0.4 && curr.volume > prev.volume;

    if (isVolumeDistribution || isChurning) {
      distDays.push({
        time: curr.time,
        dropPct: Number(dropPct.toFixed(2)),
        volume: curr.volume,
        isChurning: !isVolumeDistribution && isChurning,
        index: i
      });
    }
  }

  const activeWindowStart = Math.max(0, windowCandles.length - lookback);
  const latestPrice = windowCandles[windowCandles.length - 1].close;

  // Invalidate any distribution day if the market rallied >= 5% above its close
  const validDays = distDays.filter(d => {
    if (d.index < activeWindowStart) return false;
    const distCandle = windowCandles[d.index];
    if (distCandle && latestPrice >= distCandle.close * 1.05) {
      return false;
    }
    return true;
  });

  const count = validDays.length;
  let status = "Low (Confirmed Uptrend)";
  let label = "Low";
  let color = "#10b981";

  if (count >= 5) {
    status = "Elevated (Market in Correction)";
    label = "High";
    color = "#ef4444";
  } else if (count >= 3) {
    status = "Moderate (Uptrend Under Pressure)";
    label = "Elevated";
    color = "#f59e0b";
  }

  return {
    count,
    lookback,
    status,
    label,
    color,
    days: validDays,
    hasVolumeData: volumeFound
  };
}

/**
 * Evaluates forensic price action geometry, candle rejection patterns, swing pivots, and structure
 */
export function analyzePriceActionGeometry(candlesticks, lookback = 15, currentPrice = null, high52w = null) {
  if (!Array.isArray(candlesticks) || candlesticks.length === 0) {
    return {
      structureLabel: "Consolidating Base",
      lastCandleDesc: "Awaiting candle data",
      pivots: { s1: 0, s2: 0, r1: 0, r2: 0 },
      recentCandlesSummary: "No candlestick history available."
    };
  }

  const windowCandles = candlesticks.slice(-lookback);
  const latest = windowCandles[windowCandles.length - 1];
  const price = currentPrice || latest.close;

  // 1. Analyze latest candle pattern / rejection
  const prev = windowCandles.length >= 2 ? windowCandles[windowCandles.length - 2] : null;
  const candleRange = Math.max(0.0001, (latest.high || latest.close) - (latest.low || latest.close));
  const candleBody = Math.abs(latest.close - latest.open);
  const lowerWick = Math.min(latest.open, latest.close) - (latest.low || latest.close);
  const upperWick = (latest.high || latest.close) - Math.max(latest.open, latest.close);
  const bodyPct = candleBody / candleRange;

  let lastCandleDesc = "Neutral consolidation session";
  if (lowerWick >= 1.8 * candleBody && lowerWick / candleRange > 0.45) {
    lastCandleDesc = "Bullish Hammer (Dip rejection / lower shadow support)";
  } else if (upperWick >= 1.8 * candleBody && upperWick / candleRange > 0.45) {
    lastCandleDesc = "Exhaustion wick (Upper shadow supply rejection)";
  } else if (prev && latest.high < prev.high && latest.low > prev.low) {
    lastCandleDesc = "Inside day (Volatility compression / tight digestion)";
  } else if (prev && latest.close > prev.high && latest.open < prev.low) {
    lastCandleDesc = "Bullish Outside Reversal (Engulfing demand surge)";
  } else if (latest.close > latest.open && bodyPct > 0.65) {
    lastCandleDesc = "Strong bullish expansion bar (Demand dominance)";
  } else if (latest.close < latest.open && bodyPct > 0.65) {
    lastCandleDesc = "Bearish distribution bar (Selling pressure dominance)";
  }

  // 2. Identify Swing Pivots across the window
  const highs = windowCandles.map(c => c.high || c.close).filter(Boolean);
  const lows = windowCandles.map(c => c.low || c.close).filter(Boolean);
  const windowHigh = highs.length > 0 ? Math.max(...highs) : price * 1.02;
  const windowLow = lows.length > 0 ? Math.min(...lows) : price * 0.98;

  // Local swing low (support) below current price
  const lowsBelowPrice = lows.filter(l => l < price * 0.999);
  const s1 = lowsBelowPrice.length > 0 ? Math.max(...lowsBelowPrice) : windowLow;
  const s2 = windowLow < s1 ? windowLow : s1 * 0.97;

  // Local swing high (resistance) above current price
  const highsAbovePrice = highs.filter(h => h > price * 1.001);
  const r1 = highsAbovePrice.length > 0 ? Math.min(...highsAbovePrice) : (high52w && high52w > price ? high52w : windowHigh);
  const r2 = high52w && high52w > r1 ? high52w : r1 * 1.02;

  // 3. Classify Swing Structure (HH/HL vs LH/LL)
  let structureLabel = "Consolidating Range (Contracting Volatility)";
  if (windowCandles.length >= 6) {
    const mid = Math.floor(windowCandles.length / 2);
    const firstHalfLows = windowCandles.slice(0, mid).map(c => c.low || c.close);
    const secondHalfLows = windowCandles.slice(mid).map(c => c.low || c.close);
    const firstHalfHighs = windowCandles.slice(0, mid).map(c => c.high || c.close);
    const secondHalfHighs = windowCandles.slice(mid).map(c => c.high || c.close);

    const minL1 = Math.min(...firstHalfLows);
    const minL2 = Math.min(...secondHalfLows);
    const maxH1 = Math.max(...firstHalfHighs);
    const maxH2 = Math.max(...secondHalfHighs);

    if (minL2 > minL1 && maxH2 > maxH1) {
      structureLabel = "Higher Highs & Higher Lows (HH/HL - Bullish Expansion)";
    } else if (minL2 < minL1 && maxH2 < maxH1) {
      structureLabel = "Lower Highs & Lower Lows (LH/LL - Bearish Degradation)";
    } else if (minL2 > minL1 && maxH2 <= maxH1) {
      structureLabel = "Ascending Base (Higher Lows testing overhead supply)";
    }
  }

  // 4. Compact 15-day OHLCV string for AI prompt
  const hasVolumes = windowCandles.some(c => c.volume && c.volume > 0);
  const avgVol = hasVolumes ? (windowCandles.reduce((a, c) => a + (c.volume || 0), 0) / windowCandles.length) : 0;
  const candleLines = windowCandles.map((c, i) => {
    const dPct = i > 0 && windowCandles[i-1].close ? (((c.close - windowCandles[i-1].close) / windowCandles[i-1].close) * 100).toFixed(2) : "0.00";
    const sign = Number(dPct) >= 0 ? "+" : "";
    const volStr = avgVol > 0 && c.volume ? ` | Vol: ${(c.volume / avgVol).toFixed(1)}x avg` : "";
    const dateStr = c.time ? (typeof c.time === 'number' ? new Date(c.time * 1000).toISOString().split('T')[0] : String(c.time).split('T')[0]) : `Bar-${i+1}`;
    return `${dateStr}: O:${Number(c.open || c.close).toFixed(1)} H:${Number(c.high || c.close).toFixed(1)} L:${Number(c.low || c.close).toFixed(1)} C:${Number(c.close).toFixed(1)} (${sign}${dPct}%)${volStr}`;
  });

  return {
    structureLabel,
    lastCandleDesc,
    pivots: {
      s1: Number(s1.toFixed(2)),
      s2: Number(s2.toFixed(2)),
      r1: Number(r1.toFixed(2)),
      r2: Number(r2.toFixed(2))
    },
    recentCandlesSummary: candleLines.join('\n')
  };
}

/**
 * Calculates a comprehensive Health Score (0-100), Stan Weinstein Stage, and Trend Phase
 */
export function getInstitutionalTrend(price, smas = {}, distributionCount = 0) {
  const { sma21, sma50, sma200 } = smas;
  
  if (!price || (!sma21 && !sma50)) {
    return { score: 0, phase: "Insufficient Data", color: "var(--muted)", stage: "Insufficient Data", distributionStatus: "N/A" };
  }

  // Classify Stan Weinstein Market Stage
  let stage = "Stage 2 Markup";
  if (sma50 && sma200) {
    if (price > sma50 && sma50 > sma200) {
      stage = "Stage 2 (Markup / Institutional Demand)";
    } else if (price < sma50 && sma50 < sma200) {
      stage = "Stage 4 (Capitulation / Downtrend)";
    } else if (Math.abs(price - sma200) / sma200 < 0.04) {
      stage = price >= sma50 ? "Stage 1 (Base Accumulation)" : "Stage 3 (Top Distribution)";
    } else if (price < sma50 && price > sma200) {
      stage = "Stage 3 (Distribution / Pullback to 200MA)";
    } else {
      stage = "Stage 1 (Base Accumulation / Recovery)";
    }
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
      if (distributionCount >= 5) {
        phase = "Uptrend Under Heavy Pressure";
        color = "#ef4444";
      } else if (distributionCount >= 3) {
        phase = "Bullish Extension (Elevated Distribution)";
        color = "#f59e0b";
      } else {
        phase = extension > 8 ? "Bullish Extension" : "Structural Bull";
        color = "#10b981";
      }
    } else if (score >= 70) {
      if (distributionCount >= 4) {
        phase = "Uptrend Under Pressure";
        color = "#f59e0b";
      } else {
        phase = "Bullish Trend";
        color = "#10b981";
      }
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

    return { score, phase, color, stage, distributionCount };
  }

  // Fallback for emerging sector indices with fewer than 200 candles (evaluate via 21MA & 50MA)
  let score = 50;
  let phase = "Emerging Bull";
  let color = "#10b981";

  if (sma21 && sma50) {
    if (price > sma21 && sma21 > sma50) {
      score = 85;
      phase = distributionCount >= 4 ? "Uptrend Under Pressure" : "Bullish Trend";
      color = distributionCount >= 4 ? "#f59e0b" : "#10b981";
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

  return { score, phase, color, stage, distributionCount };
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
  
  // Use exported top-level PROXY_MAP

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

    // Filter 1D intraday candles to the latest active trading session so 1D charts are clean and full
    if ((timeframe || '').toLowerCase() === '1d' && Array.isArray(finalRes.candlesticks) && finalRes.candlesticks.length > 0) {
      finalRes.candlesticks = filterToLatestActiveSession(finalRes.candlesticks);
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
    const distData = calculateDistributionDays(finalRes.candlesticks || [], 25);
    finalRes.distributionDays = distData;
    finalRes.geometry = analyzePriceActionGeometry(finalRes.candlesticks || [], 15, finalRes.currentPrice, finalRes.high52w);
    const { score, phase, color, stage } = getInstitutionalTrend(finalRes.currentPrice, smas, distData.count);
    finalRes.marketPhase = phase;
    finalRes.marketPhaseColor = color;
    finalRes.healthScore = score;
    finalRes.stage = stage;

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
