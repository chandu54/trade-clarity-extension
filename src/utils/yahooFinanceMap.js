import { mapMovingAverageBucket } from './metrics.js';

export async function fetchStockData(symbols, country, timeframe = '3mo', customInterval = null) {
  if (!symbols || !symbols.length) return [];

  const validTimeframes = {
    '1d': { range: '5d', interval: '5m' },
    '5d': { range: '5d', interval: '15m' },
    '1w': { range: '5d', interval: '15m' },
    '1mo': { range: '1mo', interval: '1d' },
    '3mo': { range: '3mo', interval: '1d' },
    '6mo': { range: '6mo', interval: '1d' },
    'ytd': { range: 'ytd', interval: '1d' },
    '1y': { range: '1y', interval: '1d' },
    '2y': { range: '2y', interval: '1d' },
    '5y': { range: '5y', interval: '1wk' }
  };
  const tf = validTimeframes[timeframe] || validTimeframes['3mo'];
  const fetchInterval = customInterval && customInterval !== 'auto' ? customInterval : tf.interval;

  const fetchSymbolData = async (symbol) => {
    let ticker = symbol;
    if (country === 'IN' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO') && !symbol.startsWith('^')) {
      ticker = `${symbol}.NS`;
    }

    try {
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query1.finance.yahoo.com';
      const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${tf.range}&interval=${fetchInterval}`;
      const response = await fetch(url, { cache: 'no-cache' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${ticker}`);
      }
      
      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) return { symbol, error: 'No data' };

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};
      const adjIndicators = result.indicators?.adjclose?.[0]?.adjclose || [];
      const timestamps = result.timestamp || [];
      const closes = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];

      // Build candlesticks with strict validation and optional adjusted close support
      let rawBars = [];
      for (let i = 0; i < timestamps.length; i++) {
        let closePrice = null;
        if (adjIndicators[i] !== null && adjIndicators[i] !== undefined && adjIndicators[i] > 0) {
          closePrice = adjIndicators[i];
        } else if (closes[i] !== null && closes[i] !== undefined && closes[i] > 0) {
          closePrice = closes[i];
        }
        
        if (timestamps[i] != null && closePrice != null && closePrice > 0) {
          const openPrice = (opens[i] != null && opens[i] > 0) ? opens[i] : closePrice;
          const highPrice = (highs[i] != null && highs[i] > 0) ? highs[i] : closePrice;
          const lowPrice = (lows[i] != null && lows[i] > 0) ? lows[i] : closePrice;
          rawBars.push({
            time: timestamps[i],
            open: openPrice,
            high: highPrice,
            low: lowPrice,
            close: closePrice
          });
        }
      }

      const uniqueBars = [];
      const seenTimes = new Set();
      
      for (const bar of rawBars) {
        if (!seenTimes.has(bar.time)) {
          seenTimes.add(bar.time);
          uniqueBars.push(bar);
        }
      }

      // Find actual previous day's close robustly from the 5d historical data
      let calculatedPrevClose = null;
      let lastDayStart = null;
      if (uniqueBars.length > 0) {
        const lastCandleTime = new Date(uniqueBars[uniqueBars.length - 1].time * 1000);
        lastDayStart = new Date(lastCandleTime.getFullYear(), lastCandleTime.getMonth(), lastCandleTime.getDate()).getTime() / 1000;
        
        for (let i = uniqueBars.length - 1; i >= 0; i--) {
          if (uniqueBars[i].time < lastDayStart) {
            calculatedPrevClose = uniqueBars[i].close;
            break;
          }
        }
      }

      let candlesticks = uniqueBars.sort((a, b) => a.time - b.time);
      
      // Filter for '1d' timeframe to only show the last traded day
      if (timeframe === '1d' && lastDayStart) {
        candlesticks = candlesticks.filter(c => c.time >= lastDayStart);
      }

      // meta.chartPreviousClose represents the price BEFORE the 5d chart range started (i.e., a week ago).
      // We MUST use meta.previousClose to get yesterday's official exchange closing price.
      const currentPrice = meta.regularMarketPrice || (candlesticks.length > 0 ? candlesticks[candlesticks.length - 1].close : 0);
      const prevClose = meta.previousClose || calculatedPrevClose || currentPrice;
      const isAdvancing = currentPrice >= prevClose;
      const dailyChange = currentPrice - prevClose;
      const dailyChangePct = prevClose > 0 ? (dailyChange / prevClose) * 100 : 0;
      
      // Calculate period change (% change between first and last data point)
      let periodChangePct = 0;
      if (timeframe === '1d') {
        periodChangePct = dailyChangePct;
      } else {
        // For historical timeframes (1W, 1M, 3M, etc.), we learned that meta.chartPreviousClose 
        // is the exact closing price from the day BEFORE the chart started. This makes it the mathematically 
        // perfect reference point for calculating the period return!
        const periodStartPrice = meta.chartPreviousClose || (candlesticks.length > 0 ? candlesticks[0].close : currentPrice);
        periodChangePct = periodStartPrice > 0 ? ((currentPrice - periodStartPrice) / periodStartPrice) * 100 : 0;
      }

      // Calculate moving averages if history is available
      let movingAverages = "";
      if (candlesticks.length > 0) {
        movingAverages = mapMovingAverageBucket(candlesticks.map(c => c.close), currentPrice);
      }

      return {
        symbol,
        longName: meta.longName || meta.shortName || symbol,
        currentPrice: currentPrice || 0,
        prevClose: prevClose || 0,
        dailyChange: dailyChange || 0,
        dailyChangePct: dailyChangePct || 0,
        periodChangePct: periodChangePct || 0,
        isAdvancing,
        high52w: meta.fiftyTwoWeekHigh || null,
        low52w: meta.fiftyTwoWeekLow || null,
        candlesticks,
        movingAverages
      };
    } catch (error) {
      return { symbol, error: error.message };
    }
  };

  // Process in small batches to respect rate limits
  const BATCH_SIZE = 15;
  const results = [];
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchSymbolData));
    results.push(...batchResults);
    
    if (i + BATCH_SIZE < symbols.length) {
      // small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results.filter(r => !r.error);
}

export async function fetchStockQuotes(symbols, country) {
  if (!symbols || !symbols.length) return [];

  // Yahoo Finance /v7/finance/quote frequently returns 401 Unauthorized because it requires a crumb.
  // To bypass this reliably, we use the /v8/finance/chart endpoint via our existing fetchStockData function.
  // We process them in small batches to avoid overloading the API or local proxy.
  const BATCH_SIZE = 10;
  const results = [];

  try {
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      
      // Fetch 2y data for the batch to get enough history for SMA calculations
      const batchResults = await fetchStockData(batch, country, '2y', '1d');
      results.push(...batchResults);

      if (i + BATCH_SIZE < symbols.length) {
        // Small delay between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return results;
  } catch (error) {
    console.error("Failed to fetch stock quotes via chart API:", error);
    return results;
  }
}
