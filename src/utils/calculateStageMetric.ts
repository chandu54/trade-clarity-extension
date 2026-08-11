/**
 * Stan Weinstein Stock Stage Analysis Module
 * Quantitative stage evaluation, indicators, and batch processing.
 */

export enum MarketStage {
  STAGE_1_ACCUMULATION = 'STAGE_1_ACCUMULATION',
  STAGE_2_ADVANCING = 'STAGE_2_ADVANCING',
  STAGE_3_DISTRIBUTION = 'STAGE_3_DISTRIBUTION',
  STAGE_4_DECLINING = 'STAGE_4_DECLINING',
  UNKNOWN = 'UNKNOWN'
}

export interface StageMetricResult {
  symbol: string;
  stage: MarketStage;
  stageName: string; // e.g., "Stage 2 - Advancing"
  mappedOption: string; // e.g., "Stage 2" (for product dropdown mapping)
  metrics: {
    currentPrice: number;
    sma200: number;
    smaSlopePct: number;
    priceToSmaRatio: number;
    volumeAvg50: number;
    latestVolume: number;
    volumeSurgeRatio: number;
    isVolumeBreakout: boolean;
  };
  fetchedAt: Date;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA' | 'ERROR';
  errorMessage?: string;
}

export interface OHLCVBar {
  close: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
  timestamp?: number;
}

/**
 * Pure helper function to compute a Simple Moving Average (SMA) over a given period.
 */
