import { mapAdrBucket, mapLiquidityBucket, mapMovingAverageBucket } from "./utils/metrics.js";
import { getActualParamKeyAndDef } from "./utils/paramUtils.js";
import { getBulkStockVerdicts } from "./services/ai.js";
import { CONFIG } from "./constants/config.js";

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html"),
  });
});

let processingQueue = [];
let isProcessing = false;
let totalJobs = 0;
let completedJobs = 0;

let bulkAiQueue = [];
let isAiProcessing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "OPEN_DASHBOARD") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard.html"),
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "FETCH_STOCK_METRICS") {
    const {
      symbols,
      country,
      weekKey,
      paramDefs,
      adrDays = 20,
      liquidityDays = 20,
    } = message.payload;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) return;

    // Add new symbols to the queue
    symbols.forEach((symbol) => {
      processingQueue.push({
        symbol,
        country,
        weekKey,
        paramDefs,
        adrDays,
        liquidityDays,
      });
    });

    totalJobs += symbols.length;

    if (!isProcessing) {
      processQueue();
    }

    sendResponse({ status: "queued", count: symbols.length });
  }

  if (message.action === "RUN_BULK_AI_ANALYSIS") {
    bulkAiQueue.push(message.payload);
    if (!isAiProcessing) {
      processAiQueue();
    }
    sendResponse({ status: "started" });
  }
  return true;
});

async function processAiQueue() {
  if (bulkAiQueue.length === 0) {
    isAiProcessing = false;
    return;
  }
  isAiProcessing = true;
  const payload = bulkAiQueue.shift();
  
  const { stocks, apiKey, model, country, weekKey, watchlistName } = payload;
  const total = stocks.length;
  const chunkSize = 7;
  const results = {};
  
  // Estimate ~1 minute per stock based on Gemini "Thinking" time (6.8m per 7 stocks)
  const startTime = Date.now();
  const estimatedEndTime = startTime + (total * 60 * 1000);
  
  try {
    for (let i = 0; i < total; i += chunkSize) {
      chrome.runtime.sendMessage({
        action: "BULK_AI_PROGRESS",
        payload: { completed: i, total, startTime, estimatedEndTime }
      }).catch(() => {});
      
      const chunk = stocks.slice(i, i + chunkSize);
      const chunkResults = await getBulkStockVerdicts(apiKey, model, chunk);
      Object.assign(results, chunkResults);
      // Brief pause to respect API rate limits slightly
      if (i + chunkSize < total) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    chrome.runtime.sendMessage({
      action: "BULK_AI_PROGRESS",
      payload: { completed: total, total, startTime, estimatedEndTime }
    }).catch(() => {});

    // Now update storage
    const summary = { BUY: 0, WAIT: 0, SELL: 0, "STRONG BUY": 0 };
    let updatedCount = 0;

    await new Promise((resolve) => {
      chrome.storage.local.get(["trading_app_data"], (res) => {
        const db = res.trading_app_data;
        if (!db || !db.weeks || !db.weeks[country] || !db.weeks[country][weekKey]) {
          resolve();
          return;
        }

        const currentWeekData = db.weeks[country][weekKey];
        const newStocksData = { ...currentWeekData.stocks };

        Object.entries(results).forEach(([symbol, analysisData]) => {
          if (newStocksData[symbol] && analysisData && analysisData.verdict) {
            const verdict = analysisData.verdict.toUpperCase();
            if (summary[verdict] !== undefined) {
               summary[verdict]++;
            } else {
               summary[verdict] = 1;
            }

            let currentTags = newStocksData[symbol].tags || [];
            currentTags = currentTags.filter(t => !t.startsWith("AI: "));
            currentTags.push(`AI: ${verdict}`);

            newStocksData[symbol] = {
              ...newStocksData[symbol],
              tags: currentTags,
              aiAnalysis: `**Verdict:** ${verdict}\n\n**Reasoning:** ${analysisData.reasoning || ""}`,
              aiAnalysisDate: new Date().toLocaleString()
            };
            updatedCount++;
          }
        });

        const enrichedBulkAnalysis = {
          summary,
          timestamp: new Date().toISOString(),
          stockCount: total,
          updatedCount,
          watchlistName: watchlistName
        };

        db.weeks[country][weekKey].bulkAnalysis = enrichedBulkAnalysis;
        db.weeks[country][weekKey].stocks = newStocksData;
        
        if (!db.uiConfig) db.uiConfig = {};
        if (!db.uiConfig.tags) db.uiConfig.tags = [];
        ["AI: STRONG BUY", "AI: BUY", "AI: WAIT", "AI: SELL"].forEach(t => {
          if (!db.uiConfig.tags.includes(t)) {
             db.uiConfig.tags.push(t);
          }
        });

        chrome.storage.local.set({ trading_app_data: db }, () => {
          chrome.runtime.sendMessage({
            action: "BULK_AI_ANALYSIS_COMPLETE",
            payload: { updatedCount }
          }).catch(() => {});
          resolve();
        });
      });
    });

  } catch (error) {
    console.error("Background AI Analysis Failed:", error);
    chrome.runtime.sendMessage({
      action: "BULK_AI_ANALYSIS_FAILED",
      payload: { error: error.message || String(error) }
    }).catch(() => {});
  }

  // Continue queue
  setTimeout(processAiQueue, 1000);
}

async function processQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;

  // Take the next batch
  const batch = processingQueue.splice(0, CONFIG.BATCH_SIZE);

  const results = await Promise.allSettled(
    batch.map((item) =>
      fetchWithRetryAndTimeout(
        item.symbol,
        item.country,
        item.paramDefs,
        item.adrDays,
        item.liquidityDays,
      ),
    ),
  );

  const successfulUpdates = [];
  batch.forEach((item, index) => {
    const result = results[index];
    if (result.status === "fulfilled" && result.value) {
      successfulUpdates.push({
        ...item,
        metrics: result.value,
      });
    } else if (result.status === "rejected") {
      console.error(
        `Failed to fetch metrics for ${item.symbol}:`,
        result.reason,
      );
    }
  });

  if (successfulUpdates.length > 0) {
    await updateStorageWithMetrics(successfulUpdates);
  }

  completedJobs += batch.length;
  // Fire-and-forget message, catch error if no tab is listening
  chrome.runtime.sendMessage({
    action: "FETCH_PROGRESS",
    payload: { total: totalJobs, completed: completedJobs }
  }).catch(() => {});

  if (processingQueue.length > 0) {
    setTimeout(processQueue, CONFIG.BATCH_DELAY_MS);
  } else {
    isProcessing = false;
    // reset trackers so next batch starts clean
    totalJobs = 0;
    completedJobs = 0;
  }
}

