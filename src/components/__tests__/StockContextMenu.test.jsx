import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StockContextMenu from "../StockContextMenu";

describe("StockContextMenu Component", () => {
  const mockStock = {
    symbol: "TCS",
    tradable: true,
    flagColor: "blue",
    watchlists: ["wl_breakouts"],
  };

  const mockWatchlists = [
    { id: "wl_breakouts", name: "Breakout Candidates" },
    { id: "wl_leaders", name: "Market Leaders" },
  ];

  const defaultProps = {
    isOpen: true,
    x: 150,
    y: 200,
    stock: mockStock,
    country: "IN",
    watchlists: mockWatchlists,
    onClose: vi.fn(),
    onToggleWatchlist: vi.fn(),
    onSelectFlagColor: vi.fn(),
    onToggleTradable: vi.fn(),
    onCopySymbol: vi.fn(),
    onOpenTradingView: vi.fn(),
    onQuickLog: vi.fn(),
    onAnalyzeStock: vi.fn(),
    onEditStock: vi.fn(),
    onDeleteStock: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly when open with stock symbol and actions", () => {
    render(<StockContextMenu {...defaultProps} />);

    expect(screen.getByText("TCS")).toBeInTheDocument();
    expect(screen.getByText("TRADABLE")).toBeInTheDocument();
    expect(screen.getByText("Watchlists")).toBeInTheDocument();
    expect(screen.getByText("Set Flag")).toBeInTheDocument();
    expect(screen.getByText("Apply Tags")).toBeInTheDocument();
    expect(screen.getByText("Copy Symbol")).toBeInTheDocument();
    expect(screen.getByText("TradingView Chart")).toBeInTheDocument();
    expect(screen.getByText("Log to Journal")).toBeInTheDocument();
    expect(screen.getByText("Edit Details")).toBeInTheDocument();
    expect(screen.getByText("Remove Stock")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(<StockContextMenu {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onCopySymbol when Copy Symbol is clicked", () => {
    render(<StockContextMenu {...defaultProps} />);
    const copyBtn = screen.getByText("Copy Symbol");
    fireEvent.click(copyBtn);

    expect(defaultProps.onCopySymbol).toHaveBeenCalledWith("TCS");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onToggleTradable when Tradable option is clicked", () => {
    render(<StockContextMenu {...defaultProps} />);
    const tradableOption = screen.getByText("Mark as Untradable");
    fireEvent.click(tradableOption);

    expect(defaultProps.onToggleTradable).toHaveBeenCalledWith("TCS");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("handles keyboard shortcuts (Escape, C, T, O, L)", () => {
    render(<StockContextMenu {...defaultProps} />);

    // Test 'C' shortcut
    fireEvent.keyDown(document, { key: "c" });
    expect(defaultProps.onCopySymbol).toHaveBeenCalledWith("TCS");

    // Test 'T' shortcut
    fireEvent.keyDown(document, { key: "t" });
    expect(defaultProps.onToggleTradable).toHaveBeenCalledWith("TCS");

    // Test 'O' shortcut
    fireEvent.keyDown(document, { key: "o" });
    expect(defaultProps.onOpenTradingView).toHaveBeenCalledWith("TCS", "IN");

    // Test 'L' shortcut
    fireEvent.keyDown(document, { key: "l" });
    expect(defaultProps.onQuickLog).toHaveBeenCalledWith("TCS");

    // Test 'Escape' shortcut
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("opens watchlist flyout on hover and toggles a watchlist", () => {
    render(<StockContextMenu {...defaultProps} />);
    const watchlistTrigger = screen.getByText("Watchlists").closest(".context-menu-item");
    fireEvent.mouseEnter(watchlistTrigger);

    expect(screen.getByText("Add to Watchlist")).toBeInTheDocument();
    expect(screen.getByText("Market Leaders")).toBeInTheDocument();

    const leadersItem = screen.getByText("Market Leaders");
    fireEvent.click(leadersItem);

    expect(defaultProps.onToggleWatchlist).toHaveBeenCalledWith("TCS", "wl_leaders");
  });

  it("opens flag flyout and selects a color", () => {
    render(<StockContextMenu {...defaultProps} />);
    const flagTrigger = screen.getByText("Set Flag").closest(".context-menu-item");
    fireEvent.mouseEnter(flagTrigger);

    expect(screen.getByText("Pick Flag Color")).toBeInTheDocument();
    const greenFlag = screen.getByTitle("GREEN Flag");
    fireEvent.click(greenFlag);

    expect(defaultProps.onSelectFlagColor).toHaveBeenCalledWith("TCS", "green");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("opens tags flyout and calls onToggleTag when a tag is clicked", () => {
    const onToggleTag = vi.fn();
    render(
      <StockContextMenu
        {...defaultProps}
        availableTags={["VCP Breakout", "Earnings Beat"]}
        onToggleTag={onToggleTag}
      />
    );
    const tagsTrigger = screen.getByText("Apply Tags").closest(".context-menu-item");
    fireEvent.mouseEnter(tagsTrigger);

    expect(screen.getByText("VCP Breakout")).toBeInTheDocument();
    const tagItem = screen.getByText("VCP Breakout");
    fireEvent.click(tagItem);

    expect(onToggleTag).toHaveBeenCalledWith("TCS", "VCP Breakout");
  });
});
