import { useState } from "react";
import Modal from "./Modal";

export default function ImportWatchlistModal({ isOpen, stocks, watchlists, selectedWatchlistId, onConfirm, onClose }) {
  const [selectedWlIds, setSelectedWlIds] = useState(
    selectedWatchlistId && selectedWatchlistId !== 'all' ? [selectedWatchlistId] : []
  );

  function handleImport() {
    const finalStocks = stocks.map(s => ({
      ...s,
      watchlists: selectedWlIds
    }));
    onConfirm(finalStocks);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Stocks" subtitle={`Importing ${stocks.length} stocks. Select watchlists.`}>
      <div className="add-stock-modal">
        {watchlists.length > 0 ? (
          <div className="form-field">
            <label>Add to Watchlists</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
              {watchlists.map((wl) => {
                const isSelected = selectedWlIds.includes(wl.id);
                return (
                  <label key={wl.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedWlIds([...selectedWlIds, wl.id]);
                        else setSelectedWlIds(selectedWlIds.filter(id => id !== wl.id));
                      }}
                    />
                    {wl.name}
                  </label>
                )
              })}
            </div>
            <div className="muted small" style={{ marginTop: "12px" }}>
              If no watchlists are selected, stocks will still be imported and available under "All Stocks".
            </div>
          </div>
        ) : (
          <div className="muted" style={{ padding: "12px 0" }}>
            No custom watchlists available. Stocks will be added to the global "All Stocks" pool.
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button className="outline" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleImport}>Import {stocks.length} Stocks</button>
        </div>
      </div>
    </Modal>
  );
}
