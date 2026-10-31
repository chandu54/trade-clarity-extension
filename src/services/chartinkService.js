/**
 * Chartink Screener Integration Service
 * Programmatically fetches stock symbols from Chartink screener without UI scraping.
 */

const DEFAULT_SCREENER_URL = "https://chartink.com/screener/legacy-scanner-atvvvstockanalyst";
const PROCESS_URL = "https://chartink.com/screener/process";
const FALLBACK_SCAN_CLAUSE = "( {cash} ( latest close >= latest max( 250 , latest high ) * 0.75 and market cap >= 1000 and latest close >= latest ema( latest close , 50 ) and latest close >= latest ema( latest close , 200 ) ) )";

const BLACKLIST = new Set([
  "RUN", "SCAN", "LEGACY", "SR.", "VIEW", "COPY", "CSV", 
  "JSON", "EXCEL", "FILTER", "CHART", "LOGOUT"
]);

/**
 * Executes direct HTTP request flow to Chartink screener.
 */
export async function executeChartinkFetch(screenerUrl = DEFAULT_SCREENER_URL) {
  // 1. Fetch HTML
  const getRes = await fetch(screenerUrl, {
    method: "GET",
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  });

  if (!getRes.ok) {
    throw new Error(`Chartink screener page returned HTTP ${getRes.status}`);
  }

  const html = await getRes.text();
  const rawCookies = getRes.headers.get("set-cookie");

  // 2. Extract CSRF token
  const csrfMatch = html.match(/<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i);
  const csrfToken = csrfMatch ? csrfMatch[1] : null;

  if (!csrfToken) {
    throw new Error("Unable to locate CSRF token in Chartink markup.");
  }

  // 3. Extract Scan Clause
  let scanClause = null;
  const inputMatch = html.match(/name=["']scan_clause["'][^>]*value=["']([^"']+)["']/i);
  if (inputMatch) {
    scanClause = inputMatch[1];
  } else {
    const jsonMatch = html.match(/:scan-json="([^"]+)"/i);
    if (jsonMatch) {
      try {
        const decoded = jsonMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        const parsed = JSON.parse(decoded);
        scanClause = parsed.atlas_query || parsed.scan_clause;
      } catch {
        // Use fallback if json parse fails
      }
    }
  }

  if (!scanClause) {
    scanClause = FALLBACK_SCAN_CLAUSE;
  }

  const cookieHeader = rawCookies
    ? rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ')
    : '';

  // 4. Issue POST request to /screener/process
  const postRes = await fetch(PROCESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-csrf-token": csrfToken,
      "Referer": screenerUrl,
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...(cookieHeader ? { "Cookie": cookieHeader } : {})
    },
    body: new URLSearchParams({ scan_clause: scanClause })
  });

  if (!postRes.ok) {
    throw new Error(`Chartink /screener/process returned HTTP ${postRes.status}`);
  }

  const data = await postRes.json();
  if (!data || !Array.isArray(data.data)) {
    throw new Error("Invalid response format from Chartink process endpoint.");
  }

  // 5. Clean & deduplicate tickers
  const symbols = [];
  data.data.forEach(item => {
    const raw = item.nsecode || item.name || "";
    const clean = String(raw).trim().toUpperCase().replace(/\.(NS|BO)$/, "");
    if (clean && /^[A-Z0-9.\-_]{2,15}$/.test(clean) && !BLACKLIST.has(clean)) {
      if (!symbols.includes(clean)) {
        symbols.push(clean);
      }
    }
  });

  return symbols;
}

/**
 * Public function to fetch Chartink symbols.
 * Tries background service worker message first, falls back to direct fetch.
 */
export async function fetchChartinkSymbols(screenerUrl = DEFAULT_SCREENER_URL) {
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "FETCH_CHARTINK_SCANNER", screenerUrl },
          (res) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve(res);
          }
        );
      });

      if (response && response.success && Array.isArray(response.symbols)) {
        return response.symbols;
      }
      if (response && response.error) {
        throw new Error(response.error);
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  return await executeChartinkFetch(screenerUrl);
}

/**
 * Filter stocks according to technical setup criteria:
 * Supports default or customizable user criteria:
 * - maAlignment: "21_50_200" | "50_200" | "all" | "any"
 * - minLiquidity: number (in Crores for IN)
 * - rsRating: "strong_neutral" | "strong_only" | "very_strong" | "any"
 * - stage: "stage_2" | "stage_1_2" | "any"
 */
