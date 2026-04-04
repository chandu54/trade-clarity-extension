import { describe, it, expect } from "vitest";
import { getActualParamKeyAndDef } from "../paramUtils";

describe("getActualParamKeyAndDef", () => {
  const mockDefs = {
    "adr": { label: "Global ADR", countries: [] },
    "in.adr": { label: "ADR", countries: ["IN"] },
    "us.adr": { label: "ADR", countries: ["US"] },
    "liquidity": { label: "Liquidity", countries: [] },
    "in.liquidity": { label: "Liquidity", countries: ["IN"] },
    "custom.param": { label: "Custom", countries: ["US"] }
  };

  it("should match country-prefixed key for US stocks (adr)", () => {
    const result = getActualParamKeyAndDef(mockDefs, "adr", "adr", "US");
    expect(result.key).toBe("us.adr");
    expect(result.def.countries).toContain("US");
  });

  it("should match country-prefixed key for Indian stocks (adr)", () => {
    const result = getActualParamKeyAndDef(mockDefs, "adr", "adr", "IN");
    expect(result.key).toBe("in.adr");
    expect(result.def.countries).toContain("IN");
  });

  it("should match country-prefixed key for Indian stocks (liquidity)", () => {
    const result = getActualParamKeyAndDef(mockDefs, "liquidity", "liquidity", "IN");
    expect(result.key).toBe("in.liquidity");
    expect(result.def.countries).toContain("IN");
  });

  it("should fallback to exact key if country-specific is missing", () => {
    // requesting 'liquidity' for US, but 'us.liquidity' is missing in mockDefs
    const result = getActualParamKeyAndDef(mockDefs, "liquidity", "liquidity", "US");
    expect(result.key).toBe("liquidity");
  });

  it("should match by label if exact key is missing", () => {
    // searching for label 'Custom' for US
    const result = getActualParamKeyAndDef(mockDefs, "missing_key", "Custom", "US");
    expect(result.key).toBe("custom.param");
  });

  it("should respect country relevance when matching by label", () => {
    // Definitions with same label but different countries
    const labelDefs = {
      "p1": { label: "Shared", countries: ["IN"] },
      "p2": { label: "Shared", countries: ["US"] }
    };

    const resUS = getActualParamKeyAndDef(labelDefs, "none", "Shared", "US");
    expect(resUS.key).toBe("p2");

    const resIN = getActualParamKeyAndDef(labelDefs, "none", "Shared", "IN");
    expect(resIN.key).toBe("p1");
  });

  it("should return null def if no match found", () => {
    const result = getActualParamKeyAndDef(mockDefs, "missing", "NonExistent", "US");
    expect(result.key).toBe("missing");
    expect(result.def).toBeNull();
  });
});
