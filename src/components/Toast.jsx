import { useEffect } from "react";

export default function Toast({ message, type = "info", onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast-container toast-${type}`}>
      <span className="toast-message">{message}</span>
      <button onClick={onClose} className="toast-close">
        &times;
      </button>
    </div>
  );
}