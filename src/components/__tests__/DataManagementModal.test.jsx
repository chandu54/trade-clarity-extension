import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DataManagementModal from "../DataManagementModal";

// Mock the week helpers since they calculate dynamic dates
vi.mock("../../utils/weekHelpers", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getActualCurrentSunday: vi.fn(() => "2024-04-07"),
    getLatestWeekKey: vi.fn(() => "2024-03-31"),
    getLocalDateString: vi.fn(() => "2024-04-07"),
    getSundayOfWeek: vi.fn(() => "2024-04-07")
  };
});

describe("DataManagementModal Components", () => {
  const mockSetData = vi.fn();
  const mockSetWeekKey = vi.fn();
  const mockOnClose = vi.fn();

  const mockData = {
    weeks: {
      US: {
        "2024-04-07": { stocks: {} },
        "2024-03-31": { stocks: {} },
        "2024-03-24": { stocks: {} }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly and displays list of weeks", () => {
    render(
      <DataManagementModal
        isOpen={true}
        onClose={mockOnClose}
        data={mockData}
        setData={mockSetData}
        country="US"
        weekKey="2024-04-07"
        setWeekKey={mockSetWeekKey}
      />
    );

    expect(screen.getByText("Data Management")).toBeInTheDocument();
    expect(screen.getByText("Week: 08-04-2024 to 12-04-2024")).toBeInTheDocument();
    expect(screen.getByText("Week: 01-04-2024 to 05-04-2024")).toBeInTheDocument();
    expect(screen.getByText("Week: 25-03-2024 to 29-03-2024")).toBeInTheDocument();
  });

  it("locks the current active calendar week", () => {
    render(
      <DataManagementModal
        isOpen={true}
        onClose={mockOnClose}
        data={mockData}
        setData={mockSetData}
        country="US"
        weekKey="2024-04-07"
        setWeekKey={mockSetWeekKey}
      />
    );

    const currentWeekBadge = screen.getByText("Current Active (Locked)");
    expect(currentWeekBadge).toBeInTheDocument();

    const currentWeekRow = currentWeekBadge.closest(".data-week-row");
    expect(currentWeekRow).toHaveClass("locked");
  });

  it("allows selecting multiple historic weeks", () => {
    render(
      <DataManagementModal
        isOpen={true}
        onClose={mockOnClose}
        data={mockData}
        setData={mockSetData}
        country="US"
        weekKey="2024-04-07"
        setWeekKey={mockSetWeekKey}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /Delete Selected/i });
    expect(deleteBtn).toBeDisabled();

    // Select the historic week
    const historicWeek = screen.getByText("Week: 01-04-2024 to 05-04-2024");
    fireEvent.click(historicWeek.closest(".data-week-row"));

    expect(deleteBtn).not.toBeDisabled();
    expect(screen.getByText(/Delete Selected \(1\)/i)).toBeInTheDocument();
  });

  it("blocks deletion unless confirmation phrase is typed exactly", () => {
    render(
      <DataManagementModal
        isOpen={true}
        onClose={mockOnClose}
        data={mockData}
        setData={mockSetData}
        country="US"
        weekKey="2024-04-07"
        setWeekKey={mockSetWeekKey}
      />
    );

    // Select week and hit delete
    fireEvent.click(screen.getByText("Week: 01-04-2024 to 05-04-2024").closest(".data-week-row"));
    fireEvent.click(screen.getByRole("button", { name: /Delete Selected/i }));

    // Expect Danger Zone
    expect(screen.getByText("⚠️ Danger Zone")).toBeInTheDocument();

    const permanentDeleteBtn = screen.getByRole("button", { name: /Permanently Delete/i });
    expect(permanentDeleteBtn).toBeDisabled();

    // Type incorrect phrase
    const input = screen.getByPlaceholderText("delete US data");
    fireEvent.change(input, { target: { value: "delete" } });
    expect(permanentDeleteBtn).toBeDisabled();

    // Type correct phrase
    fireEvent.change(input, { target: { value: "delete US data" } });
    expect(permanentDeleteBtn).not.toBeDisabled();

    // Execute Delete
    fireEvent.click(permanentDeleteBtn);
    expect(mockSetData).toHaveBeenCalled();
  });
});
