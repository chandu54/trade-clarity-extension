import { CONFIG } from "../constants/config";

export const PROMPT_TEMPLATES = [
  {
    value: "swing",
    label: "Swing Trading SEPA & CANSLIM (Default)",
    text: CONFIG.DEFAULT_SYSTEM_PROMPT,
  },
  {
    value: "momentum",
    label: "Watchlist Momentum & Breakout Engine",
    text: `Act as an Institutional Quantitative Momentum Specialist.
Conduct a high-velocity momentum scan across the watchlist to isolate top relative strength breakouts.

Required Output Structure:
1. **Velocity Leaders**: Identify 2-3 stocks displaying extreme relative strength, volume acceleration, and bullish trend alignment.
2. **Breakout Catalyst & Trigger**: Specific breakout pivots and volume surge confirmation thresholds.
3. **Risk Containment & Trailing Stops**: Invalidation price targets and strict risk management rules for rapid momentum trades.

Start directly with the analysis.`,
  },
  {
    value: "bulk_analysis",
    label: "Background Bulk Stock Tagging Engine",
    text: `Act as a Master Institutional Swing & Momentum Trader combining the proven methodologies of Mark Minervini (SEPA / VCP), Kristjan Qullamaggie (10/20 EMA Surfing / High Tight Flags / Extended Rule), and Stockbee / VVV (Relative Strength & Momentum Bursts).

Your mission is to evaluate the list of stocks provided in JSON format ({stocksJson}) for timeframe ({timeframe}) and output a high-conviction verdict (STRONG BUY, BUY, WAIT, or SELL) and a sharp 1-sentence technical reasoning for each stock.

Evaluation & Verdict Criteria (Strictly Applied):
1. **STRONG BUY**: Meets Minervini Trend Template & Qullamaggie VCP / High Tight Flag. Surfing cleanly above 10/20/50 MAs in proper bullish order with strong relative strength.
2. **BUY**: Clean orderly pullback to 10/20 EMA support within an established uptrend, or early-stage base breakout with positive momentum alignment.
3. **WAIT**: Extended stock (>15% above 10/20 EMA), forming a base that needs time, or counter-trend bounce below 50/200 MAs.
4. **SELL**: Lower highs, breakdown below 20/50 MAs, or heavy breakdown volume.

Return ONLY a strict JSON object mapping each ticker symbol to its object containing "verdict" and "reasoning".`,
  },
  {
    value: "phenomena",
    label: "Market Phenomena Analysis",
    text: 'Act as a Lead Institutional Research Analyst specialized in Tactical Basket Trading.\nAnalyze the constituent group of the "{category}" sector.\n\nYour Mission: Filter through this group and provide a high-conviction "Execution Report" that directs a trader toward the most high-probability entry setups.\n\nResearch Structure & Requirements:\n- STRUCTURE: Use clear ### headers and bullet points. DO NOT USE TABLES.\n- TONE: Professional, skeptical, and decision-driven. \n\nRequired Sections:\n1. **Executive Summary**: 2-3 sentences on the group\'s health and collective alpha.\n2. **The Leadership Tier (Highest Conviction)**: Identify 1-2 stocks with the best relative strength. Explain why they are currently leading the basket.\n3. **Execution Decision Matrix**: For each pick in the Leadership Tier, provide:\n   - **Technical Verdict**: A data-driven reason for entry.\n   - **Entry Trigger**: The specific catalyst or level to watch.\n   - **Risk Parameter**: Where the bullish narrative fails for this stock.\n4. **Group Anomalies**: Any stocks decoupling significantly from the group trend.\n\nIdentify: {tickers}. Use their provided performance numbers for the analysis.\nStart directly with the report.',
  },
  {
    value: "deep_view",
    label: "Single Stock Deep Analysis",
    text: "Act as a senior institutional technical analyst. \nConduct a high-conviction deep dive on the stock: {symbol} ({name}).\n\nCurrent Quote Context:\n- Price: {price}\n- Day Change: {dailyChangePct}%\n- Period ({timeframe}) Change: {periodChangePct}%\n- Sector: {sector}\n- Tags: {tags}\n- Notes: {notes}\n\nOutput MUST follow this EXACT structure:\n\n### TREND\n[Primary bias & momentum state]\n\n### KEY LEVELS\n[S1/S2 | R1/R2 with brief context]\n\n### SETUP\n[Specific technical pattern or context]\n\n### TRIGGER\n[The exact 'if this, then that' entry condition]\n\n### VERDICT\n[BUY/WAIT/SELL] - [Brief summary of reasoning]",
  },
  {
    value: "daily_move",
    label: "Daily Price Action & Sentiment Analysis",
    text: "Act as a senior institutional technical analyst.\nConduct a structured daily momentum report for: {symbol} ({name}).\n\nAnalyze the price action today (Change: {dailyChangePct}%) within the broader trend context ({timeframe} Change: {periodChangePct}%).\nYour goal is to explain the driving force behind this daily move (e.g., potential Circuit Limit breakouts, volume spikes, or trend reversals).\n\nCurrent Quote Context:\n- Price: {price}\n- Day Change: {dailyChangePct}%\n- Period ({timeframe}) Change: {periodChangePct}%\n- Sector: {sector}\n- Tags: {tags}\n- Notes: {notes}\n\nOutput MUST follow this EXACT structure:\n\n### CATALYST & MOVE ANALYSIS\n- **Move Type**: [Specify if UC (Upper Circuit), LC (Lower Circuit), High Volume Breakout, or Standard Range]\n- **Key Driver**: [Identify the likely technical/narrative reason for today's price behavior]\n- **Volume Profile**: [Assess today's volume relative to typical liquidity]\n\n### MOMENTUM & METRIC ANALYSIS\n- **Trend Alignment**: [Is today's move aligning with or counter to the broader trend?]\n- **Relative Strength vs. Sector**: [How did the stock perform relative to the {sector} sector today?]\n\n### CRITICAL LEVELS\n- **Support Levels**: [Key support levels where buyers are expected to stand]\n- **Resistance Levels**: [Immediate resistance levels or target boundaries]\n\n### OUTLOOK & ACTION PLAN\n- **Next-Day Expectation**: [What is the expected follow-through price action tomorrow?]\n- **Invalidation Level**: [The price level where today's move is technically invalidated]\n\n### VERDICT\n[BUY/WAIT/SELL] - [Brief decision-driven summary based on today's move]",
  },
  {
    value: "business_scope",
    label: "Business Scope & Dependent Industry Discovery",
    text: `Act as a senior equity research analyst.
Extract the core Business Scope (key product lines/services, min 3, max 8 items) and Dependent/Beneficiary Industries & Macro Themes (top Themes - Min 3, Max 10), e.g. "AI Infrastructure", "Data Centers", "EV Supply Chain", "Defense Localization") for stock symbol: {symbol} ({name}).

Return ONLY a strict JSON object:
{
  "businessScope": ["Segment 1", "Segment 2", "Segment 3"],
  "dependentIndustries": ["Theme 1", "Theme 2"]
}`,
  },
];

