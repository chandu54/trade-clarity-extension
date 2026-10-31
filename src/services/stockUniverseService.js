/**
 * Stock Universe Service
 * 
 * Provides an in-memory Map & fast autocomplete indexing for the universe of stocks.
 * Combines:
 * 1. Curated high-liquidity stock directory (NSE & US).
 * 2. Static stock metadata seeds.
 * 3. App-wide historical workspace stocks (all weeks in storage).
 * 4. Sector & thematic caches.
 * 5. On-demand dynamic Yahoo search fallback with automatic Map ingestion.
 */

import { DEFAULT_IN_STOCKS, DEFAULT_US_STOCKS } from '../constants/defaultStockDirectory.js';
import stockMetadata from '../constants/stockMetadata.json';

// In-Memory Master Universe Map: Key = `${country}:${symbol.toUpperCase()}`
const universeMap = new Map();

// Helper to normalize symbol
export function cleanSymbolKey(symbol = '') {
  return String(symbol)
    .trim()
    .toUpperCase()
    .replace(/^NSE:|^BSE:|^NASDAQ:|^NYSE:/, '')
    .replace(/\.NS$|\.BO$/, '');
}

/**
 * Normalize company name for fuzzy deduplication between watchlist aliases and directory
 * E.g. "Apollo Micro Systems Limited" vs "Apollo Micro Systems Ltd" -> "apollomicrosystems"
 * E.g. "Apollo Hospitals Enterprise Ltd" vs "APOLLO HOSPITALS ENTER. L" -> "apollohospitals"
 */
