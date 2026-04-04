import { describe, it, expect } from "vitest";
import { mapLiquidityBucket, mapAdrBucket } from "../metrics";

describe("mapAdrBucket", () => {
  it("should format as number if type is number", () => {
    const adrDef = { type: "number" };
    expect(mapAdrBucket(5.678, adrDef)).toBe("5.68");
  });

  it("should match closest select option", () => {
    const adrDef = { type: "select", options: ["1", "3", "5", "10"] };
    expect(mapAdrBucket(2.6, adrDef)).toBe("3");
    expect(mapAdrBucket(8, adrDef)).toBe("10");
  });

  it("should fallback to range 1-10 if no definition provided", () => {
    expect(mapAdrBucket(15, null)).toBe(10);
    expect(mapAdrBucket(0, null)).toBe(1);
    expect(mapAdrBucket(5.4, null)).toBe(5);
  });
});

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
    expect(mapLiquidityBucket(150000000, numberDef, "IN")).toBe("15.00Cr");
    // US uses Million divisor instead of Crore
    expect(mapLiquidityBucket(150000000, numberDef, "US")).toBe("150.00M"); 
  });

  it("should fallback to hardcoded buckets if no liqDef provided for IN", () => {
    expect(mapLiquidityBucket(150000000, null, "IN")).toBe("<=20Cr");
    expect(mapLiquidityBucket(3500000000, null, "IN")).toBe("200Cr to 499Cr");
  });

  it("should fallback to millions for US if no liqDef provided", () => {
    expect(mapLiquidityBucket(150000000, null, "US")).toBe("150.00M");
  });
});

