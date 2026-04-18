import { createContext, useContext, useState, useCallback, useRef } from "react";
import Modal from "./Modal";

export const ConfirmContext = createContext({
  confirm: (message) => {
    // Fallback to native confirm if Provider is missing
    return Promise.resolve(window.confirm(message));
  },
});

export function ConfirmProvider({ children, settings = {}, onUpdateSettings }) {
  const [confirmation, setConfirmation] = useState(null);
  const [inputText, setInputText] = useState("");
  const [dontAskAgainState, setDontAskAgainState] = useState(false);
  
  // Use a ref to track the current state value for the resolve closure
  // This avoids the 'confirm' function changing identity and causing mass re-renders (shaking)
  const dontAskAgainRef = useRef(false);

  const confirm = useCallback((message, options = {}) => {
    const { requiredText = null, confirmSettingsKey = null } = 
      typeof options === 'string' ? { requiredText: options } : options;

    return new Promise((resolve) => {
      // If we have a settings key, check if user has opted to skip this confirmation
      if (confirmSettingsKey && settings[confirmSettingsKey]) {
        resolve(true);
        return;
      }

      setInputText("");
      setDontAskAgainState(false);
      dontAskAgainRef.current = false;
      
      setConfirmation({
        message,
        requiredText,
        confirmSettingsKey,
        resolve: (result) => {
          // ALWAYS read from the ref to get the fresh value at resolution time
          if (result && confirmSettingsKey && dontAskAgainRef.current && onUpdateSettings) {
            onUpdateSettings(confirmSettingsKey, true);
          }
          setConfirmation(null);
          resolve(result);
        },
      });
    });
  }, [settings, onUpdateSettings]); // Removed dontAskAgainState from deps to keep identity stable

  const handleDontAskChange = (val) => {
    setDontAskAgainState(val);
    dontAskAgainRef.current = val;
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {confirmation && (
        <Modal
          isOpen={true}
          onClose={() => confirmation.resolve(false)}
          title="Confirm Action"
        >
          <div className="confirm-modal-content">
            <p className="confirm-modal-text">
              {confirmation.message}
            </p>

            {confirmation.requiredText && (
              <div className="mt-4 px-6">
                <label className="settings-label-v2 settings-label-mb text-sm">
                  To confirm, type <strong>{confirmation.requiredText}</strong> below:
                </label>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={confirmation.requiredText}
                  className={`settings-input-v2 danger-confirm-input ${inputText === confirmation.requiredText ? "valid" : inputText ? "invalid" : ""}`}
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="modal-footer confirm-modal-footer">
            <div className="confirm-footer-left">
              {confirmation.confirmSettingsKey && !confirmation.requiredText && (
                <label className="confirm-checkbox-row no-padding">
                  <input 
                    type="checkbox" 
                    checked={dontAskAgainState} 
                    onChange={(e) => handleDontAskChange(e.target.checked)}
                    className="confirm-skip-checkbox"
                  />
                  <span className="confirm-skip-label">Don't ask again</span>
                </label>
              )}
            </div>
            <div className="confirm-footer-right flex gap-3">
              <button
                className="outline"
                onClick={() => confirmation.resolve(false)}
              >
                Cancel
              </button>
              <button
                className={confirmation.requiredText ? "danger" : ""}
                onClick={() => confirmation.resolve(true)}
                disabled={confirmation.requiredText && inputText !== confirmation.requiredText}
                autoFocus={!confirmation.requiredText}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
