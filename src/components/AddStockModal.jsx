import { useState } from "react";
import Modal from "./Modal";

export default function AddStockModal({ onAdd, onImport, onClose, existingStocks = {}, isOpen, sectors = [], onParseTv, watchlists = [], selectedWatchlistId }) {
  const [activeTab, setActiveTab] = useState("manual");
  const [selectedWlIds, setSelectedWlIds] = useState(
    selectedWatchlistId && selectedWatchlistId !== 'all' ? [selectedWatchlistId] : []
  );

  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  
  const [tvValue, setTvValue] = useState("");
  const [tvError, setTvError] = useState("");

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
    const duplicates = symbols.filter((symbol) => {
      const existing = existingStocks[symbol];
      if (!existing) return false;
      
      const existingWls = existing.watchlists || [];
      const hasAllWatchlists = selectedWlIds.every(id => existingWls.includes(id));
      
      // If they aren't selecting any specific watchlists and it exists, it's a duplicate.
      // If they are selecting watchlists, and it already has all of them, it's a duplicate.
      return selectedWlIds.length === 0 ? true : hasAllWatchlists;
    });
    
    if (duplicates.length > 0) {
      setError(`Stock(s) already exist in these watchlists: ${duplicates.join(", ")}`);
      return;
    }

    setError("");
    onAdd(value, selectedWlIds);
    onClose();
  }

  function handleTvImport() {
    if (!tvValue.trim()) {
      setTvError("Please paste the TradingView watchlist data.");
      return;
    }

    let parsedStocks;
    try {
      parsedStocks = onParseTv(tvValue);
    } catch (err) {
      setTvError(err.message);
      return;
    }
    
    // Check duplicates against existingStocks
    const duplicates = parsedStocks.filter(s => {
      const existing = existingStocks[s.symbol];
      if (!existing) return false;
      
      const existingWls = existing.watchlists || [];
      const hasAllWatchlists = selectedWlIds.every(id => existingWls.includes(id));
      
      return selectedWlIds.length === 0 ? true : hasAllWatchlists;
    });
    
    if (duplicates.length > 0) {
      setTvError(`Stock(s) already exist in these watchlists: ${duplicates.map(d => d.symbol).join(", ")}`);
      return;
    }

    setTvError("");
    if (onImport) {
      const stocksWithWatchlists = parsedStocks.map(s => ({ ...s, watchlists: selectedWlIds }));
      onImport(stocksWithWatchlists);
    }
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stocks" subtitle="Add new stocks to the current week's list">
      <div className={`add-stock-modal ${activeTab === 'tv' ? 'modal-wide' : ''}`}>
        
        <div className="modal-tabs">
          <button 
            className={activeTab === 'manual' ? "tab-btn active" : "tab-btn"} 
            onClick={() => setActiveTab('manual')}
          >
            Manual Entry
          </button>
          <button 
            className={activeTab === 'tv' ? "tab-btn active" : "tab-btn"} 
            onClick={() => setActiveTab('tv')}
          >
            TradingView Import
          </button>
        </div>

        {activeTab === 'manual' ? (
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
              <div className="error-message form-error-msg">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="form-field">
            <label>TradingView Watchlist Data</label>
            <textarea
              className="tv-import-textarea"
              rows={5}
              placeholder="Paste your exported list here (e.g. ###AUTO,NSE:JKTYRE...)"
              value={tvValue}
              onChange={(e) => {
                setTvValue(e.target.value);
                setTvError("");
              }}
              autoFocus
            />
            <div className="muted small">
              Supports TradingView export format with sections (###SECTION) and symbols (EXCHANGE:SYMBOL).
            </div>
            {tvError && (
              <div className="error-message form-error-msg">
                {tvError}
              </div>
            )}
          </div>
        )}

        {watchlists.length > 0 && (
          <div className="form-field form-field-mt">
            <label>Add to Watchlists</label>
            <div className="watchlist-checkbox-group">
              {watchlists.map((wl) => {
                const isSelected = selectedWlIds.includes(wl.id);
                return (
                  <label key={wl.id} className="watchlist-checkbox-item">
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
          </div>
        )}

        <div className="modal-actions modal-actions-mt">
          <button className="outline" onClick={onClose}>
            Cancel
          </button>
          <button onClick={activeTab === 'manual' ? handleAdd : handleTvImport}>Add</button>
        </div>
      </div>
    </Modal>
  );
}
