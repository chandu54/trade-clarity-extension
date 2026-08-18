import { mapAdrBucket, mapLiquidityBucket, mapMovingAverageBucket } from "./utils/metrics.js";
import { getActualParamKeyAndDef } from "./utils/paramUtils.js";
import { calculateStockRsCategory } from "./utils/benchmarkUtils.js";
import { evaluateStageFromCandles } from "./utils/calculateStageMetric.ts";
import { evaluateVCPTightnessFromCandles } from "./utils/calculateVcpTightness.ts";
import { evaluateIPOTag } from "./utils/detectYoungIPO";
import { getBulkStockVerdicts } from "./services/ai.js";
import { fetchStockData } from "./utils/yahooFinanceMap.js";
import { CONFIG } from "./constants/config.js";
import stockMetadata from "./constants/stockMetadata.json";

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html"),
  });
});

let processingQueue = [];
let isProcessing = false;
let totalJobs = 0;
let completedJobs = 0;

let isAiProcessing = false;

// Helper functions for persistent MV3 Bulk AI queue state
async function saveActiveBulkAiTask(taskData) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  if (!taskData) {
    await new Promise(r => chrome.storage.local.remove(["active_bulk_ai_task"], r));
  } else {
    await new Promise(r => chrome.storage.local.set({ active_bulk_ai_task: taskData }, r));
  }
}

async function getActiveBulkAiTask() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
  const res = await new Promise(r => chrome.storage.local.get(["active_bulk_ai_task"], r));
  return res?.active_bulk_ai_task || null;
}

function calculateEstimatedEndTime(completed, total) {
  const remaining = Math.max(0, total - completed);
  if (remaining === 0) return Date.now();
  const chunkSize = 7;
  const remainingChunks = Math.ceil(remaining / chunkSize);
  // ~10s per API call/data fetch + 65s wait between chunks
  const remainingSecs = (remainingChunks * 10) + Math.max(0, (remainingChunks - 1) * 65);
  return Date.now() + (remainingSecs * 1000);
}

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

    let addedCount = 0;
    // Add new symbols to the queue, avoiding duplicates
    symbols.forEach((symbol) => {
      const isAlreadyQueued = processingQueue.some(
        (item) =>
          item.symbol === symbol &&
          item.country === country &&
          item.weekKey === weekKey
      );
      if (!isAlreadyQueued) {
        processingQueue.push({
          symbol,
          country,
          weekKey,
          paramDefs,
          adrDays,
          liquidityDays,
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      totalJobs += addedCount;

      if (!isProcessing) {
        processQueue();
      }
    }

    sendResponse({ status: "queued", count: addedCount });
  }

  if (message.action === "RUN_BULK_AI_ANALYSIS") {
    const total = message.payload.stocks?.length || 0;
    const startTime = Date.now();
    const estimatedEndTime = calculateEstimatedEndTime(0, total);

    const newTaskState = {
      payload: message.payload,
      currentIndex: 0,
      total,
      startTime,
      estimatedEndTime,
      status: "processing",
      results: {}
    };

    saveActiveBulkAiTask(newTaskState).then(() => {
      chrome.runtime.sendMessage({
        action: "BULK_AI_PROGRESS",
        payload: { completed: 0, total, startTime, estimatedEndTime }
      }).catch(() => {});

      if (!isAiProcessing) {
        processAiQueue();
      }
    });
    
    sendResponse({ status: "started" });
  }

  if (message.action === "STOP_BULK_AI") {
    isAiProcessing = false;
    saveActiveBulkAiTask(null);
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.clear("BULK_AI_ALARM").catch(() => {});
    }
    chrome.runtime.sendMessage({
      action: "BULK_AI_PROGRESS",
      payload: { total: 0, completed: 0 }
    }).catch(() => {});
    chrome.runtime.sendMessage({
      action: "BULK_AI_RATE_LIMIT_WAIT",
      payload: null
    }).catch(() => {});
    sendResponse({ status: "stopped" });
  }
  return true;
});

