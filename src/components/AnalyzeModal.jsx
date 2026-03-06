import { useState } from "react";
import Modal from "./Modal";

import { getAiAnalysis } from "../services/ai";
import { useToast } from "./ToastContext";

export default function AnalyzeModal({ isOpen, onClose, data, setData, weekKey, country }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();

  const weekData = data.weeks?.[country]?.[weekKey];
  const savedAnalysis = weekData?.analysis;

  const handleGenerateAnalysis = async () => {
    setIsGenerating(true);
    try {
      const currentWeekData = data.weeks?.[country]?.[weekKey] || { stocks: {} };
      const stockCount = Object.keys(currentWeekData.stocks || {}).length;
      
      const analysis = await getAiAnalysis(currentWeekData, data.paramDefinitions);
      
      // Add metadata for transparency
      const enrichedAnalysis = {
        ...analysis,
        timestamp: new Date().toISOString(),
        stockCount: stockCount
      };

      // Persist to global state
      const newData = structuredClone(data);
      if (newData.weeks[country][weekKey]) {
        newData.weeks[country][weekKey].analysis = enrichedAnalysis;
        setData(newData);
      }
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Analysis" subtitle="Generate AI-powered insights for your watchlist">
      <div className="ai-summary-box">
        <div className="ai-header">
          <span className="ai-icon">✨</span>

          <strong>Smart Summary</strong>
        </div>

        {isGenerating && (
          <div className="p-4 text-center">
            <p>Generating AI Analysis...</p>

            <div className="spinner"></div>
          </div>
        )}

        {analysisToDisplay && !isGenerating && (
          <div className="p-4">
            <div style={{ marginBottom: "12px", fontSize: "12px", color: "var(--muted)", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
              Generated on <strong>{new Date(analysisToDisplay.timestamp).toLocaleString()}</strong> based on <strong>{analysisToDisplay.stockCount || 0}</strong> stocks.
            </div>

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
          </div>
        )}

        {!analysisToDisplay && !isGenerating && (
          <div className="p-4 text-center text-gray-500">
            Click the button to generate AI-powered trading insights.
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="outline" onClick={onClose}>Close</button>
        <button
          onClick={handleGenerateAnalysis}
          disabled={isGenerating}
          className="primary-btn"
        >
          {isGenerating ? "Generating..." : (analysisToDisplay ? "Regenerate Analysis" : "Generate Analysis")}
        </button>
      </div>
    </Modal>
  );
}
