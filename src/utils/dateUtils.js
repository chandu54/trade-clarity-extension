/**
 * TradeClarity Date Utility
 * Handles conversion of various date formats (DD-MM-YYYY, YYYY-MM-DD) 
 * into standard JS Date objects to ensure chronological accuracy across the platform.
 */
export const parseInstitutionalDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;

  const str = String(val).trim();
  
  // Try DD-MM-YYYY (Common institutional input)
  const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const [_, d, m, y] = dmyMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  // Try YYYY-MM-DD (ISO standard / Storage format)
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [_, y, m, d] = ymdMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  // Fallback for JS native parser
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a date object or string into the institutional DD-MM-YYYY format.
 */
export const formatInstitutionalDate = (val) => {
  const d = parseInstitutionalDate(val);
  if (!d) return val;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};
