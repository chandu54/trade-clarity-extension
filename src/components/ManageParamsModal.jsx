import { useState } from "react";
import Modal from "./Modal";
import TrashIcon from "./icons/TrashIcon";

export default function ManageParamsModal({ data, setData, onClose, isOpen }) {
  const [editKey, setEditKey] = useState(null);
  const [error, setError] = useState("");

  const [paramKey, setParamKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");

  /* 🆕 CHECK CONFIG */
  const [isCheck, setIsCheck] = useState(false);
  const [idealValues, setIdealValues] = useState("");

  /* =========================
     SAVE EDIT
  ========================= */
  function saveEdit() {
    data.paramDefinitions[editKey] = {
      ...data.paramDefinitions[editKey],
      label,
      type,
      options: type === "select" ? options.split(",").map((o) => o.trim()) : [],
      isCheck,
      idealValues: isCheck && type !== "checkbox" ? idealValues.split(",").map((v) => v.trim()) : [],
    };

    setData({ ...data });
    resetForm();
  }

  /* =========================
     ADD PARAM
  ========================= */
  function addParam() {
    if (!paramKey || !label) {
      setError("Internal Name and Display Name are required");
      return;
    }

    if (data.paramDefinitions[paramKey]) {
      setError("Internal Name already exists");
      return;
    }

    setError("");

    data.paramDefinitions[paramKey] = {
      label,
      type,
      options: type === "select" ? options.split(",").map((o) => o.trim()) : [],
      filterable: false,
      isCheck,
      idealValues: isCheck && type !== "checkbox" ? idealValues.split(",").map((v) => v.trim()) : [],
    };

    setData({ ...data });
    resetForm();
  }

  /* =========================
     DELETE PARAM
  ========================= */
  function removeParam(key) {
    if (!confirm("Delete parameter?")) return;

    delete data.paramDefinitions[key];

    Object.values(data.weeks).forEach((countryWeeks) => {
      Object.values(countryWeeks).forEach((week) =>
        Object.values(week.stocks).forEach((stock) => {
          delete stock.params[key];
        }),
      );
    });

    setData({ ...data });
  }

  /* =========================
     HELPERS
  ========================= */
  function startEdit(key, p) {
    setEditKey(key);
    setParamKey(key);
    setLabel(p.label);
    setType(p.type);
    setOptions(p.options?.join(",") || "");
    setIsCheck(!!p.isCheck);
    setIdealValues(p.idealValues?.join(",") || "");
  }

  function resetForm() {
    setEditKey(null);
    setParamKey("");
    setLabel("");
    setType("text");
    setOptions("");
    setIsCheck(false);
    setIdealValues("");
    setError("");
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Parameters" subtitle="Define metrics used to evaluate and filter stocks">

      {/* Existing Parameters */}
      <div className="param-list">
        {Object.entries(data.paramDefinitions).length === 0 && (
          <div className="empty-state">No parameters defined yet</div>
        )}

        {Object.entries(data.paramDefinitions).map(([k, p]) => (
          <div key={k} className="param-row">
            <div className="param-info">
              <strong>{p.label}</strong>
            </div>
            <div className="param-actions">
              <button
                className="outline small"
                onClick={() => startEdit(k, p)}
                title="Edit parameter"
              >
                Edit
              </button>
              <button
                className="danger outline small icon-btn"
                onClick={() => removeParam(k)}
                title="Delete parameter"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <hr />

      {/* Add / Edit Section */}
      <h4 className="section-title">
        {editKey ? "Edit Parameter" : "Add New Parameter"}
      </h4>

      <div className="form-grid">
        <div className="form-field">
          <label>Internal Name</label>
          <input
            value={paramKey}
            disabled={!!editKey}
            onChange={(e) => {
              setParamKey(e.target.value);
              setError("");
            }}
            placeholder="e.g. relativeStrength"
          />
          {error && (
            <div 
              style={{ color: "#d32f2f", fontWeight: "600", marginTop: "8px" }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="form-field">
          <label>Display Name</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Relative Strength"
          />
        </div>

        <div className="form-field">
          <label>Type</label>
          <select
            className="select-control"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="text">Text</option>
            <option value="select">Dropdown</option>
            <option value="checkbox">Checkbox</option>
          </select>
        </div>

        {type === "select" && (
          <div className="form-field">
            <label>Dropdown Values</label>
            <input
              title={options}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Bullish, Neutral, Bearish"
            />
          </div>
        )}

        {/* CHECK CONFIG */}
        <div className="form-field checkbox-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isCheck}
              onChange={(e) => setIsCheck(e.target.checked)}
            />
            <span>
              Consider as Check
              <span
                className="info-icon"
                title="Marks this parameter as a validation check used to decide whether a stock is favorable or not."
              >
                ℹ️
              </span>
            </span>
          </label>
        </div>

        {isCheck && type !== "checkbox" && (
          <div className="form-field">
            <label>
              Ideal Value(s)
              <span
                className="info-icon"
                title="Define the value(s) that indicate a passing condition. Stocks meeting these values will pass this check."
              >
                ℹ️
              </span>
            </label>

            <input
              value={idealValues}
              onChange={(e) => setIdealValues(e.target.value)}
              placeholder="Comma separated ideal values"
            />
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button className="outline" onClick={onClose}>
          Close
        </button>

        {editKey ? (
          <button style={{ marginLeft: "8px" }} onClick={saveEdit}>
            Save Changes
          </button>
        ) : (
          <button style={{ marginLeft: "8px" }} onClick={addParam}>
            Add Parameter
          </button>
        )}
      </div>
    </Modal>
  );
}
