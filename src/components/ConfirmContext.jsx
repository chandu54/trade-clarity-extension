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

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmation({
        message,
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
            <p className="confirm-modal-text">
              {confirmation.message}
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="outline"
              onClick={() => confirmation.resolve(false)}
            >
              Cancel
            </button>
            <button
              onClick={() => confirmation.resolve(true)}
              autoFocus
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
