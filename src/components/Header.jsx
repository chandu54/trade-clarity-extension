import { useState, useRef, useEffect } from "react";
import { useConfirm } from "./ConfirmContext";

const MENU_ITEMS = [
  {
    label: "Parameters",
    title: "Define stock metrics, input types, and ideal values used for analysis",
    key: "params",
  },
  {
    label: "Filters",
    title: "Choose which parameters, sectors, and flags can be used to filter stocks",
    key: "filter",
  },
  {
    label: "Columns",
    title: "Control which columns appear in the grid and their order",
    key: "columns",
  },
  {
    label: "Sectors",
    title: "Add, edit, or organize stock sectors used across the app",
    key: "sectors",
  },
  {
    label: "Tags",
    title: "Manage global tags for stocks",
    key: "tags",
  },
  {
    label: "Editing Rules",
    title: "Set rules for editing data across weeks and lock previous entries",
    key: "rules",
  },
];

const USFlag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" style={{ width: "22px", height: "16px", borderRadius: "2px", display: "block" }}>
    <path fill="#bd3d44" d="M0 0h640v480H0" />
    <path stroke="#fff" strokeWidth="37" d="M0 55h640M0 129h640M0 203h640M0 277h640M0 351h640M0 425h640" />
    <path fill="#192f5d" d="M0 0h364.8v258.5H0" />
    <path fill="#fff" d="M65 35l13 42-35-26h44L52 77z" />
  </svg>
);

const INFlag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" style={{ width: "22px", height: "16px", borderRadius: "2px", display: "block" }}>
    <path fill="#f93" d="M0 0h900v200H0z" />
    <path fill="#fff" d="M0 200h900v200H0z" />
    <path fill="#138808" d="M0 400h900v200H0z" />
    <circle cx="450" cy="300" r="80" fill="none" stroke="#000080" strokeWidth="20" />
  </svg>
);

const FLAGS = {
  US: USFlag,
  IN: INFlag,
};

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#f59e0b" }}>
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = ({ size = 18 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6366f1"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
  </svg>
);

const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export default function Header({ onOpenModal, onClearAll, onManageTags, theme, onToggleTheme, onShowSettings, onShowUserGuide, country, setCountry }) {
  const [open, setOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const menuRef = useRef(null);
  const regionRef = useRef(null);
  const { confirm } = useConfirm();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (regionRef.current && !regionRef.current.contains(e.target)) {
        setRegionOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleMenuClick = (modalKey) => {
    setOpen(false);
    if (modalKey === "tags") {
      onManageTags();
    } else {
      onOpenModal(modalKey);
    }
  };

  const handleClearAll = async () => {
    if (await confirm("⚠️ All data will be permanently deleted. Continue?")) {
      onClearAll();
    }
  };

  const CurrentFlag = FLAGS[country];

  return (
    <div className="header">
      <div className="header-title">
        <h2 className="app-name">TradeClarity</h2>
        <span className="app-tagline-v2">Your disciplined path to smarter trades</span>
      </div>
      <div className="header-actions">
        <div className="header-group system-controls">
          <div className="region-selector-v2" ref={regionRef}>
            <button
              className="region-trigger"
              onClick={() => setRegionOpen(!regionOpen)}
              title="Change Region"
            >
              <CurrentFlag />
              <span className="region-label">{country}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`chevron-icon ${regionOpen ? "open" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {regionOpen && (
              <div className="action-dropdown shadow region-menu">
                <div className="dropdown-header">Select Region</div>
                {Object.entries(FLAGS).map(([code, FlagComponent]) => (
                  <button key={code} className="dropdown-item" onClick={() => { setCountry(code); setRegionOpen(false); }}>
                    <FlagComponent />
                    <span>{code === "US" ? "United States" : "India"}</span>
                    {country === code && <span className="check-mark">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className="theme-toggle"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </div>
        </div>

        <div className="header-divider" />

        <div className="header-group app-tools">
          <button
            className="nav-icon-btn"
            onClick={onShowUserGuide}
            title="User Guide"
          >
            <BookIcon />
            <span>Guide</span>
          </button>

          <div className="settings-wrapper" ref={menuRef}>
            <button
              className="settings-cta"
              onClick={() => setOpen((o) => !o)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>

            {open && (
              <div className="action-dropdown shadow">
                {MENU_ITEMS.map(({ label, title, key }) => (
                  <button
                    key={key}
                    className="dropdown-item"
                    title={title}
                    onClick={() => handleMenuClick(key)}
                  >
                    {label}
                  </button>
                ))}
                <li className="divider" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setOpen(false);
                    onShowSettings();
                  }}
                >
                  ✨ AI Integration
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="header-divider" />

        <button className="ghost-danger-btn" onClick={handleClearAll} title="Reset All Application Data">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Reset All
        </button>
      </div>
    </div>
  );
}
