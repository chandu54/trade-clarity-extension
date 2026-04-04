import { useMemo, useState, useEffect, useRef } from "react";
import AddStockModal from "./AddStockModal";
import EditStockModal from "./EditStockModal";
import ImportWatchlistModal from "./ImportWatchlistModal";
import TrashIcon from "./icons/TrashIcon";
import { useToast } from "./ToastContext";
import { useConfirm } from "./ConfirmContext";
import { doesParamPassCheck, isParamRelevantForCountry } from "../utils/paramUtils";

function getWeekRangeLabel(sundayDateStr) {
  if (!sundayDateStr) return "";
  const [y, m, d] = sundayDateStr.split("-").map(Number);
  const sunday = new Date(y, m - 1, d);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() + 1);
  const friday = new Date(sunday);
  friday.setDate(sunday.getDate() + 5);

  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  return `${formatDate(monday)} to ${formatDate(friday)}`;
}

function parseTradingViewData(content, sectorList) {
  // We split by comma or newline to handle both:
  // 1. Single-line comma-separated strings (like TradingView export Case 2)
  // 2. Multi-line strings (if pasted from a file)
  const parts = content
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const parsedStocks = [];
  let currentSector = "";
  let hasInvalidFormat = false;

  for (const part of parts) {
    // Check for section header (e.g. ###AUTO)
    if (part.startsWith("###")) {
      const rawSector = part.replace(/^###/, "").trim();
      const match = sectorList.find(
        (s) => s.toLowerCase() === rawSector.toLowerCase(),
      );
      if (match) {
        currentSector = match;
      } else {
        currentSector = "";
      }
      continue;
    }

    // Parse stock symbol (e.g. NSE:RELIANCE -> RELIANCE)
    let symbol = part;
    if (part.includes(":")) {
      const split = part.split(":");
      if (split.length > 1) {
        symbol = split[1].trim();
      }
    }

    // Strict validation: Reject if symbol contains invalid characters
    // Allowed: Alphanumeric, dot, hyphen, underscore, ampersand, exclamation, caret, slash, asterisk, plus
    if (/[^A-Z0-9.\-_&!^/*+]/i.test(symbol) || symbol.length > 20) {
      hasInvalidFormat = true;
      break;
    }

    if (symbol) {
      if (!parsedStocks.some((s) => s.symbol === symbol)) {
        parsedStocks.push({ symbol, sector: currentSector });
      }
    }
  }

  if (hasInvalidFormat) {
    throw new Error(
      "Invalid format. Please ensure it is a valid TradingView export.",
    );
  }

  if (parsedStocks.length === 0) {
    throw new Error("No valid stocks found in the input.");
  }

  return parsedStocks;
}

const ClearButton = ({ onClick, isSelect }) => (
  <button
    onClick={onClick}
    style={{
      position: "absolute",
      right: isSelect ? "22px" : "6px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "transparent",
      border: "none",
      color: "#94a3b8",
      cursor: "pointer",
      padding: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
      borderRadius: "50%",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = "#ef4444";
      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = "#94a3b8";
      e.currentTarget.style.backgroundColor = "transparent";
    }}
    title="Clear filter"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      style={{ width: "14px", height: "14px" }}
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  </button>
);

function checkCondition(value, filter, type) {
  if (filter === undefined || filter === "") return true;
  const strFilter = String(filter).trim();

  // Handle Range (e.g. 10-20)
  if (
    strFilter.includes("-") &&
    !strFilter.startsWith("-") &&
    !strFilter.startsWith("<") &&
    !strFilter.startsWith(">") &&
    !strFilter.startsWith("=")
  ) {
    const parts = strFilter.split("-");
    if (parts.length === 2) {
      const minStr = parts[0].trim();
      const maxStr = parts[1].trim();
      if (minStr && maxStr) {
        if (type === "number") {
          const min = parseFloat(minStr);
          const max = parseFloat(maxStr);
          const numVal = parseFloat(value);
          if (!isNaN(min) && !isNaN(max) && !isNaN(numVal)) {
            return numVal >= min && numVal <= max;
          }
        } else if (type === "date") {
          return value >= minStr && value <= maxStr;
        }
      }
    }
  }

  // Handle Operators
  const operators = [">=", "<=", ">", "<", "==", "="];
  for (const op of operators) {
    if (strFilter.startsWith(op)) {
      const targetVal = strFilter.slice(op.length).trim();
      if (targetVal === "") return true;

      if (type === "number") {
        const numStock = parseFloat(value);
        const numTarget = parseFloat(targetVal);
        if (isNaN(numStock) || isNaN(numTarget)) return false;
        if (op === ">=") return numStock >= numTarget;
        if (op === "<=") return numStock <= numTarget;
        if (op === ">") return numStock > numTarget;
        if (op === "<") return numStock < numTarget;
        if (op === "==" || op === "=") return numStock === numTarget;
      } else if (type === "date") {
        if (op === ">=") return value >= targetVal;
        if (op === "<=") return value <= targetVal;
        if (op === ">") return value > targetVal;
        if (op === "<") return value < targetVal;
        if (op === "==" || op === "=") return value === targetVal;
      }
    }
  }

  return String(value || "")
    .toLowerCase()
    .includes(strFilter.toLowerCase());
}

export default function StockGrid({
  data,
  weekKey,
  setData,
  isReadOnly,
  country,
  selectedWatchlistId,
  onExportAll,
  onImportAll,
  availableTags,
  aiSettings,
}) {
  const week = data.weeks?.[country]?.[weekKey];
  const params = data.paramDefinitions;
  const { showToast } = useToast();
  const { confirm } = useConfirm();


  const [showManageParams, setShowManageParams] = useState(false);
  const [showManageSectors, setShowManageSectors] = useState(false);

  const [importPendingStocks, setImportPendingStocks] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState("symbol");
  const [sortDir, setSortDir] = useState("asc");

  const [activeTagDropdown, setActiveTagDropdown] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [editingStock, setEditingStock] = useState(null);
  const [showAddStock, setShowAddStock] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const importTypeRef = useRef("stocks"); // 'stocks', 'backup', or 'tv'
  const [copiedStocks, setCopiedStocks] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target)
      ) {
        setExportMenuOpen(false);
      }
      if (
        importMenuRef.current &&
        !importMenuRef.current.contains(event.target)
      ) {
        setImportMenuOpen(false);
      }
      // Close tag dropdown if click is outside
      if (!event.target.closest(".add-tag-wrapper")) {
        setActiveTagDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const isInputFocused = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      // Alt + N -> Add Stock
      if (e.altKey && e.key.toLowerCase() === 'n') {
        if (!isInputFocused) {
          e.preventDefault();
          setShowAddStock(true);
        }
      }

      // Ctrl + / (or Cmd + /) -> Focus Search Bar
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        // Expand filters if they are collapsed so the search bar is actually visible
        if (!showFilters) setShowFilters(true);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilters]);


  useEffect(() => {
    setCurrentPage(1);
  }, [weekKey, pageSize, filters, sortBy, sortDir, searchQuery]);

  /* =====================
     BASE DATASET
  ===================== */
  const allStocks = useMemo(() => Object.values(week?.stocks || {}), [week]);

  /* =====================
     COLUMN CONFIG
  ===================== */
  const columnConfig = data.uiConfig?.columnVisibility || {};
  const showNotes = columnConfig["__notes__"] !== false;

  const activeWatchlist = (data.watchlists || []).find(w => w.id === selectedWatchlistId);

  const visibleParams = Object.entries(params).filter(([key, p]) => {
    if (!isParamRelevantForCountry(p, country)) return false;
    if (selectedWatchlistId !== "all" && activeWatchlist) {
      return (activeWatchlist.visibleParams || []).includes(key);
    }
    return columnConfig[key] !== false;
  });

  const colCount =
    1 + // Stock
    1 + // Sector
    visibleParams.length +
    1 + // Checks Passed
    (showNotes ? 1 : 0) +
    1 + // Tradable
    1; // Delete

  /* =====================
     FILTERABLE PARAMS
  ===================== */
  const filterableParams = useMemo(() => {
    return Object.entries(params).filter(([key, p]) => {
      if (!isParamRelevantForCountry(p, country)) return false;
      if (selectedWatchlistId !== "all" && activeWatchlist) {
        return (activeWatchlist.visibleFilters || []).includes(key);
      }
      return p.filterable;
    });
  }, [params, selectedWatchlistId, activeWatchlist, country]);

  const isSectorFilterable = data.uiConfig?.sectorFilterable === true;
  const isTradableFilterable = data.uiConfig?.tradableFilterable === true;
  const isTagFilterable = data.uiConfig?.tagFilterable === true;
  const showTags = data.uiConfig?.showTags !== false;

  const sectors = useMemo(() => {
    const rawSectors = data.uiConfig?.sectors || [];
    return rawSectors
      .filter(s => {
        // Handle legacy string format or items with empty countries array
        if (typeof s === 'string') return true;
        if (!s.countries || s.countries.length === 0) return true;
        return s.countries.includes(country);
      })
      .map(s => typeof s === 'string' ? s : s.name)
      .sort((a, b) => a.localeCompare(b));
  }, [data.uiConfig?.sectors, country]);

  /* =====================
     CHECKS PASSED
  ===================== */
  function renderChecksBadge(stock) {
    const checkParams = visibleParams.filter(([, p]) => p.isCheck === true);
    const total = checkParams.length;
    if (total === 0) return <span className="checks-none">—</span>;

    let passed = 0;
    checkParams.forEach(([key, p]) => {
      if (doesParamPassCheck(stock.params?.[key], p)) {
        passed++;
      }
    });

    const ratio = passed / total;
    let statusClass = "poor";
    if (ratio >= 0.8) statusClass = "excellent";
    else if (ratio >= 0.6) statusClass = "good";
    else if (ratio >= 0.4) statusClass = "average";

    return (
      <div className={`checks-badge ${statusClass}`} title={`${passed} of ${total} checks passed`}>
        <span className="passed-count">{passed}</span>
        <span className="separator">/</span>
        <span className="total-count">{total}</span>
      </div>
    );
  }

  // Helper for export/sort logic
  function getChecksCount(stock) {
    const checkParams = visibleParams.filter(([, p]) => p.isCheck === true);
    let passed = 0;
    checkParams.forEach(([key, p]) => {
      if (doesParamPassCheck(stock.params?.[key], p)) {
        passed++;
      }
    });
    return passed;
  }

  /* =====================
     FILTER LOGIC (FULL DATASET)
  ===================== */
  const filteredStocks = useMemo(() => {
    return allStocks.filter((stock) => {
      /* WATCHLIST FILTER */
      if (selectedWatchlistId !== "all") {
        const stockWatchlists = stock.watchlists || [];
        if (!stockWatchlists.includes(selectedWatchlistId)) return false;
      }

      /* SEARCH FILTER */
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const symbolMatch = stock.symbol.toLowerCase().includes(q);
        const notesMatch = (stock.notes || "").toLowerCase().includes(q);
        if (!symbolMatch && !notesMatch) return false;
      }

      /*SECTOR FILTER*/
      if (isSectorFilterable) {
        const sectorFilter = filters.__sector__;
        if (sectorFilter && stock.sector !== sectorFilter) {
          return false;
        }
      }
      /* TRADABLE FILTER */
      const tradableFilter = filters.__tradable__;
      if (tradableFilter !== undefined && tradableFilter !== "") {
        if (stock.tradable !== tradableFilter) {
          return false;
        }
      }
      /* TAG FILTER */
      if (isTagFilterable) {
        const tagFilter = filters.__tag__;
        if (tagFilter && tagFilter !== "") {
          if (!stock.tags || !stock.tags.includes(tagFilter)) {
            return false;
          }
        }
      }
      /*Param FILTER*/
      return filterableParams.every(([key, p]) => {
        const filterVal = filters[key];
        if (filterVal === undefined || filterVal === "") return true;

        const stockVal = stock.params?.[key];

        if (p.type === "checkbox") {
          return Boolean(stockVal) === filterVal;
        }

        if (p.type === "select") {
          return stockVal === filterVal;
        }

        if (p.type === "number") {
          return checkCondition(stockVal, filterVal, "number");
        }

        if (p.type === "date") {
          return checkCondition(stockVal, filterVal, "date");
        }

        if (p.type === "text") {
          return (stockVal || "")
            .toLowerCase()
            .includes(String(filterVal).toLowerCase());
        }

        return true;
      });
    });
  }, [
    allStocks,
    filters,
    filterableParams,
    isSectorFilterable,
    isTagFilterable,
    searchQuery,
    selectedWatchlistId,
  ]);

  /* =====================
     SORT LOGIC (FULL FILTERED DATA)
  ===================== */
  const sortedStocks = useMemo(() => {
    if (!sortBy) return filteredStocks;

    return [...filteredStocks].sort((a, b) => {
      let aVal, bVal;

      if (sortBy === "__checks__") {
        aVal = getChecksCount(a);
        bVal = getChecksCount(b);
      } else {
        aVal = a[sortBy] ?? a.params?.[sortBy];
        bVal = b[sortBy] ?? b.params?.[sortBy];
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric Sort
      const paramDef = params[sortBy];
      if (paramDef?.type === "number") {
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (isNaN(aNum) && isNaN(bNum)) return 0;
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      }

      if (paramDef?.type === "select" && Array.isArray(paramDef.options)) {
        const aIdx = paramDef.options.indexOf(aVal);
        const bIdx = paramDef.options.indexOf(bVal);
        // If one of the values is not found in options, it will be -1
        return sortDir === "asc" ? aIdx - bIdx : bIdx - aIdx;
      }

      if (typeof aVal === "boolean") {
        return sortDir === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }

      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredStocks, sortBy, sortDir]);


  const totalPages = Math.max(1, Math.ceil(sortedStocks.length / pageSize));


  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const stocks = sortedStocks.slice(start, end);


  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }


  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearFilters() {
    setFilters({});
    setSearchQuery("");
  }

  const activeFilters = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (value === undefined || value === "") return false;
      return true;
    });
  }, [filters]);


  const [colWidths, setColWidths] = useState({});

  const handleMouseDown = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.target.closest("th");
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;

    const handleMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("resizing");
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.classList.add("resizing");
  };

  const resetColWidth = (e, colKey) => {
    e.stopPropagation();
    setColWidths((prev) => {
      const newWidths = { ...prev };
      delete newWidths[colKey];
      return newWidths;
    });
  };

  /* =====================
     CRUD
  ===================== */
  function handleAddStock(input, selectedWlIds = []) {
    const symbols = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (symbols.length === 0) return;

    let sentBackgroundMessage = false;

    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };
      const newSymbolsAdded = [];

      symbols.forEach((symbol) => {
        if (!newStocks[symbol]) {
          newStocks[symbol] = {
            symbol,
            sector: "",
            tradable: false,
            notes: "",
            tags: [],
            params: {},
            watchlists: [...selectedWlIds],
          };
          newSymbolsAdded.push(symbol);
        } else if (selectedWlIds.length > 0) {
          const existing = newStocks[symbol];
          const mergedWls = Array.from(new Set([...(existing.watchlists || []), ...selectedWlIds]));
          newStocks[symbol] = {
            ...existing,
            watchlists: mergedWls
          };
        }
      });

      // Trigger background API hydration immediately if enabled
      if (newSymbolsAdded.length > 0 && prev.uiConfig?.enableApiHydration === true) {
        if (chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            action: "FETCH_STOCK_METRICS",
            payload: {
              symbols: newSymbolsAdded,
              country,
              weekKey,
              paramDefs: prev.paramDefinitions,
              adrDays: prev.uiConfig?.adrDays || 20,
              liquidityDays: prev.uiConfig?.liquidityDays || 20
            }
          });
          sentBackgroundMessage = true;
        }
      }

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
    showToast(`Added ${symbols.length} stock(s) to watchlist${sentBackgroundMessage ? '. Fetching metrics in background...' : ''}`, "success");
  }

  function handleUpdateStock(updatedStock) {
    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };
      newStocks[updatedStock.symbol] = updatedStock;

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
  }

  async function deleteStock(symbol) {
    if (!(await confirm(`Delete ${symbol}?`))) return;
    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };
      delete newStocks[symbol];
      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...prevWeek,
              stocks: newStocks,
            },
          },
        },
      };
    });
  }

  function addTag(stock, tag) {
    if (!tag || stock.tags?.includes(tag)) return;

    const newTags = [...(stock.tags || []), tag];
    stock.tags = newTags;
    setData({ ...data });
  }

  function removeTag(stock, tagToRemove) {
    if (!stock.tags) return;
    stock.tags = stock.tags.filter((t) => t !== tagToRemove);
    setData({ ...data });
  }

  function renderSortIndicator(col) {
    const isActive = sortBy === col;
    return (
      <span className={`sort-indicator-v3 ${isActive ? "active" : ""}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`sort-up ${isActive && sortDir === "asc" ? "on" : ""}`}>
          <path d="m18 15-6-6-6 6" />
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`sort-down ${isActive && sortDir === "desc" ? "on" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    );
  }

  function getExportFilename(extension, scope) {
    let dateLabel = "all";
    if (weekKey) {
      const [y, m, d] = weekKey.split("-").map(Number);
      const sunday = new Date(y, m - 1, d);
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() + 1);
      const friday = new Date(sunday);
      friday.setDate(sunday.getDate() + 5);

      const formatDate = (date) => {
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
      };
      dateLabel = `${formatDate(monday)}_to_${formatDate(friday)}`;
    }
    return `stocks_export_${scope}_${dateLabel}.${extension}`;
  }

  // Exported for CSV export
  function handleExport(format, scope) {
    setExportMenuOpen(false);
    if (format === "csv") {
      handleExportCSV(scope);
    } else if (format === "json") {
      handleExportJSON(scope);
    }
  }

  function handleExportCSV(scope = "filtered") {
    const exportData = scope === "all" ? allStocks : sortedStocks;

    if (!exportData || exportData.length === 0) {
      showToast("No data to export!", "warning");
      return;
    }
    const headers = [
      "Symbol",
      "Sector",
      ...visibleParams.map(([key]) => data.paramDefinitions[key]?.label || key),
      "Checks Passed",
      "Tags",
      "Tradable",
      "Notes",
    ];

    const rows = exportData.map((stock) => {
      const checks = getChecksResult(stock);
      return [
        stock.symbol,
        stock.sector,
        ...visibleParams.map(([key]) => stock.params?.[key] ?? ""),
        checks,
        (stock.tags || []).join(", "),
        stock.tradable ? "Yes" : "No",
        stock.notes ?? "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", getExportFilename("csv", scope));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported CSV successfully", "success");
  }

  function handleExportJSON(scope = "filtered") {
    const exportData = scope === "all" ? allStocks : sortedStocks;

    if (!exportData || exportData.length === 0) {
      showToast("No data to export!", "warning");
      return;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", getExportFilename("json", scope));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported JSON successfully", "success");
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input value to allow re-importing the same file if needed
    e.target.value = "";

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target.result;

      if (importTypeRef.current === "tv") {
        try {
          const sectorList = data.uiConfig?.sectors || [];
          const parsedStocks = parseTradingViewData(content, sectorList);
          setImportPendingStocks(parsedStocks);
        } catch (err) {
          console.error(err);
          showToast(err.message || "Failed to parse text file", "error");
        }
        return;
      }

      try {
        const json = JSON.parse(content);

        if (importTypeRef.current === "backup") {
          onImportAll(json);
        } else {
          // Stock Import Validation
          if (!Array.isArray(json)) {
            const example = [
              { symbol: "AAPL", sector: "Technology", tradable: true },
            ];
            alert(
              `Invalid Import File.\n\nExpected a JSON Array of stocks.\n\nExample Format:\n${JSON.stringify(example, null, 2)}`,
            );
            return;
          }
          if (json.length > 0 && !json[0].symbol) {
            const example = [{ symbol: "AAPL", sector: "Technology" }];
            alert(
              `Invalid Stock Data.\n\nItems in the array are missing the 'symbol' property.\n\nExample Format:\n${JSON.stringify(example, null, 2)}`,
            );
            return;
          }
          setImportPendingStocks(json);
        }
      } catch (err) {
        console.error(err);
        showToast("Failed to parse JSON file", "error");
      }
    };

    reader.readAsText(file);
  }

  function triggerImport(type) {
    importTypeRef.current = type;
    setImportMenuOpen(false);
    if (fileInputRef.current) {
      if (type === "tv") {
        fileInputRef.current.accept = ".txt,.csv";
      } else {
        fileInputRef.current.accept = ".json";
      }
      fileInputRef.current.click();
    }
  }

  function importStocks(stocksArray) {
    if (!stocksArray || stocksArray.length === 0) return;

    let sentBackgroundMessage = false;

    setData((prev) => {
      const currentWeekData = prev.weeks[country][weekKey] || { stocks: {} };
      const newStocks = { ...currentWeekData.stocks };
      let count = 0;
      const newSymbolsAdded = [];

      stocksArray.forEach((s) => {
        if (s.symbol && !newStocks[s.symbol]) {
          newSymbolsAdded.push(s.symbol);
        }
        if (s.symbol) {
          // Merge params if the stock already exists, otherwise just overwrite/add
          const existing = newStocks[s.symbol];

          const base = {
            symbol: s.symbol,
            sector: "",
            tradable: false,
            notes: "",
            tags: [],
            params: {},
          };

          newStocks[s.symbol] = {
            ...base,
            ...existing,
            ...s,
            params: { ...(existing?.params || {}), ...(s.params || {}) },
            tags: s.tags || existing?.tags || [],
            watchlists: Array.from(new Set([...(existing?.watchlists || []), ...(s.watchlists || [])])),
          };
          count++;
        }
      });

      // Trigger background API hydration immediately if enabled
      if (newSymbolsAdded.length > 0 && prev.uiConfig?.enableApiHydration === true) {
        if (chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            action: "FETCH_STOCK_METRICS",
            payload: {
              symbols: newSymbolsAdded,
              country,
              weekKey,
              paramDefs: prev.paramDefinitions,
              adrDays: prev.uiConfig?.adrDays || 20,
              liquidityDays: prev.uiConfig?.liquidityDays || 20
            }
          });
          sentBackgroundMessage = true;
        }
      }

      if (count > 0) {
        showToast(`Imported ${count} stocks successfully.${sentBackgroundMessage ? ' Fetching metrics in background...' : ''}`, "success");
      }

      return {
        ...prev,
        weeks: {
          ...prev.weeks,
          [country]: {
            ...prev.weeks[country],
            [weekKey]: {
              ...currentWeekData,
              stocks: newStocks,
            },
          },
        },
      };
    });
  }

  /* =====================
     RENDER
  ===================== */
  return (
    <div className="grid-wrapper">
      {/* FILTER BAR */}
      {(filterableParams.length > 0 ||
        isSectorFilterable ||
        (availableTags.length > 0 && isTagFilterable)) && (
          <div className={`filter-bar ${!showFilters ? "collapsed" : ""}`}>
            <div className="filter-top-row">
              <div className="filter-top-left">
                <div className="filter-toggle-group" onClick={() => setShowFilters(!showFilters)}>
                  <span className="filter-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  </span>
                  <span className="filter-label">Filters</span>
                  {activeFilters.length > 0 && (
                    <span className="active-filter-badge">{activeFilters.length}</span>
                  )}
                  <span className={`filter-chevron ${showFilters ? "open" : ""}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>

                {activeFilters.length > 0 && (
                  <button
                    className="reset-filters-btn-v2"
                    onClick={(e) => { e.stopPropagation(); setFilters({}); }}
                    title="Clear all active filters"
                  >
                    Reset Filters
                  </button>
                )}

                <div className="search-box-v2">
                  <span className="search-icon-v2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search symbols..."
                    aria-label="Search symbols"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setSearchQuery("")}
                      title="Clear search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="active-filters-summary">
                {!showFilters && activeFilters.length > 0 && activeFilters.map(([key, value]) => {
                  let label = key;
                  if (key === "__sector__") label = "Sector";
                  else if (key === "__tag__") label = "Tag";
                  else if (key === "__tradable__") label = "Tradable";
                  else label = params[key]?.label || key;

                  let displayValue = value;
                  if (typeof value === "boolean") displayValue = value ? "Yes" : "No";

                  return (
                    <span key={key} className="summary-pill">
                      {label}: <strong>{displayValue}</strong>
                    </span>
                  );
                })}
              </div>

              <div className="filter-actions">
                <button className="toggle-filters-btn" onClick={() => setShowFilters(!showFilters)}>
                  {showFilters ? "Collapse" : "Show All Filters"}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="filter-items">
                {isSectorFilterable && (
                  <div className="filter-item">
                    <label htmlFor="sector-filter">Sector</label>
                    <div style={{ position: "relative", width: "100%" }}>
                      <select
                        id="sector-filter"
                        className="select-control"
                        value={filters.__sector__ || ""}
                        onChange={(e) => setFilter("__sector__", e.target.value)}
                        style={{ width: "100%", paddingRight: "24px" }}
                      >
                        <option value="">All</option>
                        {sectors.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {filters.__sector__ && filters.__sector__ !== "" && (
                        <ClearButton
                          onClick={() => setFilter("__sector__", "")}
                          isSelect
                        />
                      )}
                    </div>
                  </div>
                )}

                {(availableTags || []).length > 0 && isTagFilterable && (
                  <div className="filter-item">
                    <label htmlFor="tag-filter">Tag</label>
                    <div style={{ position: "relative", width: "100%" }}>
                      <select
                        id="tag-filter"
                        className="select-control"
                        value={filters.__tag__ || ""}
                        onChange={(e) => setFilter("__tag__", e.target.value)}
                        style={{ width: "100%", paddingRight: "24px" }}
                      >
                        <option value="">All</option>
                        {availableTags.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {filters.__tag__ && filters.__tag__ !== "" && (
                        <ClearButton
                          onClick={() => setFilter("__tag__", "")}
                          isSelect
                        />
                      )}
                    </div>
                  </div>
                )}

                {filterableParams.map(([key, p]) => (
                  <div key={key} className="filter-item">
                    <label htmlFor={`filter-param-${key}`}>
                      {p.label}
                      {(p.type === "number" || p.type === "date") && (
                        <span
                          className="info-icon"
                          title="Supports operators: > < >= <= = and ranges (e.g. 10-20)"
                          style={{
                            marginLeft: "4px",
                            cursor: "help",
                            fontSize: "0.8em",
                          }}
                        >
                          ℹ️
                        </span>
                      )}
                    </label>
                    <div style={{ position: "relative", width: "100%" }}>
                      {p.type === "checkbox" && (
                        <>
                          <select
                            id={`filter-param-${key}`}
                            className="select-control"
                            value={filters[key] ?? ""}
                            onChange={(e) =>
                              setFilter(
                                key,
                                e.target.value === ""
                                  ? ""
                                  : e.target.value === "true",
                              )
                            }
                            style={{ width: "100%", paddingRight: "24px" }}
                          >
                            <option value="">All</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                          {filters[key] !== undefined && filters[key] !== "" && (
                            <ClearButton
                              onClick={() => setFilter(key, "")}
                              isSelect
                            />
                          )}
                        </>
                      )}

                      {p.type === "select" && (
                        <>
                          <select
                            id={`filter-param-${key}`}
                            className="select-control"
                            value={filters[key] || ""}
                            onChange={(e) => setFilter(key, e.target.value)}
                            style={{ width: "100%", paddingRight: "24px" }}
                          >
                            <option value="">All</option>
                            {p.options?.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                          {filters[key] !== undefined && filters[key] !== "" && (
                            <ClearButton
                              onClick={() => setFilter(key, "")}
                              isSelect
                            />
                          )}
                        </>
                      )}

                      {(p.type === "text" ||
                        p.type === "number" ||
                        p.type === "date") && (
                          <>
                            <input
                              id={`filter-param-${key}`}
                              type="text"
                              className="filter-input"
                              value={filters[key] || ""}
                              onChange={(e) => setFilter(key, e.target.value)}
                              placeholder={
                                p.type === "date"
                                  ? "YYYY-MM-DD or >..."
                                  : p.type === "number"
                                    ? "e.g. >10 or 10-20"
                                    : ""
                              }
                              style={{ width: "100%", paddingRight: "24px" }}
                            />
                            {filters[key] !== undefined && filters[key] !== "" && (
                              <ClearButton onClick={() => setFilter(key, "")} />
                            )}
                          </>
                        )}
                    </div>
                  </div>
                ))}

                {isTradableFilterable && (
                  <div className="filter-item">
                    <label>Tradable</label>
                    <div style={{ position: "relative", width: "100%" }}>
                      <select
                        className="select-control"
                        value={filters.__tradable__ ?? ""}
                        onChange={(e) =>
                          setFilter(
                            "__tradable__",
                            e.target.value === "" ? "" : e.target.value === "true",
                          )
                        }
                        style={{ width: "100%", paddingRight: "24px" }}
                      >
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      {filters.__tradable__ !== undefined &&
                        filters.__tradable__ !== "" && (
                          <ClearButton
                            onClick={() => setFilter("__tradable__", "")}
                            isSelect
                          />
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      <div className="grid-header">
        <div className="command-left">
          {/* Spacer or left-aligned content if needed in future */}
        </div>

        <div className="command-right">
          <div className="dropdown-action-group" ref={exportMenuRef}>
            <button
              className="action-pill"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <span>Export</span>
            </button>
            {exportMenuOpen && (
              <ul className="action-dropdown shadow">
                <li onClick={() => handleExport("csv", "all")}>CSV / All</li>
                <li onClick={() => handleExport("csv", "filtered")}>CSV / Filtered</li>
                <li onClick={() => handleExport("json", "all")}>JSON / All</li>
                <li onClick={() => handleExport("json", "filtered")}>JSON / Filtered</li>
                <li className="divider" />
                <li onClick={() => { setExportMenuOpen(false); onExportAll(); }}>JSON / Backup</li>
              </ul>
            )}
          </div>

          <div className="dropdown-action-group" ref={importMenuRef}>
            <button
              className="action-pill"
              onClick={() => setImportMenuOpen(!importMenuOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 3v13.5m0 0-4.5-4.5M12 16.5l4.5-4.5" />
              </svg>
              <span>Import</span>
            </button>
            {importMenuOpen && (
              <ul className="action-dropdown shadow">
                <li onClick={() => triggerImport("stocks")}>JSON / Current Week</li>
                <li onClick={() => triggerImport("tv")}>TXT / TradingView</li>
                <li className="divider" />
                <li onClick={() => triggerImport("backup")}>JSON / Full Backup</li>
              </ul>
            )}
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} hidden />
          </div>

          <button className="add-stock-cta" onClick={() => setShowAddStock(true)}>
            <span className="cta-icon">＋</span>
            Add
          </button>
        </div>
      </div>

      {isReadOnly && (
        <div className="readonly-banner">
          <span className="lock-icon">🔒</span>
          <span>This is a previous week. Editing is disabled.</span>
        </div>
      )}

      {showAddStock && (
        <AddStockModal
          isOpen={true}
          onAdd={handleAddStock}
          onImport={importStocks}
          onClose={() => setShowAddStock(false)}
          existingStocks={week?.stocks}
          sectors={sectors}
          onParseTv={(content) => parseTradingViewData(content, sectors)}
          watchlists={data.watchlists || []}
          selectedWatchlistId={selectedWatchlistId}
        />
      )}

      {importPendingStocks && (
        <ImportWatchlistModal
          isOpen={true}
          stocks={importPendingStocks}
          watchlists={data.watchlists || []}
          selectedWatchlistId={selectedWatchlistId}
          onConfirm={(finalStocks) => {
            importStocks(finalStocks);
            setImportPendingStocks(null);
          }}
          onClose={() => setImportPendingStocks(null)}
        />
      )}

      {editingStock && (
        <EditStockModal
          isOpen={true}
          onClose={() => setEditingStock(null)}
          stock={editingStock}
          onSave={handleUpdateStock}
          paramDefinitions={data.paramDefinitions}
          sectors={sectors}
          availableTags={availableTags}
          weekInfo={getWeekRangeLabel(weekKey)}
          country={country}
          showTags={showTags}
          isDeepView={true}
          watchlists={data.watchlists || []}
          aiSettings={aiSettings}
        />
      )}

      <div className="grid-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th
                className="sticky-col stock-col resizable-th"
                onClick={() => toggleSort("symbol")}
                style={
                  colWidths["symbol"]
                    ? {
                      width: `${colWidths["symbol"]}px`,
                      minWidth: `${colWidths["symbol"]}px`,
                    }
                    : {}
                }
              >
                <div className="copy-stocks-wrapper">
                  <span>Stock{renderSortIndicator("symbol")}</span>
                  <button
                    className="copy-stocks-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const symbols = sortedStocks.map((s) => s.symbol).join(", ");
                      navigator.clipboard.writeText(symbols).then(() => {
                        setCopiedStocks(true);
                        setTimeout(() => setCopiedStocks(false), 2000);
                      });
                    }}
                    title="Copy all visible stock symbols"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                      <rect x="9" y="9" width="10" height="10" />
                      <path d="M5 15V5h10" />
                    </svg>
                  </button>
                  {copiedStocks && (
                    <span className="copy-inline-toast">Copied {sortedStocks.length} stocks!</span>
                  )}
                </div>
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "symbol")}
                  onMouseDown={(e) => handleMouseDown(e, "symbol")}
                />
              </th>
              <th
                className="sector-col resizable-th"
                style={
                  colWidths["sector"]
                    ? {
                      width: `${colWidths["sector"]}px`,
                      minWidth: `${colWidths["sector"]}px`,
                    }
                    : {}
                }
              >
                Sector
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "sector")}
                  onMouseDown={(e) => handleMouseDown(e, "sector")}
                />
              </th>
              {visibleParams.map(([key, p]) => {
                const isSortable = p.type === "number" || p.type === "date" || p.type === "select" || p.type === "checkbox";
                return (
                  <th
                    key={key}
                    className="resizable-th"
                    onClick={isSortable ? () => toggleSort(key) : undefined}
                    style={{
                      ...(colWidths[key]
                        ? {
                          width: `${colWidths[key]}px`,
                          minWidth: `${colWidths[key]}px`,
                        }
                        : {}),
                      cursor: isSortable ? "pointer" : "default"
                    }}
                  >
                    {p.label}
                    {isSortable && renderSortIndicator(key)}
                    <div
                      className="col-resizer"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => resetColWidth(e, key)}
                      onMouseDown={(e) => handleMouseDown(e, key)}
                    />
                  </th>
                );
              })}

              <th
                className="resizable-th"
                onClick={() => toggleSort("__checks__")}
                style={
                  colWidths["__checks__"]
                    ? {
                      width: `${colWidths["__checks__"]}px`,
                      minWidth: `${colWidths["__checks__"]}px`,
                    }
                    : {}
                }
              >
                Checks Passed{renderSortIndicator("__checks__")}
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "__checks__")}
                  onMouseDown={(e) => handleMouseDown(e, "__checks__")}
                />
              </th>
              <th
                className="resizable-th"
                onClick={() => toggleSort("tradable")}
                style={
                  colWidths["tradable"]
                    ? {
                      width: `${colWidths["tradable"]}px`,
                      minWidth: `${colWidths["tradable"]}px`,
                    }
                    : {}
                }
              >
                Tradable {renderSortIndicator("tradable")}
                <div
                  className="col-resizer"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => resetColWidth(e, "tradable")}
                  onMouseDown={(e) => handleMouseDown(e, "tradable")}
                />
              </th>
              {showNotes && (
                <th
                  className="resizable-th notes-col"
                  style={
                    colWidths["__notes__"]
                      ? {
                        width: `${colWidths["__notes__"]}px`,
                        minWidth: `${colWidths["__notes__"]}px`,
                      }
                      : {}
                  }
                >
                  Notes
                  <div
                    className="col-resizer"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => resetColWidth(e, "__notes__")}
                    onMouseDown={(e) => handleMouseDown(e, "__notes__")}
                  />
                </th>
              )}
              <th />
            </tr>
          </thead>

          <tbody>
            {stocks.map((stock) => (
              <tr
                key={stock.symbol}
                className={stock.tradable ? "tradable" : ""}
              >
                <td
                  className={`sticky-col stock-col ${activeTagDropdown === stock.symbol ? "elevated-cell" : ""}`}
                >
                  <div className="stock-cell-content">
                    <div className="stock-header-row">
                      <span
                        className="stock-name"
                        onClick={(e) => {
                          if (!isReadOnly) {
                            e.stopPropagation();
                            setEditingStock(stock);
                          }
                        }}
                        style={
                          !isReadOnly
                            ? {
                              cursor: "pointer",
                              color: "var(--primary)",
                              fontWeight: "600",
                            }
                            : {}
                        }
                        title={!isReadOnly ? "Click to edit details" : ""}
                      >
                        {stock.symbol}
                      </span>
                      {!isReadOnly && showTags && (
                        <div className="add-tag-wrapper">
                          <button
                            className={`add-tag-trigger ${activeTagDropdown === stock.symbol ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTagDropdown(
                                activeTagDropdown === stock.symbol
                                  ? null
                                  : stock.symbol,
                              );
                            }}
                            title={`Add Tag(s) to ${stock.symbol}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              style={{ width: "10px", height: "10px" }}
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.5 2A2.5 2.5 0 002 4.5v2.879a2.5 2.5 0 00.732 1.767l8.122 8.121a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536L9.146 2.732A2.5 2.5 0 007.38 2H4.5zM5 5a1 1 0 100-2 1 1 0 000 2z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {activeTagDropdown === stock.symbol && (
                            <div className="custom-tag-dropdown">
                              {availableTags.length === 0 && (
                                <div className="tag-option empty">
                                  No tags defined
                                </div>
                              )}
                              {availableTags.map((t) => {
                                const isSelected = stock.tags?.includes(t);
                                return (
                                  <div
                                    key={t}
                                    className={`tag-option ${isSelected ? "selected" : ""}`}
                                    onClick={() =>
                                      !isSelected && addTag(stock, t)
                                    }
                                  >
                                    {t}
                                    {isSelected && <span>✓</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {showTags && (
                      <div className="stock-tags-inline">
                        {stock.tags?.map((tag) => (
                          <span key={tag} className="tag-pill">
                            {tag}
                            <button
                              className="tag-remove"
                              onClick={() => removeTag(stock, tag)}
                              disabled={isReadOnly}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="sector-col">
                  <div className="input-clear-wrapper type-select">
                    <select
                      className="select-control compact input-with-clear"
                      value={stock.sector || ""}
                      disabled={isReadOnly}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        stock.sector = e.target.value;
                        setData({ ...data });
                      }}
                    >
                      <option value=""></option>
                      {sectors.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {!isReadOnly && stock.sector && (
                      <ClearButton
                        onClick={() => {
                          stock.sector = "";
                          setData({ ...data });
                        }}
                        isSelect
                      />
                    )}
                  </div>
                </td>

                {visibleParams.map(([key, p]) => (
                  <td key={key}>
                    {p.type === "checkbox" && (
                      <input
                        type="checkbox"
                        className="grid-checkbox compact"
                        checked={!!stock.params[key]}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          if (isReadOnly) return;
                          stock.params[key] = e.target.checked;
                          setData({ ...data });
                        }}
                      />
                    )}

                    {p.type === "select" && (
                      <div className="input-clear-wrapper type-select">
                        <select
                          className="select-control input-with-clear"
                          value={stock.params[key] || ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            if (isReadOnly) return;
                            stock.params[key] = e.target.value;
                            setData({ ...data });
                          }}
                        >
                          <option value=""></option>
                          {p.options?.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                        {!isReadOnly && stock.params[key] && (
                          <ClearButton
                            onClick={() => {
                              stock.params[key] = "";
                              setData({ ...data });
                            }}
                            isSelect
                          />
                        )}
                      </div>
                    )}

                    {p.type === "number" && (
                      <div className="input-clear-wrapper type-number">
                        <input
                          type="text"
                          className="grid-text-input input-with-clear"
                          value={stock.params[key] || ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            if (isReadOnly) return;
                            stock.params[key] = e.target.value;
                            setData({ ...data });
                          }}
                        />
                        {!isReadOnly && stock.params[key] && (
                          <ClearButton
                            onClick={() => {
                              stock.params[key] = "";
                              setData({ ...data });
                            }}
                          />
                        )}
                      </div>
                    )}

                    {p.type === "date" && (
                      <div className="input-clear-wrapper type-date">
                        <input
                          key={stock.params[key] || "empty-date"}
                          type="date"
                          className="grid-text-input input-with-clear"
                          defaultValue={stock.params[key] || ""}
                          disabled={isReadOnly}
                          onBlur={(e) => {
                            if (isReadOnly) return;
                            if (stock.params[key] !== e.target.value) {
                              stock.params[key] = e.target.value;
                              setData({ ...data });
                            }
                          }}
                        />
                        {!isReadOnly && stock.params[key] && (
                          <ClearButton
                            onClick={() => {
                              stock.params[key] = "";
                              setData({ ...data });
                            }}
                            isSelect
                          />
                        )}
                      </div>
                    )}

                    {p.type === "text" && (
                      <div className="input-clear-wrapper">
                        <input
                          className="grid-text-input input-with-clear"
                          value={stock.params[key] || ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            if (isReadOnly) return;
                            stock.params[key] = e.target.value;
                            setData({ ...data });
                          }}
                        />
                        {!isReadOnly && stock.params[key] && (
                          <ClearButton
                            onClick={() => {
                              stock.params[key] = "";
                              setData({ ...data });
                            }}
                          />
                        )}
                      </div>
                    )}
                  </td>
                ))}

                <td className="checks-cell">
                  {renderChecksBadge(stock)}
                </td>

                <td>
                  <input
                    type="checkbox"
                    className="grid-checkbox"
                    checked={stock.tradable}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      if (isReadOnly) return;
                      stock.tradable = e.target.checked;
                      setData({ ...data });
                    }}
                  />
                </td>
                {showNotes && (
                  <td className="notes-col">
                    <div className="input-clear-wrapper">
                      <input
                        className="grid-notes-input input-with-clear"
                        value={stock.notes || ""}
                        title={stock.notes || ""}
                        disabled={isReadOnly}
                        placeholder="Notes.."
                        onChange={(e) => {
                          stock.notes = e.target.value;
                          setData({ ...data });
                        }}
                      />
                      {!isReadOnly && stock.notes && (
                        <ClearButton
                          onClick={() => {
                            stock.notes = "";
                            setData({ ...data });
                          }}
                        />
                      )}
                    </div>
                  </td>
                )}

                <td>
                  <button
                    className="delete-btn"
                    disabled={isReadOnly}
                    onClick={() => deleteStock(stock.symbol)}
                    title={isReadOnly ? "Read-only week" : "Delete stock"}
                  >
                    <TrashIcon size={20} />
                  </button>
                </td>
              </tr>
            ))}

            {stocks.length === 0 && (
              <tr>
                <td colSpan={colCount}>No data matches filters</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="pagination-bar">
          <div className="pagination-left">
            <div className="page-size">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ◀
                </button>

                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  ▶
                </button>
              </div>
            )}
            <span className="total-count">
              <strong>Total Stocks: {filteredStocks.length}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
