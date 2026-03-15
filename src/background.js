chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html"),
  });
});

/* =========================================================================
   BACKGROUND API HYDRATION FOR ADR & LIQUIDITY
========================================================================= */

let processingQueue = [];
let isProcessing = false;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "OPEN_DASHBOARD") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard.html"),
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "FETCH_STOCK_METRICS") {
    // We now receive paramDefs to dynamically match numerical API data to the user's custom buckets/field types
    const { symbols, country, weekKey, paramDefs, adrDays = 20, liquidityDays = 20 } = message.payload;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) return;

    // Add new symbols to the queue
    symbols.forEach(symbol => {
      processingQueue.push({ symbol, country, weekKey, paramDefs, adrDays, liquidityDays });
    });

    // Start processing if not already running
    if (!isProcessing) {
      processQueue();
    }
    
    // Send immediate response so the sender doesn't wait
    sendResponse({ status: "queued", count: symbols.length });
  }
  return true; 
});

async function processQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;

  // Take the next batch
  const batch = processingQueue.splice(0, BATCH_SIZE);
  console.log(`Processing batch of ${batch.length} stocks. Remaining in queue: ${processingQueue.length}`);

  const results = await Promise.allSettled(batch.map(item => fetchAndCalculateMetrics(item.symbol, item.country, item.paramDefs, item.adrDays, item.liquidityDays)));

  // Filter out successful results
  const successfulUpdates = [];
  batch.forEach((item, index) => {
    const result = results[index];
    if (result.status === "fulfilled" && result.value) {
      successfulUpdates.push({
        ...item,
        metrics: result.value
      });
    } else if (result.status === "rejected") {
      console.error(`Failed to fetch metrics for ${item.symbol}:`, result.reason);
    }
  });

  if (successfulUpdates.length > 0) {
    await updateStorageWithMetrics(successfulUpdates);
  }

  // If there's more in the queue, wait and process the next batch
  if (processingQueue.length > 0) {
    setTimeout(processQueue, BATCH_DELAY_MS);
  } else {
    console.log("Finished processing all background API hydration requests.");
    isProcessing = false;
  }
}

