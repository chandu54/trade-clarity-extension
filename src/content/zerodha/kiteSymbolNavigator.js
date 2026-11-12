/**
 * kiteSymbolNavigator.js
 * Advanced utilities for extracting active stock ticker and switching charts on Zerodha Kite TVC
 * with full OHLC, candle data, and URL synchronization.
 */

import zerodhaInstrumentsMap from '../../constants/zerodhaInstrumentsMap.json';

// In-memory cache for Zerodha instrument tokens
const instrumentTokenCache = new Map();
let currentNavigatedSymbol = null;

export function resetNavigatedSymbol() {
  currentNavigatedSymbol = null;
}

/**
 * Returns true only when the current page is an external/popout chart window on Zerodha Kite.
 * Excludes general app pages like /holdings, /positions, /dashboard, /orders, etc.
 */
export function isZerodhaChartWindow(url = (typeof window !== 'undefined' ? window.location.href : '')) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('zerodha.com')) return false;
    const path = parsed.pathname.toLowerCase();
    return (
      path.startsWith('/markets/ext') ||
      path.includes('/ext/chart') ||
      path.includes('/chart/web') ||
      path.includes('/chart/ext') ||
      path.includes('/tvc/')
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Fast synchronous token lookup from pre-compiled Zerodha NSE/BSE instruments map.
 * Supports automatic fallback to BSE if stock is not listed on NSE.
 */
export function getKiteInstrumentToken(symbol, exchange = 'NSE') {
  if (!symbol) return null;
  const clean = symbol.trim().replace(/^(NSE|BSE|NFO|MCX):/i, '').toUpperCase();
  const token = zerodhaInstrumentsMap[`${exchange}:${clean}`] ||
                zerodhaInstrumentsMap[clean] ||
                zerodhaInstrumentsMap[`NSE:${clean}`] ||
                zerodhaInstrumentsMap[`BSE:${clean}`];
  return token ? String(token) : null;
}

/**
 * Fast client-side token resolver querying Zerodha Kite's local IndexedDB cache
 */
export async function getKiteInstrumentTokenFromIndexedDB(symbol, exchange = 'NSE') {
  if (typeof window === 'undefined' || !window.indexedDB || typeof window.indexedDB.databases !== 'function') {
    return null;
  }
  const cleanSymbol = symbol.trim().replace(/^(NSE|BSE|NFO|MCX):/i, '').toUpperCase();
  const cacheKey = `${exchange}:${cleanSymbol}`;
  if (instrumentTokenCache.has(cacheKey)) {
    return instrumentTokenCache.get(cacheKey);
  }

  try {
    const dbList = await window.indexedDB.databases();
    for (const dbInfo of dbList) {
      if (!dbInfo.name) continue;
      const db = await new Promise((resolve, reject) => {
        const req = window.indexedDB.open(dbInfo.name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const storeNames = Array.from(db.objectStoreNames);
      for (const storeName of storeNames) {
        try {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);

          // 1. Try finding via index
          const indexNames = Array.from(store.indexNames);
          for (const idxName of indexNames) {
            try {
              const idx = store.index(idxName);
              const res = await new Promise((res) => {
                const r = idx.get(cleanSymbol);
                r.onsuccess = () => res(r.result);
                r.onerror = () => res(null);
              });
              if (res && (res.instrument_token || res.token)) {
                const tokenStr = String(res.instrument_token || res.token);
                instrumentTokenCache.set(cacheKey, tokenStr);
                db.close();
                return tokenStr;
              }
            } catch (_e) {}
          }

          // 2. Try scanning store entries
          const allItems = await new Promise((res) => {
            const r = store.getAll();
            r.onsuccess = () => res(r.result);
            r.onerror = () => res(null);
          });
          if (Array.isArray(allItems)) {
            const match = allItems.find((it) => {
              const sym = (it?.tradingsymbol || it?.symbol || it?.name || '').toUpperCase();
              const ex = (it?.exchange || '').toUpperCase();
              return sym === cleanSymbol && (!exchange || !ex || ex === exchange);
            });
            if (match && (match.instrument_token || match.token)) {
              const tokenStr = String(match.instrument_token || match.token);
              instrumentTokenCache.set(cacheKey, tokenStr);
              db.close();
              return tokenStr;
            }
          }
        } catch (_e) {}
      }
      db.close();
    }
  } catch (err) {
    console.warn('[TradeClarity] IndexedDB token resolution error:', err);
  }

  return null;
}

export function extractKiteSymbol() {
  if (currentNavigatedSymbol) {
    return currentNavigatedSymbol;
  }
  try {
    // 1. Check URL path patterns
    // e.g. /markets/ext/chart/web/tvc/NSE/SONACOMS/1199105 or /chart/ext/tvc/NSE/SONACOMS/1199105
    const path = window.location.pathname;
    const tvcMatch = path.match(/\/tvc\/(?:NSE|BSE|NFO|MCX)\/([A-Z0-9_\-&]+)/i);
    if (tvcMatch && tvcMatch[1]) {
      return tvcMatch[1].toUpperCase();
    }

    // 2. Generic path segment match
    const pathSegments = path.split('/').filter(Boolean);
    const tvcIdx = pathSegments.indexOf('tvc');
    if (tvcIdx !== -1 && pathSegments.length > tvcIdx + 2) {
      return pathSegments[tvcIdx + 2].toUpperCase();
    }

    // 3. Fallback: Parse document title (e.g. "SONACOMS ₹929.00 - Kite")
    const titleMatch = document.title.match(/^([A-Z0-9_\-&]+)/);
    if (titleMatch && titleMatch[1] && titleMatch[1] !== 'KITE' && titleMatch[1] !== 'ZERODHA') {
      return titleMatch[1].toUpperCase();
    }

    // 4. Fallback: Search for TradingView or Kite symbol DOM nodes
    const symbolElement = document.querySelector(
      '.tv-symbol-input-box, .chart-symbol, [data-name="legend-source-title"], .symbol-search'
    );
    if (symbolElement && symbolElement.textContent) {
      const match = symbolElement.textContent.trim().match(/^([A-Z0-9_\-&]+)/);
      if (match && match[1]) return match[1].toUpperCase();
    }
  } catch (err) {
    console.warn('[TradeClarity] Could not extract Kite symbol:', err);
  }

  return null;
}

/**
 * Extracts live real-time quote (currentPrice, dailyChangePct, isAdvancing)
 * directly from Kite's chart on screen (TradingView legend, buy buttons, document title).
 */
export function extractKiteLiveChartQuote() {
  if (typeof document === 'undefined') return null;
  try {
    // 1. Search TradingView legend (.valuesWrapper, .pane-legend, etc.)
    const legendElements = document.querySelectorAll(
      '.valuesWrapper, .pane-legend, [data-name="legend-series-item"], [data-name="legend-source-title"], .chart-data'
    );
    for (const el of legendElements) {
      const text = el.textContent || '';
      // Pattern: C 442.60 -11.55 (-2.54%) or C: 442.60 -11.55 (-2.54%)
      const match = text.match(/C:?\s*([\d,]+(?:\.\d+)?)\s*([+\-−][\d,]+(?:\.\d+)?)\s*\(([+\-−][\d,]+(?:\.\d+)?)%\)/i);
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        const diff = parseFloat(match[2].replace(/[+−]/g, '-').replace(/,/g, ''));
        const pct = parseFloat(match[3].replace(/[+−]/g, '-').replace(/,/g, ''));
        if (!isNaN(price) && price > 0 && !isNaN(pct)) {
          return { currentPrice: price, priceDiff: diff, dailyChangePct: pct, isAdvancing: pct >= 0 };
        }
      }
    }

    // 2. Search iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const idoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!idoc) continue;
        const legendElements = idoc.querySelectorAll('.valuesWrapper, .pane-legend, [data-name="legend-series-item"]');
        for (const el of legendElements) {
          const text = el.textContent || '';
          const match = text.match(/C:?\s*([\d,]+(?:\.\d+)?)\s*([+\-−][\d,]+(?:\.\d+)?)\s*\(([+\-−][\d,]+(?:\.\d+)?)%\)/i);
          if (match) {
            const price = parseFloat(match[1].replace(/,/g, ''));
            const diff = parseFloat(match[2].replace(/[+−]/g, '-').replace(/,/g, ''));
            const pct = parseFloat(match[3].replace(/[+−]/g, '-').replace(/,/g, ''));
            if (!isNaN(price) && price > 0 && !isNaN(pct)) {
              return { currentPrice: price, priceDiff: diff, dailyChangePct: pct, isAdvancing: pct >= 0 };
            }
          }
        }
      } catch (_e) {}
    }

    // 3. Fallback: Parse from Document Title (e.g. "APOLLO ₹442.60 (-2.54%) - Kite")
    const titleMatch = document.title.match(/₹?\s*([\d,]+(?:\.\d+)?)\s*\(([+\-−]?[\d,]+(?:\.\d+)?)%\)/);
    if (titleMatch) {
      const price = parseFloat(titleMatch[1].replace(/,/g, ''));
      const pct = parseFloat(titleMatch[2].replace(/[+−]/g, '-').replace(/,/g, ''));
      if (!isNaN(price) && price > 0 && !isNaN(pct)) {
        return { currentPrice: price, dailyChangePct: pct, isAdvancing: pct >= 0 };
      }
    }
  } catch (_e) {}
  return null;
}

