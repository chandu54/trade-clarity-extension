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

  function updateUiConfig(key, value) {
    setData({
      ...data,
      uiConfig: {
        ...(data.uiConfig || {}),
        [key]: value,
      },
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rules"
      subtitle="Set rules for editing data across weeks, RS benchmark criteria, and lock previous entries"
      className="rules-modal-large"
    >
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

      {/* Relative Strength (RS) & Benchmark Rules Section */}
      <div className="param-row-group margin-top-16 rules-group-border">
        <div className="param-row no-border no-radius">
          <div>
            <strong>Relative Strength (RS) & Benchmark Rules</strong>
            <div className="muted small">
              Configure automated RS categorization, calculation timeframe, benchmark preferences, and custom threshold tiers.
            </div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={data.uiConfig?.rsAutoCalc !== false}
              onChange={(e) => updateUiConfig('rsAutoCalc', e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>

        {data.uiConfig?.rsAutoCalc !== false && (
          <div className="rs-rules-panel">
            {/* 1. Timeframe & Benchmark Options */}
            <div className="rs-rules-row-2col">
              <div className="rs-rules-field">
                <label className="rs-rules-label">
                  Calculation Duration (Timeframe)
                </label>
                <select
                  value={data.uiConfig?.rsTimeframe || '3mo'}
                  onChange={(e) => updateUiConfig('rsTimeframe', e.target.value)}
                  className="rs-rules-select"
                >
                  <option value="1mo">1 Month (21 Days)</option>
                  <option value="3mo">3 Months (63 Days - Default)</option>
                  <option value="6mo">6 Months (126 Days)</option>
                  <option value="1y">1 Year (252 Days)</option>
                </select>
              </div>

              <div className="rs-rules-field">
                <label className="rs-rules-label">
                  Benchmark Selection Preference
                </label>
                <select
                  value={data.uiConfig?.rsBenchmarkSetting || 'auto'}
                  onChange={(e) => updateUiConfig('rsBenchmarkSetting', e.target.value)}
                  className="rs-rules-select"
                >
                  <option value="auto">Smart Auto (Nifty Smallcap for IN, Nasdaq/S&P by sector for US)</option>
                  <option value="main">Main Market Index (Nifty 50 for IN, S&P 500 for US)</option>
                  <option value="smallcap">Smallcap / Midcap Index (Nifty Mid/Smallcap for IN, Russell 2000 for US)</option>
                </select>
              </div>
            </div>

            {/* 2. Chart Overlay Colors */}
            <div className="rs-rules-field">
              <label className="rs-rules-label">
                Chart Line Colors
              </label>
              <div className="rs-colors-row-compact">
                <div className="rs-color-item-compact">
                  <input
                    type="color"
                    value={data.uiConfig?.stockLineColor || '#3b82f6'}
                    onChange={(e) => updateUiConfig('stockLineColor', e.target.value)}
                    className="rs-color-input-compact"
                    title="Stock Price Line Color"
                  />
                  <div className="rs-color-info-compact">
                    <span className="rs-color-name-compact">Stock Line</span>
                    <span className="rs-color-hex-compact">{data.uiConfig?.stockLineColor || '#3b82f6'}</span>
                  </div>
                </div>

                <div className="rs-color-item-compact">
                  <input
                    type="color"
                    value={data.uiConfig?.benchmarkLineColor || '#f97316'}
                    onChange={(e) => updateUiConfig('benchmarkLineColor', e.target.value)}
                    className="rs-color-input-compact"
                    title="Benchmark Overlay Line Color"
                  />
                  <div className="rs-color-info-compact">
                    <span className="rs-color-name-compact">Benchmark Line</span>
                    <span className="rs-color-hex-compact">{data.uiConfig?.benchmarkLineColor || '#f97316'}</span>
                  </div>
                </div>

                <div className="rs-color-item-compact">
                  <input
                    type="color"
                    value={data.uiConfig?.rsLineColor || '#a855f7'}
                    onChange={(e) => updateUiConfig('rsLineColor', e.target.value)}
                    className="rs-color-input-compact"
                    title="Mansfield RS Ratio Line Color"
                  />
                  <div className="rs-color-info-compact">
                    <span className="rs-color-name-compact">RS Ratio Line</span>
                    <span className="rs-color-hex-compact">{data.uiConfig?.rsLineColor || '#a855f7'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Customizable Threshold Tiers */}
            <div className="rs-rules-field">
              <label className="rs-rules-label">
                Custom Threshold Tiers (% Outperformance vs Benchmark)
              </label>
              <div className="rs-threshold-grid-5col">
                <div className="rs-threshold-card-5col">
                  <span className="rs-threshold-title-5col text-emerald-600 dark:text-emerald-400">Very Strong</span>
                  <div className="rs-threshold-input-wrap">
                    <span className="rs-threshold-symbol">&gt;</span>
                    <input
                      type="number"
                      value={data.uiConfig?.rsThresholdVeryStrong ?? 25}
                      onChange={(e) => updateUiConfig('rsThresholdVeryStrong', parseFloat(e.target.value) || 25)}
                      className="rs-threshold-input"
                    />
                    <span className="rs-threshold-unit">%</span>
                  </div>
                </div>

                <div className="rs-threshold-card-5col">
                  <span className="rs-threshold-title-5col text-green-600 dark:text-green-400">Strong</span>
                  <div className="rs-threshold-input-wrap">
                    <span className="rs-threshold-symbol">&gt;</span>
                    <input
                      type="number"
                      value={data.uiConfig?.rsThresholdStrong ?? 15}
                      onChange={(e) => updateUiConfig('rsThresholdStrong', parseFloat(e.target.value) || 15)}
                      className="rs-threshold-input"
                    />
                    <span className="rs-threshold-unit">%</span>
                  </div>
                </div>

                <div className="rs-threshold-card-5col">
                  <span className="rs-threshold-title-5col text-amber-600 dark:text-amber-400">Neutral</span>
                  <div className="rs-threshold-input-wrap">
                    <span className="rs-threshold-symbol">&ge;</span>
                    <input
                      type="number"
                      value={data.uiConfig?.rsThresholdNeutral ?? -3}
                      onChange={(e) => updateUiConfig('rsThresholdNeutral', parseFloat(e.target.value) || -3)}
                      className="rs-threshold-input"
                    />
                    <span className="rs-threshold-unit">%</span>
                  </div>
                </div>

                <div className="rs-threshold-card-5col">
                  <span className="rs-threshold-title-5col text-rose-500 dark:text-rose-400">Weak</span>
                  <div className="rs-threshold-input-wrap">
                    <span className="rs-threshold-symbol">&ge;</span>
                    <input
                      type="number"
                      value={data.uiConfig?.rsThresholdWeak ?? -15}
                      onChange={(e) => updateUiConfig('rsThresholdWeak', parseFloat(e.target.value) || -15)}
                      className="rs-threshold-input"
                    />
                    <span className="rs-threshold-unit">%</span>
                  </div>
                </div>

                <div className="rs-threshold-card-5col">
                  <span className="rs-threshold-title-5col text-rose-700 dark:text-rose-500 font-bold">Very Weak</span>
                  <div className="rs-threshold-input-wrap">
                    <span className="rs-threshold-symbol">&lt;</span>
                    <input
                      type="number"
                      value={data.uiConfig?.rsThresholdVeryWeak ?? -15}
                      onChange={(e) => updateUiConfig('rsThresholdVeryWeak', parseFloat(e.target.value) || -15)}
                      className="rs-threshold-input"
                    />
                    <span className="rs-threshold-unit">%</span>
                  </div>
                </div>
              </div>
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

      <div className="param-row margin-top-16">
        <div>
          <strong>Auto-Calculate Stock Stage Daily</strong>
          <div className="muted small">
            Automatically analyze and classify stocks into Stage 1, 2, 3, or 4 (Stan Weinstein Stage Analysis).
          </div>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={data.uiConfig?.autoCalculateStage !== false}
            onChange={(e) => {
              setData({
                ...data,
                uiConfig: {
                  ...(data.uiConfig || {}),
                  autoCalculateStage: e.target.checked,
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
