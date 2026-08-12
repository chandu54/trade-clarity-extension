/**
 * TradeClarity - Volatility Contraction Pattern (VCP) Tightness Analysis Module
 * Calculates 10-day High-Low price contraction percentage from historical daily candles.
 */

export enum VCPTightnessCategory {
  TIGHT = "Tight (< 4%)",
  MODERATE = "Moderate (4-7%)",
  WIDE = "Wide (> 7%)",
}

export interface VCPTightnessResult {
  category: VCPTightnessCategory;
  tightnessPct: number;
  displayText: string;
  isTight: boolean;
}

/**
 * Evaluates VCP Tightness from an array of daily OHLC candles.
 * Uses the last 10 trading candles (or fewer if total candles < 10).
 */
export function evaluateVCPTightnessFromCandles(
  candles: Array<{ high: number; low: number }>
): VCPTightnessResult {
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      category: VCPTightnessCategory.WIDE,
      tightnessPct: 0,
      displayText: "Unknown",
      isTight: false,
    };
  }

  // Slice up to the last 10 trading candles
  const recentCandles = candles.slice(-10);
  let maxHigh = -Infinity;
  let minLow = Infinity;

  for (const c of recentCandles) {
    if (typeof c.high === "number" && !isNaN(c.high) && c.high > maxHigh) {
      maxHigh = c.high;
    }
    if (typeof c.low === "number" && !isNaN(c.low) && c.low < minLow) {
      minLow = c.low;
    }
  }

  if (maxHigh === -Infinity || minLow === Infinity || minLow <= 0) {
    return {
      category: VCPTightnessCategory.WIDE,
      tightnessPct: 0,
      displayText: "Unknown",
      isTight: false,
    };
  }

  const tightnessPct = parseFloat((((maxHigh - minLow) / minLow) * 100).toFixed(1));

  let category: VCPTightnessCategory;
  if (tightnessPct < 4.0) {
    category = VCPTightnessCategory.TIGHT;
  } else if (tightnessPct <= 7.0) {
    category = VCPTightnessCategory.MODERATE;
  } else {
    category = VCPTightnessCategory.WIDE;
  }

  const tagLabel = category.split(" ")[0]; // "Tight", "Moderate", "Wide"
  const displayText = `${tagLabel} (${tightnessPct}%)`;

  return {
    category,
    tightnessPct,
    displayText,
    isTight: tightnessPct < 4.0,
  };
}
