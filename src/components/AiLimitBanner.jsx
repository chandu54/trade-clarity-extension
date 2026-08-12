import React, { useState, useEffect } from "react";

const getInitialTimeLeft = (blockedUntil) => {
  if (!blockedUntil) return 0;
  return Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
};

export default function AiLimitBanner({ aiSettings, setData }) {
  const blockedUntil = aiSettings?.aiState?.blockedUntil || 0;
  const [timeLeft, setTimeLeft] = useState(() => getInitialTimeLeft(blockedUntil));

  useEffect(() => {
    if (!blockedUntil) return;

    const updateTimer = () => {
      const remaining = Math.ceil((blockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        // Automatically reset failure state when cooldown expires
        setData((prev) => {
          const newData = {
            ...prev,
            aiSettings: {
              ...(prev?.aiSettings || {}),
              aiState: { continuousFailures: 0, blockedUntil: 0 }
            }
          };
          if (typeof chrome !== "undefined" && chrome.storage?.local) {
            chrome.storage.local.set({ trading_app_data: newData });
          }
          return newData;
        });
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil, setData]);

  if (timeLeft <= 0) return null;

  const handleReset = () => {
    setTimeLeft(0);
    setData((prev) => {
      const newData = {
        ...prev,
        aiSettings: {
          ...(prev?.aiSettings || {}),
          aiState: { continuousFailures: 0, blockedUntil: 0 }
        }
      };
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ trading_app_data: newData });
      }
      return newData;
    });
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="ai-limit-banner">
      <div className="ai-limit-content">
        <span className="ai-limit-icon">⚠️</span>
        <span className="ai-limit-text">
          <strong>Gemini API Quota Limit Reached.</strong> Your AI provider (Google Gemini) has temporarily paused requests due to free-tier quota limits. Available again in <strong>{formatTime(timeLeft)}</strong>.
        </span>
      </div>
      <div className="ai-limit-actions">
        <a 
          href="https://aistudio.google.com/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="ai-limit-link-btn"
          title="Check your Gemini API quota & plan on Google AI Studio"
        >
          Check Plan & Quota ↗
        </a>
        <button className="ai-limit-btn" onClick={handleReset}>
          Reset Limit & Retry
        </button>
      </div>
    </div>
  );
}
