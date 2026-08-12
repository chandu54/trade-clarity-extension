import { describe, it, expect } from "vitest";
import {
  evaluateVCPTightnessFromCandles,
  VCPTightnessCategory,
} from "../calculateVcpTightness";

describe("VCP Tightness Analysis Module", () => {
  it("handles null, empty, or invalid candle arrays gracefully", () => {
    expect(evaluateVCPTightnessFromCandles([] as any)).toEqual({
      category: VCPTightnessCategory.WIDE,
      tightnessPct: 0,
      displayText: "Unknown",
      isTight: false,
    });
    expect(evaluateVCPTightnessFromCandles(null as any)).toEqual({
      category: VCPTightnessCategory.WIDE,
      tightnessPct: 0,
      displayText: "Unknown",
      isTight: false,
    });
  });

  it("correctly classifies tight consolidation (< 4.0%)", () => {
    // 10D High = 102, 10D Low = 100 -> (2 / 100) * 100 = 2.0%
    const candles = Array.from({ length: 10 }, (_, i) => ({
      high: 100 + (i % 3),
      low: 100,
    }));
    const res = evaluateVCPTightnessFromCandles(candles);
    expect(res.tightnessPct).toBe(2.0);
    expect(res.category).toBe(VCPTightnessCategory.TIGHT);
    expect(res.displayText).toBe("Tight (2%)");
    expect(res.isTight).toBe(true);
  });

  it("correctly classifies moderate consolidation (4.0% - 7.0%)", () => {
    // 10D High = 105, 10D Low = 100 -> (5 / 100) * 100 = 5.0%
    const candles = Array.from({ length: 10 }, (_, i) => ({
      high: 100 + (i % 6),
      low: 100,
    }));
    const res = evaluateVCPTightnessFromCandles(candles);
    expect(res.tightnessPct).toBe(5.0);
    expect(res.category).toBe(VCPTightnessCategory.MODERATE);
    expect(res.displayText).toBe("Moderate (5%)");
    expect(res.isTight).toBe(false);
  });

  it("correctly classifies wide/loose consolidation (> 7.0%)", () => {
    // 10D High = 112, 10D Low = 100 -> (12 / 100) * 100 = 12.0%
    const candles = Array.from({ length: 10 }, (_, i) => ({
      high: 100 + i,
      low: 100,
    }));
    const res = evaluateVCPTightnessFromCandles(candles);
    expect(res.tightnessPct).toBe(9.0);
    expect(res.category).toBe(VCPTightnessCategory.WIDE);
    expect(res.displayText).toBe("Wide (9%)");
    expect(res.isTight).toBe(false);
  });
});
