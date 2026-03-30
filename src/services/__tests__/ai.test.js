import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAiAnalysis, testConnection, PROMPT_TEMPLATES } from "../ai";

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("ai service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAiAnalysis", () => {
    it("should throw error if API key is missing", async () => {
      const weekData = { stocks: { AAPL: { symbol: "AAPL" } }, apiKey: "" };
      await expect(getAiAnalysis(weekData, {})).rejects.toThrow("API Key is missing");
    });

    it("should return early if no stocks are provided", async () => {
      const weekData = { stocks: {}, apiKey: "valid-gemini-api-key-that-is-long-enough" };
      const result = await getAiAnalysis(weekData, {});
      expect(result.marketBias).toContain("No stocks found");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should handle custom requests correctly", async () => {
      const weekData = { 
        stocks: { AAPL: { symbol: "AAPL" } }, 
        apiKey: "valid-gemini-api-key-long-enough-39-chars" 
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: "Custom Response" }] } }]
        })
      });

      const result = await getAiAnalysis(weekData, {}, "Analyze this", true);
      expect(result.isCustom).toBe(true);
      expect(result.rawText).toBe("Custom Response");
    });
  });

  describe("testConnection", () => {
    it("should call Gemini correctly for testing", async () => {
      const apiKey = "valid-gemini-api-key-long-enough-39-chars";
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"status": "OK"}' }] } }]
        })
      });

      const result = await testConnection(apiKey, "gemini-model");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("gemini-model"),
        expect.any(Object)
      );
      expect(result.status).toBe("OK");
    });

    it("should throw error if key is empty", async () => {
      await expect(testConnection("", "model")).rejects.toThrow("API Key is required");
    });
  });

  describe("API fetching (Gemini)", () => {
    it("should call Gemini API with correct payload", async () => {
      const weekData = { 
        stocks: { AAPL: { symbol: "AAPL", sector: "Tech" } }, 
        apiKey: "valid-gemini-api-key-long-enough-39-chars",
        model: "gemini-1.5-pro"
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"marketBias": "Positive"}' }] } }]
        })
      });

      const result = await getAiAnalysis(weekData, {});
      
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("generativelanguage.googleapis.com"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-goog-api-key": weekData.apiKey })
        })
      );
      expect(result.marketBias).toBe("Positive");
    });
  });
});