export function filterPassingSetups(stocksObj = {}, country = "IN", criteria = {}) {
  if (!stocksObj || typeof stocksObj !== "object") return [];
  const passingSymbols = [];
  const cLow = (country || "IN").toLowerCase();

  const {
    maAlignment = "21_50_200",
    minLiquidity = 50,
    maxLiquidity = 0,
    rsRating = "strong_neutral",
    stage = "stage_2",
  } = criteria || {};

  Object.entries(stocksObj).forEach(([symbol, stock]) => {
    if (!stock) return;

    // 1. Moving Average Check
    const maStr = String(
      stock.movingAverages ||
      stock.params?.movingAverages ||
      stock.params?.[`${cLow}.movingAverages`] ||
      ""
    );

    let maPass = true;
    if (maAlignment === "21_50_200") {
      maPass =
        maStr.includes("21") &&
        maStr.includes("50") &&
        !maStr.toLowerCase().includes("below") &&
        (maStr.includes("200") || !maStr.toLowerCase().includes("below 200"));
    } else if (maAlignment === "50_200") {
      maPass =
        maStr.includes("50") &&
        !maStr.toLowerCase().includes("below") &&
        (maStr.includes("200") || !maStr.toLowerCase().includes("below 200"));
    } else if (maAlignment === "all") {
      maPass =
        maStr.includes("5") &&
        maStr.includes("10") &&
        maStr.includes("21") &&
        maStr.includes("50") &&
        !maStr.toLowerCase().includes("below") &&
        (maStr.includes("200") || !maStr.toLowerCase().includes("below 200"));
    } else if (maAlignment === "any") {
      maPass = true;
    }

    // 2. Liquidity Check: minLiquidity & maxLiquidity (Cr for IN)
    let liqCr = 0;
    if (typeof stock.turnoverCr === "number" && stock.turnoverCr > 0) {
      liqCr = stock.turnoverCr;
    } else if (typeof stock.liquidityVal === "number" && stock.liquidityVal > 0) {
      liqCr = stock.liquidityVal / 10000000;
    } else {
      const rawLiq = String(
        stock.params?.[`${cLow}.liquidity`] ||
        stock.params?.liquidity ||
        stock.params?.["in.liquidity"] ||
        stock[`${cLow}.liquidity`] ||
        stock.liquidity ||
        stock["in.liquidity"] ||
        ""
      ).trim();

      if (rawLiq) {
        if (rawLiq.startsWith("<=") || rawLiq.toLowerCase().includes("under")) {
          const numbers = (rawLiq.match(/\d*\.?\d+/g) || []).map(Number);
          liqCr = numbers.length > 0 ? numbers[0] : 0;
        } else {
          const numbers = (rawLiq.match(/\d*\.?\d+/g) || []).map(Number);
          if (numbers.length >= 2) {
            const bucketMin = Math.min(...numbers);
            const bucketMax = Math.max(...numbers);
            // Overlap check for ranges like 21 to 49Cr
            if (minLiquidity > 0 && maxLiquidity > 0) {
              const overlaps = Math.max(minLiquidity, bucketMin) <= Math.min(maxLiquidity, bucketMax);
              if (overlaps) {
                // If it overlaps the target range, assign the midpoint so it passes both min and max checks
                liqCr = (minLiquidity + maxLiquidity) / 2;
              } else {
                liqCr = bucketMin;
              }
            } else if (minLiquidity > 0) {
              liqCr = bucketMax;
            } else {
              liqCr = bucketMin;
            }
          } else if (numbers.length === 1) {
            liqCr = numbers[0];
          }
        }
      }
    }
    const minPass = minLiquidity <= 0 || liqCr >= minLiquidity;
    const maxPass = maxLiquidity <= 0 || liqCr <= maxLiquidity;
    const liqPass = minPass && maxPass;

    // 3. Relative Strength Check
    const rawRs = String(
      stock.rs ||
      stock.params?.rs ||
      stock.params?.[`${cLow}.rs`] ||
      ""
    ).trim().toLowerCase();

    let rsPass = true;
    if (rsRating === "strong_neutral") {
      rsPass = !rawRs || ["strong", "very strong", "neutral"].some(k => rawRs.includes(k));
    } else if (rsRating === "strong_only") {
      rsPass = rawRs.includes("strong");
    } else if (rsRating === "very_strong") {
      rsPass = rawRs.includes("very strong");
    } else if (rsRating === "any") {
      rsPass = true;
    }

    // 4. Stage Check: Weinstein Stage
    const rawStage = String(
      stock.stage ||
      stock.params?.stage ||
      stock.params?.[`${cLow}.stage`] ||
      ""
    ).trim().toLowerCase();

    let stagePass = true;
    if (stage === "stage_2") {
      stagePass = !rawStage || rawStage.includes("stage 2") || rawStage.includes("stage_2") || rawStage === "2";
    } else if (stage === "stage_1_2") {
      stagePass = !rawStage || rawStage.includes("stage 1") || rawStage.includes("stage 2") || rawStage === "1" || rawStage === "2";
    } else if (stage === "any") {
      stagePass = true;
    }

    if (maPass && liqPass && rsPass && stagePass) {
      passingSymbols.push(symbol);
    }
  });

  return passingSymbols;
}
