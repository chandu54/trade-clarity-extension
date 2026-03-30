import { describe, it, vi, beforeEach } from 'vitest';
import { fetchStockData } from '../yahooFinanceMap';

// Mock fetch
global.fetch = vi.fn();

describe('fetchStockData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  const mockResponse = (ok, data) => ({
    ok,
    json: async () => data,
    status: ok ? 200 : 404,
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
    const symbols = ['RELIANCE'];
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
      expect.stringContaining('RELIANCE.NS'),
      expect.any(Object)
    );
  });

  it('should handle fetch errors gracefully', async () => {
    const symbols = ['INVALID'];
    fetch.mockResolvedValueOnce(mockResponse(false, {}));

    const result = await fetchStockData(symbols, 'US');
    expect(result).toEqual([]); // Should filter out errors
  });

  it('should process in batches and respect delay', async () => {
    const symbols = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']; // 6 symbols, Batch size is 5
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
    
    // First batch of 5 should call fetch
    await vi.advanceTimersByTimeAsync(0); 
    expect(fetch).toHaveBeenCalledTimes(5);

    // After 500ms, the next batch should start
    await vi.advanceTimersByTimeAsync(600);
    expect(fetch).toHaveBeenCalledTimes(6);

    const result = await resultPromise;
    expect(result.length).toBe(6);
  });
});
