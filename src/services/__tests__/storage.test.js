import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadData, saveData } from "../storage";
import { DEFAULT_DATA } from "../../seed";

// Mock Chrome API
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn((data, callback) => {
        if (typeof callback === "function") callback();
      }),
      remove: vi.fn(),
    },
  },
};

vi.stubGlobal("chrome", chromeMock);

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("storage service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe("loadData", () => {
    it("should initialize with DEFAULT_DATA if storage is empty", async () => {
      chromeMock.storage.local.get.mockImplementation((key, callback) => {
        callback({});
      });

      const data = await loadData();
      expect(data.sectors).toEqual(DEFAULT_DATA.sectors);
      expect(data.aiSettings).toBeDefined();
      // Should have saved back to storage
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    it("should migrate legacy AI settings", async () => {
      // Setup legacy keys in storage
      chromeMock.storage.local.get.mockImplementation((keys, callback) => {
        if (keys === "trading_app_data") callback({});
        else callback({
          "ai_api_key": "test-key",
          "ai_model": "test-model"
        });
      });

      const data = await loadData();
      expect(data.aiSettings.apiKey).toBe("test-key");
      expect(data.aiSettings.model).toBe("test-model");
      
      // Should have removed legacy keys
      expect(chromeMock.storage.local.remove).toHaveBeenCalledWith([
        "ai_api_key", "ai_model", "ai_prompt", "custom_prompts"
      ]);
    });

    it("should migrate flat weeks to US key", async () => {
      const legacyData = {
        weeks: {
          "2024-03-17": { stocks: {} }
        },
        paramDefinitions: {},
        uiConfig: {}
      };

      chromeMock.storage.local.get.mockImplementation((key, callback) => {
        callback({ "trading_app_data": legacyData });
      });

      const data = await loadData();
      expect(data.weeks.US["2024-03-17"]).toBeDefined();
      expect(data.weeks.IN).toBeDefined();
    });

    it("should merge uiConfig with defaults", async () => {
      const existingData = {
        uiConfig: {
          lockPreviousWeeks: true,
          columnVisibility: { "__stock__": true }
        },
        paramDefinitions: { custom: { label: "Custom" } },
        weeks: { US: {}, IN: {} }
      };

      chromeMock.storage.local.get.mockImplementation((key, callback) => {
        callback({ "trading_app_data": existingData });
      });

      const data = await loadData();
      // Should have merged default columnVisibility for 'custom' param
      expect(data.uiConfig.columnVisibility.custom).toBe(true);
      expect(data.uiConfig.lockPreviousWeeks).toBe(true);
    });
  });

  describe("saveData", () => {
    it("should save to chrome.storage.local", async () => {
      const testData = { foo: "bar" };
      await saveData(testData);
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        "trading_app_data": testData
      }, expect.any(Function));
    });
  });
});
