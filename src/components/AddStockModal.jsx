import { useState } from "react";
import Modal from "./Modal";

export default function AddStockModal({ onAdd, onClose, existingStocks = {}, isOpen }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleAdd() {
    const trimmedValue = value.trim();
    
    // Check for empty or space-only input
    if (!trimmedValue) {
      setError("Please enter at least one stock symbol");
      return;
    }

    const symbols = trimmedValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (symbols.length === 0) {
      setError("Please enter at least one valid stock symbol");
      return;
    }

    // Check for duplicate stocks
    const duplicates = symbols.filter((symbol) => existingStocks[symbol]);
    
    if (duplicates.length > 0) {
      setError(`Stock(s) already exist: ${duplicates.join(", ")}`);
      return;
    }

    setError("");
    onAdd(value);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stocks" subtitle="Add new stocks to the current week's list">
      <div className="add-stock-modal">
        <div className="form-field">
          <label>Stock Symbols</label>
          <input
            type="text"
            placeholder="e.g. AAPL, MSFT, TCS, INFY"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
          <div className="muted small">
            Enter comma-separated stock symbols
          </div>
          {error && (
            <div 
              className="error-message" 
              style={{ color: "#d32f2f", fontWeight: "600", marginTop: "8px" }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="outline" onClick={onClose}>
            Cancel
          </button>
          <button onClick={handleAdd}>Add</button>
        </div>
      </div>
    </Modal>
  );
}
