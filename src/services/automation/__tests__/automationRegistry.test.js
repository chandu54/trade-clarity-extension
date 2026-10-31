import { describe, it, expect } from "vitest";
import {
  AUTOMATION_TASKS,
  getAutomationsForCountry,
  getAutomationById,
} from "../automationRegistry";

describe("automationRegistry", () => {
  it("registers both chartink and ipo radar automations", () => {
    expect(AUTOMATION_TASKS.length).toBeGreaterThanOrEqual(2);
    const ids = AUTOMATION_TASKS.map((t) => t.id);
    expect(ids).toContain("chartink_scanner");
    expect(ids).toContain("ipo_radar_prep");
  });

  it("filters automations strictly by country", () => {
    const inAutomations = getAutomationsForCountry("IN");
    const inIds = inAutomations.map((t) => t.id);
    expect(inIds).toContain("chartink_scanner");
    expect(inIds).toContain("ipo_radar_prep");

    const usAutomations = getAutomationsForCountry("US");
    const usIds = usAutomations.map((t) => t.id);
    expect(usIds).not.toContain("chartink_scanner"); // Chartink is India only!
    expect(usIds).toContain("ipo_radar_prep"); // IPO Radar supports US!
  });

  it("retrieves task by ID and has valid stage arrays and default criteria", () => {
    const chartink = getAutomationById("chartink_scanner");
    expect(chartink).not.toBeNull();
    expect(chartink.stages.length).toBe(5);
    expect(chartink.stages[3]).toBe("4. Candle & Technical Hydration");
    expect(chartink.defaultCriteria).toBeDefined();
    expect(chartink.defaultCriteria.minLiquidity).toBe(50);
    expect(chartink.defaultCriteria.targetWatchlistId).toBe("wl_default");

    const ipo = getAutomationById("ipo_radar_prep");
    expect(ipo).not.toBeNull();
    expect(ipo.stages.length).toBe(4);
    expect(ipo.stages[2]).toBe("3. Candle & Technical Hydration");
    expect(ipo.defaultCriteria.targetWatchlistId).toBe("wl_ipo");
    expect(ipo.defaultCriteria.minAdr).toBe(0);
    expect(ipo.defaultCriteria.minLiquidity).toBe(50);
  });
});
