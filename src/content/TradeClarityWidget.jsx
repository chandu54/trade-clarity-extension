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

// --- ENVIRONMENT HELPERS ---
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

const safeStorage = {
  get: (keys, callback) => {
    if (isExtension) {
      chrome.storage.local.get(keys, callback);
    } else {
      // Web Fallback: localStorage
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => {
        const val = localStorage.getItem(k);
        if (val) {
          try { result[k] = JSON.parse(val); } catch { result[k] = val; }
        }
      });
      if (callback) callback(result);
    }
  },
  set: (items, callback) => {
    if (isExtension) {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          console.error("Storage Error:", chrome.runtime.lastError.message);
          if (callback) callback(chrome.runtime.lastError);
        } else {
          if (callback) callback(null);
        }
      });
    } else {
      // Web Fallback: localStorage
      try {
        Object.entries(items).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        if (callback) callback(null);
      } catch (e) {
        console.error("Local Storage Error:", e);
        if (callback) callback(e);
      }
    }
  }
};

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

  // Voice Integration State
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);
  const parseTranscriptRef = useRef(null);

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

  // Ensure listeners are cleaned up if component unmounts during drag
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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

  const openDashboard = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExtension) {
      try {
        chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Background worker asleep or disconnected. Firing fallback...", chrome.runtime.lastError.message);
            const fallbackUrl = `chrome-extension://${chrome.runtime.id}/dashboard.html`;
            window.open(fallbackUrl, '_blank');
          }
        });
      } catch (err) {
        console.error("Extension connection lost.", err);
        alert("TradeClarity updated. Please refresh this TradingView page to reconnect.");
      }
    }
  };

  // The Bubble Firewall
  const handleWidgetKeyDown = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
  };

  // Settings & Storage Listeners
  useEffect(() => {
    if (!isExtension) return; // Skip chrome listeners in web mode
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes.trading_app_data) setAppData(changes.trading_app_data.newValue);
    };
    chrome.storage.onChanged.addListener(handleStorageChange); return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    safeStorage.get('widget_settings', (result) => {
      if (result.widget_settings) {
        if (result.widget_settings.lastDate) setTargetDate(result.widget_settings.lastDate);
        if (result.widget_settings.lastRegion) setRegion(result.widget_settings.lastRegion);
      }
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    safeStorage.set({ widget_settings: { lastDate: targetDate, lastRegion: region } });
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

    safeStorage.get('trading_app_data', (result) => {
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
  const handleParamChange = (key, value) => {
    setStockData(prev => {
      const current = prev || {};
      const currentParams = current.params || {};
      return { ...current, params: { ...currentParams, [key]: value } };
    });
  };
  const handleFieldChange = (field, value) => {
    setStockData(prev => {
      const current = prev || {};
      return { ...current, [field]: value };
    });
  };
  const handleAddTag = (tag) => {
    if (!tag) return;
    setStockData(prev => {
      const current = prev || {};
      const currentTags = current.tags || [];
      if (currentTags.includes(tag)) return current;
      return { ...current, tags: [...currentTags, tag] };
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
  const handleRemoveTag = (tagToRemove) => {
    setStockData(prev => {
      const current = prev || {};
      const currentTags = current.tags || [];
      return { ...current, tags: currentTags.filter(t => t !== tagToRemove) };
    });
  };

  const handleSave = useCallback(() => {
    if (!symbol || !stockData) return;
    const weekKey = getWeekKey(targetDate);

    safeStorage.get('trading_app_data', (result) => {
      const currentData = result.trading_app_data;
      if (!currentData) {
        alert("Failed to save: No application data found.");
        return;
      }
      const newData = structuredClone(currentData);
      let targetWeeks = newData.weeks;

      if (newData.weeks.US || newData.weeks.IN) {
        if (!newData.weeks[region]) newData.weeks[region] = {};
        targetWeeks = newData.weeks[region];
      }
      if (!targetWeeks[weekKey]) targetWeeks[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
      targetWeeks[weekKey].stocks[symbol] = stockData;

      safeStorage.set({ trading_app_data: newData }, (err) => {
        if (err) {
           alert(`Failed to save: Storage limit may be reached.\n\n${err.message || 'Unknown error'}`);
           return; // Intercept success state
        }
        
        // Auto-fetch metrics if enabled
        if (newData.uiConfig?.enableApiHydration === true && isExtension) {
          try {
            chrome.runtime.sendMessage({
              action: "FETCH_STOCK_METRICS",
              payload: {
                symbols: [symbol],
                country: region,
                weekKey,
                paramDefs: newData.paramDefinitions,
                adrDays: newData.uiConfig?.adrDays || 20,
                liquidityDays: newData.uiConfig?.liquidityDays || 20
              }
            });
          } catch (e) {
            console.error("Could not send hydration message:", e);
          }
        }

        setAppData(newData);
        setSaveMessage(true);
        setTimeout(() => { setSaveMessage(false); setIsOpen(false); }, 1200);
      });
    });
  }, [symbol, stockData, region, targetDate]);

  const parseTranscript = useCallback((transcript) => {
    let text = transcript.toLowerCase().trim();

    // --- 0. Phonetic & Transcription Error Correction ---
    // The Web Speech API routinely misunderstands domain-specific or similar-sounding words.
    // We aggressively sanitize the input string before any logic runs.
    const corrections = {
      // Booleans & Common mistranslations
      "falls": "false",
      "fawls": "false",
      "faults": "false",
      "s": "yes", // e.g. "Symmetry S" -> "Symmetry Yes"
      "yep": "yes",
      "yeah": "yes",
      "nah": "no",
      "nope": "no",
      "of": "off",
      "on": "on",
      "check": "true",
      "uncheck": "false",
      "enable": "true",
      "disable": "false",

      // Relative Strength / Attitude
      "week": "weak",
      "strenth": "strength",
      "streangth": "strength",
      "pour": "poor",
      "four": "poor", // Contextual: if they say "attitude four" it's likely "poor" unless we are on a number field. We'll handle numbers later.
      "gud": "good",
      "excellant": "excellent",

      // Numbers (for ADR/Stage)
      "one": "1",
      "two": "2",
      "to": "2",
      "too": "2",
      "three": "3",
      "tree": "3",
      "for": "4",
      "five": "5",
      "six": "6",
      "seven": "7",
      "eight": "8",
      "ate": "8",
      "nine": "9",
      "ten": "10",

      // Stages
      "stage one": "stage 1",
      "stage two": "stage 2",
      "stage to": "stage 2",
      "stage too": "stage 2",
      "stage three": "stage 3",
      "stage tree": "stage 3",
      "stage four": "stage 4",
      "stage for": "stage 4",

      // ADR
      "adr one": "adr 1",
      "adr two": "adr 2",
      "adr to": "adr 2",
      "adr three": "adr 3",
      "adr four": "adr 4",
      "adr for": "adr 4",
      "adr five": "adr 5",
      "adr six": "adr 6",
      "adr seven": "adr 7",
      "adr eight": "adr 8",
      "adr nine": "adr 9",
      "adr ten": "adr 10",
    };

    // Apply entire word replacements
    Object.entries(corrections).forEach(([wrong, right]) => {
      // Regex replace whole words only to avoid destroying substrings
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      text = text.replace(regex, right);
    });

    const matchPart = (part, str) => {
      const escaped = String(part).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // We use \b to represent a word boundary instead of just [^a-z0-9] so that hyphens (like "non-durables") don't break the match.
      return new RegExp(`\\b${escaped}\\b`, 'i').test(str);
    };

    const hasWord = (str) => {
      if (!str) return false;
      return matchPart(str, text);
    };

    const matchStr = (w) => {
      if (!w) return false;
      if (hasWord(w)) return true;
      // We only want plural/singular matching for words > 3 chars to avoid mapping 's' to 'ss' or 'to' to 'tos'
      if (w.length > 3) {
        if (w.endsWith('s') && hasWord(w.slice(0, -1))) return true;
        if (!w.endsWith('s') && hasWord(w + 's')) return true;
      }
      return false;
    };

    // Handle 'Save' Combinations
    // Examples: "save", "save the data", "save the changes", "save changes", "save setup", "save widget"
    const isSaveCommand =
      text === "save" ||
      /^save (it|the data|data|changes|the changes|setup|the setup|widget|the widget)$/i.test(text);

    if (isSaveCommand) {
      handleSave();
      return;
    }

    if (hasWord("tradable")) {
      if (hasWord("not") || hasWord("untradable") || hasWord("false") || hasWord("no")) {
        handleFieldChange('tradable', false);
      } else {
        handleFieldChange('tradable', true);
      }
    } else if (hasWord("untradable")) {
      handleFieldChange('tradable', false);
    }

    if (appData?.paramDefinitions) {
      Object.entries(appData.paramDefinitions).forEach(([key, def]) => {
        if (!def) return;
        const keyLower = String(key).toLowerCase();
        const labelLower = String(def.label || key).toLowerCase();

        const labelWords = labelLower.split(/\s+/).filter(w => w.length > 2);

        let targetsField = false;
        if (matchStr(labelLower) || matchStr(keyLower)) {
          targetsField = true;
        } else {
          for (let w of labelWords) {
            if (matchStr(w)) {
              targetsField = true;
              break;
            }
          }
        }

        if (targetsField) {
          // --- Special Case: Number ranges for Liquidity ---
          if (keyLower === 'liquidity') {
            const numMatch = text.match(/\b(\d+)\s*(?:cr|crore|crores)?\b/i);
            if (numMatch) {
              const targetNumVal = parseInt(numMatch[1], 10);
              
              if (def.type === 'number' || def.type === 'text') {
                 handleParamChange(key, def.type === 'number' ? targetNumVal : String(targetNumVal));
                 return;
              }

              if (def.options && Array.isArray(def.options)) {
                let matchedBucket = null;

                const parsedOptions = def.options.map(opt => {
                  const str = String(opt);
                  const numbers = str.match(/\d+/g);
                  let maxInStr = numbers && numbers.length > 0 ? Math.max(...numbers.map(Number)) : Infinity;

                  const isLessThan = str.includes("<") || str.toLowerCase().includes("under");
                  const isGreaterThan = str.includes(">") || str.includes("+") || str.toLowerCase().includes("over");

                  return { original: opt, max: maxInStr, isLessThan, isGreaterThan, numbers };
                }).sort((a, b) => a.max - b.max);

                for (const opt of parsedOptions) {
                  if (opt.isLessThan) {
                    if (targetNumVal <= opt.max) {
                      matchedBucket = opt.original;
                      break;
                    }
                  } else if (opt.isGreaterThan) {
                    if (targetNumVal >= opt.max) {
                      matchedBucket = opt.original;
                    }
                  } else if (opt.numbers && opt.numbers.length >= 2) {
                    const min = Math.min(...opt.numbers.map(Number));
                    const max = Math.max(...opt.numbers.map(Number));
                    if (targetNumVal >= min && targetNumVal <= max) {
                      matchedBucket = opt.original;
                      break;
                    }
                  } else {
                    if (targetNumVal <= opt.max) {
                      matchedBucket = opt.original;
                      break;
                    }
                  }
                }

                if (!matchedBucket && parsedOptions.length > 0) {
                  matchedBucket = parsedOptions[parsedOptions.length - 1].original;
                }

                if (matchedBucket) {
                  handleParamChange(key, matchedBucket);
                }
              }
              return;
            }
          }

          if (keyLower === 'adr') {
            const numMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
            if (numMatch) {
              const targetVal = parseFloat(numMatch[1]);
              
              if (def.type === 'number' || def.type === 'text') {
                 handleParamChange(key, def.type === 'number' ? targetVal : String(targetVal));
                 return;
              }

              if (def.options && Array.isArray(def.options)) {
                let closestDiff = Infinity;
                let closestOpt = def.options[0];
                for (const opt of def.options) {
                  const optNum = Number(opt);
                  if (!isNaN(optNum)) {
                    const diff = Math.abs(optNum - targetVal);
                    if (diff < closestDiff) {
                      closestDiff = diff;
                      closestOpt = String(opt);
                    }
                  }
                }
                handleParamChange(key, closestOpt);
              }
              return;
            }
          }

          if (def.type === 'select') {
            const options = Array.isArray(def.options) ? def.options : (typeof def.options === 'string' ? def.options.split(',') : []);

            // First pass: try exact phrase matching for multi-word options (e.g. "Stage 3", "Very Strong", "Not Applicable")
            let matchedOption = false;
            for (let opt of options) {
              const optStr = String(opt).trim();
              const optLower = optStr.toLowerCase();
              const escapedOptLower = optLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const exactOptionRegex = new RegExp(`(^|[^a-z0-9])${escapedOptLower}([^a-z0-9]|$)`, 'i');

              if (exactOptionRegex.test(text)) {
                handleParamChange(key, optStr);
                matchedOption = true;
                break;
              }
            }

            // Second pass: loosely match distinct words if exact phrase failed
            if (!matchedOption) {
              for (let opt of options) {
                const optStr = String(opt).trim();
                const optLower = optStr.toLowerCase();
                const normalizedOpt = optLower.replace(/[^a-z0-9\s]/g, '').trim();

                if (
                  hasWord(optLower) ||
                  (normalizedOpt.length > 0 && hasWord(normalizedOpt)) ||
                  (optLower.startsWith(labelLower) && hasWord(optLower.replace(labelLower, '').trim())) ||
                  // Edge case handling: For purely numeric options (like ADR 1-10)
                  (!isNaN(optLower) && hasWord(optLower))
                ) {
                  handleParamChange(key, optStr);
                  break;
                }
              }
            }
          } else if (def.type === 'checkbox') {
            // We must identify if the user is explicitly affirming or denying THIS parameter.
            // Just finding "yes" in the transcript isn't enough, they might be saying "yes" to something else.
            // For checkboxes, if they mentioned the field name, we assume they want to toggle it or set it.

            const affirmWords = ['yes', 'true', 'on', 'enable', 'check', 'yeah', 'yep'];
            const denyWords = ['no', 'false', 'off', 'disable', 'uncheck', 'nope', 'nah', 'now'];

            let isAffirming = false;
            let isDenying = false;

            for (let w of affirmWords) { if (hasWord(w)) { isAffirming = true; break; } }
            for (let w of denyWords) { if (hasWord(w)) { isDenying = true; break; } }

            if (isDenying) {
              handleParamChange(key, false);
            } else if (isAffirming) {
              handleParamChange(key, true);
            } else {
              handleParamChange(key, !(stockData?.params?.[key]));
            }
          } else if (def.type === 'number' || def.type === 'text') {
            // Generic Number/Text extraction:
            // "Set target to 150" -> we look for numbers near the field name
            // Find all numbers in the text
            const numbers = text.match(/\b\d+(\.\d+)?\b/g);
            if (numbers && numbers.length > 0) {
              // If there's a number, just grab the first one we see as the value for this field in this context
              // More advanced NLP would map the closest number to the field, but this is usually sufficient for short voice commands
              const val = def.type === 'number' ? parseFloat(numbers[0]) : numbers[0];
              handleParamChange(key, val);
            }
          } else if (def.type === 'date') {
            // Simple Date Parsing:
            // "Today", "Tomorrow", "Yesterday", or "May 15" -> YYYY-MM-DD
            let d = new Date();
            let matchedDate = false;

            if (hasWord('today')) {
              matchedDate = true;
            } else if (hasWord('tomorrow')) {
              d.setDate(d.getDate() + 1);
              matchedDate = true;
            } else if (hasWord('yesterday')) {
              d.setDate(d.getDate() - 1);
              matchedDate = true;
            } else {
              // Try to match "Month DD" (e.g., "January 5", "Jan 12th")
              const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              for (let m = 0; m < months.length; m++) {
                const monthWord = months[m];
                const monthRegex = new RegExp(`\\b${monthWord}\\s+(\\d+)(st|nd|rd|th)?\\b`, 'i');
                const match = text.match(monthRegex);
                if (match) {
                  const day = parseInt(match[1], 10);
                  const monthIndex = m % 12; // Handle both full length and short length matches
                  d.setMonth(monthIndex);
                  d.setDate(day);
                  // Quick check: if the inferred date is way in the past (e.g. it's Jan and they said Dec 15, assume previous year)
                  const now = new Date();
                  if (d.getMonth() > now.getMonth() + 2) { // Allow slight future, but if it's way off, it's likely last year
                    d.setFullYear(now.getFullYear() - 1);
                  }
                  matchedDate = true;
                  break;
                }
              }
            }

            if (matchedDate) {
              const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              handleParamChange(key, formatted);
            }
          }
        }
      });
    }

    const availableSectors = appData?.uiConfig?.sectors || [];
    for (const sectorObj of availableSectors) {
      if (!sectorObj || !sectorObj.name) continue;
      
      const sectorName = sectorObj.name;
      const s = sectorName.toLowerCase();
      // Handle slashes in Sector names (e.g. "Consumer Durables / Non Durables")
      const normalizedSector = s.replace(/\//g, ' and ').replace(/\s+/g, ' ').trim();

      // Specifically avoid 'it' matching spuriously as it is a common pronoun ("Set it to 5")
      if (s === 'it') {
        if (hasWord("sector it") || hasWord("it sector") || hasWord("information technology")) {
          handleFieldChange('sector', sectorName);
          break;
        }
        continue; // Only allow IT to map if distinctly referenced
      }

      let matchesSector = false;

      const escapedSector = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactMatchRegex = new RegExp(`(^|[^a-z0-9])${escapedSector}([^a-z0-9]|$)`, 'i');

      if (exactMatchRegex.test(text) || text.includes(normalizedSector)) {
        matchesSector = true;
      } else {
        // Tokenize the sector name into distinct words (e.g. "Metals/Minerals" -> "Metals", "Minerals")
        const words = s.split(/[\s/&]+/).filter(w => w.length > 2 && w !== 'and');

        // If all significant words of the sector are matched in the text (plural/singular aware)
        // E.g. "Minerals and Metals" correctly matches "Metals/Minerals"
        if (words.length > 0 && words.every(w => matchStr(w))) {
          if (hasWord('sector') || words.length > 1) {
            // If it's a multi-word sector, matching all distinct words is strong enough.
            // If it's a single word sector, require "sector" as a prefix/suffix to avoid generic triggers.
            matchesSector = true;
          }
        }
      }

      if (matchesSector) {
        handleFieldChange('sector', sectorName);
        break;
      }
    }

    // --- Tags Parsing ---
    const isClearingAllTags = hasWord('remove all tags') || hasWord('clear tags') || hasWord('clear all tags') || hasWord('remove tags');

    if (isClearingAllTags) {
      setStockData(prev => ({ ...prev, tags: [] }));
    } else {
      const availableTags = appData?.uiConfig?.tags || [];
      for (const tag of availableTags) {
        if (!tag) continue;
        const t = tag.toLowerCase();
        // Handle multi-word tags perfectly by escaping regex chars
        const escapedTag = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let matchesTag = false;

        // 1. Exact phrase match using word boundaries
        const exactMatchRegex = new RegExp(`\\b${escapedTag}\\b`, 'i');
        if (exactMatchRegex.test(text)) {
          matchesTag = true;
        }
        // 2. Fallback: Check if they said "tag" + normalized words
        else if (hasWord('tag') || hasWord('tags')) {
          const words = t.split(/[\s/]+/).filter(w => w.length > 2);
          // If all significant words of the tag are present in the text
          if (words.length > 0 && words.every(w => hasWord(w))) {
            matchesTag = true;
          }
        }

        if (matchesTag) {
          if (hasWord('remove') || hasWord('delete') || hasWord('drop') || hasWord('minus') || hasWord('without')) {
            handleRemoveTag(tag);
          } else {
            handleAddTag(tag);
          }
        }
      }
    }

    // Capture Notes anywhere in the sentence
    const noteMatch = text.match(/\b(add notes?|notes?)\b(.*)/i);
    if (noteMatch && noteMatch[2]) {
      const noteContent = noteMatch[2].trim();
      if (noteContent) {
        handleFieldChange('notes', (stockData?.notes ? stockData.notes + ' ' : '') + noteContent);
      }
    }
  }, [appData, stockData, handleSave, handleFieldChange, handleParamChange]);

  useEffect(() => {
    parseTranscriptRef.current = parseTranscript;
  }, [parseTranscript]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true; // Enabled interim results to show the live text
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript('');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        setLiveTranscript(finalTranscript || interimTranscript);

        if (finalTranscript && parseTranscriptRef.current) {
          parseTranscriptRef.current(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setLiveTranscript('Error: ' + event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
        setTimeout(() => setLiveTranscript(''), 2000); // Clear after 2 seconds
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition error:", err);
      }
    }
  }, [isListening]);

  // --- GLOBAL KEYBOARD SHORTCUT (Ctrl+Shift+S / Cmd+Shift+S) ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Allow Ctrl+Shift+S or Cmd+Shift+S to activate voice commands anywhere
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        toggleListening(e);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true); // Use capture phase to ensure it grabs it before TradingView
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [toggleListening]);

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
      className="trade-clarity-widget-container fixed z-[9999] backdrop-blur-xl rounded-xl border font-sans text-sm flex flex-col transition-colors duration-200 bg-slate-900/95 text-slate-200 border-slate-700/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
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
      <div
        className="flex flex-col px-3 pt-3 pb-2 border-b rounded-t-xl cursor-move select-none shrink-0 transition-colors duration-200 border-slate-700/50 bg-slate-800/50"
        onMouseDown={handleMouseDown}
        onClick={toggleWidget}
      >
        {/* Top Row: Title + Window Controls (Proper Flexbox Layout) */}
        <div className="flex items-start justify-between mb-2">

          {/* Left: Branding & Symbol */}
          <div className="flex flex-col gap-1.5 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              <span className="font-bold tracking-tight shrink-0 text-white leading-none">TradeClarity</span>
            </div>
            <span
              className="border px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm font-bold bg-slate-800 border-slate-600 text-blue-400 w-fit break-all"
              title={symbol}
            >
              {symbol}
            </span>
          </div>

          {/* Right: Window Controls & Mic */}
          <div
            className="flex items-center gap-0.5 rounded-lg px-1 py-0.5 border shrink-0 bg-slate-800/50 border-slate-600/50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={toggleListening}
              className={`transition-colors p-1 rounded ${isListening
                  ? 'text-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-[pulse_1.5s_ease-in-out_infinite]'
                  : 'text-slate-400 hover:text-blue-400 hover:bg-slate-700/50'
                }`}
              title="Voice Commands (Ctrl+Shift+S)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 10v2a7 7 0 01-14 0v-2M12 18v4m-4 0h8M12 3a3 3 0 00-3 3v8a3 3 0 006 0V6a3 3 0 00-3-3z"></path></svg>
            </button>
            <div className="w-px h-3 mx-0.5 bg-slate-600"></div>
            <button onClick={openDashboard} className="transition-colors p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-700/50" title="Open TradeClarity Dashboard">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </button>
            <div className="w-px h-3 mx-0.5 bg-slate-600"></div>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="transition-colors p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700/50" title="Minimize">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </div>
        </div>

        {/* Controls Row */}
        <div
          className="flex items-center gap-2"
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-[65px] text-xs border rounded pl-2 pr-6 py-1 focus:border-blue-500 outline-none shadow-sm transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500 appearance-none"
          >
            <option value="US">US</option>
            <option value="IN">IN</option>
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="flex-1 min-w-0 text-xs border rounded px-2 py-1 focus:border-blue-500 outline-none shadow-sm transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
            style={{ colorScheme: "dark" }}
          />
        </div>

        {/* Live Transcript / Listening Indicator */}
        {(isListening || liveTranscript) && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/80 border border-slate-700">
            {isListening && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0"></div>}
            <span className="text-[10px] font-medium text-slate-300 truncate italic">
              {isListening && !liveTranscript ? "Listening..." : `"${liveTranscript}"`}
            </span>
          </div>
        )}
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
              {(appData?.uiConfig?.sectors || [])
                .filter(s => !s.countries || s.countries.includes(region))
                .map(sector => {
                   const sName = typeof sector === 'string' ? sector : sector.name;
                   return <option key={sName} value={sName}>{sName}</option>;
                })
              }
            </select>
          </div>

          {/* Dynamic Parameters */}
          {appData?.paramDefinitions && Object.entries(appData.paramDefinitions)
            .filter(([key, def]) => {
               if (!def) return false;
               if (!def.countries || def.countries.length === 0) return true;
               return def.countries.includes(region);
            })
            .map(([key, def]) => {
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

            if (def.type === 'text' || def.type === 'number' || def.type === 'date') {
              return (
                <div key={key} className="flex items-center gap-2 py-1">
                  <label className="text-[11px] font-bold w-1/3 truncate text-slate-400" title={def.label}>{def.label}</label>
                  <input
                    type={def.type}
                    className="flex-1 border rounded px-1.5 py-1 outline-none text-[11px] shadow-sm focus:border-blue-500 transition-colors font-medium bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500"
                    style={def.type === 'date' ? { colorScheme: "dark" } : {}}
                    value={stockData?.params?.[key] || ''}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                  />
                </div>
              );
            }

            return null;
          })}

          {/* Unified Inline Tags Container */}
          <div className="pt-1.5 border-t border-slate-700/50">
            <div
              className="w-full flex flex-wrap items-center gap-1 border rounded px-1 py-0.5 min-h-[24px] cursor-text focus-within:border-blue-500 transition-colors shadow-sm bg-slate-800 border-slate-600"
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
      <div className="relative p-2 border-t rounded-b-xl shrink-0 bg-slate-900 border-slate-700/50">
        <button
          onClick={handleSave}
          style={{ backgroundColor: saveMessage ? '#16A34A' : '' }}
          className={`w-full font-bold py-2 rounded text-xs transition-all flex justify-center items-center gap-1.5 ${saveMessage
              ? 'text-white shadow-[0_0_10px_rgba(22,163,74,0.4)]'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)] text-white'
            }`}
        >
          {saveMessage ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Saved successfully!
            </>
          ) : 'Save Changes'}
        </button>

        {/* Custom Drag-to-Resize Handle */}
        <div
          onMouseDown={startResize('se')}
          className="absolute bottom-0 right-0 w-5 h-5 flex items-end justify-end p-1 opacity-50 hover:opacity-100 transition-opacity z-50 cursor-se-resize text-slate-400"
          title="Drag to resize"
        >
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5">
            <polygon points="10,0 10,10 0,10" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default TradeClarityWidget;