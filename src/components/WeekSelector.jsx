import WeekSummary from "./WeekSummary";
import { useEffect, useState, useRef } from "react";
import { getLocalDateString, getSundayOfWeek, getWeekRangeLabel } from "../utils/weekHelpers";
import { useConfirm } from "./ConfirmContext";
import { useToast } from "./ToastContext";

const checkIsAiBlocked = (blockedUntil) => {
  if (!blockedUntil) return false;
  return blockedUntil > Date.now();
};

export default function WeekSelector({
  data,
  setData,
  country,
  weekKey,
  setWeekKey,
  selectedWatchlistId,
  setSelectedWatchlistId,
  onClearWeek,
  onAnalyze,
  onBulkAnalyze,
  onShowAnalytics,
  onShowWeeklyFeedback,
}) {
  // Initialize with weekKey or today's date
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));

  const mounted = useRef(false);
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const activeWatchlist = (data.watchlists || []).find(
    (w) => w.id === selectedWatchlistId
  );

  const handleClearWatchlist = async () => {
    if (!activeWatchlist) return;
    if (!(await confirm(`Remove all stocks from watchlist "${activeWatchlist.name}" for this week?`))) return;

    const newData = structuredClone(data);
    const stocks = newData.weeks?.[country]?.[weekKey]?.stocks || {};
    Object.values(stocks).forEach((stock) => {
      if (stock.watchlists && stock.watchlists.includes(selectedWatchlistId)) {
        stock.watchlists = stock.watchlists.filter((id) => id !== selectedWatchlistId);
      }
    });

    setData(newData);
    showToast(`Watchlist "${activeWatchlist.name}" cleared for this week`, "success");
  };

  // Sync internal date state if weekKey changes externally (e.g. app load)
  const [prevWeekKey, setPrevWeekKey] = useState(weekKey);
  if (weekKey !== prevWeekKey) {
    setPrevWeekKey(weekKey);
    const currentSunday = getSundayOfWeek(selectedDate);
    if (currentSunday !== weekKey) {
      const today = getLocalDateString(new Date());
      const todaySunday = getSundayOfWeek(today);
      if (weekKey === todaySunday) {
        setSelectedDate(today);
      } else {
        // Default to Monday of the selected week to avoid confusion
        const [y, m, d] = weekKey.split("-").map(Number);
        const sunday = new Date(y, m - 1, d);
        const monday = new Date(sunday);
        monday.setDate(sunday.getDate() + 1);
        setSelectedDate(getLocalDateString(monday));
      }
    }
  }

  useEffect(() => {
    const today = getLocalDateString(new Date());
    const todaySunday = getSundayOfWeek(today);

    if (!mounted.current) {
      mounted.current = true;
      // On initial load, force the week key to be the current week
      if (weekKey !== todaySunday) {
        setWeekKey(todaySunday);
      }
    }
  }, [weekKey, setWeekKey]);

  function updateDate(dateStr) {
    setSelectedDate(dateStr);
    const sunday = getSundayOfWeek(dateStr);

    // Ensure the week exists in data structure
    if (!data.weeks || !data.weeks[country] || !data.weeks[country][sunday]) {
      const newData = { ...data };
      newData.weeks = newData.weeks || {};
      if (!newData.weeks[country]) newData.weeks[country] = {};
      newData.weeks[country][sunday] = { stocks: {} };
      setData(newData);
    }

    setWeekKey(sunday);
  }

  function handleDateChange(e) {
    if (e.target.value) {
      updateDate(e.target.value);
    }
  }

  function goToToday() {
    updateDate(getLocalDateString(new Date()));
  }

  const currentWeekSunday = getSundayOfWeek(getLocalDateString(new Date()));

  // Allow selecting dates up to the end of next week (Saturday) to allow planning ahead
  const [cy, cm, cd] = currentWeekSunday.split("-").map(Number);
  const maxDateObj = new Date(cy, cm - 1, cd);
  maxDateObj.setDate(maxDateObj.getDate() + 13);
  const maxDateString = getLocalDateString(maxDateObj);

  const availableWeeks = Object.keys(data.weeks?.[country] || {}).sort().reverse();

  return (
    <div className="week-selector">
      <div className="week-left">
        <span className="date-label">
          <strong>Date: </strong>
        </span>

        <div className="date-picker-container">
          <input
            type="date"
            className="date-picker-input-v2"
            value={selectedDate}
            onChange={handleDateChange}
            max={maxDateString}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
          />
        </div>
        <span className="date-label">
          <strong>Week: </strong>
        </span>
        <select
          className="select-control-v2"
          value={weekKey || ""}
          onChange={(e) => setWeekKey(e.target.value)}
        >
          {availableWeeks.map((w) => (
            <option key={w} value={w}>
              {getWeekRangeLabel(w)}
            </option>
          ))}
        </select>

        <span className="date-label">
          <strong>Watchlist: </strong>
        </span>
        <select
          className="select-control-v2"
          value={selectedWatchlistId}
          onChange={(e) => setSelectedWatchlistId(e.target.value)}
        >
          <option value="all">All Stocks</option>
          {(data.watchlists || []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        {weekKey !== currentWeekSunday && (
          <button
            className="go-today-link"
            onClick={goToToday}
            title="Click to see stocks for the current week"
          >
            Current Week
          </button>
        )}

        <WeekSummary data={data} country={country} weekKey={weekKey} />

        {(() => {
          const isAiBlocked = checkIsAiBlocked(data?.aiSettings?.aiState?.blockedUntil);
          return (
            <>
              <button
                className={`nav-icon-btn-v2 ${isAiBlocked ? 'disabled' : ''}`}
                onClick={isAiBlocked ? undefined : onAnalyze}
                disabled={isAiBlocked}
                title={isAiBlocked ? "AI requests blocked due to rate limit/errors" : "AI market insights (Alt + I)"}
                style={isAiBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="M5 3v4" /><path d="M3 5h4" /><path d="M21 17v4" /><path d="M19 19h4" />
                </svg>
              </button>

              <button
                className={`nav-icon-btn-v2 ${isAiBlocked ? 'disabled' : ''}`}
                onClick={isAiBlocked ? undefined : onBulkAnalyze}
                disabled={isAiBlocked}
                title={isAiBlocked ? "AI requests blocked due to rate limit/errors" : "Background Bulk AI Analysis"}
                style={isAiBlocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12h4l2 8 4-16 2 8h4"/>
                </svg>
              </button>
            </>
          );
        })()}

        <button
          onClick={onShowAnalytics}
          title="Analytics Dashboard (Alt + A)"
          className="nav-icon-btn-v2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </button>

        <button
          onClick={onShowWeeklyFeedback}
          title="Weekly Journal & Reflection"
          className="nav-icon-btn-v2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M8 7h6" />
            <path d="M8 11h8" />
          </svg>
        </button>
      </div>

      <div className="week-right">
        {selectedWatchlistId !== "all" && (
          <button
            className="ghost-danger-btn small"
            onClick={handleClearWatchlist}
            title="Remove all stocks from this watchlist for the current week"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear Watchlist
          </button>
        )}
        <button
          className="ghost-danger-btn small"
          onClick={onClearWeek}
          title="Reset current week data"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Reset Week
        </button>
      </div>
    </div>
  );
}
