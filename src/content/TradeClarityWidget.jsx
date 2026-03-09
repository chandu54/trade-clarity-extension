import React, { useState, useEffect, useCallback, useRef } from 'react';

// Helper to calculate the Sunday-based week key
function getWeekKey(dateStr) {
  let date;
  if (dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date();
  }
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(date.setDate(diff));
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
}

const TradeClarityWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [symbol, setSymbol] = useState(null);
  const [appData, setAppData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('IN');
  const [targetDate, setTargetDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saveMessage, setSaveMessage] = useState(false); 
  const [newTag, setNewTag] = useState('');

  // 1. Position & Dragging State
  const [position, setPosition] = useState({ top: 80, right: 16 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTop: 0, startRight: 0, hasMoved: false });

  // 2. Custom Resize State
  const [size, setSize] = useState({ w: 300, h: 480 });
  const isResizing = useRef(false);

  // --- DRAG LOGIC ---
  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) dragRef.current.hasMoved = true;
    setPosition({ top: dragRef.current.startTop + deltaY, right: dragRef.current.startRight - deltaX });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = {
      isDragging: true, startX: e.clientX, startY: e.clientY,
      startTop: position.top, startRight: position.right, hasMoved: false
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // --- RESIZE LOGIC ---
  const startResize = (direction) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const startTop = position.top;
    const startRight = position.right;

    const onMouseMove = (moveEvent) => {
      if (!isResizing.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newW = startW;
      let newH = startH;
      let newTop = startTop;
      let newRight = startRight;

      if (direction.includes('w')) {
        newW = Math.max(260, startW - deltaX);
      } else if (direction.includes('e')) {
        newW = Math.max(260, startW + deltaX);
        newRight = startRight + (startW - newW);
      }

      if (direction.includes('n')) {
        newH = Math.max(250, startH - deltaY);
        newTop = startTop + (startH - newH);
      } else if (direction.includes('s')) {
        newH = Math.max(250, startH + deltaY);
      }

      setSize({ w: newW, h: newH });
      setPosition({ top: newTop, right: newRight });
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const toggleWidget = () => {
    if (!dragRef.current.hasMoved) setIsOpen(!isOpen);
  };

  const openDashboard = () => {
    chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
  };

  // The Bubble Firewall
  const handleWidgetKeyDown = (e) => {
    e.stopPropagation(); 
    e.nativeEvent.stopImmediatePropagation();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
  };

  // Settings & Storage Listeners
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes.trading_app_data) setAppData(changes.trading_app_data.newValue);
    };
    chrome.storage.onChanged.addListener(handleStorageChange); return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    chrome.storage.local.get('widget_settings', (result) => {
      if (result.widget_settings) {
        if (result.widget_settings.lastDate) setTargetDate(result.widget_settings.lastDate);
        if (result.widget_settings.lastRegion) setRegion(result.widget_settings.lastRegion);
      }
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    chrome.storage.local.set({ widget_settings: { lastDate: targetDate, lastRegion: region } });
  }, [targetDate, region, settingsLoaded]);

  // Ticker Observation
  useEffect(() => {
    const handleTitleChange = () => {
      const match = document.title.match(/^([A-Z0-9]+)/);
      if (match && match[1]) setSymbol((prev) => (prev !== match[1] ? match[1] : prev));
    };
    handleTitleChange();
    const observer = new MutationObserver(handleTitleChange);
    const titleEl = document.querySelector('title');
    if (titleEl) observer.observe(titleEl, { childList: true });
    return () => observer.disconnect();
  }, []);

  // Load Data
  useEffect(() => {
    if (!symbol || !targetDate || targetDate.length !== 10) return;
    setLoading(true);
    setSaveMessage(false);

    chrome.storage.local.get('trading_app_data', (result) => {
      const data = result.trading_app_data;
      if (!data) {
        setLoading(false);
        setAppData({ paramDefinitions: {} });
        return;
      }
      if (!data.uiConfig) data.uiConfig = {};
      if (!data.uiConfig.tags) data.uiConfig.tags = [];

      setAppData(data);
      const weekKey = getWeekKey(targetDate);
      let weekBucket = data.weeks?.US || data.weeks?.IN ? data.weeks[region]?.[weekKey] : data.weeks?.[weekKey];

      if (weekBucket && weekBucket.stocks && weekBucket.stocks[symbol]) {
        setStockData(weekBucket.stocks[symbol]);
      } else {
        setStockData({ symbol: symbol, sector: "", tradable: false, notes: "", tags: [], params: {} });
      }
      setLoading(false);
    });
  }, [symbol, region, targetDate]);

  // Handlers
  const handleParamChange = (key, value) => setStockData(prev => ({ ...prev, params: { ...prev.params, [key]: value } }));
  const handleFieldChange = (field, value) => setStockData(prev => ({ ...prev, [field]: value }));
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
    handleAddTag(tag);
    setAppData(prev => {
      const uiConfig = prev.uiConfig || {};
      const currentGlobalTags = uiConfig.tags || [];
      if (currentGlobalTags.includes(tag)) return prev;
      return { ...prev, uiConfig: { ...uiConfig, tags: [...currentGlobalTags, tag] } };
    });
    setNewTag("");
  };
  const handleRemoveTag = (tagToRemove) => setStockData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove) }));

  const handleSave = useCallback(() => {
    if (!appData || !symbol || !stockData) return;
    const newData = structuredClone(appData);
    const weekKey = getWeekKey(targetDate);
    let targetWeeks = newData.weeks;
    
    if (newData.weeks.US || newData.weeks.IN) {
      if (!newData.weeks[region]) newData.weeks[region] = {};
      targetWeeks = newData.weeks[region];
    }
    if (!targetWeeks[weekKey]) targetWeeks[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
    targetWeeks[weekKey].stocks[symbol] = stockData;

    chrome.storage.local.set({ trading_app_data: newData }, () => {
      setAppData(newData);
      setSaveMessage(true);
      setTimeout(() => { setSaveMessage(false); setIsOpen(false); }, 1200); 
    });
  }, [appData, symbol, stockData, region, targetDate]);

  if (!symbol) return null; 

  // --- FAB STATE (CLOSED) ---
  if (!isOpen) {
    return (
      <div
        className="fixed z-[9999] cursor-move backdrop-blur-md rounded-full shadow-2xl p-3 border transition-all flex items-center justify-center gap-2 group bg-slate-900/80 border-slate-700/50 hover:bg-slate-800 text-white"
        style={{ top: position.top, right: position.right }}
        onMouseDown={handleMouseDown}
        onClick={toggleWidget}
      >
         <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
         <span className="text-xs font-bold hidden group-hover:block px-1">TC: {symbol}</span>
      </div>
    );
  }

  // --- WIDGET STATE (OPEN) ---
  return (
    <div
      className="fixed z-[9999] backdrop-blur-xl rounded-xl border font-sans text-sm flex flex-col transition-colors duration-200 bg-slate-900/95 text-slate-200 border-slate-700/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
      style={{ 
        top: position.top, 
        right: position.right, 
        width: `${size.w}px`, 
        height: `${size.h}px`,
        maxHeight: '90vh'
      }}
      onKeyDown={handleWidgetKeyDown}
      onKeyUp={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      onKeyPress={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
    >
      <style>{`
        .themed-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .themed-scroll::-webkit-scrollbar-track { background: transparent; }
        .themed-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .themed-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .themed-scroll::-webkit-scrollbar-corner { background: transparent; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Invisible Edge Resize Handles */}
      <div onMouseDown={startResize('n')} className="absolute top-0 left-0 w-full h-1 z-50 cursor-n-resize" />
      <div onMouseDown={startResize('s')} className="absolute bottom-0 left-0 w-full h-1 z-50 cursor-s-resize" />
      <div onMouseDown={startResize('e')} className="absolute top-0 right-0 w-1 h-full z-50 cursor-e-resize" />
      <div onMouseDown={startResize('w')} className="absolute top-0 left-0 w-1 h-full z-50 cursor-w-resize" />
      <div onMouseDown={startResize('nw')} className="absolute top-0 left-0 w-3 h-3 z-50 cursor-nw-resize" />
      <div onMouseDown={startResize('ne')} className="absolute top-0 right-0 w-3 h-3 z-50 cursor-ne-resize" />
      <div onMouseDown={startResize('sw')} className="absolute bottom-0 left-0 w-3 h-3 z-50 cursor-sw-resize" />

      {/* Header */}
      {/* Header */}
      <div 
        className="flex flex-col px-3 pt-3 pb-2 border-b rounded-t-xl cursor-move select-none shrink-0 transition-colors duration-200 border-slate-700/50 bg-slate-800/50" 
        onMouseDown={handleMouseDown} 
      >
        {/* Top Row: Title + Window Controls (Proper Flexbox Layout) */}
        <div className="flex items-center justify-between mb-2">
          
          {/* Left: Branding & Symbol */}
          <div className="flex items-center gap-2 overflow-hidden pr-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
            <span className="font-bold tracking-tight shrink-0 text-white">TradeClarity</span>
            <span 
              className="border px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm font-bold truncate bg-slate-800 border-slate-600 text-blue-400" 
              title={symbol}
            >
              {symbol}
            </span>
          </div>

          {/* Right: Window Controls */}
          <div 
            className="flex items-center gap-0.5 rounded-lg px-1 py-0.5 border shrink-0 bg-slate-800/50 border-slate-600/50"
            onMouseDown={(e) => e.stopPropagation()}
          >
              <button onClick={openDashboard} className="transition-colors p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700/50" title="Open Main App">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </button>
              <div className="w-px h-3 mx-0.5 bg-slate-600"></div>
              <button onClick={toggleWidget} className="transition-colors p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700/50" title="Minimize">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
          </div>
        </div>
        
        {/* Controls Row */}
        <div className="flex items-center gap-2">
           <select 
              value={region} 
              onChange={(e) => setRegion(e.target.value)}
              className="text-xs border rounded px-1.5 py-1 focus:border-blue-500 outline-none shadow-sm transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
            >
              <option value="US">US</option>
              <option value="IN">IN</option>
            </select>
           <input 
             type="date" 
             value={targetDate}
             onChange={(e) => setTargetDate(e.target.value)}
             className="text-xs border rounded px-2 py-1 flex-1 focus:border-blue-500 outline-none shadow-sm transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
             style={{ colorScheme: "dark" }}
           />
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="p-3 overflow-y-auto flex-1 themed-scroll">
        <div className="space-y-3">
          
          {/* Sector Dropdown */}
          <div className="flex items-center gap-2 py-1">
            <label className="text-[11px] font-bold w-1/3 truncate text-slate-400" title="Sector">Sector</label>
            <select
              className="flex-1 border rounded px-1.5 py-1 outline-none text-[11px] appearance-none min-w-0 shadow-sm focus:border-blue-500 transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
              value={stockData?.sector || ''}
              onChange={(e) => handleFieldChange('sector', e.target.value)}
            >
              <option value="">Select Sector...</option>
              {(appData?.uiConfig?.sectors || []).map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>

          {/* Dynamic Parameters */}
          {appData?.paramDefinitions && Object.entries(appData.paramDefinitions).map(([key, def]) => {
            if (!def) return null;

            if (def.type === 'checkbox') {
              return (
                <div key={key} className="flex items-center gap-2 py-1">
                  <label className="text-[11px] font-bold w-1/3 truncate text-slate-400" title={def.label}>{def.label}</label>
                  <input
                    type="checkbox"
                    style={{ WebkitAppearance: 'checkbox', appearance: 'checkbox' }}
                    className="h-4 w-4 cursor-pointer accent-blue-500"
                    checked={stockData?.params?.[key] === true}
                    onChange={(e) => handleParamChange(key, e.target.checked)}
                  />
                </div>
              );
            }

            if (def.type === 'select') {
              return (
                <div key={key} className="flex items-center gap-2 py-1">
                  <label className="text-[11px] font-bold w-1/3 truncate text-slate-400" title={def.label}>{def.label}</label>
                  <select
                    className="flex-1 border rounded px-1.5 py-1 outline-none text-[11px] appearance-none min-w-0 shadow-sm focus:border-blue-500 transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
                    value={stockData?.params?.[key] || ''}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {(Array.isArray(def.options) ? def.options : (typeof def.options === 'string' ? def.options.split(',') : [])).map(opt => typeof opt === 'string' ? opt.trim() : opt).filter(Boolean).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div key={key} className="flex items-center gap-2 py-1">
                <label className="text-[11px] font-bold w-1/3 truncate text-slate-400" title={def.label}>{def.label}</label>
                <input
                  type="text"
                  className="flex-1 border rounded px-1.5 py-1 outline-none text-[11px] shadow-sm focus:border-blue-500 transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
                  value={stockData?.params?.[key] || ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                />
              </div>
            );
          })}

         {/* Unified Inline Tags Container */}
          <div className="pt-2 border-t border-slate-700/50">
            <div 
              className="w-full flex flex-wrap items-center gap-1.5 border rounded px-1.5 py-1 min-h-[28px] cursor-text focus-within:border-blue-500 transition-colors shadow-sm bg-slate-800 border-slate-600"
              onClick={() => document.getElementById('tag-input')?.focus()}
            >
              {/* Active Pills */}
              {(stockData?.tags || []).map(tag => (
                <span 
                  key={tag} 
                  className="text-[10px] pl-1.5 pr-1 h-[18px] rounded flex items-center gap-1 shadow-sm border bg-slate-700 text-blue-300 border-slate-600/50"
                >
                  <span className="leading-none mt-[1px]">{tag}</span>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} 
                    className="leading-none font-bold text-[11px] flex items-center justify-center w-3 h-3 rounded transition-colors hover:text-red-400 hover:bg-slate-600"
                  >×</button>
                </span>
              ))}
              
              {/* Vertical Divider */}
              {((stockData?.tags || []).length > 0 && appData?.uiConfig?.tags?.filter(t => !(stockData?.tags || []).includes(t)).length > 0) && (
                <div className="w-[1px] h-3.5 mx-0.5 bg-slate-600"></div>
              )}

              {/* Available Tags */}
              {appData?.uiConfig?.tags?.filter(t => !(stockData?.tags || []).includes(t)).map(t => (
                <button 
                  key={t}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleAddTag(t); }}
                  className="group flex items-center gap-0.5 border text-[10px] px-1.5 h-[18px] rounded transition-all shadow-sm bg-indigo-900/30 border-indigo-700/50 text-indigo-300 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white"
                >
                  <span className="opacity-70 group-hover:opacity-100 font-bold leading-none">+</span>
                  <span className="leading-none mt-[1px]">{t}</span>
                </button>
              ))}

              {/* Seamless Input */}
              <input 
                  id="tag-input"
                  type="text" 
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      if (newTag.trim()) handleCreateTag();
                    }
                  }}
                  placeholder="Type tag & Enter..."
                  className="flex-1 min-w-[80px] bg-transparent text-[11px] outline-none h-[18px] ml-0.5 font-medium text-slate-200 placeholder-slate-500"
              />
            </div>
          </div>
          
          {/* Auto-Expanding Notes */}
          <div className="pt-1">
            <textarea
              rows={1}
              className="w-full border rounded px-2 py-1.5 outline-none resize-none text-[11px] min-h-[28px] themed-scroll shadow-sm focus:border-blue-500 transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
              value={stockData?.notes || ''}
              onChange={(e) => {
                handleFieldChange('notes', e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              placeholder="Add notes..."
            />
          </div>

          {/* Tradable Checkbox */}
          <div className="flex items-center gap-2 py-1 px-2 rounded border bg-slate-800/50 border-slate-700/50">
            <label htmlFor="tradable-check" className="font-bold text-[11px] cursor-pointer w-1/3 truncate text-slate-400" title="Mark as Tradable">Mark as Tradable</label>
            <input
              type="checkbox"
              id="tradable-check"
              style={{ WebkitAppearance: 'checkbox', appearance: 'checkbox' }}
              className="h-4 w-4 cursor-pointer accent-emerald-500"
              checked={stockData?.tradable || false}
              onChange={(e) => handleFieldChange('tradable', e.target.checked)}
            />
          </div>

        </div>
      </div>

      {/* Pinned Footer & Resize Handle */}
      {/* Pinned Footer & Resize Handle */}
      <div className="relative p-2 border-t rounded-b-xl shrink-0 bg-slate-900 border-slate-700/50">
        <button
          onClick={handleSave}
          style={{ backgroundColor: saveMessage ? '#16A34A' : '' }}
          className={`w-full font-bold py-2 rounded text-xs transition-all flex justify-center items-center gap-1.5 ${
            saveMessage 
              ? 'text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]' 
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)] text-white'
          }`}
        >
          {saveMessage ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Saved successfully!
            </>
          ) : 'Save (Cmd+Enter)'}
        </button>

        {/* Custom Drag-to-Resize Handle */}
        <div 
          onMouseDown={startResize('se')}
          className="absolute bottom-0 right-0 w-5 h-5 flex items-end justify-end p-1 opacity-50 hover:opacity-100 transition-opacity z-50 cursor-se-resize text-slate-400"
          title="Drag to resize"
        >
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5">
            <polygon points="10,0 10,10 0,10" fill="currentColor"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default TradeClarityWidget;