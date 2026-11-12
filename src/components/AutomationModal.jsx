import { useState, useMemo, useEffect } from "react";
import Modal from "./Modal";
import { getAutomationsForCountry } from "../services/automation/automationRegistry";
import {
  getAutomationStates,
  setAutomationState,
  subscribeAutomationState,
} from "../services/automation/automationStateStore";

export default function AutomationModal({
  isOpen,
  onClose,
  data,
  setData,
  country = "IN",
  weekKey,
  setWeekKey,
  selectedWatchlistId: _selectedWatchlistId,
  setSelectedWatchlistId,
  showToast,
}) {
  const automations = useMemo(() => getAutomationsForCountry(country), [country]);
  const watchlists = data?.watchlists || [];

  // Local state for task criteria overrides (saved per task ID in data.automationSettings)
  const [taskCriteria, setTaskCriteria] = useState(() => {
    const saved = data?.automationSettings || {};
    return structuredClone(saved);
  });

  // Global persistent execution states subscribed from store
  const [runningStates, setRunningStates] = useState(getAutomationStates);

  // Expanded config state per task ID: default is collapsed (false)
  const [expandedTasks, setExpandedTasks] = useState({});

  useEffect(() => {
    const unsubscribe = subscribeAutomationState((states) => {
      setRunningStates({ ...states });
    });
    return unsubscribe;
  }, []);

  // Ensure standard watchlists (Default, Watchlist 2, IPO Watchlist) exist in data.watchlists and storage
  useEffect(() => {
    if (!data) return;
    const currentList = Array.isArray(data.watchlists) ? [...data.watchlists] : [];
    const standardDefs = [
      { id: "wl_default", name: "Default Watchlist", isDefault: true },
      { id: "wl_mid_liquidity", name: "Watchlist 2", isDefault: false },
      { id: "wl_ipo", name: "IPO Watchlist", isDefault: false },
    ];
    let needsUpdate = false;
    standardDefs.forEach((def) => {
      const exists = currentList.some(
        (w) => w.id === def.id || (def.id === "wl_default" && (w.isDefault || w.name?.toLowerCase().includes("default")))
      );
      if (!exists) {
        currentList.push({
          id: def.id,
          name: def.name,
          isDefault: def.isDefault,
          visibleParams: Object.keys(data.paramDefinitions || {}),
          visibleFilters: Object.keys(data.paramDefinitions || {}),
        });
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      setData((prev) => ({ ...prev, watchlists: currentList }));
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get(["trading_app_data"], (res) => {
          const db = res?.trading_app_data;
          if (db) {
            db.watchlists = currentList;
            db._lastModified = Date.now();
            chrome.storage.local.set({ trading_app_data: db });
          }
        });
      }
    }
  }, [data, setData]);

  const toggleExpand = (taskId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleUpdateCriteria = (taskId, field, value) => {
    setTaskCriteria((prev) => {
      const next = {
        ...prev,
        [taskId]: {
          ...(prev[taskId] || {}),
          [field]: value,
        },
      };

      // Persist criteria to storage
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get(["trading_app_data"], (res) => {
          const db = res?.trading_app_data;
          if (db) {
            db.automationSettings = next;
            chrome.storage.local.set({ trading_app_data: db });
          }
        });
      }
      return next;
    });
  };

  const handleRunTask = async (task) => {
    if (runningStates[task.id]?.isRunning) return;

    setAutomationState(task.id, {
      isRunning: true,
      currentStage: 0,
      pct: 10,
      statusText: "Starting automation...",
      result: null,
      error: null,
      startTime: Date.now(),
    });

    const criteria = {
      ...task.defaultCriteria,
      ...(taskCriteria[task.id] || {}),
    };

    try {
      const result = await task.execute(
        {
          country,
          weekKey,
          data,
          setData,
          setWeekKey,
          setSelectedWatchlistId,
          criteria,
          showToast,
        },
        (stageIndex, pct, statusText) => {
          setAutomationState(task.id, {
            currentStage: stageIndex,
            pct,
            statusText,
          });
        }
      );

      setAutomationState(task.id, {
        isRunning: false,
        currentStage: task.stages.length - 1,
        pct: 100,
        statusText: "Completed successfully!",
        result,
        error: null,
      });

      showToast(
        `🎉 ${task.name} completed! ${result.passingCount || 0} setups copied to "${result.targetWatchlistName}".`,
        "success"
      );
    } catch (err) {
      console.error(`Automation ${task.id} failed:`, err);
      setAutomationState(task.id, {
        isRunning: false,
        currentStage: 0,
        pct: 0,
        statusText: `Failed: ${err.message}`,
        result: null,
        error: err.message,
      });
      showToast(`Automation failed: ${err.message}`, "error");
    }
  };

  const isAnyRunning = Object.values(runningStates).some((s) => s?.isRunning);

  const handleRunAllSequential = async () => {
    if (isAnyRunning) return;
    showToast(`Starting sequential execution of all ${automations.length} automations...`, "info");
    for (const task of automations) {
      await handleRunTask(task);
    }
    showToast("🎉 All automations completed sequentially!", "success");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automation Engine"
      subtitle={`Run automated scanning, hydration, and watchlist preparation workflows for ${country === "IN" ? "India (NSE)" : "United States (US)"}`}
      className="modal-automation"
    >
      <div className="automation-modal-container space-y-4 max-h-[75vh] overflow-y-auto themed-scroll pr-1">
        {/* Bulk Sequential Execution Header Bar */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <div>
              <span className="font-bold text-[var(--text)]">Bulk Execution:</span>
              <span className="text-[var(--muted)] ml-1.5">
                Run all {automations.length} available automations in sequence safely
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunAllSequential}
            disabled={isAnyRunning}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm ${
              isAnyRunning
                ? "bg-slate-600 dark:bg-slate-700 text-slate-300 cursor-not-allowed opacity-75"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white shadow-blue-500/20 cursor-pointer"
            }`}
          >
            <span>{isAnyRunning ? "⏳" : "⚡"}</span>
            <span>{isAnyRunning ? "Running..." : "Run All (Sequential)"}</span>
          </button>
        </div>

        {automations.map((task) => {
          const runState = runningStates[task.id] || { isRunning: false, pct: 0 };
          const activeCriteria = {
            ...task.defaultCriteria,
            ...(taskCriteria[task.id] || {}),
          };

          return (
            <div
              key={task.id}
              className="automation-card space-y-3.5"
            >
              {/* Header Info & Play Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-xl shrink-0 mt-0.5">
                    {task.icon || "⚡"}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-[var(--text)] m-0 leading-tight" dangerouslySetInnerHTML={{ __html: task.name }} />
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                        runState.isRunning 
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 animate-pulse"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}>
                        {runState.isRunning ? "Running..." : "Ready"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)] font-medium">
                        {task.countries.join(" & ")}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] m-0 leading-normal">
                      {task.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(task.id)}
                    className="automation-config-toggle"
                    title={expandedTasks[task.id] ? "Collapse Configuration" : "Expand Configuration"}
                  >
                    <span>⚙️</span>
                    <span>{expandedTasks[task.id] ? "Hide Config" : "Configure"}</span>
                    <span className="text-[10px]">{expandedTasks[task.id] ? "▲" : "▼"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunTask(task)}
                    disabled={runState.isRunning}
                    className={`px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition shadow-sm ${
                      runState.isRunning
                        ? "bg-slate-600 dark:bg-slate-700 text-slate-200 cursor-not-allowed opacity-80"
                        : "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-blue-600/20 cursor-pointer"
                    }`}
                  >
                    <span>{runState.isRunning ? "⏳" : "▶"}</span>
                    <span>{runState.isRunning ? "Running..." : "Run"}</span>
                  </button>
                </div>
              </div>

              {/* Configurable Filter & Target Controls (Collapsible) */}
              {expandedTasks[task.id] && (
                <div className="automation-config-box space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text)] border-b border-[var(--border)] pb-2">
                    <span className="flex items-center gap-1.5">
                      <span>🎛️</span>
                      <span>Configurable Criteria &amp; Target Watchlists:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskCriteria((prev) => {
                          const next = { ...prev };
                          delete next[task.id];
                          if (typeof chrome !== "undefined" && chrome.storage?.local) {
                            chrome.storage.local.get(["trading_app_data"], (res) => {
                              const db = res?.trading_app_data;
                              if (db) {
                                db.automationSettings = next;
                                chrome.storage.local.set({ trading_app_data: db });
                              }
                            });
                          }
                          return next;
                        });
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  {/* Chartink Scanner Multi-Work-Item UI */}
                  {task.id === "chartink_scanner" && (
                    <div className="space-y-4">
                      {/* Work Item 1 Section */}
                      <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] space-y-2">
                        <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                          <span>📦 Work Item 1: High Liquidity Setups (≥50 Cr)</span>
                          <span className="text-[10px] text-[var(--muted)] font-normal">Primary setup bucket</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Destination Watchlist</label>
                            <select
                              value={activeCriteria.targetWatchlistId || "wl_default"}
                              onChange={(e) => handleUpdateCriteria(task.id, "targetWatchlistId", e.target.value)}
                              className="automation-select"
                            >
                              <option value="wl_default">Default Watchlist</option>
                              {watchlists
                                .filter((w) => w.id !== "wl_default" && w.id !== "wl_ipo")
                                .map((w) => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Moving Averages</label>
                            <select
                              value={activeCriteria.maAlignment || "21_50_200"}
                              onChange={(e) => handleUpdateCriteria(task.id, "maAlignment", e.target.value)}
                              className="automation-select"
                            >
                              <option value="21_50_200">Above 21, 50, 200</option>
                              <option value="50_200">Above 50, 200</option>
                              <option value="all">Above 5, 10, 21, 50, 200</option>
                              <option value="any">Any Alignment (Off)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Min Turnover (Cr)</label>
                            <div className="automation-input-group">
                              <input
                                type="number"
                                min="0"
                                step="5"
                                value={activeCriteria.minLiquidity !== undefined ? activeCriteria.minLiquidity : 50}
                                onChange={(e) => handleUpdateCriteria(task.id, "minLiquidity", Number(e.target.value))}
                                className="automation-input font-mono"
                              />
                              <span className="automation-input-suffix">₹Cr</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Relative Strength</label>
                            <select
                              value={activeCriteria.rsRating || "strong_neutral"}
                              onChange={(e) => handleUpdateCriteria(task.id, "rsRating", e.target.value)}
                              className="automation-select"
                            >
                              <option value="strong_neutral">Strong, Very Strong, Neutral</option>
                              <option value="strong_only">Strong &amp; Very Strong Only</option>
                              <option value="very_strong">Very Strong Only</option>
                              <option value="any">Any RS Rating</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Weinstein Stage</label>
                            <select
                              value={activeCriteria.stage || "stage_2"}
                              onChange={(e) => handleUpdateCriteria(task.id, "stage", e.target.value)}
                              className="automation-select"
                            >
                              <option value="stage_2">Stage 2 Only</option>
                              <option value="stage_1_2">Stage 1 &amp; Stage 2</option>
                              <option value="any">Any Stage</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Work Item 2 Section */}
                      <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] space-y-2">
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                          <span>📦 Work Item 2: Mid-Cap Liquidity Setups (25-50 Cr)</span>
                          <span className="text-[10px] text-[var(--muted)] font-normal">Secondary setup bucket</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Destination Watchlist</label>
                            <select
                              value={activeCriteria.secondaryTargetWatchlistId || "wl_mid_liquidity"}
                              onChange={(e) => handleUpdateCriteria(task.id, "secondaryTargetWatchlistId", e.target.value)}
                              className="automation-select"
                            >
                              <option value="wl_mid_liquidity">Watchlist 2 (25-50 Cr)</option>
                              <option value="wl_default">Default Watchlist</option>
                              {watchlists
                                .filter((w) => w.id !== "wl_default" && w.id !== "wl_ipo" && w.id !== "wl_mid_liquidity")
                                .map((w) => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Moving Averages</label>
                            <select
                              value={activeCriteria.secondaryMaAlignment || "50_200"}
                              onChange={(e) => handleUpdateCriteria(task.id, "secondaryMaAlignment", e.target.value)}
                              className="automation-select"
                            >
                              <option value="50_200">Above 50, 200</option>
                              <option value="21_50_200">Above 21, 50, 200</option>
                              <option value="all">Above 5, 10, 21, 50, 200</option>
                              <option value="any">Any Alignment (Off)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Turnover Range (Cr)</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="5"
                                placeholder="Min"
                                value={activeCriteria.secondaryMinLiquidity !== undefined ? activeCriteria.secondaryMinLiquidity : 25}
                                onChange={(e) => handleUpdateCriteria(task.id, "secondaryMinLiquidity", Number(e.target.value))}
                                className="automation-input font-mono"
                              />
                              <span className="text-[var(--muted)] text-[10px]">-</span>
                              <input
                                type="number"
                                min="0"
                                step="5"
                                placeholder="Max"
                                value={activeCriteria.secondaryMaxLiquidity !== undefined ? activeCriteria.secondaryMaxLiquidity : 50}
                                onChange={(e) => handleUpdateCriteria(task.id, "secondaryMaxLiquidity", Number(e.target.value))}
                                className="automation-input font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Relative Strength</label>
                            <select
                              value={activeCriteria.secondaryRsRating || "strong_neutral"}
                              onChange={(e) => handleUpdateCriteria(task.id, "secondaryRsRating", e.target.value)}
                              className="automation-select"
                            >
                              <option value="strong_neutral">Strong, Very Strong, Neutral</option>
                              <option value="strong_only">Strong &amp; Very Strong Only</option>
                              <option value="very_strong">Very Strong Only</option>
                              <option value="any">Any RS Rating</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--muted)] font-medium block">Weinstein Stage</label>
                            <select
                              value={activeCriteria.secondaryStage || "stage_2"}
                              onChange={(e) => handleUpdateCriteria(task.id, "secondaryStage", e.target.value)}
                              className="automation-select"
                            >
                              <option value="stage_2">Stage 2 Only</option>
                              <option value="stage_1_2">Stage 1 &amp; Stage 2</option>
                              <option value="any">Any Stage</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Work Item 3: Auto-Pruning Toggle */}
                      <div className="p-2 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-between text-xs">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={activeCriteria.pruneUnassigned !== undefined ? activeCriteria.pruneUnassigned : true}
                            onChange={(e) => handleUpdateCriteria(task.id, "pruneUnassigned", e.target.checked)}
                            className="rounded border-[var(--border)] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span className="text-[var(--text)] font-medium">
                            🧹 Auto-prune unassigned stocks: Automatically delete non-qualifying scan tickers from week pool
                          </span>
                        </label>
                        <span className="text-[10px] text-[var(--muted)]">Keeps database clean</span>
                      </div>
                    </div>
                  )}

                  {/* Criteria specific to IPO Radar */}
                  {task.id === "ipo_radar_prep" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-[var(--muted)] font-medium block">Destination Watchlist</label>
                        <select
                          value={activeCriteria.targetWatchlistId || "wl_ipo"}
                          onChange={(e) => handleUpdateCriteria(task.id, "targetWatchlistId", e.target.value)}
                          className="automation-select"
                        >
                          <option value="wl_ipo">IPO Watchlist</option>
                          <option value="wl_default">Default Watchlist</option>
                          {watchlists
                            .filter((w) => w.id !== "wl_default" && w.id !== "wl_ipo")
                            .map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-[var(--muted)] font-medium block">Pattern Requirements</label>
                        <select
                          value={activeCriteria.pattern || "any_young"}
                          onChange={(e) => handleUpdateCriteria(task.id, "pattern", e.target.value)}
                          className="automation-select"
                        >
                          <option value="any_young">All Active IPOs (&lt; 250d)</option>
                          <option value="ipo_base_or_vcp">IPO Base OR Tight VCP</option>
                          <option value="ipo_base_only">IPO Base Only</option>
                          <option value="fresh_young">Fresh Listings (&lt; 60d)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-[var(--muted)] font-medium block">Min Daily Range (ADR)</label>
                        <select
                          value={activeCriteria.minAdr !== undefined ? activeCriteria.minAdr : 0}
                          onChange={(e) => handleUpdateCriteria(task.id, "minAdr", Number(e.target.value))}
                          className="automation-select"
                        >
                          <option value="0">Any Volatility (No Min)</option>
                          <option value="3">ADR &ge; 3.0%</option>
                          <option value="5">ADR &ge; 5.0%</option>
                          <option value="7">ADR &ge; 7.0%</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-[var(--muted)] font-medium block">Min Daily Turnover</label>
                        <div className="automation-input-group">
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={activeCriteria.minLiquidity !== undefined ? activeCriteria.minLiquidity : 50}
                            onChange={(e) => handleUpdateCriteria(task.id, "minLiquidity", Number(e.target.value))}
                            className="automation-input font-mono"
                          />
                          <span className="automation-input-suffix">{country === "US" ? "$M" : "₹Cr"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress and Task Stages */}
              {(runState.isRunning || runState.pct > 0 || runState.result || runState.error) && (
                <div className="automation-progress-box border-t border-[var(--border)] pt-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                      {runState.isRunning && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                      )}
                      <span>{runState.statusText}</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--text)]" title="Overall Automation Progress">
                      {runState.pct}% overall
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-[var(--border)]">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${runState.pct}%` }}
                    />
                  </div>

                  {/* Step Pills with Dynamic Responsive Grid */}
                  <div
                    className="grid gap-2 pt-1 text-[11px]"
                    style={{ gridTemplateColumns: `repeat(${task.stages.length}, minmax(0, 1fr))` }}
                  >
                    {task.stages.map((stageName, idx) => {
                      const isCurrent = runState.isRunning && runState.currentStage === idx;
                      const isDone = runState.currentStage > idx || runState.pct === 100;
                      return (
                        <div
                          key={stageName}
                          className={`automation-stage-pill flex items-center justify-center gap-1.5 ${
                            isDone ? "is-done" : isCurrent ? "is-active" : "is-pending"
                          }`}
                          title={stageName}
                        >
                          <span className="text-[10px] shrink-0 font-bold">
                            {isDone ? "✓" : isCurrent ? "⚡" : "○"}
                          </span>
                          <span className="truncate">{stageName}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Result Box */}
                  {runState.result && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <span>🎉</span>
                          <span>Automation Completed ({runState.result.totalScanned || 0} scanned):</span>
                        </span>
                        <button
                          type="button"
                          onClick={onClose}
                          className="text-[11px] underline font-bold text-emerald-600 dark:text-emerald-400 hover:opacity-80 cursor-pointer"
                        >
                          View in Watchlist &raquo;
                        </button>
                      </div>

                      {runState.result.workItemResults ? (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {runState.result.workItemResults.map((r, i) => (
                              <div
                                key={i}
                                className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-[11px] flex items-center justify-between gap-2"
                              >
                                <span className="truncate font-medium text-[var(--text)]">{r.label}</span>
                                <span className="font-bold font-mono px-2 py-0.5 rounded bg-emerald-600 text-white shrink-0 text-[10px]">
                                  {r.passingCount} &rarr; {r.targetWatchlistName}
                                </span>
                              </div>
                            ))}
                          </div>
                          {runState.result.prunedCount > 0 && (
                            <div className="text-[11px] text-[var(--muted)] flex items-center justify-between px-1 pt-0.5">
                              <span>Pruned non-qualifying unassigned tickers:</span>
                              <span className="font-mono font-semibold text-rose-500 dark:text-rose-400">
                                {runState.result.prunedCount} tickers removed
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px]">
                          <strong>{runState.result.passingCount}</strong> qualified setups copied to "<strong>{runState.result.targetWatchlistName}</strong>".
                        </div>
                      )}
                    </div>
                  )}

                  {runState.error && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400">
                      ❌ {runState.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
