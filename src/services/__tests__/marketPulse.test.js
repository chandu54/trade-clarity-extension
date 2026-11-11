import { describe, it, vi, beforeEach, expect } from 'vitest';
import { 
  fetchMarketPulseData, 
  generateTechnicalThesis, 
  filterToLatestActiveSession,
  calculateDistributionDays,
  analyzePriceActionGeometry,
  getInstitutionalTrend
} from '../marketPulse';
import * as yahooFinanceMap from '../../utils/yahooFinanceMap';

vi.mock('../../utils/yahooFinanceMap', () => ({
  fetchStockData: vi.fn()
}));

describe('marketPulse service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates SMAs, RSI, and institutional trend correct score/phase for US indices', async () => {
    const mockCandles = Array.from({ length: 30 }, (_, i) => ({
      time: 1700000000 + i * 86400,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 100 + i
    }));

    yahooFinanceMap.fetchStockData.mockResolvedValue([
      {
        symbol: '^GSPC',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: '^IXIC',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: '^DJI',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: '^RUT',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLK',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLF',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLV',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLE',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLI',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLB',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLU',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLY',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      },
      {
        symbol: 'XLP',
        currentPrice: 130,
        prevClose: 129,
        dailyChangePct: 0.78,
        periodChangePct: 5.0,
        candlesticks: mockCandles
      }
    ]);

    const data = await fetchMarketPulseData('US', '1y');
    expect(data).toHaveLength(2); // Major Indices, Sector ETFs
    expect(data[0].category).toBe('Major Indices');

    const sp500 = data[0].indices.find(idx => idx.symbol === '^GSPC');
    expect(sp500).toBeDefined();
    expect(sp500.sma5).toBeTypeOf('number');
    expect(sp500.sma10).toBeTypeOf('number');
    expect(sp500.rsi).toBeTypeOf('number');
    expect(sp500.healthScore).toBeTypeOf('number');
  });

  it('correctly maps proxy data and scales values for Indian indices', async () => {
    const mockCandles = [{ time: 1700000000, open: 10, high: 12, low: 9, close: 11 }];
    const mockProxyCandles = [{ time: 1700000000, open: 100, high: 120, low: 90, close: 110 }];

    yahooFinanceMap.fetchStockData.mockImplementation((symbols) => {
      if (symbols.includes('HDFCSML250.NS')) {
        return Promise.resolve([
          { symbol: 'HDFCSML250.NS', currentPrice: 50, prevClose: 49, candlesticks: mockProxyCandles }
        ]);
      }
      return Promise.resolve(symbols.map(s => ({
        symbol: s,
        currentPrice: s === '^CNXSC' ? 0 : 100, // force proxy usage for ^CNXSC
        prevClose: s === '^CNXSC' ? 0 : 99,
        dailyChangePct: 1,
        candlesticks: mockCandles
      })));
    });

    const data = await fetchMarketPulseData('IN', '1y');
    const midcapGroup = data[0];
    const cnxsc = midcapGroup.indices.find(idx => idx.symbol === '^CNXSC');
    expect(cnxsc).toBeDefined();
    expect(cnxsc.currentPrice).toBe(5250); // Proxy price 50 * ratio 105
  });

  it('generates a correct technical thesis statement based on trends', () => {
    const mockCategorizedData = [
      {
        category: 'Major Indices',
        indices: [
          {
            symbol: '^GSPC',
            trendPhase: 'Structural Bull',
            currentPrice: 100,
            sma200: 90,
            dist52wH: -1.5
          },
          {
            symbol: '^IXIC',
            trendPhase: 'Structural Bull',
            currentPrice: 100,
            sma200: 95,
            dist52wH: -3.0
          }
        ]
      }
    ];

    const thesis = generateTechnicalThesis(mockCategorizedData);
    expect(thesis).toContain('Market Regime: STRUCTURAL BULL');
    expect(thesis).toContain('Breadth: 100% above 200SMA');
  });

  describe('filterToLatestActiveSession', () => {
    it('discards weekend/holiday dummy bars and retains the full prior active trading session', () => {
      // Friday session: 25 candles (1754634600 = Fri Nov 06 2026 09:15 UTC)
      const fridayBaseTime = 1754634600;
      const fridayCandles = Array.from({ length: 25 }, (_, i) => ({
        time: fridayBaseTime + i * 900,
        open: 24000 + i,
        high: 24010 + i,
        low: 23990 + i,
        close: 24005 + i
      }));

      // Sunday off-market dummy bar (1 candle on Sunday Nov 08 2026)
      const sundayTime = 1754807400; // Sunday
      const sundayCandle = {
        time: sundayTime,
        open: 24986.40,
        high: 24986.40,
        low: 24986.40,
        close: 24986.40
      };

      const mixedCandles = [...fridayCandles, sundayCandle];
      const result = filterToLatestActiveSession(mixedCandles);

      // Must discard the 1-bar Sunday dummy and return all 25 Friday bars
      expect(result.length).toBe(25);
      expect(result[0].time).toBe(fridayBaseTime);
      expect(result[24].close).toBe(24005 + 24);
    });

    it('returns empty array or intact array when inputs are empty or small single session', () => {
      expect(filterToLatestActiveSession([])).toEqual([]);
      const single = [{ time: 1754634600, open: 10, high: 11, low: 9, close: 10 }];
      expect(filterToLatestActiveSession(single)).toEqual(single);
    });
  });

  describe('calculateDistributionDays', () => {
    it('detects institutional distribution days when close drops >= 0.2% on higher volume', () => {
      const candles = [
        { time: 1000, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
        { time: 2000, open: 100, high: 100.5, low: 98.5, close: 99.0, volume: 1500 }, // drop 1.0% on higher vol -> Dist Day
        { time: 3000, open: 99, high: 100, low: 98.8, close: 99.5, volume: 1100 },
        { time: 4000, open: 99.5, high: 99.8, low: 98.0, close: 98.5, volume: 1800 }, // drop 1.0% on higher vol -> Dist Day
      ];

      const res = calculateDistributionDays(candles, 25);
      expect(res.count).toBe(2);
      expect(res.status).toContain('Confirmed Uptrend');
      expect(res.label).toBe('Low');
      expect(res.color).toBe('#10b981');
    });

    it('correctly categorizes Elevated risk when 5 or more distribution days accumulate', () => {
      const candles = [{ time: 0, open: 100, high: 101, low: 99, close: 100, volume: 1000 }];
      for (let i = 1; i <= 6; i++) {
        candles.push({
          time: i * 1000,
          open: 100 - i * 0.5,
          high: 100 - i * 0.4,
          low: 100 - i * 0.8,
          close: 100 - i * 0.7, // consecutive drops
          volume: 1000 + i * 200 // consecutive higher volumes
        });
      }

      const res = calculateDistributionDays(candles, 25);
      expect(res.count).toBeGreaterThanOrEqual(5);
      expect(res.label).toBe('High');
      expect(res.color).toBe('#ef4444');
    });

    it('invalidates a distribution day if price subsequently rallies 5% or more above its close', () => {
      const candles = [
        { time: 1000, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
        { time: 2000, open: 100, high: 100, low: 98, close: 98.5, volume: 1500 }, // Dist day at close 98.5
        { time: 3000, open: 99, high: 105, low: 99, close: 104.5, volume: 2000 }, // Rallied > 5% above 98.5
      ];

      const res = calculateDistributionDays(candles, 25);
      expect(res.count).toBe(0); // invalidated
    });
  });

  describe('analyzePriceActionGeometry', () => {
    it('classifies Higher Highs & Higher Lows structure and calculates pivots', () => {
      const candles = [
        { time: 1000, open: 100, high: 105, low: 98, close: 104, volume: 1000 },
        { time: 2000, open: 104, high: 108, low: 102, close: 107, volume: 1100 },
        { time: 3000, open: 107, high: 110, low: 105, close: 109, volume: 900 },
        { time: 4000, open: 109, high: 114, low: 108, close: 113, volume: 1200 },
        { time: 5000, open: 113, high: 116, low: 111, close: 115, volume: 1300 },
        { time: 6000, open: 115, high: 118, low: 113, close: 117, volume: 1400 },
      ];

      const res = analyzePriceActionGeometry(candles, 15, 117, 120);
      expect(res.structureLabel).toContain('Higher Highs & Higher Lows');
      expect(res.pivots.s1).toBeLessThanOrEqual(117);
      expect(res.pivots.r1).toBeGreaterThanOrEqual(117);
      expect(res.recentCandlesSummary).toContain('O:');
    });

    it('identifies bullish hammer when lower shadow strongly rejects lower prices', () => {
      const candles = [
        { time: 1000, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
        { time: 2000, open: 101, high: 101.5, low: 95.0, close: 101.2, volume: 1800 }, // long lower wick of 6.2
      ];

      const res = analyzePriceActionGeometry(candles, 15, 101.2);
      expect(res.lastCandleDesc).toContain('Bullish Hammer');
    });
  });

  describe('getInstitutionalTrend with Weinstein Stage & Distribution integration', () => {
    it('returns Stage 2 Markup and adjusts phase when distribution count is elevated', () => {
      const smas = { sma21: 105, sma50: 100, sma200: 90 };
      const resNormal = getInstitutionalTrend(110, smas, 1);
      expect(resNormal.score).toBe(100);
      expect(resNormal.stage).toContain('Stage 2 (Markup');
      expect(resNormal.phase).toBe('Structural Bull');

      const resDist = getInstitutionalTrend(110, smas, 5);
      expect(resDist.phase).toBe('Uptrend Under Heavy Pressure');
      expect(resDist.color).toBe('#ef4444');
    });
  });
});
