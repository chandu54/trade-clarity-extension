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
       customPrompts: []
    };
    needsSave = true;
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
    } catch (e) { /* ignore silently */ }
  }

  if (needsSave && isChromeStorage()) {
    chrome.storage.local.remove([AI_KEY_STORE, AI_MODEL_STORE, "ai_prompt", CUSTOM_PROMPTS_STORE]);
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
     ENSURE CURRENT WEEK
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

  // Use robust utility for current weekKey
  const weekKey = getActualCurrentSunday();

  if (!data.weeks.US[weekKey] && !data.weeks.IN[weekKey]) {
    data.weeks.US[weekKey] = { displayName: `Week of ${weekKey}`, stocks: {} };
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
