import { describe, it } from 'vitest';
import { calculateCheckStats } from '../checks';

describe('calculateCheckStats', () => {
  const paramDefinitions = {
    param1: { type: 'checkbox', isCheck: true },
    param2: { type: 'select', isCheck: true, idealValues: ['Yes', 'Maybe'] },
    param3: { type: 'text', isCheck: true, idealValues: ['Good'] },
    param4: { type: 'checkbox', isCheck: false }, // Should be ignored
  };

  it('should return zeros for empty stocks array', () => {
    const result = calculateCheckStats([], paramDefinitions);
    expect(result).toEqual({
      totalStocks: 0,
      passed80: 0,
      passed60: 0,
    });
  });

  it('should count stocks passing 80% or more', () => {
    const stocks = [
      {
        params: {
          param1: true,
          param2: 'Yes',
          param3: 'Good',
        },
      },
    ];
    // 3 out of 3 checks passed = 100%
    const result = calculateCheckStats(stocks, paramDefinitions);
    expect(result.passed80).toBe(1);
    expect(result.passed60).toBe(0);
  });

  it('should count stocks passing between 60% and 80%', () => {
    const stocks = [
      {
        params: {
          param1: true,
          param2: 'Maybe',
          param3: 'Bad',
        },
      },
    ];
    // 2 out of 3 checks passed = 66.6%
    const result = calculateCheckStats(stocks, paramDefinitions);
    expect(result.passed80).toBe(0);
    expect(result.passed60).toBe(1);
  });

  it('should not count stocks passing less than 60%', () => {
    const stocks = [
      {
        params: {
          param1: true,
          param2: 'No',
          param3: 'Bad',
        },
      },
    ];
    // 1 out of 3 checks passed = 33.3%
    const result = calculateCheckStats(stocks, paramDefinitions);
    expect(result.passed80).toBe(0);
    expect(result.passed60).toBe(0);
  });

  it('should handle missing params gracefully', () => {
    const stocks = [{ params: {} }];
    const result = calculateCheckStats(stocks, paramDefinitions);
    expect(result.totalStocks).toBe(1);
    expect(result.passed80).toBe(0);
    expect(result.passed60).toBe(0);
  });

  it('should ignore params where isCheck is false', () => {
    const stocks = [
      {
        params: {
          param1: true,
          param2: 'Yes',
          param4: true, // This is true but its isCheck is false
        },
      },
    ];
    // param3 is missing, so 2 out of 3 checks passed (66.6%)
    const result = calculateCheckStats(stocks, paramDefinitions);
    expect(result.passed60).toBe(1);
  });
});
