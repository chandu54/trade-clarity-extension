import React from "react";
import { describe, it, vi, beforeEach, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExportTradingViewModal from "../ExportTradingViewModal";
import { generateTradingViewExport } from "../../utils/tvExport";
import { ToastProvider } from "../ToastContext";

describe("ExportTradingViewModal & generateTradingViewExport", () => {
  const sampleStocks = {
    MOTHERSON: { symbol: "MOTHERSON", sector: "Auto", tags: ["Breakout"], watchlists: ["wl1"] },
    ATHERENERG: { symbol: "ATHERENERG", sector: "Auto", tags: ["Breakout", "LT Lead"], watchlists: ["wl1"] },
    RBLBANK: { symbol: "RBLBANK", sector: "Banks", tags: ["Momentum"], watchlists: ["wl2"] },
    UNSECTORED: { symbol: "UNSECTORED", sector: "", tags: [], watchlists: ["wl1"] },
  };

  const sampleWatchlists = [
    { id: "wl1", name: "Auto Watchlist" },
    { id: "wl2", name: "Banking Watchlist" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateTradingViewExport Logic", () => {
    it("groups stocks by sector for India (IN country code)", () => {
      const result = generateTradingViewExport({
        stocks: sampleStocks,
        selectedWlId: "all",
        groupBy: "sector",
        country: "IN",
      });

      expect(result).toContain("###AUTO,NSE:MOTHERSON,NSE:ATHERENERG");
      expect(result).toContain("###BANKS,NSE:RBLBANK");
      expect(result).toContain("###MISCELLANEOUS,NSE:UNSECTORED");
    });

    it("groups stocks by tag for India", () => {
      const result = generateTradingViewExport({
        stocks: sampleStocks,
        selectedWlId: "all",
        groupBy: "tag",
        country: "IN",
      });

      expect(result).toContain("###BREAKOUT,NSE:MOTHERSON,NSE:ATHERENERG");
      expect(result).toContain("###LT LEAD,NSE:ATHERENERG");
      expect(result).toContain("###MOMENTUM,NSE:RBLBANK");
      expect(result).toContain("###UNTAGGED,NSE:UNSECTORED");
    });

    it("exports plain list without section headers when groupBy is none", () => {
      const result = generateTradingViewExport({
        stocks: sampleStocks,
        selectedWlId: "all",
        groupBy: "none",
        country: "IN",
      });

      expect(result).toBe("NSE:MOTHERSON,NSE:ATHERENERG,NSE:RBLBANK,NSE:UNSECTORED");
      expect(result).not.toContain("###");
    });

    it("formats symbols for US market without NSE prefix", () => {
      const usStocks = {
        AAPL: { symbol: "AAPL", sector: "Tech", tags: ["Growth"], watchlists: ["wl1"] },
        TSLA: { symbol: "NASDAQ:TSLA", sector: "Auto", tags: ["Growth"], watchlists: ["wl1"] },
      };

      const resultSector = generateTradingViewExport({
        stocks: usStocks,
        selectedWlId: "all",
        groupBy: "sector",
        country: "US",
      });

      expect(resultSector).toContain("###AUTO,NASDAQ:TSLA");
      expect(resultSector).toContain("###TECH,AAPL");
      expect(resultSector).not.toContain("NSE:");

      const resultNone = generateTradingViewExport({
        stocks: usStocks,
        selectedWlId: "all",
        groupBy: "none",
        country: "US",
      });
      expect(resultNone).toBe("AAPL,NASDAQ:TSLA");
    });

    it("filters stocks based on selected watchlist", () => {
      const result = generateTradingViewExport({
        stocks: sampleStocks,
        selectedWlId: "wl2",
        groupBy: "sector",
        country: "IN",
      });

      expect(result).toBe("###BANKS,NSE:RBLBANK");
      expect(result).not.toContain("MOTHERSON");
    });
  });

  describe("ExportTradingViewModal Component UI", () => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      stocks: sampleStocks,
      watchlists: sampleWatchlists,
      selectedWatchlistId: "wl1",
      country: "IN",
    };

    it("renders modal title, watchlist selector and segmented control options", () => {
      render(
        <ToastProvider>
          <ExportTradingViewModal {...props} />
        </ToastProvider>
      );

      expect(screen.getByText("TradingView Export")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sector/i })).toHaveClass("active");
      expect(screen.getByRole("button", { name: /^Tag$/i })).not.toHaveClass("active");
      expect(screen.getByRole("button", { name: /None/i })).not.toHaveClass("active");
    });

    it("switches group by option and updates textarea content", () => {
      render(
        <ToastProvider>
          <ExportTradingViewModal {...props} />
        </ToastProvider>
      );

      const textarea = screen.getByRole("textbox");
      expect(textarea.value).toContain("###AUTO,NSE:MOTHERSON,NSE:ATHERENERG");

      fireEvent.click(screen.getByRole("button", { name: /^Tag$/i }));
      expect(textarea.value).toContain("###BREAKOUT,NSE:MOTHERSON,NSE:ATHERENERG");

      fireEvent.click(screen.getByRole("button", { name: /None/i }));
      expect(textarea.value).toBe("NSE:MOTHERSON,NSE:ATHERENERG,NSE:UNSECTORED");
    });

    it("handles copy to clipboard button click", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <ToastProvider>
          <ExportTradingViewModal {...props} />
        </ToastProvider>
      );

      const copyBtn = screen.getByRole("button", { name: /Copy to Clipboard/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("###AUTO"));
    });

    it("handles download text file button click", () => {
      const createObjectURLMock = vi.fn().mockReturnValue("blob:test");
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      render(
        <ToastProvider>
          <ExportTradingViewModal {...props} />
        </ToastProvider>
      );

      const downloadBtn = screen.getByRole("button", { name: /Download \.txt/i });
      fireEvent.click(downloadBtn);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });
});
