import Modal from "./Modal";

export default function EditingRulesModal({ data, setData, onClose, isOpen }) {
  // Default = true (read-only ON)
  const readOnly = data.uiConfig?.lockPreviousWeeks !== false;
  // Default = false
  const enableApiHydration = data.uiConfig?.enableApiHydration === true;
  const adrDays = data.uiConfig?.adrDays || 20;
  const liquidityDays = data.uiConfig?.liquidityDays || 20;

  function toggleReadOnly(val) {
    if (!data.uiConfig) data.uiConfig = {};
    data.uiConfig.lockPreviousWeeks = val;
    setData({ ...data });
  }

  function toggleApiHydration(val) {
    if (!data.uiConfig) data.uiConfig = {};
    data.uiConfig.enableApiHydration = val;
    setData({ ...data });
  }

  function handleDaysChange(field, val) {
    if (!data.uiConfig) data.uiConfig = {};
    data.uiConfig[field] = parseInt(val, 10) || 20;
    setData({ ...data });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editing Rules" subtitle="Set rules for editing data across weeks and lock previous entries">
      <div className="param-row">
        <div>
          <strong>Read-only Previous Weeks</strong>
          <div className="muted small">
            Only the latest week will be editable
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => toggleReadOnly(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="param-row" style={{ marginTop: "16px" }}>
        <div>
          <strong>Enable Background Auto-Fetch (ADR & Liquidity)</strong>
          <div className="muted small">
            Automatically fetch and calculate ADR and Liquidity when adding new stocks.
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={enableApiHydration}
            onChange={(e) => toggleApiHydration(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      {enableApiHydration && (
        <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-light)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
           <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Auto-Fetch Lookback Period</h4>
           <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                 <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "var(--text-muted)" }}>ADR Days</label>
                 <input 
                    type="number" 
                    value={adrDays}
                    onChange={(e) => handleDaysChange("adrDays", e.target.value)}
                    min="1"
                    max="100"
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-dark)", color: "var(--text-color)" }}
                 />
              </div>
              <div style={{ flex: 1 }}>
                 <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "var(--text-muted)" }}>Liquidity Days</label>
                 <input 
                    type="number" 
                    value={liquidityDays}
                    onChange={(e) => handleDaysChange("liquidityDays", e.target.value)}
                    min="1"
                    max="100"
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-dark)", color: "var(--text-color)" }}
                 />
              </div>
           </div>
           <div className="muted small" style={{ marginTop: "8px" }}>Number of trading days to use when calculating averages. Defaults to 20 days.</div>
        </div>
      )}

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
