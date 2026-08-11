import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  parseCSVToRows,
  autoDetectAndParseCSV,
  convertWorkbookToCSV
} from '../../utils/tradeImportParser';
import { matchExecutionsToPositions } from '../../utils/fifoPositionMatcher';

describe('Trade Import Business Logic & Trading Domain Edge Cases', () => {

  describe('1. Weighted Average Cost Basis & Pyramiding (Scale-Ins)', () => {
    it('calculates weighted average entry price across multiple scale-in buys at different prices', () => {
      const executions = [
        { symbol: 'RELIANCE', type: 'Buy', qty: 50, price: 1000, date: '2026-07-01' },
        { symbol: 'RELIANCE', type: 'Buy', qty: 50, price: 1200, date: '2026-07-05' },
        { symbol: 'RELIANCE', type: 'Sell', qty: 100, price: 1300, date: '2026-07-10' }
      ];

      const positions = matchExecutionsToPositions(executions, { defaultRiskPct: 0.05 });
      expect(positions.length).toBe(1);

      const pos = positions[0];
      expect(pos.symbol).toBe('RELIANCE');
      expect(pos.totalBought).toBe(100);
      expect(pos.totalSold).toBe(100);
      expect(pos.isClosed).toBe(true);

      // Weighted Avg Entry: (50*1000 + 50*1200)/100 = 1100
      expect(pos.avgEntryPrice).toBe(1100);
      expect(pos.avgExitPrice).toBe(1300);

      // Realized PnL: (1300 - 1100) * 100 = 20,000
      expect(pos.realizedPnL).toBe(20000);
      expect(pos.pnlPct).toBeCloseTo(18.18, 1);
    });
  });

  describe('2. Partial Scale-Out Sells across Multiple Dates', () => {
    it('keeps position ACTIVE when partially sold and updates position status to CLOSED when remaining shares are sold', () => {
      const partialExecutions = [
        { symbol: 'TATASTEEL', type: 'Buy', qty: 100, price: 500, date: '2026-07-01' },
        { symbol: 'TATASTEEL', type: 'Sell', qty: 40, price: 550, date: '2026-07-05' }
      ];

      const activePosList = matchExecutionsToPositions(partialExecutions);
      expect(activePosList.length).toBe(1);
      const activePos = activePosList[0];

      // Position should still be OPEN with 60 openQty
      expect(activePos.isClosed).toBe(false);
      expect(activePos.openQty).toBe(60);
      expect(activePos.totalBought).toBe(100);
      expect(activePos.totalSold).toBe(40);
      expect(activePos.realizedPnL).toBe(2000); // 40 * (550 - 500)

      // Now sell remaining 60 shares
      const fullExecutions = [
        ...partialExecutions,
        { symbol: 'TATASTEEL', type: 'Sell', qty: 60, price: 600, date: '2026-07-10' }
      ];

      const closedPosList = matchExecutionsToPositions(fullExecutions);
      expect(closedPosList.length).toBe(1);
      const closedPos = closedPosList[0];

      expect(closedPos.isClosed).toBe(true);
      expect(closedPos.openQty).toBe(0);
      expect(closedPos.totalSold).toBe(100);

      // Total proceeds: (40*550 + 60*600) = 22000 + 36000 = 58000
      // Total cost: 100 * 500 = 50000 -> Realized PnL = 8000
      expect(closedPos.realizedPnL).toBe(8000);
      expect(closedPos.holdingDays).toBe(9); // 2026-07-01 to 2026-07-10
    });
  });

  describe('3. R-Multiple & Initial Risk Analytics Business Logic', () => {
    it('calculates exact +3.00 R winner when trade achieves 3x risk target', () => {
      const executions = [
        { symbol: 'INFY', type: 'Buy', qty: 100, price: 100, date: '2026-07-01' },
        { symbol: 'INFY', type: 'Sell', qty: 100, price: 130, date: '2026-07-10' }
      ];

      // Risk = 10% (Stop Loss = 90, Risk per share = 10)
      const positions = matchExecutionsToPositions(executions, { defaultRiskPct: 0.10 });
      const pos = positions[0];

      expect(pos.initialStopLoss).toBe(90);
      // Risk = 100 * 10 = 1000. Realized PnL = 3000. R-Multiple = 3000 / 1000 = 3.00 R
      expect(pos.rMultiple).toBe(3);
    });

    it('calculates negative R-multiple for a stopped-out loss trade', () => {
      const executions = [
        { symbol: 'INFY', type: 'Buy', qty: 100, price: 100, date: '2026-07-01' },
        { symbol: 'INFY', type: 'Sell', qty: 100, price: 90, date: '2026-07-03' }
      ];

      const positions = matchExecutionsToPositions(executions, { defaultRiskPct: 0.05 });
      const pos = positions[0];

      expect(pos.initialStopLoss).toBe(95); // 5% risk = 95
      // Risk per share = 5. Loss per share = -10. R-Multiple = -10 / 5 = -2.00 R
      expect(pos.rMultiple).toBe(-2);
    });
  });

  describe('4. Zerodha Real-World Tradebook CSV Header Scanning & Execution Fills', () => {
    it('correctly handles metadata lines, blank rows, and split fill orders', () => {
      const zerodhaRawCSV = `Client ID	ARS697

Tradebook for Equity from 2026-07-11 to 2026-08-11

Symbol,ISIN,Trade Date,Exchange,Segment,Series,Trade Type,Auction,Quantity,Price,Trade ID,Order ID,Order Execution Time
ATHERENERG,INE0LEZ01016,2026-07-15,NSE,EQ,EQ,buy,FALSE,16,1294.8,0684246,100000007036024,2026-07-15T15:21:27
ATHERENERG,INE0LEZ01016,2026-07-17,NSE,EQ,EQ,sell,FALSE,2,1256.4,3556269,100000003626333,2026-07-17T11:36:20
ATHERENERG,INE0LEZ01016,2026-07-17,NSE,EQ,EQ,sell,FALSE,6,1256.4,3556270,100000003626333,2026-07-17T11:36:20
ATHERENERG,INE0LEZ01016,2026-07-23,NSE,EQ,EQ,sell,FALSE,8,1243,1362999,10000001353314,2026-07-23T09:50:58`;

      const result = autoDetectAndParseCSV(zerodhaRawCSV);
      expect(result.type).toBe('executions');
      expect(result.data.length).toBe(4);

      const positions = matchExecutionsToPositions(result.data);
      expect(positions.length).toBe(1);

      const pos = positions[0];
      expect(pos.symbol).toBe('ATHERENERG');
      expect(pos.totalBought).toBe(16);
      expect(pos.totalSold).toBe(16); // 2 + 6 + 8 = 16
      expect(pos.isClosed).toBe(true);

      // Total Sell proceeds: (2*1256.4 + 6*1256.4 + 8*1243) = 10051.2 + 9944 = 19995.2
      // Total Buy cost: 16 * 1294.8 = 20716.8
      // Realized PnL = -721.6
      expect(pos.realizedPnL).toBeCloseTo(-721.6, 1);
    });
  });

  describe('5. Zerodha Tax P&L Statement Business Rules', () => {
    it('parses Zerodha Tax P&L summary rows and accurately determines open vs closed positions', () => {
      const pnlRawCSV = `Central GST - Z	0
State GST - Z	0
Integrated GST - Z	153.9691
Securities Transaction Tax	6562

Symbol,ISIN,Quantity,Buy Value,Sell Value,Realized P&L,Realized P&L Pct,Previous Closing,Open Quantity,Open Quantity T,Open Value,Unrealized P&L,Unrealized P&L Pct.
ADANIENSOL,INE931S01010,28,45729.6,46019.4,289.8,0.6337,0,0,0,0,0,0
ATHERENERG,INE0LEZ01016,371,371759.85,363812.7,-7947.15,-2.1377,1466.2,15,0,22528.5,-535.5,2.377`;

      const result = autoDetectAndParseCSV(pnlRawCSV);
      expect(result.type).toBe('positions');

      const adani = result.data[0];
      expect(adani.symbol).toBe('ADANIENSOL');
      expect(adani.isClosed).toBe(true);
      expect(adani.realizedPnL).toBe(289.8);

      const ather = result.data[1];
      expect(ather.symbol).toBe('ATHERENERG');
      expect(ather.isClosed).toBe(false);
      expect(ather.openQty).toBe(15);
      expect(ather.realizedPnL).toBe(-7947.15);
    });
  });

  describe('6. Security & Malicious Input Prevention', () => {
    it('prevents CSV injection attacks (formulas starting with =, +, -, @) and HTML script injection', () => {
      expect(sanitizeString('=HYPERLINK("http://malicious.com")')).toBe("'HYPERLINK(\"http://malicious.com\")");
      expect(sanitizeString('-2+3')).toBe("'2+3");
      expect(sanitizeString('<img src=x onerror=alert(1)>SYMBOL')).toBe('SYMBOL');
    });

    it('rejects oversized payloads (> 10 MB) to prevent browser memory DoS', () => {
      const hugeString = 'A'.repeat(11 * 1024 * 1024);
      expect(() => parseCSVToRows(hugeString)).toThrow('CSV file exceeds maximum size limit');
    });

    it('safely handles empty array buffer for Excel conversion', () => {
      expect(convertWorkbookToCSV(null)).toBe('');
    });
  });

});
