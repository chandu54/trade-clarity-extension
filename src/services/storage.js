import { DEFAULT_DATA } from "../seed";
import { CONFIG } from "../constants/config";
import { getActualCurrentSunday } from "../utils/weekHelpers";

const KEY = CONFIG.STORAGE_KEY;

function isChromeStorage() {
  return typeof chrome !== "undefined" && chrome.storage?.local;
}

export async function loadData() {
  let data;
  let needsSave = false;

  /* =========================
     LOAD RAW DATA
  ========================= */
  if (isChromeStorage()) {
    data = await new Promise((resolve) => {
      chrome.storage.local.get(KEY, (res) => {
        resolve(res[KEY] || null);
      });
    });
  } else {
    data = JSON.parse(localStorage.getItem(KEY));
  }

  /* =========================
     INIT IF EMPTY
  ========================= */
  if (!data) {
    data = structuredClone(DEFAULT_DATA);
    needsSave = true;
  }
  if (!data.watchlists) {
    data.watchlists = structuredClone(DEFAULT_DATA.watchlists);
    needsSave = true;
  }

  /* =========================
   MERGE UI CONFIG (IMPORTANT)
 ========================= */
  if (!data.uiConfig || !data.uiConfig.columns) {
    data.uiConfig = {
      ...structuredClone(DEFAULT_DATA.uiConfig),
      ...(data.uiConfig || {}),
      columns: {
        ...structuredClone(DEFAULT_DATA.uiConfig.columns),
        ...(data.uiConfig?.columns || {}),
      },
    };
    needsSave = true;
  }

  if (!("__businessScope__" in data.uiConfig.columnVisibility)) {
    data.uiConfig.columnVisibility.__businessScope__ = true;
    needsSave = true;
  }
  if (!("__dependentIndustries__" in data.uiConfig.columnVisibility)) {
    data.uiConfig.columnVisibility.__dependentIndustries__ = true;
    needsSave = true;
  }

  Object.keys(data.paramDefinitions).forEach((key) => {
    if (!(key in data.uiConfig.columnVisibility)) {
      data.uiConfig.columnVisibility[key] = true;
      needsSave = true;
    }
  });

  /* =========================
     MERGE DEFAULT SECTORS & MIGRATION
  ========================= */
  const migrateSectors = (sectors) => {
    if (!Array.isArray(sectors)) return { list: structuredClone(DEFAULT_DATA.sectors), changed: true };
    if (sectors.length > 0 && typeof sectors[0] === "string") {
      return { list: sectors.map(s => ({ name: s, countries: ["IN", "US"] })), changed: true };
    }
    return { list: sectors, changed: false };
  };

  const sectorResult = migrateSectors(data.sectors);
  if (sectorResult.changed) {
    data.sectors = sectorResult.list;
    needsSave = true;
  }

  if (data.uiConfig) {
    const uiSectorResult = migrateSectors(data.uiConfig.sectors);
    if (uiSectorResult.changed) {
      data.uiConfig.sectors = uiSectorResult.list;
      needsSave = true;
    }
  }

  /* =========================
     MERGE AI SETTINGS MIGRATION 
  ========================= */
  const AI_KEY_STORE = "ai_api_key";
  const AI_MODEL_STORE = "ai_model";
  const CUSTOM_PROMPTS_STORE = "custom_prompts";

  if (!data.aiSettings) {
    data.aiSettings = {
       apiKey: "",
       model: CONFIG.DEFAULT_AI_MODEL,
       systemPrompt: CONFIG.DEFAULT_SYSTEM_PROMPT,
       phenomenaPrompt: "",
       singleStockPrompt: "",
       customPrompts: [],
       promptLibrary: {
         watchlist: [],
         bulk: [],
         phenomena: [],
         stock: []
       }
    };
    needsSave = true;
  } else {
    // Migrate existing aiSettings to include new fields if they are missing
    let migrated = false;
    if (data.aiSettings.phenomenaPrompt === undefined) {
      data.aiSettings.phenomenaPrompt = "";
      migrated = true;
    }
    if (data.aiSettings.singleStockPrompt === undefined) {
      data.aiSettings.singleStockPrompt = "";
      migrated = true;
    }
    if (data.aiSettings.promptLibrary === undefined) {
      data.aiSettings.promptLibrary = {
        watchlist: [],
        phenomena: [],
        stock: []
      };
      migrated = true;
    }
    if (migrated) needsSave = true;
  }

  // Check for legacy root-level keys
  const legacyData = isChromeStorage() 
    ? await new Promise(resolve => chrome.storage.local.get([AI_KEY_STORE, AI_MODEL_STORE, CUSTOM_PROMPTS_STORE], resolve))
    : {
        [AI_KEY_STORE]: localStorage.getItem(AI_KEY_STORE),
        [AI_MODEL_STORE]: localStorage.getItem(AI_MODEL_STORE),
        [CUSTOM_PROMPTS_STORE]: localStorage.getItem(CUSTOM_PROMPTS_STORE)
      };

  if (legacyData[AI_KEY_STORE]) {
    data.aiSettings.apiKey = legacyData[AI_KEY_STORE];
    needsSave = true;
  }
  if (legacyData[AI_MODEL_STORE]) {
    data.aiSettings.model = legacyData[AI_MODEL_STORE];
    needsSave = true;
  }
  if (legacyData[CUSTOM_PROMPTS_STORE]) {
    try {
      data.aiSettings.customPrompts = typeof legacyData[CUSTOM_PROMPTS_STORE] === 'string' 
        ? JSON.parse(legacyData[CUSTOM_PROMPTS_STORE]) 
        : legacyData[CUSTOM_PROMPTS_STORE];
      needsSave = true;
    } catch { /* ignore silently */ }
  }

  const safeRemove = (key) => {
    if (isChromeStorage() && typeof chrome.storage.local.remove === 'function') {
      chrome.storage.local.remove(key);
    } else if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.removeItem === 'function') {
      const keysToClear = Array.isArray(key) ? key : [key];
      keysToClear.forEach(k => {
        try { localStorage.removeItem(k); } catch (_e) { /* ignore */ }
      });
    }
  };

  if (needsSave) {
    safeRemove([AI_KEY_STORE, AI_MODEL_STORE, "ai_prompt", CUSTOM_PROMPTS_STORE]);
  }

  // --- NEW: Pro Status Migration ---
  const PRO_KEY = "tc_is_pro";
  const legacyPro = isChromeStorage()
    ? (await new Promise(resolve => chrome.storage.local.get(PRO_KEY, resolve)))[PRO_KEY]
    : localStorage.getItem(PRO_KEY);

  if (legacyPro !== null) {
    data.isPro = legacyPro === "true" || legacyPro === true;
    needsSave = true;
    safeRemove(PRO_KEY);
  }

  // --- NEW: Theme Migration ---
  const THEME_KEY = "tc_theme";
  const legacyTheme = isChromeStorage()
    ? (await new Promise(resolve => chrome.storage.local.get(THEME_KEY, resolve)))[THEME_KEY]
    : localStorage.getItem(THEME_KEY);

  if (legacyTheme) {
    data.theme = legacyTheme;
    needsSave = true;
    safeRemove(THEME_KEY);
  }

  // --- NEW: Analytics Layout Migration ---
  const ANALYTICS_KEY = "tc_analytics_layout";
  const legacyAnalytics = isChromeStorage()
    ? (await new Promise(resolve => chrome.storage.local.get(ANALYTICS_KEY, resolve)))[ANALYTICS_KEY]
    : localStorage.getItem(ANALYTICS_KEY);

  if (legacyAnalytics) {
    try {
      data.analyticsLayout = typeof legacyAnalytics === "string" 
        ? JSON.parse(legacyAnalytics) 
        : legacyAnalytics;
      needsSave = true;
      safeRemove(ANALYTICS_KEY);
    } catch {
      // Ignore corrupted layout
    }
  }

  /* =========================
     MERGE DEFAULT PARAMS
  ========================= */
  const originalParamCount = Object.keys(data.paramDefinitions).length;
  data.paramDefinitions = {
    ...structuredClone(DEFAULT_DATA.paramDefinitions),
    ...(data.paramDefinitions || {}),
  };
  if (Object.keys(data.paramDefinitions).length !== originalParamCount) {
    needsSave = true;
  }

  /* =========================
     MERGE DEFAULT JOURNALS
  ========================= */
  if (!data.journals) {
    data.journals = { IN: [], US: [] };
    needsSave = true;
  } else {
    if (Array.isArray(data.journals)) {
      data.journals = { IN: data.journals, US: [] };
      needsSave = true;
    }
    if (!data.journals.IN) {
      data.journals.IN = [];
      needsSave = true;
    }
    if (!data.journals.US) {
      data.journals.US = [];
      needsSave = true;
    }
  }

  /* =========================
     ENSURE CURRENT WEEK
  ========================= */
  /* =========================
     ENSURE WEEK STRUCTURE
  ========================= */
  if (data.weeks && !data.weeks.US && !data.weeks.IN) {
    const oldWeeks = data.weeks;
    data.weeks = { US: oldWeeks, IN: {} };
    needsSave = true;
  }

  if (!data.weeks) {
    data.weeks = { US: {}, IN: {} };
    needsSave = true;
  }

  if (!data.weeks.US) {
    data.weeks.US = {};
    needsSave = true;
  }
  if (!data.weeks.IN) {
    data.weeks.IN = {};
    needsSave = true;
  }

  // Use robust utility for current weekKey
  const weekKey = getActualCurrentSunday();

  if (!data.weeks.US[weekKey] && !data.weeks.IN[weekKey]) {
    data.weeks.US[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
    needsSave = true;
  }

  if (!data.drawings) {
    data.drawings = {};
    needsSave = true;
  }

  /* =========================
     SAVE BACK ONLY IF CHANGED
  ========================= */
  if (needsSave) {
    await saveData(data);
  }

  return data;
}

