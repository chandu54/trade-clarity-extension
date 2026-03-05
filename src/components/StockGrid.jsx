import { useMemo, useState, useEffect, useRef } from "react";
import AddStockModal from "./AddStockModal";
import EditStockModal from "./EditStockModal";
import TrashIcon from "./icons/TrashIcon";

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

export default function StockGrid({ data, weekKey, setData, isReadOnly, country }) {
  const week = data.weeks?.[country]?.[weekKey];
  const params = data.paramDefinitions;

  /* =====================
     STATE
  ===================== */
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
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

  /* =====================
     RESET PAGE ON CONTEXT CHANGE
  ===================== */
  useEffect(() => {
    setCurrentPage(1);
  }, [weekKey, pageSize, filters, sortBy, sortDir]);

  /* =====================
     BASE DATASET
  ===================== */
  const allStocks = useMemo(
    () => Object.values(week?.stocks || {}),
    [week],
  );

  /* =====================
     COLUMN CONFIG
  ===================== */
  const columnConfig = data.uiConfig?.columnVisibility || {};
  const showNotes = columnConfig["__notes__"] !== false;

  const visibleParams = Object.entries(params).filter(
    ([key]) => columnConfig[key] !== false,
  );

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
  const filterableParams = useMemo(
    () => Object.entries(params).filter(([, p]) => p.filterable),
    [params],
  );

  const isSectorFilterable = data.uiConfig?.sectorFilterable === true;
  const isTradableFilterable = data.uiConfig?.tradableFilterable === true;
  const isTagFilterable = data.uiConfig?.tagFilterable === true;
  const showTags = data.uiConfig?.showTags !== false;

  const sectors = useMemo(() => {
    return [...(data.uiConfig?.sectors || [])].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [data.uiConfig?.sectors]);

  const availableTags = useMemo(() => {
    return [...(data.uiConfig?.tags || [])].sort();
  }, [data.uiConfig?.tags]);

  /* =====================
     CHECKS PASSED
  ===================== */
  function getChecksResult(stock) {
    const checkParams = visibleParams.filter(([, p]) => p.isCheck === true);
    const total = checkParams.length;
    if (total === 0) return "—";

    let passed = 0;

    checkParams.forEach(([key, p]) => {
      const value = stock.params?.[key];

      if (p.type === "checkbox") {
        if (value === true) passed++;
      } else {
        if (!value) return;
        if ((p.idealValues || []).includes(value)) passed++;
      }
    });

    return `${passed} / ${total}`;
  }

  /* =====================
     FILTER LOGIC (FULL DATASET)
  ===================== */
  const filteredStocks = useMemo(() => {
    return allStocks.filter((stock) => {
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

        if (p.type === "text") {
          return (stockVal || "")
            .toLowerCase()
            .includes(String(filterVal).toLowerCase());
        }

        return true;
      });
    });
  }, [allStocks, filters, filterableParams, isSectorFilterable, isTagFilterable]);

  /* =====================
     SORT LOGIC (FULL FILTERED DATA)
  ===================== */
  const sortedStocks = useMemo(() => {
    if (!sortBy) return filteredStocks;

    return [...filteredStocks].sort((a, b) => {
      let aVal, bVal;

      if (sortBy === "__checks__") {
        aVal = getChecksResult(a);
        bVal = getChecksResult(b);
      } else {
        aVal = a[sortBy] ?? a.params?.[sortBy];
        bVal = b[sortBy] ?? b.params?.[sortBy];
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

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

  /* =====================
     PAGINATION
  ===================== */
  const totalPages = Math.max(1, Math.ceil(sortedStocks.length / pageSize));

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const stocks = sortedStocks.slice(start, end);

  /* =====================
     SORT TOGGLE
  ===================== */
  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  /* =====================
     FILTER HELPERS
  ===================== */
  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearFilters() {
    setFilters({});
  }

  /* =====================
     CRUD
  ===================== */
  function handleAddStock(input) {
    const symbols = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (symbols.length === 0) return;

    setData((prev) => {
      const prevWeek = prev.weeks[country][weekKey];
      const newStocks = { ...prevWeek.stocks };

      symbols.forEach((symbol) => {
        if (!newStocks[symbol]) {
          newStocks[symbol] = {
            symbol,
            sector: "",
            tradable: false,
            notes: "",
            tags: [],
            params: {},
          };
        }
      });

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

  function deleteStock(symbol) {
    if (!confirm(`Delete ${symbol}?`)) return;
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
    stock.tags = stock.tags.filter(t => t !== tagToRemove);
    setData({ ...data });
  }

  function renderSortIndicator(col) {
    if (sortBy !== col) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
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
      alert("No data to export!");
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
  }

  function handleExportJSON(scope = "filtered") {
    const exportData = scope === "all" ? allStocks : sortedStocks;

    if (!exportData || exportData.length === 0) {
      alert("No data to export!");
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
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset input so the same file can be selected again if needed
    e.target.value = "";

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        
        if (Array.isArray(json)) {
          importStocks(json);
        } else {
          alert("Invalid file format. Expected a JSON array of stocks.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON file");
      }
    };

    reader.readAsText(file);
  }

  function importStocks(stocksArray) {
    if (!stocksArray || stocksArray.length === 0) return;

    setData((prev) => {
      const currentWeekData = prev.weeks[country][weekKey] || { stocks: {} };
      const newStocks = { ...currentWeekData.stocks };
      let count = 0;

      stocksArray.forEach((s) => {
        if (s.symbol) {
          // Merge params if the stock already exists, otherwise just overwrite/add
          const existing = newStocks[s.symbol];
          newStocks[s.symbol] = {
            ...existing,
            ...s,
            params: { ...(existing?.params || {}), ...(s.params || {}) },
            tags: s.tags || existing?.tags || [],
          };
          count++;
        }
      });

      if (count > 0) {
        alert(`Imported ${count} stocks successfully.`);
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
      {(filterableParams.length > 0 || isSectorFilterable || (availableTags.length > 0 && isTagFilterable)) && (
        <div className="filter-bar">
          <h4>Filters:</h4>
          {isSectorFilterable && (
            <div className="filter-item">
              <label>Sector</label>
              <select
                className="select-control"
                value={filters.__sector__ || ""}
                onChange={(e) => setFilter("__sector__", e.target.value)}
              >
                <option value="">All</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableTags.length > 0 && isTagFilterable && (
            <div className="filter-item">
              <label>Tag</label>
              <select
                className="select-control"
                value={filters.__tag__ || ""}
                onChange={(e) => setFilter("__tag__", e.target.value)}
              >
                <option value="">All</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {filterableParams.map(([key, p]) => (
            <div key={key} className="filter-item">
              <label>{p.label}</label>

              {p.type === "checkbox" && (
                <select
                  className="select-control"
                  value={filters[key] ?? ""}
                  onChange={(e) =>
                    setFilter(
                      key,
                      e.target.value === "" ? "" : e.target.value === "true",
                    )
                  }
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              )}

              {p.type === "select" && (
                <select
                  className="select-control"
                  value={filters[key] || ""}
                  onChange={(e) => setFilter(key, e.target.value)}
                >
                  <option value="">All</option>
                  {p.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              )}

              {p.type === "text" && (
                <input
                  placeholder="Contains..."
                  value={filters[key] || ""}
                  onChange={(e) => setFilter(key, e.target.value)}
                />
              )}
            </div>
          ))}

          {isTradableFilterable && (
            <div className="filter-item">
              <label>Tradable</label>
              <select
                className="select-control"
                value={filters.__tradable__ ?? ""}
                onChange={(e) =>
                  setFilter(
                    "__tradable__",
                    e.target.value === "" ? "" : e.target.value === "true",
                  )
                }
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          )}

          <button className="clear-filters-btn" onClick={clearFilters}>
            <b>Clear Filters</b>
          </button>
        </div>
      )}

      <div className="grid-header">
        <div className="grid-header-left" />
        <div className="grid-header-right">
          <div className="export-dropdown-wrapper" ref={exportMenuRef}>
            <button
              className="primary-btn"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title="Export options"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                style={{ width: "16px", height: "16px" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Export
            </button>

            {exportMenuOpen && (
              <ul className="export-dropdown-menu">
                <li onClick={() => handleExport("csv", "all")}>
                  CSV / All Stocks
                </li>
                <li onClick={() => handleExport("csv", "filtered")}>
                  CSV / Filtered Stocks
                </li>
                <li onClick={() => handleExport("json", "all")}>
                  JSON / All Stocks
                </li>
                <li onClick={() => handleExport("json", "filtered")}>
                  JSON / Filtered Stocks
                </li>
              </ul>
            )}
          </div>
          
          <label className="primary-btn" style={{ margin: 0 }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              style={{ width: "16px", height: "16px" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 3v13.5m0 0-4.5-4.5M12 16.5l4.5-4.5" />
            </svg>
            Import
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>

          <button
            className="primary-btn"
            onClick={() => setShowAddStock(true)}
          >
            <span className="add-icon">＋</span>
            Add Stock
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
          onClose={() => setShowAddStock(false)}
          existingStocks={week?.stocks}
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
        />
      )}

      <div className="grid-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th
                className="sticky-col stock-col"
                onClick={() => toggleSort("symbol")}
              >
                Stock{renderSortIndicator("symbol")}
              </th>
              <th className="sector-col">Sector</th>
              {visibleParams.map(([key, p]) => (
                <th key={key}>{p.label}</th>
              ))}

              <th onClick={() => toggleSort("__checks__")}>
                Checks Passed{renderSortIndicator("__checks__")}
              </th>
              {showNotes && <th>Notes</th>}
              <th onClick={() => toggleSort("tradable")}>
                Tradable {renderSortIndicator("tradable")}
              </th>
              <th />
            </tr>
          </thead>

          <tbody>
            {stocks.map((stock) => (
              <tr
                key={stock.symbol}
                className={stock.tradable ? "tradable" : ""}
              >
                <td className={`sticky-col stock-col ${activeTagDropdown === stock.symbol ? "elevated-cell" : ""}`}>
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
                        style={!isReadOnly ? { cursor: "pointer", color: "var(--primary)", fontWeight: "600" } : {}}
                        title={!isReadOnly ? "Click to edit details" : ""}
                      >{stock.symbol}</span>
                      {!isReadOnly && showTags && (
                         <div className="add-tag-wrapper">
                            <button
                              className={`add-tag-trigger ${activeTagDropdown === stock.symbol ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTagDropdown(activeTagDropdown === stock.symbol ? null : stock.symbol);
                              }}
                              title={`Add Tag(s) to ${stock.symbol}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '10px', height: '10px' }}>
                                <path fillRule="evenodd" d="M4.5 2A2.5 2.5 0 002 4.5v2.879a2.5 2.5 0 00.732 1.767l8.122 8.121a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536L9.146 2.732A2.5 2.5 0 007.38 2H4.5zM5 5a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                            </button>
                            {activeTagDropdown === stock.symbol && (
                              <div className="custom-tag-dropdown">
                                {availableTags.length === 0 && <div className="tag-option empty">No tags defined</div>}
                                {availableTags.map((t) => {
                                  const isSelected = stock.tags?.includes(t);
                                  return (
                                    <div key={t} className={`tag-option ${isSelected ? "selected" : ""}`} onClick={() => !isSelected && addTag(stock, t)}>
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
                        {stock.tags?.map(tag => (
                          <span key={tag} className="tag-pill">
                            {tag}
                            <button
                              className="tag-remove"
                              onClick={() => removeTag(stock, tag)}
                              disabled={isReadOnly}
                            >×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="sector-col">
                  <select
                    className="select-control compact"
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
                      <select
                        className="select-control"
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
                    )}

                    {p.type === "text" && (
                      <input
                        className="grid-text-input"
                        value={stock.params[key] || ""}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          if (isReadOnly) return;
                          stock.params[key] = e.target.value;
                          setData({ ...data });
                        }}
                      />
                    )}
                  </td>
                ))}

                <td className="checks-cell">{getChecksResult(stock)}</td>

                {showNotes && (
                  <td>
                    <input
                      className="grid-notes-input"
                      value={stock.notes || ""}
                      title={stock.notes || ""}
                      disabled={isReadOnly}
                      placeholder="Notes.."
                      onChange={(e) => {
                        stock.notes = e.target.value;
                        setData({ ...data });
                      }}
                    />
                  </td>
                )}

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
