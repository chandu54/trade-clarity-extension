import { describe, it, expect, vi } from "vitest";
import { enrichStockMetadataAI } from "../ai";

describe("enrichStockMetadataAI service", () => {
  it("returns null if apiKey or symbol is missing", async () => {
    const res1 = await enrichStockMetadataAI(null, "gemini-2.5-flash", "ITC");
    expect(res1).toBeNull();

    const res2 = await enrichStockMetadataAI("key-123456789012345678901234567890", "gemini-2.5-flash", "");
    expect(res2).toBeNull();
  });

  it("handles AI response correctly", async () => {
    const fakeApiKey = "AIzaSyDummyApiKeyForUnitTesting12345";
    
    // Mock global fetch
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  businessScope: ["Cigarettes", "Packaged Foods", "Hotels"],
                  dependentIndustries: ["Consumer Staples", "Hospitality"]
                })
              }
            ]
          }
        }
      ]
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    }));

    const result = await enrichStockMetadataAI(fakeApiKey, "gemini-2.5-flash", "ITC", "ITC Limited", "FMCG");
    
    expect(result).not.toBeNull();
    expect(result.businessScope).toEqual(["Cigarettes", "Packaged Foods", "Hotels"]);
    expect(result.dependentIndustries).toEqual(["Consumer Staples", "Hospitality"]);

    vi.unstubAllGlobals();
  });
});