// Chrome MV3 Alarm Listener to wake up service worker if terminated during countdown delay
if (typeof chrome !== "undefined" && chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "BULK_AI_ALARM") {
      console.log("[BG] BULK_AI_ALARM triggered. Checking persistent queue...");
      const task = await getActiveBulkAiTask();
      if (task && task.status !== "stopped") {
        if (!isAiProcessing) {
          processAiQueue();
        }
      }
    }
  });
}

// Restore active task when Service Worker starts up after being terminated by MV3 lifecycle
if (typeof chrome !== "undefined") {
  getActiveBulkAiTask().then(task => {
    if (task && task.status !== "stopped" && task.total > 0) {
      console.log("[BG] Restoring active Bulk AI task on startup:", task);
      if (!isAiProcessing) {
        processAiQueue();
      }
    }
  }).catch(() => {});
}

/**
 * Parse the "retry in Xs" wait from a Gemini rate-limit error message.
 * Returns milliseconds, defaulting to 65s if not found.
 */
function parseRetryAfterMs(errorMessage, fallbackMs = 65000) {
  if (!errorMessage) return fallbackMs;
  const match = errorMessage.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 2000; // +2s safety buffer
  }
  return fallbackMs;
}

async function waitWithCountdown(seconds, completed, total) {
  if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.create("BULK_AI_ALARM", { when: Date.now() + (seconds * 1000) });
  }

  for (let s = seconds; s > 0; s--) {
    if (!isAiProcessing) {
      console.log("[BG] AI processing was cancelled. Stopping wait countdown.");
      break;
    }
    chrome.runtime.sendMessage({
      action: "BULK_AI_RATE_LIMIT_WAIT",
      payload: { waitSeconds: s, completed, total }
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
  }

  if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.clear("BULK_AI_ALARM").catch(() => {});
  }
}

