import React, { useState, useEffect, useRef } from "react";

export default function MultiSelectDropdown({
  options = [],
  value = [],
  onChange,
  placeholder = "Select...",
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && options.length > 0 && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, options.length]);

  const handleToggle = (option) => {
    let newValue;
    if (value.includes(option)) {
      newValue = value.filter((v) => v !== option);
    } else {
      newValue = [...value, option];
    }
    onChange(newValue);
  };

  const selectedText =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  const filteredOptions = options.filter((option) =>
    String(option).toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="multi-select-container" ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`multi-select-trigger ${isOpen ? "open" : ""} ${value.length > 0 ? "has-value" : ""}`}
        onClick={() => {
          setIsOpen((prev) => {
            if (prev) setSearchTerm("");
            return !prev;
          });
        }}
        title={value.length > 1 ? value.join(", ") : undefined}
      >
        <span className="multi-select-text">{selectedText}</span>
        <span className="multi-select-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="multi-select-dropdown">
          {options.length > 0 && (
            <div className="multi-select-search-container" onClick={(e) => e.stopPropagation()}>
              <svg
                className="multi-select-search-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="multi-select-search-input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="multi-select-search-clear"
                  onClick={() => setSearchTerm("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className="multi-select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="multi-select-empty">
                {options.length === 0 ? "No options" : "No matching options"}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option);
                return (
                  <div
                    key={option}
                    className={`multi-select-option ${isSelected ? "selected" : ""}`}
                    onClick={() => handleToggle(option)}
                  >
                    <div className={`multi-select-checkbox ${isSelected ? "checked" : ""}`}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="multi-select-label">{option}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