export async function saveData(data) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [KEY]: data }, resolve);
    });
  } else {
    localStorage.setItem(KEY, JSON.stringify(data));
  }
}

function normalizeSymbolKey(symbol) {
  if (!symbol) return '';
  return String(symbol).replace(/\.(NS|BO)$/i, '').trim().toUpperCase();
}

export async function getDrawingsForSymbol(symbol) {
  const key = normalizeSymbolKey(symbol);
  if (!key) return [];
  const data = await loadData();
  const drawings = data.drawings || {};
  return drawings[key] || [];
}

export async function saveDrawingForSymbol(symbol, drawing) {
  const key = normalizeSymbolKey(symbol);
  if (!key || !drawing) return [];
  const data = await loadData();
  data.drawings = data.drawings || {};
  const current = data.drawings[key] || [];
  
  const idx = current.findIndex(d => d.id === drawing.id);
  if (idx >= 0) {
    current[idx] = drawing;
  } else {
    current.push(drawing);
  }
  
  data.drawings[key] = current;
  await saveData(data);
  return current;
}

export async function deleteDrawingForSymbol(symbol, drawingId) {
  const key = normalizeSymbolKey(symbol);
  if (!key || !drawingId) return [];
  const data = await loadData();
  data.drawings = data.drawings || {};
  const current = data.drawings[key] || [];
  data.drawings[key] = current.filter(d => d.id !== drawingId);
  await saveData(data);
  return data.drawings[key];
}

export async function clearDrawingsForSymbol(symbol) {
  const key = normalizeSymbolKey(symbol);
  if (!key) return [];
  const data = await loadData();
  data.drawings = data.drawings || {};
  data.drawings[key] = [];
  await saveData(data);
  return [];
}
