import { CONFIG } from "../constants/config";

export const PROMPT_TEMPLATES = [
  {
    value: "swing",
    label: "Swing Trading (Default)",
    text: CONFIG.DEFAULT_SYSTEM_PROMPT,
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
  customPromptText = null
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  if (!stocks || stocks.length === 0) return {};

  const stocksJson = JSON.stringify(
    stocks.map(s => ({
      symbol: s.symbol,
      name: s.longName || s.shortName || "",
      price: s.currentPrice || "N/A",
      dailyChangePct: s.dailyChangePct || "0",
      periodChangePct: s.periodChangePct || "0",
      sector: s.sector || "Unknown",
      tags: (s.tags || []).join(", "),
      notes: s.notes || ""
    }))
  );

  let prompt =
    customPromptText ||
    `
    Act as a senior institutional technical analyst.
    Analyze the following list of stocks provided in JSON format. The timeframe context is {timeframe}.
    
    Data:
    {stocksJson}
    
    For each stock, provide a verdict and a brief one-sentence reasoning.
    The verdict MUST be one of: "BUY", "WAIT", "SELL", or "STRONG BUY".
    
    Respond ONLY with a valid JSON object where the keys are the stock symbols and the values are objects containing 'verdict' and 'reasoning'.
    Example:
    {
      "RELIANCE": {
        "verdict": "BUY",
        "reasoning": "Breaking out of a multi-week consolidation with strong volume."
      },
      "TCS": {
        "verdict": "WAIT",
        "reasoning": "Approaching major resistance, wait for a clean breakout or pullback."
      }
    }
    
    IMPORTANT: Do not wrap the response in markdown code blocks (\`\`\`json). Return ONLY the raw JSON string.
    `;

  prompt = prompt.replace(/\{stocksJson\}/g, stocksJson);
  prompt = prompt.replace(/\{timeframe\}/g, timeframe);

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    // Use isCustom=false so it automatically parses the JSON
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
        resolve(db.aiSettings?.aiState || { continuousFailures: 0, blockedUntil: 0 });
      });
    });
  } else {
    try {
      const db = JSON.parse(localStorage.getItem("trading_app_data")) || {};
      return db.aiSettings?.aiState || { continuousFailures: 0, blockedUntil: 0 };
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

async function fetchGemini(apiKey, prompt, model, isCustom = false, retries = 3) {
  // Check if AI is currently blocked
  const state = await getAiState();
  if (state.blockedUntil && state.blockedUntil > Date.now()) {
    const remainingSecs = Math.ceil((state.blockedUntil - Date.now()) / 1000);
    throw new Error(`AI Request Limit Reached. Available again in ${remainingSecs}s.`);
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
    // 10 minute timeout per request to accommodate models with 'thinking' phases
    const timeoutId = setTimeout(() => controller.abort(), 600000);

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
          generationConfig: isCustom ? undefined : {
            responseMimeType: "application/json"
          }
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errMessage =
          err.error?.message ||
          `Gemini API Error: ${response.status} ${response.statusText} (${cleanModel})`;

        // Handle rate-limit (429) with smart retry
        if (response.status === 429 && attempt < retries) {
          const waitMs = Math.min(parseRetryAfterMs(errMessage), 120000); // cap at 2 minutes
          const waitSeconds = Math.round(waitMs / 1000);
          console.warn(
            `[AI] Rate limit hit (attempt ${attempt}/${retries}). Waiting ${waitSeconds}s before retry...`
          );
          for (let s = waitSeconds; s > 0; s--) {
            chrome.runtime.sendMessage({
              action: "BULK_AI_RATE_LIMIT_WAIT",
              payload: { waitSeconds: s }
            }).catch(() => {});
            await new Promise(r => setTimeout(r, 1000));
          }
          continue; // retry
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
      if (error.name === 'AbortError') {
        finalError = new Error("The AI request timed out. Please try again.", { cause: error });
      }

      await incrementAiFailureCount(finalError.message || String(finalError));
      throw finalError;
    }
  }

  // Should not reach here, but guard anyway
  throw new Error("Gemini API request failed after all retries.");
}

function parseResponse(text, isCustom = false) {
  if (isCustom) {
    return { isCustom: true, rawText: text };
  }

  try {
    // Robust extraction: Look for the first '{' and the last '}' across the entire response
    // capturing everything in between. This handles markdown blocks (```json) gracefully.
    // The [\s\S]* pattern ensures we match across multiple lines (including newlines).
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON structure found in the AI response.");
    }

    const jsonString = jsonMatch[0];
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      "The AI model returned an invalid response format. Please try again or refine your prompt.",
      { cause: error }
    );
  }
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
    sector: s.sector || "Unknown",
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
    Provide a strategic summary in the following JSON structure:
    {
      "marketBias": "Assess the overall market health based on this watchlist. Is it 'Risk-On' (Bullish), 'Risk-Off' (Bearish), or 'Neutral'? Provide a concise reasoning.",
      "topSectors": ["List the top 2-3 strongest sectors in this list. Format: 'Sector Name: Brief reason'."],
      "actionableSetups": [
        "Identify the top 3-5 high-quality setups. Format: 'SYMBOL: Pattern Name - Trigger/Observation'. Example: 'NVDA: Bull Flag - Watch for breakout above $150 on volume'."
      ],
      "keyRisks": [
        "List 1-3 potential risks specific to this watchlist (e.g., 'Earnings approaching for TSLA', 'Sector concentration in Tech', 'Low relative strength')."
      ]
    }

    IMPORTANT: Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
    `;
  }

  return prompt;
}

export async function getWeeklyJournalFeedback(
  apiKey,
  model,
  journals,
  currentFeedback
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  const journalsJson = JSON.stringify(
    (journals || []).map(j => ({
      symbol: j.symbol,
      setup: j.setup,
      entryDate: j.entryDate,
      entryPrice: j.entryPrice,
      exitDate: j.exitDate,
      exitPrice: j.exitPrice,
      isClosed: j.isClosed,
      transactions: (j.transactions || []).map(t => ({ type: t.type, price: t.price, qty: t.qty, date: t.date })),
      notes: j.notes || "",
      postMortem: j.postMortem || "",
    }))
  );

  let prompt = `
    Act as a senior trading psychologist and institutional risk manager.
    You are reviewing a trader's performance for the week based on their journal entries and self-reflection.
    
    Journal Entries from this week:
    ${journalsJson}
    
    Trader's Self-Reflection:
    - What went right: ${currentFeedback.wentRight || 'None provided'}
    - What went wrong: ${currentFeedback.wentWrong || 'None provided'}
    - Areas for improvement: ${currentFeedback.improvement || 'None provided'}
    
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
    const safeErrorMsg = apiKey && apiKey.length > 5 ? errorMsg.replace(apiKey, "REDACTED") : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function getPortfolioAnalysis(
  apiKey,
  model,
  positions,
  capitalInfo,
  country
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  const positionsJson = JSON.stringify(
    (positions || []).map(p => ({
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
      transactionsCount: p.transactions?.length || 0
    }))
  );

  let prompt = `
    Act as a disciplined swing trading performance coach and risk architect (strongly grounded in Minervini's SEPA and O'Neil's CANSLIM).
    Conduct a comprehensive review of the trader's logged positions and setups.
    
    Country Context: ${country}
    Account Capital: ${country === 'IN' ? '₹' : '$'}${capitalInfo.capital.toLocaleString()}
    Total Portfolio P&L: ${country === 'IN' ? '₹' : '$'}${capitalInfo.totalPnL.toLocaleString()} (${capitalInfo.returnPct.toFixed(2)}% return)
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
    const safeErrorMsg = apiKey && apiKey.length > 5 ? errorMsg.replace(apiKey, "REDACTED") : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function getRiskSuggestions(
  apiKey,
  model,
  symbol,
  entryPrice,
  timeframe = "3mo",
  candlesticks = []
) {
  if (!apiKey)
    throw new Error("API Key is missing. Please add it in Settings.");

  const simplifiedCandles = (candlesticks || []).slice(-60).map(c => ({
    close: Number(c.close?.toFixed(2) || 0),
    high: Number(c.high?.toFixed(2) || 0),
    low: Number(c.low?.toFixed(2) || 0),
    open: Number(c.open?.toFixed(2) || 0)
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
    const safeErrorMsg = apiKey && apiKey.length > 5 ? errorMsg.replace(apiKey, "REDACTED") : errorMsg;
    throw new Error(safeErrorMsg, { cause: error });
  }
}

export async function classifySectorsInBulk(
  apiKey,
  model,
  stocks,
  country,
  availableSectors = []
) {
  if (!apiKey || !stocks || stocks.length === 0) {
    return {};
  }
  
  const sectorsList = availableSectors.map(s => s.name || s).join(", ");
  const stocksJson = JSON.stringify(stocks);

  const prompt = `
  You are an expert financial classification assistant.
  Task: Classify the following list of stocks in market "${country}" into one of the user's defined sector categories.
  
  Stocks to Classify (JSON format):
  ${stocksJson}
  
  User's Defined Sector Categories:
  [${sectorsList}]
  
  Classification Rules:
  1. Map each stock to the MOST appropriate category from the User's Defined Sector Categories list.
  2. If none of the defined categories are a close or reasonable fit, suggest a new, concise, professionally standard sector name (e.g., "Defense", "Infrastructure", "Textiles", "Green Energy").
  3. Ensure the sector names are clean, capitalized properly (Title Case), and concise.
  
  You MUST respond with a valid JSON object where the keys are the stock symbols and the values are objects containing the resolved sector.
  Example output format:
  {
    "TCS": { "sector": "IT" },
    "ADANIPORTS": { "sector": "Infrastructure" }
  }
  
  Respond ONLY with the raw JSON string, do not wrap in markdown or include any other text.
  `;

  let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
  try {
    const res = await fetchGemini(apiKey, prompt, modelToUse, false);
    return res || {};
  } catch (error) {
    console.error("[AI Bulk Sector Classification Failed]:", error);
    return {};
  }
}