function computeSMA(values: number[], period: number): number | null {
  if (!values || values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((acc, val) => acc + (val || 0), 0);
  return sum / period;
}

/**
 * Pure evaluation function: Takes symbol & historical daily bars (ordered oldest to newest)
 * and deterministically calculates Weinstein Stage indicators & classification.
 */
export function evaluateStageFromCandles(
  symbol: string,
  bars: OHLCVBar[]
): StageMetricResult {
  const now = new Date();

  // Insufficient data validation
  if (!bars || bars.length < 200) {
    return {
      symbol,
      stage: MarketStage.UNKNOWN,
      stageName: 'Insufficient Data',
      mappedOption: '',
      metrics: {
        currentPrice: bars && bars.length > 0 ? bars[bars.length - 1].close || 0 : 0,
        sma200: 0,
        smaSlopePct: 0,
        priceToSmaRatio: 0,
        volumeAvg50: 0,
        latestVolume: bars && bars.length > 0 ? bars[bars.length - 1].volume || 0 : 0,
        volumeSurgeRatio: 0,
        isVolumeBreakout: false,
      },
      fetchedAt: now,
      status: 'INSUFFICIENT_DATA',
      errorMessage: `At least 200 historical trading bars are required. Provided: ${bars ? bars.length : 0}`,
    };
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const latestIndex = bars.length - 1;
  const currentPrice = closes[latestIndex];
  const latestVolume = volumes[latestIndex];

  // 1. SMA 200 (Latest)
  const sma200 = computeSMA(closes, 200);
  if (sma200 === null || sma200 <= 0) {
    return {
      symbol,
      stage: MarketStage.UNKNOWN,
      stageName: 'Error in SMA Calculation',
      mappedOption: '',
      metrics: {
        currentPrice,
        sma200: 0,
        smaSlopePct: 0,
        priceToSmaRatio: 0,
        volumeAvg50: 0,
        latestVolume,
        volumeSurgeRatio: 0,
        isVolumeBreakout: false,
      },
      fetchedAt: now,
      status: 'ERROR',
      errorMessage: 'Failed to calculate 200-day Simple Moving Average.',
    };
  }

  // 2. SMA 200 20 days ago
  const closes20dAgo = closes.slice(0, closes.length - 20);
  const sma200_20dAgo = computeSMA(closes20dAgo, 200);

  // 3. SMA Slope % over 20 days
  let smaSlopePct = 0;
  if (sma200_20dAgo && sma200_20dAgo > 0) {
    smaSlopePct = ((sma200 - sma200_20dAgo) / sma200_20dAgo) * 100;
  }

  // 4. Volume Avg 50 & Volume Surge Ratio
  const volumeAvg50 = computeSMA(volumes, 50) || 0;
  const volumeSurgeRatio = volumeAvg50 > 0 ? latestVolume / volumeAvg50 : 0;

  // 5. Price to SMA Ratio
  const priceToSmaRatio = currentPrice / sma200;

  // 6. Volume Breakout Check (Volume Surge >= 1.5 within last 5 trading days)
  let isVolumeBreakout = false;
  const lookbackStart = Math.max(0, bars.length - 5);
  for (let i = lookbackStart; i < bars.length; i++) {
    const volAvgAtI = computeSMA(volumes.slice(0, i + 1), 50);
    if (volAvgAtI && volAvgAtI > 0) {
      if (volumes[i] / volAvgAtI >= 1.5) {
        isVolumeBreakout = true;
        break;
      }
    }
  }

  // Stage Classification Logic
  const FLAT_THRESHOLD = 1.5;
  let stage = MarketStage.UNKNOWN;
  let stageName = 'Stage Unknown';
  let mappedOption = '';

  // Check prior trend history before consolidation to distinguish Stage 1 vs Stage 3
  const priorWindowStart = Math.max(0, bars.length - 300);
  const priorWindowEnd = Math.max(1, bars.length - 60);
  const priorCloses = closes.slice(priorWindowStart, priorWindowEnd);
  const priorAvgPrice = priorCloses.reduce((a, b) => a + b, 0) / (priorCloses.length || 1);

  if (currentPrice > sma200) {
    if (
      priceToSmaRatio >= 0.90 &&
      priceToSmaRatio <= 1.10 &&
      Math.abs(smaSlopePct) <= FLAT_THRESHOLD
    ) {
      // Near SMA200 consolidation base/top
      if (priorAvgPrice > sma200) {
        stage = MarketStage.STAGE_3_DISTRIBUTION;
        stageName = 'Stage 3 - Distribution';
        mappedOption = 'Stage 3';
      } else {
        stage = MarketStage.STAGE_1_ACCUMULATION;
        stageName = 'Stage 1 - Accumulation';
        mappedOption = 'Stage 1';
      }
    } else {
      // Trading clearly above SMA200 -> Stage 2 Advancing
      stage = MarketStage.STAGE_2_ADVANCING;
      stageName = 'Stage 2 - Advancing';
      mappedOption = 'Stage 2';
    }
  } else {
    // currentPrice <= sma200
    if (
      priceToSmaRatio >= 0.90 &&
      priceToSmaRatio <= 1.10 &&
      Math.abs(smaSlopePct) <= FLAT_THRESHOLD
    ) {
      // Near SMA200 consolidation base/top
      if (priorAvgPrice <= sma200) {
        stage = MarketStage.STAGE_1_ACCUMULATION;
        stageName = 'Stage 1 - Accumulation';
        mappedOption = 'Stage 1';
      } else {
        stage = MarketStage.STAGE_3_DISTRIBUTION;
        stageName = 'Stage 3 - Distribution';
        mappedOption = 'Stage 3';
      }
    } else {
      // Trading clearly below SMA200 -> Stage 4 Declining
      stage = MarketStage.STAGE_4_DECLINING;
      stageName = 'Stage 4 - Declining';
      mappedOption = 'Stage 4';
    }
  }

  return {
    symbol,
    stage,
    stageName,
    mappedOption,
    metrics: {
      currentPrice: Number(currentPrice.toFixed(2)),
      sma200: Number(sma200.toFixed(2)),
      smaSlopePct: Number(smaSlopePct.toFixed(2)),
      priceToSmaRatio: Number(priceToSmaRatio.toFixed(4)),
      volumeAvg50: Number(volumeAvg50.toFixed(0)),
      latestVolume,
      volumeSurgeRatio: Number(volumeSurgeRatio.toFixed(2)),
      isVolumeBreakout,
    },
    fetchedAt: now,
    status: 'SUCCESS',
  };
}

/**
 * Async function to fetch 250+ historical bars via Yahoo Finance and calculate Stage metrics.
 */
export async function fetchAndCalculateStage(
  symbol: string,
  country: string = 'US'
): Promise<StageMetricResult> {
  const now = new Date();
  try {
    let ticker = symbol;
    if (country === 'IN' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO') && !symbol.startsWith('^')) {
      ticker = `${symbol}.NS`;
    }

    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query1.finance.yahoo.com';
    const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned status ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error(`No historical chart data returned for ${ticker}`);
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    const adjCloses = result.indicators.adjclose?.[0]?.adjclose || [];

    const bars: OHLCVBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      let closePrice = null;
      if (adjCloses[i] != null && adjCloses[i] > 0) {
        closePrice = adjCloses[i];
      } else if (closes[i] != null && closes[i] > 0) {
        closePrice = closes[i];
      }

      if (timestamps[i] != null && closePrice != null && closePrice > 0) {
        bars.push({
          timestamp: timestamps[i],
          close: closePrice,
          volume: volumes[i] != null && volumes[i] >= 0 ? volumes[i] : 0,
        });
      }
    }

    // Sort chronologically (Oldest -> Newest)
    bars.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return evaluateStageFromCandles(symbol, bars);
  } catch (err: any) {
    return {
      symbol,
      stage: MarketStage.UNKNOWN,
      stageName: 'Error',
      mappedOption: '',
      metrics: {
        currentPrice: 0,
        sma200: 0,
        smaSlopePct: 0,
        priceToSmaRatio: 0,
        volumeAvg50: 0,
        latestVolume: 0,
        volumeSurgeRatio: 0,
        isVolumeBreakout: false,
      },
      fetchedAt: now,
      status: 'ERROR',
      errorMessage: err?.message || 'Failed to fetch historical stage data',
    };
  }
}

/**
 * Bulk batching function with concurrency limiting to calculate Stage metrics for multiple symbols.
 */
export async function fetchAndCalculateStageBatch(
  symbols: string[],
  country: string = 'US',
  concurrency: number = 5
): Promise<Map<string, StageMetricResult>> {
  const resultMap = new Map<string, StageMetricResult>();
  if (!symbols || symbols.length === 0) return resultMap;

  for (let i = 0; i < symbols.length; i += concurrency) {
    const chunk = symbols.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map((sym) => fetchAndCalculateStage(sym, country))
    );

    chunkResults.forEach((res, idx) => {
      const sym = chunk[idx];
      if (res.status === 'fulfilled') {
        resultMap.set(sym, res.value);
      } else {
        resultMap.set(sym, {
          symbol: sym,
          stage: MarketStage.UNKNOWN,
          stageName: 'Error',
          mappedOption: '',
          metrics: {
            currentPrice: 0,
            sma200: 0,
            smaSlopePct: 0,
            priceToSmaRatio: 0,
            volumeAvg50: 0,
            latestVolume: 0,
            volumeSurgeRatio: 0,
            isVolumeBreakout: false,
          },
          fetchedAt: new Date(),
          status: 'ERROR',
          errorMessage: res.reason?.message || 'Execution error during batch fetch',
        });
      }
    });

    if (i + concurrency < symbols.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return resultMap;
}
