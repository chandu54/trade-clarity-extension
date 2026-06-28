import { useMemo, useState, useRef } from "react";
import { calculateCheckStats } from "../utils/checks";
import { getStockCheckSummary } from "../utils/paramUtils";

export default function WeekSummary({ data, weekKey, country }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const popupRef = useRef(null);

  const week = useMemo(() => {
    return data.weeks?.[country]?.[weekKey] || { stocks: {} };
  }, [data.weeks, country, weekKey]);
  const stocks = Object.values(week.stocks || {});
  const columnVisibility = data.uiConfig?.columnVisibility || {};

  const visibleParams = Object.entries(data.paramDefinitions).filter(
    ([key]) => columnVisibility[key] !== false,
  );
  const sortedWeeks = Object.keys(data.weeks?.[country] || {}).sort();
  const currentIndex = sortedWeeks.indexOf(weekKey);
  const prevWeekKey = currentIndex > 0 ? sortedWeeks[currentIndex - 1] : null;

  const currentStats = calculateCheckStats(
    Object.values(week?.stocks || {}),
    data.paramDefinitions,
  );

  const prevStats = prevWeekKey
    ? calculateCheckStats(
      Object.values(data.weeks[country][prevWeekKey].stocks || {}),
      data.paramDefinitions,
    )
    : null;

  // =========================
  // SECTOR SUMMARY
  // =========================
  const sectorSizeSummary = useMemo(() => {
    const map = {};
    const params = visibleParams;

    // Count how many checks exist per stock
    const checksPerStock = params.filter(([, p]) => p.isCheck).length;

    stocks.forEach((stock) => {
      const sector = stock.sector?.trim();
      if (!sector) return;

      if (!map[sector]) {
        map[sector] = {
          sector,
          total: 0,
          tradable: 0,
          passedChecks: 0, // total passed checks across all stocks
        };
      }

      map[sector].total += 1;
      if (stock.tradable) map[sector].tradable += 1;

      const { passed } = getStockCheckSummary(stock, data.paramDefinitions);
      map[sector].passedChecks += passed;
    });

    const ranked = Object.values(map).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.passedChecks !== a.passedChecks)
        return b.passedChecks - a.passedChecks;
      if (b.tradable !== a.tradable) return b.tradable - a.tradable;
      return 0;
    });

    const result = [];
    let currentRank = 0;

    for (let i = 0; i < ranked.length; i++) {
      const prev = ranked[i - 1];
      const curr = ranked[i];

      let rank;
      if (
        prev &&
        prev.total === curr.total &&
        prev.passedChecks === curr.passedChecks &&
        prev.tradable === curr.tradable
      ) {
        rank = currentRank;
      } else {
        rank = currentRank + 1;
      }

      if (rank > 3) break;

      currentRank = rank;
      result.push({
        ...curr,
        rank,
        checksPerStock, // 👈 attach once
      });
    }

    return result;
  }, [stocks, visibleParams, data.paramDefinitions]);



  const summary = useMemo(() => {
    const stocks = Object.values(week.stocks || {});

    let pass80 = 0;
    let pass60 = 0;
    let below60 = 0;
    let tradable = 0;

    stocks.forEach((stock) => {
      if (stock.tradable) tradable++;

      const { ratio, total } = getStockCheckSummary(stock, data.paramDefinitions);
      if (total === 0) return;

      const pct = ratio * 100;

      if (pct >= 80) pass80++;
      else if (pct >= 60) pass60++;
      else below60++;
    });

    let outlook = "Neutral";
    if (pass80 > stocks.length * 0.5) outlook = "Bullish";
    if (below60 > stocks.length * 0.5) outlook = "Weak";

    return {
      total: stocks.length,
      pass80,
      pass60,
      below60,
      tradable,
      outlook,
    };
  }, [week, data.paramDefinitions]);



  return (
    <div
      className="summary-wrapper"
      ref={wrapperRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="summary-icon"
        onClick={() => setOpen((o) => !o)}
        title="Weekly Summary"
      />

      {open && (
        <div className="summary-popup" ref={popupRef}>
          <div className="popup-header">
            <h3>Weekly Summary</h3>
            <span className={`outlook-pill ${summary.outlook.toLowerCase()}`}>
              {summary.outlook}
            </span>
          </div>

          {/* METRICS */}
          <div className="metrics-grid">
            <div className="metric-box">
              <span className="metric-label">Total Stocks</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="metric-box">
              <span className="metric-label">Tradable</span>
              <strong>{summary.tradable}</strong>
            </div>
          </div>

          {/* CHECK DISTRIBUTION */}
          <div className="checks-grid">
            <div className="check-card good">
              <span>≥ 80%</span>
              <strong>{summary.pass80}</strong>

              <span
                className="info-icon"
                title="Number of stocks that passed 80% or more of the checks"
              />
            </div>

            <div className="check-card warn">
              <span>60–79%</span>
              <strong>{summary.pass60}</strong>

              <span
                className="info-icon"
                title="Number of stocks that passed between 60% and 79% of the checks"
              />
            </div>

            <div className="check-card bad">
              <span>&lt; 60%</span>
              <strong>{summary.below60}</strong>

              <span
                className="info-icon"
                title="Number of stocks that passed less than 60% of the checks"
              />
            </div>
          </div>

          {/* WEEK COMPARISON */}
          {prevWeekKey && (
            <div className="wow-section">
              <div className="wow-header">📅 Week-on-Week metrics</div>
              <div className="wow-grid">
                {/* Total stocks */}
                <div className="wow-card">
                  <span className="wow-label">Total</span>
                  <span
                    className={`wow-value ${currentStats.totalStocks - prevStats.totalStocks >= 0
                        ? "up"
                        : "down"
                      }`}
                  >
                    {currentStats.totalStocks - prevStats.totalStocks >= 0
                      ? "▲"
                      : "▼"}{" "}
                    {Math.abs(currentStats.totalStocks - prevStats.totalStocks)}
                  </span>

                  <span
                    className="info-icon"
                    title="Change in total number of stocks compared to the previous week"
                  />
                </div>

                {/* ≥ 80% */}
                <div className="wow-card">
                  <span className="wow-label">≥ 80%</span>
                  <span
                    className={`wow-value ${currentStats.passed80 - prevStats.passed80 >= 0
                        ? "up"
                        : "down"
                      }`}
                  >
                    {currentStats.passed80 - prevStats.passed80 >= 0
                      ? "▲"
                      : "▼"}{" "}
                    {Math.abs(currentStats.passed80 - prevStats.passed80)}
                  </span>

                  <span
                    className="info-icon"
                    title="Week-on-week change in number of stocks that passed 80% or more of the checks"
                  />
                </div>

                {/* 60–79% */}
                <div className="wow-card">
                  <span className="wow-label">60–79%</span>
                  <span
                    className={`wow-value ${currentStats.passed60 - prevStats.passed60 >= 0
                        ? "up"
                        : "down"
                      }`}
                  >
                    {currentStats.passed60 - prevStats.passed60 >= 0
                      ? "▲"
                      : "▼"}{" "}
                    {Math.abs(currentStats.passed60 - prevStats.passed60)}
                  </span>

                  <span
                    className="info-icon"
                    title="Week-on-week change in number of stocks that passed between 60% and 79% of the checks"
                  />
                </div>
              </div>
            </div>
          )}
          {/* SECTOR SUMMARIES */}
          <div>
            {sectorSizeSummary.length > 0 && (
              <div className="sector-section">
                <h4>Top Sectors Summary</h4>

                <div className="sector-cards">
                  {sectorSizeSummary.map((s) => {
                    return (
                      <div key={s.sector} className="sector-card-v2">
                        {/* Header */}
                        <div className="sector-card-header">
                          <span className="sector-rank-v2">{s.rank}</span>
                          <div className="sector-title-wrap">
                            <span className="sector-name-v2">
                              {s.sector} - {s.total} stocks
                            </span>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="sector-metrics">
                          <div className="sector-metric">
                            <span className="metric-label">Tradable</span>
                            <strong className="metric-value">
                              {s.tradable}
                            </strong>
                          </div>

                          <div className="sector-metric">
                            <span className="metric-label">
                              {" "}
                              Avg Checks Passed
                            </span>
                            <strong className="metric-value">
                              {s.total > 0
                                ? `${(s.passedChecks / s.total).toFixed(2)} / ${s.checksPerStock}`
                                : `0 / ${s.checksPerStock}`}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
