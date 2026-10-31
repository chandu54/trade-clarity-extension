import { chartinkAutomation } from "./chartinkAutomation";
import { ipoRadarAutomation } from "./ipoRadarAutomation";

/**
 * Global Registry of available automation recipes
 */
export const AUTOMATION_TASKS = [
  chartinkAutomation,
  ipoRadarAutomation,
];

/**
 * Get automations supported for a given country code (e.g. "IN" or "US")
 */
export function getAutomationsForCountry(country = "IN") {
  const cUpper = (country || "IN").toUpperCase();
  return AUTOMATION_TASKS.filter((task) => {
    if (!task.countries || task.countries.length === 0) return true;
    return task.countries.includes(cUpper);
  });
}

/**
 * Retrieve a specific automation task by its unique ID
 */
export function getAutomationById(id) {
  return AUTOMATION_TASKS.find((task) => task.id === id) || null;
}
