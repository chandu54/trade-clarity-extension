import React, { useState } from "react";
import Modal from "./Modal";
import { getActualCurrentSunday, getLatestWeekKey, getLocalDateString, getSundayOfWeek, getWeekRangeLabel } from "../utils/weekHelpers";
import { globalQuoteCache } from "../utils/yahooFinanceMap";
import { globalFundamentalsCache } from "../utils/stockAnalysisApi";
import { useToast } from "./ToastContext";

const DataManagementModal = ({ isOpen, onClose, data, setData, country, weekKey, setWeekKey }) => {
  const { showToast } = useToast();
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevCountry, setPrevCountry] = useState(country);

  if (isOpen !== prevIsOpen || country !== prevCountry) {
    setPrevIsOpen(isOpen);
    setPrevCountry(country);
    if (isOpen) {
      setSelectedWeeks([]);
      setConfirmText("");
      setShowConfirm(false);
      setSaveStatus("");
    }
  }

  const handleClearStockCaches = async () => {
    try {
      globalQuoteCache.clear();
      await globalFundamentalsCache.clear();
      const msg = "Quote & stock price cache cleared! (Sector cache preserved)";
      showToast?.(msg, "success");
      setSaveStatus(msg);
      setTimeout(() => {
        setSaveStatus("");
      }, 3500);
    } catch (err) {
      console.error("Failed to clear stock quote cache:", err);
      showToast?.("Failed to clear quote cache.", "error");
    }
  };

  const actualCurrentSunday = getActualCurrentSunday();
  const storedWeeksKeys = Object.keys(data?.weeks?.[country] || {}).sort().reverse();

  const toggleWeekSelection = (wk) => {
    if (wk === actualCurrentSunday) return;

    setSelectedWeeks((prev) => 
      prev.includes(wk) ? prev.filter((w) => w !== wk) : [...prev, wk]
    );
  };

  const handleBulkDelete = () => {
    if (selectedWeeks.length === 0) return;

    setData((prev) => {
      const newData = structuredClone(prev);
      
      // Delete all selected weeks from global data
      selectedWeeks.forEach((wk) => {
        if (newData.weeks?.[country]?.[wk]) {
          delete newData.weeks[country][wk];
        }
      });

      const remainingWeeks = Object.keys(newData.weeks?.[country] || {});
      
      // Fallback mechanics if things are missing
      if (remainingWeeks.length === 0) {
        const todayStr = getLocalDateString(new Date());
        const targetWeek = getSundayOfWeek(todayStr);
        if (!newData.weeks) newData.weeks = {};
        if (!newData.weeks[country]) newData.weeks[country] = {};
        newData.weeks[country][targetWeek] = { stocks: {} };
        setWeekKey(targetWeek);
      } else if (selectedWeeks.includes(weekKey)) {
        // If the globally viewable active week was deleted, fall back to the most recent available week
        const nextWeek = getLatestWeekKey(newData.weeks[country]);
        setWeekKey(nextWeek);
      }

      return newData;
    });

    setSaveStatus(`Successfully deleted ${selectedWeeks.length} week(s)!`);
    setSelectedWeeks([]);
    setConfirmText("");
    setShowConfirm(false);
  
    setTimeout(() => {
      setSaveStatus("");
    }, 3000);
  };

  const REQUIRED_CONFIRM_TEXT = `delete ${country} data`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Management"
      subtitle={`Manage stored weeks and data for ${country === "US" ? "United States" : "India"}`}
    >
      <div className="modal-body settings-modal-body">
        
        {saveStatus && (
          <div className="status-banner success dm-status-banner">
            <span className="status-banner-icon">✓</span>
            <span className="status-banner-text">{saveStatus}</span>
          </div>
        )}

        {!showConfirm ? (
          // --- VIEW 1: SELECTION LIST ---
          <>
            <div className="settings-card">
              <label className="settings-label-v2 settings-label-mb">
                Select Weeks to Delete
                <span className="info-icon" title="Check weeks you want to purge permanently" />
              </label>

              <div className="data-management-list">
                {storedWeeksKeys.length === 0 && (
                  <div className="dm-empty-state">No weeks found.</div>
                )}
                {storedWeeksKeys.map((wk) => {
                  const isCurrent = wk === actualCurrentSunday;
                  const isSelected = selectedWeeks.includes(wk);

                  return (
                    <div 
                      key={wk} 
                      className={`data-week-row ${isCurrent ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => !isCurrent && toggleWeekSelection(wk)}
                    >
                      <div className="data-week-row-left">
                        <div className={`multi-select-checkbox ${isSelected ? "checked" : ""}`}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <div className="data-week-labels">
                          <span className="data-week-label">Week: {getWeekRangeLabel(wk)}</span>
                          <span className="data-week-sync-info">
                            Last Synced: {data.weeks?.[country]?.[wk]?.lastSyncDate || "Never"}
                          </span>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="locked-badge">
                          Current Active (Locked)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="settings-footer-note dm-footer-note">
                You cannot delete the active current calendar week.
              </div>
            </div>

            <div className="settings-card" style={{ marginTop: "16px" }}>
              <label className="settings-label-v2 settings-label-mb flex justify-between items-center">
                <span>Quote & Stock Cache Management</span>
                <span className="info-icon" title="Purge local price & fundamental quote cache while preserving sector classifications" />
              </label>
              <div className="flex justify-between items-center py-2">
                <div className="pr-4">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Clear Quote & Stock Cache
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Purges temporary market prices and fundamentals cache. Sector Cache (<code>stockSectorCache</code>) remains completely intact.
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-btn-v2 dm-btn-outline-danger shrink-0"
                  onClick={handleClearStockCaches}
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </>
        ) : (
          // --- VIEW 2: CONFIRMATION DANGER ZONE ---
          <div className="settings-card danger-zone-card">
            <h3 className="danger-zone-title">
              ⚠️ Danger Zone
            </h3>
            <p className="danger-zone-text">
              You are about to permanently delete <strong>{selectedWeeks.length} week(s)</strong> of data from the <strong>{country}</strong> database. This action involves erasing all meticulously recorded parameters, tags, and stock notes. This <strong>cannot</strong> be reversed.
            </p>

            <div className="danger-zone-target-box">
              <span className="target-box-label">Targeted Weeks: </span>
              <span className="target-box-value">{selectedWeeks.join(", ")}</span>
            </div>

            <label className="settings-label-v2 settings-label-mb">
              To confirm, type <strong>{REQUIRED_CONFIRM_TEXT}</strong> below:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={REQUIRED_CONFIRM_TEXT}
              className={`settings-input-v2 danger-confirm-input ${confirmText === REQUIRED_CONFIRM_TEXT ? "valid" : confirmText ? "invalid" : ""}`}
              autoFocus
            />
          </div>
        )}
      </div>
      
      <div className="modal-actions settings-modal-actions">
        
        {!showConfirm ? (
          <>
            <button 
              type="button" 
              className="settings-btn-v2 dm-btn-outline-danger" 
              onClick={() => setShowConfirm(true)}
              disabled={selectedWeeks.length === 0}
            >
              Delete Selected ({selectedWeeks.length})
            </button>
            <button type="button" className="settings-btn-v2 dm-btn-regular" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <button 
              type="button" 
              className="settings-btn-v2 dm-btn-cancel" 
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="settings-btn-v2 dm-btn-final-danger" 
              onClick={handleBulkDelete}
              disabled={confirmText !== REQUIRED_CONFIRM_TEXT}
            >
              Permanently Delete
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default DataManagementModal;