export async function getAiAnalysis(
  apiKey,
  model,
  weekData,
  paramDefinitions,
  selectedPromptText = null,
  isCustom = false,
  extraParams = {},
) {
  // 1. Handle Empty Data Case immediately (Client-side)
  const stocks = Object.values(weekData?.stocks || {});
  const hasCategoryMetrics =
    weekData?.stockMetrics && Object.keys(weekData.stockMetrics).length > 0;

  if (stocks.length === 0 && !hasCategoryMetrics) {
    return {
      marketBias: "No stocks found in this week's watchlist.",
      topSectors: ["N/A"],
      actionableSetups: [],
      keyRisks: [],
    };
  }

  // --- API Key Validation (Gemini Protocol) ---
  if (!apiKey) {
    throw new Error("API Key is missing. Please add it in Settings.");
  }
  apiKey = apiKey.trim();

  if (apiKey.length < 30) {
    throw new Error("Invalid Google Gemini API Key format. Key is too short.");
  }

  let customModel = model || CONFIG.DEFAULT_AI_MODEL;
  if (customModel) customModel = customModel.trim();

  let customPrompt = selectedPromptText || CONFIG.DEFAULT_SYSTEM_PROMPT;
  if (customPrompt && typeof customPrompt === "string") {
    customPrompt = customPrompt.trim();
  }

  // 2. Generate prompt with the extracted stocks
  const prompt = generatePrompt(
    stocks,
    customPrompt,
    isCustom,
    extraParams,
    weekData,
  );

  try {
    return await fetchGemini(apiKey, prompt, customModel, isCustom);
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    // Security: Ensure the error message doesn't contain the raw API key if it's logged
    // Only redact if the key is actually present to avoid corrupting the message
    const safeErrorMsg =
      apiKey && apiKey.length > 5
        ? errorMsg.replace(apiKey, "REDACTED")
        : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function getSingleStockAnalysis(
  apiKey,
  model,
  stock,
  timeframe,
  customPromptText = null,
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  let prompt =
    customPromptText ||
    `
    Act as a senior institutional technical analyst. 
    Conduct a high-conviction deep dive on the stock: {symbol} ({name}).
    
    Current Quote Context:
    - Price: {price}
    - Day Change: {dailyChangePct}%
    - Period ({timeframe}) Change: {periodChangePct}%
    - Sector: {sector}
    - Tags: {tags}
    - Notes: {notes}
    
    Output MUST follow this EXACT 5-section markdown structure:

    ### TREND
    (Identify the primary bias: Bullish, Bearish, or Neutral. Mention short-term vs long-term alignment.)

    ### KEY LEVELS
    (Specify S1/S2 for support and R1/R2 for resistance. Provide exact numbers if possible based on current price.)

    ### SETUP
    (Identify the technical setup: e.g., Mean Reversion, Momentum Breakout, Bull Flag, 10/20EMA Bounce, etc.)

    ### TRIGGER
    (Define the exact entry condition: e.g., 'Close above Friday high of 150.50 on volume' or 'Reclaim of 50DMA'.)

    ### VERDICT
    [BUY/WAIT/SELL] - (A concise, one-sentence summary of the reasoning.)

    Keep the analysis professional, objective, and institutional-grade. Do not use filler or excessive adjectives.
  `;

  // Template Variable Replacements
  prompt = prompt.replace(/\{symbol\}/g, stock.symbol || "Unknown");
  prompt = prompt.replace(/\{name\}/g, stock.longName || stock.shortName || "");
  prompt = prompt.replace(/\{price\}/g, stock.currentPrice || "N/A");
  prompt = prompt.replace(/\{dailyChangePct\}/g, stock.dailyChangePct || "0");
  prompt = prompt.replace(/\{periodChangePct\}/g, stock.periodChangePct || "0");
  prompt = prompt.replace(/\{timeframe\}/g, timeframe || "3mo");
  prompt = prompt.replace(/\{sector\}/g, stock.sector || "Unknown");
  prompt = prompt.replace(/\{tags\}/g, (stock.tags || []).join(", ") || "None");
  prompt = prompt.replace(/\{notes\}/g, stock.notes || "None");

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    return await fetchGemini(apiKey, prompt, modelToUse, true); // Use isCustom=true to get raw text
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    const safeErrorMsg =
      apiKey && apiKey.length > 5
        ? errorMsg.replace(apiKey, "REDACTED")
        : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function getBulkStockVerdicts(
  apiKey,
  model,
  stocks,
  timeframe = "3mo",
  customPromptText = null,
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  if (!stocks || stocks.length === 0) return {};

  const stocksJson = JSON.stringify(
    stocks.map((s) => {
      const priceVal =
        s.currentPrice != null && s.currentPrice !== "N/A"
          ? typeof s.currentPrice === "number"
            ? s.currentPrice.toFixed(2)
            : s.currentPrice
          : "N/A";
      const dChange =
        s.dailyChangePct != null
          ? `${Number(s.dailyChangePct) >= 0 ? "+" : ""}${Number(s.dailyChangePct).toFixed(2)}%`
          : "0%";
      const pChange =
        s.periodChangePct != null
          ? `${Number(s.periodChangePct) >= 0 ? "+" : ""}${Number(s.periodChangePct).toFixed(2)}%`
          : "0%";
      const maVal = s.movingAverages || s.params?.movingAverages || "N/A";
      const adrVal = s.adr || s.params?.adr || "N/A";
      const liqVal = s.liquidity || s.params?.liquidity || "N/A";

      return {
        symbol: s.symbol,
        name: s.longName || s.shortName || s.name || "",
        price: priceVal,
        dailyChangePct: dChange,
        periodChangePct: pChange,
        movingAverages: maVal,
        adr: adrVal,
        liquidity: liqVal,
        sector: s.sector || "Unknown",
        tags: (s.tags || []).join(", "),
        notes: s.notes || "",
      };
    }),
  );

  let prompt =
    customPromptText ||
    `
    Act as a Master Institutional Swing & Momentum Trader combining the proven methodologies of Mark Minervini (SEPA / VCP), Kristjan Qullamaggie (10/20 EMA Surfing / High Tight Flags / Extended Rule), and Stockbee / VVV (Relative Strength & Momentum Bursts).

    Your mission is to evaluate the following list of stocks provided in JSON format and output a high-conviction verdict and a sharp 1-sentence technical reasoning for each stock.

    Timeframe Context: {timeframe}

    Stock Data Payload:
    {stocksJson}

    Evaluation & Verdict Criteria (Strictly Applied):

    1. STRONG BUY:
       - Must meet Minervini Trend Template & Qullamaggie VCP / High Tight Flag setup.
       - Price must be surfing cleanly above 10/20/50 MAs in proper bullish order (10 > 20 > 50 > 200).
       - High Relative Strength (strong positive period change), low volatility contraction near key breakout level.

    2. BUY:
       - Clean orderly pullback to 10/20 EMA support within an established uptrend, or early-stage base breakout.
       - Positive momentum alignment with strong relative strength vs broader market.

    3. WAIT:
       - Extended Rule (Qullamaggie): If a stock is extended >15-20% above its 10/20 EMA or recent base, assign WAIT ("Extended — wait for 10/20 EMA pullback or flag base").
       - Base Consolidation: Forming a base, but needs volume dry-up or tighter price contraction before entry.
       - Counter-Trend Bounce: Daily gain occurs beneath heavy overhead MA resistance or negative period trend ("Counter-trend bounce below 50/200 MA").

    4. SELL:
       - Trend Breakdown: Violation of key MAs (below 50/200 MA), breakdown below recent swing lows, or lagging relative strength.

    Reasoning Output Requirements:
    - The reasoning MUST be 1 concise, punchy sentence.
    - Explicitly reference specific legendary setups or technical metrics (e.g., Minervini VCP, Qullamaggie 10/20 EMA Surfing, Extended Rule, MA alignment, Relative Strength %, ADR volatility).
    - DO NOT output generic fluff like "Stock looks good" or "Price is going up".

    Response Format:
    Respond ONLY with a valid JSON object where the keys are the stock symbols and the values are objects containing 'verdict' and 'reasoning'.
    Example Output:
    {
      "RELIANCE": {
        "verdict": "STRONG BUY",
        "reasoning": "Minervini VCP Setup: Surfing above 10/20 MAs with +24.5% 3mo relative strength; tight price contraction near pivot."
      },
      "TCS": {
        "verdict": "WAIT",
        "reasoning": "Qullamaggie Extended Rule: Up +38% with price >16% above 20 EMA; wait for 10/20 EMA pullback or flag base."
      }
    }

    IMPORTANT: Return ONLY the raw JSON string. Do not wrap in markdown code blocks (\`\`\`json).
    `;

  prompt = prompt.replace(/\{stocksJson\}/g, stocksJson);
  prompt = prompt.replace(/\{timeframe\}/g, timeframe);

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    // Pass skipCircuitBreaker=true so transient 429s trigger 65s wait countdown without showing yellow block banner prematurely
    return await fetchGemini(apiKey, prompt, modelToUse, false, 3, true);
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    const safeErrorMsg =
      apiKey && apiKey.length > 5
        ? errorMsg.replace(apiKey, "REDACTED")
        : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function testConnection(apiKey, model) {
  apiKey = apiKey ? apiKey.trim() : "";
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  if (apiKey.length < 30) {
    throw new Error("Invalid Google Gemini API Key format. Key is too short.");
  }

  const prompt = 'Test connection. Respond with valid JSON: { "status": "OK" }';
  let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;

  return await fetchGemini(apiKey, prompt, modelToUse);
}

/**
 * Standardized AI Error Parser
 * Classifies raw API errors into clean user-facing error objects with helpful guidance.
 */
export function parseAiError(error) {
  if (!error) {
    return {
      type: "UNKNOWN",
      message: "An unexpected AI error occurred.",
      isQuota: false,
      providerName: "Google Gemini",
      providerUrl: "https://aistudio.google.com/",
    };
  }

  const rawMsg = typeof error === "string" ? error : error.message || "";
  const isQuota =
    rawMsg.includes("Quota Limit Reached") ||
    rawMsg.includes("RESOURCE_EXHAUSTED") ||
    rawMsg.includes("QuotaExceeded") ||
    rawMsg.includes("429") ||
    rawMsg.includes("AI Request Limit Reached");

  const isInvalidKey =
    rawMsg.includes("API Key") ||
    rawMsg.includes("API_KEY_INVALID") ||
    rawMsg.includes("400") ||
    rawMsg.includes("403");

  const isUnavailable =
    rawMsg.includes("500") ||
    rawMsg.includes("503") ||
    rawMsg.includes("UNAVAILABLE") ||
    rawMsg.includes("Overloaded");

  let type = "UNKNOWN";
  let message = rawMsg;

  if (isQuota) {
    type = "QUOTA_EXCEEDED";
    message =
      "Gemini API Quota Limit Reached. Your AI provider (Google Gemini) has temporarily paused requests due to free-tier quota limits. Please check your plan quota at Google AI Studio or try again later.";
  } else if (isInvalidKey) {
    type = "INVALID_KEY";
    message =
      "Invalid Gemini API Key. Google Gemini rejected the provided API key. Please check or update your key in Settings.";
  } else if (isUnavailable) {
    type = "SERVICE_UNAVAILABLE";
    message =
      "Gemini Service Temporarily Unavailable. Google Gemini servers are experiencing high load or maintenance. Please try again in a few minutes.";
  }

  return {
    type,
    message,
    isQuota,
    rawMessage: rawMsg,
    providerName: "Google Gemini",
    providerUrl: "https://aistudio.google.com/",
  };
}

/**
 * Parse the "retry in Xs" seconds value from a Gemini rate-limit error message.
 * Returns the number of milliseconds to wait, or a default fallback.
 */
function parseRetryAfterMs(errorMessage, fallbackMs = 65000) {
  if (!errorMessage) return fallbackMs;
  // Gemini typically says: "Please retry in 58.925631445s"
  const match = errorMessage.match(/retry in ([\d.]+)s/i);
  if (match) {
    const secs = parseFloat(match[1]);
    // Add a small buffer of 2 seconds to be safe
    return Math.ceil(secs * 1000) + 2000;
  }
  return fallbackMs;
}

async function getAiState() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["trading_app_data"], (res) => {
        const db = res?.trading_app_data || {};
        resolve(
          db.aiSettings?.aiState || { continuousFailures: 0, blockedUntil: 0 },
        );
      });
    });
  } else {
    try {
      const db = JSON.parse(localStorage.getItem("trading_app_data")) || {};
      return (
        db.aiSettings?.aiState || { continuousFailures: 0, blockedUntil: 0 }
      );
    } catch {
      return { continuousFailures: 0, blockedUntil: 0 };
    }
  }
}

