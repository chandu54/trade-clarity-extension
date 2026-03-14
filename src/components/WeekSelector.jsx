import WeekSummary from "./WeekSummary";
import { useEffect, useState, useRef } from "react";

function getSundayOfWeek(dateString) {
  // Parse as local date
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  // Treat Sunday (0) as 7 so it maps to the previous week's Sunday anchor
  const diff = date.getDate() - (day === 0 ? 7 : day);
  const sunday = new Date(date.setDate(diff));
  return getLocalDateString(sunday);
}

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

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function WeekSelector({
  data,
  setData,
  country,
  weekKey,
  setWeekKey,
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
          onClick={onAnalyze}
          title="Generate AI Analysis"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--panel)",
            fontSize: "1.2rem",
            marginLeft: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 5px #0000000d",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0
          }}
        >
          ✨
        </button>
        <button
          onClick={onShowAnalytics}
          title="View Analytics Dashboard"
          className="analytics-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="4" height="10" rx="1" />
            <rect x="10" y="4" width="4" height="17" rx="1" />
            <rect x="17" y="8" width="4" height="13" rx="1" />
          </svg>
        </button>
      </div>

      <div className="week-right">
        <button
          className="danger"
          onClick={onClearWeek}
          title="Clear all stocks for this week"
        >
          Clear Week
        </button>
      </div>
    </div>
  );
}
