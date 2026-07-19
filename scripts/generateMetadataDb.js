import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, "../src/constants/stockMetadata.json");

// A comprehensive pre-defined list of major liquid Indian stocks (>1000Cr cap) and US stocks
const INDIAN_SYMBOLS = [
  "RELIANCE", "TCS", "HDFCBANK", "BHARTIARTL", "ICICIBANK", "INFY", "SBIN", "ITC", 
  "HINDUNILVR", "LT", "HCLTECH", "BAJFINANCE", "ADANIENT", "SUNPHARMA", "MARUTI", 
  "NTPC", "ONGC", "ADANIPORTS", "TATASTEEL", "COALINDIA", "KOTAKBANK", "AXISBANK", 
  "TITAN", "M&M", "ADANIPOWER", "ULTRACEMCO", "WIPRO", "ASIANPAINT", "POWERGRID", 
  "JIOFIN", "ADANIGREEN", "GRASIM", "TECHM", "HINDALCO", "JSWSTEEL", "HAL", 
  "BEL", "BPCL", "IOC", "IRFC", "REC", "PFC", "TATAELXSI", "ZOMATO", "PAYTM", 
  "JINDALSTEL", "TRENT", "SIEMENS", "DLF", "VBL", "EICHERMOT", "INDHOTEL", 
  "POLYCAB", "TATACOMM", "PIDILITIND", "INDUSINDBK", "DABUR", "MARICO", 
  "TATACONSUM", "SHREECEM", "HEROMOTOCO", "APOLLOHOSP", "DIVISLAB", "TATAPOWER", 
  "GAIL", "IRCTC", "YESBANK", "IDEA", "SUZLON", "GMRINFRA", "NHPC", "SJVN", 
  "RVNL", "HUDCO", "IRCON", "NBCC", "BHEL", "SAIL", "NMDC", "UNIONBANK", 
  "CANBK", "BOB", "BANKINDIA", "MAHABANK", "FEDERALBNK", "AUBANK", "BANDHANBNK", 
  "IDFCFIRSTB", "GLENMARK", "AARTIIND", "DEEPAKNTR", "SRF", "TATACHEM", "BIOCON", 
  "LUPIN", "AUROPHARMA", "IPCALAB", "ALKEM", "ZYDUSLIFE", "MANAPPURAM", "MUTHOOTFIN", 
  "CHOLAFIN", "PEL", "LICHSGFIN", "L&TFH", "M&MFIN", "SHRIRAMFIN", "VOLTAS", 
  "HAVELLS", "DIXON", "AMBER", "KEI", "ASTRAL", "SUPREMEIND", "JINDALSAW", 
  "WELCORP", "APLAPOLO", "RATNAMANI", "ASHOKLEY", "BALKRISIND", "MRF", 
  "APOLLOTYRE", "CEAT", "JKTYRE", "TVSMOTOR", "ESCORTS", "SONACOMS", "UNOMINDA", 
  "BHARATFORG", "AMBUJACEM", "ACC", "JKCEMENT", "RAMCOCEM", "SOBHA", 
  "OBEROIRLTY", "PRESTIGE", "PHOENIXLTD", "BRIGADE", "GODREJPROP", "KEC", 
  "LTIM", "PERSISTENT", "KPITTECH", "COFORGE", "LTTS", "CYIENT", "SONATSOFTW", 
  "BIRLASOFT", "INTELLECT", "HFCL", "TEJASNET", "RAILTEL", "ROUTE", "AFFLE", 
  "TANLA", "NAUKRI", "INDIAMART", "NYKAA", "DELHIVERY", "ABB", "CGPOWER", 
  "THERMAX", "CUMMINSIND", "IRCON"
];

const US_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "NFLX", "JNJ", "V", 
  "PG", "JPM", "UNH", "MA", "HD", "DIS", "PYPL", "ADBE", "CMCSA", "BAC", "KO", 
  "PEP", "XOM", "CVX", "CSCO", "INTC", "ORCL", "MRK", "PFE", "T", "VZ", "ABT", 
  "CRM", "ABBV", "NKE", "ACN", "MDT", "TXN", "LLY", "DHR", "UNP", "MCD", "HON", 
  "COST", "PM", "NEE", "TMO", "IBM", "MS", "SBUX", "WMT", "GE", "CAT", "GS", 
  "INTU", "MU", "QCOM", "AMD", "NOW", "SPGI", "ISRG", "MDLZ", "AMGN", "GILD", 
  "DE", "SYK", "ZTS", "LMT", "RTX", "NOC", "GD", "ADP", "BKNG", "PLTR", "UBER", 
  "SNOW", "NET", "DDOG", "CRWD", "OKTA", "ZS", "TEAM", "WDAY", "SHOP"
];

// Load existing metadata if present to avoid overwriting or to merge
let currentDb = { IN: {}, US: {} };
if (fs.existsSync(outputFile)) {
  try {
    currentDb = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    currentDb.IN = currentDb.IN || {};
    currentDb.US = currentDb.US || {};
    console.log("💾 Loaded existing stockMetadata.json database.");
  } catch (_err) {
    console.warn("⚠️ Warning: Could not parse existing stockMetadata.json. Creating fresh.");
  }
}

