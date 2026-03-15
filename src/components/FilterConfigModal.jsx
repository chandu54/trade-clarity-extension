import { useState } from "react";
import Modal from "./Modal.jsx";

export default function FilterConfigModal({ data, setData, onClose, isOpen, selectedWatchlistId }) {
  const [editingId, setEditingId] = useState(selectedWatchlistId || "all");
  const watchlists = data.watchlists || [];
  const isGlobal = editingId === "all";
  const activeWatchlist = watchlists.find(w => w.id === editingId);

  function toggleFilterable(key) {
    if (isGlobal) {
      const newData = structuredClone(data);
      newData.paramDefinitions[key].filterable = !newData.paramDefinitions[key].filterable;
      setData(newData);
    } else {
      const wList = { ...activeWatchlist };
      if (wList.visibleFilters.includes(key)) {
        wList.visibleFilters = wList.visibleFilters.filter(k => k !== key);
      } else {
        wList.visibleFilters = [...wList.visibleFilters, key];
      }
      const newData = { ...data, watchlists: watchlists.map(w => w.id === editingId ? wList : w) };
      setData(newData);
    }
  }

  function getValue(key) {
    if (isGlobal) return !!data.paramDefinitions[key].filterable;
    return activeWatchlist?.visibleFilters.includes(key) ?? false;
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
      <div className="config-scope-row">
        <div className="config-scope-label">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          Configuration Scope
        </div>
        <select
          className="config-scope-select"
          value={editingId}
          onChange={(e) => setEditingId(e.target.value)}
        >
          <option value="all">Global Default (Base Settings)</option>
          {watchlists.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

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
              disabled={!isGlobal}
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
              disabled={!isGlobal}
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
              disabled={!isGlobal}
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
                checked={getValue(key)}
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