async function fetchAndCalculateMetrics(symbol, country, paramDefs = null, adrDays = 20, liquidityDays = 20) {
  try {
    // Format symbol for Yahoo Finance if Indian
    let ticker = symbol;
    if (country === "IN") {
      ticker = `${symbol}.NS`;
    }

    const maxDays = Math.max(adrDays, liquidityDays);
    let range = "1mo";
    if (maxDays > 20) range = "3mo";
    if (maxDays > 60) range = "6mo";
    if (maxDays > 120) range = "1y";

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const result = data.chart?.result?.[0];
    if (!result || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
      console.warn(`No quote data found for ${ticker}`);
      return null;
    }

    const quotes = result.indicators.quote[0];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const closes = quotes.close || [];
    const volumes = quotes.volume || [];

    // Filter out nulls/undefined from Yahoo API missing days
    const validDays = [];
    for (let i = 0; i < closes.length; i++) {
        if (highs[i] != null && lows[i] != null && closes[i] != null && volumes[i] != null) {
            validDays.push({
                high: highs[i],
                low: lows[i],
                close: closes[i],
                volume: volumes[i]
            });
        }
    }

    if (validDays.length === 0) return null;

    let totalAdR = 0;
    let totalVolume = 0;

    const adrPeriod = validDays.slice(-adrDays);
    adrPeriod.forEach(day => {
       const dailyRangePct = ((day.high - day.low) / day.low) * 100;
       totalAdR += dailyRangePct;
    });

    const liqPeriod = validDays.slice(-liquidityDays);
    liqPeriod.forEach(day => {
       totalVolume += day.volume;
    });

    const avgAdr = adrPeriod.length > 0 ? (totalAdR / adrPeriod.length) : 0;
    const avgVolume = liqPeriod.length > 0 ? (totalVolume / liqPeriod.length) : 0;
    const lastClosePrice = validDays[validDays.length - 1].close;
    const liquidityValue = avgVolume * lastClosePrice; 

    // ---------------------------------------------------------
    // DYNAMIC MAPPING TO USER-DEFINED PARAMS
    // ---------------------------------------------------------
    const getActualParamKeyAndDef = (defs, defaultKey, labelName) => {
        if (defs?.[defaultKey]) return { key: defaultKey, def: defs[defaultKey] };
        for (const [k, v] of Object.entries(defs || {})) {
            if (v.label?.toLowerCase() === labelName.toLowerCase()) return { key: k, def: v };
        }
        return { key: defaultKey, def: null };
    };

    const adrMatch = getActualParamKeyAndDef(paramDefs, 'adr', 'adr');
    const liqMatch = getActualParamKeyAndDef(paramDefs, 'liquidity', 'liquidity');

    let formattedAdr = "";
    let formattedLiquidity = "";

    const adrDef = adrMatch.def;
    const liqDef = liqMatch.def;

    // --- ADR MAPPING ---
    if (adrDef?.type === "number") {
      formattedAdr = avgAdr.toFixed(2);
    } else if (adrDef?.type === "select" && Array.isArray(adrDef.options) && adrDef.options.length > 0) {
       const targetVal = Math.round(avgAdr);
       let closestDiff = Infinity;
       let closestOpt = adrDef.options[0];
       
       for (const opt of adrDef.options) {
           const optNum = Number(opt);
           if (!isNaN(optNum)) {
               const diff = Math.abs(optNum - targetVal);
               if (diff < closestDiff) {
                   closestDiff = diff;
                   closestOpt = opt;
               }
           }
       }
       formattedAdr = closestOpt;
    } else {
       // Fallback
       formattedAdr = Math.min(Math.max(Math.round(avgAdr), 1), 10);
    }

    // --- LIQUIDITY MAPPING ---
    let targetNumVal = liquidityValue;
    if (country === "IN") {
       targetNumVal = liquidityValue / 10000000; // Convert to Crores
    } else {
       targetNumVal = liquidityValue / 1000000; // Convert to Millions for others
    }

    if (liqDef?.type === "number") {
       formattedLiquidity = targetNumVal.toFixed(2);
    } else if (liqDef?.type === "select" && Array.isArray(liqDef.options) && liqDef.options.length > 0) {
       let matchedBucket = null;
       
       const parsedOptions = liqDef.options.map(opt => {
           const str = String(opt);
           const numbers = str.match(/\d+/g); 
           let maxInStr = numbers && numbers.length > 0 ? Math.max(...numbers.map(Number)) : Infinity;
           
           const isLessThan = str.includes("<") || str.toLowerCase().includes("under");
           const isGreaterThan = str.includes(">") || str.includes("+") || str.toLowerCase().includes("over");
           
           return { original: opt, max: maxInStr, isLessThan, isGreaterThan, numbers };
       }).sort((a,b) => a.max - b.max);

       for (const opt of parsedOptions) {
          if (opt.isLessThan) {
             if (targetNumVal <= opt.max) {
                 matchedBucket = opt.original;
                 break;
             }
          } else if (opt.isGreaterThan) {
             if (targetNumVal >= opt.max) {
                 matchedBucket = opt.original;
                 break;
             }
          } else if (opt.numbers && opt.numbers.length >= 2) {
             const min = Math.min(...opt.numbers.map(Number));
             const max = Math.max(...opt.numbers.map(Number));
             if (targetNumVal >= min && targetNumVal <= max) {
                 matchedBucket = opt.original;
                 break;
             }
          } else {
             if (targetNumVal <= opt.max) {
                 matchedBucket = opt.original;
                 break;
             }
          }
       }

       if (!matchedBucket && parsedOptions.length > 0) {
           matchedBucket = parsedOptions[parsedOptions.length - 1].original;
       }

       formattedLiquidity = matchedBucket;

    } else {
       // Fallback
       if (country === "IN") {
           if (targetNumVal <= 20) formattedLiquidity = "<=20Cr";
           else if (targetNumVal <= 49) formattedLiquidity = "21 to 49Cr";
           else if (targetNumVal <= 99) formattedLiquidity = "50 to 99Cr";
           else if (targetNumVal <= 199) formattedLiquidity = "100Cr to 199Cr";
           else if (targetNumVal <= 499) formattedLiquidity = "200Cr to 499Cr";
           else if (targetNumVal <= 999) formattedLiquidity = "500Cr+";
           else if (targetNumVal <= 1499) formattedLiquidity = "1000Cr+";
           else if (targetNumVal <= 1999) formattedLiquidity = "1500Cr+";
           else formattedLiquidity = "2000Cr+";
       } else {
           formattedLiquidity = `${targetNumVal.toFixed(2)}M`;
       }
    }

    return {
        adr: formattedAdr,
        liquidity: formattedLiquidity,
        adrKey: adrMatch.key,
        liquidityKey: liqMatch.key
    };

  } catch (error) {
    throw error;
  }
}

async function updateStorageWithMetrics(updates) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["trading_app_data"], (result) => {
      const db = result.trading_app_data;
      if (!db || !db.weeks) {
        resolve();
        return;
      }

      let dataChanged = false;

      updates.forEach(({ symbol, country, weekKey, metrics }) => {
        const weekData = db.weeks[country]?.[weekKey];
        if (weekData && weekData.stocks && weekData.stocks[symbol]) {
          const stock = weekData.stocks[symbol];
          stock.params = stock.params || {};

          const adrKey = metrics.adrKey || 'adr';
          const liqKey = metrics.liquidityKey || 'liquidity';

          // Only update if changed
          if (stock.params[adrKey] !== metrics.adr || stock.params[liqKey] !== metrics.liquidity) {
             stock.params[adrKey] = metrics.adr;
             stock.params[liqKey] = metrics.liquidity;
             dataChanged = true;
          }
        }
      });

      if (dataChanged) {
        chrome.storage.local.set({ trading_app_data: db }, () => {
          if (chrome.runtime.lastError) {
             console.error("Background API Sync Failed - Storage Error:", chrome.runtime.lastError.message);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}