async function processAiQueue() {
  if (isAiProcessing) {
    console.log("[BG] processAiQueue already active. Skipping duplicate invocation.");
    return;
  }
  isAiProcessing = true;

  try {
    const taskState = await getActiveBulkAiTask();
    if (!taskState || taskState.status === "stopped") {
      return;
    }
    
    // Check if AI is currently blocked
    const db = await _getStorageData();
    const blockedUntil = db.aiSettings?.aiState?.blockedUntil || 0;
    if (blockedUntil > Date.now()) {
      console.warn("[BG] AI is currently blocked. Clearing bulk AI task.");
      await saveActiveBulkAiTask(null);
      chrome.runtime.sendMessage({
        action: "BULK_AI_ANALYSIS_FAILED",
        payload: { error: "AI requests blocked due to rate limit/errors." }
      }).catch(() => {});
      return;
    }

    const { payload, currentIndex = 0, results = {} } = taskState;
  const { stocks, apiKey, model, country, weekKey, watchlistName } = payload;
  const total = stocks ? stocks.length : 0;
  const chunkSize = 7;
  const startTime = taskState.startTime || Date.now();
  const estimatedEndTime = taskState.estimatedEndTime || (startTime + (total * 60 * 1000));

  // Broadcast immediate progress so UI capsule shows instantly before network pre-fetch!
  chrome.runtime.sendMessage({
    action: "BULK_AI_PROGRESS",
    payload: { completed: currentIndex, total, startTime, estimatedEndTime }
  }).catch(() => {});

  // Pre-fetch 3mo market data (price, daily & period change pcts) so Gemini has full technical metrics
  let enrichedStocks = stocks;
  try {
    console.log(`[BG] Pre-fetching 3mo market data for ${total} stocks for bulk AI analysis...`);
    const marketData = await fetchStockData(stocks.map(s => s.symbol), country, "3mo");
    if (marketData && marketData.length > 0) {
      const marketDataMap = {};
      marketData.forEach(d => {
        marketDataMap[d.symbol] = d;
      });
      enrichedStocks = stocks.map(s => {
        const m = marketDataMap[s.symbol];
        if (m) {
          return {
            ...s,
            currentPrice: m.currentPrice,
            dailyChangePct: m.dailyChangePct,
            periodChangePct: m.periodChangePct,
            longName: m.longName || s.longName || s.shortName
          };
        }
        return s;
      });
    }
  } catch (mErr) {
    console.warn("[BG] Pre-fetching market data for bulk AI failed, falling back to basic data:", mErr);
  }

  // Resolve custom active bulk prompt from promptLibrary if configured
  let activeBulkPrompt = payload.bulkPromptText || null;
  if (!activeBulkPrompt) {
    try {
      const storageRes = await new Promise(r => chrome.storage.local.get(["trading_app_data"], r));
      const dbObj = storageRes?.trading_app_data;
      const defaultBulkId = dbObj?.aiSettings?.promptLibrary?.defaults?.bulk;
      if (defaultBulkId && defaultBulkId !== "system" && defaultBulkId !== "default" && defaultBulkId !== "bulk_analysis") {
        const customObj = dbObj?.aiSettings?.promptLibrary?.bulk?.find(p => p.id === defaultBulkId);
        if (customObj) activeBulkPrompt = customObj.text;
      }
    } catch (err) {
      console.warn("[BG] Could not resolve custom active bulk prompt:", err);
    }
  }

  for (let i = currentIndex; i < total; i += chunkSize) {
      const liveCheck = await getActiveBulkAiTask();
      if (!isAiProcessing || !liveCheck || liveCheck.status === "stopped") {
        console.log("[BG] AI processing was cancelled. Stopping queue execution.");
        break;
      }

      await saveActiveBulkAiTask({
        ...taskState,
        currentIndex: i,
        results,
        status: "processing"
      });

      const currentEstEnd = calculateEstimatedEndTime(i, total);

      // Clear rate-limit wait pill state in UI when fetching starts
      chrome.runtime.sendMessage({
        action: "BULK_AI_RATE_LIMIT_WAIT",
        payload: null
      }).catch(() => {});

      chrome.runtime.sendMessage({
        action: "BULK_AI_PROGRESS",
        payload: { completed: i, total, startTime, estimatedEndTime: currentEstEnd }
      }).catch(() => {});

      const chunk = enrichedStocks.slice(i, i + chunkSize);

      // Retry loop for this chunk — handles per-chunk 429s not caught inside ai.js
      let chunkResults = null;
      let chunkAttempt = 0;
      const maxChunkRetries = 3;
      while (chunkAttempt < maxChunkRetries) {
        try {
          chunkResults = await getBulkStockVerdicts(apiKey, model, chunk, "3mo", activeBulkPrompt);
          break; // success
        } catch (chunkErr) {
          const errMsg = chunkErr.message || "";
          const isRateLimit = errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("RESOURCE_EXHAUSTED");
          if (isRateLimit && chunkAttempt < maxChunkRetries - 1) {
            const waitMs = Math.min(parseRetryAfterMs(errMsg), 120000);
            const waitSeconds = Math.round(waitMs / 1000);
            console.warn(`[BG] Rate limit on chunk ${i}–${i + chunkSize}. Waiting ${waitSeconds}s (attempt ${chunkAttempt + 1}/${maxChunkRetries})...`);
            await waitWithCountdown(waitSeconds, i, total);
            chunkAttempt++;
          } else {
            throw chunkErr; // non-rate-limit error, or exhausted retries
          }
        }
      }

      if (chunkResults) {
        Object.assign(results, chunkResults);

        await saveActiveBulkAiTask({
          ...taskState,
          currentIndex: i + chunk.length,
          results,
          status: "processing"
        });

        // Write this chunk's results to chrome.storage.local immediately so they populate UI right away
        await new Promise((resolve) => {
          chrome.storage.local.get(["trading_app_data"], (res) => {
            const db = res.trading_app_data;
            if (!db || !db.weeks || !db.weeks[country] || !db.weeks[country][weekKey]) {
              resolve();
              return;
            }

            const currentWeekData = db.weeks[country][weekKey];
            const newStocksData = { ...currentWeekData.stocks };
            const summary = { BUY: 0, WAIT: 0, SELL: 0, "STRONG BUY": 0 };
            let updatedCount = 0;

            const nowStr = new Date().toLocaleString();
            const isoStr = new Date().toISOString();

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
                  aiAnalysisDate: nowStr,
                  aiTaggedAt: isoStr
                };
                updatedCount++;
              }
            });

            const enrichedBulkAnalysis = {
              summary,
              timestamp: isoStr,
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
              resolve();
            });
          });
        });
      }

      // Respect free-tier 20 RPM limit: wait ~65s between chunks so we never
      // exceed 1 request/minute (each chunk = 1 Gemini API call).
      if (i + chunkSize < total) {
        await saveActiveBulkAiTask({
          ...taskState,
          currentIndex: i + chunkSize,
          results,
          status: "waiting"
        });
        await waitWithCountdown(65, i + chunkSize, total);
      }
    }

    isAiProcessing = false;
    await saveActiveBulkAiTask(null);

    chrome.runtime.sendMessage({
      action: "BULK_AI_PROGRESS",
      payload: { completed: total, total, startTime, estimatedEndTime }
    }).catch(() => {});

    // Send completion message with final counts
    const finalUpdatedCount = Object.keys(results).filter(symbol => {
      const data = results[symbol];
      return data && data.verdict;
    }).length;

    chrome.runtime.sendMessage({
      action: "BULK_AI_ANALYSIS_COMPLETE",
      payload: { updatedCount: finalUpdatedCount }
    }).catch(() => {});

  } catch (error) {
    console.error("Background AI Analysis Failed:", error);
    await saveActiveBulkAiTask(null);
    chrome.runtime.sendMessage({
      action: "BULK_AI_ANALYSIS_FAILED",
      payload: { error: error.message || String(error) }
    }).catch(() => {});
  } finally {
    isAiProcessing = false;
  }
}

