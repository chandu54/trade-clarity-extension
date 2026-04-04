import { describe, it, expect } from 'vitest';
import { isParamRelevantForCountry, doesParamPassCheck, getStockCheckSummary, scrubParamDefinitions } from '../paramUtils';

describe('paramUtils', () => {
  describe('isParamRelevantForCountry', () => {
    it('returns true if no paramDef is provided', () => {
      expect(isParamRelevantForCountry(null, 'IN')).toBe(true);
    });

    it('returns true if no countries are defined (Global)', () => {
      const paramDef = { label: 'Global Param', countries: [] };
      expect(isParamRelevantForCountry(paramDef, 'IN')).toBe(true);
      expect(isParamRelevantForCountry(paramDef, 'US')).toBe(true);
    });

    it('returns true if current country is in the scoped list', () => {
      const paramDef = { label: 'IN Param', countries: ['IN'] };
      expect(isParamRelevantForCountry(paramDef, 'IN')).toBe(true);
    });

    it('returns false if current country is NOT in the scoped list', () => {
      const paramDef = { label: 'US Param', countries: ['US'] };
      expect(isParamRelevantForCountry(paramDef, 'IN')).toBe(false);
    });
  });

  describe('doesParamPassCheck', () => {
    it('returns false if isCheck is false', () => {
      const paramDef = { isCheck: false, type: 'text' };
      expect(doesParamPassCheck('some value', paramDef)).toBe(false);
    });

    describe('number type', () => {
      const paramDef = { type: 'number', isCheck: true, idealValues: ['>10', '5'] };

      it('passes if numeric value satisfies operator condition', () => {
        expect(doesParamPassCheck('15', paramDef)).toBe(true);
      });

      it('passes if numeric value is exactly an ideal value', () => {
        expect(doesParamPassCheck('5', paramDef)).toBe(true);
      });

      it('fails if value is outside range', () => {
        expect(doesParamPassCheck('2', paramDef)).toBe(false);
      });

      it('handles range strings like "10-20"', () => {
        const rangeDef = { type: 'number', isCheck: true, idealValues: ['10-20'] };
        expect(doesParamPassCheck('15', rangeDef)).toBe(true);
        expect(doesParamPassCheck('5', rangeDef)).toBe(false);
      });
    });

    describe('date type', () => {
      const paramDef = { type: 'date', isCheck: true, idealValues: ['>2023-01-01'] };

      it('passes if date is after ideal date', () => {
        expect(doesParamPassCheck('2023-06-01', paramDef)).toBe(true);
      });

      it('fails if date is before ideal date', () => {
        expect(doesParamPassCheck('2022-12-01', paramDef)).toBe(false);
      });
    });

    describe('checkbox type', () => {
      const paramDef = { type: 'checkbox', isCheck: true };

      it('passes if value is true', () => {
        expect(doesParamPassCheck(true, paramDef)).toBe(true);
      });

      it('fails if value is false', () => {
        expect(doesParamPassCheck(false, paramDef)).toBe(false);
      });
    });
  });

  describe('getStockCheckSummary', () => {
    const paramDefinitions = {
      p1: { label: 'Check 1', isCheck: true, type: 'checkbox', countries: ['IN'] },
      p2: { label: 'Check 2', isCheck: true, type: 'checkbox', countries: ['US'] },
      p3: { label: 'Info Only', isCheck: false }
    };
    
    const stock = {
      params: {
        p1: true,
        p2: false,
        p3: true
      }
    };

    it('calculates summary correctly for IN country', () => {
      const summary = getStockCheckSummary(stock, paramDefinitions, 'IN');
      expect(summary.passed).toBe(1);
      expect(summary.total).toBe(1); // Only p1
      expect(summary.ratio).toBe(1);
    });

    it('calculates summary correctly for US country', () => {
      const summary = getStockCheckSummary(stock, paramDefinitions, 'US');
      expect(summary.passed).toBe(0); // p2 is false
      expect(summary.total).toBe(1); // Only p2
      expect(summary.ratio).toBe(0);
    });

    it('returns empty summary if no relevant checks found', () => {
      const summary = getStockCheckSummary(stock, paramDefinitions, 'UK');
      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
    });
  });

  describe('scrubParamDefinitions', () => {
    it('auto-scopes parameters starting with in. or us.', () => {
      const data = {
        paramDefinitions: {
          'in.liquidity': { label: 'Liquidity' },
          'us.liquidity': { label: 'Liquidity' }
        }
      };
      
      const scrubbed = scrubParamDefinitions(data);
      expect(scrubbed.paramDefinitions['in.liquidity'].countries).toEqual(['IN']);
      expect(scrubbed.paramDefinitions['us.liquidity'].countries).toEqual(['US']);
    });

    it('retires legacy redundant parameters', () => {
      const data = {
        paramDefinitions: {
          'liquidity': { label: 'Old Liquidity' },
          'in.liquidity': { label: 'New IN Liquidity' },
          'us.liquidity': { label: 'New US Liquidity' }
        }
      };
      
      const scrubbed = scrubParamDefinitions(data);
      // Legacy 'liquidity' should be moved to _legacy_ scope
      expect(scrubbed.paramDefinitions['liquidity'].countries).toEqual(['_legacy_']);
      // Modern ones should be scoped correctly
      expect(scrubbed.paramDefinitions['in.liquidity'].countries).toEqual(['IN']);
    });

    it('does not retire standalone parameters with no modern counterparts', () => {
      const data = {
        paramDefinitions: {
          'custom_metric': { label: 'Custom' }
        }
      };
      
      const scrubbed = scrubParamDefinitions(data);
      expect(scrubbed.paramDefinitions['custom_metric'].countries).toBeUndefined();
    });
  });
});
