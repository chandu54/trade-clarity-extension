import Modal from "./Modal";

export default function EditingRulesModal({ data, setData, onClose, isOpen }) {
  // Default = true (read-only ON)
  const readOnly = data.uiConfig?.lockPreviousWeeks !== false;
  // Default = true
  const enableApiHydration = data.uiConfig?.enableApiHydration !== false;
  const autoIdentifySectors = data.uiConfig?.autoIdentifySectors !== false;
  const adrDays = data.uiConfig?.adrDays || 20;
  const liquidityDays = data.uiConfig?.liquidityDays || 20;

  function toggleReadOnly(val) {
    setData({
      ...data,
      uiConfig: {
        ...(data.uiConfig || {}),
        lockPreviousWeeks: val,
      },
    });
  }

  function toggleApiHydration(val) {
    setData({
      ...data,
      uiConfig: {
        ...(data.uiConfig || {}),
        enableApiHydration: val,
      },
    });
  }

  function toggleAutoIdentifySectors(val) {
    setData({
      ...data,
      uiConfig: {
        ...(data.uiConfig || {}),
        autoIdentifySectors: val,
      },
    });
  }

  function handleDaysChange(field, val) {
    setData({
      ...data,
      uiConfig: {
        ...(data.uiConfig || {}),
        [field]: parseInt(val, 10) || 20,
      },
    });
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

      <div className="param-row-group margin-top-16 rules-group-border">
        <div className="param-row no-border no-radius">
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
          <div className="hydration-settings-panel">
            <div className="flex-row-center-gap-2">
              <span className="label-small-muted">ADR:</span>
              <input 
                type="number" 
                value={adrDays}
                onChange={(e) => handleDaysChange("adrDays", e.target.value)}
                min="1" max="100"
                className="compact-number-input"
              />
            </div>
            <div className="flex-row-center-gap-2">
              <span className="label-small-muted">Liquidity:</span>
              <input 
                type="number" 
                value={liquidityDays}
                onChange={(e) => handleDaysChange("liquidityDays", e.target.value)}
                min="1" max="100"
                className="compact-number-input"
              />
              <span className="info-icon ml-1" title="Number of trading days to use when calculating averages. Defaults to 20 days." />
            </div>
          </div>
        )}
      </div>

      <div className="param-row margin-top-16">
        <div>
          <strong>Auto-Identify Stock Sectors</strong>
          <div className="muted small">
            Automatically resolve sectors for newly added stocks using local metadata database, and register them to your list.
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={autoIdentifySectors}
            onChange={(e) => toggleAutoIdentifySectors(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="param-row margin-top-16">
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
              setData({
                ...data,
                uiConfig: {
                  ...(data.uiConfig || {}),
                  autoRefreshMetrics: e.target.checked,
                },
              });
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