async function processQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;

  // Take the next batch
  const batch = processingQueue.splice(0, CONFIG.BATCH_SIZE);
  console.log(`[Sync] Processing batch of ${batch.length} symbols. Remaining in queue: ${processingQueue.length}`);

  const dbData = await _getStorageData();
  const uiConfig = dbData.uiConfig || {};

  const results = await Promise.allSettled(
    batch.map((item) =>
      fetchWithRetryAndTimeout(
        item.symbol,
        item.country,
        item.paramDefs,
        item.adrDays,
        item.liquidityDays,
        uiConfig,
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
    triggerBackgroundSectorClassification(successfulUpdates);
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
    chrome.runtime.sendMessage({
      action: "FETCH_METRICS_COMPLETE",
      payload: { total: totalJobs, completed: completedJobs }
    }).catch(() => {});
    // reset trackers so next batch starts clean
    totalJobs = 0;
    completedJobs = 0;
  }
}

async function fetchWithRetryAndTimeout(symbol, country, paramDefs, adrDays, liquidityDays, uiConfig = {}, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchAndCalculateMetrics(symbol, country, paramDefs, adrDays, liquidityDays, uiConfig);
    } catch (err) {
      if (i === retries || err.message?.includes("404")) throw err;
      const errMsg = err.message || "";
      const isRateLimit = errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("quota");
      
      const waitTime = isRateLimit ? 1000 * (i + 1) : 500 * (i + 1);
      console.warn(`[Sync] Fetch failed for ${symbol} (attempt ${i + 1}/${retries + 1}). Retrying in ${waitTime}ms... error:`, err);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

function _getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["trading_app_data"], (res) => {
      resolve(res?.trading_app_data || {});
    });
  });
}

let benchmarkReturnCache = {};

