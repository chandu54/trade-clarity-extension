import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./ToastContext";
import { useConfirm } from "./ConfirmContext";

export default function ManageTagsModal({ data, setData, onClose, isOpen }) {
  const [newTag, setNewTag] = useState("");
  const tags = data.uiConfig?.tags || [];
  const showTags = data.uiConfig?.showTags !== false;
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  function toggleShowTags() {
    setData({
      ...data,
      uiConfig: {
        ...data.uiConfig,
        showTags: !showTags,
      },
    });
  }

  function handleAdd() {
    const val = newTag.trim();
    if (!val) return;
    if (tags.includes(val)) {
      showToast("Tag already exists", "warning");
      return;
    }

    const updatedTags = [...tags, val].sort();
    setData({
      ...data,
      uiConfig: {
        ...data.uiConfig,
        tags: updatedTags,
      },
    });
    setNewTag("");
  }

  async function handleDelete(tag) {
    if (!await confirm(`Delete tag "${tag}"?`)) return;
    const updatedTags = tags.filter((t) => t !== tag);

    // Remove this tag from all stocks in all weeks
    const updatedWeeks = { ...data.weeks };
    
    Object.keys(updatedWeeks).forEach((countryKey) => {
      const countryWeeks = updatedWeeks[countryKey];
      Object.keys(countryWeeks).forEach((weekKey) => {
        const week = countryWeeks[weekKey];
        if (!week.stocks) return;
  
        const newStocks = { ...week.stocks };
        let hasChanges = false;
  
        Object.values(newStocks).forEach((stock) => {
          if (stock.tags && stock.tags.includes(tag)) {
            newStocks[stock.symbol] = {
              ...stock,
              tags: stock.tags.filter((t) => t !== tag),
            };
            hasChanges = true;
          }
        });
  
        if (hasChanges) {
          countryWeeks[weekKey] = { ...week, stocks: newStocks };
        }
      });
    });

    setData({
      ...data,
      weeks: updatedWeeks,
      uiConfig: {
        ...data.uiConfig,
        tags: updatedTags,
      },
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Tags" subtitle="Manage global tags for stocks">
      <div className="filter-config-row" style={{ marginBottom: "16px" }}>
        <div>
          <strong>Enable Tags</strong>
          <div className="muted">Show tags on stock grid</div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={showTags}
            onChange={toggleShowTags}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="form-field" style={{ display: "flex", gap: "8px" }}>
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="New tag name..."
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      <div className="tag-manager-list">
        {tags.length === 0 && (
          <div className="empty-state">No tags defined.</div>
        )}
        {tags.map((tag) => (
          <div key={tag} className="tag-chip-manage">
            <span>{tag}</span>
            <button
              className="remove-tag-btn"
              onClick={() => handleDelete(tag)}
            >
              ×
            </button>
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