export function normalizeCompanyName(name = '') {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|corp|corporation|inc|incorporated|enterprises|enterprise|industries|ind|co|company|holdings)\b/gi, '')
    .replace(/enter\.?\s*l\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Seed the universe with static directory & stockMetadata.json
 */
export function initStockUniverse() {
  // 1. Seed IN stocks
  DEFAULT_IN_STOCKS.forEach(([symbol, name, sector]) => {
    const sym = cleanSymbolKey(symbol);
    universeMap.set(`IN:${sym}`, {
      symbol: sym,
      name,
      longName: name,
      sector: sector || '',
      country: 'IN',
      source: 'directory'
    });
  });

  // 2. Seed US stocks
  DEFAULT_US_STOCKS.forEach(([symbol, name, sector]) => {
    const sym = cleanSymbolKey(symbol);
    universeMap.set(`US:${sym}`, {
      symbol: sym,
      name,
      longName: name,
      sector: sector || '',
      country: 'US',
      source: 'directory'
    });
  });

  // 3. Seed from stockMetadata.json (enriching sectors and scopes)
  ['IN', 'US'].forEach(c => {
    const metaCountry = stockMetadata?.[c] || {};
    Object.entries(metaCountry).forEach(([rawSym, data]) => {
      const sym = cleanSymbolKey(rawSym);
      const key = `${c}:${sym}`;
      const existing = universeMap.get(key) || { symbol: sym, country: c, source: 'metadata' };
      universeMap.set(key, {
        ...existing,
        sector: data.sector || existing.sector || '',
        businessScope: data.businessScope || existing.businessScope || [],
        dependentIndustries: data.dependentIndustries || existing.dependentIndustries || []
      });
    });
  });
}

// Auto-run static initialization
initStockUniverse();

/**
 * Synchronize the universe with full application data (historical weeks & caches)
 * Call this whenever app data is loaded or updated.
 */
export function syncStockUniverse(appData) {
  if (!appData) return;

  ['IN', 'US'].forEach(country => {
    const weeksObj = appData.weeks?.[country] || {};
    
    // Ingest all stocks across all weeks (current and archived)
    Object.values(weeksObj).forEach(week => {
      if (!week || !week.stocks) return;
      Object.values(week.stocks).forEach(stock => {
        if (!stock || !stock.symbol) return;
        const sym = cleanSymbolKey(stock.symbol);
        const key = `${country}:${sym}`;
        const existing = universeMap.get(key) || {};
        
        universeMap.set(key, {
          symbol: sym,
          name: stock.longName || stock.name || existing.name || sym,
          longName: stock.longName || stock.name || existing.longName || sym,
          sector: stock.sector || existing.sector || '',
          macroTheme: stock.macroTheme || existing.macroTheme || '',
          country,
          source: 'workspace'
        });
      });
    });

    // Ingest sector cache
    const sectorCache = appData.stockSectorCache || {};
    Object.entries(sectorCache).forEach(([rawSym, sector]) => {
      const sym = cleanSymbolKey(rawSym);
      const key = `${country}:${sym}`;
      const existing = universeMap.get(key);
      if (existing) {
        if (!existing.sector && sector) existing.sector = sector;
      }
    });

    // Ingest thematic cache
    const thematicCache = appData.stockThematicCache || {};
    Object.entries(thematicCache).forEach(([rawSym, themData]) => {
      const sym = cleanSymbolKey(rawSym);
      const key = `${country}:${sym}`;
      const existing = universeMap.get(key);
      if (existing && themData) {
        if (!existing.macroTheme && themData.macroTheme) existing.macroTheme = themData.macroTheme;
        if (!existing.sector && themData.sector) existing.sector = themData.sector;
      }
    });
  });
}

/**
 * Add or update a single stock in the universe Map
 */
export function addStockToUniverse(symbol, country = 'IN', details = {}) {
  const sym = cleanSymbolKey(symbol);
  if (!sym) return null;
  const key = `${country}:${sym}`;
  const existing = universeMap.get(key) || {};
  const updated = {
    ...existing,
    symbol: sym,
    name: details.longName || details.name || existing.name || sym,
    longName: details.longName || details.name || existing.longName || sym,
    sector: details.sector || existing.sector || '',
    country,
    ...details
  };
  universeMap.set(key, updated);
  return updated;
}

/**
 * Retrieve a stock by symbol from the universe Map
 */
export function getStockFromUniverse(symbol, country = 'IN') {
  const sym = cleanSymbolKey(symbol);
  return universeMap.get(`${country}:${sym}`) || null;
}

/**
 * Instant local search in the universe Map
 *
 * @param {Object} options
 * @param {string} options.query - User search input
 * @param {string} options.country - 'IN' or 'US'
 * @param {Array|Set} options.currentWatchlistStocks - Symbols or Stock objects currently in the active watchlist
 * @param {number} options.limit - Max items to return in directory matches
 * @returns {{ inWatchlistMatches: Array, directoryMatches: Array, allMatches: Array }}
 */
export function searchStockUniverse({
  query = '',
  country = 'IN',
  currentWatchlistStocks = [],
  limit = 8
}) {
  const rawQ = String(query).trim().toLowerCase();
  if (!rawQ) {
    return { inWatchlistMatches: [], directoryMatches: [], allMatches: [] };
  }

  // Parse smart hybrid search prefixes
  let mode = 'default';
  let q = rawQ;

  if (rawQ.startsWith('theme:') || rawQ.startsWith('t:')) {
    mode = 'theme';
    q = rawQ.replace(/^(theme:|t:)\s*/, '');
  } else if (rawQ.startsWith('scope:') || rawQ.startsWith('s:')) {
    mode = 'scope';
    q = rawQ.replace(/^(scope:|s:)\s*/, '');
  } else if (rawQ.startsWith('sector:') || rawQ.startsWith('sec:')) {
    mode = 'sector';
    q = rawQ.replace(/^(sector:|sec:)\s*/, '');
  } else if (rawQ.startsWith('notes:') || rawQ.startsWith('n:')) {
    mode = 'notes';
    q = rawQ.replace(/^(notes:|n:)\s*/, '');
  }

  if (!q) {
    return { inWatchlistMatches: [], directoryMatches: [], allMatches: [] };
  }

  // Build current symbols and company names for instant membership check
  const currentSymbolsSet = new Set();
  const watchlistStockMap = new Map();
  const currentCompanyNamesMap = new Map();

  if (Array.isArray(currentWatchlistStocks)) {
    currentWatchlistStocks.forEach(s => {
      const sym = typeof s === 'string' ? cleanSymbolKey(s) : cleanSymbolKey(s?.symbol);
      if (sym) {
        currentSymbolsSet.add(sym);
        if (typeof s === 'object' && s !== null) {
          watchlistStockMap.set(sym, s);
          const normName = normalizeCompanyName(s.name || s.longName);
          if (normName.length >= 4) {
            currentCompanyNamesMap.set(normName, s);
          }
          // Ensure watchlist item exists in universeMap for this country
          const uKey = `${country}:${sym}`;
          if (!universeMap.has(uKey)) {
            universeMap.set(uKey, {
              symbol: sym,
              name: s.name || s.longName || sym,
              longName: s.longName || s.name || sym,
              sector: s.sector || '',
              country,
              source: 'watchlist'
            });
          }
        }
      }
    });
  } else if (currentWatchlistStocks instanceof Set) {
    currentWatchlistStocks.forEach(sym => {
      if (sym) currentSymbolsSet.add(cleanSymbolKey(sym));
    });
  }

  const prefixKey = `${country}:`;
  const scoredMatches = [];

  for (const [key, item] of universeMap.entries()) {
    if (!key.startsWith(prefixKey)) continue;

    const symLower = item.symbol.toLowerCase();
    const nameLower = (item.name || item.longName || '').toLowerCase();
    const sectorLower = (item.sector || '').toLowerCase();
    const themeLower = (item.macroTheme || '').toLowerCase();

    let score = 0;

    if (mode === 'theme') {
      if (themeLower === q) {
        score = 1000;
      } else if (themeLower.startsWith(q)) {
        score = 500;
      } else if (themeLower.includes(q)) {
        score = 250;
      }
    } else if (mode === 'sector') {
      if (sectorLower === q) {
        score = 1000;
      } else if (sectorLower.startsWith(q)) {
        score = 500;
      } else if (sectorLower.includes(q)) {
        score = 250;
      }
    } else if (mode === 'scope') {
      const scopeList = Array.isArray(item.businessScope) ? item.businessScope : [];
      if (scopeList.some(s => (s || '').toLowerCase().includes(q))) {
        score = 500;
      }
    } else {
      // Default: clean matching on symbol and company name only
      if (symLower === q) {
        score = 1000;
      } else if (symLower.startsWith(q)) {
        score = 500 - symLower.length;
      } else if (symLower.includes(q)) {
        score = 250 - symLower.indexOf(q);
      } else if (nameLower.startsWith(q)) {
        score = 150;
      } else if (nameLower.includes(q)) {
        score = 100;
      }
    }

    if (score > 0) {
      const symClean = cleanSymbolKey(item.symbol);
      const itemNormName = normalizeCompanyName(item.name || item.longName);
      const isSymbolInWatchlist = currentSymbolsSet.has(symClean);
      const isCompanyInWatchlist = itemNormName.length >= 4 && currentCompanyNamesMap.has(itemNormName);
      const isInWatchlist = isSymbolInWatchlist || isCompanyInWatchlist;

      const matchedWatchlistStock = watchlistStockMap.get(symClean) || (isCompanyInWatchlist ? currentCompanyNamesMap.get(itemNormName) : null);
      const stockPayload = matchedWatchlistStock
        ? matchedWatchlistStock
        : { ...item, inWatchlist: isInWatchlist };

      scoredMatches.push({
        item: stockPayload,
        isInWatchlist,
        isSymbolInWatchlist,
        isCompanyInWatchlist,
        symClean,
        itemNormName,
        score
      });
    }
  }

  // Sort descending by relevance score
  scoredMatches.sort((a, b) => b.score - a.score);

  const inWatchlistMatches = [];
  const directoryMatches = [];
  const seenWatchlistSymbols = new Set();
  const seenWatchlistCompanies = new Set();
  const seenDirectoryCompanies = new Set();

  for (const { item, isInWatchlist, isCompanyInWatchlist, symClean, itemNormName } of scoredMatches) {
    if (isInWatchlist) {
      // Dedup watchlist matches so the same symbol or company does not show twice
      if (seenWatchlistSymbols.has(symClean)) continue;
      if (itemNormName && itemNormName.length >= 4 && seenWatchlistCompanies.has(itemNormName)) continue;

      seenWatchlistSymbols.add(symClean);
      if (itemNormName && itemNormName.length >= 4) {
        seenWatchlistCompanies.add(itemNormName);
      }
      inWatchlistMatches.push(item);
    } else {
      // Do NOT show in directory if this company is already in current watchlist!
      if (isCompanyInWatchlist) continue;
      if (seenWatchlistSymbols.has(symClean)) continue;
      if (itemNormName && itemNormName.length >= 4 && (seenWatchlistCompanies.has(itemNormName) || seenDirectoryCompanies.has(itemNormName))) continue;

      if (directoryMatches.length < limit) {
        if (itemNormName && itemNormName.length >= 4) {
          seenDirectoryCompanies.add(itemNormName);
        }
        directoryMatches.push(item);
      }
    }
  }

  const allMatches = [...inWatchlistMatches, ...directoryMatches];

  return {
    inWatchlistMatches,
    directoryMatches,
    allMatches
  };
}

/**
 * Dynamic Yahoo Finance Search fallback for unindexed tickers
 * Caches newly found items into the Universe Map automatically.
 */
const yahooSearchCache = new Map();

export async function searchYahooSymbols(query, country = 'IN') {
  const cleanQ = cleanSymbolKey(query);
  if (!cleanQ || cleanQ.length < 2) return [];

  const cacheKey = `${country}:${cleanQ}`;
  if (yahooSearchCache.has(cacheKey)) {
    return yahooSearchCache.get(cacheKey);
  }

  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const yahooBaseUrl = isLocalhost ? '/yahoo-api' : 'https://query2.finance.yahoo.com';
  
  // Free-form query gives Yahoo full flexibility to match symbol or company name
  const url = `${yahooBaseUrl}/v1/finance/search?q=${encodeURIComponent(cleanQ)}&quotesCount=10&newsCount=0`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const json = await res.json();
    const quotes = json?.quotes || [];

    const results = [];
    quotes.forEach(qItem => {
      if (qItem.quoteType !== 'EQUITY' && qItem.quoteType !== 'ETF') return;

      const rawSym = qItem.symbol || '';
      const sym = cleanSymbolKey(rawSym);
      if (!sym) return;

      // Filter by country exchange
      if (country === 'IN') {
        const isIndia = rawSym.endsWith('.NS') || 
                        rawSym.endsWith('.BO') || 
                        qItem.exchange === 'NSI' || 
                        qItem.exchange === 'BSE' ||
                        qItem.exchange === 'NSE';
        if (!isIndia) return;
      } else if (country === 'US') {
        const isUS = ['NMS', 'NYQ', 'NGM', 'PCX', 'ASE', 'BTS', 'NAS', 'NYS'].includes(qItem.exchange) ||
                     (!rawSym.includes('.') && qItem.exchange !== 'NSI');
        if (!isUS) return;
      }

      const item = {
        symbol: sym,
        name: qItem.shortname || qItem.longname || sym,
        longName: qItem.longname || qItem.shortname || sym,
        sector: qItem.sector || '',
        country,
        source: 'yahoo_search'
      };

      // Add to universe map for instant lookup next time
      addStockToUniverse(sym, country, item);
      results.push(item);
    });

    yahooSearchCache.set(cacheKey, results);
    return results;
  } catch (_e) {
    return [];
  }
}
