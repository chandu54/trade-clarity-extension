/**
 * Stock Tagging Utility: Detect Young IPO & Recent Listings
 * Evaluates daily historical OHLC data to assign IPO-related status tags based on trading day thresholds.
 */

export enum IPOTag {
  YOUNG_IPO = 'YOUNG_IPO',
  RECENT_LISTING = 'RECENT_LISTING',
  ESTABLISHED = 'ESTABLISHED'
}

export interface IPOTagResult {
  symbol: string;
  ipoTag: IPOTag;
  tagName: string; // e.g. "Young IPO", "Recent Listing", "Established"
  totalTradingDays: number;
  isYoungIPO: boolean;
  isRecentListing: boolean;
  isEstablished: boolean;
}

export interface OHLCItem {
  date?: Date | string;
  close: number;
  timestamp?: number;
}

/**
 * Evaluates historical daily OHLC candles and assigns an IPO-related status tag.
 * Thresholds:
 *  - YOUNG_IPO: < 60 trading days
 *  - RECENT_LISTING: >= 60 and < 250 trading days
 *  - ESTABLISHED: >= 250 trading days
 */
export function evaluateIPOTag(
  symbol: string,
  ohlcData?: Array<OHLCItem>
): IPOTagResult {
  // Edge cases: null, undefined, or non-array -> default to 0 trading days & YOUNG_IPO
  if (!ohlcData || !Array.isArray(ohlcData) || ohlcData.length === 0) {
    return {
      symbol,
      ipoTag: IPOTag.YOUNG_IPO,
      tagName: 'Young IPO',
      totalTradingDays: 0,
      isYoungIPO: true,
      isRecentListing: false,
      isEstablished: false,
    };
  }

  const validCandles = ohlcData.filter(
    (bar) => bar && typeof bar.close === 'number' && bar.close > 0
  );
  const totalTradingDays = validCandles.length;

  let ipoTag = IPOTag.ESTABLISHED;
  let tagName = 'Established';

  if (totalTradingDays < 60) {
    ipoTag = IPOTag.YOUNG_IPO;
    tagName = 'Young IPO';
  } else if (totalTradingDays < 250) {
    ipoTag = IPOTag.RECENT_LISTING;
    tagName = 'Recent Listing';
  }

  return {
    symbol,
    ipoTag,
    tagName,
    totalTradingDays,
    isYoungIPO: ipoTag === IPOTag.YOUNG_IPO,
    isRecentListing: ipoTag === IPOTag.RECENT_LISTING,
    isEstablished: ipoTag === IPOTag.ESTABLISHED,
  };
}

/**
 * Batch tagger evaluating a Map of ticker symbols to OHLC arrays.
 */
export function evaluateIPOTagsBatch(
  dataMap: Map<string, Array<OHLCItem>>
): Map<string, IPOTagResult> {
  const resultMap = new Map<string, IPOTagResult>();
  if (!dataMap) return resultMap;

  for (const [symbol, bars] of dataMap.entries()) {
    resultMap.set(symbol, evaluateIPOTag(symbol, bars));
  }

  return resultMap;
}
