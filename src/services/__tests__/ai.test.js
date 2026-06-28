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
      const weekData = { stocks: { AAPL: { symbol: "AAPL" } } };
      await expect(getAiAnalysis("", "", weekData, {})).rejects.toThrow("API Key is missing");
    });

    it("should return early if no stocks are provided", async () => {
      const apiKey = "valid-gemini-api-key-that-is-long-enough";
      const weekData = { stocks: {} };
      const result = await getAiAnalysis(apiKey, "model", weekData, {});
      expect(result.marketBias).toContain("No stocks found");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should handle custom requests correctly", async () => {
      const apiKey = "valid-gemini-api-key-long-enough-39-chars";
      const weekData = { 
        stocks: { AAPL: { symbol: "AAPL" } }
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: "Custom Response" }] } }]
        })
      });

      const result = await getAiAnalysis(apiKey, "model", weekData, {}, "Analyze this", true);
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

    it("should call Gemini API with correct payload", async () => {
      const apiKey = "valid-gemini-api-key-long-enough-39-chars";
      const model = "gemini-1.5-pro";
      const weekData = { 
        stocks: { AAPL: { symbol: "AAPL", sector: "Tech" } }
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"marketBias": "Positive"}' }] } }]
        })
      });

      const result = await getAiAnalysis(apiKey, model, weekData, {});
      
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("generativelanguage.googleapis.com"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-goog-api-key": apiKey })
        })
      );
      expect(result.marketBias).toBe("Positive");
    });

  describe("Negative & Error Handling Scenarios", () => {
    const apiKey = "valid-gemini-api-key-long-enough-39-chars";
    const weekData = { 
      stocks: { AAPL: { symbol: "AAPL", sector: "Tech" } }
    };

    it("should throw error when API returns HTTP error status (e.g. 403 Forbidden)", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve({
          error: { message: "API key not valid." }
        })
      });

      await expect(getAiAnalysis(apiKey, "gemini-1.5-pro", weekData, {}))
        .rejects.toThrow("API key not valid.");
    });

    it("should throw error when Gemini returns empty parts text", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{}] } }]
        })
      });

      await expect(getAiAnalysis(apiKey, "gemini-1.5-pro", weekData, {}))
        .rejects.toThrow("Empty response from Gemini");
    });

    it("should handle request timeout AbortError correctly", async () => {
      const abortError = new Error("The AI request timed out. Please try again.");
      abortError.name = "AbortError";
      fetchMock.mockRejectedValueOnce(abortError);

      await expect(getAiAnalysis(apiKey, "gemini-1.5-pro", weekData, {}))
        .rejects.toThrow("The AI request timed out");
    });
  });
});

