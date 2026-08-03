import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./ToastContext";
import { generateTradingViewExport } from "../utils/tvExport";

export default function ExportTradingViewModal({
  isOpen,
  onClose,
  stocks = {},
  stockSectorCache = {},
  watchlists = [],
  selectedWatchlistId = "all",
  country = "IN",
}) {
  const [selectedWlId, setSelectedWlId] = useState(selectedWatchlistId || "all");
  const [groupBy, setGroupBy] = useState("sector");
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const exportedText = generateTradingViewExport({
    stocks,
    stockSectorCache,
    selectedWlId,
    groupBy,
    country,
  });

  const stockList = Object.values(stocks || {}).filter((s) => {
    if (!s || !s.symbol) return false;
    if (selectedWlId === "all") return true;
    return s.watchlists && Array.isArray(s.watchlists) && s.watchlists.includes(selectedWlId);
  });

  const activeWatchlistName =
    selectedWlId === "all"
      ? "All_Stocks"
      : (watchlists.find((w) => w.id === selectedWlId)?.name || "Watchlist").replace(/\s+/g, "_");

  const handleCopy = async () => {
    if (!exportedText) {
      showToast("No data to copy!", "warning");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportedText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = exportedText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast("TradingView watchlist copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      showToast("Failed to copy to clipboard", "error");
    }
  };

  const handleDownload = () => {
    if (!exportedText) {
      showToast("No data to download!", "warning");
      return;
    }
    const filename = `tv_export_${activeWatchlistName}_${groupBy}.txt`;
    const blob = new Blob([exportedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, "success");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="TradingView Export"
      subtitle="Export watchlist formatted with sections for TradingView import"
    >
      <div className="add-stock-modal modal-wide tv-export-container">
        {/* Watchlist Select */}
        <div className="form-field">
          <label className="tv-form-label">
            Select Watchlist
          </label>
          <select
            className="select-control-v2 width-full"
            value={selectedWlId}
            onChange={(e) => setSelectedWlId(e.target.value)}
          >
            <option value="all">All Stocks ({Object.keys(stocks || {}).length})</option>
            {watchlists.map((w) => {
              const count = Object.values(stocks || {}).filter(
                (s) => s.watchlists && s.watchlists.includes(w.id)
              ).length;
              return (
                <option key={w.id} value={w.id}>
                  {w.name} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Group By Segmented Control */}
        <div className="form-field">
          <label className="tv-form-label">
            Group By
          </label>
          <div className="tv-segmented-control">
            <button
              type="button"
              className={`tv-segment-btn ${groupBy === "sector" ? "active" : ""}`}
              onClick={() => setGroupBy("sector")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Sector</span>
            </button>

            <button
              type="button"
              className={`tv-segment-btn ${groupBy === "tag" ? "active" : ""}`}
              onClick={() => setGroupBy("tag")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L12 2z" />
                <path d="M7 7h.01" />
              </svg>
              <span>Tag</span>
            </button>

            <button
              type="button"
              className={`tv-segment-btn ${groupBy === "none" ? "active" : ""}`}
              onClick={() => setGroupBy("none")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>None (No Sections)</span>
            </button>
          </div>
        </div>

        {/* Export Code Area */}
        <div className="form-field">
          <div className="flex justify-between items-center mb-1">
            <label className="tv-form-label mb-0">
              TradingView Export Format
            </label>
            <span className="tv-stock-count-badge">
              {stockList.length} stock{stockList.length === 1 ? "" : "s"} included
            </span>
          </div>

          <div className="tv-export-textarea-wrapper">
            <textarea
              rows={6}
              readOnly
              value={exportedText}
              placeholder="No stocks found to export."
            />
          </div>
          <div className="muted small margin-top-4">
            Copy or download this text and import directly into TradingView watchlist.
          </div>
        </div>

        {/* Modal Footer Actions: Download is PRIMARY */}
        <div className="modal-actions margin-top-12 flex justify-end gap-2">
          <button className="outline flex items-center gap-1.5" onClick={handleCopy} disabled={!exportedText}>
            {copied ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy to Clipboard</span>
              </>
            )}
          </button>

          <button className="primary-btn flex items-center gap-1.5" onClick={handleDownload} disabled={!exportedText}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download .txt</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
