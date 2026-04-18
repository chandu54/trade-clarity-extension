import Modal from "./Modal";

export default function EditingRulesModal({ data, setData, onClose, isOpen }) {
  // Default = true (read-only ON)
  const readOnly = data.uiConfig?.lockPreviousWeeks !== false;
  // Default = true
  const enableApiHydration = data.uiConfig?.enableApiHydration !== false;
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
    <Modal isOpen={isOpen} onClose={onClose} title="Rules" subtitle="Set rules for editing data across weeks and lock previous entries">
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

      <div className="param-row-group" style={{ marginTop: "16px", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        <div className="param-row" style={{ border: "none", borderRadius: "0" }}>
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
          <div style={{ padding: "0 16px 16px", background: "rgba(15, 23, 42, 0.02)", display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>ADR:</span>
              <input 
                type="number" 
                value={adrDays}
                onChange={(e) => handleDaysChange("adrDays", e.target.value)}
                min="1" max="100"
                style={{ width: "50px", padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)", fontSize: "12px" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>Liquidity:</span>
              <input 
                type="number" 
                value={liquidityDays}
                onChange={(e) => handleDaysChange("liquidityDays", e.target.value)}
                min="1" max="100"
                style={{ width: "50px", padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)", fontSize: "12px" }}
              />
              <span className="info-icon" style={{ marginLeft: "4px" }} title="Number of trading days to use when calculating averages. Defaults to 20 days." />
            </div>
          </div>
        )}
      </div>

      <div className="param-row" style={{ marginTop: "16px" }}>
        <div>
          <strong>Auto-Refresh Metrics Daily</strong>
          <div className="muted small">
            Automatically update ADR, Liquidity, and Moving Averages once per day when the dashboard is opened.
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={data.uiConfig?.autoRefreshMetrics !== false}
            onChange={(e) => {
              if (!data.uiConfig) data.uiConfig = {};
              data.uiConfig.autoRefreshMetrics = e.target.checked;
              setData({ ...data });
            }}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
