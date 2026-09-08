import { describe, it, expect } from 'vitest';
import {
  evaluateIPOBase,
  evaluateIPOBasesBatch,
  OHLCItem,
} from '../detectIPOBase';

describe('Stock Pattern Utility: detectIPOBase', () => {
  // Helper to construct a simulated IPO price lifecycle
  function createIpoCandles(prices: Array<{ high: number; low: number; close: number }>): OHLCItem[] {
    return prices.map((p, idx) => ({
      date: new Date(Date.now() - (prices.length - idx) * 86400000).toISOString(),
      open: (p.high + p.low) / 2,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: 100000,
    }));
  }

  it('handles null, undefined, or empty arrays gracefully', () => {
    const resultNull = evaluateIPOBase('XYZ', null as any);
    expect(resultNull.isIPOBase).toBe(false);
    expect(resultNull.status).toBe('NOT_IPO');

    const resultEmpty = evaluateIPOBase('XYZ', []);
    expect(resultEmpty.isIPOBase).toBe(false);
    expect(resultEmpty.status).toBe('NOT_IPO');
  });

  it('rejects stocks that are too young (< 10 trading days)', () => {
    const candles = createIpoCandles(
      Array.from({ length: 7 }, (_, i) => ({ high: 100 + i, low: 95 + i, close: 98 + i }))
    );
    const result = evaluateIPOBase('NEWCO', candles);
    expect(result.isIPOBase).toBe(false);
    expect(result.status).toBe('NOT_IPO');
    expect(result.description).toContain('Too young');
  });

  it('rejects mature stocks (> 65 trading days)', () => {
    const candles = createIpoCandles(
      Array.from({ length: 75 }, (_, i) => ({ high: 100 + i * 0.1, low: 98 + i * 0.1, close: 99 + i * 0.1 }))
    );
    const result = evaluateIPOBase('OLDCO', candles);
    expect(result.isIPOBase).toBe(false);
    expect(result.status).toBe('NOT_IPO');
    expect(result.description).toContain('Established history');
  });

  it('detects an IPO Base at pivot (Cup / U-turn recovery within 5% of initial high)', () => {
    // 25 trading days total:
    // Days 1-5: Initial rally peaking at high 100
    // Days 6-15: Pullback to low 80 (20% depth)
    // Days 16-25: Recovery up to 98 (within 2% of initial high 100)
    const prices = [
      { high: 85, low: 80, close: 82 },
      { high: 90, low: 82, close: 88 },
      { high: 95, low: 86, close: 92 },
      { high: 98, low: 90, close: 96 },
      { high: 100, low: 92, close: 95 }, // Peak at 100
      // Pullback
      { high: 96, low: 88, close: 89 },
      { high: 92, low: 84, close: 85 },
      { high: 88, low: 82, close: 83 },
      { high: 86, low: 80, close: 81 }, // Trough low at 80 (-20%)
      { high: 87, low: 80, close: 84 },
      // Recovery
      { high: 89, low: 82, close: 87 },
      { high: 92, low: 85, close: 90 },
      { high: 95, low: 88, close: 93 },
      { high: 97, low: 91, close: 96 },
      { high: 99, low: 95, close: 98 }, // Current close 98
    ];

    const candles = createIpoCandles(prices);
    const result = evaluateIPOBase('CUPSTOCK', candles);

    expect(result.isIPOBase).toBe(true);
    expect(result.status).toBe('AT_PIVOT');
    expect(result.peakPrice).toBe(100);
    expect(result.baseLow).toBe(80);
    expect(result.depthPct).toBe(20);
    expect(result.currentClose).toBe(98);
    expect(result.description).toContain('IPO Base (At Pivot)');
  });

  it('detects an IPO Base Breakout (clearing initial high)', () => {
    // Days 1-4: Initial peak at 100
    // Days 5-10: Pullback to 82 (-18%)
    // Days 11-15: Surges past 100 to close at 103
    const prices = [
      { high: 90, low: 82, close: 88 },
      { high: 95, low: 88, close: 92 },
      { high: 100, low: 91, close: 94 }, // Peak 100
      { high: 95, low: 88, close: 89 },
      { high: 90, low: 84, close: 85 },
      { high: 86, low: 82, close: 83 }, // Low 82
      { high: 91, low: 83, close: 89 },
      { high: 96, low: 88, close: 94 },
      { high: 101, low: 93, close: 99 },
      { high: 105, low: 98, close: 103 }, // Breakout close at 103
    ];

    const candles = createIpoCandles(prices);
    const result = evaluateIPOBase('BREAKSTOCK', candles);

    expect(result.isIPOBase).toBe(true);
    expect(result.status).toBe('BREAKOUT');
    expect(result.peakPrice).toBe(100);
    expect(result.currentClose).toBe(103);
    expect(result.description).toContain('IPO Base Breakout');
  });

  it('rejects broken/collapsed listings (depth > 42%)', () => {
    // 12 trading days: Peak at 100, collapses to 48 (52% drop)
    const prices = [
      { high: 85, low: 80, close: 82 },
      { high: 90, low: 82, close: 88 },
      { high: 95, low: 88, close: 92 },
      { high: 98, low: 90, close: 95 },
      { high: 100, low: 91, close: 94 }, // Peak 100
      { high: 80, low: 70, close: 72 },
      { high: 70, low: 55, close: 58 },
      { high: 56, low: 48, close: 50 }, // Low 48 (-52%)
      { high: 58, low: 49, close: 55 },
      { high: 62, low: 52, close: 60 },
      { high: 60, low: 50, close: 52 },
      { high: 58, low: 48, close: 50 },
    ];

    const candles = createIpoCandles(prices);
    const result = evaluateIPOBase('DUMPCO', candles);

    expect(result.isIPOBase).toBe(false);
    expect(result.description).toContain('Correction too deep');
  });

  it('batch processes symbols correctly', () => {
    // 12 trading days: Peak 100, low 82 (-18%), breakout 101
    const prices = [
      { high: 85, low: 80, close: 82 },
      { high: 90, low: 82, close: 88 },
      { high: 95, low: 88, close: 92 },
      { high: 98, low: 90, close: 96 },
      { high: 100, low: 91, close: 94 }, // Peak 100
      { high: 95, low: 88, close: 89 },
      { high: 90, low: 82, close: 84 }, // Low 82
      { high: 88, low: 82, close: 85 },
      { high: 92, low: 84, close: 90 },
      { high: 95, low: 86, close: 93 },
      { high: 99, low: 90, close: 97 },
      { high: 104, low: 95, close: 101 }, // Breakout close 101
    ];
    const map = new Map<string, OHLCItem[]>();
    map.set('STOCK_A', createIpoCandles(prices));

    const batch = evaluateIPOBasesBatch(map);
    expect(batch.get('STOCK_A')?.isIPOBase).toBe(true);
  });
});
