import { describe, it, expect } from 'vitest';
import {
  IPOTag,
  evaluateIPOTag,
  evaluateIPOTagsBatch,
} from '../detectYoungIPO';

describe('Stock Tagging Utility: detectYoungIPO', () => {
  function generateMockOHLC(count: number) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        date: new Date(Date.now() - (count - i) * 86400000).toISOString(),
        close: 100 + i * 0.2,
      });
    }
    return data;
  }

  it('handles null, undefined, or empty OHLC arrays gracefully', () => {
    const resultNull = evaluateIPOTag('AAPL', null as any);
    expect(resultNull.totalTradingDays).toBe(0);
    expect(resultNull.ipoTag).toBe(IPOTag.YOUNG_IPO);
    expect(resultNull.tagName).toBe('Young IPO');
    expect(resultNull.isYoungIPO).toBe(true);

    const resultUndefined = evaluateIPOTag('NVDA', undefined);
    expect(resultUndefined.totalTradingDays).toBe(0);
    expect(resultUndefined.ipoTag).toBe(IPOTag.YOUNG_IPO);
    expect(resultUndefined.isYoungIPO).toBe(true);

    const resultEmpty = evaluateIPOTag('MSFT', []);
    expect(resultEmpty.totalTradingDays).toBe(0);
    expect(resultEmpty.ipoTag).toBe(IPOTag.YOUNG_IPO);
    expect(resultEmpty.isYoungIPO).toBe(true);
  });

  it('classifies stocks with < 60 trading days as YOUNG_IPO', () => {
    const ohlc45 = generateMockOHLC(45);
    const result = evaluateIPOTag('TATATECH', ohlc45);

    expect(result.symbol).toBe('TATATECH');
    expect(result.totalTradingDays).toBe(45);
    expect(result.ipoTag).toBe(IPOTag.YOUNG_IPO);
    expect(result.tagName).toBe('Young IPO');
    expect(result.isYoungIPO).toBe(true);
    expect(result.isRecentListing).toBe(false);
    expect(result.isEstablished).toBe(false);
  });

  it('classifies stocks with >= 60 and < 250 trading days as RECENT_LISTING', () => {
    const ohlc150 = generateMockOHLC(150);
    const result = evaluateIPOTag('JSWINFRA', ohlc150);

    expect(result.symbol).toBe('JSWINFRA');
    expect(result.totalTradingDays).toBe(150);
    expect(result.ipoTag).toBe(IPOTag.RECENT_LISTING);
    expect(result.tagName).toBe('Recent Listing');
    expect(result.isYoungIPO).toBe(false);
    expect(result.isRecentListing).toBe(true);
    expect(result.isEstablished).toBe(false);
  });

  it('classifies stocks with >= 250 trading days as ESTABLISHED', () => {
    const ohlc300 = generateMockOHLC(300);
    const result = evaluateIPOTag('RELIANCE', ohlc300);

    expect(result.symbol).toBe('RELIANCE');
    expect(result.totalTradingDays).toBe(300);
    expect(result.ipoTag).toBe(IPOTag.ESTABLISHED);
    expect(result.tagName).toBe('Established');
    expect(result.isYoungIPO).toBe(false);
    expect(result.isRecentListing).toBe(false);
    expect(result.isEstablished).toBe(true);
  });

  it('batch evaluates a Map of ticker symbols correctly', () => {
    const dataMap = new Map();
    dataMap.set('YOUNG_STOCK', generateMockOHLC(30));
    dataMap.set('RECENT_STOCK', generateMockOHLC(100));
    dataMap.set('OLD_STOCK', generateMockOHLC(350));

    const resultMap = evaluateIPOTagsBatch(dataMap);

    expect(resultMap).toBeInstanceOf(Map);
    expect(resultMap.size).toBe(3);

    expect(resultMap.get('YOUNG_STOCK')?.isYoungIPO).toBe(true);
    expect(resultMap.get('RECENT_STOCK')?.isRecentListing).toBe(true);
    expect(resultMap.get('OLD_STOCK')?.isEstablished).toBe(true);
  });
});
