import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateFundamentalHealth,
  formatLargeNumber,
  fetchStockSummary,
  globalFundamentalsCache
} from '../stockAnalysisApi';

describe('stockAnalysisApi', () => {
  beforeEach(() => {
    globalFundamentalsCache.clear();
    vi.restoreAllMocks();
  });

  describe('formatLargeNumber', () => {
    it('formats large numbers into Trillions, Billions, Millions, and Thousands for US, Lakh Cr and Cr for IN', () => {
      expect(formatLargeNumber(1.5e12, 'US')).toBe('$1.50T');
      expect(formatLargeNumber(2.3e9, 'US')).toBe('$2.30B');
      expect(formatLargeNumber(4.2e6, 'US')).toBe('$4.20M');
      expect(formatLargeNumber(1077615853568, 'IN')).toBe('₹1.08 Lakh Cr');
      expect(formatLargeNumber(50000000000, 'IN')).toBe('₹5,000 Cr');
      expect(formatLargeNumber(450, 'US')).toBe('$450.00');
    });

    it('returns N/A for invalid values', () => {
      expect(formatLargeNumber(null)).toBe('N/A');
      expect(formatLargeNumber(undefined)).toBe('N/A');
      expect(formatLargeNumber(NaN)).toBe('N/A');
    });
  });

  describe('evaluateFundamentalHealth', () => {
    it('correctly evaluates positive growth, low debt, and high ROE', () => {
      const fundamentals = {
        rawEarningsGrowth: 0.35,
        rawRevenueGrowth: 0.22,
        rawTrailingPE: 30,
        rawForwardPE: 20,
        rawROE: 0.25,
        rawDebtToEquity: 0.3
      };
      const catalysts = {
        earningsDaysAway: 20,
        earningsDate: 'Aug 15, 2026'
      };

      const result = evaluateFundamentalHealth(fundamentals, catalysts);

      expect(result.score).toBeGreaterThanOrEqual(8.0);
      expect(result.verdict).toBe('STRONG GROWTH SETUP');
      expect(result.pros.some(p => p.includes('Strong Profit Surge'))).toBe(true);
      expect(result.pros.some(p => p.includes('Top-Line Expansion'))).toBe(true);
      expect(result.pros.some(p => p.includes('High Capital Efficiency'))).toBe(true);
      expect(result.pros.some(p => p.includes('Low Debt Risk'))).toBe(true);
    });

    it('detects negative earnings growth, high debt, and imminent earnings gap risk', () => {
      const fundamentals = {
        rawEarningsGrowth: -0.15,
        rawRevenueGrowth: -0.05,
        rawDebtToEquity: 3.2
      };
      const catalysts = {
        earningsDaysAway: 3,
        earningsDate: 'Jul 29, 2026'
      };

      const result = evaluateFundamentalHealth(fundamentals, catalysts);

      expect(result.score).toBeLessThanOrEqual(4.0);
      expect(result.verdict).toBe('WEAK FUNDAMENTAL PROFILE');
      expect(result.cons.some(c => c.includes('Profit Contraction'))).toBe(true);
      expect(result.cons.some(c => c.includes('Heavy Debt Load'))).toBe(true);
      expect(result.cons.some(c => c.includes('Imminent Earnings Notice'))).toBe(true);
    });
  });

  describe('fetchStockSummary & LRU Cache', () => {
    it('returns cached data when available and valid', async () => {
      const cachedPayload = {
        symbol: 'TEST',
        country: 'US',
        fetchedAt: Date.now(),
        hasRawData: true,
        fundamentals: { marketCap: '$1.00B', quarterlyHistory: [] },
        catalysts: { newsFeed: [] }
      };

      globalFundamentalsCache.set('TEST_US', cachedPayload);

      const data = await fetchStockSummary('TEST', 'US');
      expect(data).toEqual(cachedPayload);
    });

    it('handles empty symbols gracefully', async () => {
      const data = await fetchStockSummary(null);
      expect(data).toBeNull();
    });

    it('fetches and parses stock summary data from API endpoints', async () => {
      const mockQuoteSummary = {
        quoteSummary: {
          result: [{
            summaryDetail: {
              marketCap: { raw: 5000000000, fmt: '$5.00B' },
              trailingPE: { raw: 25.4, fmt: '25.40' },
              forwardPE: { raw: 18.2, fmt: '18.20' }
            },
            financialData: {
              revenueGrowth: { raw: 0.18, fmt: '18.00%' },
              earningsGrowth: { raw: 0.25, fmt: '25.00%' },
              returnOnEquity: { raw: 0.20, fmt: '20.00%' },
              totalDebt: { raw: 100000000, fmt: '$100.00M' },
              debtToEquity: { raw: 45.2, fmt: '45.20%' }
            },
            defaultKeyStatistics: {
              priceToBook: { raw: 4.1, fmt: '4.10' },
              trailingEps: { raw: 3.5, fmt: '3.50' }
            },
            assetProfile: {
              sector: 'Technology',
              industry: 'Software'
            },
            calendarEvents: {
              earnings: {
                earningsDate: [{ raw: 1785492000 }]
              }
            }
          }]
        }
      };

      const mockNews = {
        news: [
          { uuid: '1', title: 'AAPL Great Quarter Reported', publisher: 'Reuters', providerPublishTime: 1778500000, link: 'https://news.com/1', relatedTickers: ['AAPL'] }
        ]
      };

      const mockChart = {
        chart: {
          result: [{
            events: {
              dividends: {
                d1: { amount: 0.50, date: 1778500000 }
              }
            }
          }]
        }
      };

      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('fc.yahoo.com')) {
          return Promise.resolve({
            headers: new Map([['set-cookie', 'A3=testcookie;']]),
            status: 200
          });
        }
        if (url.includes('getcrumb')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('mockcrumb')
          });
        }
        if (url.includes('quoteSummary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockQuoteSummary)
          });
        }
        if (url.includes('search')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockNews)
          });
        }
        if (url.includes('chart')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockChart)
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      }));

      const res = await fetchStockSummary('AAPL', 'US', true);

      expect(res).not.toBeNull();
      expect(res.symbol).toBe('AAPL');
      expect(res.fundamentals.marketCap).toBe('$5.00B');
      expect(res.fundamentals.peRatio).toBe('25.40');
      expect(res.fundamentals.sector).toBe('Technology');
      expect(res.catalysts.newsFeed.length).toBe(1);
      expect(res.catalysts.newsFeed[0].title).toBe('AAPL Great Quarter Reported');
    });
  });
});
