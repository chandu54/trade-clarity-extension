import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ConfirmProvider, useConfirm } from "../ConfirmContext";

const TestComponent = () => {
  const { confirm } = useConfirm();
  const [result, setResult] = React.useState(null);

  return (
    <div>
      <button
        onClick={async () => {
          const res = await confirm("Are you sure?", "test confirm pattern");
          setResult(res);
        }}
      >
        Trigger Action
      </button>

      {result !== null && (
        <span data-testid="result-span">{result ? "Confirmed" : "Denied"}</span>
      )}
    </div>
  );
};

describe("ConfirmContext Strict Validation", () => {
  it("renders the modal and enforces typed requiredText before confirming", async () => {
    render(
      <ConfirmProvider>
        <TestComponent />
      </ConfirmProvider>
    );

    // Initial state check
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();

    // Trigger confirmation
    fireEvent.click(screen.getByText("Trigger Action"));

    // Modal renders
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    
    // Check for Danger Zone validation text
    expect(screen.getByText("test confirm pattern")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    
    // Confirm button is fully disabled initially
    expect(confirmBtn).toBeDisabled();

    // Type incorrect phrase
    const input = screen.getByPlaceholderText("test confirm pattern");
    fireEvent.change(input, { target: { value: "test confirm p" } });
    
    expect(confirmBtn).toBeDisabled();

    // Type correct phrase exactly
    fireEvent.change(input, { target: { value: "test confirm pattern" } });
    
    expect(confirmBtn).not.toBeDisabled();

    // Click confirm
    fireEvent.click(confirmBtn);

    // Verify resolving context value correctly
    await waitFor(() => {
      expect(screen.getByTestId("result-span").textContent).toBe("Confirmed");
    });
  });

  it("resolves to false if cancelled", async () => {
    render(
      <ConfirmProvider>
        <TestComponent />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText("Trigger Action"));
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByTestId("result-span").textContent).toBe("Denied");
    });
  });
});
