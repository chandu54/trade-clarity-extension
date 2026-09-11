import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseNseListingDate,
  parseNseCsv,
  fetchNseIpoDirectory
} from '../nseIpoService';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDateToNse(d) {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

describe('nseIpoService', () => {
  describe('parseNseListingDate', () => {
    it('parses valid NSE listing dates correctly', () => {
      const d1 = parseNseListingDate('16-SEP-2024');
      expect(d1).toBeInstanceOf(Date);
      expect(d1?.getUTCFullYear()).toBe(2024);
      expect(d1?.getUTCMonth()).toBe(8); // 0-indexed: SEP is 8
      expect(d1?.getUTCDate()).toBe(16);

      const d2 = parseNseListingDate('03-OCT-2024');
      expect(d2?.getUTCMonth()).toBe(9); // OCT is 9
      expect(d2?.getUTCDate()).toBe(3);
    });

    it('returns null for invalid or empty dates', () => {
      expect(parseNseListingDate('')).toBeNull();
      expect(parseNseListingDate(null)).toBeNull();
      expect(parseNseListingDate('invalid-date')).toBeNull();
    });
  });

  describe('parseNseCsv', () => {
    it('parses CSV rows and filters within 365 days window', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 20 * 86400000);
      const recentStr = formatDateToNse(recentDate);
      
      const oldDate = new Date(now.getTime() - 500 * 86400000);
      const oldStr = formatDateToNse(oldDate);

      const csvContent = `SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE
BAJAJHFL,Bajaj Housing Finance Limited,EQ,${recentStr},10
OLDSTOCK,Old Company Limited,EQ,${oldStr},10`;

      const results = parseNseCsv(csvContent, false);
      expect(results.length).toBe(1);
      expect(results[0].symbol).toBe('BAJAJHFL');
      expect(results[0].name).toBe('Bajaj Housing Finance Limited');
      expect(results[0].series).toBe('EQ');
      expect(results[0].daysAgo).toBeLessThanOrEqual(30);
      expect(results[0].defaultTag).toBe('Young IPO');
    });

    it('handles quoted company names containing commas', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 15 * 86400000);
      const recentStr = formatDateToNse(recentDate);

      const csvContent = `SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING
"KRN","KRN Heat Exchanger, Refrigeration Limited",EQ,${recentStr}`;

      const results = parseNseCsv(csvContent, false);
      expect(results.length).toBe(1);
      expect(results[0].symbol).toBe('KRN');
      expect(results[0].name).toBe('KRN Heat Exchanger, Refrigeration Limited');
    });
  });

  describe('fetchNseIpoDirectory', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches and merges mainboard and SME directories, sorted descending by date', async () => {
      const now = new Date();
      const date1 = new Date(now.getTime() - 10 * 86400000);
      const date1Str = formatDateToNse(date1);
      const date2 = new Date(now.getTime() - 20 * 86400000);
      const date2Str = formatDateToNse(date2);

      const mockMainCsv = `SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING
STOCK_A,Stock Alpha Limited,EQ,${date2Str}`;

      const mockSmeCsv = `SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING
STOCK_B,Stock Beta SME Limited,SM,${date1Str}`;

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('SME')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(mockSmeCsv) });
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve(mockMainCsv) });
      });

      const directory = await fetchNseIpoDirectory(true);

      expect(directory.length).toBe(2);
      // Newest should be first (STOCK_B was 10 days ago, STOCK_A was 20 days ago)
      expect(directory[0].symbol).toBe('STOCK_B');
      expect(directory[1].symbol).toBe('STOCK_A');
    });
  });
});
