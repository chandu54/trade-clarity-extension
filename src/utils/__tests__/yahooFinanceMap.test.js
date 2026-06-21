import { describe, it, vi, beforeEach } from 'vitest';
import { fetchStockData, fetchStockQuotes } from '../yahooFinanceMap';

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
    const symbols = Array.from({ length: 16 }, (_, i) => `S${i + 1}`); // 16 symbols, Batch size is 15
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
    
    // First batch of 15 should call fetch
    await vi.advanceTimersByTimeAsync(0); 
    expect(fetch).toHaveBeenCalledTimes(15);

    // After 100ms, the next batch should start
    await vi.advanceTimersByTimeAsync(150);
    expect(fetch).toHaveBeenCalledTimes(16);

    const result = await resultPromise;
    expect(result.length).toBe(16);
  });
});

describe('fetchStockQuotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should fetch quotes for multiple US symbols via chart API', async () => {
    const symbols = ['AAPL', 'MSFT'];
    const aaplMock = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 150.25, previousClose: 148.0, longName: 'Apple Inc.' },
          indicators: { quote: [{ close: [148, 150.25] }] },
          timestamp: [1625000000, 1625086400]
        }]
      }
    };
    const msftMock = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 320.50, previousClose: 322.0, longName: 'Microsoft Corp.' },
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
    expect(result[0].currentPrice).toBe(150.25);
    expect(result[0].prevClose).toBe(148);
    expect(result[0].isAdvancing).toBe(true);

    expect(result[1].symbol).toBe('MSFT');
    expect(result[1].currentPrice).toBe(320.50);
    expect(result[1].prevClose).toBe(322);
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
});
