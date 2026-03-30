import React, { useState, useEffect } from 'react';
import { getAiAnalysis } from '../services/ai';

// Safe markdown-lite parser to avoid dangerouslySetInnerHTML and external dependencies
const FormattedText = ({ text }) => {
  if (!text) return null;

  // Split by double newlines for paragraphs/blocks
  const blocks = text.split(/\n\n/);

  return (
    <>
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header parsing
        if (trimmed.startsWith('### ')) return <h3 key={bIdx}>{trimmed.replace('### ', '')}</h3>;
        if (trimmed.startsWith('## ')) return <h2 key={bIdx}>{trimmed.replace('## ', '')}</h2>;
        if (trimmed.startsWith('# ')) return <h1 key={bIdx}>{trimmed.replace('# ', '')}</h1>;

        // List parsing (detecting bullet points)
        if (trimmed.includes('\n- ') || trimmed.includes('\n* ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split(/\n[-*]\s/).filter(i => i.trim());
          return (
            <ul key={bIdx}>
              {items.map((item, iIdx) => (
                <li key={iIdx}>{renderInline(item.replace(/^[-*]\s/, ''))}</li>
              ))}
            </ul>
          );
        }

        // Ordered list parsing
        if (trimmed.match(/^\d+\.\s/m)) {
          const items = trimmed.split(/\n\d+\.\s/).filter(i => i.trim());
          return (
            <ol key={bIdx}>
              {items.map((item, iIdx) => (
                <li key={iIdx}>{renderInline(item.replace(/^\d+\.\s/, ''))}</li>
              ))}
            </ol>
          );
        }

        // Standard paragraph
        return <p key={bIdx}>{renderInline(trimmed)}</p>;
      })}
    </>
  );
};

// Helper to handle bold/inline styles safely
const renderInline = (text) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export default function DeepViewAi({ categoryName, symbols, weekData, aiSettings, stockData }) {
  const [analysisText, setAnalysisText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAnalysis() {
      if (!symbols || symbols.length === 0) {
        if (isMounted) {
          setLoading(false);
          setError("No stocks available for analysis in this category.");
        }
        return;
      }

      setLoading(true);
      setError(null);

      // Map the performance metrics for the AI
      const stockMetrics = {};
      (stockData || []).forEach(s => {
        stockMetrics[s.symbol] = {
          performance: `${s.periodChangePct?.toFixed(1)}%`,
          isUp: s.isAdvancing
        };
      });

      // Destructure to EXPLICITLY exclude the apiKey from the payload sent TO the model
      const { apiKey, ...safeAiSettings } = aiSettings || {};

      const aiDataPayload = {
        ...weekData,
        ...safeAiSettings,
        category: categoryName,
        stockMetrics: stockMetrics
      };

      const prompt = `Act as a Lead Institutional Research Analyst specialized in Tactical Basket Trading.
Analyze the constituent group of the "${categoryName}" sector.

Your Mission: Filter through this group and provide a high-conviction "Execution Report" that directs a trader toward the most high-probability entry setups.

Research Structure & Requirements:
- STRUCTURE: Use clear ### headers and bullet points. DO NOT USE TABLES.
- TONE: Professional, skeptical, and decision-driven. 

Required Sections:
1. **Executive Summary**: 2-3 sentences on the group's health and collective alpha.
2. **The Leadership Tier (Highest Conviction)**: Identify 1-2 stocks with the best relative strength. Explain why they are currently leading the basket.
3. **Execution Decision Matrix**: For each pick in the Leadership Tier, provide:
   - **Technical Verdict**: A data-driven reason for entry.
   - **Entry Trigger**: The specific catalyst or level to watch.
   - **Risk Parameter**: Where the bullish narrative fails for this stock.
4. **Group Anomalies**: Any stocks decoupling significantly from the group trend.

Identify: ${symbols.join(", ")}. Use their provided performance numbers for the analysis.
Start directly with the report.`;

      try {
        const result = await getAiAnalysis(aiDataPayload, null, prompt, true);
        if (isMounted) {
          setAnalysisText(result.rawText || result.text || result.content || "Analysis completed but no text was returned.");
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Deep View AI Error:", err);
          setError(err.message || "Failed to generate deep view analysis.");
          setLoading(false);
        }
      }
    }

    fetchAnalysis();

    return () => { isMounted = false; };
  }, [categoryName, symbols, weekData, aiSettings, stockData]);

  if (loading) {
    return (
      <div className="deep-view-container">
        <div className="ai-loading-state">
          <div className="spinner" />
          <span>Generating Research for {categoryName}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="deep-view-container">
        <div className="deep-view-report deep-view-error">
          <h3>Analysis Failed</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deep-view-container">
      <div className="deep-view-report">
        <div className="phenomena-report-header">
          <div className="ca-category-chip">
            <span className="ca-category-type">Phenomena Research</span>
            <span className="ca-category-name">{categoryName}</span>
          </div>
          <div className="phenomena-date">Report Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
        
        <div className="phenomena-content">
          <FormattedText text={analysisText} />
        </div>

        <div className="phenomena-report-footer">
          <div className="footer-line" />
          <div className="footer-text">
            <strong>Decision Disclosure:</strong> Tiers and triggers are derived from current group performance divergence. Standard risk management is recommended.
          </div>
        </div>
      </div>
    </div>
  );
}
