import React, { useState, useEffect, useCallback, useRef } from 'react';

// Helper to calculate the Sunday-based week key (Matches App.jsx logic)
function getWeekKey(dateStr) {
  let date;
  if (dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date();
  }
  // Safety check for invalid dates
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(date.setDate(diff));
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
}

const TradeClarityWidget = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [symbol, setSymbol] = useState(null);
  const [appData, setAppData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('IN'); // Default to IN based on your data, or keep US
  const [targetDate, setTargetDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [newTag, setNewTag] = useState('');

  // Dragging State
  const [position, setPosition] = useState({ top: 80, right: 16 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTop: 0, startRight: 0, hasMoved: false });

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragRef.current.hasMoved = true;
    }

    setPosition({
      top: dragRef.current.startTop + deltaY,
      right: dragRef.current.startRight - deltaX
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startTop: position.top,
      startRight: position.right,
      hasMoved: false
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHeaderClick = () => {
    if (!dragRef.current.hasMoved) {
      setIsOpen(!isOpen);
    }
  };

  // DEBUG: Verify Mount
  useEffect(() => {
    console.log("[TradeClarity] Widget Mounted");
  }, []);

  // Listen for storage changes (e.g. if user updates settings in dashboard)
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes.trading_app_data) {
        console.log("[TradeClarity] AppData updated from storage");
        setAppData(changes.trading_app_data.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Load saved settings (Date & Region) on mount
  useEffect(() => {
    chrome.storage.local.get('widget_settings', (result) => {
      if (result.widget_settings) {
        const { lastDate, lastRegion } = result.widget_settings;
        if (lastDate) setTargetDate(lastDate);
        if (lastRegion) setRegion(lastRegion);
      }
      setSettingsLoaded(true);
    });
  }, []);

  // Save settings when Date or Region changes
  useEffect(() => {
    if (!settingsLoaded) return;
    chrome.storage.local.set({
      widget_settings: {
        lastDate: targetDate,
        lastRegion: region
      }
    });
  }, [targetDate, region, settingsLoaded]);

  // 1. Watch for Ticker Changes via Document Title
  useEffect(() => {
    const handleTitleChange = () => {
      const title = document.title;
      console.log("[TradeClarity] Title changed:", title);
      
      // TradingView titles usually look like "SYMBOL 123.45 ..."
      // We grab the first word as the ticker.
      const match = title.match(/^([A-Z0-9]+)/);
      if (match && match[1]) {
        const newSymbol = match[1];
        console.log("[TradeClarity] Symbol detected:", newSymbol);
        setSymbol((prev) => (prev !== newSymbol ? newSymbol : prev));
      } else {
        console.log("[TradeClarity] No symbol matched in title");
      }
    };

    handleTitleChange(); // Initial check
    
    const observer = new MutationObserver(handleTitleChange);
    const titleEl = document.querySelector('title');
    if (titleEl) {
        observer.observe(titleEl, { childList: true });
    }

    return () => observer.disconnect();
  }, []);

  // 2. Load App Data & Stock Data when Symbol changes
  useEffect(() => {
    if (!symbol) return;
    // Prevent loading data for incomplete/invalid dates (e.g. while typing)
    if (!targetDate || targetDate.length !== 10) return;
    setLoading(true);
    setSaveMessage(''); // Clear any previous messages

    chrome.storage.local.get('trading_app_data', (result) => {
      console.log("[TradeClarity] Storage result:", result);
      const data = result.trading_app_data;
      
      // Handle case where app hasn't been initialized yet
      if (!data) {
        console.warn("[TradeClarity] No appData found. Please open the main extension dashboard once to initialize.");
        setLoading(false);
        setAppData({ paramDefinitions: {} }); // Prevent crash
        return;
      }

      // Ensure tags array exists in uiConfig
      if (!data.uiConfig) data.uiConfig = {};
      if (!data.uiConfig.tags) data.uiConfig.tags = [];

      setAppData(data);

      const weekKey = getWeekKey(targetDate);
      let weekBucket = null;

      // Handle both flat structure and regional structure
      if (data.weeks?.US || data.weeks?.IN) {
        weekBucket = data.weeks[region]?.[weekKey];
      } else {
        weekBucket = data.weeks?.[weekKey];
      }

      if (weekBucket && weekBucket.stocks && weekBucket.stocks[symbol]) {
        console.log("[TradeClarity] Loaded existing data for", symbol);
        setStockData(weekBucket.stocks[symbol]);
      } else {
        console.log("[TradeClarity] Initializing new data for", symbol);
        setStockData({
          symbol: symbol,
          sector: "",
          tradable: false,
          notes: "",
          tags: [],
          params: {}
        });
      }
      setLoading(false);
    });
  }, [symbol, region, targetDate]);

  // 3. Handle Input Changes
  const handleParamChange = (key, value) => {
    setStockData(prev => ({
      ...prev,
      params: { ...prev.params, [key]: value }
    }));
  };

  const handleFieldChange = (field, value) => {
    setStockData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (tag) => {
    if (!tag) return;
    setStockData(prev => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(tag)) return prev;
      return { ...prev, tags: [...currentTags, tag] };
    });
  };

  const handleCreateTag = () => {
    if (!newTag.trim()) return;
    const tag = newTag.trim();
    
    // 1. Add to current stock
    handleAddTag(tag);

    // 2. Add to global appData tags if not present
    setAppData(prev => {
      const uiConfig = prev.uiConfig || {};
      const currentGlobalTags = uiConfig.tags || [];
      if (currentGlobalTags.includes(tag)) return prev;
      return { 
        ...prev, 
        uiConfig: { ...uiConfig, tags: [...currentGlobalTags, tag] }
      };
    });

    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove) => {
    setStockData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(t => t !== tagToRemove)
    }));
  };

  // 4. Save to Chrome Storage
  const handleSave = useCallback(() => {
    if (!appData || !symbol || !stockData) return;

    const newData = structuredClone(appData);
    const weekKey = getWeekKey(targetDate);

    // Ensure structure exists
    let targetWeeks = newData.weeks;
    if (newData.weeks.US || newData.weeks.IN) {
      if (!newData.weeks[region]) newData.weeks[region] = {};
      targetWeeks = newData.weeks[region];
    }

    if (!targetWeeks[weekKey]) {
      targetWeeks[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
    }

    targetWeeks[weekKey].stocks[symbol] = stockData;

    chrome.storage.local.set({ trading_app_data: newData }, () => {
      console.log(`[TradeClarity] Saved ${symbol}`);
      setAppData(newData);
      setSaveMessage("Saved successfully!");
      setTimeout(() => setSaveMessage(''), 2000);
    });
  }, [appData, symbol, stockData, region, targetDate]);

  // FALLBACK UI: If no symbol is detected, show a red box so we know injection worked.
  if (!symbol) {
      return (
          <div className="fixed top-20 right-4 z-50 bg-red-600 text-white p-4 rounded shadow-lg font-sans text-xs border border-white">
              <strong>TradeClarity Debug</strong><br/>
              No Symbol Detected.<br/>
              Page Title: {document.title || 'Empty'}
          </div>
      );
  }

  return (
    <div 
      className="fixed z-[9999] w-80 bg-slate-900/95 text-slate-200 rounded-xl shadow-2xl border border-slate-700/50 font-sans text-sm backdrop-blur-sm transition-all duration-200 ease-in-out"
      style={{ top: position.top, right: position.right }}
    >
      {/* Header */}
      <div 
        className="flex flex-col p-3 border-b border-slate-700/50 bg-slate-800/50 rounded-t-xl cursor-move select-none hover:bg-slate-800/80 transition-colors" 
        onMouseDown={handleMouseDown} 
        onClick={handleHeaderClick}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
            <span className="font-bold text-slate-100 tracking-tight">TradeClarity</span>
            <span className="bg-slate-800 border border-slate-600/50 px-2 py-0.5 rounded text-[11px] font-mono text-blue-300">{symbol}</span>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded">
            {isOpen ? (
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                 <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
               </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Controls Row: Region + Date */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
           <select 
              value={region} 
              onChange={(e) => setRegion(e.target.value)}
              className="bg-slate-950 text-slate-300 text-xs border border-slate-700 rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              title="Select Market Region"
            >
              <option value="US">🇺🇸 US</option>
              <option value="IN">🇮🇳 IN</option>
            </select>

           <input 
             type="date" 
             value={targetDate}
             onChange={(e) => setTargetDate(e.target.value)}
             className="bg-slate-950 text-slate-300 text-xs border border-slate-700 rounded-md px-2 py-1.5 flex-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
             style={{ colorScheme: "dark" }}
           />
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
                <div className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-xs">Loading data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Dynamic Parameters */}
              {appData?.paramDefinitions && Object.entries(appData.paramDefinitions).map(([key, def]) => {
                if (!def) return null;

                // Match logic from EditStockModal.jsx
                if (def.type === 'checkbox') {
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 group">
                      <label className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors truncate" title={def.label}>{def.label}</label>
                      <select
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 focus:border-blue-500 outline-none text-slate-200 text-xs"
                        value={stockData?.params?.[key] === true ? "true" : "false"}
                        onChange={(e) => handleParamChange(key, e.target.value === "true")}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  );
                }

                if (def.type === 'select') {
                  return (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-slate-400 truncate" title={def.label}>{def.label}</label>
                      <select
                        className="flex-1 max-w-[60%] bg-slate-950 border border-slate-700 rounded-md px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none text-slate-200 text-xs transition-all appearance-none"
                        value={stockData?.params?.[key] || ''}
                        onChange={(e) => handleParamChange(key, e.target.value)}
                      >
                        <option value="" className="text-slate-500">Select...</option>
                        {(Array.isArray(def.options) ? def.options : (typeof def.options === 'string' ? def.options.split(',') : []))
                          .map(opt => typeof opt === 'string' ? opt.trim() : opt)
                          .filter(Boolean)
                          .map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                      </select>
                    </div>
                  );
                }

                return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-400 truncate" title={def.label}>{def.label}</label>
                    <input
                      type="text"
                      className="flex-1 max-w-[60%] bg-slate-950 border border-slate-700 rounded-md px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none text-slate-200 text-xs transition-all placeholder-slate-600"
                      value={stockData?.params?.[key] || ''}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      placeholder="..."
                    />
                </div>
                );
              })}

              {/* Tags Section */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400 ml-0.5">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(stockData?.tags || []).map(tag => (
                    <span key={tag} className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-colors hover:bg-blue-500/20">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-white text-blue-300/70 font-bold leading-none focus:outline-none">×</button>
                    </span>
                  ))}
                  {(stockData?.tags || []).length === 0 && (
                      <span className="text-slate-600 text-xs italic px-1">No tags added</span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {appData?.uiConfig?.tags && appData.uiConfig.tags.length > 0 && (
                    <div className="relative flex-1 min-w-0">
                        <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none text-slate-300 text-xs h-8 appearance-none"
                        value=""
                        onChange={(e) => handleAddTag(e.target.value)}
                        >
                        <option value="">Select existing...</option>
                        {appData.uiConfig.tags.filter(t => !(stockData?.tags || []).includes(t)).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                  )}
                  <div className="flex-1 flex gap-1 min-w-0">
                      <input 
                          type="text" 
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                          placeholder="New tag..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none text-slate-200 text-xs h-8 placeholder-slate-600"
                      />
                      <button onClick={handleCreateTag} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 rounded-md text-xs h-8 flex items-center justify-center transition-colors">
                        +
                      </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400 ml-0.5">Notes</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none resize-none text-xs text-slate-200 placeholder-slate-600 leading-relaxed"
                  value={stockData?.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder="Enter setup details, entry/exit points..."
                />
              </div>

              {/* Tradable Checkbox */}
              <div className="flex items-center gap-3 py-2 px-1">
                <div className="relative flex items-center">
                    <input
                    type="checkbox"
                    id="tradable-check"
                    checked={stockData?.tradable || false}
                    onChange={(e) => handleFieldChange('tradable', e.target.checked)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-600 bg-slate-900 checked:border-emerald-500 checked:bg-emerald-500 transition-all"
                    />
                    <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <label htmlFor="tradable-check" className="font-medium text-xs text-slate-300 cursor-pointer select-none hover:text-white transition-colors">Mark as Tradable</label>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                {saveMessage && (
                  <div className="mb-3 text-center text-emerald-400 text-xs font-bold bg-emerald-950/50 py-2 rounded-md border border-emerald-900/50 animate-fade-in">
                    {saveMessage}
                  </div>
                )}
                <button
                  onClick={handleSave}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-2.5 rounded-md transition-all text-sm shadow-lg shadow-emerald-900/20 border border-emerald-500/20 active:scale-[0.98]"
                >
                  Save to Watchlist
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TradeClarityWidget;
