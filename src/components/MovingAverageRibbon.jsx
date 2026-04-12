import React from 'react';

/**
 * MovingAverageRibbon - Centralized technical status visualization
 * 
 * @param {string} value - The comma-separated or descriptive MA status (e.g. "Above all", "Above 5, 10")
 * @param {string} variant - 'full' (standard badges) or 'compact' (mini badges for widget)
 * @param {boolean} showLabel - Whether to show the "MA" identifier
 */
export function MovingAverageRibbon({ value, variant = 'full', showLabel = false }) {
  if (!value || typeof value !== "string") return null;

  const mas = ["5", "10", "21", "50", "200"];
  const aboveSet = new Set();
  const lowerValue = value.toLowerCase();

  // Unified Parsing Logic
  if (lowerValue.includes("above")) {
    if (lowerValue.includes("all")) {
      mas.forEach(m => aboveSet.add(m));
    } else {
      mas.forEach(m => {
        const regex = new RegExp(`\\b${m}\\b`);
        if (regex.test(lowerValue)) {
          aboveSet.add(m);
        }
      });
    }
  }

  // --- COMPACT VARIANT (WIDGET) ---
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5 px-1 py-0.5 rounded-md bg-slate-900/40" title={value}>
        {showLabel && <span className="text-[7px] font-black text-slate-500 mr-0.5 tracking-tighter uppercase leading-none">MA</span>}
        <div className="flex items-center gap-1">
          {mas.map((ma) => {
            const isAbove = aboveSet.has(ma);
            return (
              <div
                key={ma}
                className={`w-[22px] h-[15px] flex items-center justify-center text-[9px] font-black font-mono rounded-[3px] border transition-all duration-300 ${
                  isAbove 
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]" 
                    : "bg-rose-500/20 border-rose-400 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.05)]"
                }`}
                title={`Price is ${isAbove ? "ABOVE" : "BELOW"} the ${ma} MA`}
              >
                {ma}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- FULL VARIANT (GRID / MODAL) ---
  return (
    <div className="flex items-center gap-1.5" title={value}>
      {showLabel && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1 opacity-60">Moving Averages</span>}
      <div className="flex items-center gap-1.5 flex-wrap">
        {mas.map((ma) => {
          const isAbove = aboveSet.has(ma);
          return (
            <div
              key={ma}
              className={`min-w-[32px] px-1.5 h-[20px] flex items-center justify-center text-[10px] font-bold font-mono rounded border transition-colors ${
                isAbove 
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" 
                  : "bg-red-500/10 border-red-500/40 text-red-100" // Red 100 on red background for readability
              }`}
              style={!isAbove ? { color: '#fca5a5' } : {}} // Rose 300 equivalent for text
              title={`Price is ${isAbove ? "ABOVE" : "BELOW"} the ${ma} MA`}
            >
              {ma}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MovingAverageRibbon;
