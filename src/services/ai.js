import { getStoredApiKey, getStoredModel } from "./storage";

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export async function getAiAnalysis(weekData, paramDefinitions) {
  // 1. Handle Empty Data Case immediately (Client-side)
  const stocks = Object.values(weekData?.stocks || {});
  if (stocks.length === 0) {
    return {
      marketBias: "No stocks found in this week's watchlist to analyze.",
      topSectors: ["N/A"],
      actionableSetups: ["Add stocks to the grid to generate an analysis."],
    };
  }

  let apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please add it in Settings.");
  }
  apiKey = apiKey.trim();

  let customModel = await getStoredModel();
  if (customModel) customModel = customModel.trim();

  // 2. Generate prompt with the extracted stocks
  const prompt = generatePrompt(stocks, paramDefinitions);

  try {
    // Simple heuristic: OpenAI keys usually start with "sk-"
    if (apiKey.startsWith("sk-")) {
      return await fetchOpenAI(
        apiKey,
        prompt,
        customModel || DEFAULT_OPENAI_MODEL,
      );
    } else {
      // Use custom model if set, otherwise default.
      let modelToUse = customModel || DEFAULT_GEMINI_MODEL;

      // Fix common invalid model names or expired experimental models
      if (modelToUse === "gemini-2.0-flash-exp")
        modelToUse = "gemini-2.0-flash";
      if (
        modelToUse === "gemini-1.5-flash" ||
        modelToUse === "gemini-1.5-flash-001"
      )
        modelToUse = "gemini-2.0-flash";

      return await fetchGemini(apiKey, prompt, modelToUse);
    }
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
}

async function fetchGemini(apiKey, prompt, model) {
  // Ensure model doesn't have 'models/' prefix if user typed it
  const cleanModel = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1/models/${cleanModel}:generateContent?key=${apiKey}`;

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
        `Gemini API Error: ${response.status} (${cleanModel})`,
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Empty response from Gemini");

  return parseResponse(text);
}

async function fetchOpenAI(apiKey, prompt, model) {
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
          content: "You are a helpful trading assistant. Respond in JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
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

  return parseResponse(text);
}

function parseResponse(text) {
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

function generatePrompt(stocks, paramDefinitions) {
  // Simplify data to save tokens
  const simplifiedStocks = stocks.map((s) => {
    const params = {};
    // Map internal keys to readable labels
    Object.entries(s.params || {}).forEach(([k, v]) => {
      // Only include truthy values or explicit booleans to save tokens
      if (v !== undefined && v !== null && v !== "") {
        const label = paramDefinitions[k]?.label || k;
        params[label] = v;
      }
    });

    return {
      symbol: s.symbol,
      sector: s.sector,
      tradable: s.tradable,
      ...params,
    };
  });

  return `
    Act as a world-class swing trader (referencing Mark Minervini's SEPA methodology). 
    Analyze the following stock watchlist data. The data contains symbols, sectors, 'tradable' status, and custom technical parameters.
    
    Stocks Data:
    ${JSON.stringify(simplifiedStocks)}

    Based on the provided data points (interpreting them as technical indicators), provide a strategic summary in the following JSON structure:
    {
      "marketBias": "A professional assessment of the market environment based on the breadth of 'tradable' stocks and sector participation. Is it a 'Risk On' or 'Risk Off' environment? (Bullish/Bearish/Neutral)",
      "topSectors": ["List 2-3 sectors showing the highest relative strength or concentration of setups."],
      "actionableSetups": ["Identify 3-5 specific symbols that appear to be the strongest 'Power Plays' or 'VCP' candidates based on their parameters. Include a brief, punchy technical reason for each (e.g., 'Strong RS with tight consolidation')."]
    }

    IMPORTANT: Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
  `;
}
