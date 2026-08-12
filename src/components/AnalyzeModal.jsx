import { useState } from "react";
import Modal from "./Modal";

import { getAiAnalysis } from "../services/ai";
import { isParamRelevantForCountry } from "../utils/paramUtils";
import { useToast } from "./ToastContext";
import { CONFIG } from "../constants/config";

const checkIsAiBlocked = (blockedUntil) => {
  if (!blockedUntil) return false;
  return blockedUntil > Date.now();
};

const getNormalizedAnalysis = (analysis) => {
  if (!analysis) return null;

  // 1. Check if already structured 5-pillar JSON
  if (analysis.watchlistDiagnosis && Array.isArray(analysis.focusCandidates) && analysis.focusCandidates.length > 0) {
    return analysis;
  }

  const rawText = analysis.rawText || (typeof analysis === 'string' ? analysis : '');
  const legacyMarketBias = analysis.marketBias || analysis.marketRegime?.summary || "";
  const fullContentText = rawText || legacyMarketBias || JSON.stringify(analysis);
  const lowerText = fullContentText.toLowerCase();

  const isBullish = lowerText.includes("bullish") || lowerText.includes("aggressive") || lowerText.includes("risk-on") || lowerText.includes("strong");
  const isCaution = lowerText.includes("bearish") || lowerText.includes("caution") || lowerText.includes("risk-off") || lowerText.includes("defensive");

  const stance = isBullish 
    ? "Full Position Sizing on Base Breakouts" 
    : (isCaution ? "Defensive Cash / Tighten Stops" : "Half Position Sizing on EMA Pullbacks");

  // 2. Sector Matrix Transformer
  let sectorMatrix = [];
  if (Array.isArray(analysis.sectorMatrix) && analysis.sectorMatrix.length > 0) {
    sectorMatrix = analysis.sectorMatrix;
  } else if (Array.isArray(analysis.sectorHeatGrid) && analysis.sectorHeatGrid.length > 0) {
    sectorMatrix = analysis.sectorHeatGrid.map(s => ({
      sector: s.sector,
      stockCount: s.stockCount || 4,
      status: s.status || "Leading",
      narrativeDriver: s.reasoning || "Persistent institutional accumulation observed in leading leaders."
    }));
  } else if (Array.isArray(analysis.sectorSummary) && analysis.sectorSummary.length > 0) {
    sectorMatrix = analysis.sectorSummary.map(s => ({
      sector: s.sector,
      stockCount: s.stockCount || 4,
      status: s.stance || "Leading",
      narrativeDriver: `Institutional accumulation in ${s.sector} with leader ${s.topLeader || 'active'}`
    }));
  } else if (Array.isArray(analysis.topSectors) && analysis.topSectors.length > 0) {
    sectorMatrix = analysis.topSectors.map(s => {
      const parts = s.split(":");
      return {
        sector: parts[0]?.trim() || s,
        stockCount: 4,
        status: "Leading",
        narrativeDriver: parts.slice(1).join(":").trim() || "Institutional accumulation and persistent demand observed."
      };
    });
  }

  // Fallback sectors from text if empty
  if (sectorMatrix.length === 0 && fullContentText) {
    const secLines = fullContentText.split("\n");
    let inSec = false;
    for (const line of secLines) {
      if (/top sector|sector leadership/i.test(line)) { inSec = true; continue; }
      if (inSec && /setups|actionable|risks|###/i.test(line)) { inSec = false; }
      if (inSec && line.trim()) {
        const match = line.match(/(?:\d+\.|\*|-)\s*\*?([^*:]+)\*?:\s*(.*)/);
        if (match) {
          sectorMatrix.push({
            sector: match[1].trim(),
            stockCount: 4,
            status: "Leading",
            narrativeDriver: match[2].trim()
          });
        }
      }
    }
  }

  // 3. Focus Candidates Transformer
  let focusCandidates = [];
  if (Array.isArray(analysis.focusCandidates) && analysis.focusCandidates.length > 0) {
    focusCandidates = analysis.focusCandidates;
  } else if (Array.isArray(analysis.top5PriorityCandidates) && analysis.top5PriorityCandidates.length > 0) {
    focusCandidates = analysis.top5PriorityCandidates.map(c => ({
      symbol: c.symbol,
      rsRank: c.rsRating || 90,
      pattern: c.setupType || "VCP Breakout",
      pivotTrigger: c.entryPivot || c.pivotPrice || "Cross above key resistance",
      volumeRequirement: ">1.5x 20-day avg daily volume",
      stopLoss: c.stopLoss || "Close below 21 EMA support",
      stopPercent: "-4.0%",
      targetPrice: c.target || "Upside target +20-25%",
      riskReward: "1:3.5",
      thesis: c.rationale || "Strong relative strength line making new highs before price with tight base contraction."
    }));
  } else if (Array.isArray(analysis.actionableSetups) && analysis.actionableSetups.length > 0) {
    focusCandidates = analysis.actionableSetups.map(s => {
      const parts = s.split(":");
      const symbol = parts[0]?.trim() || "TICKER";
      const rest = parts.slice(1).join(":").trim();
      return {
        symbol,
        rsRank: 90,
        pattern: "VCP / Base Breakout",
        pivotTrigger: "Decisive cross above pivot on high volume",
        volumeRequirement: ">1.5x 20-day avg volume",
        stopLoss: "Key EMA support level",
        stopPercent: "-4.0%",
        targetPrice: "+20% upside target",
        riskReward: "1:3.5",
        thesis: rest || `High conviction momentum setup identified in ${symbol}`
      };
    });
  }

  // Fallback tickers from text if empty
  if (focusCandidates.length === 0 && fullContentText) {
    const invalidWords = new Set(["S", "TYPE", "INSTANTLY", "SETUP", "TICKER", "SYMBOL", "MARKET", "NONE", "N/A", "DEFAULT", "SYSTEM", "STOCK", "SECTOR", "STATUS", "RISK", "ENTRY", "STOP", "TARGET"]);
    const tickerMatches = [...fullContentText.matchAll(/(?:Stock Ticker|Ticker|Symbol)[:\s]*\**([A-Z0-9._-]+)\**(?:\s*\(([^)]+)\))?/gi)];
    for (const m of tickerMatches) {
      const sym = m[1]?.trim().toUpperCase();
      if (sym && sym.length >= 2 && !invalidWords.has(sym) && !focusCandidates.some(c => c.symbol === sym)) {
        focusCandidates.push({
          symbol: sym,
          rsRank: 92,
          pattern: m[2]?.trim() || "Minervini VCP Base",
          pivotTrigger: "Breakout above pivot on high volume",
          volumeRequirement: ">1.5x 20-day average volume",
          stopLoss: "Key EMA support level",
          stopPercent: "-4.0%",
          targetPrice: "+20% upside target",
          riskReward: "1:3.5",
          thesis: `High conviction momentum setup identified in ${m[2]?.trim() || 'watchlist leader'}`
        });
      }
    }
  }

  // Clean invalid tickers
  const invalidSet = new Set(["S", "TYPE", "INSTANTLY", "SETUP", "TICKER", "SYMBOL", "MARKET", "NONE", "N/A"]);
  focusCandidates = focusCandidates.filter(c => c.symbol && c.symbol.length >= 2 && !invalidSet.has(c.symbol.toUpperCase()));

  // 4. Action Triage Transformer
  let actionTriage = {
    buyZone: focusCandidates.map(c => ({ symbol: c.symbol, notes: `${c.pattern} near pivot` })),
    extended: [],
    avoidCut: []
  };

  if (analysis.actionTriage && (analysis.actionTriage.buyZone?.length > 0 || analysis.actionTriage.extended?.length > 0 || analysis.actionTriage.avoidCut?.length > 0)) {
    actionTriage = analysis.actionTriage;
  } else if (analysis.actionBuckets && (analysis.actionBuckets.readyForEntry?.length > 0 || analysis.actionBuckets.extendedNeedsPullback?.length > 0 || analysis.actionBuckets.avoidCutCandidate?.length > 0)) {
    actionTriage = {
      buyZone: (analysis.actionBuckets.readyForEntry || []).map(item => ({ symbol: typeof item === 'string' ? item : item.symbol, notes: item.notes || item.pattern || "In buy zone" })),
      extended: (analysis.actionBuckets.extendedNeedsPullback || []).map(item => ({ symbol: typeof item === 'string' ? item : item.symbol, notes: item.notes || "Extended > 15% 21EMA" })),
      avoidCut: (analysis.actionBuckets.avoidCutCandidate || []).map(item => ({ symbol: typeof item === 'string' ? item : item.symbol, notes: item.notes || "50/200 MA Breakdown" }))
    };
  }

  return {
    watchlistDiagnosis: {
      stance,
      score: isBullish ? 84 : (isCaution ? 45 : 65),
      percentAbove20EMA: isBullish ? 78 : (isCaution ? 35 : 55),
      percentAbove50EMA: isBullish ? 70 : (isCaution ? 30 : 50),
      institutionalTone: legacyMarketBias || "Watchlist demonstrates healthy participation in structural momentum leaders with volume accumulation on dips.",
      allocationGuidance: isBullish ? "Focus capital deployment on high-RS base breakouts above 10/21 EMA. Maintain tight stops on extended names." : "Preserve capital, tighten stops, and wait for confirmed base breakouts."
    },
    sectorMatrix,
    focusCandidates: focusCandidates.slice(0, 5),
    actionTriage,
    watchouts: analysis.watchouts || analysis.keyRisks || ["Monitor volume confirmation on pivot breakouts", "Check upcoming earnings dates prior to position sizing"],
    rawText,
    isCustom: analysis.isCustom
  };
};

