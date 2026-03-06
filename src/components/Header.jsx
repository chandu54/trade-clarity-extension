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
    <path fill="#bd3d44" d="M0 0h640v480H0"/>
    <path stroke="#fff" strokeWidth="37" d="M0 55h640M0 129h640M0 203h640M0 277h640M0 351h640M0 425h640"/>
    <path fill="#192f5d" d="M0 0h364.8v258.5H0"/>
    <path fill="#fff" d="M65 35l13 42-35-26h44L52 77z"/>
  </svg>
);

const INFlag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" style={{ width: "22px", height: "16px", borderRadius: "2px", display: "block" }}>
    <path fill="#f93" d="M0 0h900v200H0z"/>
    <path fill="#fff" d="M0 200h900v200H0z"/>
    <path fill="#138808" d="M0 400h900v200H0z"/>
    <circle cx="450" cy="300" r="80" fill="none" stroke="#000080" strokeWidth="20"/>
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

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#94a3b8" }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
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
        <span className="app-tagline">Your disciplined path to smarter trades</span>
      </div>
      <div className="header-actions">
        <div style={{ position: "relative", display: "flex", alignItems: "center", marginRight: "8px" }} ref={regionRef}>
          <span style={{ fontSize: "14px", fontWeight: "600", marginRight: "8px" }}>Region:</span>
          <button
            className="outline"
            onClick={() => setRegionOpen(!regionOpen)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", minWidth: "80px", justifyContent: "space-between", background: "var(--panel)" }}
            title="Select Region"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CurrentFlag />
              <span>{country}</span>
            </div>
            <span style={{ fontSize: "10px", opacity: 0.6 }}>▼</span>
          </button>

          {regionOpen && (
            <div className="settings-menu" style={{ width: "140px", top: "100%", right: "auto", left: "56px" }}>
              {Object.entries(FLAGS).map(([code, FlagComponent]) => (
                <button key={code} onClick={() => { setCountry(code); setRegionOpen(false); }} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                  <FlagComponent />
                  <span>{code === "US" ? "United States" : "India"}</span>
                  {country === code && <span style={{ marginLeft: "auto", fontSize: "12px" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div 
          style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "12px" }}
          title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          <label className="switch">
            <input type="checkbox" checked={theme === "dark"} onChange={onToggleTheme} />
            <span className="slider" />
          </label>
          <span style={{ display: "flex", alignItems: "center" }}>
            {theme !== "dark" ? <MoonIcon /> : <SunIcon />}
          </span>
        </div>

        <button 
          className="outline header-guide-btn"
          onClick={onShowUserGuide}
          title="Open User Guide"
          style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "8px" }}
        >
          <BookIcon />
          <span>Guide</span>
        </button>

        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            title="Click to see settings menu"
          >
            ⚙️ Settings
          </button>

          {open && (
            <div className="settings-menu">
              {MENU_ITEMS.map(({ label, title, key }) => (
                <button
                  key={key}
                  title={title}
                  onClick={() => handleMenuClick(key)}
                >
                  {label}
                </button>
              ))}
              <button
                title="Configure AI integration settings"
                onClick={() => {
                  setOpen(false);
                  onShowSettings();
                }}
              >
                AI Settings
              </button>
            </div>
          )}
        </div>

        <button className="danger" onClick={handleClearAll} title="Clear all data in the app">
          Clear All Data
        </button>
      </div>
    </div>
  );
}
