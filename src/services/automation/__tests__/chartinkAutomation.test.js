import { describe, it, expect, vi, beforeEach } from "vitest";
import { chartinkAutomation } from "../chartinkAutomation";

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
});