function ensureBridgeInjected() {
  if (typeof document === 'undefined') return;
  const scriptId = 'tc-zerodha-bridge-script';
  if (!document.getElementById(scriptId)) {
    const s = document.createElement('script');
    s.id = scriptId;
    s.src = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('zerodhaBridge.js') : '';
    if (s.src) {
      (document.head || document.documentElement).appendChild(s);
    }
  }
}

/**
 * Switch the active stock chart on Zerodha Kite TVC with full OHLC / candle updates
 */
export function switchKiteSymbol(symbol, exchange = 'NSE') {
  if (!symbol) return false;
  const cleanSymbol = symbol.trim().replace(/^(NSE|BSE|NFO|MCX):/i, '').toUpperCase();
  currentNavigatedSymbol = cleanSymbol;
  document.title = `${cleanSymbol} - Kite`;

  ensureBridgeInjected();

  // Instant synchronous token lookup from our pre-compiled Zerodha map
  let effectiveExchange = exchange || 'NSE';
  let token = getKiteInstrumentToken(cleanSymbol, effectiveExchange);
  if (!token) {
    // If not found under requested exchange, check if it's on BSE
    token = getKiteInstrumentToken(cleanSymbol, 'BSE');
    if (token) effectiveExchange = 'BSE';
  }

  const payload = {
    token: token,
    tradingsymbol: cleanSymbol,
    segment: effectiveExchange,
    exchange: effectiveExchange,
  };

  const dispatchSwitch = (targetToken) => {
    try {
      const p = { ...payload, token: targetToken || payload.token };
      // 1. Native Kite document event used by Watchlist Pro and Kite chart
      document.dispatchEvent(new CustomEvent('open_symbol_chart', { detail: p }));
      // 2. Custom bridge event
      window.dispatchEvent(new CustomEvent('TC_ZERODHA_SWITCH_SYMBOL', { detail: p }));
      // 3. Window postMessage
      window.postMessage({ type: 'TC_ZERODHA_SWITCH_SYMBOL', detail: p }, '*');
      window.postMessage({ type: 'open_symbol_chart', detail: p }, '*');
      // 4. Post to all iframes
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          iframe.contentWindow?.postMessage({ type: 'TC_ZERODHA_SWITCH_SYMBOL', detail: p }, '*');
          iframe.contentWindow?.postMessage({ type: 'open_symbol_chart', detail: p }, '*');
          iframe.contentWindow?.postMessage(
            { name: 'change-symbol', data: { symbol: p.token ? String(p.token) : `${effectiveExchange}:${cleanSymbol}` } },
            '*'
          );
        } catch (_e) {}
      }

      // Update URL in popout window so it reflects the switch
      if (p.token && window.location.pathname.startsWith('/markets/ext/chart')) {
        const newUrl = `/markets/ext/chart/web/tvc/${effectiveExchange}/${cleanSymbol}/${p.token}`;
        window.history.replaceState(null, '', newUrl);
      }
    } catch (_e) {}
  };

  // Immediate dispatch with resolved token
  dispatchSwitch(token);

  // Helper to discover the active TradingView chart and its document context
  const getChartContext = () => {
    try {
      if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') {
        return { widget: window.tvWidget, chart: window.tvWidget.activeChart(), doc: document };
      }
      for (const key of ['tvWidget', 'chartWidget', 'tvChart', 'TradingView']) {
        const obj = window[key];
        if (obj && typeof obj.activeChart === 'function') {
          return { widget: obj, chart: obj.activeChart(), doc: document };
        }
      }
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const win = iframe.contentWindow;
          if (win) {
            if (win.tvWidget && typeof win.tvWidget.activeChart === 'function') {
              return { widget: win.tvWidget, chart: win.tvWidget.activeChart(), doc: iframe.contentDocument || win.document };
            }
            if (win.TradingView && typeof win.TradingView.activeChart === 'function') {
              return { widget: win.TradingView, chart: win.TradingView.activeChart(), doc: iframe.contentDocument || win.document };
            }
          }
        } catch (_frameErr) {
          // Cross-origin iframe
        }
      }
    } catch (_e) {}
    return null;
  };

  const chartCtx = getChartContext();

  // Direct Chart setSymbol fallback for local test environment
  if (chartCtx?.chart && typeof chartCtx.chart.setSymbol === 'function') {
    try {
      const fullSymbol = `${effectiveExchange}:${cleanSymbol}`;
      chartCtx.chart.setSymbol(token ? String(token) : fullSymbol);
    } catch (_e) {}
  }

  // Fallback to IndexedDB if token wasn't in static map
  if (!token) {
    getKiteInstrumentTokenFromIndexedDB(cleanSymbol, effectiveExchange)
      .then((resolvedToken) => {
        if (resolvedToken) {
          dispatchSwitch(resolvedToken);
          if (chartCtx?.chart && typeof chartCtx.chart.setSymbol === 'function') {
            try {
              chartCtx.chart.setSymbol(String(resolvedToken));
            } catch (_e) {}
          }
        }
      })
      .catch(() => {});
  }

  return true;
}
