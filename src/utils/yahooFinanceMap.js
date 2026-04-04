export async function fetchStockData(symbols, country, timeframe = '3mo', customInterval = null) {
  if (!symbols || !symbols.length) return [];

  const validTimeframes = {
    '1d': { range: '1d', interval: '5m' },
    '5d': { range: '5d', interval: '15m' },
    '1w': { range: '5d', interval: '15m' },
    '1mo': { range: '1mo', interval: '1d' },
    '3mo': { range: '3mo', interval: '1d' },
    '6mo': { range: '6mo', interval: '1d' },
    '1y': { range: '1y', interval: '1d' }
  };
  const tf = validTimeframes[timeframe] || validTimeframes['3mo'];
  const fetchInterval = customInterval && customInterval !== 'auto' ? customInterval : tf.interval;

  const fetchSymbolData = async (symbol) => {
    let ticker = symbol;
    if (country === 'IN') {
      ticker = `${symbol}.NS`;
    }

    try {
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const baseUrl = isLocalhost ? '/yahoo-api' : 'https://query1.finance.yahoo.com';
      const url = `${baseUrl}/v8/finance/chart/${ticker}?range=${tf.range}&interval=${fetchInterval}`;
      const response = await fetch(url, { cache: 'no-cache' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${ticker}`);
      }
      
      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) return { symbol, error: 'No data' };

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};
      const timestamps = result.timestamp || [];
      const closes = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];

      // Build candlesticks
      const candlesticks = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null && opens[i] !== null && highs[i] !== null && lows[i] !== null) {
          // lightweight-charts needs time in seconds or string (YYYY-MM-DD for daily)
          candlesticks.push({
            time: timestamps[i],
            open: opens[i],
            high: highs[i],
            low: lows[i],
            close: closes[i]
          });
        }
      }

      const currentPrice = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose || (candlesticks.length > 1 ? candlesticks[candlesticks.length - 2].close : currentPrice);
      const isAdvancing = currentPrice >= prevClose;
      const dailyChange = currentPrice - prevClose;
      const dailyChangePct = (dailyChange / prevClose) * 100;
      
      // Calculate period change (% change between first and last data point)
      const periodStartPrice = candlesticks.length > 0 ? candlesticks[0].close : currentPrice;
      const periodChangePct = candlesticks.length > 0 ? ((currentPrice - periodStartPrice) / periodStartPrice) * 100 : 0;

      return {
        symbol,
        longName: meta.longName || meta.shortName || symbol,
        currentPrice: currentPrice || 0,
        prevClose: prevClose || 0,
        dailyChange: dailyChange || 0,
        dailyChangePct: dailyChangePct || 0,
        periodChangePct: periodChangePct || 0,
        isAdvancing,
        candlesticks
      };
    } catch (error) {
      return { symbol, error: error.message };
    }
  };

  // Process in small batches to respect rate limits
  const BATCH_SIZE = 5;
  const results = [];
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchSymbolData));
    results.push(...batchResults);
    
    if (i + BATCH_SIZE < symbols.length) {
      // small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results.filter(r => !r.error);
}
