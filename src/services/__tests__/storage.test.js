import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadData, saveData, getDrawingsForSymbol, saveDrawingForSymbol, deleteDrawingForSymbol, clearDrawingsForSymbol } from "../storage";
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

    it("should throw error if JSON in localStorage is malformed (negative scenario)", async () => {
      mockStorage["trading_app_data"] = "{malformed-json";
      await expect(loadData()).rejects.toThrow();
    });
  });

  describe("Negative Scenarios - Storage Failures", () => {
    beforeEach(() => {
      restoreChrome = stubGlobal("chrome", {
        storage: {
          local: {
            get: vi.fn((key, cb) => cb({})),
            set: vi.fn((data, cb) => {
              // Mock runtime.lastError presence
              chrome.runtime.lastError = { message: "Quota exceeded" };
              if (cb) cb();
            })
          }
        },
        runtime: {}
      });
      restoreLocalStorage = stubGlobal("localStorage", localStorageMock);
    });

    afterEach(() => {
      restoreChrome();
      restoreLocalStorage();
    });

    it("should handle chrome storage set callback when write limits are exceeded", async () => {
      const testData = { hello: "limit" };
      await saveData(testData);
      expect(chrome.runtime.lastError.message).toBe("Quota exceeded");
    });
  });

  describe("Global Chart Drawings Storage", () => {
    beforeEach(() => {
      restoreChrome = stubGlobal("chrome", undefined);
      restoreLocalStorage = stubGlobal("localStorage", localStorageMock);
    });

    afterEach(() => {
      restoreChrome();
      restoreLocalStorage();
    });

    it("should save, retrieve, delete, and clear global drawings by symbol", async () => {
      const symbol = "AARTIPHARM";
      const initial = await getDrawingsForSymbol(symbol);
      expect(initial).toEqual([]);

      const line1 = { id: "h1", type: "horizontal", price: 650, color: "#ef4444", width: 2 };
      const saved1 = await saveDrawingForSymbol(symbol, line1);
      expect(saved1).toEqual([line1]);

      const line2 = { id: "t1", type: "trend", p1: { time: 100, price: 600 }, p2: { time: 200, price: 650 } };
      await saveDrawingForSymbol(symbol, line2);

      const retrieved = await getDrawingsForSymbol(symbol);
      expect(retrieved.length).toBe(2);

      const remaining = await deleteDrawingForSymbol(symbol, "h1");
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("t1");

      const cleared = await clearDrawingsForSymbol(symbol);
      expect(cleared).toEqual([]);
    });
  });
});

