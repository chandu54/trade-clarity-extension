import { DEFAULT_DATA } from "../seed";

const KEY = "trading_app_data";
const API_KEY = "ai_api_key";
const AI_MODEL = "ai_model";
const AI_PROMPT = "ai_prompt";
const CUSTOM_PROMPTS = "custom_prompts";

function isChromeStorage() {
  return typeof chrome !== "undefined" && chrome.storage?.local;
}

export async function getStoredApiKey() {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(API_KEY, (res) => resolve(res[API_KEY]));
    });
  } else {
    return localStorage.getItem(API_KEY);
  }
}

export async function setStoredApiKey(key) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [API_KEY]: key }, resolve);
    });
  } else {
    localStorage.setItem(API_KEY, key);
  }
}

export async function getStoredModel() {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(AI_MODEL, (res) => resolve(res[AI_MODEL]));
    });
  } else {
    return localStorage.getItem(AI_MODEL);
  }
}

export async function setStoredModel(model) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [AI_MODEL]: model }, resolve);
    });
  } else {
    localStorage.setItem(AI_MODEL, model);
  }
}

export async function getStoredPrompt() {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(AI_PROMPT, (res) => resolve(res[AI_PROMPT]));
    });
  } else {
    return localStorage.getItem(AI_PROMPT);
  }
}

export async function setStoredPrompt(prompt) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [AI_PROMPT]: prompt }, resolve);
    });
  } else {
    localStorage.setItem(AI_PROMPT, prompt);
  }
}

export async function getCustomPrompts() {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(CUSTOM_PROMPTS, (res) => resolve(res[CUSTOM_PROMPTS] || []));
    });
  } else {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_PROMPTS)) || [];
    } catch {
      return [];
    }
  }
}

export async function setCustomPrompts(prompts) {
  if (isChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [CUSTOM_PROMPTS]: prompts }, resolve);
    });
  } else {
    localStorage.setItem(CUSTOM_PROMPTS, JSON.stringify(prompts));
  }
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
