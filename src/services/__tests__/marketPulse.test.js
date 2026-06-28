import { describe, it, vi, beforeEach, expect } from 'vitest';
import { fetchMarketPulseData, generateTechnicalThesis } from '../marketPulse';
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
});
