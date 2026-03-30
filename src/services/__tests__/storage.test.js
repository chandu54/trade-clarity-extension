import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadData, saveData } from "../storage";
import { DEFAULT_DATA } from "../../seed";

// Helper to mock global objects
const stubGlobal = (name, value) => {
  const original = global[name];
  global[name] = value;
  return () => {
    global[name] = original;
  };
};

describe("storage service", () => {
  let restoreChrome;
  let restoreLocalStorage;
  let mockStorage = {};

  const chromeMock = {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn((data, callback) => {
          Object.assign(mockStorage, data);
          if (typeof callback === "function") callback();
        }),
        remove: vi.fn(),
      },
    },
  };

  const localStorageMock = {
    getItem: vi.fn(key => mockStorage[key] || null),
    setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
    removeItem: vi.fn(key => { delete mockStorage[key]; }),
    clear: vi.fn(() => { mockStorage = {}; }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};
  });

  describe("Chrome Storage Environment", () => {
    beforeEach(() => {
      restoreChrome = stubGlobal("chrome", chromeMock);
      restoreLocalStorage = stubGlobal("localStorage", localStorageMock);
    });

    afterEach(() => {
      restoreChrome();
      restoreLocalStorage();
    });

    it("should initialize with DEFAULT_DATA if storage is empty", async () => {
      chromeMock.storage.local.get.mockImplementation((key, callback) => {
        callback({});
      });

      const data = await loadData();
      expect(data.sectors).toEqual(DEFAULT_DATA.sectors);
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    it("should migrate legacy AI settings", async () => {
      chromeMock.storage.local.get.mockImplementation((keys, callback) => {
        if (keys === "trading_app_data") callback({});
        else callback({
          "ai_api_key": "test-key",
          "ai_model": "test-model"
        });
      });

      const data = await loadData();
      expect(data.aiSettings.apiKey).toBe("test-key");
      expect(chromeMock.storage.local.remove).toHaveBeenCalled();
    });
  });

  describe("LocalStorage Environment", () => {
    beforeEach(() => {
      restoreChrome = stubGlobal("chrome", undefined);
      restoreLocalStorage = stubGlobal("localStorage", localStorageMock);
    });

    afterEach(() => {
      restoreChrome();
      restoreLocalStorage();
    });

    it("should fallback to localStorage if chrome.storage is unavailable", async () => {
      const testData = { ...DEFAULT_DATA, foo: "bar" };
      mockStorage["trading_app_data"] = JSON.stringify(testData);

      const data = await loadData();
      expect(data.foo).toBe("bar");
      expect(localStorageMock.getItem).toHaveBeenCalledWith("trading_app_data");
    });

    it("should save to localStorage", async () => {
      const testData = { hello: "world" };
      await saveData(testData);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "trading_app_data",
        JSON.stringify(testData)
      );
    });
  });
});

