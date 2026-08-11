import { describe, it, expect, vi } from 'vitest';
import {
  MarketStage,
  evaluateStageFromCandles,
  fetchAndCalculateStage,
  fetchAndCalculateStageBatch,
} from '../calculateStageMetric';

describe('Stan Weinstein Stock Stage Analysis Module', () => {
  // Helper to generate a bar vector
  function generateBars(
    count: number,
    priceGenerator: (index: number) => number,
    volumeGenerator: (index: number) => number = () => 1000000
  ) {
    const bars = [];
    const baseTime = 1700000000;
    for (let i = 0; i < count; i++) {
      bars.push({
        timestamp: baseTime + i * 86400,
        close: priceGenerator(i),
        volume: volumeGenerator(i),
      });
    }
    return bars;
  }

  describe('evaluateStageFromCandles (Pure Calculations)', () => {
    it('returns INSUFFICIENT_DATA status when candles count is < 200', () => {
      const bars = generateBars(150, () => 100);
      const result = evaluateStageFromCandles('AAPL', bars);

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.stage).toBe(MarketStage.UNKNOWN);
      expect(result.stageName).toBe('Insufficient Data');
      expect(result.errorMessage).toContain('At least 200 historical trading bars are required');
    });

    it('correctly classifies STAGE 2 (Advancing) and identifies volume breakout', () => {
      // 250 bars total: SMA 200 latest ~ 100, 20d ago ~ 90 (slope > 1.5%). Current price = 140 (> SMA 200).
      // Volume average 50 ~ 100,000. Latest volume = 200,000 (surge ratio = 2.0 >= 1.5).
      const bars = generateBars(
        250,
        (i) => (i < 200 ? 80 + i * 0.1 : 100 + (i - 200) * 1.0),
        (i) => (i >= 246 ? 200000 : 100000)
      );

      const result = evaluateStageFromCandles('NVDA', bars);

      expect(result.status).toBe('SUCCESS');
      expect(result.stage).toBe(MarketStage.STAGE_2_ADVANCING);
      expect(result.stageName).toBe('Stage 2 - Advancing');
      expect(result.mappedOption).toBe('Stage 2');
      expect(result.metrics.currentPrice).toBeGreaterThan(result.metrics.sma200);
      expect(result.metrics.smaSlopePct).toBeGreaterThan(1.5);
      expect(result.metrics.isVolumeBreakout).toBe(true);
      expect(result.metrics.volumeSurgeRatio).toBeGreaterThanOrEqual(1.5);
    });

    it('correctly classifies STAGE 4 (Declining)', () => {
      // 250 bars total: SMA 200 latest ~ 100, 20d ago ~ 115 (slope < -1.5%). Current price = 70 (< SMA 200).
      const bars = generateBars(
        250,
        (i) => (i < 200 ? 120 - i * 0.1 : 100 - (i - 200) * 0.8),
        () => 500000
      );

      const result = evaluateStageFromCandles('TSLA', bars);

      expect(result.status).toBe('SUCCESS');
      expect(result.stage).toBe(MarketStage.STAGE_4_DECLINING);
      expect(result.stageName).toBe('Stage 4 - Declining');
      expect(result.mappedOption).toBe('Stage 4');
      expect(result.metrics.currentPrice).toBeLessThan(result.metrics.sma200);
      expect(result.metrics.smaSlopePct).toBeLessThan(-1.5);
    });

    it('correctly classifies STAGE 1 (Accumulation / Base) following a prior downtrend', () => {
      // 500 bars:
      // Bars 0..250: Downtrend at price 60 (below SMA200)
      // Bars 251..500: Flat base around 100 (SMA200 = 100, flat slope 0%, price = 100)
      const bars = generateBars(
        500,
        (i) => (i < 250 ? 60 : 100),
        () => 100000
      );

      const result = evaluateStageFromCandles('RELIANCE.NS', bars);

      expect(result.status).toBe('SUCCESS');
      expect(result.stage).toBe(MarketStage.STAGE_1_ACCUMULATION);
      expect(result.stageName).toBe('Stage 1 - Accumulation');
      expect(result.mappedOption).toBe('Stage 1');
      expect(Math.abs(result.metrics.smaSlopePct)).toBeLessThanOrEqual(1.5);
      expect(result.metrics.priceToSmaRatio).toBeGreaterThanOrEqual(0.9);
      expect(result.metrics.priceToSmaRatio).toBeLessThanOrEqual(1.1);
    });

    it('correctly classifies STAGE 3 (Distribution / Top) following a prior uptrend', () => {
      // 500 bars:
      // Bars 0..250: Strong uptrend at price 140 (above SMA200)
      // Bars 251..500: Flat top around 100 (SMA200 = 100, flat slope 0%, price = 100)
      const bars = generateBars(
        500,
        (i) => (i < 250 ? 140 : 100),
        () => 100000
      );

      const result = evaluateStageFromCandles('AMZN', bars);

      expect(result.status).toBe('SUCCESS');
      expect(result.stage).toBe(MarketStage.STAGE_3_DISTRIBUTION);
      expect(result.stageName).toBe('Stage 3 - Distribution');
      expect(result.mappedOption).toBe('Stage 3');
      expect(Math.abs(result.metrics.smaSlopePct)).toBeLessThanOrEqual(1.5);
    });
  });

  describe('fetchAndCalculateStage & fetchAndCalculateStageBatch (Async Fetchers)', () => {
    it('fetches historical bars via API mock and computes stage', async () => {
      const mockBars = generateBars(250, (i) => 100 + i * 0.5);

      // Mock global fetch
      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                timestamp: mockBars.map((b) => b.timestamp),
                indicators: {
                  quote: [
                    {
                      close: mockBars.map((b) => b.close),
                      volume: mockBars.map((b) => b.volume),
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      vi.stubGlobal('fetch', globalFetchMock);

      const result = await fetchAndCalculateStage('AAPL');

      expect(result.status).toBe('SUCCESS');
      expect(result.symbol).toBe('AAPL');
      expect(result.stage).toBe(MarketStage.STAGE_2_ADVANCING);

      vi.unstubAllGlobals();
    });

    it('handles network error in fetchAndCalculateStage gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network connection timeout'))
      );

      const result = await fetchAndCalculateStage('INVALID_SYM');

      expect(result.status).toBe('ERROR');
      expect(result.stage).toBe(MarketStage.UNKNOWN);
      expect(result.errorMessage).toContain('Network connection timeout');

      vi.unstubAllGlobals();
    });

    it('batch processes symbols with concurrency and returns a Map', async () => {
      const mockBars = generateBars(250, (i) => 100 + i * 0.5);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  timestamp: mockBars.map((b) => b.timestamp),
                  indicators: {
                    quote: [
                      {
                        close: mockBars.map((b) => b.close),
                        volume: mockBars.map((b) => b.volume),
                      },
                    ],
                  },
                },
              ],
            },
          }),
        })
      );

      const symbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL'];
      const resultMap = await fetchAndCalculateStageBatch(symbols, 'US', 2);

      expect(resultMap).toBeInstanceOf(Map);
      expect(resultMap.size).toBe(4);
      expect(resultMap.get('AAPL')?.status).toBe('SUCCESS');
      expect(resultMap.get('MSFT')?.stage).toBe(MarketStage.STAGE_2_ADVANCING);

      vi.unstubAllGlobals();
    });
  });
});
