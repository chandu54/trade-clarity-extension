import { createContext, useContext, useState, useCallback } from "react";
import Modal from "./Modal";

export const ConfirmContext = createContext({
  confirm: (message) => {
    // Fallback to native confirm if Provider is missing
    return Promise.resolve(window.confirm(message));
  },
});

export function ConfirmProvider({ children }) {
  const [confirmation, setConfirmation] = useState(null);
  const [inputText, setInputText] = useState("");

  const confirm = useCallback((message, requiredText = null) => {
    return new Promise((resolve) => {
      setInputText("");
      setConfirmation({
        message,
        requiredText,
        resolve: (result) => {
          setConfirmation(null);
          resolve(result);
        },
      });
    });
  }, []);

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
            <p className={`confirm-modal-text ${confirmation.requiredText ? "mb-4" : "mb-0"}`}>
              {confirmation.message}
            </p>
            {confirmation.requiredText && (
              <>
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
              </>
            )}
          </div>
          <div className="modal-footer">
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
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
