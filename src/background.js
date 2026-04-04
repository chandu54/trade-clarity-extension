import { mapAdrBucket, mapLiquidityBucket } from "./utils/metrics.js";
import { getActualParamKeyAndDef } from "./utils/paramUtils.js";

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html"),
  });
});

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
  // Production: Remove noisy logs, keep them in dev only if needed.

  const results = await Promise.allSettled(
    batch.map((item) =>
      fetchAndCalculateMetrics(
        item.symbol,
        item.country,
        item.paramDefs,
        item.adrDays,
        item.liquidityDays,
      ),
    ),
  );

  // Filter out successful results
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

  // If there's more in the queue, wait and process the next batch
  if (processingQueue.length > 0) {
    setTimeout(processQueue, BATCH_DELAY_MS);
  } else {
    isProcessing = false;
  }
}

async function fetchAndCalculateMetrics(
  symbol,
  country,
  paramDefs = null,
  adrDays = 20,
  liquidityDays = 20,
) {
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
      console.error(
        `Yahoo Finance API error for ${ticker}: status ${response.status}`,
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const result = data.chart?.result?.[0];
    if (
      !result ||
      !result.indicators ||
      !result.indicators.quote ||
      !result.indicators.quote[0]
    ) {
      console.warn(
        `No quote data found for ${ticker} (requested country: ${country})`,
      );
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
      if (
        highs[i] != null &&
        lows[i] != null &&
        closes[i] != null &&
        volumes[i] != null
      ) {
        validDays.push({
          high: highs[i],
          low: lows[i],
          close: closes[i],
          volume: volumes[i],
        });
      }
    }

    if (validDays.length === 0) return null;

    let totalAdR = 0;
    let totalVolume = 0;

    const adrPeriod = validDays.slice(-adrDays);
    adrPeriod.forEach((day) => {
      const dailyRangePct = ((day.high - day.low) / day.low) * 100;
      totalAdR += dailyRangePct;
    });

    const liqPeriod = validDays.slice(-liquidityDays);
    liqPeriod.forEach((day) => {
      totalVolume += day.volume;
    });

    const avgAdr = adrPeriod.length > 0 ? totalAdR / adrPeriod.length : 0;
    const avgVolume = liqPeriod.length > 0 ? totalVolume / liqPeriod.length : 0;
    const lastClosePrice = validDays[validDays.length - 1].close;
    const liquidityValue = avgVolume * lastClosePrice;

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

    return {
      adr: formattedAdr,
      liquidity: formattedLiquidity,
      adrKey: adrMatch.key,
      liquidityKey: liqMatch.key,
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

          // Only update if changed
          if (
            stock.params[adrKey] !== metrics.adr ||
            stock.params[liqKey] !== metrics.liquidity
          ) {
            stock.params[adrKey] = metrics.adr;
            stock.params[liqKey] = metrics.liquidity;
            dataChanged = true;
          }
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
