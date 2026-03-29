import { describe, it, expect } from "vitest";
import { 
  getLatestWeekKey, 
  isWeekReadOnly, 
  getLocalDateString, 
  getSundayOfWeek 
} from "../weekHelpers";

describe("weekHelpers", () => {
  describe("getLatestWeekKey", () => {
    it("should return the latest key alphabetically", () => {
      const weeks = {
        "2024-03-10": {},
        "2024-03-17": {},
        "2024-03-03": {}
      };
      expect(getLatestWeekKey(weeks)).toBe("2024-03-17");
    });

    it("should return null for empty or null input", () => {
      expect(getLatestWeekKey(null)).toBe(null);
      expect(getLatestWeekKey({})).toBe(null);
    });
  });

  describe("getLocalDateString", () => {
    it("should format date correctly as YYYY-MM-DD", () => {
      const date = new Date(2024, 2, 25); // March 25, 2024
      expect(getLocalDateString(date)).toBe("2024-03-25");
    });
  });

  describe("getSundayOfWeek", () => {
    it("should return the previous Sunday for a Monday", () => {
      // 2024-03-25 is a Monday. Previous Sunday is 2024-03-24
      expect(getSundayOfWeek("2024-03-25")).toBe("2024-03-24");
    });

    it("should return the previous Sunday for a Sunday", () => {
      // 2024-03-24 is a Sunday. Anchor is 2024-03-17 (per logic in code)
      // Note: your code uses: diff = date.getDate() - (day === 0 ? 7 : day);
      // For Sunday (day=0), it subtracts 7 days.
      expect(getSundayOfWeek("2024-03-24")).toBe("2024-03-17");
    });
  });

  describe("isWeekReadOnly", () => {
    it("should return true if week is before current week", () => {
      expect(isWeekReadOnly("2024-03-10", "2024-03-17", {})).toBe(true);
    });

    it("should return false if week is current week or after", () => {
      expect(isWeekReadOnly("2024-03-17", "2024-03-17", {})).toBe(false);
      expect(isWeekReadOnly("2024-03-24", "2024-03-17", {})).toBe(false);
    });

    it("should return false if lockPreviousWeeks is disabled", () => {
      const uiConfig = { lockPreviousWeeks: false };
      expect(isWeekReadOnly("2024-03-10", "2024-03-17", uiConfig)).toBe(false);
    });
  });
});
