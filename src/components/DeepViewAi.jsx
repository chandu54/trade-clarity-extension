import { useState, useEffect } from 'react';
import { getAiAnalysis, PROMPT_TEMPLATES } from '../services/ai';

// Safe markdown-lite parser to avoid dangerouslySetInnerHTML and external dependencies
const FormattedText = ({ text }) => {
  if (!text) return null;

  // Split by double newlines for paragraphs/blocks
  const blocks = text.split(/\n\n/);

  return (
    <div className="intelligence-body">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header parsing
        if (trimmed.startsWith('### ')) return <h3 key={bIdx}>{renderInline(trimmed.replace('### ', ''))}</h3>;
        if (trimmed.startsWith('## ')) return <h2 key={bIdx}>{renderInline(trimmed.replace('## ', ''))}</h2>;
        if (trimmed.startsWith('# ')) return <h1 key={bIdx}>{renderInline(trimmed.replace('# ', ''))}</h1>;

        // Special Section Detector (e.g., Executive Summary, Actionable Setups)
        const isSpecialHeader = trimmed.match(/^(Executive Summary|The Leadership Tier|Execution Decision Matrix|Group Anomalies|Technical Thesis|Actionable Takeaways):/i);
        if (isSpecialHeader) {
          const [header, ...rest] = trimmed.split(':');
          return (
            <div key={bIdx} className="special-intelligence-block">
              <h4 className="special-header">{header}</h4>
              <p className="special-body">{renderInline(rest.join(':').trim())}</p>
            </div>
          );
        }

        // List parsing (detecting bullet points)
        if (trimmed.includes('\n- ') || trimmed.includes('\n* ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split(/\n[-*]\s/).filter(i => i.trim());
          return (
            <ul key={bIdx} className="intelligence-list">
              {items.map((item, iIdx) => (
                <li key={iIdx}>{renderInline(item.replace(/^[-*]\s/, ''))}</li>
              ))}
            </ul>
          );
        }

        // Standard paragraph
        return <p key={bIdx} className="intelligence-p">{renderInline(trimmed)}</p>;
      })}
    </div>
  );
};

// Helper to handle bold/inline styles safely
const renderInline = (text) => {
  if (typeof text !== 'string') return text;
  
  // Handle bold (**text**)
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="intel-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export default function DeepViewAi({ categoryName, symbols, weekData, aiSettings, stockData }) {
  const [analysisText, setAnalysisText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPromptId, setSelectedPromptId] = useState(aiSettings?.promptLibrary?.defaults?.phenomena || "default");

  // Library Management
  const phenomenaLibrary = aiSettings?.promptLibrary?.phenomena || [];
  const allStrategies = [
    { id: "default", label: "Market Phenomena (Default)", text: PROMPT_TEMPLATES.find(t => t.value === 'phenomena')?.text || "" },
    ...phenomenaLibrary
  ];

  const activeStrategy = allStrategies.find(s => s.id === selectedPromptId) || allStrategies[0];

  useEffect(() => {
    let isMounted = true;

    async function fetchAnalysis() {
      if (!symbols || symbols.length === 0) {
        if (isMounted) {
          setLoading(false);
          setError("No stocks available for analysis.");
        }
        return;
      }

      setLoading(true);
      setError(null);

      const stockMetrics = {};
      (stockData || []).forEach(s => {
        stockMetrics[s.symbol] = {
          performance: `${s.periodChangePct?.toFixed(1)}%`,
          isUp: s.isAdvancing
        };
      });

      const { apiKey, model, ...safeAiSettings } = aiSettings || {};
      const aiDataPayload = { ...weekData, ...safeAiSettings, category: categoryName, stockMetrics: stockMetrics };

      try {
        const result = await getAiAnalysis(
          apiKey, 
          model, 
          aiDataPayload, 
          null, 
          activeStrategy.text, 
          true,
          { category: categoryName }
        );
        
        if (isMounted) {
          setAnalysisText(result.rawText || result.text || result.content || "No analysis returned.");
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchAnalysis();
    return () => { isMounted = false; };
  }, [categoryName, symbols, weekData, aiSettings, stockData, selectedPromptId, activeStrategy.text]);

  if (loading) {
    return (
      <div className="deep-view-container">
        <div className="ai-loading-state">
          <div className="spinner" />
          <span>Analysing: {categoryName}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    const isQuota = error.includes("Quota Limit Reached") || error.includes("RESOURCE_EXHAUSTED") || error.includes("429");
    return (
      <div className="deep-view-container" style={{ padding: '16px' }}>
        <div className="ai-inline-warning-card">
          <div className="ai-inline-warning-header">
            <span>⚠️</span>
            <span>{isQuota ? "Gemini API Quota Limit Reached" : "AI Service Error"}</span>
          </div>
          <div className="ai-inline-warning-body">
            {error}
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
    );
  }

  return (
    <div className="deep-view-container">
      <div className="phenomena-report-v3">
        {/* Simplified Header */}
        <div className="phenomena-top-bar">
          <div className="phenomena-header-left">
            <span className="phenomena-title-pill">Phenomena Research: <strong>{categoryName}</strong></span>
          </div>
          
          <div className="phenomena-meta-group">
            <div className="phenomena-timestamp">
              <span className="meta-label">Issued</span>
              <span className="meta-value">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            
            {phenomenaLibrary.length > 0 && (
              <div className="phenomena-strategy-picker">
                <span className="meta-label">Strategy</span>
                <select 
                  value={selectedPromptId} 
                  onChange={e => setSelectedPromptId(e.target.value)}
                  className="phenomena-select"
                >
                  <option value="default">System Default {(aiSettings?.promptLibrary?.defaults?.phenomena === "default" || aiSettings?.promptLibrary?.defaults?.phenomena === "system" || !aiSettings?.promptLibrary?.defaults?.phenomena) ? "(Active)" : ""}</option>
                  {phenomenaLibrary.map(p => <option key={p.id} value={p.id}>{p.label} {aiSettings?.promptLibrary?.defaults?.phenomena === p.id ? "(Active)" : ""}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Full-width Intelligence Content */}
        <div className="phenomena-main-content themed-scroll">
          <div className="phenomena-content-inner">
            <FormattedText text={analysisText} />
          </div>

          {/* Disclaimer & Footer */}
          <footer className="phenomena-institutional-footer">
            <div className="methodology-box">
              <strong>Methodology:</strong> Insights are synthesized using divergence analysis of constituent price discovery, 
              institutional flow signals, and sector-relative strength metrics.
            </div>
            <div className="legal-disclaimer">
              Proprietary AI synthesis. This report is for professional informational purposes only.
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
