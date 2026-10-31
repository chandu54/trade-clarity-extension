import { fetchNseIpoDirectory, hydrateIpoMetricsList } from "../nseIpoService";
import { fetchUsIpoDirectory, hydrateUsIpoMetricsList } from "../usIpoService";
import { getLocalDateString, getSundayOfWeek } from "../../utils/weekHelpers";

export const ipoRadarAutomation = {
  id: "ipo_radar_prep",
  name: "IPO Radar Prep &raquo; Tagged IPO Candidates",
  description: "Downloads official NSE/US listing directory, hydrates daily candles, evaluates Young IPO age (<60d), IPO Base, and VCP tightness, then imports into target watchlist.",
  countries: ["IN", "US"],
  icon: "🚀",
  stages: [
    "1. Directory Fetch",
    "2. Listing Age & Patterns",
    "3. Candle & Technical Hydration",
    "4. Custom Filter & Import",
  ],
  defaultCriteria: {
    targetWatchlistId: "wl_ipo",
    pattern: "any_young", // "any_young" | "ipo_base_or_vcp" | "ipo_base_only" | "fresh_young"
    minAdr: 0, // Default: No ADR requirement
    minLiquidity: 50, // Default: 50 Cr for IN, $50M for US
  },

  async execute(context, onProgress) {
    const {
      country,
      weekKey,
      data,
      setData,
      setSelectedWatchlistId,
      criteria,
    } = context;

    const activeCriteria = { ...this.defaultCriteria, ...(criteria || {}) };
    const isUs = country === "US";

    // Stage 1: Directory Fetch
    onProgress(0, 20, `Stage 1/4: Fetching official ${isUs ? "US (NASDAQ & NYSE)" : "NSE (Main & SME)"} IPO directory...`);
    const directory = isUs
      ? await fetchUsIpoDirectory()
      : await fetchNseIpoDirectory();

    if (!directory || directory.length === 0) {
      throw new Error(`Failed to load ${isUs ? "US" : "NSE"} IPO directory.`);
    }

    // Stage 2: Listing Age & Structure Scan
    onProgress(1, 40, `Stage 2/4: Scanning ${directory.length} listings for IPO age and base structures...`);

    // Stage 3: Candle & Technical Hydration
    onProgress(2, 50, `Stage 3/4: Hydrating candles & technical indicators...`);

    const onHydrationProgress = (current, total) => {
      const pct = Math.round((current / total) * 100);
      const stagePct = 50 + Math.round((pct / 100) * 35); // 50% to 85%
      onProgress(2, stagePct, `Stage 3/4: Hydrating candles & indicators: ${current}/${total} (${pct}%)...`);
    };

    const hydratedList = isUs
      ? await hydrateUsIpoMetricsList(directory, onHydrationProgress, data?.paramDefinitions || {}, 20, 20, false)
      : await hydrateIpoMetricsList(directory, "IN", onHydrationProgress, data?.paramDefinitions || {}, 20, 20, false);

    const safeList = hydratedList && hydratedList.length > 0 ? hydratedList : directory;

    // Stage 4: Custom Filter & Watchlist Ingestion
    onProgress(3, 90, `Stage 4/4: Applying custom criteria & importing candidates...`);

    const minAdr = Number(activeCriteria.minAdr) || 0;
    const minLiq = Number(activeCriteria.minLiquidity) || 0;
    const pattern = activeCriteria.pattern || "any_young";

    const filteredIpos = safeList.filter((item) => {
      // 1. Pattern filter
      if (pattern === "fresh_young") {
        if (!item.isYoungIpo && (item.daysAgo === undefined || item.daysAgo > 60)) return false;
      } else if (pattern === "ipo_base_only") {
        if (!item.isIpoBase) return false;
      } else if (pattern === "ipo_base_or_vcp") {
        if (!item.isIpoBase && !item.vcpTight) return false;
      }

      // 2. ADR Volatility Filter
      if (minAdr > 0) {
        const adrVal = item.adrNum !== undefined ? item.adrNum : item.params?.adr;
        if (adrVal !== undefined && adrVal !== null && !isNaN(Number(adrVal))) {
          if (Number(adrVal) < minAdr) return false;
        }
      }

      // 3. Liquidity Turnover Filter
      if (minLiq > 0) {
        const liqVal = item.turnoverCr !== undefined ? item.turnoverCr : (item.liquidityVal ? item.liquidityVal / 10000000 : 0);
        if (liqVal !== undefined && liqVal !== null && !isNaN(Number(liqVal))) {
          if (Number(liqVal) < minLiq) return false;
        }
      }

      return true;
    });

    // Ingest into target week and watchlist
    let targetWeek = weekKey;
    if (!targetWeek) {
      const todayStr = getLocalDateString(new Date());
      targetWeek = getSundayOfWeek(todayStr);
    }

    const currentDb = await new Promise((res) => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get(["trading_app_data"], (r) => res(r?.trading_app_data || null));
      } else {
        res(null);
      }
    });

    let updatedWatchlists = currentDb?.watchlists || data.watchlists || [];
    let targetWlId = activeCriteria.targetWatchlistId || "wl_ipo";

    let targetWl = updatedWatchlists.find(
      (w) => w.id === targetWlId || (targetWlId === "wl_ipo" && (w.name && (w.name.toLowerCase() === "ipo" || w.name.toLowerCase().includes("ipo"))))
    );

    if (!targetWl) {
      targetWl = {
        id: targetWlId === "wl_ipo" ? "wl_ipo" : `wl_${Date.now()}`,
        name: "IPO Watchlist",
        isDefault: false,
        visibleParams: Object.keys(data.paramDefinitions || {}),
        visibleFilters: Object.keys(data.paramDefinitions || {}),
      };
      updatedWatchlists = [...updatedWatchlists, targetWl];
    }

    const activeWeeks = currentDb?.weeks || data.weeks || {};
    const countryWeeks = activeWeeks[country] || {};
    const currentWeekData = countryWeeks[targetWeek] || { stocks: {} };
    const weekStocks = { ...(currentWeekData.stocks || {}) };

    filteredIpos.forEach((item) => {
      const symUpper = item.symbol.toUpperCase();
      const existing = weekStocks[symUpper];

      const tagsToAdd = [item.defaultTag || "Young IPO"];
      if (item.isIpoBase) tagsToAdd.push("IPO Base");
      if (item.vcpTight) tagsToAdd.push("VCP Tight");

      const mergedTags = Array.from(new Set([...(existing?.tags || []), ...tagsToAdd]));
      const mergedWatchlists = Array.from(new Set([...(existing?.watchlists || []), targetWl.id]));

      const baseParams = existing?.params || {};
      const updatedParams = {
        ...baseParams,
        ...(item.priceVal ? { close: item.priceVal } : {}),
        ...(item.dailyChangeNum !== undefined ? { changePercent: item.dailyChangeNum } : {}),
        ...(item.adrNum !== undefined ? { adrPercent: item.adrNum } : {}),
        ...(item.liquidity ? { liquidity: item.liquidity } : {}),
        ...(item.listingDateStr ? { listingDate: item.listingDateStr } : {}),
        ...(item.movingAverages ? { movingAverages: item.movingAverages } : {}),
      };

      weekStocks[symUpper] = {
        symbol: symUpper,
        name: item.name || existing?.name || "",
        sector: item.sector || existing?.sector || (item.isSme ? "SME" : ""),
        macroTheme: existing?.macroTheme || "",
        thematicVectors: existing?.thematicVectors || [],
        businessScope: existing?.businessScope || [],
        dependentIndustries: existing?.dependentIndustries || [],
        tradable: existing?.tradable || false,
        notes: existing?.notes || `Listing Date: ${item.listingDateStr || ""} (${item.daysAgo || 0}d ago)${item.ipoBaseResult?.pattern ? ` | ${item.ipoBaseResult.pattern}` : ""}`,
        tags: mergedTags,
        watchlists: mergedWatchlists,
        params: updatedParams,
      };
    });

    // Save to React State & Storage
    setData((prev) => ({
      ...prev,
      watchlists: updatedWatchlists,
      weeks: {
        ...(prev.weeks || {}),
        [country]: {
          ...(prev.weeks?.[country] || {}),
          [targetWeek]: {
            ...currentWeekData,
            stocks: weekStocks,
          },
        },
      },
    }));

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["trading_app_data"], (res) => {
        const db = res?.trading_app_data;
        if (db) {
          db.watchlists = updatedWatchlists;
          if (!db.weeks) db.weeks = {};
          if (!db.weeks[country]) db.weeks[country] = {};
          if (!db.weeks[country][targetWeek]) db.weeks[country][targetWeek] = {};
          db.weeks[country][targetWeek].stocks = weekStocks;
          db._lastModified = Date.now();
          chrome.storage.local.set({ trading_app_data: db });
        }
      });
    }

    if (setSelectedWatchlistId) {
      setSelectedWatchlistId(targetWl.id);
    }

    onProgress(3, 100, `Done! ${filteredIpos.length} candidate IPOs imported into "${targetWl.name}".`);

    return {
      success: true,
      totalScanned: directory.length,
      passingCount: filteredIpos.length,
      targetWatchlistName: targetWl.name,
      targetWeek,
    };
  },
};
