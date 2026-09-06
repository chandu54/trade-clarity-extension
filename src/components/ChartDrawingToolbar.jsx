import React, { useState, useRef, useEffect } from 'react';

const COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Yellow', hex: '#f59e0b' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'White', hex: '#f8fafc' },
];

const THICKNESSES = [1, 2, 3];

export default function ChartDrawingToolbar({
  activeTool = 'select',
  onToolChange = () => {},
  selectedColor = '#3b82f6',
  onColorChange = () => {},
  selectedWidth = 2,
  onWidthChange = () => {},
  selectedStyle = 'solid',
  onStyleChange = () => {},
  onClearAll = () => {},
  drawingCount = 0
}) {
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [showStylePopover, setShowStylePopover] = useState(false);

  const containerRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowToolDropdown(false);
        setShowStylePopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const getToolLabel = () => {
    if (activeTool === 'horizontal') return 'Horizontal Line';
    if (activeTool === 'trend') return 'Trendline';
    return 'Draw Tool';
  };

  return (
    <div 
      ref={containerRef}
      className="chart-drawing-toolbar-overlay relative z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 text-slate-200 text-xs border border-slate-700/80 shadow-lg select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. DRAWING TOOL DROPDOWN */}
      <div className="relative">
        <button
          type="button"
          className={`drawing-dropdown-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
            activeTool !== 'select'
              ? 'bg-sky-600 border-sky-500 text-white shadow-md'
              : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80'
          }`}
          onClick={() => {
            setShowToolDropdown(!showToolDropdown);
            setShowStylePopover(false);
          }}
          title="Select Line Drawing Tool"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            {activeTool === 'horizontal' ? (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </>
            ) : activeTool === 'trend' ? (
              <>
                <line x1="4" y1="20" x2="20" y2="4" />
                <circle cx="4" cy="20" r="2" fill="currentColor" />
                <circle cx="20" cy="4" r="2" fill="currentColor" />
              </>
            ) : (
              <path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            )}
          </svg>
          <span>{getToolLabel()}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${showToolDropdown ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {showToolDropdown && (
          <div className="drawing-dropdown-menu absolute top-full left-0 mt-1.5 w-44 p-1 rounded-xl bg-slate-900/98 border border-slate-700/90 shadow-2xl z-50 backdrop-blur-lg flex flex-col gap-0.5">
            <button
              type="button"
              className={`dropdown-option flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTool === 'horizontal'
                  ? 'bg-sky-950/70 text-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => {
                onToolChange('horizontal');
                setShowToolDropdown(false);
              }}
            >
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
                <span>Horizontal Line</span>
              </div>
              {activeTool === 'horizontal' && <span className="text-sky-400 font-bold">✓</span>}
            </button>

            <button
              type="button"
              className={`dropdown-option flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTool === 'trend'
                  ? 'bg-sky-950/70 text-sky-400 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => {
                onToolChange('trend');
                setShowToolDropdown(false);
              }}
            >
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="20" x2="20" y2="4" />
                  <circle cx="4" cy="20" r="2.5" fill="currentColor" />
                  <circle cx="20" cy="4" r="2.5" fill="currentColor" />
                </svg>
                <span>Trendline</span>
              </div>
              {activeTool === 'trend' && <span className="text-sky-400 font-bold">✓</span>}
            </button>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-slate-700/60 mx-0.5" />

      {/* 2. CONSOLIDATED LINE STYLE & COLOR POPOVER BUTTON (Modeled after MA Settings Popover) */}
      <div className="relative">
        <button
          type="button"
          className="style-popover-trigger-btn flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/90 border border-slate-700 hover:bg-slate-700/80 transition-colors text-xs font-medium"
          onClick={() => {
            setShowStylePopover(!showStylePopover);
            setShowToolDropdown(false);
          }}
          title="Line Style & Color Settings"
        >
          <span 
            className="w-3.5 h-3.5 rounded-full border border-slate-500 shadow-inner flex-shrink-0"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="text-slate-300 font-semibold text-[11px]">{selectedWidth}px</span>
          <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">
            {selectedStyle === 'dashed' ? '--' : '—'}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {showStylePopover && (
          <div className="style-popover-panel absolute top-full right-0 mt-1.5 w-52 p-3 rounded-xl bg-slate-900/98 border border-slate-700/90 shadow-2xl z-50 backdrop-blur-xl flex flex-col gap-3">
            <div className="text-[11px] font-bold text-slate-300 tracking-wider uppercase border-b border-slate-800 pb-1.5">
              Line Style Properties
            </div>

            {/* Line Color Swatches */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400">Line Color</span>
              <div className="grid grid-cols-6 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    className={`color-option-btn w-6 h-6 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
                      selectedColor === c.hex ? 'ring-2 ring-sky-400 border-white' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => onColorChange(c.hex)}
                    title={c.name}
                  >
                    {selectedColor === c.hex && (
                      <span className="text-[10px] text-white font-bold drop-shadow-md">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Thickness Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400">Thickness</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
                {THICKNESSES.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`thickness-option-btn py-1 text-xs font-bold rounded-md transition-colors ${
                      selectedWidth === w
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => onWidthChange(w)}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400">Pattern</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
                <button
                  type="button"
                  className={`style-option-btn py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedStyle === 'solid'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => onStyleChange('solid')}
                >
                  Solid —
                </button>
                <button
                  type="button"
                  className={`style-option-btn py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedStyle === 'dashed'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => onStyleChange('dashed')}
                >
                  Dashed - -
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DELETE ALL DRAWINGS BUTTON */}
      {drawingCount > 0 && (
        <>
          <div className="h-4 w-px bg-slate-700/60 mx-0.5" />
          <button
            type="button"
            className="clear-all-drawings-btn flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:bg-rose-900/60 hover:text-rose-100 transition-colors text-xs font-medium"
            onClick={onClearAll}
            title={`Clear all ${drawingCount} drawings on this symbol`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span className="text-[11px] font-bold">{drawingCount}</span>
          </button>
        </>
      )}
    </div>
  );
}
