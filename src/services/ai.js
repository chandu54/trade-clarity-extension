import { CONFIG } from "../constants/config";

export const PROMPT_TEMPLATES = [
  { value: "swing", label: "Swing Trading (Default)", text: CONFIG.DEFAULT_SYSTEM_PROMPT },
  { value: "day", label: "Day Trading Focus", text: "Act as an aggressive day trading expert. Analyze the following watchlist for high-probability intraday setups. Focus on momentum, volume profile, VWAP bands, and catalyst-driven price action. Identify obvious support/resistance levels and key breakout levels for the upcoming session." },
  { value: "deep_view", label: "Single Stock Deep Analysis", text: "Act as a senior institutional technical analyst. Conduct a high-conviction deep dive on a single stock using provided metrics and technical context. \n\nOutput MUST follow this EXACT structure:\n\n### TREND\n[Primary bias & momentum state]\n\n### KEY LEVELS\n[S1/S2 | R1/R2 with brief context]\n\n### SETUP\n[Specific technical pattern or context]\n\n### TRIGGER\n[The exact 'if this, then that' entry condition]\n\n### VERDICT\n[BUY/WAIT/SELL] - [Brief summary of reasoning]" }
];

export async function getAiAnalysis(apiKey, model, weekData, paramDefinitions, selectedPromptText = null, isCustom = false) {
  // 1. Handle Empty Data Case immediately (Client-side)
  const stocks = Object.values(weekData?.stocks || {});
  if (stocks.length === 0) {
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
  if (customPrompt) customPrompt = customPrompt.trim();

  // 2. Generate prompt with the extracted stocks
  const prompt = generatePrompt(stocks, customPrompt, isCustom);

  try {
    return await fetchGemini(apiKey, prompt, customModel, isCustom);
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    // Security: Ensure the error message doesn't contain the raw API key if it's logged
    const safeErrorMsg = errorMsg.replace(apiKey, "REDACTED");
    throw new Error(safeErrorMsg);
  }
}

export async function getSingleStockAnalysis(apiKey, model, stock, timeframe) {
  if (!apiKey) throw new Error("API Key is missing. Please add it in Settings.");
  
  const prompt = `
    Act as a senior institutional technical analyst. 
    Conduct a high-conviction deep dive on the stock: ${stock.symbol} (${stock.longName || ''}).
    
    Current Quote Context:
    - Price: ${stock.currentPrice}
    - Day Change: ${stock.dailyChangePct}%
    - Period (${timeframe}) Change: ${stock.periodChangePct}%
    - Sector: ${stock.sector || 'Unknown'}
    - Tags: ${(stock.tags || []).join(', ')}
    - Notes: ${stock.notes || 'None'}
    
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

  try {
    let modelToUse = model || CONFIG.DEFAULT_AI_MODEL;
    return await fetchGemini(apiKey, prompt, modelToUse, true); // Use isCustom=true to get raw text
  } catch (error) {
    const errorMsg = error.message || "Unknown error";
    const safeErrorMsg = errorMsg.replace(apiKey, "REDACTED");
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
  // Ensure model has 'models/' prefix if user typed it or if it's missing
  const cleanModel = model.replace(/^models\//, "");
  const url = `${CONFIG.GEMINI_API_URL}${cleanModel}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
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
      "The AI model returned an invalid response format. Please try again or refine your prompt."
    );
  }
}

function generatePrompt(stocks, customPromptText, isCustom) {
  // Simplify data to save tokens and focus on symbols
  const simplifiedStocks = stocks.map((s) => ({
    symbol: s.symbol,
    sector: s.sector || "Unknown",
  }));

  const stocksJson = JSON.stringify(simplifiedStocks);
  const sectorsSet = new Set(simplifiedStocks.map(s => s.sector));
  const sectorsList = Array.from(sectorsSet).join(", ");
  const tickerList = simplifiedStocks.map(s => s.symbol).join(", ");

  let baseInstruction = customPromptText || `Act as a disciplined, risk-aware swing trading mentor (referencing Mark Minervini's SEPA and William O'Neil's CANSLIM). 
    Analyze the following watchlist to provide a clear, objective, and actionable trading plan. 
    Be conservative: do not force patterns if they are not clear. Focus on quality over quantity.`;

  // Template Vairable Replacements
  baseInstruction = baseInstruction.replace(/\{stocks\}/g, stocksJson);
  baseInstruction = baseInstruction.replace(/\{sectors\}/g, sectorsList);
  baseInstruction = baseInstruction.replace(/\{tickers\}/g, tickerList);

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
