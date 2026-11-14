import { fetchChartinkSymbols, filterPassingSetups } from "../chartinkService";
import { getLocalDateString, getSundayOfWeek } from "../../utils/weekHelpers";

export const chartinkAutomation = {
  id: "chartink_scanner",
  name: "Chartink Scanner &raquo; Qualified Setups",
  description: "Fetches ~300 tickers from Legacy Scanner, handles weekend routing, hydrates technical indicators, evaluates criteria, and copies into target watchlist.",
  countries: ["IN"],
  icon: "📈",
  stages: [
    "1. Token & Fetch",
    "2. Weekend Routing",
    "3. Ingest All Stocks",
    "4. Candle & Technical Hydration",
    "5. Work Items & Pruning",
  ],
  defaultCriteria: {
    minLiquidity: 50,
    maxLiquidity: 0,
    maAlignment: "21_50_200",
    rsRating: "strong_neutral",
    stage: "stage_2",
    targetWatchlistId: "wl_default",
    secondaryMinLiquidity: 25,
    secondaryMaxLiquidity: 50,
    secondaryMaAlignment: "50_200",
    secondaryRsRating: "strong_neutral",
    secondaryStage: "stage_2",
    secondaryTargetWatchlistId: "wl_mid_liquidity",
    workItems: [
      {
        id: "wi_primary",
        label: "Work Item 1: High Liquidity Setups",
        targetWatchlistId: "wl_default",
        maAlignment: "21_50_200",
        minLiquidity: 50,
        maxLiquidity: 0,
        rsRating: "strong_neutral",
        stage: "stage_2",
      },
      {
        id: "wi_secondary",
        label: "Work Item 2: Mid-Cap Liquidity Setups (25-50 Cr)",
        targetWatchlistId: "wl_mid_liquidity",
        maAlignment: "50_200",
        minLiquidity: 25,
        maxLiquidity: 50,
        rsRating: "strong_neutral",
        stage: "stage_2",
      },
    ],
    pruneUnassigned: true,
  },

  async execute(context, onProgress) {
    const {
      country,
      weekKey,
      data,
      setData,
      setWeekKey,
      setSelectedWatchlistId,
      criteria,
    } = context;

    // Normalizing criteria: support both legacy flat structure and new workItems array
    const activeWorkItems = criteria?.workItems && Array.isArray(criteria.workItems)
      ? criteria.workItems
      : [
          {
            id: "wi_primary",
            label: "Work Item 1: High Liquidity Setups",
            targetWatchlistId: criteria?.targetWatchlistId || "wl_default",
            maAlignment: criteria?.maAlignment || "21_50_200",
            minLiquidity: criteria?.minLiquidity !== undefined ? Number(criteria.minLiquidity) : 50,
            maxLiquidity: criteria?.maxLiquidity !== undefined ? Number(criteria.maxLiquidity) : 0,
            rsRating: criteria?.rsRating || "strong_neutral",
            stage: criteria?.stage || "stage_2",
          },
          {
            id: "wi_secondary",
            label: "Work Item 2: Mid-Cap Liquidity Setups (25-50 Cr)",
            targetWatchlistId: criteria?.secondaryTargetWatchlistId || "wl_mid_liquidity",
            maAlignment: criteria?.secondaryMaAlignment || "50_200",
            minLiquidity: criteria?.secondaryMinLiquidity !== undefined ? Number(criteria.secondaryMinLiquidity) : 25,
            maxLiquidity: criteria?.secondaryMaxLiquidity !== undefined ? Number(criteria.secondaryMaxLiquidity) : 50,
            rsRating: criteria?.secondaryRsRating || "strong_neutral",
            stage: criteria?.secondaryStage || "stage_2",
          },
        ];

    const pruneUnassigned = criteria?.pruneUnassigned !== undefined ? Boolean(criteria.pruneUnassigned) : true;

    // Stage 1: Connect & Fetch
    onProgress(0, 15, "Stage 1/5: Connecting to Chartink API & extracting tickers...");
    const symbols = await fetchChartinkSymbols();
    if (!symbols || symbols.length === 0) {
      throw new Error("No symbols returned from Chartink scanner.");
    }

    // Stage 2: Weekend Routing
    onProgress(1, 30, "Stage 2/5: Applying weekend routing logic...");
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sunday, 6: Saturday
    let targetWeek = weekKey;

    if (dayOfWeek === 6 || dayOfWeek === 0) {
      const daysToAdd = dayOfWeek === 6 ? 2 : 1;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysToAdd);
      targetWeek = getSundayOfWeek(getLocalDateString(nextMonday));

      setData((prev) => {
        const newData = { ...prev };
        newData.weeks = newData.weeks || {};
        if (!newData.weeks[country]) newData.weeks[country] = {};
        if (!newData.weeks[country][targetWeek]) {
          newData.weeks[country][targetWeek] = { stocks: {} };
        }
        return newData;
      });

      if (setWeekKey && weekKey !== targetWeek) {
        setWeekKey(targetWeek);
      }
    }

    // Stage 3: Dataset Ingestion
    onProgress(2, 45, `Stage 3/5: Ingesting ${symbols.length} tickers into target week (${targetWeek})...`);

    // Synchronously write stub entries for all symbols into chrome.storage.local FIRST
    // so background.js can immediately find and update them!
    let symbolsToHydrate = [];
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await new Promise((resolve) => {
        chrome.storage.local.get(["trading_app_data"], (r) => {
          const db = r?.trading_app_data || {};
          db.weeks = db.weeks || {};
          db.weeks[country] = db.weeks[country] || {};
          const currentWeek = db.weeks[country][targetWeek] || { stocks: {} };
          currentWeek.stocks = currentWeek.stocks || {};

          const newSymbols = symbols.filter((sym) => !currentWeek.stocks[sym]);
          const unhydratedSymbols = symbols.filter((sym) => {
            const s = currentWeek.stocks[sym];
            if (!s || s.isInvalid) return false;
            const p = s.params || {};
            const cLow = (country || "IN").toLowerCase();
            const hasMa = Boolean(p.movingAverages || p[`${cLow}.movingAverages`] || s.movingAverages);
            const hasLiq = Boolean(p.liquidity || p[`${cLow}.liquidity`] || s.turnoverCr || s.liquidityVal);
            return !hasMa || !hasLiq;
          });
          symbolsToHydrate = Array.from(new Set([...newSymbols, ...unhydratedSymbols]));

          symbols.forEach((sym) => {
            if (!currentWeek.stocks[sym]) {
              currentWeek.stocks[sym] = {
                symbol: sym,
                sector: "",
                macroTheme: "",
                thematicVectors: [],
                businessScope: [],
                dependentIndustries: [],
                tradable: false,
                notes: "",
                tags: [],
                params: {},
                watchlists: [],
              };
            }
          });

          db.weeks[country][targetWeek] = currentWeek;
          db._lastModified = Date.now();
          chrome.storage.local.set({ trading_app_data: db }, () => resolve());
        });
      });
    }

    // Ingest into React state as well
    setData((prev) => {
      const currentWeek = prev.weeks?.[country]?.[targetWeek] || { stocks: {} };
      const currentStocks = currentWeek.stocks || {};
      const newStocks = { ...currentStocks };

      symbols.forEach((sym) => {
        if (!newStocks[sym]) {
          newStocks[sym] = {
            symbol: sym,
            sector: "",
            macroTheme: "",
            thematicVectors: [],
            businessScope: [],
            dependentIndustries: [],
            tradable: false,
            notes: "",
            tags: [],
            params: {},
            watchlists: [],
          };
        }
      });

      return {
        ...prev,
        weeks: {
          ...(prev.weeks || {}),
          [country]: {
            ...(prev.weeks?.[country] || {}),
            [targetWeek]: {
              ...currentWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });

    // Trigger background metrics hydration and await receipt
    if (symbolsToHydrate.length > 0 && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "FETCH_STOCK_METRICS",
            payload: {
              symbols: symbolsToHydrate,
              country,
              weekKey: targetWeek,
              paramDefs: data?.paramDefinitions,
              adrDays: data?.uiConfig?.adrDays || 20,
              liquidityDays: data?.uiConfig?.liquidityDays || 20,
            },
          },
          () => resolve()
        );
      });
    }

    // Stage 4: Candle & Technical Hydration
    onProgress(3, 50, `Stage 4/5: Hydrating candles & technical indicators for ${symbols.length} stocks...`);

    const isStockHydrated = (s) => {
      if (!s) return false;
      if (s.isInvalid) return true;
      const p = s.params || {};
      const cLow = (country || "IN").toLowerCase();
      const hasMa = Boolean(p.movingAverages || p[`${cLow}.movingAverages`] || s.movingAverages);
      const hasLiq = Boolean(
        p.liquidity ||
        p[`${cLow}.liquidity`] ||
        s.turnoverCr ||
        s.liquidityVal
      );
      return hasMa && hasLiq;
    };

    // Snapshot initial queue counter to track delta accurately across runs
    const initialQueueStatus = await new Promise((res) => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: "GET_METRICS_QUEUE_STATUS" }, (r) => {
          if (chrome.runtime?.lastError) return res(null);
          res(r);
        });
      } else {
        res(null);
      }
    });
    const initialCompleted = initialQueueStatus?.completedJobs || 0;

    const startTime = Date.now();
    // Dynamic safety ceiling: minimum 10 minutes, or 4 seconds per ticker (overridable in tests)
    const maxSafetyCeilingMs = context?.maxWaitMs || Math.max(600000, symbols.length * 4000);
    // Stall timeout: watchdog triggers if 60 seconds elapse with zero progress (overridable in tests)
    const STALL_TIMEOUT_MS = context?.stallTimeoutMs || 60000;

    let hydratedStocks = {};
    let lastProgressTime = Date.now();
    let maxEffectiveCompleted = 0;
    let lastWakeupTime = 0;
    let retryCount = 0;
    const MAX_WAKEUP_RETRIES = 2;

    while (Date.now() - startTime < maxSafetyCeilingMs) {
      const storageData = await new Promise((res) => {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          chrome.storage.local.get(["trading_app_data"], (r) => res(r?.trading_app_data || null));
        } else {
          res(null);
        }
      });

      const activeStocks = storageData?.weeks?.[country]?.[targetWeek]?.stocks || {};
      hydratedStocks = activeStocks;

      let hydratedCount = 0;
      for (const sym of symbols) {
        if (isStockHydrated(activeStocks[sym])) {
          hydratedCount++;
        }
      }

      const queueStatus = await new Promise((res) => {
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: "GET_METRICS_QUEUE_STATUS" }, (r) => {
            if (chrome.runtime?.lastError) return res(null);
            res(r);
          });
        } else {
          res(null);
        }
      });

      // Synchronize displayed count with background queue progress
      // Relative completed jobs during this session
      const queueDelta = Math.max(0, (queueStatus?.completedJobs || 0) - initialCompleted);
      const currentCompleted = Math.min(
        symbols.length,
        Math.max(hydratedCount, queueDelta)
      );

      if (currentCompleted > maxEffectiveCompleted) {
        maxEffectiveCompleted = currentCompleted;
        lastProgressTime = Date.now();
      }

      const pct = symbols.length > 0 ? Math.round((maxEffectiveCompleted / symbols.length) * 100) : 100;
      const stageProgress = 50 + Math.round((pct / 100) * 35); // 50% to 85%
      onProgress(3, stageProgress, `Stage 4/5: Hydrating candles & indicators: ${maxEffectiveCompleted}/${symbols.length} (${pct}%)...`);

      // Exit condition 1: All symbols in this scan have been resolved (either hydrated or marked invalid)
      const allResolved = symbols.every((sym) => {
        const s = activeStocks[sym];
        return s && (isStockHydrated(s) || s.isInvalid);
      });
      if (allResolved || (symbols.length > 0 && hydratedCount >= symbols.length)) {
        break;
      }

      // Exit condition 2: Background queue has finished all assigned jobs and is no longer processing
      const queueDrained =
        queueStatus &&
        !queueStatus.isProcessing &&
        queueStatus.queueLength === 0 &&
        (queueStatus.totalJobs === 0 || queueStatus.completedJobs >= queueStatus.totalJobs);

      if (queueDrained) {
        // Double check if any symbols remain unhydrated
        const unhydratedLeft = symbols.filter((sym) => {
          const s = activeStocks[sym];
          return !s || (!isStockHydrated(s) && !s.isInvalid);
        });

        if (unhydratedLeft.length === 0) {
          break;
        }

        // If the queue drained but some stocks remain unhydrated, attempt a wake-up retry if not exhausted
        if (retryCount < MAX_WAKEUP_RETRIES && Date.now() - lastWakeupTime > 5000) {
          retryCount++;
          lastWakeupTime = Date.now();
          lastProgressTime = Date.now();
          console.log(`[ChartinkAutomation] Self-healing wake-up retry ${retryCount}/${MAX_WAKEUP_RETRIES} for ${unhydratedLeft.length} remaining tickers...`);
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              action: "FETCH_STOCK_METRICS",
              payload: {
                symbols: unhydratedLeft,
                country,
                weekKey: targetWeek,
                paramDefs: data?.paramDefinitions,
                adrDays: data?.uiConfig?.adrDays || 20,
                liquidityDays: data?.uiConfig?.liquidityDays || 20,
              },
            });
          }
        } else {
          // Retries exhausted or background finished (failed/invalid tickers)
          break;
        }
      }

      // Watchdog: If queue is processing but absolutely no progress has occurred for 60s
      if (Date.now() - lastProgressTime > STALL_TIMEOUT_MS) {
        const unhydratedLeft = symbols.filter((sym) => {
          const s = activeStocks[sym];
          return !s || (!isStockHydrated(s) && !s.isInvalid);
        });

        if (unhydratedLeft.length > 0 && retryCount < MAX_WAKEUP_RETRIES) {
          retryCount++;
          lastWakeupTime = Date.now();
          lastProgressTime = Date.now();
          console.warn(`[ChartinkAutomation] Queue stalled for 60s. Triggering wake-up retry ${retryCount}...`);
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              action: "FETCH_STOCK_METRICS",
              payload: {
                symbols: unhydratedLeft,
                country,
                weekKey: targetWeek,
                paramDefs: data?.paramDefinitions,
                adrDays: data?.uiConfig?.adrDays || 20,
                liquidityDays: data?.uiConfig?.liquidityDays || 20,
              },
            });
          }
        } else {
          console.warn(`[ChartinkAutomation] Queue stalled and retries exhausted. Exiting Stage 4.`);
          break;
        }
      }

      await new Promise((r) => setTimeout(r, 1200));
    }

    // Safety Audit: Verify hydration status before proceeding to Stage 5
    let countHydratedBeforeStage5 = 0;
    symbols.forEach((sym) => {
      if (isStockHydrated(hydratedStocks[sym])) countHydratedBeforeStage5++;
    });

    const finalQueueCheck = await new Promise((res) => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: "GET_METRICS_QUEUE_STATUS" }, (r) => {
          if (chrome.runtime?.lastError) return res(null);
          res(r);
        });
      } else {
        res(null);
      }
    });

    // Guard against premature Stage 5 execution if background queue is still actively running
    if (finalQueueCheck?.isProcessing && countHydratedBeforeStage5 < symbols.length * 0.7) {
      throw new Error(
        `Hydration was interrupted: Only ${countHydratedBeforeStage5}/${symbols.length} tickers hydrated (${Math.round(
          (countHydratedBeforeStage5 / symbols.length) * 100
        )}%) while the background queue is still running. Please wait for background metrics fetch to finish.`
      );
    }

    // Stage 5: Multi-Work-Item Filtering & Unassigned Pruning
    onProgress(4, 90, `Stage 5/5: Processing ${activeWorkItems.length} work items & destination watchlists...`);

    // Fetch fresh database for watchlist lookup
    const currentDb = await new Promise((res) => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get(["trading_app_data"], (r) => res(r?.trading_app_data || null));
      } else {
        res(null);
      }
    });

    let updatedWatchlists = currentDb?.watchlists || data.watchlists || [];
    const updatedStocks = { ...hydratedStocks };
    const workItemResults = [];

    // Helper to get or create watchlist
    const ensureWatchlist = (wlId, defaultName) => {
      let wl = updatedWatchlists.find(
        (w) => w.id === wlId || (wlId === "wl_default" && (w.isDefault || (w.name && w.name.toLowerCase().includes("default"))))
      );
      if (!wl) {
        wl = {
          id: wlId || `wl_${Date.now()}`,
          name: defaultName || "Default Watchlist",
          isDefault: wlId === "wl_default",
          visibleParams: Object.keys(data.paramDefinitions || {}),
          visibleFilters: Object.keys(data.paramDefinitions || {}),
        };
        updatedWatchlists = [...updatedWatchlists, wl];
      }
      return wl;
    };

    // Execute each work item
    activeWorkItems.forEach((wi, index) => {
      const passing = filterPassingSetups(hydratedStocks, country, {
        maAlignment: wi.maAlignment,
        minLiquidity: Number(wi.minLiquidity) || 0,
        maxLiquidity: Number(wi.maxLiquidity) || 0,
        rsRating: wi.rsRating,
        stage: wi.stage,
      });

      const fallbackName = index === 0 ? "Default Watchlist" : `Watchlist ${index + 1}`;
      const targetWl = ensureWatchlist(wi.targetWatchlistId, fallbackName);

      // Assign matching stocks to this target watchlist
      passing.forEach((sym) => {
        if (updatedStocks[sym]) {
          const currentWls = updatedStocks[sym].watchlists || [];
          if (!currentWls.includes(targetWl.id)) {
            updatedStocks[sym] = {
              ...updatedStocks[sym],
              watchlists: [...currentWls, targetWl.id],
            };
          }
        }
      });

      workItemResults.push({
        id: wi.id,
        label: wi.label || `Work Item ${index + 1}`,
        targetWatchlistName: targetWl.name,
        targetWatchlistId: targetWl.id,
        passingCount: passing.length,
      });
    });

    // Check count of hydrated stocks before allowing pruning
    let countHydrated = 0;
    Object.keys(updatedStocks).forEach((sym) => {
      if (isStockHydrated(updatedStocks[sym])) countHydrated++;
    });

    // Work Item 3: Delete / Prune unassigned stocks from week pool if configured
    let prunedCount = 0;
    // Safety check: Require at least 80% hydration completion before allowing pruning,
    // to safeguard user data against accidental wipes due to temporary network or rate limit issues.
    const hydrationRatio = symbols.length > 0 ? countHydrated / symbols.length : 0;
    const minRequiredHydrationRate = 0.8;

    if (pruneUnassigned && hydrationRatio >= minRequiredHydrationRate) {
      onProgress(4, 96, "Stage 5/5: Pruning non-qualifying unassigned stocks from week pool...");
      Object.keys(updatedStocks).forEach((sym) => {
        const wls = updatedStocks[sym]?.watchlists || [];
        // Only prune stocks that belong to the scanned set, ended up with 0 watchlists,
        // AND were verified hydrated (never prune unhydrated tickers)
        if (wls.length === 0 && symbols.includes(sym) && isStockHydrated(updatedStocks[sym])) {
          delete updatedStocks[sym];
          prunedCount++;
        }
      });
    } else if (pruneUnassigned && hydrationRatio < minRequiredHydrationRate) {
      console.warn(
        `[ChartinkAutomation] Skipped pruning: Only ${countHydrated}/${symbols.length} (${Math.round(hydrationRatio * 100)}%) stocks were hydrated. Preserving all tickers for safety.`
      );
      if (context.showToast) {
        context.showToast(`Hydration reached ${Math.round(hydrationRatio * 100)}%. Pruning was safely skipped to prevent losing unhydrated tickers.`, "info");
      }
    }

    const todayStr = getLocalDateString(new Date());
    const nowTime = Date.now();

    // Persist all updates to React State & chrome.storage.local
    setData((prev) => {
      const prevWeek = prev.weeks?.[country]?.[targetWeek] || {};
      return {
        ...prev,
        watchlists: updatedWatchlists,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...(prev.weeks?.[country] || {}),
            [targetWeek]: {
              ...prevWeek,
              stocks: updatedStocks,
              lastSyncDate: todayStr,
              lastUpdatedTime: nowTime,
            },
          },
        },
      };
    });

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["trading_app_data"], (res) => {
        const db = res?.trading_app_data;
        if (db) {
          db.watchlists = updatedWatchlists;
          if (!db.weeks) db.weeks = {};
          if (!db.weeks[country]) db.weeks[country] = {};
          if (!db.weeks[country][targetWeek]) db.weeks[country][targetWeek] = {};
          db.weeks[country][targetWeek].stocks = updatedStocks;
          db.weeks[country][targetWeek].lastSyncDate = todayStr;
          db.weeks[country][targetWeek].lastUpdatedTime = nowTime;
          db._lastModified = nowTime;
          chrome.storage.local.set({ trading_app_data: db });
        }
      });
    }

    // Focus primary target watchlist in UI
    if (setSelectedWatchlistId && workItemResults[0]?.targetWatchlistId) {
      setSelectedWatchlistId(workItemResults[0].targetWatchlistId);
    }

    const summaryParts = workItemResults.map(
      (r) => `${r.passingCount} setups &rarr; "${r.targetWatchlistName}"`
    );
    if (prunedCount > 0) {
      summaryParts.push(`${prunedCount} unassigned pruned`);
    }

    onProgress(4, 100, `Done! ${summaryParts.join(" | ")}`);

    return {
      success: true,
      totalScanned: symbols.length,
      workItemResults,
      prunedCount,
      targetWeek,
    };
  },
};
