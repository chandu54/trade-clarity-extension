import React from 'react';

export default function MainNavigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'watchlists', label: 'Watchlists' },
    { id: 'market-pulse', label: 'Market Pulse' },
    { id: 'journal', label: 'Journal' },
  ];

  return (
    <nav className="main-nav">
      <div className="nav-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
          >
            <span className="nav-tab-label">{tab.label}</span>
            {tab.tag && <span className="nav-tab-tag">{tab.tag}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