async function fetchWithRetryAndTimeout(symbol, country, paramDefs, adrDays, liquidityDays, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchAndCalculateMetrics(symbol, country, paramDefs, adrDays, liquidityDays);
    } catch (err) {
      if (i === retries) throw err;
      // Exponential backoff or simple delay
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function fetchAndCalculateMetrics(
  symbol,
  country,
  paramDefs = null,
  adrDays = 20,
  liquidityDays = 20,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

  try {
    let ticker = symbol;
    if (country === "IN") {
      ticker = `${symbol}.NS`;
    }

    const maxDays = Math.max(adrDays, liquidityDays, 250);
    let range = "1mo";
    if (maxDays > 20) range = "3mo";
    if (maxDays > 60) range = "6mo";
    if (maxDays > 120) range = "1y";
    if (maxDays >= 250) range = "2y";

    // Fetch Data (Consolidating everything into the v8/chart API which is currently WORKING and bypasses 401s)
    const url = `${CONFIG.YAHOO_FINANCE_URL}${ticker}?range=${range}&interval=1d`;
    const response = await fetch(url, { 
       signal: controller.signal,
       headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return { isInvalid: true, name: "" };
      }
      throw new Error(`Data fetch error! status: ${response.status}`);
    }
    const data = await response.json();
    const result = data.chart?.result?.[0];
    const meta = result?.meta || {};

    if (
      !result ||
      !result.indicators ||
      !result.indicators.quote ||
      !result.indicators.quote[0]
    ) {
      return { isInvalid: true, name: meta.longName || meta.shortName || "" };
    }

    const companyName = meta.longName || meta.shortName || "";

    const quotes = result.indicators.quote[0];
    const adjCloses = result.indicators.adjclose?.[0]?.adjclose || [];
    const timestamps = result.timestamp || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const closes = quotes.close || [];
    const volumes = quotes.volume || [];

    // Filter and build historical bars with timestamps for sorting
    let rawBars = [];
    for (let i = 0; i < timestamps.length; i++) {
        const closeVal = adjCloses[i] !== undefined && adjCloses[i] !== null ? adjCloses[i] : closes[i];
        const rawClose = closes[i]; // Unadjusted close for turnover/liquidity calculation
        if (
            timestamps[i] != null &&
            highs[i] != null &&
            lows[i] != null &&
            closeVal != null &&
            rawClose != null &&
            volumes[i] != null
        ) {
            rawBars.push({
                timestamp: timestamps[i],
                high: highs[i],
                low: lows[i],
                close: closeVal,     // Adjusted close for SMA/MA calculations
                rawClose: rawClose,  // Unadjusted close for liquidity turnover
                volume: volumes[i],
            });
        }
    }

    if (rawBars.length === 0) return null;

    // Strict chronological sort: Oldest -> Newest
    const validDays = rawBars.sort((a, b) => a.timestamp - b.timestamp);

    let totalAdR = 0;

    const adrPeriod = validDays.slice(-adrDays);
    adrPeriod.forEach((day) => {
      const dailyRangePct = ((day.high - day.low) / day.low) * 100;
      totalAdR += dailyRangePct;
    });

    // Liquidity: compute per-day turnover (volume × unadjusted close), then average
    // Using unadjusted close because Yahoo Finance volume data is NOT split-adjusted
    const liqPeriod = validDays.slice(-liquidityDays);
    let totalTurnover = 0;
    liqPeriod.forEach((day) => {
      totalTurnover += day.volume * day.rawClose;
    });

    const avgAdr = adrPeriod.length > 0 ? totalAdR / adrPeriod.length : 0;
    const liquidityValue = liqPeriod.length > 0 ? totalTurnover / liqPeriod.length : 0;
    const lastClosePrice = validDays[validDays.length - 1].close;

    const adrMatch = getActualParamKeyAndDef(paramDefs, "adr", "adr", country);
    const liqMatch = getActualParamKeyAndDef(
      paramDefs,
      "liquidity",
      "liquidity",
      country,
    );

    let formattedAdr = "";
    let formattedLiquidity = "";

    const adrDef = adrMatch.def;
    const liqDef = liqMatch.def;

    // --- ADR MAPPING ---
    formattedAdr = mapAdrBucket(avgAdr, adrDef);

    // --- LIQUIDITY MAPPING ---
    formattedLiquidity = mapLiquidityBucket(liquidityValue, liqDef, country);

    // --- MOVING AVERAGES MAPPING ---
    const maMatch = getActualParamKeyAndDef(paramDefs, "movingAverages", "Moving Averages", country);
    const maBucket = mapMovingAverageBucket(validDays.map(d => d.close), lastClosePrice);

    return {
      adr: formattedAdr,
      liquidity: formattedLiquidity,
      movingAverages: maBucket,
      name: companyName,
      isInvalid: false,
      adrKey: adrMatch.key,
      liquidityKey: liqMatch.key,
      movingAveragesKey: maMatch.key,
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

          const adrKey = metrics.adrKey || "adr";
          const liqKey = metrics.liquidityKey || "liquidity";
          const maKey = metrics.movingAveragesKey || "movingAverages";

          // Only update if changed
          if (
            stock.params[adrKey] !== metrics.adr ||
            stock.params[liqKey] !== metrics.liquidity ||
            stock.params[maKey] !== metrics.movingAverages ||
            stock.name !== metrics.name ||
            stock.isInvalid !== metrics.isInvalid
          ) {
            stock.params[adrKey] = metrics.adr;
            stock.params[liqKey] = metrics.liquidity;
            stock.params[maKey] = metrics.movingAverages;
            stock.name = metrics.name;
            stock.isInvalid = metrics.isInvalid;
            dataChanged = true;
          }

          // Update the week-level timestamp whenever we process a successful sync
          weekData.lastUpdatedTime = Date.now();
        }
      });

      if (dataChanged) {
        chrome.storage.local.set({ trading_app_data: db }, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Background API Sync Failed - Storage Error:",
              chrome.runtime.lastError.message,
            );
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}


