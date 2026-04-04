/**
 * Global Configuration Constants
 */

export const CONFIG = {
  // AI Defaults
  DEFAULT_AI_MODEL: "gemini-2.5-flash",
  DEFAULT_SYSTEM_PROMPT:
    "Act as a disciplined, risk-aware swing trading mentor (referencing Mark Minervini's SEPA and William O'Neil's CANSLIM). \nAnalyze the following watchlist to provide a clear, objective, and actionable trading plan.",

  // API Endpoints
  YAHOO_FINANCE_URL: "https://query1.finance.yahoo.com/v8/finance/chart/",
  GEMINI_API_URL: "https://generativelanguage.googleapis.com/v1beta/models/",

  // Timing & Thresholds
  FETCH_TIMEOUT_MS: 15000, // 15 seconds for network calls
  BATCH_SIZE: 5,
  BATCH_DELAY_MS: 2000,

  // Storage Keys
  STORAGE_KEY: "trading_app_data",
  WIDGET_SETTINGS_KEY: "widget_settings",
};
