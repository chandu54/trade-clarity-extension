/**
 * Stock Pattern Utility: Detect IPO Base (U-Turn / Initial High Recovery)
 * Evaluates daily historical OHLC data to identify IPO Cup / U-turn base setups.
 *
 * An IPO Base occurs when:
 * 1. The stock is young (10 to 65 trading days).
 * 2. An initial rally/listing surge establishes an Initial High / Pivot (within first ~25 days).
 * 3. Profit-taking creates a constructive pullback (Base Low) of 8% to 38% depth.
 * 4. Institutional accumulation steadily recovers price back toward that Initial High (within 6% or breaking out).
 */

export type IPOBaseStatus = 'NOT_IPO' | 'FORMING' | 'AT_PIVOT' | 'BREAKOUT';

export interface IPOBaseResult {
  symbol: string;
  isIPOBase: boolean;
  status: IPOBaseStatus;
  totalTradingDays: number;
  peakPrice: number | null;
  baseLow: number | null;
  currentClose: number | null;
  depthPct: number | null;
  distanceToPivotPct: number | null;
  recoveryRatio: number | null;
  description: string;
}

export interface OHLCItem {
  date?: Date | string;
  open?: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp?: number;
}

/**
 * Evaluates historical daily OHLC candles to detect an IPO Base pattern.
 *
 * @param symbol Stock ticker symbol
 * @param ohlcData Array of daily OHLC candles in chronological order
 * @returns IPOBaseResult
 */
export function evaluateIPOBase(
  symbol: string,
  ohlcData?: Array<OHLCItem>
): IPOBaseResult {
  const notIpoResult: IPOBaseResult = {
    symbol,
    isIPOBase: false,
    status: 'NOT_IPO',
    totalTradingDays: 0,
    peakPrice: null,
    baseLow: null,
    currentClose: null,
    depthPct: null,
    distanceToPivotPct: null,
    recoveryRatio: null,
    description: 'Insufficient or ineligible trading history for IPO Base.',
  };

  if (!ohlcData || !Array.isArray(ohlcData) || ohlcData.length === 0) {
    return notIpoResult;
  }

  const validCandles = ohlcData.filter(
    (b) => b && typeof b.close === 'number' && b.close > 0 && typeof b.high === 'number' && typeof b.low === 'number'
  );

  const totalTradingDays = validCandles.length;
  notIpoResult.totalTradingDays = totalTradingDays;

  // Rule 1: Age Window (Must be between 10 and 65 trading days)
  if (totalTradingDays < 10 || totalTradingDays > 65) {
    notIpoResult.description = totalTradingDays < 10
      ? `Too young (${totalTradingDays} days). In early price discovery.`
      : `Established history (${totalTradingDays} days > 65 days).`;
    return notIpoResult;
  }

  const currentClose = validCandles[totalTradingDays - 1].close;

  // Rule 2: Identify Initial Peak / Pivot
  // The initial high must have occurred with at least 4 trading days of consolidation following it
  const searchEndIndex = Math.max(1, totalTradingDays - 3);
  let peakIndex = 0;
  let peakPrice = validCandles[0].high;

  for (let i = 1; i < searchEndIndex; i++) {
    if (validCandles[i].high > peakPrice) {
      peakPrice = validCandles[i].high;
      peakIndex = i;
    }
  }

  // Ensure there are at least 3-4 days after the peak for a base to form
  const barsAfterPeak = validCandles.slice(peakIndex + 1);
  if (barsAfterPeak.length < 3) {
    return {
      ...notIpoResult,
      currentClose,
      peakPrice,
      description: 'Initial peak formed too recently; consolidation history too brief.',
    };
  }

  // Rule 3: Identify Base Low (Trough)
  let baseLow = Infinity;
  for (const bar of barsAfterPeak) {
    if (bar.low < baseLow) {
      baseLow = bar.low;
    }
  }

  if (baseLow === Infinity || baseLow <= 0 || peakPrice <= 0) {
    return notIpoResult;
  }

  // Rule 4: Base Depth (% Pullback from Peak)
  const depthPct = ((peakPrice - baseLow) / peakPrice) * 100;

  // Constructive IPO base depth: 8% to 38% (up to 42% in extreme markets)
  // Rejects collapsed listings (> 45% dump) or flat non-consolidations (< 6%)
  if (depthPct < 6 || depthPct > 42) {
    return {
      ...notIpoResult,
      currentClose,
      peakPrice,
      baseLow,
      depthPct,
      description: depthPct < 6
        ? `Base too shallow (${depthPct.toFixed(1)}%).`
        : `Correction too deep (${depthPct.toFixed(1)}% > 42%). Base damaged.`,
    };
  }

  // Rule 5: Recovery back to Pivot
  // Distance from current close to initial peak
  const distanceToPivotPct = ((currentClose - peakPrice) / peakPrice) * 100;
  // Recovery Ratio: How much of the correction has been clawed back?
  const recoveryRatio = ((currentClose - baseLow) / (peakPrice - baseLow));

  let status: IPOBaseStatus = 'NOT_IPO';
  let isIPOBase = false;
  let description = '';

  if (currentClose >= peakPrice) {
    // Current price has cleared the initial high
    status = 'BREAKOUT';
    isIPOBase = true;
    description = `IPO Base Breakout: Price cleared initial peak ${peakPrice.toFixed(2)} (+${distanceToPivotPct.toFixed(1)}%). Zero overhead supply.`;
  } else if (currentClose >= peakPrice * 0.94) {
    // Current price is within 6% of the initial peak (ready for breakout / at pivot)
    status = 'AT_PIVOT';
    isIPOBase = true;
    description = `IPO Base (At Pivot): Price within ${Math.abs(distanceToPivotPct).toFixed(1)}% of initial high ${peakPrice.toFixed(2)}. Depth: ${depthPct.toFixed(1)}%.`;
  } else if (recoveryRatio >= 0.70) {
    // Has recovered at least 70% of the drop, curling up toward pivot
    status = 'FORMING';
    isIPOBase = true;
    description = `IPO Base (Recovering): Rounded U-turn recovered ${(recoveryRatio * 100).toFixed(0)}% of pullback. Pivot: ${peakPrice.toFixed(2)}.`;
  } else {
    status = 'NOT_IPO';
    isIPOBase = false;
    description = `In pullback/trough (recovered ${(recoveryRatio * 100).toFixed(0)}%). Has not yet curled back to pivot.`;
  }

  return {
    symbol,
    isIPOBase,
    status,
    totalTradingDays,
    peakPrice,
    baseLow,
    currentClose,
    depthPct,
    distanceToPivotPct,
    recoveryRatio,
    description,
  };
}

/**
 * Batch evaluates IPO Base pattern across multiple stocks.
 */
export function evaluateIPOBasesBatch(
  dataMap: Map<string, Array<OHLCItem>>
): Map<string, IPOBaseResult> {
  const resultMap = new Map<string, IPOBaseResult>();
  if (!dataMap) return resultMap;

  for (const [symbol, bars] of dataMap.entries()) {
    resultMap.set(symbol, evaluateIPOBase(symbol, bars));
  }

  return resultMap;
}
