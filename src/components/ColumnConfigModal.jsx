import { useState } from "react";
import Modal from "./Modal";

export default function ColumnConfigModal({ data, setData, onClose, isOpen, selectedWatchlistId }) {
  const [editingId, setEditingId] = useState(selectedWatchlistId || "all");
  const watchlists = data.watchlists || [];
  const isGlobal = editingId === "all";
  const activeWatchlist = watchlists.find(w => w.id === editingId);
  const visibility = data.uiConfig.columnVisibility;

  function toggle(key) {
    if (isGlobal) {
      visibility[key] = !visibility[key];
      setData({ ...data });
    } else {
      const wList = { ...activeWatchlist };
      if (wList.visibleParams.includes(key)) {
        wList.visibleParams = wList.visibleParams.filter(k => k !== key);
      } else {
        wList.visibleParams = [...wList.visibleParams, key];
      }
      const newData = { ...data, watchlists: watchlists.map(w => w.id === editingId ? wList : w) };
      setData(newData);
    }
  }

  function getValue(key) {
    if (isGlobal) return visibility[key] ?? true;
    return activeWatchlist?.visibleParams.includes(key) ?? false;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Column Configuration" subtitle="Control which columns appear in the grid and their order">
      <div className="filter-config-list">
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
                checked={getValue(key)}
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
              checked={getValue("__notes__")}
              onChange={() => toggle("__notes__")}
              disabled={!isGlobal && !activeWatchlist?.visibleParams.includes("__notes__") && activeWatchlist?.visibleParams.length > 0 === false}
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
