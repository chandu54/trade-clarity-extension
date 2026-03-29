import { describe, it, expect } from "vitest";
import { mapLiquidityBucket } from "../metrics";

describe("mapLiquidityBucket", () => {
  const commonLiqDef = {
    type: "select",
    options: ["<=20Cr", "21 to 49Cr", "50 to 99Cr", "100Cr to 199Cr", "200Cr to 499Cr", "500Cr+", "1000Cr+", "1500Cr+", "2000Cr+"]
  };

  it("should match isLessThan thresholds correctly", () => {
    // 15 Cr = 150000000 liquidity
    expect(mapLiquidityBucket(150000000, commonLiqDef, "IN")).toBe("<=20Cr");
  });

  it("should match ranges correctly", () => {
    // 350 Cr = 3500000000 liquidity
    expect(mapLiquidityBucket(3500000000, commonLiqDef, "IN")).toBe("200Cr to 499Cr");
  });

  it("should ascend isGreaterThan correctly and not break early", () => {
    // Large Input 1: 1457 Cr
    expect(mapLiquidityBucket(14570000000, commonLiqDef, "IN")).toBe("1000Cr+");
    // Large Input 2: 4763 Cr
    expect(mapLiquidityBucket(47630000000, commonLiqDef, "IN")).toBe("2000Cr+");
    // Standard Input: 1590 Cr
    expect(mapLiquidityBucket(15900000000, commonLiqDef, "IN")).toBe("1500Cr+");
  });

  it("should fallback to number formatted if type is number", () => {
    const numberDef = { type: "number" };
    expect(mapLiquidityBucket(150000000, numberDef, "IN")).toBe("15.00");
    // US uses Million divisor instead of Crore
    expect(mapLiquidityBucket(150000000, numberDef, "US")).toBe("150.00"); 
  });

  it("should fallback locally if no options matching applied", () => {
    // Provide a generic array without specific matches
    const nonMatchDef = {
      type: "select",
      options: ["Penny", "Mid", "Large"] 
    };
    // It should pick the first limit which parses to Infinity since they all tie
    expect(mapLiquidityBucket(150000000, nonMatchDef, "IN")).toBe("Penny");
  });
});
