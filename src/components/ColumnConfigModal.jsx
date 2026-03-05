import Modal from "./Modal";

export default function ColumnConfigModal({ data, setData, onClose, isOpen }) {
  const visibility = data.uiConfig.columnVisibility;

  function toggle(key) {
    visibility[key] = !visibility[key];
    setData({ ...data });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Column Configuration" subtitle="Control which columns appear in the grid and their order">
      <div className="filter-config-list">
        {/* Locked Columns */}
        <div className="filter-config-row locked">
          <span>Stock</span>
          <span className="muted small">Always visible</span>
        </div>
        <div className="filter-config-row locked">
          <span>Sector</span>
          <span className="muted small">Always visible</span>
        </div>
        <div className="filter-config-row locked">
          <span>Checks Passed</span>
          <span className="muted small">Always visible</span>
        </div>

        <div className="filter-config-row locked">
          <span>Tradable</span>
          <span className="muted small">Always visible</span>
        </div>

        <hr />

        {/* Parameter Columns */}
        {Object.entries(data.paramDefinitions).map(([key, p]) => (
          <div key={key} className="filter-config-row">
            <div>
              <strong>{p.label}</strong>
              <div className="muted small">Parameter</div>
            </div>

            <label className="switch">
              <input
                type="checkbox"
                checked={visibility[key] ?? true}
                onChange={() => toggle(key)}
              />
              <span className="slider" />
            </label>
          </div>
        ))}

        {/* Notes */}
        <div className="filter-config-row">
          <div>
            <strong>Notes</strong>
            <div className="muted small">Optional column</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={visibility.__notes__ ?? true}
              onChange={() => toggle("__notes__")}
            />
            <span className="slider" />
          </label>
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
