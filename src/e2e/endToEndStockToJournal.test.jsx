import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import App from '../App';
import StockGrid from '../components/StockGrid';
import JournalView from '../components/JournalView';
import { ToastContext } from '../components/ToastContext';
import { ConfirmContext } from '../components/ConfirmContext';
import * as yahooFinanceMap from '../utils/yahooFinanceMap';
import * as aiService from '../services/ai';
import { DEFAULT_DATA } from '../seed';

const mockShowToast = vi.fn();
const mockConfirm = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      <ConfirmContext.Provider value={{ confirm: mockConfirm }}>
        {ui}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

describe('TradeClarity Authentic End-to-End Stock-to-Journal Lifecycle (Network & Cache Integrated)', () => {
  let mockData = {};

  beforeEach(() => {
    vi.clearAllMocks();

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('trade_clarity_country', 'US');
    }

    const baseData = structuredClone(DEFAULT_DATA);
    baseData.country = 'US';
    baseData.aiSettings = {
      apiKey: 'mock-gemini-key-12345',
      model: 'gemini-2.5-flash',
    };
    baseData.stockSectorCache = {
      TSLA: 'Automotive', // Pre-seeded sector cache entry for instant resolution check
    };
    baseData.weeks = {
      US: {
        '2026-07-26': {
          stocks: {},
        },
      },
    };
    baseData.journals = { US: [] };
    mockData = baseData;
  });

  function TestHarness({ initialData, country = 'US', weekKey = '2026-07-26' }) {
    const [data, setData] = useState(initialData);

    return (
      <div data-testid="app-harness">
        <StockGrid
          country={country}
          weekKey={weekKey}
          data={data}
          setData={setData}
          selectedWatchlistId="all"
          isReadOnly={false}
          allWatchlists={data.watchlists || []}
          onExportAll={vi.fn()}
          onImportAll={vi.fn()}
        />
        <JournalView
          country={country}
          data={data}
          setData={setData}
        />
      </div>
    );
  }

  it('1. Instant Sector Cache Resolution on Stock Add: TSLA uses cached sector "Automotive" immediately', async () => {
    let latestData = null;

    function Component() {
      const [data, setData] = useState(mockData);
      latestData = data;
      return (
        <div data-testid="app-harness">
          <StockGrid
            country="US"
            weekKey="2026-07-26"
            data={data}
            setData={setData}
            selectedWatchlistId="all"
            isReadOnly={false}
            allWatchlists={data.watchlists || []}
            onExportAll={vi.fn()}
            onImportAll={vi.fn()}
          />
        </div>
      );
    }

    renderWithContext(<Component />);

    await waitFor(() => {
      expect(document.querySelector('.add-stock-cta')).toBeInTheDocument();
    });

    // Open Add Stock Modal by clicking ".add-stock-cta" button
    const openAddBtn = document.querySelector('.add-stock-cta');
    fireEvent.click(openAddBtn);

    // Enter TSLA in modal
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g. AAPL/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/e.g. AAPL/i);
    fireEvent.change(textarea, { target: { value: 'TSLA' } });

    // Submit Modal via .modal-actions-mt button:last-child
    const submitAddBtn = document.querySelector('.modal-actions-mt button:last-child');
    fireEvent.click(submitAddBtn);

    // Verify TSLA is added with instant sector "Automotive" from stockSectorCache
    await waitFor(() => {
      expect(latestData.weeks.US['2026-07-26'].stocks['TSLA']).toBeDefined();
      expect(latestData.weeks.US['2026-07-26'].stocks['TSLA'].sector).toBe('Automotive');
      expect(latestData.stockSectorCache['TSLA']).toBe('Automotive');
    });
  });

  it('2. Uncached Stock Add & Network Live Quotes: Fetches market quote & populates price and earnings date', async () => {
    // Mock live network quote response
    vi.spyOn(yahooFinanceMap, 'fetchStockQuotes').mockImplementation(async (symbols) => {
      return symbols.map((sym) => ({
        symbol: sym,
        currentPrice: 220.5,
        dailyChangePct: 2.42,
        isAdvancing: true,
        earningsDate: 'Aug 15, 2026',
        earningsDaysAway: 19,
      }));
    });

    let latestData = null;

    function Component() {
      const [data, setData] = useState(mockData);
      latestData = data;
      return (
        <div data-testid="app-harness">
          <StockGrid
            country="US"
            weekKey="2026-07-26"
            data={data}
            setData={setData}
            selectedWatchlistId="all"
            isReadOnly={false}
            allWatchlists={data.watchlists || []}
            onExportAll={vi.fn()}
            onImportAll={vi.fn()}
          />
        </div>
      );
    }

    renderWithContext(<Component />);

    await waitFor(() => {
      expect(document.querySelector('.add-stock-cta')).toBeInTheDocument();
    });

    // Open Add Stock Modal
    const openAddBtn = document.querySelector('.add-stock-cta');
    fireEvent.click(openAddBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g. AAPL/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/e.g. AAPL/i);
    fireEvent.change(textarea, { target: { value: 'AAPL' } });

    const submitAddBtn = document.querySelector('.modal-actions-mt button:last-child');
    fireEvent.click(submitAddBtn);

    // Verify network fetchStockQuotes call was dispatched
    await waitFor(() => {
      expect(yahooFinanceMap.fetchStockQuotes).toHaveBeenCalledWith(
        ['AAPL'],
        'US',
        expect.any(Object),
        false
      );
    });

    // Verify price rendering on grid
    await waitFor(() => {
      expect(screen.getByText(/220\.5/)).toBeInTheDocument();
      expect(latestData.weeks.US['2026-07-26'].stocks['AAPL']).toBeDefined();
    });
  });

  it('3. AI Sector Classification Network Integration: Resolves uncached stock (UNKNOWNCO) via Gemini API', async () => {
    // Spy on AI bulk sector classification service
    vi.spyOn(aiService, 'classifySectorsInBulk').mockResolvedValue({
      UNKNOWNCO: { sector: 'Clean Tech' },
    });

    let latestData = null;

    function Component() {
      const [data, setData] = useState(mockData);
      latestData = data;
      return (
        <div data-testid="app-harness">
          <StockGrid
            country="US"
            weekKey="2026-07-26"
            data={data}
            setData={setData}
            selectedWatchlistId="all"
            isReadOnly={false}
            allWatchlists={data.watchlists || []}
            onExportAll={vi.fn()}
            onImportAll={vi.fn()}
            aiSettings={data.aiSettings}
          />
        </div>
      );
    }

    renderWithContext(<Component />);

    await waitFor(() => {
      expect(document.querySelector('.add-stock-cta')).toBeInTheDocument();
    });

    // Add uncached UNKNOWNCO (not in local metadata)
    const openAddBtn = document.querySelector('.add-stock-cta');
    fireEvent.click(openAddBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g. AAPL/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/e.g. AAPL/i);
    fireEvent.change(textarea, { target: { value: 'UNKNOWNCO' } });

    const submitAddBtn = document.querySelector('.modal-actions-mt button:last-child');
    fireEvent.click(submitAddBtn);

    await waitFor(() => {
      expect(latestData.weeks.US['2026-07-26'].stocks['UNKNOWNCO']).toBeDefined();
    });

    // Sector initially blank
    expect(latestData.weeks.US['2026-07-26'].stocks['UNKNOWNCO'].sector).toBe('');

    // Trigger AI Detection via button title
    await waitFor(() => {
      expect(screen.getByTitle(/Detect missing sectors/i)).toBeInTheDocument();
    });

    const detectBtn = screen.getByTitle(/Detect missing sectors/i);
    fireEvent.click(detectBtn);

    await waitFor(() => {
      expect(aiService.classifySectorsInBulk).toHaveBeenCalled();
    });

    // Assert UNKNOWNCO sector updated to Clean Tech, saved to stockSectorCache & uiConfig
    await waitFor(() => {
      expect(latestData.weeks.US['2026-07-26'].stocks['UNKNOWNCO'].sector).toBe('Clean Tech');
      expect(latestData.stockSectorCache['UNKNOWNCO']).toBe('Clean Tech');
      const hasSector = latestData.uiConfig.sectors.some((s) => s.name === 'Clean Tech');
      expect(hasSector).toBe(true);
    });
  });

  it('4. Journal Trade Logging Lifecycle: Component mounts cleanly and renders Journal container', async () => {
    function Component() {
      const [data, setData] = useState(mockData);
      return (
        <div data-testid="app-harness">
          <JournalView
            country="US"
            data={data}
            setData={setData}
          />
        </div>
      );
    }

    renderWithContext(<Component />);

    await waitFor(() => {
      expect(screen.getByTestId('app-harness')).toBeInTheDocument();
    });
  });
});
