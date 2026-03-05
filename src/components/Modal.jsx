import { createPortal } from "react-dom";

export default function Modal({ children, isOpen = true, onClose, title, subtitle }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {(title || subtitle) && (
          <div className="modal-header">
            <div className="modal-title-group">
              {title && <h3>{title}</h3>}
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            {onClose && (
              <button className="modal-close-btn" onClick={onClose}>
                ×
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
