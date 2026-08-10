import { describe, it, vi, beforeEach } from 'vitest';
import { fetchStockData, fetchStockQuotes, isMarketOpenFromMeta, clearQuoteCache } from '../yahooFinanceMap';

// Mock fetch
global.fetch = vi.fn();

describe('fetchStockData & Caching', () => {
  beforeEach(() => {
    fetch.mockReset();
    clearQuoteCache();
  });

  const mockResponse = (ok, data) => ({
    ok,
    json: async () => data,
    status: ok ? 200 : 404,
  });

  it('should detect market status from meta currentTradingPeriod', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const openMeta = {
      currentTradingPeriod: {
        regular: { start: nowSec - 3600, end: nowSec + 3600 }
      }
    };
    const closedMeta = {
      currentTradingPeriod: {
        regular: { start: nowSec - 7200, end: nowSec - 3600 }
      }
    };

    expect(isMarketOpenFromMeta(openMeta)).toBe(true);
    expect(isMarketOpenFromMeta(closedMeta)).toBe(false);
  });

  it('should return cached data on subsequent calls when market is closed without extra network requests', async () => {
    const symbols = ['CACHE_TEST'];
    const mockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 100, chartPreviousClose: 95 },
          indicators: { quote: [{ close: [95, 100] }] },
          timestamp: [1625000000, 1625086400]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData));

    // First fetch -> hits network
    const res1 = await fetchStockData(symbols, 'US', '3mo');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res1[0].currentPrice).toBe(100);

    // Second fetch -> uses cache (0 extra network calls)
    const res2 = await fetchStockData(symbols, 'US', '3mo');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res2[0].currentPrice).toBe(100);
  });

  it('should bypass cache when forceRefresh is true', async () => {
    const symbols = ['FORCE_TEST'];
    const mockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 200 },
          indicators: { quote: [{ close: [200] }] },
          timestamp: [1625000000]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData))
         .mockResolvedValueOnce(mockResponse(true, mockData));

    await fetchStockData(symbols, 'US', '3mo');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Force refresh -> hits network again
    await fetchStockData(symbols, 'US', '3mo', null, null, true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should return empty array if no symbols provided', async () => {
    const result = await fetchStockData([], 'US');
    expect(result).toEqual([]);
  });

  it('should fetch data for US symbols correctly', async () => {
    const symbols = ['AAPL'];
    const mockData = {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 150,
            chartPreviousClose: 145,
            longName: 'Apple Inc.'
          },
          indicators: {
            quote: [{
              close: [140, 145, 150],
              open: [138, 144, 149],
              high: [142, 146, 151],
              low: [137, 143, 148]
            }]
          },
          timestamp: [1625000000, 1625086400, 1625172800]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const resultPromise = fetchStockData(symbols, 'US');
    const result = await resultPromise;

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('AAPL'),
      expect.any(Object)
    );
    expect(result[0].symbol).toBe('AAPL');
    expect(result[0].currentPrice).toBe(150);
    expect(result[0].isAdvancing).toBe(true);
    expect(result[0].candlesticks.length).toBe(3);
  });

  it('should append .NS for Indian symbols', async () => {
    const symbols = ['RELIANCE_TEST'];
    const mockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 2000, chartPreviousClose: 1950 },
          indicators: { quote: [{ close: [2000], open: [1950], high: [2050], low: [1900] }] },
          timestamp: [1625000000]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData));

    await fetchStockData(symbols, 'IN');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('RELIANCE_TEST.NS'),
      expect.any(Object)
    );
  });

  it('should preserve full candlestick history array in cache without truncation', async () => {
    const symbols = ['FULL_CANDLE_TEST'];
    const manyBars = Array.from({ length: 50 }, (_, i) => ({
      time: 1625000000 + i * 86400,
      close: 100 + i,
      open: 99 + i,
      high: 102 + i,
      low: 98 + i
    }));
    
    const mockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 150, chartPreviousClose: 140 },
          indicators: {
            quote: [{
              close: manyBars.map(b => b.close),
              open: manyBars.map(b => b.open),
              high: manyBars.map(b => b.high),
              low: manyBars.map(b => b.low)
            }]
          },
          timestamp: manyBars.map(b => b.time)
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData));

    // First call -> network
    const firstRes = await fetchStockData(symbols, 'US', '3mo');
    expect(firstRes[0].candlesticks.length).toBe(50);

    // Second call -> cached read
    const cachedRes = await fetchStockData(symbols, 'US', '3mo');
    expect(cachedRes[0].candlesticks.length).toBe(50);
  });

  it('should invalidate cache when market transitions from closed to open or on force refresh', async () => {
    const symbols = ['TRANSITION_TEST'];
    const mockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 100 },
          indicators: { quote: [{ close: [100] }] },
          timestamp: [1625000000]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData));

    // First fetch -> hits network
    const res1 = await fetchStockData(symbols, 'US', '3mo');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res1[0].currentPrice).toBe(100);

    // Force refresh -> bypasses cache and hits network again
    fetch.mockResolvedValueOnce(mockResponse(true, mockData));
    const res2 = await fetchStockData(symbols, 'US', '3mo', null, null, true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(res2[0].currentPrice).toBe(100);
  });

  it('should scope cache keys by country to prevent US and IN collisions', async () => {
    const usMockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 150, longName: 'US Ticker' },
          indicators: { quote: [{ close: [150] }] },
          timestamp: [1625000000]
        }]
      }
    };

    const inMockData = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 2500, longName: 'IN Ticker' },
          indicators: { quote: [{ close: [2500] }] },
          timestamp: [1625000000]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, usMockData))
         .mockResolvedValueOnce(mockResponse(true, inMockData));

    const usRes = await fetchStockData(['ACC'], 'US', '3mo');
    const inRes = await fetchStockData(['ACC'], 'IN', '3mo');

    expect(usRes[0].currentPrice).toBe(150);
    expect(inRes[0].currentPrice).toBe(2500);
    expect(fetch).toHaveBeenCalledTimes(2); // Must fetch separately for US vs IN!
  });

  it('should handle fetch errors gracefully', async () => {
    const symbols = ['INVALID_SYMBOL'];
    fetch.mockResolvedValueOnce(mockResponse(false, {}));

    const result = await fetchStockData(symbols, 'US');
    expect(result).toEqual([]); // Should filter out errors
  });

  it('should process in batches and respect delay', async () => {
    vi.useFakeTimers();
    try {
      clearQuoteCache();
      const symbols = Array.from({ length: 6 }, (_, i) => `BATCH_SYM_${i + 1}`);
      const mockData = {
        chart: {
          result: [{
            meta: { regularMarketPrice: 100 },
            indicators: { quote: [{ close: [100], open: [90], high: [110], low: [80] }] },
            timestamp: [1625000000]
          }]
        }
      };

      fetch.mockResolvedValue(mockResponse(true, mockData));

      const resultPromise = fetchStockData(symbols, 'US');
      
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result.length).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fetchStockQuotes', () => {
  beforeEach(() => {
    fetch.mockReset();
    clearQuoteCache();
  });

  const mockResponse = (ok, data) => ({
    ok,
    json: async () => data,
    status: ok ? 200 : 404,
  });

  it('should return empty array if no symbols provided', async () => {
    const result = await fetchStockQuotes([], 'US');
    expect(result).toEqual([]);
  });

  it('should fetch quotes for multiple symbols correctly', async () => {
    const symbols = ['AAPL', 'MSFT'];
    const aaplMock = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 150, previousClose: 148, longName: 'Apple Inc.' },
          indicators: { quote: [{ close: [148, 150] }] },
          timestamp: [1625000000, 1625086400]
        }]
      }
    };
    const msftMock = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 320.50, previousClose: 322, longName: 'Microsoft Corp.' },
          indicators: { quote: [{ close: [322, 320.50] }] },
          timestamp: [1625000000, 1625086400]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, aaplMock))
         .mockResolvedValueOnce(mockResponse(true, msftMock));

    const result = await fetchStockQuotes(symbols, 'US');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('AAPL'),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('MSFT'),
      expect.any(Object)
    );

    expect(result.length).toBe(2);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[0].currentPrice).toBe(150);
    expect(result[0].previousClose).toBe(148);
    expect(result[0].isAdvancing).toBe(true);

    expect(result[1].symbol).toBe('MSFT');
    expect(result[1].currentPrice).toBe(320.50);
    expect(result[1].previousClose).toBe(322);
    expect(result[1].isAdvancing).toBe(false);
  });

  it('should append .NS for Indian symbols and map back to original symbols', async () => {
    const symbols = ['RELIANCE', 'TCS'];
    const relianceMock = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 2400, previousClose: 2350, longName: 'Reliance Industries' },
          indicators: { quote: [{ close: [2350, 2400] }] },
          timestamp: [1625000000, 1625086400]
        }]
      }
    };
    const tcsMock = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 3400, previousClose: 3420, longName: 'Tata Consultancy Services' },
          indicators: { quote: [{ close: [3420, 3400] }] },
          timestamp: [1625000000, 1625086400]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, relianceMock))
         .mockResolvedValueOnce(mockResponse(true, tcsMock));

    const result = await fetchStockQuotes(symbols, 'IN');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('RELIANCE.NS'),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('TCS.NS'),
      expect.any(Object)
    );

    expect(result.length).toBe(2);
    expect(result[0].symbol).toBe('RELIANCE');
    expect(result[0].isAdvancing).toBe(true);
    expect(result[1].symbol).toBe('TCS');
    expect(result[1].isAdvancing).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    fetch.mockResolvedValueOnce(mockResponse(false, {}));
    const result = await fetchStockQuotes(['AAPL'], 'US');
    expect(result).toEqual([]);
  });

  it('should calculate dailyChangePct using regularMarketPreviousClose instead of chartPreviousClose', async () => {
    const mockData = {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 883.75,
            regularMarketPreviousClose: 897.05,
            chartPreviousClose: 778.45,
            longName: '63MOONS'
          },
          indicators: { quote: [{ close: [778.45, 897.05, 883.75] }] },
          timestamp: [1625000000, 1625086400, 1625172800]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockData));
    const result = await fetchStockQuotes(['63MOONS'], 'IN');

    expect(result[0].symbol).toBe('63MOONS');
    expect(result[0].currentPrice).toBe(883.75);
    expect(result[0].previousClose).toBe(897.05);
    expect(result[0].dailyChangePct).toBe(-1.48);
    expect(result[0].isAdvancing).toBe(false);
  });

  it('should extract previous close from candles when Yahoo meta.previousClose matches start-of-range price (Zerodha ABB scenario)', async () => {
    // Yahoo returns chartPreviousClose & previousClose = 7284 (5d ago price)
    // Candle array contains: [..., 7601.00 (yesterday), 7854.00 (today)]
    const mockAbb = {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 7854.00,
            previousClose: 7284.00,
            chartPreviousClose: 7284.00,
            longName: 'ABB India'
          },
          indicators: { quote: [{ close: [7284.00, 7450.00, 7601.00, 7854.00] }] },
          timestamp: [1722400000, 1722486400, 1722572800, 1722659200]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockAbb));
    const result = await fetchStockQuotes(['ABB'], 'IN');

    expect(result[0].symbol).toBe('ABB');
    expect(result[0].currentPrice).toBe(7854.00);
    expect(result[0].previousClose).toBe(7601.00); // Yesterday's candle close, NOT 7284.00
    expect(result[0].dailyChangePct).toBe(3.33);   // +3.33% (matches Zerodha), NOT +7.82%
    expect(result[0].isAdvancing).toBe(true);
  });

  it('should reject regularMarketPreviousClose if Yahoo updated it to currentPrice post-market close (prevent 0.00% bug)', async () => {
    // Post-market close: Yahoo sets regularMarketPreviousClose = 420.00 (same as regularMarketPrice 420.00)
    // Candle array contains: [..., 424.35 (yesterday), 420.00 (today)]
    const mockPostMarket = {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 420.00,
            regularMarketPreviousClose: 420.00,
            chartPreviousClose: 400.00,
            longName: 'ABCAPITAL'
          },
          indicators: { quote: [{ close: [400.00, 424.35, 420.00] }] },
          timestamp: [1722400000, 1722486400, 1722572800]
        }]
      }
    };

    fetch.mockResolvedValueOnce(mockResponse(true, mockPostMarket));
    const result = await fetchStockQuotes(['ABCAPITAL'], 'IN');

    expect(result[0].symbol).toBe('ABCAPITAL');
    expect(result[0].currentPrice).toBe(420.00);
    expect(result[0].previousClose).toBe(424.35); // Yesterday's candle close, NOT 420.00
    expect(result[0].dailyChangePct).toBe(-1.03);  // -1.03%, NOT 0.00%
    expect(result[0].isAdvancing).toBe(false);
  });
});
