import { DEFAULT_DATA } from "../seed";

const KEY = "trading_app_data";

function isChromeStorage() {
  return typeof chrome !== "undefined" && chrome.storage?.local;
}

export async function loadData() {
  let data;

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
  }
  if (!data.watchlists) {
    data.watchlists = structuredClone(DEFAULT_DATA.watchlists);
  }

  /* =========================
   MERGE UI CONFIG (IMPORTANT)
========================= */
  data.uiConfig = {
    ...structuredClone(DEFAULT_DATA.uiConfig),
    ...(data.uiConfig || {}),
    columns: {
      ...structuredClone(DEFAULT_DATA.uiConfig.columns),
      ...(data.uiConfig?.columns || {}),
    },
  };

  Object.keys(data.paramDefinitions).forEach((key) => {
    if (!(key in data.uiConfig.columnVisibility)) {
      data.uiConfig.columnVisibility[key] = true;
    }
  });
  /* =========================
     MERGE DEFAULT SECTORS
  ========================= */
  if (!Array.isArray(data.sectors)) {
    data.sectors = structuredClone(DEFAULT_DATA.sectors);
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
       model: "gemini-2.5-flash",
       systemPrompt: "Act as a disciplined, risk-aware swing trading mentor...",
       customPrompts: []
    };
  }

  // Check for legacy root-level keys
  const legacyData = isChromeStorage() 
    ? await new Promise(resolve => chrome.storage.local.get([AI_KEY_STORE, AI_MODEL_STORE, CUSTOM_PROMPTS_STORE], resolve))
    : {
        [AI_KEY_STORE]: localStorage.getItem(AI_KEY_STORE),
        [AI_MODEL_STORE]: localStorage.getItem(AI_MODEL_STORE),
        [CUSTOM_PROMPTS_STORE]: localStorage.getItem(CUSTOM_PROMPTS_STORE)
      };

  let migrated = false;
  
  if (legacyData[AI_KEY_STORE]) {
    data.aiSettings.apiKey = legacyData[AI_KEY_STORE];
    migrated = true;
  }
  if (legacyData[AI_MODEL_STORE]) {
    data.aiSettings.model = legacyData[AI_MODEL_STORE];
    migrated = true;
  }
  if (legacyData[CUSTOM_PROMPTS_STORE]) {
    try {
      // Chrome storage might return the array directly, local storage returns string
      data.aiSettings.customPrompts = typeof legacyData[CUSTOM_PROMPTS_STORE] === 'string' 
        ? JSON.parse(legacyData[CUSTOM_PROMPTS_STORE]) 
        : legacyData[CUSTOM_PROMPTS_STORE];
    } catch (e) { console.error("Could not parse legacy custom prompts", e); }
    migrated = true;
  }

  if (migrated) {
    console.log("Migrating legacy AI settings to trading_app_data...");
    if (isChromeStorage()) {
      chrome.storage.local.remove([AI_KEY_STORE, AI_MODEL_STORE, "ai_prompt", CUSTOM_PROMPTS_STORE]);
    } else {
      localStorage.removeItem(AI_KEY_STORE);
      localStorage.removeItem(AI_MODEL_STORE);
      localStorage.removeItem("ai_prompt");
      localStorage.removeItem(CUSTOM_PROMPTS_STORE);
    }
  }

  /* =========================
     MERGE DEFAULT PARAMS
  ========================= */
  data.paramDefinitions = {
    ...structuredClone(DEFAULT_DATA.paramDefinitions),
    ...(data.paramDefinitions || {}),
  };

  /* =========================
     ENSURE CURRENT WEEK
  ========================= */
  // MIGRATION: Check if weeks are flat (old format) and move to US
  if (data.weeks && !data.weeks.US && !data.weeks.IN) {
    const oldWeeks = data.weeks;
    data.weeks = {
      US: oldWeeks,
      IN: {},
    };
  }

  // Ensure structure
  if (!data.weeks) data.weeks = { US: {}, IN: {} };
  if (!data.weeks.US) data.weeks.US = {};
  if (!data.weeks.IN) data.weeks.IN = {};

  // Calculate current week key using local time
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(now.setDate(diff));
  const weekKey = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

  if (!data.weeks.US[weekKey]) {
    data.weeks.US[weekKey] = {
      displayName: `Week of ${weekKey}`,
      stocks: {},
    };
  }

  /* =========================
     SAVE BACK (IMPORTANT)
  ========================= */
  await saveData(data);

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