async function updateAiState(failures, blockedUntil) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["trading_app_data"], (res) => {
        const db = res?.trading_app_data || {};
        if (!db.aiSettings) db.aiSettings = {};
        db.aiSettings.aiState = { continuousFailures: failures, blockedUntil };
        chrome.storage.local.set({ trading_app_data: db }, resolve);
      });
    });
  } else {
    try {
      const db = JSON.parse(localStorage.getItem("trading_app_data")) || {};
      if (!db.aiSettings) db.aiSettings = {};
      db.aiSettings.aiState = { continuousFailures: failures, blockedUntil };
      localStorage.setItem("trading_app_data", JSON.stringify(db));
    } catch (_err) {
      // ignore local storage set failures
    }
  }
}

async function resetAiFailureCount() {
  await updateAiState(0, 0);
}

async function incrementAiFailureCount(errMsg) {
  const state = await getAiState();
  const newFailures = (state.continuousFailures || 0) + 1;
  let blockedUntil = 0;
  if (newFailures >= 3) {
    const delayMs = parseRetryAfterMs(errMsg, 60000);
    blockedUntil = Date.now() + delayMs;
  }
  await updateAiState(newFailures, blockedUntil);
}

async function fetchGemini(
  apiKey,
  prompt,
  model,
  isCustom = false,
  retries = 3,
  skipCircuitBreaker = false,
  enableFallback = true,
) {
  // Check if AI is currently blocked
  const state = await getAiState();
  if (
    !skipCircuitBreaker &&
    state.blockedUntil &&
    state.blockedUntil > Date.now()
  ) {
    const remainingSecs = Math.ceil((state.blockedUntil - Date.now()) / 1000);
    throw new Error(
      `AI Request Limit Reached. Available again in ${remainingSecs}s.`,
    );
  }

  // 1. Clean the model ID (ensure no redundant prefix)
  const cleanModel = (model || CONFIG.DEFAULT_AI_MODEL).replace(
    /^models\//,
    "",
  );

  // 2. Base URL for v1beta (Required for verified 2.5 / 3.0 models)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    // 45-second timeout per API request (prevents background fetch sockets from hanging indefinitely)
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: isCustom
            ? undefined
            : {
                responseMimeType: "application/json",
              },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let err = {};
        try {
          if (typeof response.json === "function") {
            err = (await response.json()) || {};
          }
        } catch (_e) {
          err = {};
        }
        const errMessage =
          err.error?.message ||
          `Gemini API Error: ${response.status} ${response.statusText || ""} (${cleanModel})`.trim();

        // Quota / Credit Exhaustion Circuit Breaker
        if (
          response.status === 429 ||
          errMessage.includes("RESOURCE_EXHAUSTED") ||
          errMessage.includes("QuotaExceeded")
        ) {
          // Automatic Model Fallback on Quota Exhaustion
          if (enableFallback) {
            const fallbackChain = CONFIG.FALLBACK_MODELS || [
              "gemini-2.5-flash",
              "gemini-3.5-flash",
              "gemini-2.0-flash",
              "gemini-1.5-flash",
            ];
            const currentIdx = fallbackChain.indexOf(cleanModel);
            const nextModel =
              fallbackChain[currentIdx + 1] ||
              fallbackChain.find((m) => m !== cleanModel);
            if (nextModel) {
              console.warn(
                `[Model Fallback] Quota limit on ${cleanModel}. Automatically switching request to fallback model ${nextModel}...`,
              );
              if (
                typeof chrome !== "undefined" &&
                chrome.runtime?.sendMessage
              ) {
                try {
                  const res = chrome.runtime.sendMessage({
                    action: "MODEL_FALLBACK_TRIGGERED",
                    payload: {
                      primaryModel: cleanModel,
                      fallbackModel: nextModel,
                    },
                  });
                  if (res && typeof res.catch === "function")
                    res.catch(() => {});
                } catch (_e) {
                  // Ignore extension messaging errors in non-extension environments
                }
              }
              return await fetchGemini(
                apiKey,
                prompt,
                nextModel,
                isCustom,
                retries,
                skipCircuitBreaker,
                false,
              );
            }
          }

          const retryMs = parseRetryAfterMs(errMessage, 65000);
          if (!skipCircuitBreaker) {
            const blockedUntil = Date.now() + retryMs;
            await updateAiState(3, blockedUntil);
            if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
              try {
                const res = chrome.runtime.sendMessage({
                  action: "AI_LIMIT_REACHED",
                  payload: { blockedUntil },
                });
                if (res && typeof res.catch === "function") res.catch(() => {});
              } catch (_e) {
                // Ignore
              }
            }
          }
          const secs = Math.ceil(retryMs / 1000);
          throw new Error(
            `RESOURCE_EXHAUSTED: Gemini API Quota Limit. Retry in ${secs}s.`,
          );
        }

        throw new Error(errMessage);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error("Empty response from Gemini");

      await resetAiFailureCount();
      return parseResponse(text, isCustom);
    } catch (error) {
      clearTimeout(timeoutId);

      // If it is the block error we threw on entry, don't count it as a failure
      if (error.message && error.message.includes("AI Request Limit Reached")) {
        throw error;
      }

      let finalError = error;
      if (error.name === "AbortError") {
        finalError = new Error("The AI request timed out. Please try again.", {
          cause: error,
        });
      }

      // If more retries remain for non-rate-limit transient network errors, wait and retry attempt
      if (attempt < retries) {
        const errMsg = finalError.message || "";
        const isRateLimit =
          errMsg.includes("quota") ||
          errMsg.includes("429") ||
          errMsg.includes("rate") ||
          errMsg.includes("RESOURCE_EXHAUSTED");
        if (!isRateLimit) {
          console.warn(
            `[fetchGemini] Request attempt ${attempt}/${retries} failed (${finalError.message}). Retrying in 1.5s...`,
          );
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
      }

      if (!skipCircuitBreaker) {
        await incrementAiFailureCount(finalError.message || String(finalError));
      }
      throw finalError;
    }
  }

  // Should not reach here, but guard anyway
  throw new Error("Gemini API request failed after all retries.");
}

