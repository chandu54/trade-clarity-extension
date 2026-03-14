import { getStoredApiKey, getStoredModel, getStoredPrompt } from "./storage";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const PROMPT_TEMPLATES = [
  { value: "swing", label: "Swing Trading (Default)", text: "Act as a disciplined, risk-aware swing trading mentor (referencing Mark Minervini's SEPA and William O'Neil's CANSLIM). \nAnalyze the following watchlist to provide a clear, objective, and actionable trading plan. \nBe conservative: do not force patterns if they are not clear. Focus on quality over quantity." },
  { value: "day", label: "Day Trading Focus", text: "Act as an aggressive day trading expert. Analyze the following watchlist for high-probability intraday setups. Focus on momentum, volume profile, VWAP bands, and catalyst-driven price action. Identify obvious support/resistance levels and key breakout levels for the upcoming session." }
];

export async function getAiAnalysis(weekData, paramDefinitions, selectedPromptText = null, isCustom = false) {
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

  let apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please add it in Settings.");
  }
  apiKey = apiKey.trim();

  // --- API Key Validation ---
  const isOpenAI = apiKey.startsWith("sk-");
  if (isOpenAI) {
    // OpenAI keys are typically 51 characters long.
    if (apiKey.length < 40) {
      throw new Error("Invalid OpenAI API Key format. Key is too short.");
    }
  } else {
    // Google Gemini keys are typically 39 characters long.
    if (apiKey.length < 30) {
      throw new Error("Invalid Google API Key format. Key is too short.");
    }
  }

  let customModel = await getStoredModel();
  if (customModel) customModel = customModel.trim();

  let customPrompt = selectedPromptText;
  if (!customPrompt) {
    customPrompt = await getStoredPrompt();
  }
  if (customPrompt) customPrompt = customPrompt.trim();

  // 2. Generate prompt with the extracted stocks
  const prompt = generatePrompt(stocks, customPrompt, isCustom);

  try {
    if (isOpenAI) {
      return await fetchOpenAI(
        apiKey,
        prompt,
        customModel || DEFAULT_OPENAI_MODEL,
        isCustom
      );
    } else {
      // Use custom model if set, otherwise default.
      let modelToUse = customModel || DEFAULT_GEMINI_MODEL;

      return await fetchGemini(apiKey, prompt, modelToUse, isCustom);
    }
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
}

export async function testConnection(apiKey, model) {
  apiKey = apiKey ? apiKey.trim() : "";
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  const isOpenAI = apiKey.startsWith("sk-");
  if (isOpenAI) {
    if (apiKey.length < 40) {
      throw new Error("Invalid OpenAI API Key format. Key is too short.");
    }
  } else {
    if (apiKey.length < 30) {
      throw new Error("Invalid Google API Key format. Key is too short.");
    }
  }

  const prompt = 'Test connection. Respond with valid JSON: { "status": "OK" }';
  let modelToUse = model;
  if (!modelToUse) {
    modelToUse = isOpenAI ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;
  }

  if (isOpenAI) {
    return await fetchOpenAI(apiKey, prompt, modelToUse);
  } else {
    return await fetchGemini(apiKey, prompt, modelToUse);
  }
}

async function fetchGemini(apiKey, prompt, model, isCustom = false) {
  // Ensure model doesn't have 'models/' prefix if user typed it
  const cleanModel = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

async function fetchOpenAI(apiKey, prompt, model, isCustom = false) {
  const url = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: isCustom ? "You are a helpful trading assistant." : "You are a helpful trading assistant. Respond in JSON.",
        },
        { role: "user", content: prompt },
      ],
      ...(isCustom ? {} : { response_format: { type: "json_object" } }),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `OpenAI API Error: ${response.status} (${model})`,
    );
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  return parseResponse(text, isCustom);
}

function parseResponse(text, isCustom = false) {
  if (isCustom) {
     return { isCustom: true, rawText: text };
  }

  try {
    // Extract JSON substring by finding the first '{' and last '}'
    const startIndex = text.indexOf("{");
    const endIndex = text.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1) {
      throw new Error("No JSON object found in response");
    }

    const jsonString = text.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("JSON Parse Error", e, text);
    throw new Error(
      "Failed to parse AI response. The model might have returned invalid JSON.",
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
