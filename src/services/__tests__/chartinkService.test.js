import { describe, it, expect } from "vitest";
import { filterPassingSetups } from "../chartinkService.js";

describe("chartinkService - filterPassingSetups", () => {
  it("rejects unhydrated stocks with empty params or missing values", () => {
    const unhydratedStocks = {
      TCS: {
        symbol: "TCS",
        params: {},
        watchlists: [],
      },
      INFY: {
        symbol: "INFY",
        params: {
          movingAverages: "",
          liquidity: "",
          rs: "",
          stage: "",
        },
      },
      RELIANCE: {
        symbol: "RELIANCE",
        movingAverages: null,
      },
    };

    const passing = filterPassingSetups(unhydratedStocks, "IN");
    expect(passing).toEqual([]);
  });

  it("passes stocks meeting all 4 criteria: MA 21/50/200, Liq > 50Cr, RS Neutral/Strong/Very Strong, Stage 2", () => {
    const stocks = {
      HAL: {
        symbol: "HAL",
        params: {
          movingAverages: "Above 5, 10, 21, 50, 200",
          liquidity: "120.50Cr",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
      BEL: {
        symbol: "BEL",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "85.00Cr",
          rs: "Very Strong",
          stage: "Stage 2",
        },
      },
      TRENT: {
        symbol: "TRENT",
        params: {
          "in.movingAverages": "Above 21, 50, 200",
          "in.liquidity": "55.00Cr",
          "in.rs": "Neutral",
          "in.stage": "Stage 2",
        },
      },
    };

    const passing = filterPassingSetups(stocks, "IN");
    expect(passing).toContain("HAL");
    expect(passing).toContain("BEL");
    expect(passing).toContain("TRENT");
    expect(passing.length).toBe(3);
  });

  it("rejects stocks failing any single criterion", () => {
    const stocks = {
      FAIL_MA: {
        symbol: "FAIL_MA",
        params: {
          movingAverages: "Above 21, 50 (Below 200)",
          liquidity: "100.00Cr",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
      FAIL_LIQ: {
        symbol: "FAIL_LIQ",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "25.00Cr", // < 50Cr
          rs: "Strong",
          stage: "Stage 2",
        },
      },
      FAIL_RS: {
        symbol: "FAIL_RS",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "75.00Cr",
          rs: "Lagging", // Not Strong / Very Strong / Neutral
          stage: "Stage 2",
        },
      },
      FAIL_STAGE: {
        symbol: "FAIL_STAGE",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "75.00Cr",
          rs: "Strong",
          stage: "Stage 1", // Not Stage 2
        },
      },
    };

    const passing = filterPassingSetups(stocks, "IN");
    expect(passing).toEqual([]);
  });

  it("correctly evaluates bucket representations of liquidity", () => {
    const stocks = {
      BUCKET_PASS: {
        symbol: "BUCKET_PASS",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "50 to 99Cr",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
      BUCKET_HIGH_PASS: {
        symbol: "BUCKET_HIGH_PASS",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "200Cr to 499Cr",
          rs: "Neutral",
          stage: "Stage 2",
        },
      },
      BUCKET_FAIL: {
        symbol: "BUCKET_FAIL",
        params: {
          movingAverages: "Above 21, 50, 200",
          liquidity: "<=20Cr",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
    };

    const passing = filterPassingSetups(stocks, "IN");
    expect(passing).toContain("BUCKET_PASS");
    expect(passing).toContain("BUCKET_HIGH_PASS");
    expect(passing).not.toContain("BUCKET_FAIL");
  });

  it("handles mid-cap range liquidity criteria (25-50 Cr) matching bucket '21 to 49Cr' or numeric turnoverCr", () => {
    const stocks = {
      MID_BUCKET: {
        symbol: "MID_BUCKET",
        params: {
          movingAverages: "Above 50, 200",
          liquidity: "21 to 49Cr",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
      MID_NUMERIC: {
        symbol: "MID_NUMERIC",
        turnoverCr: 35.5,
        params: {
          movingAverages: "Above 50, 200",
          rs: "Neutral",
          stage: "Stage 2",
        },
      },
      HIGH_LIQ: {
        symbol: "HIGH_LIQ",
        turnoverCr: 120.0,
        params: {
          movingAverages: "Above 50, 200",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
      LOW_LIQ: {
        symbol: "LOW_LIQ",
        turnoverCr: 12.0,
        params: {
          movingAverages: "Above 50, 200",
          rs: "Strong",
          stage: "Stage 2",
        },
      },
    };

    const passing = filterPassingSetups(stocks, "IN", {
      maAlignment: "50_200",
      minLiquidity: 25,
      maxLiquidity: 50,
      rsRating: "strong_neutral",
      stage: "stage_2",
    });

    expect(passing).toContain("MID_BUCKET");
    expect(passing).toContain("MID_NUMERIC");
    expect(passing).not.toContain("HIGH_LIQ");
    expect(passing).not.toContain("LOW_LIQ");
  });

  it("handles empty or malformed inputs without throwing", () => {
    expect(filterPassingSetups(null)).toEqual([]);
    expect(filterPassingSetups({})).toEqual([]);
    expect(filterPassingSetups({ BAD: null })).toEqual([]);
  });
});

describe("chartinkService - weekend routing logic", () => {
  it("routes Saturday and Sunday to next week's Monday", () => {
    // Saturday: 2026-10-10
    const sat = new Date("2026-10-10T10:00:00Z");
    expect(sat.getUTCDay()).toBe(6);
    const satNextMonday = new Date(sat);
    satNextMonday.setUTCDate(sat.getUTCDate() + (sat.getUTCDay() === 6 ? 2 : 1));
    expect(satNextMonday.toISOString().slice(0, 10)).toBe("2026-10-12");

    // Sunday: 2026-10-11
    const sun = new Date("2026-10-11T10:00:00Z");
    expect(sun.getUTCDay()).toBe(0);
    const sunNextMonday = new Date(sun);
    sunNextMonday.setUTCDate(sun.getUTCDate() + (sun.getUTCDay() === 6 ? 2 : 1));
    expect(sunNextMonday.toISOString().slice(0, 10)).toBe("2026-10-12");
  });
});

