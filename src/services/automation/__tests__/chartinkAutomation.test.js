import { describe, it, expect, vi, beforeEach } from "vitest";
import { chartinkAutomation } from "../chartinkAutomation";
import { fetchChartinkSymbols } from "../../chartinkService";

describe("chartinkAutomation - Robustness & Safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has valid automation metadata and 5 stages", () => {
    expect(chartinkAutomation.id).toBe("chartink_scanner");
    expect(chartinkAutomation.stages).toHaveLength(5);
    expect(chartinkAutomation.stages[4]).toBe("5. Work Items & Pruning");
  });

  it("does not prune stocks if hydration ratio is below the 80% threshold", async () => {
    // Mock chrome storage
    const storageState = {
      trading_app_data: {
        weeks: {
          IN: {
            "2026-11-15": {
              stocks: {
                TCS: { symbol: "TCS", params: { movingAverages: "Above 21, 50, 200", liquidity: "100Cr", stage: "Stage 2" }, turnoverCr: 100 },
                INFY: { symbol: "INFY", params: {}, watchlists: [] },
                RELIANCE: { symbol: "RELIANCE", params: {}, watchlists: [] },
              },
            },
          },
        },
      },
    };

    global.chrome = {
      storage: {
        local: {
          get: vi.fn((keys, cb) => cb(storageState)),
          set: vi.fn((data, cb) => cb && cb()),
        },
      },
      runtime: {
        sendMessage: vi.fn((msg, cb) => cb && cb({ isProcessing: false, queueLength: 0, completedJobs: 1, totalJobs: 1 })),
        lastError: null,
      },
    };

    // Mock fetchChartinkSymbols to return 3 symbols where only 1 is hydrated (33% < 80%)
    vi.mock("../../chartinkService", () => ({
      fetchChartinkSymbols: vi.fn().mockResolvedValue(["TCS", "INFY", "RELIANCE"]),
      filterPassingSetups: vi.fn().mockImplementation((stocks) => {
        return Object.keys(stocks).filter((sym) => stocks[sym]?.turnoverCr >= 50);
      }),
    }));

    const mockSetData = vi.fn();
    const mockOnProgress = vi.fn();
    const mockShowToast = vi.fn();

    const result = await chartinkAutomation.execute(
      {
        country: "IN",
        weekKey: "2026-11-15",
        data: { watchlists: [{ id: "wl_default", name: "Default Watchlist" }] },
        setData: mockSetData,
        setWeekKey: vi.fn(),
        setSelectedWatchlistId: vi.fn(),
        criteria: {
          workItems: [
            {
              id: "wi_primary",
              label: "Work Item 1",
              targetWatchlistId: "wl_default",
              minLiquidity: 50,
            },
          ],
          pruneUnassigned: true,
        },
        showToast: mockShowToast,
      },
      mockOnProgress
    );

    // Pruning should have been safely skipped because 1/3 (33%) < 80%
    expect(result.prunedCount).toBe(0);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Pruning was safely skipped"),
      "info"
    );
  });

  it("never prunes unhydrated tickers even when hydration ratio meets the 80% threshold", async () => {
    fetchChartinkSymbols.mockResolvedValueOnce(["TCS", "INFY", "RELIANCE", "WIPRO", "UNHYDRATED_SYM"]);
    // 5 symbols total: 4 hydrated (80%), 1 unhydrated (20%).
    // 2 hydrated qualify for Work Item 1 (turnover >= 50).
    // 2 hydrated fail Work Item 1 (turnover < 50) and have 0 watchlists -> eligible for pruning.
    // 1 unhydrated ticker has 0 watchlists -> MUST NOT be pruned!
    const storageState = {
      trading_app_data: {
        weeks: {
          IN: {
            "2026-11-15": {
              stocks: {
                TCS: { symbol: "TCS", params: { movingAverages: "Above 21, 50, 200", liquidity: "100Cr" }, turnoverCr: 100 },
                INFY: { symbol: "INFY", params: { movingAverages: "Above 21, 50, 200", liquidity: "80Cr" }, turnoverCr: 80 },
                RELIANCE: { symbol: "RELIANCE", params: { movingAverages: "Below 200", liquidity: "10Cr" }, turnoverCr: 10, watchlists: [] },
                WIPRO: { symbol: "WIPRO", params: { movingAverages: "Below 200", liquidity: "10Cr" }, turnoverCr: 10, watchlists: [] },
                UNHYDRATED_SYM: { symbol: "UNHYDRATED_SYM", params: {}, watchlists: [] },
              },
            },
          },
        },
      },
    };

    global.chrome = {
      storage: {
        local: {
          get: vi.fn((keys, cb) => cb(storageState)),
          set: vi.fn((data, cb) => cb && cb()),
        },
      },
      runtime: {
        sendMessage: vi.fn((msg, cb) => cb && cb({ isProcessing: false, queueLength: 0, completedJobs: 5, totalJobs: 5 })),
        lastError: null,
      },
    };

    const mockSetData = vi.fn();
    const mockOnProgress = vi.fn();
    const mockShowToast = vi.fn();

    const result = await chartinkAutomation.execute(
      {
        country: "IN",
        weekKey: "2026-11-15",
        data: { watchlists: [{ id: "wl_default", name: "Default Watchlist" }] },
        setData: mockSetData,
        setWeekKey: vi.fn(),
        setSelectedWatchlistId: vi.fn(),
        criteria: {
          workItems: [
            {
              id: "wi_primary",
              label: "Work Item 1",
              targetWatchlistId: "wl_default",
              minLiquidity: 50,
            },
          ],
          pruneUnassigned: true,
        },
        showToast: mockShowToast,
      },
      mockOnProgress
    );

    // Only the 2 hydrated non-qualifiers (RELIANCE and WIPRO) should be pruned.
    // UNHYDRATED_SYM must NOT be pruned because it was never hydrated!
    expect(result.prunedCount).toBe(2);
    // Check state update passed to setData
    const stateUpdater = mockSetData.mock.calls[mockSetData.mock.calls.length - 1][0];
    const finalState = stateUpdater({ weeks: { IN: { "2026-11-15": { stocks: storageState.trading_app_data.weeks.IN["2026-11-15"].stocks } } } });
    const finalStocks = finalState.weeks.IN["2026-11-15"].stocks;
    expect(finalStocks["UNHYDRATED_SYM"]).toBeDefined();
    expect(finalStocks["RELIANCE"]).toBeUndefined();
    expect(finalStocks["WIPRO"]).toBeUndefined();
  });

  it("prevents premature Stage 5 execution if background queue is actively running and hydration is partial", async () => {
    const storageState = {
      trading_app_data: {
        weeks: {
          IN: {
            "2026-11-15": {
              stocks: {
                TCS: { symbol: "TCS", params: { movingAverages: "Above 21", liquidity: "100Cr" }, turnoverCr: 100 },
                INFY: { symbol: "INFY", params: {}, watchlists: [] },
                RELIANCE: { symbol: "RELIANCE", params: {}, watchlists: [] },
              },
            },
          },
        },
      },
    };

    global.chrome = {
      storage: {
        local: {
          get: vi.fn((keys, cb) => cb(storageState)),
          set: vi.fn((data, cb) => cb && cb()),
        },
      },
      runtime: {
        sendMessage: vi.fn((msg, cb) => {
          if (msg.action === "GET_METRICS_QUEUE_STATUS") {
            // Queue is actively processing!
            cb && cb({ isProcessing: true, queueLength: 100, completedJobs: 340, totalJobs: 471 });
          } else {
            cb && cb({ status: "queued", count: 2 });
          }
        }),
        lastError: null,
      },
    };

    // Fast-forward or trigger error by simulating active processing check
    await expect(
      chartinkAutomation.execute(
        {
          country: "IN",
          weekKey: "2026-11-15",
          data: { watchlists: [{ id: "wl_default", name: "Default Watchlist" }] },
          setData: vi.fn(),
          setWeekKey: vi.fn(),
          setSelectedWatchlistId: vi.fn(),
          criteria: {
            workItems: [{ id: "wi_primary", label: "Work Item 1", targetWatchlistId: "wl_default" }],
            pruneUnassigned: false,
          },
          showToast: vi.fn(),
          maxWaitMs: 50,
          stallTimeoutMs: 20,
        },
        vi.fn()
      )
    ).rejects.toThrow("Hydration was interrupted");
  });
});