async function generateDb() {
  const apiKey = process.env.GEMINI_API_KEY || process.argv[2];
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY is required.");
    console.log("Usage: GEMINI_API_KEY=your_key npm run update-metadata-db");
    console.log("OR: npm run update-metadata-db -- your_key");
    process.exit(1);
  }

  console.log(`🚀 Loading stock list: ${INDIAN_SYMBOLS.length} Indian, ${US_SYMBOLS.length} US symbols...`);

  // 1. Process Indian Symbols
  console.log("\n🇮🇳 Processing Indian Stocks...");
  await processMarketBatch(apiKey, INDIAN_SYMBOLS, "IN");

  // 2. Process US Symbols
  console.log("\n🇺🇸 Processing US Stocks...");
  await processMarketBatch(apiKey, US_SYMBOLS, "US");

  // Write merged output database
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(currentDb, null, 2), "utf8");
  console.log(`\n🎉 Success! Extensible stockMetadata.json saved successfully to: ${outputFile}`);
}

async function processMarketBatch(apiKey, symbols, country) {
  const batchSize = 50; // Smaller batch size to prevent token limits
  const targetDb = currentDb[country] || {};
  currentDb[country] = targetDb;

  // Only process symbols that aren't already in the target database
  const missingSymbols = symbols.filter(s => !targetDb[s]);
  
  if (missingSymbols.length === 0) {
    console.log(`   ✓ All ${symbols.length} symbols are already cached in local database.`);
    return;
  }

  console.log(`   * Found ${missingSymbols.length}/${symbols.length} symbols missing in database. Classifying...`);

  for (let i = 0; i < missingSymbols.length; i += batchSize) {
    // Add a delay between batches (except the very first) to respect rate limits
    if (i > 0) {
      console.log("   * Waiting 4s to respect rate limits...");
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    const chunk = missingSymbols.slice(i, i + batchSize);
    console.log(`   * Fetching batch ${Math.floor(i / batchSize) + 1} (${chunk.length} stocks)...`);
    
    const prompt = `
    You are an expert financial classification assistant.
    Task: Resolve the standard business sector for the following list of stock ticker symbols in market "${country}".
    
    Symbols to process:
    [${chunk.join(", ")}]
    
    You MUST respond with a valid JSON object where the keys are stock symbols and values are objects containing the "sector" (concise capitalized title case sector category, e.g., "IT", "Infrastructure", "Banking", "Automobile", "Pharmaceuticals", "Energy", "FMCG").
    
    Example response:
    {
      "TCS": { "sector": "IT" },
      "ADANIPORTS": { "sector": "Infrastructure" }
    }
    
    Respond ONLY with raw JSON, no formatting markdown or extra conversational text.
    `;

    try {
      const result = await fetchGemini(apiKey, prompt);
      if (result) {
        Object.entries(result).forEach(([sym, data]) => {
          if (data && data.sector) {
            targetDb[sym] = {
              sector: data.sector
            };
          }
        });
        // Save incrementally after each successful batch
        fs.writeFileSync(outputFile, JSON.stringify(currentDb, null, 2), "utf8");
      }
    } catch (err) {
      console.error(`   ❌ Failed to process batch:`, err.message || err);
      // Abort classification if quota is exhausted
      if (err.message.includes("Quota Exhausted")) {
        console.error("   ❌ Quota exhausted. Aborting remaining batches.");
        break;
      }
    }
  }
}

async function fetchGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  let retries = 4;
  let delay = 65000; // Default to 65 seconds to clear Gemini's 60-second limit
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (response.status === 429) {
        let errMsg = "Rate limit hit";
        try {
          const errData = await response.json();
          errMsg = errData.error?.message || errData.error?.status || errMsg;
        } catch (_e) {
          // Ignore JSON parsing errors
        }

        console.warn(`      ⚠️ Rate limit (429) hit: "${errMsg}".`);
        
        // If it is a quota limit exhaustion (daily limits/billing), exit early
        if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("exhausted")) {
          console.error("      ❌ Daily/Quota limit exhausted. Exiting classification loop.");
          throw new Error(`Gemini Quota Exhausted: ${errMsg}`);
        }

        console.warn(`      Waiting ${delay / 1000}s before retry (Attempt ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        let bodyText = "";
        try {
          bodyText = await response.text();
        } catch (_e) {
          // Ignore error reading response body
        }
        throw new Error(`Gemini HTTP Error ${response.status}: ${bodyText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty content in Gemini response");
      }

      // Parse JSON response safely
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to match JSON structure in AI text response");
      }
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if (attempt === retries || err.message.includes("Quota Exhausted")) throw err;
      console.warn(`      ⚠️ Attempt ${attempt} failed: ${err.message}. Retrying in 4s...`);
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
  throw new Error("All retry attempts failed due to rate limits.");
}

generateDb();
