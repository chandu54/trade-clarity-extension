import React, { useState } from "react";
import Modal from "./Modal";

export default function UserGuideModal({
  isOpen,
  onClose,
  onOpenModal,
}) {
  const [activeTab, setActiveTab] = useState("watchlist");

  const handleNavigate = (action) => {
    onClose();
    // Small delay to ensure the guide closes fully before the new modal opens
    setTimeout(() => {
      onOpenModal(action);
    }, 100);
  };

  const Section = ({
    title,
    icon,
    children,
    actionLabel,
    actionKey,
    primaryAction,
    location,
  }) => (
    <div className="guide-section">
      <div className="guide-header">
        {icon && <div className="guide-icon">{icon}</div>}
        <h3 className="guide-title">{title}</h3>
      </div>

      <div className="guide-content">
        {location && (
          <div className="guide-location">
            <span>📍</span>
            <span>{location}</span>
          </div>
        )}
        {children}
      </div>

      {actionLabel && (
        <div className="guide-actions">
          <button
            onClick={() => handleNavigate(actionKey)}
            className={primaryAction ? "primary-btn" : "outline"}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Manual"
      subtitle="Mastering your swing trading process with TradeClarity.market"
      className="modal-user-guide"
    >
      <div className="modal-body user-guide-body user-guide-layout">
        {/* Left Navigation Menu */}
        <div className="guide-left-menu">
          <button
            onClick={() => setActiveTab("settings")}
            className={`guide-menu-btn ${activeTab === "settings" ? "active" : ""}`}
          >
            <span>All Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`guide-menu-btn ${activeTab === "watchlist" ? "active" : ""}`}
          >
            <span>Watchlists</span>
          </button>
          <button
            onClick={() => setActiveTab("pulse")}
            className={`guide-menu-btn ${activeTab === "pulse" ? "active" : ""}`}
          >
            <span>Market Pulse</span>
          </button>
          <button
            onClick={() => setActiveTab("journal")}
            className={`guide-menu-btn ${activeTab === "journal" ? "active" : ""}`}
          >
            <span>Trading Journal</span>
          </button>
        </div>

        {/* Right Scrollable Content Area */}
        <div className="guide-right-content">
          {activeTab === "settings" && (
            <>
              <h2 className="guide-tab-title">Settings & Configurations</h2>
              
              <Section title="1. Global Settings" icon="🌍">
                <p>Configure the app environment before you start.</p>
                <ul className="guide-list">
                  <li>
                    <strong>Region (🇺🇸/🇮🇳):</strong> Use the flag icon in the header
                    to switch between US and Indian markets. Data is stored separately
                    for each region.
                  </li>
                  <li>
                    <strong>Theme (🌗):</strong> Toggle the Sun/Moon icon or press <strong>Alt + T</strong> to switch
                    between Light and Dark modes.
                  </li>
                </ul>
              </Section>

              <Section
                title="2. Custom Watchlists"
                icon="📋"
                actionLabel="Manage Watchlists →"
                actionKey="watchlists"
                location="Settings > Watchlists"
              >
                <p>
                  Organize your stocks into custom watchlists for better focus and segmentation.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Create & Manage:</strong> Add new watchlists or set your default view.
                  </li>
                  <li>
                    <strong>Assign Stocks:</strong> Check the specific watchlists when adding/importing stocks, or via the Edit Modal.
                  </li>
                  <li>
                    <strong>Custom Configurations:</strong> Define unique visible columns and filters for <em>each specific watchlist</em>!
                  </li>
                </ul>
              </Section>

              <Section
                title="3. Parameters & Scoring"
                icon="⚙️"
                actionLabel="Configure Parameters →"
                actionKey="params"
                location="Settings > Parameters"
              >
                <p>
                  Define the specific criteria that make a stock "tradable" for you.
                  Instead of gut feeling, use Parameters (e.g., "RSI", "Pattern").
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>The "Check" System:</strong> Enable{" "}
                    <em>"Consider as Check"</em> and define an <em>Ideal Value</em>.
                  </li>
                  <li>
                    <strong>Scoring:</strong> The app calculates a score (e.g.,{" "}
                    <strong>4/5</strong>) for every stock. This objective score
                    bubbles the highest-quality setups to the top.
                  </li>
                </ul>
              </Section>

              <Section
                title="4. Sectors & Organization"
                icon="🏢"
                actionLabel="Manage Sectors →"
                actionKey="sectors"
                location="Settings > Sectors"
              >
                <p>
                  Group stocks by their industry to identify broader market trends and
                  sector rotation.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Usage:</strong> Assign a sector to each stock in the grid.
                    This enables sector-based filtering and AI analysis.
                  </li>
                </ul>
              </Section>

              <Section
                title="5. Tags & Labels"
                icon="🏷️"
                actionLabel="Manage Tags →"
                actionKey="tags"
                location="Settings > Tags"
              >
                <p>
                  Tags offer flexible, ad-hoc categorization beyond sectors (e.g.,
                  "Earnings Soon", "Leader").
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Workflow:</strong> Create tags globally, then toggle them
                    on stocks by hovering over the stock name in the grid and clicking
                    the small tag icon.
                  </li>
                </ul>
              </Section>

              <Section
                title="6. Rules"
                icon="🛡️"
                actionLabel="Configure Rules →"
                actionKey="rules"
                location="Settings > Rules"
              >
                <p>
                  Enforce discipline by locking your history to prevent accidental
                  changes.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Lock Previous Weeks:</strong> Enable this to make past
                    weeks read-only. This is crucial for maintaining an accurate
                    trading journal.
                  </li>
                  <li>
                    <strong>Auto-Fetch Lookback:</strong> Enable background fetching of ADR & Liquidity, and define the exact number of trading days (e.g., 20) to use for your moving average calculations.
                  </li>
                </ul>
              </Section>

              <Section
                title="7. Data Management"
                icon="💾"
                location="Header > Export/Import"
              >
                <p>
                  Your data is stored locally in your browser for privacy. Regular
                  backups are recommended.
                </p>

                <h5 className="guide-subsection-title">📥 Import & Export</h5>
                <ul className="guide-list">
                  <li>
                    <strong>Full Backup (JSON):</strong> Saves everything (weeks,
                    settings, history).
                  </li>
                  <li>
                    <strong>TradingView Watchlist:</strong> Import a text file
                    exported from TradingView watchlist to populate your grid.
                  </li>
                  <div className="guide-tip">
                    <strong>💡 Pro Tip:</strong> In TradingView, use sections (e.g.
                    '###Technology') to group stocks. If a section name matches a
                    Sector defined here, the app will automatically assign that sector
                    to the imported stocks.
                  </div>
                  <li>
                    <strong>Export CSV:</strong> Exports the current grid view for use
                    in Excel or trading platforms.
                  </li>
                </ul>

                <h5 className="guide-subsection-title">⚠️ Maintenance & Reset</h5>
                <ul className="guide-list">
                  <li>
                    <strong>Purge Old Weeks:</strong> Navigate to <em>Settings {"→"} Data Management</em> to permanently delete historical weeks and clean up storage. (Safe Lock: Type confirmation text to delete).
                  </li>
                  <li>
                    <strong>Clear Week:</strong> Empties the current week only.
                  </li>
                  <li>
                    <strong>Clear All Data:</strong> Permanently deletes everything across all regions.
                  </li>
                </ul>
              </Section>
            </>
          )}

          {activeTab === "watchlist" && (
            <>
              <h2 className="guide-tab-title">Watchlist & Analytics</h2>

              <div className="guide-intro">
                <p>
                  <strong>Philosophy:</strong> TradeClarity.market is not just a list; it is
                  a <em>process enforcer</em>. It compels you to define your criteria
                  first, then measure every stock against that standard, ensuring
                  disciplined, data-driven decisions.
                </p>
              </div>

              <Section title="1. The Weekly Workflow" icon="📅">
                <p>
                  TradeClarity.market is built around a weekly routine. Each week acts as a
                  fresh container for your watchlist.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Date Picker:</strong> Select any date to automatically
                    load the trading week containing that day.
                  </li>
                  <li>
                    <strong>Week Dropdown:</strong> Navigate your history. Changing
                    the value brings up the data for that specific week.
                  </li>
                </ul>
              </Section>

              <Section
                title="2. Adding Stocks"
                icon="➕"
                location="Top Right of Grid"
              >
                <p>
                  Populate your watchlist easily. You can add stocks manually or
                  import them.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Bulk Add:</strong> Click <em>+ Add Stock</em> and paste a
                    comma-separated list (e.g., <code>AAPL, MSFT, NVDA</code>) to add
                    multiple at once.
                  </li>
                  <li>
                    <strong>TradingView Import:</strong> In the Add Stock popup,
                    switch to the "TradingView Import" tab to paste exported watchlist
                    data directly.
                    <div className="guide-tip mt-2 mb-2">
                      <strong>💡 Pro Tip:</strong> In TradingView, use sections (e.g.
                      '###Technology') to group stocks. If a section name matches a Sector
                      defined here, the app will automatically assign that sector to the
                      stocks added via TradingView Import.
                    </div>
                  </li>
                  <li>
                    <strong>Auto-Fetch Metrics:</strong> If enabled in Rules, adding new stocks will automatically fetch and calculate their ADR and Liquidity in the background.
                  </li>
                </ul>
              </Section>

              <Section
                title="3. The Grid & Columns"
                icon="📝"
                actionLabel="Customize Columns →"
                actionKey="columns"
                location="Settings > Columns"
              >
                <p>
                  Your main workspace. You have full control over what data is
                  displayed.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Sorting:</strong> Click column headers to sort. Sorting by{" "}
                    <em>"Checks Passed"</em> is the best way to find top candidates.
                  </li>
                  <li>
                    <strong>Tradable:</strong> The checkbox is your final commitment.
                    Mark stocks as "Tradable" to add them to your final execution
                    list.
                  </li>
                  <li>
                    <strong>Live Syncing:</strong> When adding stocks or switching weeks, the app automatically fetches ADR and Liquidity in the background. A progress bar in the header tracks this status.
                  </li>
                </ul>
              </Section>

              <Section
                title="4. Search & Filters"
                icon="🔍"
                actionLabel="Configure Filters →"
                actionKey="filter"
                location="Settings > Filters"
              >
                <p>
                  As your watchlist grows, use search and filters to zero in on
                  specific setups.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Search:</strong> Use the search bar at the top left of the
                    grid to instantly find stocks by <em>Symbol</em> or text within{" "}
                    <em>Notes</em>.
                  </li>
                  <li>
                    <strong>Configuration:</strong> By default, filters are hidden.
                    Click <em>Configure Filters</em> to select which parameters (e.g.,
                    Sector, Pattern) you want to filter by.
                  </li>
                  <li>
                    <strong>Filters:</strong> Once enabled in settings, Filter
                    Criteria appear above the grid. Use them to hide noise and focus
                    on quality.
                  </li>
                </ul>
              </Section>

              <Section
                title="5. Visual Analytics & AI"
                icon="📊"
                actionLabel="AI Settings →"
                actionKey="settings"
                location="Top Left Icons"
              >
                <p>Go beyond the spreadsheet view with visual insights.</p>
                <ul className="guide-list">
                  <li>
                    <strong>Weekly Summary:</strong> Click the info icon next to the
                    date picker to see a snapshot of the week's health.
                  </li>
                  <li>
                    <strong>Analytics (Chart Icon):</strong> Visualize distributions
                    of Sectors, Tags, and Parameters to spot concentration risks. Use the <strong>Download</strong> button to save a professional PDF report.
                  </li>
                  <li>
                    <strong>AI Analysis (✨):</strong> Sends anonymized data to Google
                    Gemini to generate a professional summary of Market Bias, Top
                    Sectors, and Key Risks.
                  </li>
                  <li>
                    <strong>Custom AI Strategies:</strong> Go to <em>Settings {"→"} AI Settings</em> to create your own instructions. You can define specific ways the AI should evaluate your watchlist (e.g. 'Conservative Evaluation', 'Aggressive Growth Focus').
                    <div className="guide-note">
                      Note: Use variables like <code>{"{stocks}"}</code> or <code>{"{sectors}"}</code> in your custom prompts. The system will automatically inject your real-time data into these placeholders before sending to the AI.
                    </div>
                  </li>
                </ul>
              </Section>

              <Section
                title="6. Category Analysis (Deep Dive)"
                icon="🔍"
                location="Category Badge Click"
              >
                <p>
                  Perform a professional-grade drill-down into any sector or category.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Snapshot:</strong> A "Bird's Eye" grid of mini-historical charts for all stocks in the group. Toggle between 1M, 3M, 6M, and 1Y views.
                  </li>
                  <li>
                    <strong>Phenomena (AI Research):</strong> Generates an institutional-grade report that tiers the category into <strong>Leaders</strong> and <strong>Laggards</strong>, while providing specific technical entry triggers.
                  </li>
                  <li>
                    <strong>Leadership Logic:</strong> The header "Top Picks" automatically bubble up the strongest performance leaders for your selected timeframe.
                  </li>
                </ul>
              </Section>

              <Section
                title="7. TradingView Integration"
                icon="📈"
                location="TradingView.com"
              >
                <p>
                  Journal setups in real-time without leaving your charts. The extension automatically injects a floating widget into TradingView.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Instant Sync:</strong> Add stocks, notes, tags, and parameters directly from the chart. Data is instantly saved to your dashboard.
                  </li>
                  <li>
                    <strong>Context Aware:</strong> The widget automatically detects the active ticker symbol from the page title.
                  </li>
                  <li>
                    <strong>Voice Commands:</strong> Click the microphone icon or press `Ctrl+Shift+S` (or `Cmd+Shift+S`) to dictate setups hands-free.
                    <ul className="guide-sublist guide-note mt-1 ml-4 list-disc">
                      <li>Assign values to custom fields: <em>"Set target to 150"</em> or <em>"Attitude is Excellent"</em></li>
                      <li>Add/Remove tags effortlessly: <em>"Add tag IPO Base"</em> or <em>"Remove all tags"</em></li>
                      <li>Toggle booleans: <em>"Tradable Yes"</em> or <em>"Fractals Off"</em></li>
                      <li>Log notes: <em>"Add notes this stock looks ready to break out"</em></li>
                      <li>Save instantly: <em>"Save the setup"</em> or <em>"Save"</em></li>
                    </ul>
                  </li>
                </ul>
                <div className="guide-tip">
                  <strong>💡 How to use:</strong> Open any chart on TradingView. The widget appears automatically. Ensure the <strong>Region</strong> (US/IN) and <strong>Date</strong> in the widget header match your current trading plan.
                </div>
              </Section>

              <Section title="8. Keyboard Shortcuts" icon="⌨️">
                <ul className="guide-list">
                  <li><strong>Alt + N:</strong> Add New Stock</li>
                  <li><strong>Ctrl + K</strong> (or Cmd + K): Focus Search Bar</li>
                  <li><strong>Alt + S:</strong> Open Settings</li>
                  <li><strong>Alt + A:</strong> Open Analytics Dashboard</li>
                  <li><strong>Alt + I:</strong> Generate AI Insights</li>
                  <li><strong>Alt + T:</strong> Toggle Light/Dark Theme</li>
                  <li><strong>Escape:</strong> Close active modal</li>
                </ul>
              </Section>
            </>
          )}

          {activeTab === "pulse" && (
            <>
              <h2 className="guide-tab-title">Market Pulse Guide</h2>
              
              <Section title="1. Overview & Philosophy" icon="📈">
                <p>
                  The <strong>Market Pulse</strong> dashboard acts as your bird's-eye view of indices and sector performance. 
                  Rather than evaluating tickers in isolation, you should first look here to understand the broader market trend, momentum strength, and system risk levels.
                </p>
              </Section>

              <Section title="2. Snapshot (Indices Grid)" icon="🖼️">
                <p>
                  A real-time overview of the indices, sector ETFs, or breadth indicators.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Mini Candlestick Charts:</strong> Small charts displaying the historical price action of each index. Hover or check the fullscreen layout for details.
                  </li>
                  <li>
                    <strong>52-Week Range Bar:</strong> Shows the current position of the index between its yearly low (L) and yearly high (H). A fill ratio near 100% signifies it is trading at or near new yearly highs, indicating potential breakouts.
                  </li>
                  <li>
                    <strong>MAs Bar (Moving Averages):</strong> Five small blocks displaying whether the current price is above (Green/Bullish) or below (Red/Bearish) the <strong>5MA, 10MA, 21MA, 50MA, and 200MA</strong>.
                  </li>
                  <li>
                    <strong>Drag and Drop ordering:</strong> Rearrange cards by dragging the drag handle in the upper left corner to sort them based on your monitoring needs.
                  </li>
                  <li>
                    <strong>Favorites:</strong> Click the star icon to save indices as favorites. You can sort the screen to show favorites first.
                  </li>
                  <li>
                    <strong>Fullscreen Charting:</strong> Click the expand icon to view an interactive chart, switch timeframes from 1d to 5y, see exact moving average values, or click <em>Analyze ↗</em> to open it directly in TradingView.
                  </li>
                </ul>
              </Section>

              <Section title="3. Intelligence (Market Matrix)" icon="🧠">
                <p>
                  An institutional-grade, detailed breakdown of all index metrics.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>RS Rating (Relative Strength):</strong> Measures how strongly the index is outperforming (+) or underperforming (-) the primary benchmark (Nifty 50 in India, S&P 500 in the US) on a rolling timeframe.
                  </li>
                  <li>
                    <strong>52W High %:</strong> Distance of the current index price from its 52-week high. 0.0% means it is currently trading at a yearly high.
                  </li>
                  <li>
                    <strong>RSI (14):</strong> Relative Strength Index. Values above 70 indicate an overbought market (vulnerable to consolidation/pullbacks), while values below 30 indicate oversold conditions (potential reversal candidates).
                  </li>
                  <li>
                    <strong>Moving Average Deviations (21MA, 50MA, 200MA):</strong> Percentage distance of the current price from its short, medium, and long-term trendlines. Large deviations highlight overextended markets.
                  </li>
                  <li>
                    <strong>Market Phase / Verdict:</strong> The color-coded badge displays the structural phase (e.g. Bullish, Consolidation, Bearish, or Distribution) determined by the alignment of the moving averages and price behavior.
                  </li>
                </ul>
              </Section>

              <Section title="4. Heatmap (Sector Relative Strength)" icon="🔥">
                <p>
                  A visual relative strength grid of sectors to identify where institutions are rotating capital.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Intensity Shading:</strong> Tiled sectors are sorted by daily percent change. Strong gainers are colored in deep green, while strong decliners are shaded deep red.
                  </li>
                  <li>
                    <strong>Sector Breadth:</strong> If most tiles are green, it signals strong market-wide participation. If only a few defensive sectors are green, it suggests market caution.
                  </li>
                </ul>
              </Section>

              <Section title="5. Technical Thesis" icon="📝">
                <p>
                  At the bottom of the Snapshot page, the system displays the <strong>Technical Thesis</strong>.
                </p>
                <ul className="guide-list">
                  <li>
                    This is an automated analysis summarizing the daily tape, structural trends, leading sectors, and key tactical action plans based on the current matrix data.
                  </li>
                </ul>
              </Section>
            </>
          )}

          {activeTab === "journal" && (
            <>
              <h2 className="guide-tab-title">Trading Journal Guide</h2>

              <Section title="1. Philosophy & Purpose" icon="📓">
                <p>
                  A professional trading journal enforces discipline. Recording your setups, risk-reward parameters, and scaling points prevents impulsive decisions, provides audit trails, and lets you calculate performance stats objectively. Treating trading as a business requires tracking every unit of risk and analyzing your performance parameters over time.
                </p>
              </Section>

              <Section title="2. Position Ledger (Standard Tab)" icon="📝">
                <p>
                  The position ledger is your central trade database. It displays all open, closed, scaled, and planned positions in a custom table view.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Table Customization:</strong> Click the gear icon to customize column visibility, adjust width, and change sorting priority. You can sort by columns (e.g., date, return, status) to analyze specific trades.
                  </li>
                  <li>
                    <strong>Real-time P&L:</strong> Computes floating profit/loss for open positions based on live index price ticks, and locks in realized P&L when a trade status is changed to "Closed".
                  </li>
                  <li>
                    <strong>Search & Filter bar:</strong> Search for trades instantly by symbol or text in notes, and filter trades by status (Open, Closed, Scaled, Planned) or strategies (e.g. Pullback, Breakout).
                  </li>
                </ul>
              </Section>

              <Section title="3. Creating & Editing Trades (Form Fields)" icon="📝">
                <p>
                  When you add a trade or click the edit icon in the ledger, a comprehensive detail form opens. Understanding these inputs helps ensure accurate record keeping:
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Ticker Symbol:</strong> The stock ticker code representing your trade (e.g. AAPL or RELIANCE).
                  </li>
                  <li>
                    <strong>Strategy / Setup:</strong> Select the technical setup or strategy used (e.g. Pullback, Breakout, Mean Reversion). Select "Other" to input a custom strategy name.
                  </li>
                  <li>
                    <strong>Entry Price & Quantity:</strong> The initial execution price and number of shares/units purchased.
                  </li>
                  <li>
                    <strong>Entry Date:</strong> The execution date and time.
                  </li>
                  <li>
                    <strong>Stop Loss & Target Price:</strong> Define your defensive exit point (Stop Loss Price or %) and profit goal (Target Price or %).
                  </li>
                  <li>
                    <strong>Current / Trailing Stop Loss:</strong> Adjust this field to trace a trailing stop as the stock price moves in your direction, ensuring you lock in profits and protect capital.
                  </li>
                  <li>
                    <strong>Position Status:</strong> Define the current state of the trade:
                    <ul className="guide-sublist ml-4 mt-1 list-disc">
                      <li><em>Planned:</em> Setup identified on watchlist, order not yet executed.</li>
                      <li><em>Open:</em> Position is active and currently tracking live performance.</li>
                      <li><em>Scaled:</em> Position has undergone scale-in buying additions or scale-out selling reductions.</li>
                      <li><em>Closed:</em> Trade is fully exited.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Exit Price & Date:</strong> Input the average exit price and date when closing the position to calculate finalized returns.
                  </li>
                  <li>
                    <strong>Entry Thesis & Chart Snapshot:</strong> Document your setup rationale and paste a TradingView chart screenshot URL to log visual technical entry points.
                  </li>
                  <li>
                    <strong>Post-Mortem & Reflections:</strong> For closed trades, record key psychological lessons, execution notes, or mistakes to improve future decisions.
                  </li>
                </ul>
              </Section>

              <Section title="4. Advanced Position Sizing Calculator" icon="⚖️">
                <p>
                  Enforces risk discipline before you click buy. The form contains an automatic sizing calculator:
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Account Capital & Risk %:</strong> Enter your total trading capital and select the capital risk percentage you want to allocate to this trade (e.g., 0.5%, 1%, 2%, or a custom amount).
                  </li>
                  <li>
                    <strong>Quantity & Max Risk Calculation:</strong> Based on the distance between your <strong>Entry Price</strong> and <strong>Stop Loss</strong>, the calculator automatically suggests the optimal share quantity to buy, ensuring that if you get stopped out, your loss is strictly limited to your risk percentage (Max Cash Risk).
                  </li>
                </ul>
              </Section>

              <Section title="5. Scale-In & Pyramiding (Multi-Transaction Support)" icon="➕">
                <p>
                  Professional traders scale their trades. The journal supports managing multiple entries or partial exits under a single position:
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Scaling Log:</strong> Under the scaling form, log each subsequent addition (scale-in buy) or partial exit (scale-out sell).
                  </li>
                  <li>
                    <strong>Average Cost Basis:</strong> The system automatically computes the weighted average entry price and updates the total quantity of active shares in real-time, preventing messy duplicate logs.
                  </li>
                </ul>
              </Section>

              <Section title="6. Visual Candlesticks (Snapshot Tab)" icon="🖼️">
                <p>
                  A visual overview gallery of all open positions.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Price Chart Overlays:</strong> Displays active positions as mini candlestick charts.
                  </li>
                  <li>
                    <strong>Technical Reference Levels:</strong> Plots three key horizontal lines representing your trade parameters: <strong>Entry Price (Blue)</strong>, <strong>Stop Loss (Red)</strong>, and <strong>Target Price (Green)</strong>.
                  </li>
                  <li>
                    <strong>Distance Stats:</strong> Displays real-time percentages indicating how far the current price is from your stop-loss or target, giving you a clear visual of trade progression.
                  </li>
                </ul>
              </Section>

              <Section title="7. Auditing Performance Edge (Analytics Tab)" icon="📈">
                <p>
                  An analytical dashboard to audit your system edge.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Win Rate & Profit Factor:</strong> Win Rate calculates the percentage of closed positions that resulted in profits. Profit Factor is the ratio of gross gains to gross losses. A value above 1.5 indicates a highly profitable strategy.
                  </li>
                  <li>
                    <strong>R-Multiple Metrics:</strong> Measures your returns in units of risk (R). A trade that returns 2R means your gain was 2 times your initial dollar risk. The analytics tab aggregates total R-Multiple returns to measure the efficiency of your risk management.
                  </li>
                  <li>
                    <strong>Performance Curve:</strong> A line graph charting your account equity over time.
                  </li>
                  <li>
                    <strong>Benchmark Comparison:</strong> Plots your equity curve directly against indices (Nifty 50 or S&P 500) to confirm if you are outperforming the market index.
                  </li>
                </ul>
              </Section>
            </>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button className="outline" onClick={onClose}>
          Close Guide
        </button>
      </div>
    </Modal>
  );
}
