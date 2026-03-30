import { describe, it } from 'vitest';
import { getWeekKey } from '../week';

describe('getWeekKey', () => {
  it('should return correct week key (Sunday date string) for various dates', () => {
    // 2026-03-30 is Monday
    // Week start (Sunday) should be 2026-03-29
    const date1 = new Date('2026-03-30');
    expect(getWeekKey(date1)).toBe('2026-03-29');

    // 2026-03-29 is Sunday
    const date2 = new Date('2026-03-29');
    expect(getWeekKey(date2)).toBe('2026-03-29');

    // 2026-03-28 is Saturday
    // Week start (Sunday) should be 2026-03-22
    const date3 = new Date('2026-03-28');
    expect(getWeekKey(date3)).toBe('2026-03-22');
  });

  it('should default to today', () => {
    const today = new Date();
    const result = getWeekKey();
    const expected = new Date(today);
    expected.setDate(expected.getDate() - expected.getDay());
    expect(result).toBe(expected.toISOString().slice(0, 10));
  });
});
