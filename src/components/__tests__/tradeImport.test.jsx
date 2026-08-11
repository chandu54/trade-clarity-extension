import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeNumber,
  normalizeSymbol,
  parseCSVToRows,
  findHeaderRowIndex,
  parseZerodhaTradebook,
  parseZerodhaPnLStatement
} from '../../utils/tradeImportParser';
import { matchExecutionsToPositions, calculateHoldingDays } from '../../utils/fifoPositionMatcher';

describe('Trade Import Utilities', () => {
  describe('Sanitization & Security', () => {
    it('strips script tags and prevents CSV injection formulas', () => {
      expect(sanitizeString('<script>alert("xss")</script>RELIANCE')).toBe('RELIANCE');
      expect(sanitizeString('=CMD|"/C calc"!A0')).toBe("'CMD|\"/C calc\"!A0");
      expect(sanitizeString('+12345')).toBe("'12345");
    });

    it('sanitizes numeric values safely', () => {
      expect(sanitizeNumber('1,294.80')).toBe(1294.8);
      expect(sanitizeNumber('₹ 45,729.60')).toBe(45729.6);
      expect(sanitizeNumber('invalid', 10)).toBe(10);
    });

    it('normalizes Indian stock symbols by stripping company suffixes', () => {
      expect(normalizeSymbol('RELIANCE INDUSTRIES LTD')).toBe('RELIANCE');
      expect(normalizeSymbol('TATAMOTORS - EQ')).toBe('TATAMOTORS');
      expect(normalizeSymbol('INFY.NS')).toBe('INFY');
    });
  });

  describe('Zerodha Tradebook CSV Parser', () => {

    it('scans header row past metadata lines and parses raw execution logs', () => {
      const mockZerodhaCSV = `Client ID	ARS697

Tradebook for Equity from 2026-07-11 to 2026-08-11

Symbol,ISIN,Trade Date,Exchange,Segment,Series,Trade Type,Auction,Quantity,Price,Trade ID,Order ID,Order Execution Time
HFCL,INE548A01028,2026-07-16,NSE,EQ,EQ,buy,FALSE,1,227.74,200460833,11000000311182,2026-07-16T09:18:30
HFCL,INE548A01028,2026-07-16,NSE,EQ,EQ,buy,FALSE,99,227.77,200460834,11000000311182,2026-07-16T09:18:30
HFCL,INE548A01028,2026-07-17,NSE,EQ,EQ,sell,FALSE,100,218.66,200038989,11000000003027,2026-07-17T09:15:01`;

      const rows = parseCSVToRows(mockZerodhaCSV);
      const headerIdx = findHeaderRowIndex(rows);
      expect(headerIdx).toBe(2);

      const parsed = parseZerodhaTradebook(rows, headerIdx);
      expect(parsed).not.toBeNull();
      expect(parsed.type).toBe('executions');
      expect(parsed.data.length).toBe(3);
      expect(parsed.data[0].symbol).toBe('HFCL');
      expect(parsed.data[0].qty).toBe(1);
      expect(parsed.data[1].qty).toBe(99);
      expect(parsed.data[2].type).toBe('Sell');
    });

  });

  describe('Zerodha Tax P&L Statement Parser', () => {

    it('parses summary P&L tables directly into trade position objects', () => {
      const mockPnlCSV = `Central GST - Z	0
State GST - Z	0

Symbol,ISIN,Quantity,Buy Value,Sell Value,Realized P&L,Realized P&L Pct,Previous Closing,Open Quantity
ADANIPOWER,INE814H01029,200,47420,49249.05,1829.05,3.8571,0,0
ATHERENERG,INE0LEZ01016,371,371759.85,363812.7,-7947.15,-2.1377,1466.2,15`;

      const rows = parseCSVToRows(mockPnlCSV);
      const headerIdx = findHeaderRowIndex(rows);
      const parsed = parseZerodhaPnLStatement(rows, headerIdx);

      expect(parsed).not.toBeNull();
      expect(parsed.type).toBe('positions');
      expect(parsed.data.length).toBe(2);

      const adani = parsed.data[0];
      expect(adani.symbol).toBe('ADANIPOWER');
      expect(adani.isClosed).toBe(true);
      expect(adani.avgEntryPrice).toBe(237.1);
      expect(adani.realizedPnL).toBe(1829.05);

      const ather = parsed.data[1];
      expect(ather.symbol).toBe('ATHERENERG');
      expect(ather.isClosed).toBe(false);
      expect(ather.openQty).toBe(15);
    });

  });

  describe('FIFO Position Matcher', () => {

    it('consolidates multi-fill buy & sell executions into completed closed positions', () => {
      const executions = [
        { symbol: 'HFCL', type: 'Buy', qty: 1, price: 227.74, date: '2026-07-16' },
        { symbol: 'HFCL', type: 'Buy', qty: 99, price: 227.77, date: '2026-07-16' },
        { symbol: 'HFCL', type: 'Sell', qty: 100, price: 218.66, date: '2026-07-17' }
      ];

      const positions = matchExecutionsToPositions(executions, {
        defaultRiskPct: 0.05,
        defaultSetup: 'VCP Breakout',
        excludeEtfs: true
      });

      expect(positions.length).toBe(1);
      const pos = positions[0];
      expect(pos.symbol).toBe('HFCL');
      expect(pos.isClosed).toBe(true);
      expect(pos.totalBought).toBe(100);
      expect(pos.totalSold).toBe(100);
      expect(pos.avgEntryPrice).toBeCloseTo(227.767, 2);
      expect(pos.avgExitPrice).toBe(218.66);
      expect(pos.realizedPnL).toBeCloseTo(-910.97, 2);
      expect(pos.holdingDays).toBe(1);
      expect(pos.initialStopLoss).toBeCloseTo(216.38, 1);
    });

    it('calculates holding period in days accurately', () => {
      expect(calculateHoldingDays('2026-07-15', '2026-07-20')).toBe(5);
      expect(calculateHoldingDays('2026-07-15', '2026-07-15')).toBe(0);
    });

    it('excludes cash/liquid ETFs when excludeEtfs option is true', () => {
      const executions = [
        { symbol: 'LIQUIDCASE', type: 'Buy', qty: 200, price: 115.34, date: '2026-08-06' },
        { symbol: 'RELIANCE', type: 'Buy', qty: 10, price: 3000, date: '2026-08-06' }
      ];

      const positions = matchExecutionsToPositions(executions, { excludeEtfs: true });
      expect(positions.length).toBe(1);
      expect(positions[0].symbol).toBe('RELIANCE');
    });

  });
});
