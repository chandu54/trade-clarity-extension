import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanSymbolKey,
  normalizeCompanyName,
  initStockUniverse,
  syncStockUniverse,
  addStockToUniverse,
  getStockFromUniverse,
  searchStockUniverse
} from '../stockUniverseService';

describe('stockUniverseService', () => {
  beforeEach(() => {
    initStockUniverse();
  });

  describe('cleanSymbolKey', () => {
    it('normalizes symbols correctly', () => {
      expect(cleanSymbolKey('nse:tatamotors')).toBe('TATAMOTORS');
      expect(cleanSymbolKey('RELIANCE.NS')).toBe('RELIANCE');
      expect(cleanSymbolKey('TCS.BO')).toBe('TCS');
      expect(cleanSymbolKey(' NASDAQ:AAPL ')).toBe('AAPL');
    });
  });

  describe('normalizeCompanyName', () => {
    it('normalizes company names and strips legal suffixes', () => {
      expect(normalizeCompanyName('Apollo Micro Systems Limited')).toBe('apollomicrosystems');
      expect(normalizeCompanyName('Apollo Micro Systems Ltd')).toBe('apollomicrosystems');
      expect(normalizeCompanyName('APOLLO HOSPITALS ENTER. L')).toBe('apollohospitals');
      expect(normalizeCompanyName('Apollo Hospitals Enterprise Ltd')).toBe('apollohospitals');
    });
  });

  describe('initStockUniverse', () => {
    it('pre-populates default stocks for IN and US', () => {
      const rel = getStockFromUniverse('RELIANCE', 'IN');
      expect(rel).toBeDefined();
      expect(rel.symbol).toBe('RELIANCE');
      expect(rel.name).toContain('Reliance');

      const nvda = getStockFromUniverse('NVDA', 'US');
      expect(nvda).toBeDefined();
      expect(nvda.symbol).toBe('NVDA');
      expect(nvda.sector).toBe('Technology');
    });
  });

  describe('syncStockUniverse', () => {
    it('indexes historical stocks and caches from app data', () => {
      const mockAppData = {
        weeks: {
          IN: {
            '2026-W10': {
              stocks: {
                CUSTOMTICKER: {
                  symbol: 'CUSTOMTICKER',
                  name: 'Custom Ticker Corporation',
                  sector: 'Electronics'
                }
              }
            }
          },
          US: {}
        },
        stockSectorCache: {
          ANOTHERTICKER: 'Renewable Energy'
        }
      };

      syncStockUniverse(mockAppData);

      const customStock = getStockFromUniverse('CUSTOMTICKER', 'IN');
      expect(customStock).toBeDefined();
      expect(customStock.name).toBe('Custom Ticker Corporation');
      expect(customStock.sector).toBe('Electronics');
      expect(customStock.source).toBe('workspace');
    });
  });

  describe('addStockToUniverse', () => {
    it('adds new stock to the universe map', () => {
      addStockToUniverse('NEWIPO', 'IN', {
        name: 'New Tech IPO Ltd',
        sector: 'Fintech'
      });

      const item = getStockFromUniverse('NEWIPO', 'IN');
      expect(item).toBeDefined();
      expect(item.symbol).toBe('NEWIPO');
      expect(item.sector).toBe('Fintech');
    });
  });

  describe('searchStockUniverse', () => {
    it('correctly partitions results into watchlist and directory matches', () => {
      const currentWatchlist = [
        { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' }
      ];

      const res = searchStockUniverse({
        query: 'TATA',
        country: 'IN',
        currentWatchlistStocks: currentWatchlist,
        limit: 5
      });

      expect(res.inWatchlistMatches.length).toBeGreaterThan(0);
      expect(res.inWatchlistMatches[0].symbol).toBe('TATAMOTORS');
      expect(res.inWatchlistMatches[0]).toBe(currentWatchlist[0]);

      expect(res.directoryMatches.length).toBeGreaterThan(0);
      const tataSteel = res.directoryMatches.find(d => d.symbol === 'TATASTEEL');
      expect(tataSteel).toBeDefined();
      expect(tataSteel.inWatchlist).toBe(false);
    });

    it('returns empty lists for blank queries', () => {
      const res = searchStockUniverse({ query: '', country: 'IN' });
      expect(res.inWatchlistMatches).toEqual([]);
      expect(res.directoryMatches).toEqual([]);
      expect(res.allMatches).toEqual([]);
    });

    it('ranks exact symbol matches at the top', () => {
      const res = searchStockUniverse({
        query: 'INFY',
        country: 'IN',
        currentWatchlistStocks: []
      });

      expect(res.directoryMatches[0].symbol).toBe('INFY');
    });

    it('does not duplicate same company in directory if already in watchlist under an alias or differing symbol', () => {
      // User has APOLLO in watchlist representing Apollo Micro Systems Limited
      const currentWatchlist = [
        { symbol: 'APOLLO', name: 'Apollo Micro Systems Limited', sector: 'Defence' }
      ];

      const res = searchStockUniverse({
        query: 'apollo',
        country: 'IN',
        currentWatchlistStocks: currentWatchlist,
        limit: 10
      });

      // APOLLO should be in inWatchlistMatches
      const inWl = res.inWatchlistMatches.find(s => s.symbol === 'APOLLO');
      expect(inWl).toBeDefined();

      // APOLLOMICRO (the official ticker in directory) must NOT appear in directoryMatches with "+ Add"
      const inDirApolloMicro = res.directoryMatches.find(s => s.symbol === 'APOLLOMICRO');
      expect(inDirApolloMicro).toBeUndefined();

      // APOLLOHOSP (different company) SHOULD be in directoryMatches
      const inDirApolloHosp = res.directoryMatches.find(s => s.symbol === 'APOLLOHOSP');
      expect(inDirApolloHosp).toBeDefined();
    });
  });
});
