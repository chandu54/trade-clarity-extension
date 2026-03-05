import Modal from "./Modal.jsx";
export default function FilterConfigModal({
  data,
  setData,
  onClose,
  isOpen,
}) {
  function toggleFilterable(key) {
    const newData = structuredClone(data);
    newData.paramDefinitions[key].filterable =
      !newData.paramDefinitions[key].filterable;
    setData(newData);
  }

  function toggleTradableFilterable() {
    const newData = structuredClone(data);
    newData.uiConfig = newData.uiConfig || {};
    newData.uiConfig.tradableFilterable = !newData.uiConfig.tradableFilterable;
    setData(newData);
  }

  function toggleSectorFilterable() {
    const newData = structuredClone(data);
    newData.uiConfig = newData.uiConfig || {};
    newData.uiConfig.sectorFilterable = !newData.uiConfig.sectorFilterable;
    setData(newData);
  }

  function toggleTagFilterable() {
    const newData = structuredClone(data);
    newData.uiConfig = newData.uiConfig || {};
    newData.uiConfig.tagFilterable = !newData.uiConfig.tagFilterable;
    setData(newData);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Configuration" subtitle="Choose which parameters, sectors, and flags can be used to filter stocks">
      {/* SYSTEM FILTERS */}
      <h4 className="modal-section-title">System Filters</h4>
      <div className="filter-config-list">
        <div className="filter-config-row">
          <div>
            <strong>Sector</strong>
            <div className="muted">stock.sector</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={data.uiConfig?.sectorFilterable === true}
              onChange={toggleSectorFilterable}
            />
            <span className="slider" />
          </label>
        </div>
        <div className="filter-config-row">
          <div>
            <strong>Tradable</strong>
            <div className="muted">stock.tradable</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={data.uiConfig?.tradableFilterable === true}
              onChange={toggleTradableFilterable}
            />
            <span className="slider" />
          </label>
        </div>
        <div className="filter-config-row">
          <div>
            <strong>Tag</strong>
            <div className="muted">stock.tags</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={data.uiConfig?.tagFilterable === true}
              onChange={toggleTagFilterable}
            />
            <span className="slider" />
          </label>
        </div>
      </div>

      <hr />

      {/* PARAM FILTERS */}
      <h4 className="modal-section-title">Parameter Filters</h4>
      <div className="filter-config-list">
        {Object.entries(data.paramDefinitions).map(([key, p]) => (
          <div key={key} className="filter-config-row">
            <div>
              <strong>{p.label}</strong>
              <div className="muted">{key}</div>
            </div>

            <label className="switch">
              <input
                type="checkbox"
                checked={!!p.filterable}
                onChange={() => toggleFilterable(key)}
              />
              <span className="slider" />
            </label>
          </div>
        ))}
      </div>

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
