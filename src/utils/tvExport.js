export function generateTradingViewExport({ stocks, stockSectorCache = {}, selectedWlId = "all", groupBy = "sector", country = "IN" }) {
  const stockList = Object.values(stocks || {}).filter((s) => {
    if (!s || !s.symbol) return false;
    if (selectedWlId === "all") return true;
    return s.watchlists && Array.isArray(s.watchlists) && s.watchlists.includes(selectedWlId);
  });

  const formatSymbol = (sym) => {
    if (!sym) return "";
    const cleanSym = sym.trim();
    if (cleanSym.includes(":")) return cleanSym;
    return country === "IN" ? `NSE:${cleanSym}` : cleanSym;
  };

  if (groupBy === "none") {
    return stockList
      .map((s) => formatSymbol(s.symbol))
      .filter(Boolean)
      .join(",");
  }

  if (groupBy === "sector") {
    const sectorMap = {};
    stockList.forEach((s) => {
      const symUpper = s.symbol.toUpperCase();
      const rawSector = s.sector || stockSectorCache?.[symUpper] || "MISCELLANEOUS";
      const secKey = (rawSector || "MISCELLANEOUS").trim().toUpperCase();
      if (!sectorMap[secKey]) sectorMap[secKey] = [];
      sectorMap[secKey].push(s);
    });

    const sectorKeys = Object.keys(sectorMap).sort((a, b) => {
      if (a === "MISCELLANEOUS" || a === "UNASSIGNED") return 1;
      if (b === "MISCELLANEOUS" || b === "UNASSIGNED") return -1;
      return a.localeCompare(b);
    });

    const outputParts = [];
    sectorKeys.forEach((secKey) => {
      const syms = sectorMap[secKey].map((s) => formatSymbol(s.symbol)).filter(Boolean);
      if (syms.length > 0) {
        outputParts.push(`###${secKey}`);
        outputParts.push(...syms);
      }
    });

    return outputParts.join(",");
  }

  if (groupBy === "tag") {
    const tagMap = {};
    stockList.forEach((s) => {
      const tags = s.tags && Array.isArray(s.tags) && s.tags.length > 0 ? s.tags : ["UNTAGGED"];
      tags.forEach((t) => {
        const tagKey = (t || "UNTAGGED").trim().toUpperCase();
        if (!tagMap[tagKey]) tagMap[tagKey] = [];
        if (!tagMap[tagKey].some((item) => item.symbol === s.symbol)) {
          tagMap[tagKey].push(s);
        }
      });
    });

    const tagKeys = Object.keys(tagMap).sort((a, b) => {
      if (a === "UNTAGGED" || a === "NO TAGS") return 1;
      if (b === "UNTAGGED" || b === "NO TAGS") return -1;
      return a.localeCompare(b);
    });

    const outputParts = [];
    tagKeys.forEach((tagKey) => {
      const syms = tagMap[tagKey].map((s) => formatSymbol(s.symbol)).filter(Boolean);
      if (syms.length > 0) {
        outputParts.push(`###${tagKey}`);
        outputParts.push(...syms);
      }
    });

    return outputParts.join(",");
  }

  return "";
}
