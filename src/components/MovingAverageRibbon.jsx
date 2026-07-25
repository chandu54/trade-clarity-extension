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

  return (
    <div className={`ma-ribbon-v2 ${variant === 'compact' ? 'compact-ribbon' : ''}`} title={value}>
      {showLabel && (
        <span className={variant === 'compact' ? 'ma-label-compact' : 'ma-label-full'}>
          {variant === 'compact' ? 'MA' : 'Moving Averages'}
          <span className="ma-label-colon">:</span>
        </span>
      )}
      {mas.map((ma) => {
        const isAbove = aboveSet.has(ma);
        return (
          <div
            key={ma}
            className={`ma-badge-v2 ${isAbove ? 'above' : 'below'} ${variant === 'compact' ? 'compact-badge' : ''}`}
            title={`Price is ${isAbove ? "ABOVE" : "BELOW"} the ${ma} MA`}
          >
            {ma}
          </div>
        );
      })}
    </div>
  );
}

export default MovingAverageRibbon;
