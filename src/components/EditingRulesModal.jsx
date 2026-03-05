import Modal from "./Modal";

export default function EditingRulesModal({ data, setData, onClose, isOpen }) {
  // Default = true (read-only ON)
  const readOnly = data.uiConfig?.lockPreviousWeeks !== false;

  function toggle(val) {
    data.uiConfig.lockPreviousWeeks = val;
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
            onChange={(e) => toggle(e.target.checked)}
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
