import Modal from "./Modal";
import TrashIcon from "./icons/TrashIcon";
export default function ManageSectorsModal({
  data,
  setData,
  onClose,
  isOpen,
}) {
  const sectors = data.uiConfig?.sectors || [];

  function updateSectors(next) {
    const newData = structuredClone(data);
    newData.uiConfig.sectors = next;
    setData(newData);
  }

  function addSector() {
    updateSectors([...sectors, ""]);
  }

  function updateSector(index, value) {
    const next = [...sectors];
    next[index] = value;
    updateSectors(next);
  }

  function deleteSector(index) {
    updateSectors(sectors.filter((_, i) => i !== index));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Sectors" subtitle="Add, edit, or organize stock sectors used across the app">
      {/* BODY */}
      <div className="sector-config-list">
        {sectors.map((sector, i) => (
          <div className="sector-config-row" key={i}>
            <input
              type="text"
              value={sector}
              placeholder="Sector name"
              onChange={(e) => updateSector(i, e.target.value)}
            />
            <button
              className="danger outline small icon-btn"
              onClick={() => deleteSector(i)}
              title="Delete sector"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* FOOTER (ALWAYS AT BOTTOM) */}
      <div className="modal-footer">
        <button className="add-stock-btn" onClick={addSector}>
          + Add Sector
        </button>
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
