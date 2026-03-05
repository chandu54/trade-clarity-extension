import { useState, useEffect } from "react";
import Modal from "./Modal";

export default function EditStockModal({
  isOpen,
  onClose,
  stock,
  onSave,
  paramDefinitions,
  sectors,
  availableTags,
  weekInfo,
  country,
  showTags = true
}) {
  const [formData, setFormData] = useState(null);

  // Initialize form data when stock changes
  useEffect(() => {
    if (stock) {
      setFormData(structuredClone(stock));
    }
  }, [stock]);

  if (!isOpen || !formData) return null;

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleParamChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      params: { ...prev.params, [key]: value },
    }));
  };

  const toggleTag = (tag) => {
    const currentTags = formData.tags || [];
    if (currentTags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: currentTags.filter((t) => t !== tag),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        tags: [...currentTags, tag],
      }));
    }
  };

  // Sort params to match grid order if possible, or just alphabetical
  const sortedParams = Object.entries(paramDefinitions);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={formData.symbol}
      subtitle="Update stock details and parameters"
    >
      <div className="edit-stock-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Top Row: Sector & Tradable */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "end" }}>
          <div className="form-field">
            <label>Sector</label>
            <select
              className="select-control"
              value={formData.sector || ""}
              onChange={(e) => handleChange("sector", e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Select Sector...</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field checkbox-field" style={{ marginBottom: "8px" }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.tradable || false}
                onChange={(e) => handleChange("tradable", e.target.checked)}
              />
              <span>Tradable</span>
            </label>
          </div>
        </div>

        <hr style={{ margin: "0", borderColor: "var(--border)" }} />

        {/* Parameters Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {sortedParams.map(([key, def]) => (
            <div key={key} className="form-field">
              <label>{def.label}</label>
              {def.type === "checkbox" ? (
                <select
                  className="select-control"
                  value={formData.params?.[key] === true ? "true" : "false"}
                  onChange={(e) => handleParamChange(key, e.target.value === "true")}
                  style={{ width: "100%" }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              ) : def.type === "select" ? (
                <select
                  className="select-control"
                  value={formData.params?.[key] || ""}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Select...</option>
                  {def.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.params?.[key] || ""}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  style={{ width: "100%" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="form-field">
          <label>Notes</label>
          <textarea
            rows={3}
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            placeholder="Add your analysis notes here..."
          />
        </div>

        {/* Tags */}
        {showTags && availableTags.length > 0 && (
          <div className="form-field">
            <label>Tags</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
              {availableTags.map((tag) => {
                const isSelected = formData.tags?.includes(tag);
                return (
                  <span
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--primary)" : "var(--border)",
                      backgroundColor: isSelected ? "var(--primary-light)" : "var(--bg)",
                      color: isSelected ? "var(--primary)" : "inherit",
                      userSelect: "none"
                    }}
                  >
                    {tag} {isSelected ? "✓" : "+"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="outline" onClick={onClose}>
            Cancel
          </button>
          <button onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </Modal>
  );
}
