export function getLatestWeekKey(weeks) {
  if (!weeks) return null;
  const keys = Object.keys(weeks).sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export function isWeekReadOnly(weekKey, currentWeekKey, uiConfig) {
  if (!weekKey) return false;
  if (uiConfig?.lockPreviousWeeks === false) return false;
  return weekKey !== currentWeekKey;
}