function parseResponse(text, _isCustom = false) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {
    // If JSON parsing fails, fallback to rawText object
  }

  return { isCustom: true, rawText: text };
}

function generatePrompt(
  stocks,
  customPromptText,
  isCustom,
  extraParams = {},
  fullWeekData = {},
) {
  // Simplify data to save tokens and focus on symbols
  const simplifiedStocks = stocks.map((s) => ({
    symbol: s.symbol,
    sector: s.sector || s.industry || "Unknown",
    rsRating: s.rsRating || s.rs || s.relativeStrength || undefined,
    pattern: s.vcpPattern || s.pattern || undefined,
    notes: s.notes || undefined,
  }));

  // Include extra metrics if they are passed (e.g. from CategoryAnalysis)
  if (fullWeekData.stockMetrics) {
    simplifiedStocks.forEach((s) => {
      if (fullWeekData.stockMetrics[s.symbol]) {
        Object.assign(s, fullWeekData.stockMetrics[s.symbol]);
      }
    });
  }

  const stocksJson = JSON.stringify(simplifiedStocks);
  const sectorsSet = new Set(simplifiedStocks.map((s) => s.sector));
  const sectorsList = Array.from(sectorsSet).join(", ");
  const tickerList = simplifiedStocks.map((s) => s.symbol).join(", ");

  let baseInstruction =
    customPromptText ||
    `Act as a disciplined, risk-aware swing trading mentor (referencing Mark Minervini's SEPA and William O'Neil's CANSLIM). 
    Analyze the following watchlist to provide a clear, objective, and actionable trading plan. 
    Be conservative: do not force patterns if they are not clear. Focus on quality over quantity.`;

  // Template Vairable Replacements
  baseInstruction = baseInstruction.replace(/\{stocks\}/g, stocksJson);
  baseInstruction = baseInstruction.replace(/\{sectors\}/g, sectorsList);
  baseInstruction = baseInstruction.replace(/\{tickers\}/g, tickerList);

  if (extraParams.category) {
    baseInstruction = baseInstruction.replace(
      /\{category\}/g,
      extraParams.category,
    );
  }

  let prompt = `
    ${baseInstruction}
    
    Watchlist Data Reference:
    ${stocksJson}

    If the sector is "Unknown", infer it based on the ticker symbol.
  `;

  if (!isCustom) {
    prompt += `
    Provide a zero-fluff, high-clarity quantitative decision intelligence briefing in the following STRICT JSON structure:
    {
      "watchlistDiagnosis": {
        "stance": "Full Position Sizing on Base Breakouts",
        "score": 84,
        "percentAbove20EMA": 78,
        "percentAbove50EMA": 70,
        "institutionalTone": "Persistent institutional accumulation in defense and capital goods; profit taking evident in IT laggards.",
        "allocationGuidance": "Focus 70% capital allocation on high-RS base breakouts above 10/21 EMA. Maintain tight stops on extended names."
      },
      "sectorMatrix": [
        {
          "sector": "Defense & Aerospace",
          "stockCount": 6,
          "status": "Leading",
          "narrativeDriver": "Benefiting from domestic order book expansion and government capex. Heavy institutional accumulation on 10 EMA dips.",
          "topLeaders": ["SOLARINDS", "HAL", "BEL"]
        }
      ],
      "focusCandidates": [
        {
          "symbol": "SOLARINDS",
          "rsRank": 94,
          "pattern": "Minervini 3-Touch VCP near 52-week high",
          "pivotTrigger": "Decisive cross above 7,150",
          "volumeRequirement": ">1.5x 20-day average daily volume",
          "stopLoss": "6,850 (Close below 21 EMA)",
          "stopPercent": "-4.2%",
          "targetPrice": "8,800 (+23% upside)",
          "riskReward": "1:3.5",
          "thesis": "RS line making new highs before price; volume drying up sharply on contractions (3T tight base)."
        }
      ],
      "actionTriage": {
        "buyZone": [
          { "symbol": "SOLARINDS", "notes": "Tight VCP base at 10 EMA" }
        ],
        "extended": [
          { "symbol": "TATAMOTORS", "notes": "Extended +18% above 21 EMA; wait for base" }
        ],
        "avoidCut": [
          { "symbol": "WIPRO", "notes": "50 EMA breakdown with heavy distribution volume" }
        ]
      },
      "watchouts": [
        "Major sector earnings releases expected in next 14 days",
        "Watch for broader index divergence at current resistance"
      ]
    }

    Field Rules:
    - stance MUST be one of: "Full Position Sizing on Base Breakouts", "Half Position Sizing on EMA Pullbacks", "Defensive Cash / Tighten Stops".
    - status in sectorMatrix MUST be one of: "Leading", "Consolidating", "Lagging".
    - sectorMatrix: Identify top-performing sectors in this watchlist. For EACH sector, you MUST generate a dynamic, specific 1-2 sentence narrativeDriver explaining the exact fundamental & technical catalysts driving that specific sector's performance (e.g. margin recovery, order book expansion, credit growth, rate sensitivity). NEVER return generic template text. List top 3-4 buying intent stocks under "topLeaders".
    - focusCandidates: Identify ALL top-conviction setup stocks across the entire watchlist (do NOT limit count artificially to 3 or 5) with specific numeric pivot trigger, volume requirement, stop loss, target price, and full thesis.
    - actionTriage: MUST categorize ALL watchlist stocks into the three buckets (buyZone, extended, avoidCut) with specific notes for each stock.

    IMPORTANT: Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
    `;
  }

  return prompt;
}

