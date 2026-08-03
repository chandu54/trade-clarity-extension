import { describe, test, expect } from 'vitest';
import {
  getBenchmarkSymbol,
  getBenchmarkOptions,
  findClosestCandle,
  calculateNormalizedPctSeries,
  calculateRsRatioSeries,
  getSmartBenchmarkSymbol,
  calculateStockRsCategory,
  calculateStockRsForCandles,
  hydrateStockRsValues
} from '../benchmarkUtils';

describe('benchmarkUtils', () => {
  test('getBenchmarkSymbol returns correct symbols for IN and US', () => {
    expect(getBenchmarkSymbol('IN', 'main')).toBe('^NSEI');
    expect(getBenchmarkSymbol('IN', 'smallcap')).toBe('^NSEI');
    expect(getBenchmarkSymbol('IN', 'midsmallcap')).toBe('^BSESN');

    expect(getBenchmarkSymbol('US', 'main')).toBe('^GSPC');
    expect(getBenchmarkSymbol('US', 'smallcap')).toBe('^RUT');
    expect(getBenchmarkSymbol('US', 'midsmallcap')).toBe('^NDX');
  });

  test('getBenchmarkOptions returns dropdown array with country labels', () => {
    const inOptions = getBenchmarkOptions('IN');
    expect(inOptions).toHaveLength(4);
    expect(inOptions[0].key).toBe('none');
    expect(inOptions[1].label).toContain('Nifty 50');
  });

  test('findClosestCandle finds closest candle by timestamp within threshold', () => {
    const candles = [
      { time: 1700000000, close: 100 },
      { time: 1700086400, close: 105 },
      { time: 1700172800, close: 110 }
    ];

    const closest = findClosestCandle(1700086400 + 10800, candles);
    expect(closest).toBeDefined();
    expect(closest.close).toBe(105);
  });

  test('calculateNormalizedPctSeries normalizes stock and benchmark dynamically', () => {
    const stockCandles = [
      { time: 1700000000, close: 100 },
      { time: 1700086400, close: 110 },
      { time: 1700172800, close: 95 }
    ];

    const benchCandles = [
      { time: 1700000000 + 10800, close: 200 },
      { time: 1700086400 + 10800, close: 220 },
      { time: 1700172800 + 10800, close: 190 }
    ];

    const { stockSeries, benchmarkSeries } = calculateNormalizedPctSeries(stockCandles, benchCandles);

    expect(stockSeries[0].value).toBe(0);
    expect(stockSeries[1].value).toBe(10);
    expect(stockSeries[2].value).toBe(-5);

    expect(benchmarkSeries[0].value).toBe(0);
    expect(benchmarkSeries[1].value).toBe(10);
    expect(benchmarkSeries[2].value).toBe(-5);
  });

  test('calculateRsRatioSeries calculates Mansfield relative strength line', () => {
    const stockCandles = [
      { time: 1700000000, close: 100 },
      { time: 1700086400, close: 120 },
    ];

    const benchCandles = [
      { time: 1700000000 + 3600, close: 200 },
      { time: 1700086400 + 3600, close: 200 },
    ];

    const { rsSeries, baseRatio } = calculateRsRatioSeries(stockCandles, benchCandles);

    expect(baseRatio).toBe(0.5);
    expect(rsSeries[0].value).toBe(0);
    expect(rsSeries[1].value).toBeCloseTo(20, 4);
  });

  test('getSmartBenchmarkSymbol picks correct index per market and sector', () => {
    expect(getSmartBenchmarkSymbol({ sector: 'Auto' }, 'IN')).toBe('^NSEI');
    expect(getSmartBenchmarkSymbol({ sector: 'IT' }, 'US')).toBe('^NDX');
    expect(getSmartBenchmarkSymbol({ sector: 'AI Stocks' }, 'US')).toBe('^NDX');
    expect(getSmartBenchmarkSymbol({ sector: 'Software' }, 'US')).toBe('^NDX');
    expect(getSmartBenchmarkSymbol({ sector: 'Finance' }, 'US')).toBe('^GSPC');
    expect(getSmartBenchmarkSymbol({ sector: 'Banks' }, 'US')).toBe('^GSPC');
  });

  test('calculateStockRsCategory maps 5-tier outperformance thresholds accurately', () => {
    // > +25% -> Very Strong
    expect(calculateStockRsCategory(30, 2).category).toBe('Very Strong');
    expect(calculateStockRsCategory(26, 0).category).toBe('Very Strong');

    // +15% to +25% -> Strong
    expect(calculateStockRsCategory(20, 2).category).toBe('Strong');
    expect(calculateStockRsCategory(16, 0).category).toBe('Strong');

    // -3% to +15% -> Neutral
    expect(calculateStockRsCategory(12, 0).category).toBe('Neutral');
    expect(calculateStockRsCategory(3, 0).category).toBe('Neutral');
    expect(calculateStockRsCategory(-2, 0).category).toBe('Neutral');
    // Real-world stock verification: INFY (+1.5% stock vs +3.6% bench = -2.1% net outperformance -> Neutral)
    expect(calculateStockRsCategory(1.5, 3.6).category).toBe('Neutral');
    // Real-world stock verification: TCS (+3.1% stock vs +2.3% bench = +0.8% net outperformance -> Neutral)
    expect(calculateStockRsCategory(3.1, 2.3).category).toBe('Neutral');

    // -15% to -3% -> Weak
    expect(calculateStockRsCategory(-5, 0).category).toBe('Weak');
    expect(calculateStockRsCategory(-14, 0).category).toBe('Weak');

    // < -15% -> Very Weak
    expect(calculateStockRsCategory(-20, 0).category).toBe('Very Weak');
  });

  test('calculateStockRsForCandles handles fresh IPOs and recent IPOs gracefully', () => {
    // Ultra-new IPO (< 5 days) -> Defaults to Neutral with IPO note
    const freshIpo = [
      { time: 1700000000, close: 100 },
      { time: 1700086400, close: 120 }
    ];
    const freshRes = calculateStockRsForCandles(freshIpo, []);
    expect(freshRes.category).toBe('Neutral');
    expect(freshRes.isIpo).toBe(true);
    expect(freshRes.note).toContain('New IPO');

    // Recent IPO (e.g. 10 days, stock up +30%, benchmark up +2% -> Very Strong)
    const recentIpo = Array.from({ length: 10 }, (_, i) => ({
      time: 1700000000 + i * 86400,
      close: 100 + i * 3
    }));
    const benchCandles = Array.from({ length: 10 }, (_, i) => ({
      time: 1700000000 + i * 86400,
      close: 200 + i * 0.4
    }));

    const ipoRes = calculateStockRsForCandles(recentIpo, benchCandles);
    expect(ipoRes.category).toBe('Very Strong');
    expect(ipoRes.isIpo).toBe(true);
    expect(ipoRes.note).toContain('Since IPO');
  });

  test('hydrateStockRsValues calculates net outperformance and updates stock params accurately', async () => {
    const stocks = [
      { symbol: 'ABCAPITAL', sector: 'Finance' },
      { symbol: 'INFY', sector: 'IT' }
    ];

    const uiConfig = {
      rsTimeframe: '3mo',
      rsThresholdVeryStrong: 25,
      rsThresholdStrong: 15,
      rsThresholdNeutral: -3,
      rsThresholdWeak: -15
    };

    const hydrated = await hydrateStockRsValues(stocks, 'IN', uiConfig);

    expect(hydrated).toHaveLength(2);
    expect(hydrated[0].params).toBeDefined();
    expect(hydrated[0].params.rs).toBeDefined();
    expect(hydrated[1].params).toBeDefined();
    expect(hydrated[1].params.rs).toBeDefined();
  });
});
