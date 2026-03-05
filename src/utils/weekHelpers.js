/**
 * Utility functions for week-related operations
 */

/**
 * Get the latest week key from weeks object
 * @param {Object} weeks - Object with week keys
 * @returns {string|null} Latest week key or null
 */
export function getLatestWeekKey(weeks = {}) {
  const keys = Object.keys(weeks);
  if (keys.length === 0) return null;
  return keys.sort((a, b) => a.localeCompare(b))[keys.length - 1];
}

/**
 * Get current week key (Sunday's date in YYYY-MM-DD format)
 * @returns {string} Current week key
 */
export function getCurrentWeekKey() {
  const date = new Date();
  const day = date.getDay();
  // Treat Sunday (0) as 7 so it maps to the previous week's Sunday anchor (Monday-Sunday week)
  const diff = date.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(date);
  sunday.setDate(diff);

  // Return YYYY-MM-DD in local time
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Check if a week is read-only
 * @param {string} weekKey - Week key to check
 * @param {string} currentWeekKey - The key for the current real-world week
 * @param {Object} uiConfig - UI configuration
 * @returns {boolean} True if week is read-only
 */
export function isWeekReadOnly(weekKey, currentWeekKey, uiConfig = {}) {
  if (uiConfig.lockPreviousWeeks === false) return false;
  if (!weekKey || !currentWeekKey) return false;

  // Lock if the selected week is strictly before the current week
  return weekKey < currentWeekKey;
}