export async function getWeeklyJournalFeedback(
  apiKey,
  model,
  journals,
  currentFeedback,
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  const journalsJson = JSON.stringify(
    (journals || []).map((j) => ({
      symbol: j.symbol,
      setup: j.setup,
      entryDate: j.entryDate,
      entryPrice: j.entryPrice,
      exitDate: j.exitDate,
      exitPrice: j.exitPrice,
      isClosed: j.isClosed,
      transactions: (j.transactions || []).map((t) => ({
        type: t.type,
        price: t.price,
        qty: t.qty,
        date: t.date,
      })),
      notes: j.notes || "",
      postMortem: j.postMortem || "",
    })),
  );

  let prompt = `
    Act as a senior trading psychologist and institutional risk manager.
    You are reviewing a trader's performance for the week based on their journal entries and self-reflection.
    
    Journal Entries from this week:
    ${journalsJson}
    
    Trader's Self-Reflection:
    - What went right: ${currentFeedback.wentRight || "None provided"}
    - What went wrong: ${currentFeedback.wentWrong || "None provided"}
    - Areas for improvement: ${currentFeedback.improvement || "None provided"}
    
    Provide a professional, concise, yet highly insightful psychological and tactical reflection for the trader. 
    Analyze if their reflection aligns with their actual trades. 
    Provide actionable feedback. Keep it to 3-4 sentences. Do not use markdown formatting like asterisks or bolding, just plain text.
  `;

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    const response = await fetchGemini(apiKey, prompt, modelToUse, true);
    return response.rawText;
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    const safeErrorMsg =
      apiKey && apiKey.length > 5
        ? errorMsg.replace(apiKey, "REDACTED")
        : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function getPortfolioAnalysis(
  apiKey,
  model,
  positions,
  capitalInfo,
  country,
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  const positionsJson = JSON.stringify(
    (positions || []).map((p) => ({
      symbol: p.symbol,
      setup: p.setup,
      isClosed: p.isClosed,
      avgEntryPrice: p.avgEntryPrice,
      avgExitPrice: p.avgExitPrice,
      livePrice: p.livePrice,
      totalPnL: p.totalPnL,
      rMultiple: p.rMultiple,
      notes: p.notes || "",
      postMortem: p.postMortem || "",
      transactionsCount: p.transactions?.length || 0,
    })),
  );

  let prompt = `
    Act as a disciplined swing trading performance coach and risk architect (strongly grounded in Minervini's SEPA and O'Neil's CANSLIM).
    Conduct a comprehensive review of the trader's logged positions and setups.
    
    Country Context: ${country}
    Account Capital: ${country === "IN" ? "₹" : "$"}${capitalInfo.capital.toLocaleString()}
    Total Portfolio P&L: ${country === "IN" ? "₹" : "$"}${capitalInfo.totalPnL.toLocaleString()} (${capitalInfo.returnPct.toFixed(2)}% return)
    Win Rate: ${capitalInfo.winRate}%
    Profit Factor: ${capitalInfo.profitFactor}
    Average Win: ${capitalInfo.avgWin}
    Average Loss: ${capitalInfo.avgLoss}
    
    Logged Positions Data:
    ${positionsJson}
    
    Your mission is to analyze this data and generate a clear, highly professional portfolio performance critique.
    
    Output MUST follow this EXACT 4-section markdown structure:
    
    ### PROCESS ADHERENCE
    [Analyze the trader's discipline in terms of risk mitigation. Look at their stop losses, their wins vs losses, and average losses. Highlight if they are taking large losses compared to wins.]
    
    ### SETUP EFFICIENCY
    [Break down setup performance based on setup names. Identify which setups are yielding the highest R-multiples and which ones are underperforming or dragging down performance.]
    
    ### TACTICAL INSIGHTS
    [Provide 2-3 specific, data-driven tactical recommendations (e.g., 'reduce exposure on setup X', 'tighten stops on setup Y', 'pyramid more aggressively when setup Z moves in your favor').]
    
    ### PSYCHOLOGICAL EDGE
    [Provide 1-2 sentences of psychological coaching based on the trade notes/reflections and win-loss streaks.]
    
    Keep the tone objective, analytical, and process-driven. Do not write generic advice. Customize it directly to the metrics and setups provided.
  `;

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    const response = await fetchGemini(apiKey, prompt, modelToUse, true);
    return response.rawText;
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    const safeErrorMsg =
      apiKey && apiKey.length > 5
        ? errorMsg.replace(apiKey, "REDACTED")
        : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function getRiskSuggestions(
  apiKey,
  model,
  symbol,
  entryPrice,
  timeframe = "3mo",
  candlesticks = [],
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  const simplifiedCandles = (candlesticks || []).slice(-60).map((c) => ({
    close: Number(c.close?.toFixed(2) || 0),
    high: Number(c.high?.toFixed(2) || 0),
    low: Number(c.low?.toFixed(2) || 0),
    open: Number(c.open?.toFixed(2) || 0),
  }));

  const prompt = `
  Act as a senior institutional risk manager and technical analyst.
  Analyze the technical structure of the stock: ${symbol}.
  
  Context:
  - Entry Price: ${entryPrice}
  - Timeframe Context: ${timeframe}
  - Recent Price Action (Last 60 bars):
  ${JSON.stringify(simplifiedCandles)}
  
  Your task is to identify key structural support/resistance levels, calculate a reasonable stop-loss and profit target, and calculate the risk-to-reward ratio.
  
  Suggest a stop-loss that is structurally sound (e.g. below a key moving average, swing low, or support zone) and not too tight (to avoid market noise) or too wide (to keep risk small).
  Suggest 2 profit targets (Target 1 for partial trim, Target 2 for full exit).
  
  Respond ONLY with a valid JSON object matching this structure:
  {
    "suggestedStopLoss": 123.45,
    "suggestedStopLossPct": 2.5,
    "target1": 135.00,
    "target2": 145.00,
    "riskRewardRatio": "1 : 2.5",
    "justification": "Muted, professional 2-3 sentence technical explanation of why these levels were chosen (referencing specific support, swing lows, or moving averages)."
  }
  
  IMPORTANT: Return ONLY the raw JSON string. Do not wrap it in markdown code blocks.
  `;

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    // Use isCustom=false to parse response as JSON
    return await fetchGemini(apiKey, prompt, modelToUse, false);
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    const safeErrorMsg =
      apiKey && apiKey.length > 5
        ? errorMsg.replace(apiKey, "REDACTED")
        : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function classifySectorsInBulk(
  apiKey,
  model,
  stocks,
  country,
  availableSectors = [],
  signal = null,
  onProgress = null,
) {
  if (!apiKey || !stocks || stocks.length === 0) {
    return {};
  }
  if (signal?.aborted) {
    throw new Error("Bulk AI sector classification aborted.");
  }

  const chunkSize = 5;
  const total = stocks.length;
  const combinedResults = {};

  for (let i = 0; i < total; i += chunkSize) {
    if (signal?.aborted) {
      throw new Error("Bulk AI sector classification aborted.");
    }

    if (onProgress) {
      onProgress({ completed: i, total });
    }

    const chunk = stocks.slice(i, i + chunkSize);
    const sectorsList = availableSectors.map((s) => s.name || s).join(", ");
    const stocksJson = JSON.stringify(chunk);

    const prompt = `
    You are an expert equity research classification assistant.
    Task: Classify the following list of stocks in market "${country}" into:
    1. "sector": Standard industry sector (choose from User's Defined Sector Categories or suggest standard name).
    2. "businessScope": All primary business segments, key products, or revenue drivers (array of 2-5 items).
    3. "dependentIndustries": Upstream/downstream beneficiary macro themes or dependent industries (array of 2-4 items, e.g. "AI Infrastructure", "Data Centers", "EV Supply Chain", "Defense Localization").
    
    Stocks to Classify (JSON format):
    ${stocksJson}
    
    User's Defined Sector Categories:
    [${sectorsList}]
    
    Classification Rules:
    1. Map each stock to the MOST appropriate category from the User's Defined Sector Categories list.
    2. If none of the defined categories fit, suggest a concise standard sector name (e.g. "Defense", "Infrastructure", "Electricals").
    3. Ensure sector names, business scope, and dependent themes are clean, concise, and standard title case.
    
    You MUST respond with a valid JSON object mapping symbol to an object with "sector", "businessScope", and "dependentIndustries".
    Example output format:
    {
      "TCS": {
        "sector": "IT",
        "businessScope": ["IT Consulting", "Cloud Services", "AI Enterprise"],
        "dependentIndustries": ["Enterprise AI", "Cloud Computing"]
      },
      "ADANIPORTS": {
        "sector": "Infrastructure",
        "businessScope": ["Port Management", "Logistics Parks", "SEZ Development"],
        "dependentIndustries": ["Global Trade", "Logistics"]
      }
    }
    
    Respond ONLY with the raw JSON string, do not wrap in markdown or include any other text.
    `;

    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    let chunkResults = null;
    try {
      const res = await fetchGemini(apiKey, prompt, modelToUse, false);
      if (res && typeof res === "object") {
        chunkResults = res;
        Object.assign(combinedResults, res);
      }
    } catch (error) {
      console.error("[AI Bulk Sector Classification Failed]:", error);
      if (
        error?.message &&
        error.message.includes("AI Request Limit Reached")
      ) {
        throw error;
      }
    }

    if (onProgress) {
      onProgress({
        completed: Math.min(i + chunkSize, total),
        total,
        chunkResults,
      });
    }
  }

  return combinedResults;
}

export async function enrichStockMetadataAI(
  apiKey,
  model,
  symbol,
  name = "",
  sector = "",
) {
  if (!apiKey || !symbol) return null;
  const prompt = `Act as an expert equity research analyst.
Identify the core Business Scope (key product lines/business segments, max 4-5 items) and Dependent/Beneficiary Industries & Macro Themes (top 2-4 themes, e.g. "AI Infrastructure", "Data Centers", "EV Supply Chain", "Defense Localization") for stock symbol "${symbol}" (${name || symbol}), Sector: "${sector || "N/A"}".

Return ONLY a strict JSON object format without markdown block:
{
  "businessScope": ["Segment 1", "Segment 2"],
  "dependentIndustries": ["Theme 1", "Theme 2"]
}`;

  let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
  try {
    const res = await fetchGemini(apiKey, prompt, modelToUse, false);
    if (res && typeof res === "object") {
      return {
        businessScope: Array.isArray(res.businessScope)
          ? res.businessScope
          : [],
        dependentIndustries: Array.isArray(res.dependentIndustries)
          ? res.dependentIndustries
          : [],
      };
    }
  } catch (err) {
    console.warn(`[AI Scope Enrichment Failed for ${symbol}]:`, err);
  }
  return null;
}
