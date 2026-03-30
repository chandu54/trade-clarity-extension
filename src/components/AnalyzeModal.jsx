import { useState, useEffect, Fragment } from "react";
import Modal from "./Modal";

import { getAiAnalysis, PROMPT_TEMPLATES } from "../services/ai";
import { useToast } from "./ToastContext";

export default function AnalyzeModal({ isOpen, onClose, data, setData, weekKey, country, selectedWatchlistId }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPromptName, setCurrentPromptName] = useState("Swing Trading (Default)");
  const [allPrompts, setAllPrompts] = useState([...PROMPT_TEMPLATES]);
  const [selectedPromptValue, setSelectedPromptValue] = useState("swing");
  const [isViewingPrompt, setIsViewingPrompt] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPromptText, setEditedPromptText] = useState("");
  const { showToast } = useToast();

  const weekData = data.weeks?.[country]?.[weekKey];
  const savedAnalysis = weekData?.analysis;
  
  const activePromptObj = allPrompts.find(p => p.value === selectedPromptValue) || allPrompts[0];
  const isCustomPromptGlobal = !PROMPT_TEMPLATES.find(t => t.value === activePromptObj.value);
  
  const activeWatchlistName = selectedWatchlistId === "all" 
    ? "All Stocks" 
    : (data.watchlists?.find(w => w.id === selectedWatchlistId)?.name || "All Stocks");

  useEffect(() => {
    if (isOpen && data?.aiSettings) {
       const savedPrompt = data.aiSettings.systemPrompt;
       const custom = data.aiSettings.customPrompts || [];
       
       const combined = [...PROMPT_TEMPLATES, ...custom];
       setAllPrompts(combined);

       if (savedPrompt) {
          const matched = combined.find(t => t.text === savedPrompt);
          if (matched) {
             setSelectedPromptValue(matched.value);
          } else {
             setSelectedPromptValue(combined[0].value);
          }
       } else {
          setSelectedPromptValue(combined[0].value);
       }
    }
  }, [isOpen, data]);

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
        throw new Error("API Key is missing. Please configure it in the AI Settings (bottom-right gear icon).");
      }

      const analysis = await getAiAnalysis(apiKey, model, analysisData, data.paramDefinitions, activePromptObj.text, isCustomPromptGlobal);
      
      // Add metadata for transparency
      const enrichedAnalysis = {
        ...analysis,
        timestamp: new Date().toISOString(),
        stockCount: stockCount,
        promptName: activePromptObj.label,
        watchlistName: activeWatchlistName,
        watchlistId: selectedWatchlistId
      };

      // Persist to global state and update the default prompt
      setData(prev => {
        const newData = structuredClone(prev);
        if (newData.weeks?.[country]?.[weekKey]) {
          newData.weeks[country][weekKey].analysis = enrichedAnalysis;
        }
        newData.aiSettings.systemPrompt = activePromptObj.text;
        return newData;
      });
    } catch (e) {
      let msg = e.message;
      if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit")) {
        msg = "Quota or rate limit exceeded. Please try again later or switch to a different model in Settings.";
      }
      showToast(msg, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const analysisToDisplay = savedAnalysis;

  // Render markdown-like text for custom prompts
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    // Simple inline parser for bold **text**
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
         return <div key={idx} style={{ display: 'flex', marginBottom: '4px' }}>
            <span style={{ marginRight: '8px' }}>•</span>
            <span>{renderInline(line.trim().substring(2))}</span>
         </div>;
      }
      
      if (line.trim() === '') return <div key={idx} style={{height: "12px"}}></div>;
      
      return <div key={idx} className="mb-2" style={{ lineHeight: "1.6" }}>{renderInline(line)}</div>;
    });
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="AI Analysis" subtitle={`Insights for: ${activeWatchlistName}`} className="modal-wide">
        <div className="ai-summary-box">
          <div className="ai-header">
            <span className="ai-icon">✨</span>
            <strong>Smart Summary</strong>
          </div>

          {!isGenerating && (
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label htmlFor="strategySelect" className="font-bold" style={{ fontSize: "13px" }}>Strategy:</label>
                  <select 
                    id="strategySelect"
                    value={selectedPromptValue} 
                    onChange={e => setSelectedPromptValue(e.target.value)}
                    className="select-control"
                    style={{ maxWidth: "250px", padding: "4px 8px", fontSize: "13px", height: "auto" }}
                  >
                      <optgroup label="Built-in Templates">
                         {PROMPT_TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </optgroup>
                      {allPrompts.length > PROMPT_TEMPLATES.length && (
                         <optgroup label="My Custom Prompts">
                            {allPrompts.slice(PROMPT_TEMPLATES.length).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                         </optgroup>
                      )}
                  </select>
                  <button 
                    type="button"
                    className="outline" 
                    style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditedPromptText(activePromptObj?.text || "");
                      setIsEditingPrompt(false);
                      setIsViewingPrompt(true);
                    }}
                    title="View Prompt Content"
                  >
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                     View
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAnalysis}
                  disabled={isGenerating}
                  className="primary-btn"
                  style={{ padding: '4px 10px', fontSize: '12px', height: '32px', minHeight: 'unset' }}
                >
                  {isGenerating ? "Generating..." : (analysisToDisplay ? "Regenerate Analysis" : "Generate Analysis")}
                </button>
            </div>
          )}

          {isGenerating && (
            <div className="p-4 text-center">
              <p>Generating AI Analysis...</p>
              <div className="spinner"></div>
            </div>
          )}

          {analysisToDisplay && !isGenerating && (
            <div className="p-4">
              <div style={{ marginBottom: "12px", fontSize: "12px", color: "var(--muted)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", lineHeight: "1.6" }}>
                Generated on <strong>{new Date(analysisToDisplay.timestamp).toLocaleString()}</strong> based on <strong>{analysisToDisplay.stockCount || 0}</strong> stocks from <strong>{analysisToDisplay.watchlistName || "All Stocks"}</strong>.<br />
                Strategy: <strong>{analysisToDisplay.promptName || "Swing Trading (Default)"}</strong>
              </div>

              {analysisToDisplay.isCustom ? (
                 <div style={{ fontSize: "14px", marginTop: "16px", color: "var(--text)" }}>
                   {renderFormattedText(analysisToDisplay.rawText)}
                 </div>
              ) : (
                 <>
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
                    {analysisToDisplay.keyRisks && Array.isArray(analysisToDisplay.keyRisks) && analysisToDisplay.keyRisks.length > 0 && (
                      <>
                        <h4 className="font-bold text-red-600">⚠️ Key Risks:</h4>
                        <ul className="list-disc list-inside text-red-600">
                          {analysisToDisplay.keyRisks.map((risk) => (
                            <li key={risk}>{risk}</li>
                          ))}
                        </ul>
                      </>
                    )}
                 </>
              )}
            </div>
          )}

          {!analysisToDisplay && !isGenerating && (
            <div className="p-8 text-center text-gray-500" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginTop: "20px" }}>
              <div style={{ fontSize: "28px", opacity: 0.5 }}>🤖</div>
              <p>Ready to generate trading insights.</p>
              <p style={{ fontSize: "13px", opacity: 0.8 }}>Choose your strategy above and click <strong>Generate Analysis</strong>.</p>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="outline" onClick={onClose}>Close Analysis</button>
        </div>
      </Modal>

      <Modal isOpen={isViewingPrompt} onClose={() => { setIsViewingPrompt(false); setIsEditingPrompt(false); }} title="Prompt Instructions">
        <div className="p-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
             <div>
                <strong style={{ fontSize: "14px" }}>{activePromptObj?.label}</strong>
                {!isCustomPromptGlobal && <span className="muted small" style={{ marginLeft: "8px" }}>(Built-in templates cannot be edited)</span>}
             </div>
             {isCustomPromptGlobal && !isEditingPrompt && (
                <button type="button" className="outline" style={{ padding: "4px 10px", fontSize: "12px", display: "flex", gap: "6px", alignItems: "center" }} onClick={() => setIsEditingPrompt(true)}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                   Edit Custom Prompt
                </button>
             )}
          </div>
          
          {isEditingPrompt ? (
             <textarea 
               value={editedPromptText}
               onChange={(e) => setEditedPromptText(e.target.value)}
               placeholder="Update your custom instructions..."
               style={{
                  width: "100%",
                  minHeight: "180px",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--primary)",
                  backgroundColor: "var(--bg)",
                  color: "var(--text)",
                  resize: "vertical",
                  boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
                  fontSize: "13px",
                  lineHeight: "1.5"
               }}
             />
          ) : (
            <div style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "16px",
              maxHeight: "350px",
              overflowY: "auto",
              fontSize: "13px",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              textAlign: "left",
              color: "var(--text)"
            }}>
               {activePromptObj?.text}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ display: "flex", justifyContent: isEditingPrompt ? "space-between" : "flex-end", alignItems: "center" }}>
          {isEditingPrompt ? (
             <>
               <button type="button" className="outline" onClick={() => { setIsEditingPrompt(false); setEditedPromptText(activePromptObj?.text || ""); }}>Cancel</button>
               <button type="button" className="primary-btn" onClick={async () => {
                   const updatedText = editedPromptText.trim();
                   if (!updatedText) return;
                   
                   const customList = [...(data?.aiSettings?.customPrompts || [])];
                   const existingIdx = customList.findIndex(c => c.value === activePromptObj.value);
                   
                   if (existingIdx >= 0) {
                      customList[existingIdx] = { ...customList[existingIdx], text: updatedText };
                   } else {
                      customList.push({ ...activePromptObj, text: updatedText });
                   }
                   
                   const combined = [...PROMPT_TEMPLATES, ...customList];
                   setAllPrompts(combined);
                   
                   setData(prev => ({
                     ...prev,
                     aiSettings: {
                       ...prev.aiSettings,
                       customPrompts: customList,
                       systemPrompt: activePromptObj.text === prev.aiSettings.systemPrompt ? updatedText : prev.aiSettings.systemPrompt
                     }
                   }));
                   
                   showToast("Prompt successfully updated!", "success");
                   setIsEditingPrompt(false);
               }}>Save Changes</button>
             </>
          ) : (
             <button type="button" className="primary-btn" onClick={() => setIsViewingPrompt(false)}>Dismiss</button>
          )}
        </div>
      </Modal>
    </>
  );
}
