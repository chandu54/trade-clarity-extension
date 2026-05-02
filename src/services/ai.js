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
    throw new Error(safeErrorMsg);
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
    throw new Error(safeErrorMsg);
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

async function fetchGemini(apiKey, prompt, model, isCustom = false) {
  // 1. Clean the model ID (ensure no redundant prefix)
  const cleanModel = (model || CONFIG.DEFAULT_AI_MODEL).replace(
    /^models\//,
    "",
  );

  // 2. Base URL for v1beta (Required for verified 2.5 / 3.0 models)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error?.message ||
        `Gemini API Error: ${response.status} ${response.statusText} (${cleanModel})`,
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Empty response from Gemini");

  return parseResponse(text, isCustom);
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
  } catch (e) {
    throw new Error(
      "The AI model returned an invalid response format. Please try again or refine your prompt.",
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
