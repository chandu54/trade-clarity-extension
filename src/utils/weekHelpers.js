export function getLatestWeekKey(weeks) {
  if (!weeks) return null;
  const keys = Object.keys(weeks).sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export function isWeekReadOnly(weekKey, currentWeekKey, uiConfig) {
  if (!weekKey || !currentWeekKey) return false;
  
  // If the user disabled the "Lock Previous Weeks" setting, everything is editable
  if (uiConfig?.lockPreviousWeeks === false) return false;

  // Otherwise, lock only if the week is strictly BEFORE the current week
  // Lexicographical comparison works perfectly for YYYY-MM-DD strings
  return weekKey < currentWeekKey;
}

export function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSundayOfWeek(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0); // Normalize to midnight
  
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = day === 0 ? 7 : day; // If Sunday, go back 7 days. Otherwise go back to Sunday.
  
  date.setDate(date.getDate() - diff);
  return getLocalDateString(date);
}

export function getActualCurrentSunday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const diff = day === 0 ? 7 : day;
  now.setDate(now.getDate() - diff);
  return getLocalDateString(now);
}
