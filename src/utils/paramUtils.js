
export function isParamRelevantForCountry(paramDef, country) {
  if (!paramDef || !paramDef.countries || paramDef.countries.length === 0) return true;
  return paramDef.countries.includes(country);
}

export function doesParamPassCheck(value, paramDef) {
  if (!paramDef || paramDef.isCheck === false) return false;

  const type = paramDef.type;
  const idealValues = paramDef.idealValues || [];

  if (type === "checkbox") {
    return value === true;
  }

  if (type === "number") {
    if (value === undefined || value === "" || value === null) return false;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return false;

    if (idealValues.length === 0) return false;

    return idealValues.some((ideal) => {
      const cond = String(ideal).trim();
      
      // 1. Comparison Operators
      if (cond.startsWith(">=")) return numVal >= parseFloat(cond.slice(2));
      if (cond.startsWith("<=")) return numVal <= parseFloat(cond.slice(2));
      if (cond.startsWith(">")) return numVal > parseFloat(cond.slice(1));
      if (cond.startsWith("<")) return numVal < parseFloat(cond.slice(1));
      
      // 2. Numerical Range (Format: "MIN - MAX")
      if (cond.includes("-")) {
        const parts = cond.split("-").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return numVal >= parts[0] && numVal <= parts[1];
        }
      }
      
      // 3. Exact Numeric Equality
      return numVal == parseFloat(cond);
    });
  }

  if (type === "date") {
    if (!value) return false;
    if (idealValues.length === 0) return false;

    return idealValues.some((ideal) => {
      const cond = String(ideal).trim();
      if (cond.startsWith(">=")) return value >= cond.slice(2).trim();
      if (cond.startsWith("<=")) return value <= cond.slice(2).trim();
      if (cond.startsWith(">")) return value > cond.slice(1).trim();
      if (cond.startsWith("<")) return value < cond.slice(1).trim();
      return value === cond;
    });
  }

  // Fallback for select/text/other
  if (!value) return false;
  return idealValues.some((ideal) => String(ideal) == String(value));
}


export function getStockCheckSummary(stock, paramDefinitions, country) {
  const checkParams = Object.entries(paramDefinitions).filter(([, p]) => {
    if (p.isCheck === false) return false;
    return isParamRelevantForCountry(p, country);
  });
  
  const total = checkParams.length;
  if (total === 0) return { passed: 0, total: 0, ratio: 0 };
  
  let passed = 0;
  checkParams.forEach(([id, p]) => {
    const value = stock.params?.[id];
    if (doesParamPassCheck(value, p)) {
      passed++;
    }
  });

  return { passed, total, ratio: passed / total };
}

/**
 * Data scrubbing utility to fix orphaned or incorrectly scoped parameter definitions.
 * It also retires legacy global parameters (liquidity, adr) that have been superseded by country-specific versions.
 */
export function scrubParamDefinitions(currentData) {
  if (!currentData || !currentData.paramDefinitions) return currentData;

  let changed = false;
  const newParams = { ...currentData.paramDefinitions };

  Object.keys(newParams).forEach(key => {
    const p = newParams[key];
    const isMissingCountries = !p.countries || p.countries.length === 0;

    // 1. Auto-scope known country-specific prefixes if they are currently "Global"
    if (isMissingCountries) {
      if (key.startsWith('in.')) {
        p.countries = ['IN'];
        changed = true;
      } else if (key.startsWith('us.')) {
        p.countries = ['US'];
        changed = true;
      }
    }

    // 2. Retire legacy redundant parameters (Deep Fix for duplicates)
    const isLegacyKey = ['liquidity', 'adr'].includes(key);
    if (isLegacyKey && isMissingCountries) {
      // Hide if market-specific modern keys exist
      if (newParams[`in.${key}`] || newParams[`us.${key}`]) {
        p.countries = ['_legacy_']; 
        changed = true;
      }
    }
  });

  return changed ? { ...currentData, paramDefinitions: newParams } : currentData;
}
