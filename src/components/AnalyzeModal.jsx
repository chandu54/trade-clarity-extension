import { useState, useEffect } from "react";
import Modal from "./Modal";

import { getAiAnalysis, PROMPT_TEMPLATES } from "../services/ai";
import { isParamRelevantForCountry } from "../utils/paramUtils";
import { useToast } from "./ToastContext";
import { CONFIG } from "../constants/config";

export default function AnalyzeModal({ isOpen, onClose, data, setData, weekKey, country, selectedWatchlistId }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState(data?.aiSettings?.promptLibrary?.defaults?.watchlist || "default");
  const [isViewingPrompt, setIsViewingPrompt] = useState(false);
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
        Object.entries(data.paramDefinitions).filter(([, p]) => isParamRelevantForCountry(p, country))
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

  const analysisToDisplay = savedAnalysis;

  // Render markdown-like text for custom prompts
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    const renderInline = (str) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) return <h4 key={idx} className="font-bold mt-4 mb-2">{renderInline(line.substring(4))}</h4>;
      if (line.startsWith('## ')) return <h3 key={idx} className="font-bold text-lg mt-5 mb-2">{renderInline(line.substring(3))}</h3>;
      if (line.startsWith('# ')) return <h2 key={idx} className="font-bold text-xl mt-5 mb-2">{renderInline(line.substring(2))}</h2>;
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
         return <div key={idx} className="ai-bullet-row">
            <span className="ai-bullet-dot">•</span>
            <span>{renderInline(line.trim().substring(2))}</span>
         </div>;
      }
      if (line.trim() === '') return <div key={idx} className="ai-report-spacer"></div>;
      return <div key={idx} className="mb-2 ai-report-line">{renderInline(line)}</div>;
    });
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="AI Analysis" subtitle={`Insights for: ${activeWatchlistName}`} className="modal-research">
        <div className="ai-summary-box">
          <div className="ai-header">
            <span className="ai-icon">Smart Summary✨</span>
          </div>

          {!isGenerating && (
            <div className="ai-strategy-toolbar">
                <div className="ai-strategy-selector-group">
                  <select 
                    value={selectedPromptId} 
                    onChange={e => setSelectedPromptId(e.target.value)}
                    className="select-control ai-strategy-select"
                  >
                      <option value="default">System Default {(libraryDefaults.watchlist === "default" || libraryDefaults.watchlist === "system" || !libraryDefaults.watchlist) ? "(Active)" : ""}</option>
                      {watchlistLibrary.length > 0 && (
                         <optgroup label="Prompt Library">
                            {watchlistLibrary.map(p => <option key={p.id} value={p.id}>{p.label} {libraryDefaults.watchlist === p.id ? "(Active)" : ""}</option>)}
                         </optgroup>
                      )}
                  </select>
                  <button 
                    type="button"
                    className="outline btn-small" 
                    onClick={() => setIsViewingPrompt(true)}
                  >
                     View Prompt
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAnalysis}
                  disabled={isGenerating}
                  className="primary-btn ai-run-btn"
                >
                  {isGenerating ? "Analyzing..." : (analysisToDisplay ? "Regenerate" : "Run Analysis")}
                </button>
            </div>
          )}

          {isGenerating && (
            <div className="ai-loading-placeholder">
              <p>Compiling Market Data...</p>
              <div className="spinner"></div>
            </div>
          )}

          {analysisToDisplay && !isGenerating && (
            <div className="ai-results-content themed-scroll">
              <div className="ai-result-meta">
                Strategy: <strong>{analysisToDisplay.promptName}</strong> • {new Date(analysisToDisplay.timestamp).toLocaleString()}
              </div>

              {analysisToDisplay.isCustom ? (
                 <div className="ai-custom-text-wrapper">
                   {renderFormattedText(analysisToDisplay.rawText)}
                 </div>
              ) : (
                 <div className="ai-default-json-content">
                    <h4 className="font-bold">Market Bias:</h4>
                    <p className="mb-3">{analysisToDisplay.marketBias || "N/A"}</p>
                    <h4 className="font-bold">Top Sectors:</h4>
                    <ul className="list-disc list-inside mb-3">
                      {(analysisToDisplay.topSectors || []).map((sector) => (
                        <li key={sector}>{sector}</li>
                      ))}
                    </ul>
                    <h4 className="font-bold">Actionable Setups:</h4>
                    <ul className="list-disc list-inside mb-3">
                      {(analysisToDisplay.actionableSetups || []).map((setup) => (
                        <li key={setup}>{setup}</li>
                      ))}
                    </ul>
                    {analysisToDisplay.keyRisks?.length > 0 && (
                      <>
                        <h4 className="font-bold text-red-600">⚠️ Key Risks:</h4>
                        <ul className="list-disc list-inside text-red-600">
                          {analysisToDisplay.keyRisks.map((risk) => (
                            <li key={risk}>{risk}</li>
                          ))}
                        </ul>
                      </>
                    )}
                 </div>
              )}

              <div className="ai-disclaimer-v2">
                AI can make mistakes. Verify with your own research.
              </div>
            </div>
          )}

          {!analysisToDisplay && !isGenerating && (
            <div className="ai-empty-state">
              <p>Ready to generate trading insights.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="outline" onClick={onClose}>Dismiss</button>
        </div>
      </Modal>

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
