import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StockRow } from "../StockRow";

describe("StockRow component", () => {
  const defaultStock = {
    symbol: "NVDA",
    tradable: true,
    flagColor: "blue",
    tags: ["Momentum", "AI:Leader"],
    sector: "Technology",
    notes: "Watch for breakout above $140",
    businessScope: ["GPUs", "Data Centers"],
    dependentIndustries: ["Semiconductors", "Cloud"],
    macroTheme: "Artificial Intelligence",
    params: {
      eps_growth: 45,
      movingAverages: "Above all (10/20/50)",
    },
  };

  const defaultProps = {
    stock: defaultStock,
    rowIndex: 0,
    totalStocks: 10,
    quote: { currentPrice: 135.5, dailyChangePct: 3.25, isAdvancing: true },
    country: "US",
    isReadOnly: false,
    sectors: ["Technology", "Healthcare", "Financials"],
    visibleParams: [["eps_growth", { type: "number", label: "EPS Growth" }]],
    availableTags: ["Momentum", "Breakout", "Earnings"],
    showLivePrice: true,
    showTags: true,
    showBusinessScope: true,
    showDependentIndustries: true,
    showMacroTheme: true,
    showNotes: true,
    isTagDropdownActive: false,
    isFlagMenuActive: false,
    onToggleTagDropdown: vi.fn(),
    onToggleFlagMenu: vi.fn(),
    onSelectFlagColor: vi.fn(),
    onEditStock: vi.fn(),
    onQuickLog: vi.fn(),
    onAddTag: vi.fn(),
    onRemoveTag: vi.fn(),
    onUpdateField: vi.fn(),
    onUpdateParam: vi.fn(),
    onDeleteStock: vi.fn(),
  };

  const renderWithTable = (props = {}) => {
    return render(
      <table>
        <tbody>
          <StockRow {...defaultProps} {...props} />
        </tbody>
      </table>
    );
  };

  it("renders stock symbol, live price, sector, and notes correctly", () => {
    renderWithTable();

    expect(screen.getByText("NVDA")).toBeInTheDocument();
    expect(screen.getByText("$135.50")).toBeInTheDocument();
    expect(screen.getByText("+3.25%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Technology")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Watch for breakout above $140")).toBeInTheDocument();
  });

  it("calls onEditStock when symbol is clicked in editable mode", () => {
    renderWithTable();
    fireEvent.click(screen.getByText("NVDA"));
    expect(defaultProps.onEditStock).toHaveBeenCalledWith(defaultStock);
  });

  it("calls onUpdateField when sector changes", () => {
    renderWithTable();
    const select = screen.getByDisplayValue("Technology");
    fireEvent.change(select, { target: { value: "Healthcare" } });
    expect(defaultProps.onUpdateField).toHaveBeenCalledWith("NVDA", "sector", "Healthcare");
  });

  it("calls onDeleteStock when trash button is clicked", () => {
    renderWithTable();
    const deleteBtn = screen.getByTitle("Delete stock");
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteStock).toHaveBeenCalledWith("NVDA");
  });

  it("disables inputs and buttons in read-only mode", () => {
    renderWithTable({ isReadOnly: true });

    const select = screen.getByDisplayValue("Technology");
    expect(select).toBeDisabled();

    const notesInput = screen.getByDisplayValue("Watch for breakout above $140");
    expect(notesInput).toBeDisabled();

    const deleteBtn = screen.getByTitle("Read-only week");
    expect(deleteBtn).toBeDisabled();
  });
});
