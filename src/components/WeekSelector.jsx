import WeekSummary from "./WeekSummary";
import { useEffect, useState, useRef } from "react";
import { getLocalDateString, getSundayOfWeek } from "../utils/weekHelpers";

function getWeekRangeLabel(sundayDateStr) {
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
  onShowAnalytics,
}) {
  // Initialize with weekKey or today's date
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));

  const mounted = useRef(false);

  // Sync internal date state if weekKey changes externally (e.g. app load)
  useEffect(() => {
    const today = getLocalDateString(new Date());
    const todaySunday = getSundayOfWeek(today);

    if (!mounted.current) {
      mounted.current = true;
      // On initial load, force the week key to be the current week
      if (weekKey !== todaySunday) {
        setWeekKey(todaySunday);
      }
      return;
    }

    if (weekKey) {
      const currentSunday = getSundayOfWeek(selectedDate);
      // Only update if the current selected date doesn't belong to the new weekKey
      if (currentSunday !== weekKey) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

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

        <button
          className="nav-icon-btn-v2"
          onClick={onAnalyze}
          title="AI Market Insights (Alt + I)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" /><path d="M3 5h4" /><path d="M21 17v4" /><path d="M19 19h4" />
          </svg>
        </button>

        <button
          onClick={onShowAnalytics}
          title="Analytics Dashboard (Alt + A)"
          className="nav-icon-btn-v2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </button>
      </div>

      <div className="week-right">
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