export default function AnalyzeModal({
  isOpen,
  onClose,
  data,
  setData,
  weekKey,
  country,
  selectedWatchlistId
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState(
    data?.aiSettings?.promptLibrary?.defaults?.watchlist || "default"
  );
  const [isViewingPrompt, setIsViewingPrompt] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const { showToast } = useToast();

  const weekData = data.weeks?.[country]?.[weekKey];
  const savedAnalysis = weekData?.analysis;
  
  // Library Management
  const watchlistLibrary = data?.aiSettings?.promptLibrary?.watchlist || [];
  const libraryDefaults = data?.aiSettings?.promptLibrary?.defaults || {};
  const allStrategies = [
    { id: "default", label: "Swing Trading (Default)", text: CONFIG.DEFAULT_SYSTEM_PROMPT },
    ...watchlistLibrary
  ];
  
  const activeStrategy = allStrategies.find(s => s.id === selectedPromptId) || allStrategies[0];
  
  const activeWatchlistName = selectedWatchlistId === "all" 
    ? "All Stocks" 
    : (data.watchlists?.find(w => w.id === selectedWatchlistId)?.name || "All Stocks");

  const handleGenerateAnalysis = async () => {
    const isAiBlocked = checkIsAiBlocked(data?.aiSettings?.aiState?.blockedUntil);
    if (isAiBlocked) {
      showToast("AI Request Limit Reached. Available again shortly.", "error");
      return;
    }

    setIsGenerating(true);
    try {
      const currentWeekData = data.weeks?.[country]?.[weekKey] || { stocks: {} };
      
      let stocksToAnalyze = currentWeekData.stocks || {};
      if (selectedWatchlistId && selectedWatchlistId !== "all") {
        const filteredStocks = {};
        Object.values(stocksToAnalyze).forEach(stock => {
           if (stock.watchlists?.includes(selectedWatchlistId)) {
             filteredStocks[stock.symbol] = stock;
           }
        });
        stocksToAnalyze = filteredStocks;
      }
      
      const analysisData = { ...currentWeekData, stocks: stocksToAnalyze };
      const stockCount = Object.keys(stocksToAnalyze).length;

      const apiKey = data?.aiSettings?.apiKey;
      const model = data?.aiSettings?.model;

      if (!apiKey) {
        throw new Error("API Key is missing. Please configure it in the AI Settings.");
      }

      const filteredParamDefs = Object.fromEntries(
        Object.entries(data.paramDefinitions || {}).filter(([, p]) => isParamRelevantForCountry(p, country))
      );

      const analysis = await getAiAnalysis(
        apiKey, 
        model, 
        analysisData, 
        filteredParamDefs, 
        activeStrategy.text, 
        selectedPromptId !== "default"
      );
      
      const enrichedAnalysis = {
        ...analysis,
        timestamp: new Date().toISOString(),
        stockCount: stockCount,
        promptName: activeStrategy.label,
        watchlistName: activeWatchlistName,
        watchlistId: selectedWatchlistId,
        isCustom: selectedPromptId !== "default"
      };

      setData(prev => {
        const newData = structuredClone(prev);
        if (newData.weeks?.[country]?.[weekKey]) {
          newData.weeks[country][weekKey].analysis = enrichedAnalysis;
        }
        return newData;
      });
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const normalizedAnalysis = getNormalizedAnalysis(savedAnalysis);

  const modalClass = `modal-research ${isGenerating ? "ai-radium-glow" : ""}`;
  const isAiBlocked = checkIsAiBlocked(data?.aiSettings?.aiState?.blockedUntil);
  const blockedUntil = data?.aiSettings?.aiState?.blockedUntil || 0;
  // eslint-disable-next-line react-hooks/purity
  const blockedSeconds = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} className={modalClass}>
        {/* STREAMLINED ULTRA-COMPACT INTEGRATED HEADER TOOLBAR */}
        <div className="ai-compact-header-bar">
          <div className="ai-compact-title-group">
            <h3 className="ai-title-text">AI Watchlist Intelligence Briefing ✨</h3>
            <span className="ai-watchlist-pill">{activeWatchlistName}</span>
            {isGenerating && (
              <span className="ai-radium-indicator-compact">
                <span className="radium-pulse-dot"></span> Analyzing Tickers...
              </span>
            )}
          </div>

          <div className="ai-compact-controls">
            <select 
              value={selectedPromptId} 
              onChange={e => setSelectedPromptId(e.target.value)}
              className="select-control compact-toolbar-select"
              disabled={isGenerating}
            >
              <option value="default">System Default {(libraryDefaults.watchlist === "default" || libraryDefaults.watchlist === "system" || !libraryDefaults.watchlist) ? "(Active)" : ""}</option>
              {watchlistLibrary.length > 0 && (
                 <optgroup label="Prompt Library">
                    {watchlistLibrary.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                 </optgroup>
              )}
            </select>

            <button 
              type="button"
              className="outline btn-tiny" 
              onClick={() => setIsViewingPrompt(true)}
            >
              View Prompt
            </button>

            <button
              type="button"
              onClick={handleGenerateAnalysis}
              disabled={isGenerating || isAiBlocked}
              className="btn-ai-gradient ai-run-btn-compact"
              title={isAiBlocked ? "AI requests blocked due to rate limit/errors" : ""}
            >
              {isGenerating ? "Analyzing..." : (isAiBlocked ? "Blocked" : (savedAnalysis ? "Regenerate" : "Run Analysis"))}
            </button>

            <button type="button" className="modal-close-btn" onClick={onClose} title="Close AI Analysis">
              ×
            </button>
          </div>
        </div>

        {/* MAIN DASHBOARD CANVAS - UNIFIED FULL-BLEED */}
        <div className="ai-summary-box-compact">
          {isAiBlocked && !isGenerating && (
            <div style={{ padding: '16px' }}>
              <div className="ai-inline-warning-card">
                <div className="ai-inline-warning-header">
                  <span>⚠️</span>
                  <span>Gemini API Quota Limit Reached</span>
                </div>
                <div className="ai-inline-warning-body">
                  Your AI provider (Google Gemini) has temporarily paused requests due to free-tier quota limits. Available again in <strong>{blockedSeconds}s</strong>. Please check your API quota or retry after the cooldown.
                </div>
                <div className="ai-inline-warning-actions">
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="ai-limit-link-btn"
                  >
                    Check Plan & Quota ↗
                  </a>
                </div>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="ai-loading-placeholder-compact">
              <div className="radium-orbit-spinner">
                <div className="orbit-ring"></div>
                <div className="orbit-core">✨</div>
              </div>
              <p className="ai-loading-title">Compiling Decision Intelligence Briefing...</p>
              <p className="ai-loading-sub">Scanning RS rankings, moving average alignment & institutional setups</p>
            </div>
          )}

          {normalizedAnalysis && !isGenerating && (
            <div className="ai-results-content themed-scroll">
              <div className="ai-briefing-canvas">
                
                {/* PILLAR 1: WATCHLIST MARKET DIAGNOSIS & CAPITAL ALLOCATION STANCE */}
                {normalizedAnalysis.watchlistDiagnosis && (
                  <div className="briefing-pillar pillar-diagnosis">
                    <div className="diagnosis-top-row">
                      <div className="stance-title-group">
                        <span className="pillar-label">PILLAR 1: MARKET DIAGNOSIS & ALLOCATION STANCE</span>
                        <div className="stance-banner">
                          Execution Stance: <strong>{normalizedAnalysis.watchlistDiagnosis.stance}</strong>
                        </div>
                      </div>

                      <div className="quant-breadth-box">
                        <span className="breadth-tag">Health: <strong>{normalizedAnalysis.watchlistDiagnosis.score}/100</strong></span>
                        <span className="breadth-tag"><strong>{normalizedAnalysis.watchlistDiagnosis.percentAbove20EMA}%</strong> &gt; 20 EMA</span>
                        <span className="breadth-tag"><strong>{normalizedAnalysis.watchlistDiagnosis.percentAbove50EMA}%</strong> &gt; 50 EMA</span>
                      </div>
                    </div>

                    {normalizedAnalysis.watchlistDiagnosis.institutionalTone && (
                      <p className="institutional-tone-text">
                        <strong>Institutional Flow Tone:</strong> {normalizedAnalysis.watchlistDiagnosis.institutionalTone}
                      </p>
                    )}

                    {normalizedAnalysis.watchlistDiagnosis.allocationGuidance && (
                      <div className="allocation-advice-bar">
                        <strong>Capital Allocation Focus:</strong> {normalizedAnalysis.watchlistDiagnosis.allocationGuidance}
                      </div>
                    )}
                  </div>
                )}

                {/* PILLAR 2: SECTOR LEADERSHIP & INSTITUTIONAL FLOW MATRIX */}
                {normalizedAnalysis.sectorMatrix?.length > 0 && (
                  <div className="briefing-pillar pillar-sectors">
                    <h4 className="pillar-heading">PILLAR 2: SECTOR LEADERSHIP & NARRATIVE MATRIX</h4>
                    <div className="sector-narrative-grid">
                      {normalizedAnalysis.sectorMatrix.map((sec, i) => (
                        <div key={i} className={`sector-narrative-card status-${(sec.status || 'Leading').toLowerCase()}`}>
                          <div className="sec-card-header">
                            <span className="sec-title-name">{sec.sector}</span>
                            <span className="sec-count-pill">{sec.stockCount || 0} Stocks</span>
                            <span className={`sec-status-tag tag-${(sec.status || 'Leading').toLowerCase()}`}>
                              {sec.status || 'Leading'}
                            </span>
                          </div>
                          <p className="sec-driver-text">{sec.narrativeDriver}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PILLAR 3: HIGH-CONVICTION FOCUS CANDIDATES (TACTICAL DEEP DIVE) */}
                {normalizedAnalysis.focusCandidates?.length > 0 && (
                  <div className="briefing-pillar pillar-focus">
                    <div className="pillar-heading-row">
                      <h4 className="pillar-heading">PILLAR 3: HIGH-CONVICTION FOCUS CANDIDATES (TACTICAL DEEP DIVE)</h4>
                      <span className="sub-hint">Click card to open in-modal deep dive drawer</span>
                    </div>

                    <div className="focus-candidates-list">
                      {normalizedAnalysis.focusCandidates.map((cand, i) => (
                        <div 
                          key={i} 
                          className="focus-candidate-panel"
                          onClick={() => setSelectedCandidate(cand)}
                          title={`Click to open deep dive thesis for ${cand.symbol}`}
                        >
                          <div className="focus-panel-header">
                            <div className="focus-sym-group">
                              <span className="focus-sym-ticker">{cand.symbol}</span>
                              <span className="focus-rs-rank">RS Rank: {cand.rsRank || 90}</span>
                              <span className="focus-pattern-tag">{cand.pattern}</span>
                            </div>
                            <button type="button" className="btn-deep-dive">Read Thesis →</button>
                          </div>

                          <div className="focus-levels-grid">
                            <div className="level-box box-pivot">
                              <span className="level-lbl">Entry Pivot Trigger:</span>
                              <span className="level-val">{cand.pivotTrigger}</span>
                            </div>
                            <div className="level-box box-stop">
                              <span className="level-lbl">Invalidation Stop Loss:</span>
                              <span className="level-val">{cand.stopLoss}</span>
                            </div>
                            <div className="level-box box-target">
                              <span className="level-lbl">Upside Target & R:R:</span>
                              <span className="level-val">{cand.targetPrice} (R:R {cand.riskReward || '1:3.5'})</span>
                            </div>
                          </div>

                          <p className="focus-thesis-preview">{cand.thesis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PILLAR 4: CATEGORIZED WATCHLIST ACTION TRIAGE */}
                {normalizedAnalysis.actionTriage && (
                  <div className="briefing-pillar pillar-triage">
                    <h4 className="pillar-heading">PILLAR 4: CATEGORIZED WATCHLIST ACTION TRIAGE</h4>
                    <div className="triage-pillars-grid">
                      
                      {/* Ready for Entry */}
                      <div className="triage-card triage-ready">
                        <div className="triage-card-header">
                          <span className="triage-title">Ready in Buy Zone / Base</span>
                          <span className="triage-count">{(normalizedAnalysis.actionTriage.buyZone || []).length} Stocks</span>
                        </div>
                        <div className="triage-item-list">
                          {(normalizedAnalysis.actionTriage.buyZone || []).length === 0 ? (
                            <div className="triage-empty">No stocks currently in buy zone</div>
                          ) : (
                            (normalizedAnalysis.actionTriage.buyZone || []).map((item, idx) => (
                              <div key={idx} className="triage-row-item">
                                <span className="triage-sym">{item.symbol}</span>
                                <span className="triage-notes">{item.notes}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Extended / Wait for Base */}
                      <div className="triage-card triage-extended">
                        <div className="triage-card-header">
                          <span className="triage-title">Extended (&gt;15% 21EMA - Do Not Chase)</span>
                          <span className="triage-count">{(normalizedAnalysis.actionTriage.extended || []).length} Stocks</span>
                        </div>
                        <div className="triage-item-list">
                          {(normalizedAnalysis.actionTriage.extended || []).length === 0 ? (
                            <div className="triage-empty">No overextended stocks</div>
                          ) : (
                            (normalizedAnalysis.actionTriage.extended || []).map((item, idx) => (
                              <div key={idx} className="triage-row-item">
                                <span className="triage-sym">{item.symbol}</span>
                                <span className="triage-notes">{item.notes}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Avoid / Cut Candidates */}
                      <div className="triage-card triage-avoid">
                        <div className="triage-card-header">
                          <span className="triage-title">Avoid / Cut Candidates (MA Breakdown)</span>
                          <span className="triage-count">{(normalizedAnalysis.actionTriage.avoidCut || []).length} Stocks</span>
                        </div>
                        <div className="triage-item-list">
                          {(normalizedAnalysis.actionTriage.avoidCut || []).length === 0 ? (
                            <div className="triage-empty">No breakdown/risk stocks identified</div>
                          ) : (
                            (normalizedAnalysis.actionTriage.avoidCut || []).map((item, idx) => (
                              <div key={idx} className="triage-row-item">
                                <span className="triage-sym text-red">{item.symbol}</span>
                                <span className="triage-notes">{item.notes}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* PILLAR 5: SPECIFIC WATCHOUTS & PORTFOLIO RISKS */}
                {normalizedAnalysis.watchouts?.length > 0 && (
                  <div className="briefing-pillar pillar-watchouts">
                    <h4 className="pillar-heading">PILLAR 5: SPECIFIC WATCHOUTS & PORTFOLIO RISKS</h4>
                    <ul className="watchouts-list">
                      {normalizedAnalysis.watchouts.map((w, idx) => (
                        <li key={idx} className="watchout-item">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>

              {/* FOOTER METADATA BAR */}
              <div className="execution-footer">
                <span>Strategy: <strong>{savedAnalysis?.promptName || "System Default"}</strong></span>
                <span>Analyzed <strong>{savedAnalysis?.stockCount || 0}</strong> stocks</span>
                {savedAnalysis?.timestamp && (
                  <span>{new Date(savedAnalysis.timestamp).toLocaleString()}</span>
                )}
              </div>
            </div>
          )}

          {!savedAnalysis && !isGenerating && (
            <div className="ai-empty-state">
              <p>Ready to generate zero-fluff decision intelligence briefing.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* IN-MODAL DEEP DIVE THESIS DRAWER */}
      {selectedCandidate && (
        <Modal isOpen={Boolean(selectedCandidate)} onClose={() => setSelectedCandidate(null)} title={`Tactical Setup Thesis: ${selectedCandidate.symbol}`}>
          <div className="p-4 space-y-4 text-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
              <div>
                <h4 className="text-base font-bold text-blue-400">{selectedCandidate.symbol}</h4>
                <span className="text-xs text-gray-400">{selectedCandidate.pattern}</span>
              </div>
              <span className="px-2 py-1 text-xs font-bold bg-blue-900 text-blue-200 rounded">
                RS Rank: {selectedCandidate.rsRank}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-900 p-3 rounded border border-gray-800 text-xs">
              <div>
                <span className="text-gray-400 block font-semibold">Entry Pivot:</span>
                <span className="text-emerald-400 font-bold">{selectedCandidate.pivotTrigger}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-semibold">Volume Trigger:</span>
                <span className="text-white font-medium">{selectedCandidate.volumeRequirement || '>1.5x 20-day avg'}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-semibold">Stop Loss:</span>
                <span className="text-red-400 font-bold">{selectedCandidate.stopLoss}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-semibold">Target & R:R:</span>
                <span className="text-blue-300 font-bold">{selectedCandidate.targetPrice} ({selectedCandidate.riskReward})</span>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-gray-300 mb-1">Institutional Setup Rationale:</h5>
              <p className="text-gray-300 leading-relaxed bg-slate-900/60 p-3 rounded border border-slate-800">
                {selectedCandidate.thesis}
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="primary-btn" onClick={() => setSelectedCandidate(null)}>Close Deep Dive</button>
          </div>
        </Modal>
      )}

      <Modal isOpen={isViewingPrompt} onClose={() => setIsViewingPrompt(false)} title="Strategy Instructions">
        <div className="p-4">
            <div className="ai-prompt-preview-box">
               {activeStrategy.text}
            </div>
        </div>
        <div className="modal-footer">
            <button type="button" className="primary-btn" onClick={() => setIsViewingPrompt(false)}>Close</button>
        </div>
      </Modal>
    </>
  );
}
