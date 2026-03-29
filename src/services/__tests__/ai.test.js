import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAiAnalysis, PROMPT_TEMPLATES } from "../ai";

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

    it("should throw error if API key is too short", async () => {
       const weekData = { stocks: { AAPL: { symbol: "AAPL" } }, apiKey: "123" };
       await expect(getAiAnalysis(weekData, {})).rejects.toThrow("Invalid Google API Key format");
    });

    it("should return early if no stocks are provided", async () => {
      const weekData = { stocks: {}, apiKey: "valid-gemini-api-key-that-is-long-enough" };
      const result = await getAiAnalysis(weekData, {});
      expect(result.marketBias).toContain("No stocks found");
      expect(fetchMock).not.toHaveBeenCalled();
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

  describe("API fetching (OpenAI)", () => {
    it("should call OpenAI API if key starts with sk-", async () => {
      const weekData = { 
        stocks: { AAPL: { symbol: "AAPL" } }, 
        apiKey: "sk-valid-openai-api-key-is-usually-51-characters-long",
        model: "gpt-4o"
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"marketBias": "Bullish"}' } }]
        })
      });

      const result = await getAiAnalysis(weekData, {});
      
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${weekData.apiKey}` })
        })
      );
      expect(result.marketBias).toBe("Bullish");
    });
  });

  describe("Response Parsing", () => {
    // We can't easily test private parseResponse directly without exporting it,
    // but we can test it through getAiAnalysis with mocked fetch.
    it("should extract JSON even if wrapped in markdown code blocks", async () => {
        const weekData = { 
            stocks: { AAPL: { symbol: "AAPL" } }, 
            apiKey: "valid-gemini-api-key-long-enough-39-chars"
          };
    
          fetchMock.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
              candidates: [{ content: { parts: [{ text: 'Some text before ```json\n{"marketBias": "Wrapped"}\n``` after text' }] } }]
            })
          });
    
          const result = await getAiAnalysis(weekData, {});
          expect(result.marketBias).toBe("Wrapped");
    });
  });
});
