export function getLatestWeekKey(weeks) {
  if (!weeks) return null;
  const keys = Object.keys(weeks).sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export function isWeekReadOnly(weekKey, currentWeekKey, uiConfig) {
  if (!weekKey) return false;
  
  // If the user disabled the "Lock Previous Weeks" setting, everything is editable
  if (uiConfig?.lockPreviousWeeks === false) return false;

  // Otherwise, lock only if the week is strictly BEFORE the current week
  const weekDate = new Date(weekKey);
  const currentDate = new Date(currentWeekKey);
  return weekDate < currentDate;
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
  const day = date.getDay();
  // Treat Sunday (0) as 7 so it maps to the previous week's Sunday anchor
  const diff = date.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(date.setDate(diff));
  return getLocalDateString(sunday);
}