async function getCachedBenchmarkReturn(country, timeframe = "3mo") {
  const benchSymbol = country === "IN" ? "^NSEI" : "^GSPC";
  const cacheKey = `${benchSymbol}_${timeframe}`;
  const now = Date.now();
  if (benchmarkReturnCache[cacheKey] && benchmarkReturnCache[cacheKey].pct !== 0 && (now - benchmarkReturnCache[cacheKey].fetchedAt < 1800000)) {
    return benchmarkReturnCache[cacheKey].pct;
  }
  try {
    const res = await fetchStockData([benchSymbol], country, timeframe, null, null, false);
    const pct = res?.[0]?.periodChangePct || 0;
    benchmarkReturnCache[cacheKey] = { pct, fetchedAt: now };
    return pct;
  } catch (_err) {
    return 0;
  }
}

async function fetchAndCalculateMetrics(
  symbol,
  country,
  paramDefs = null,
  adrDays = 20,
  liquidityDays = 20,
  uiConfig = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

  try {
    let ticker = symbol;
    if (country === "IN" && !symbol.endsWith(".NS") && !symbol.endsWith(".BO") && !symbol.startsWith("^")) {
      ticker = `${symbol}.NS`;
    }

    const maxDays = uiConfig?.autoCalculateStage !== false
      ? Math.max(adrDays, liquidityDays, 250)
      : Math.max(adrDays, liquidityDays);
    let range = "1mo";
    if (maxDays > 20) range = "3mo";
    if (maxDays > 60) range = "6mo";
    if (maxDays >= 120) range = "1y";

    // Fetch Data (Consolidating everything into the v8/chart API which is currently WORKING and bypasses 401s)
    let url = `${CONFIG.YAHOO_FINANCE_URL}${ticker}?range=${range}&interval=1d`;
    console.log(`[Sync] Fetching historical data for ${symbol} via primary URL...`);
    let response = await fetch(url, { 
       signal: controller.signal,
       headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (response.status === 429) {
      const fallbackUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
      console.warn(`[Sync] Primary query returned 429 for ${symbol}. Failing over to query2...`);
      response = await fetch(fallbackUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    }

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
        let closeVal = null;
        if (adjCloses[i] !== null && adjCloses[i] !== undefined && adjCloses[i] > 0) {
          closeVal = adjCloses[i];
        } else if (closes[i] !== null && closes[i] !== undefined && closes[i] > 0) {
          closeVal = closes[i];
        }

        const rawClose = (closes[i] !== null && closes[i] !== undefined && closes[i] > 0) ? closes[i] : closeVal;

        if (timestamps[i] != null && closeVal != null && closeVal > 0) {
          const highVal = (highs[i] != null && highs[i] > 0) ? highs[i] : closeVal;
          const lowVal = (lows[i] != null && lows[i] > 0) ? lows[i] : closeVal;
          const volumeVal = (volumes[i] != null && volumes[i] >= 0) ? volumes[i] : 0;

          rawBars.push({
            timestamp: timestamps[i],
            high: highVal,
            low: lowVal,
            close: closeVal,
            rawClose: rawClose,
            volume: volumeVal,
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

    // --- RELATIVE STRENGTH (RS) MAPPING ---
    const rsMatch = getActualParamKeyAndDef(paramDefs, "rs", "rs", country);
    let rsCategory = "Neutral";
    if (validDays.length > 0) {
      const timeframe = uiConfig?.rsTimeframe || "3mo";
      // Map RS timeframe to approximate trading days
      const rsTradingDays = { '1mo': 21, '3mo': 63, '6mo': 126, '1y': 252 };
      const rsWindow = rsTradingDays[timeframe] || 63;
      // Slice only the RS timeframe window from the end of validDays
      const rsDays = validDays.slice(-Math.min(rsWindow, validDays.length));
      const firstClose = rsDays[0].close;
      const lastClose = rsDays[rsDays.length - 1].close;
      const stockPct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
      const benchPct = await getCachedBenchmarkReturn(country, timeframe);
      const { category } = calculateStockRsCategory(stockPct, benchPct, uiConfig || {});
      rsCategory = category;
    }

    // --- STAGE MAPPING (Stan Weinstein Stage Analysis) ---
    const stageMatch = getActualParamKeyAndDef(paramDefs, "stage", "Stage", country);
    let stageCategory = "";
    if (uiConfig?.autoCalculateStage !== false && validDays.length >= 200) {
      const stageResult = evaluateStageFromCandles(symbol, validDays);
      if (stageResult.status === "SUCCESS" && stageResult.mappedOption) {
        stageCategory = stageResult.mappedOption;
      }
    }

    // --- VCP TIGHTNESS MAPPING ---
    const vcpResult = evaluateVCPTightnessFromCandles(validDays);
    const vcpCategory = vcpResult.category;
    const vcpDisplayText = vcpResult.displayText;
    const isTightVCP = vcpResult.isTight;

    // --- IPO TAG MAPPING ---
    const ipoResult = evaluateIPOTag(symbol, validDays);
    const isYoungIPO = ipoResult.isYoungIPO;

    console.log(`[Sync] Computed for ${symbol}: ADR=${formattedAdr}, Liquidity=${formattedLiquidity}, MAs=${maBucket}, RS=${rsCategory}, Stage=${stageCategory}, VCP=${vcpDisplayText}, YoungIPO=${isYoungIPO}`);

    return {
      adr: formattedAdr,
      liquidity: formattedLiquidity,
      movingAverages: maBucket,
      rs: rsCategory,
      stage: stageCategory,
      vcp_tightness: vcpCategory,
      vcp_tightness_display: vcpDisplayText,
      isTightVCP: isTightVCP,
      isYoungIPO: isYoungIPO,
      name: companyName,
      isInvalid: false,
      adrKey: adrMatch.key,
      liquidityKey: liqMatch.key,
      movingAveragesKey: maMatch.key,
      rsKey: rsMatch.key,
      stageKey: stageMatch.key,
    };
  } catch (error) {
    clearTimeout(timeoutId);
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
          const rsKey = metrics.rsKey || "rs";
          const stageKey = metrics.stageKey || "stage";

          // Auto-apply Young IPO tag if stock has < 60 days of historical candles
          if (metrics.isYoungIPO) {
            const currentTags = stock.tags || [];
            if (!currentTags.includes("Young IPO")) {
              stock.tags = [...currentTags, "Young IPO"];
              dataChanged = true;
            }
          }

          // Auto-apply AI:Tight VCP tag if 10-day tightness is < 4%
          if (metrics.isTightVCP) {
            const currentTags = stock.tags || [];
            if (!currentTags.includes("AI:Tight VCP")) {
              stock.tags = [...currentTags, "AI:Tight VCP"];
              dataChanged = true;
            }
          }

          // Only update if changed
          if (
            stock.params[adrKey] !== metrics.adr ||
            stock.params[liqKey] !== metrics.liquidity ||
            stock.params[maKey] !== metrics.movingAverages ||
            stock.params[rsKey] !== metrics.rs ||
            (metrics.stage && stock.params[stageKey] !== metrics.stage) ||
            stock.params['vcp_tightness'] !== metrics.vcp_tightness ||
            stock.name !== metrics.name ||
            stock.isInvalid !== metrics.isInvalid
          ) {
            stock.params[adrKey] = metrics.adr;
            stock.params['adr'] = metrics.adr;
            stock.params[`${country.toLowerCase()}.adr`] = metrics.adr;

            stock.params[liqKey] = metrics.liquidity;
            stock.params['liquidity'] = metrics.liquidity;
            stock.params[`${country.toLowerCase()}.liquidity`] = metrics.liquidity;

            stock.params[maKey] = metrics.movingAverages;
            stock.params['movingAverages'] = metrics.movingAverages;

            stock.params[rsKey] = metrics.rs;
            stock.params['rs'] = metrics.rs;
            stock.params[`${country.toLowerCase()}.rs`] = metrics.rs;

            if (metrics.stage) {
              stock.params[stageKey] = metrics.stage;
              stock.params['stage'] = metrics.stage;
              stock.params[`${country.toLowerCase()}.stage`] = metrics.stage;
            }

            if (metrics.vcp_tightness) {
              stock.params['vcp_tightness'] = metrics.vcp_tightness;
              stock.params['vcpTightness'] = metrics.vcp_tightness;
              stock.params[`${country.toLowerCase()}.vcp_tightness`] = metrics.vcp_tightness;
              stock.params['vcp_tightness_display'] = metrics.vcp_tightness_display;
            }

            stock.name = metrics.name;
            stock.isInvalid = metrics.isInvalid;
            dataChanged = true;
          }



          // Mark stock as successfully synced today
          stock.lastSyncTime = Date.now();
          dataChanged = true;

          // Update the week-level timestamp whenever we process a successful sync
          weekData.lastUpdatedTime = Date.now();
        }
      });

      console.log(`[Sync] Saving metrics changes to storage for ${updates.map(u => u.symbol).join(', ')}. dataChanged=${dataChanged}`);

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

const SECTOR_ALIASES = {
  "banking": "Banks",
  "bank": "Banks",
  "banks": "Banks",
  "it services": "IT",
  "information technology": "IT",
  "software": "IT",
  "software services": "IT",
  "pharmaceuticals": "Pharma",
  "pharmaceutical": "Pharma",
  "pharma": "Pharma",
  "automobile": "Auto",
  "automobiles": "Auto",
  "defense": "Defence",
  "defence": "Defence",
  "aerospace & defense": "Defence",
  "aerospace & defence": "Defence",
  "financial services": "Finance",
  "financial": "Finance",
  "oil & gas": "Oil Refinery",
  "refinery": "Oil Refinery",
  "metals": "Metals/Minerals",
  "minerals": "Metals/Minerals",
  "metals/minerals": "Metals/Minerals",
  "mining": "Metals/Minerals",
  "electricals": "Electricals",
  "electrical equipment": "Electricals",
  "construction": "Construction",
  "real estate": "Construction",
  "infrastructure": "Construction",
  "telecom": "Communications",
  "communications": "Communications",
  "telecommunications": "Communications"
};

function normalizeSectorName(name, existingSectors = []) {
  if (!name) return "Miscellaneous";
  const clean = name.trim().toLowerCase();
  
  // 1. Check alias dictionary
  if (SECTOR_ALIASES[clean]) {
    return SECTOR_ALIASES[clean];
  }
  
  // 2. Case-insensitive exact check in user's existing sectors
  const matchedSector = existingSectors.find(
    (s) => (s.name || "").toLowerCase() === clean
  );
  if (matchedSector) {
    return matchedSector.name || matchedSector;
  }
  
  // 3. Fallback: stem matching (plurals/singulars)
  const cleanStem = clean.replace(/s$/, ""); // remove plural 's'
  const matchedStem = existingSectors.find((s) => {
    const sClean = (s.name || "").toLowerCase().replace(/s$/, "");
    return sClean === cleanStem;
  });
  if (matchedStem) {
    return matchedStem.name || matchedStem;
  }
  
  // Return the original capitalized sector
  return name;
}

async function updateStorageWithSectors(mappings, country, weekKey) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["trading_app_data"], (result) => {
      const db = result.trading_app_data;
      if (!db || !db.weeks) {
        resolve();
        return;
      }

      let dataChanged = false;
      let cacheChanged = false;
      
      if (!db.stockSectorCache) {
        db.stockSectorCache = {};
      }

      Object.entries(mappings).forEach(([symbol, valObj]) => {
        let resolvedSector = valObj?.sector;
        if (!resolvedSector) return;

        const symUpper = symbol.toUpperCase();
        if (db.stockSectorCache[symUpper] !== resolvedSector) {
          db.stockSectorCache[symUpper] = resolvedSector;
          cacheChanged = true;
        }

        const weekData = db.weeks[country]?.[weekKey];
        if (weekData && weekData.stocks && weekData.stocks[symbol]) {
          const stock = weekData.stocks[symbol];
          
          // Update sector if currently unset/empty
          if (resolvedSector && !stock.sector) {
            // Normalize resolved sector name using aliases & user's configuration
            db.uiConfig = db.uiConfig || {};
            db.uiConfig.sectors = db.uiConfig.sectors || [];
            
            resolvedSector = normalizeSectorName(resolvedSector, db.uiConfig.sectors);
            
            stock.sector = resolvedSector;
            dataChanged = true;

            // Register sector in config if missing
            const existingSector = db.uiConfig.sectors.find(
              (s) => (s.name || "").toLowerCase() === resolvedSector.toLowerCase()
            );

            if (!existingSector) {
              const newSector = { name: resolvedSector, countries: [country] };
              db.uiConfig.sectors.push(newSector);
              if (Array.isArray(db.sectors)) {
                db.sectors.push(newSector);
              }
            } else {
              existingSector.countries = existingSector.countries || [];
              if (!existingSector.countries.includes(country)) {
                existingSector.countries.push(country);
                if (Array.isArray(db.sectors)) {
                  const legacySector = db.sectors.find(
                    (s) => (s.name || "").toLowerCase() === resolvedSector.toLowerCase()
                  );
                  if (legacySector) {
                    legacySector.countries = legacySector.countries || [];
                    if (!legacySector.countries.includes(country)) {
                      legacySector.countries.push(country);
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (dataChanged || cacheChanged) {
        chrome.storage.local.set({ trading_app_data: db }, resolve);
      } else {
        resolve();
      }
    });
  });
}

async function triggerBackgroundSectorClassification(updates) {
  chrome.storage.local.get(["trading_app_data"], async (result) => {
    const db = result.trading_app_data;
    if (!db || !db.weeks) return;
    
    const uiConfig = db.uiConfig || {};
    const autoIdentify = uiConfig.autoIdentifySectors !== false;
    if (!autoIdentify) return;
    
    const localResolvedMappingsByGroup = {}; // keyed by `country_weekKey`

    updates.forEach(({ symbol, country, weekKey }) => {
      const weekData = db.weeks[country]?.[weekKey];
      const stock = weekData?.stocks?.[symbol];
      if (stock && !stock.sector) {
        const symUpper = symbol.toUpperCase();
        // 1. Try global cache first
        const cachedSector = db.stockSectorCache?.[symUpper];
        if (cachedSector) {
          const groupKey = `${country}_${weekKey}`;
          if (!localResolvedMappingsByGroup[groupKey]) {
            localResolvedMappingsByGroup[groupKey] = {};
          }
          localResolvedMappingsByGroup[groupKey][symbol] = {
            sector: cachedSector
          };
          console.log(`[Sync] Cache resolved sector for ${symbol}: ${cachedSector}`);
        } else {
          // 2. Try local stockMetadata JSON lookup
          const localMeta = stockMetadata[country]?.[symUpper];
          if (localMeta && localMeta.sector) {
            const groupKey = `${country}_${weekKey}`;
            if (!localResolvedMappingsByGroup[groupKey]) {
              localResolvedMappingsByGroup[groupKey] = {};
            }
            localResolvedMappingsByGroup[groupKey][symbol] = {
              sector: localMeta.sector
            };
            console.log(`[Sync] Locally resolved sector for ${symbol}: ${localMeta.sector}`);
          }
        }
      }
    });

    // Save any locally resolved sector mappings immediately
    for (const [groupKey, mappings] of Object.entries(localResolvedMappingsByGroup)) {
      const [country, weekKey] = groupKey.split("_");
      await updateStorageWithSectors(mappings, country, weekKey);
      chrome.runtime.sendMessage({ action: "SECTORS_UPDATED" }).catch(() => {});
    }
  });
}



