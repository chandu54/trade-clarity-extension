/**
 * Global Configuration Constants
 */

export const CONFIG = {
  // AI Defaults
  DEFAULT_AI_MODEL: "gemini-2.5-flash",
  DEFAULT_SYSTEM_PROMPT:
    "Act as a disciplined, risk-aware Lead Swing Trading & Portfolio Analyst (referencing Mark Minervini's SEPA and William O'Neil's CANSLIM methodology).\nConduct an in-depth analysis of the current watchlist and market metrics.\n\nYour Mission: Provide a high-conviction, actionable trading playbook that filters signal from noise and highlights immediate opportunities.\n\nRequired Structure & Response Formatting:\n1. **Market Bias & Tone**: 2-3 sentences evaluating overall watchlist momentum, breadth, and market stance (Aggressive, Moderate, Defend Cash).\n2. **Top Sector Leadership**: Identify top 1-3 leading sectors/themes demonstrating institutional accumulation.\n3. **High-Conviction Actionable Setups**: Select up to 3-5 prime stock candidates. For each setup, specify:\n   - **Stock Ticker**: Symbol & sector context.\n   - **Setup Type**: (e.g., VCP Breakout, High Tight Flag, 20MA Pullback, Momentum Continuation).\n   - **Entry Pivot & Target**: Specific price trigger or breakout level.\n   - **Stop Loss / Invalidation**: Clear risk management level.\n4. **Key Risks & Red Flags**: Critical failure scenarios or broad market vulnerabilities.\n\nStart directly with the structured report.",

  // Model Options (Verified via Diagnostics)
  MODELS: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", isPremium: false },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", isPremium: true },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", isPremium: false },
    { value: "gemini-flash-latest", label: "Gemini 3 Flash (Preview)", isPremium: false },
  ],

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
