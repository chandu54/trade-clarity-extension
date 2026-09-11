import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseUsListingDate,
  formatUsListingDate,
  normalizeUsExchange,
  isCommonEquitySymbol,
  getPast12MonthKeys,
  parseNasdaqIpoRows,
  calculateUsIpoMetrics,
  fetchUsIpoDirectory
} from '../usIpoService';

describe('usIpoService', () => {
  describe('parseUsListingDate', () => {
    it('parses valid US M/D/YYYY dates correctly', () => {
      const d1 = parseUsListingDate('3/21/2024');
      expect(d1).toBeInstanceOf(Date);
      expect(d1?.getUTCFullYear()).toBe(2024);
      expect(d1?.getUTCMonth()).toBe(2); // 0-indexed: MAR is 2
      expect(d1?.getUTCDate()).toBe(21);

      const d2 = parseUsListingDate('08/29/2024');
      expect(d2?.getUTCMonth()).toBe(7); // AUG is 7
      expect(d2?.getUTCDate()).toBe(29);
    });

    it('returns null for invalid or empty dates', () => {
      expect(parseUsListingDate('')).toBeNull();
      expect(parseUsListingDate(null)).toBeNull();
      expect(parseUsListingDate('invalid')).toBeNull();
    });
  });

  describe('formatUsListingDate', () => {
    it('formats Date object to standard DD-MMM-YYYY', () => {
      const d = new Date(Date.UTC(2024, 2, 21));
      expect(formatUsListingDate(d)).toBe('21-MAR-2024');
    });
  });

  describe('normalizeUsExchange', () => {
    it('maps diverse exchange names to standard NASDAQ, NYSE, AMEX', () => {
      expect(normalizeUsExchange('NASDAQ Global Select')).toBe('NASDAQ');
      expect(normalizeUsExchange('NASDAQ Capital')).toBe('NASDAQ');
      expect(normalizeUsExchange('NYSE')).toBe('NYSE');
      expect(normalizeUsExchange('NYSE American')).toBe('AMEX');
      expect(normalizeUsExchange('AMEX')).toBe('AMEX');
      expect(normalizeUsExchange('CBOE')).toBe('CBOE');
    });
  });

  describe('isCommonEquitySymbol', () => {
    it('filters out warrants and units while keeping common stocks', () => {
      expect(isCommonEquitySymbol('RDDT')).toBe(true);
      expect(isCommonEquitySymbol('ARM')).toBe(true);
      expect(isCommonEquitySymbol('CAVA')).toBe(true);
      expect(isCommonEquitySymbol('GIGGU')).toBe(false); // Unit
      expect(isCommonEquitySymbol('SPAIW')).toBe(false); // Warrant
      expect(isCommonEquitySymbol('ABCWS')).toBe(false); // Warrant
    });
  });

  describe('getPast12MonthKeys', () => {
    it('generates 13 consecutive YYYY-MM strings ending at current month', () => {
      const keys = getPast12MonthKeys();
      expect(keys.length).toBe(13);
      expect(keys[0]).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('parseNasdaqIpoRows', () => {
    it('filters within 365 days window and normalizes fields', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 25 * 86400000);
      const recentStr = `${recentDate.getUTCMonth() + 1}/${recentDate.getUTCDate()}/${recentDate.getUTCFullYear()}`;

      const oldDate = new Date(now.getTime() - 400 * 86400000);
      const oldStr = `${oldDate.getUTCMonth() + 1}/${oldDate.getUTCDate()}/${oldDate.getUTCFullYear()}`;

      const rows = [
        {
          proposedTickerSymbol: 'RDDT',
          companyName: 'Reddit, Inc.',
          proposedExchange: 'NYSE',
          pricedDate: recentStr
        },
        {
          proposedTickerSymbol: 'OLDUS',
          companyName: 'Old Corp',
          proposedExchange: 'NASDAQ Global',
          pricedDate: oldStr
        },
        {
          proposedTickerSymbol: 'SPACU', // unit - should be filtered
          companyName: 'SPAC Unit Corp',
          proposedExchange: 'NASDAQ Capital',
          pricedDate: recentStr
        }
      ];

      const results = parseNasdaqIpoRows(rows);
      expect(results.length).toBe(1);
      expect(results[0].symbol).toBe('RDDT');
      expect(results[0].series).toBe('NYSE');
      expect(results[0].defaultTag).toBe('Young IPO');
    });
  });

  describe('calculateUsIpoMetrics', () => {
    it('formats prices with $ and liquidity in millions USD', () => {
      const stock = {
        symbol: 'RDDT',
        name: 'Reddit, Inc.',
        series: 'NYSE',
        listingDateStr: '21-MAR-2024',
        listingTimestamp: Date.now() - 20 * 86400000,
        daysAgo: 20,
        defaultTag: 'Young IPO'
      };

      const candles = [
        { open: 34.0, high: 50.0, low: 33.0, close: 46.0, volume: 1000000 },
        { open: 46.0, high: 55.0, low: 45.0, close: 50.0, volume: 1200000 },
        { open: 50.0, high: 52.0, low: 48.0, close: 51.5, volume: 800000 }
      ];

      const hydrated = calculateUsIpoMetrics(stock, candles);
      expect(hydrated.price).toBe('$51.50');
      expect(hydrated.dailyChangePct).toMatch(/^[+-]?\d+\.\d{2}%$/);
      expect(hydrated.adr).toMatch(/%/);
      expect(hydrated.liquidity).toMatch(/\$|M|K/);
      expect(hydrated.listingDayGainPct).toBe('+35.3%');
      expect(hydrated.gainSinceListingPct).toBe('+12.0%');
    });
  });

  describe('fetchUsIpoDirectory caching', () => {
    beforeEach(() => {
      global.chrome = {
        storage: {
          local: {
            get: vi.fn().mockImplementation((keys, cb) => cb({})),
            set: vi.fn().mockImplementation((obj, cb) => cb && cb())
          }
        }
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { priced: { rows: [] } } })
      });
    });

    it('uses cached directory if available and fresh', async () => {
      const cachedData = [
        {
          symbol: 'CAVA',
          name: 'CAVA Group Inc',
          series: 'NYSE',
          listingDateStr: '15-JUN-2023',
          daysAgo: 100
        }
      ];

      global.chrome.storage.local.get.mockImplementation((keys, cb) => {
        cb({
          us_ipo_directory_cache: {
            timestamp: Date.now() - 1000,
            data: cachedData
          }
        });
      });

      const directory = await fetchUsIpoDirectory(false);
      expect(directory).toEqual(cachedData);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
