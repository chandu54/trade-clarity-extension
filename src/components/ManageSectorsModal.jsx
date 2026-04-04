import { useState, useEffect } from "react";
import Modal from "./Modal";
import TrashIcon from "./icons/TrashIcon";

export default function ManageSectorsModal({
  data,
  setData,
  onClose,
  isOpen,
}) {
  const [localErrors, setLocalErrors] = useState({});
  const sectors = data.uiConfig?.sectors || [];

  // Validate on mount to catch existing issues
  useEffect(() => {
    if (isOpen) {
      validate(sectors);
    }
  }, [isOpen]);

  function updateSectors(next) {
    const newData = structuredClone(data);
    newData.uiConfig.sectors = next;
    newData.sectors = next;
    setData(newData);
    
    // Perform validation on the new state
    validate(next);
  }

  function validate(currentSectors) {
    const newErrors = {};
    const names = currentSectors.map(s => (s.name || "").trim().toLowerCase());
    
    currentSectors.forEach((s, i) => {
      const name = (s.name || "").trim();
      if (!name) {
        newErrors[i] = "empty";
      } else if (names.indexOf(name.toLowerCase()) !== i) {
        newErrors[i] = "duplicate";
      }
    });
    
    setLocalErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function addSector() {
    // Only allow adding if the last sector is not empty
    if (sectors.length > 0 && !(sectors[sectors.length - 1].name || "").trim()) {
       return; 
    }
    const next = [...sectors, { name: "", countries: ["IN", "US"] }];
    updateSectors(next);
  }

  function updateSector(index, field, value) {
    const next = [...sectors];
    const item = { ...next[index] };
    
    if (field === "name") {
      item.name = value;
    } else if (field === "countries") {
      const currentCountries = item.countries || [];
      if (currentCountries.includes(value)) {
        item.countries = currentCountries.filter(c => c !== value);
      } else {
        item.countries = [...currentCountries, value];
      }
    }
    
    next[index] = item;
    updateSectors(next);
  }

  function deleteSector(index) {
    const next = sectors.filter((_, i) => i !== index);
    updateSectors(next);
  }

  const hasErrors = Object.keys(localErrors).length > 0;
  const isDuplicate = Object.values(localErrors).includes("duplicate");
  const isEmpty = Object.values(localErrors).includes("empty");

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={hasErrors ? null : onClose} 
      title="Manage Sectors" 
      subtitle="Define technical sectors and scope them to specific regional markets"
    >
      {/* FIXED HEADER */}
      <div className="sector-config-header">
         <div className="col-name">Sector Category</div>
         <div className="col-country">India</div>
         <div className="col-country">USA</div>
         <div className="col-actions"></div>
      </div>

      <div className="sector-config-list themed-scroll">
        {sectors.map((sector, i) => (
          <div className={`sector-config-row-v2 ${localErrors[i] ? 'has-error-row' : ''}`} key={i}>
            <div className={`sector-name-input-wrapper ${localErrors[i] ? 'has-error' : ''}`}>
              <input
                type="text"
                value={sector.name || ""}
                placeholder="Enter sector name..."
                onChange={(e) => updateSector(i, "name", e.target.value)}
                autoFocus={sector.name === ""} 
              />
            </div>
            
            <div className="sector-country-toggle">
               <label className="checkbox-label-premium">
                 <input 
                   type="checkbox" 
                   checked={sector.countries?.includes("IN")} 
                   onChange={() => updateSector(i, "countries", "IN")}
                 />
               </label>
            </div>

            <div className="sector-country-toggle">
               <label className="checkbox-label-premium">
                 <input 
                   type="checkbox" 
                   checked={sector.countries?.includes("US")} 
                   onChange={() => updateSector(i, "countries", "US")}
                 />
               </label>
            </div>

            <div className="sector-actions">
              <button
                className="danger outline small icon-btn"
                onClick={() => deleteSector(i)}
                title="Delete sector"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        ))}

        {sectors.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
            No sectors defined. Use the button below to add one.
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="modal-footer-premium">
        {hasErrors && (
          <div className="modal-validation-notice">
            ⚠️ {isDuplicate ? "Duplicate sector names detected" : "Sector category name(s) required"}
          </div>
        )}
        
        <button 
          className="btn-modal-secondary" 
          onClick={onClose}
          disabled={hasErrors}
          title={hasErrors ? "Fix errors to close" : ""}
        >
          Close
        </button>
        <button 
          className="btn-modal-primary" 
          onClick={addSector}
          disabled={hasErrors}
        >
          + Add New Sector
        </button>
      </div>
    </Modal>
  );
}
