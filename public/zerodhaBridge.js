/**
 * zerodhaBridge.js
 * Injected in "world": "MAIN" on kite.zerodha.com.
 * Runs in the page's execution context with direct access to window.kiteAPI,
 * TradingView charting library instances, iframes, and Vue components.
 */
(function() {
  if (window.__TC_ZERODHA_BRIDGE_LOADED__) return;
  window.__TC_ZERODHA_BRIDGE_LOADED__ = true;

  console.log('[TradeClarity Bridge] Initialized in MAIN world on Kite');

  function switchSymbol(detail) {
    if (!detail) return;
    let token = detail.token ? (Number(detail.token) || detail.token) : null;
    const sym = (detail.tradingsymbol || detail.symbol || '').trim().toUpperCase();
    const seg = detail.segment || detail.exchange || 'NSE';
    const url = window.location.href;

    // Fallback: If token was not provided, look it up in Kite's in-memory Vuex store
    if (!token) {
      try {
        const store = document.querySelector('#app')?.__vue__?.$store;
        const state = store?.state || {};
        const lists = [state.instruments, state.market?.instruments, state.watchlist?.instruments];
        for (const list of lists) {
          if (Array.isArray(list)) {
            const match = list.find(it => (it?.tradingsymbol || it?.symbol || '').toUpperCase() === sym);
            if (match && (match.instrument_token || match.token)) {
              token = match.instrument_token || match.token;
              break;
            }
          }
        }
      } catch (_e) {}
    }

    console.log('[TradeClarity Bridge] Switching Kite chart:', { token, tradingsymbol: sym, segment: seg });

    // Update browser URL in history so the page stays synchronized
    try {
      if (token && sym && window.location.pathname.startsWith('/markets/ext/chart')) {
        const newUrl = `/markets/ext/chart/web/tvc/${seg}/${sym}/${token}`;
        window.history.replaceState(null, '', newUrl);
      }
    } catch (_e) {}

    // 1. Zerodha Native kiteAPI (Official Zerodha method used by Watchlist Pro)
    if (window.kiteAPI) {
      const fn = url.includes('/ciq/') ? window.kiteAPI.changeSymbol : window.kiteAPI.onChangeSymbol;
      if (typeof fn === 'function') {
        try {
          console.log('[TradeClarity Bridge] Calling native window.kiteAPI.onChangeSymbol!');
          fn.call(window.kiteAPI, {
            token: token,
            tradingsymbol: sym,
            segment: seg,
          });
          return true;
        } catch (err) {
          console.warn('[TradeClarity Bridge] Error in window.kiteAPI:', err);
        }
      }
    }

    // 2. Fallback: TradingView widget activeChart()
    const globals = ['tvWidget', 'chartWidget', 'tvChart', 'TradingView', '_tvWidget', 'widget'];
    for (const g of globals) {
      try {
        const obj = window[g];
        if (obj && typeof obj.activeChart === 'function') {
          const chart = obj.activeChart();
          if (chart && typeof chart.setSymbol === 'function') {
            console.log(`[TradeClarity Bridge] Calling ${g}.activeChart().setSymbol with token:`, token || sym);
            chart.setSymbol(token ? String(token) : `${seg}:${sym}`);
            return true;
          }
        }
      } catch (_e) {}
    }

    // 3. Fallback: Check iframes
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const win = iframe.contentWindow;
          if (!win) continue;
          for (const g of globals) {
            const obj = win[g];
            if (obj && typeof obj.activeChart === 'function') {
              obj.activeChart().setSymbol(token ? String(token) : `${seg}:${sym}`);
              return true;
            }
          }
          win.postMessage({ name: 'change-symbol', data: { symbol: token ? String(token) : `${seg}:${sym}` } }, '*');
        } catch (_e) {}
      }
    } catch (_e) {}

    return false;
  }

  // Extract and dispatch live quote from Kite / TradingView
  function broadcastLiveQuote() {
    try {
      // 1. Check TradingView legend
      const legendEls = document.querySelectorAll('.valuesWrapper, .pane-legend, [data-name="legend-series-item"], [data-name="legend-source-title"]');
      for (const el of legendEls) {
        const text = el.textContent || '';
        const match = text.match(/C:?\s*([\d,]+(?:\.\d+)?)\s*([+\-−][\d,]+(?:\.\d+)?)\s*\(([+\-−][\d,]+(?:\.\d+)?)%\)/i);
        if (match) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          const diff = parseFloat(match[2].replace(/[+−]/g, '-').replace(/,/g, ''));
          const pct = parseFloat(match[3].replace(/[+−]/g, '-').replace(/,/g, ''));
          if (!isNaN(price) && price > 0 && !isNaN(pct)) {
            document.dispatchEvent(new CustomEvent('tc_zerodha_quote_update', {
              detail: { price, diff, changePct: pct }
            }));
            return;
          }
        }
      }
    } catch (_e) {}
  }
  setInterval(broadcastLiveQuote, 1000);

  // Listen for open_symbol_chart (standard event)
  document.addEventListener('open_symbol_chart', function(e) {
    switchSymbol(e.detail);
  });

  // Listen for TC_ZERODHA_SWITCH_SYMBOL
  window.addEventListener('TC_ZERODHA_SWITCH_SYMBOL', function(e) {
    switchSymbol(e.detail);
  });

  // Listen for window postMessage
  window.addEventListener('message', function(e) {
    if (e.data && (e.data.type === 'TC_ZERODHA_SWITCH_SYMBOL' || e.data.type === 'open_symbol_chart')) {
      switchSymbol(e.data.detail || e.data);
    }
  });
})();
