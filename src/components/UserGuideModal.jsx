import React, { useState } from "react";
import Modal from "./Modal";

const Section = ({
  title,
  icon,
  children,
  actionLabel,
  actionKey,
  primaryAction,
  location,
  onNavigate,
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
          onClick={() => onNavigate && onNavigate(actionKey)}
          className={primaryAction ? "primary-btn" : "outline"}
        >
          {actionLabel}
        </button>
      </div>
    )}
  </div>
);

export default function UserGuideModal({
  isOpen,
  onClose,
  onOpenModal,
  initialTab = "onboarding",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);


  const handleNavigate = (action) => {
    onClose();
    // Small delay to ensure the guide closes fully before the new modal opens
    setTimeout(() => {
      onOpenModal(action);
    }, 100);
  };

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
            onClick={() => setActiveTab("onboarding")}
            className={`guide-menu-btn ${activeTab === "onboarding" ? "active" : ""}`}
          >
            <span>Quick Start / Onboarding</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`guide-menu-btn ${activeTab === "settings" ? "active" : ""}`}
          >
            <span>All Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("ai_settings")}
            className={`guide-menu-btn ${activeTab === "ai_settings" ? "active" : ""}`}
          >
            <span>AI & Strategy Library</span>
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
          {activeTab === "onboarding" && (
            <>
              <h2 className="guide-tab-title">Quick Start & Onboarding Guide</h2>

              <div className="guide-intro">
                <p>
                  <strong>Welcome to TradeClarity.market!</strong> This step-by-step onboarding guide walks you through setting up your environment, defining your trading parameters, populating your watchlist, and leveraging institutional AI to analyze your setups.
                </p>
              </div>

              <Section
                title="Step 1: Region & Custom Watchlists Setup"
                actionLabel="Manage Watchlists →"
                actionKey="watchlists"
                location="Header > Region Switcher / Settings > Watchlists"
                onNavigate={handleNavigate}
              >
                <p>
                  TradeClarity operates cleanly across regional markets with independent local storage databases.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Switch Market Region (US / IN):</strong> Click the region indicator in the top header to toggle between US and Indian stock markets. Data, watchlists, and sector settings are maintained separately for each market.
                  </li>
                  <li>
                    <strong>Organize Watchlists:</strong> Create custom watchlists (e.g., "High Tight Flags", "Focus 50", "Earnings Play") to segment your focus. Define unique visible columns and filter sets for each watchlist.
                  </li>
                </ul>
              </Section>

              <Section
                title="Step 2: Define Trading Parameters, Sectors & Rules"
                actionLabel="Configure Parameters →"
                actionKey="params"
                location="Settings > Parameters / Sectors / Rules"
                onNavigate={handleNavigate}
              >
                <p>
                  Transform your trading from gut feelings into a disciplined, data-driven process.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Define Parameters:</strong> Create custom criteria (e.g., RSI Alignment, Volume Surge, Pattern Quality, MA Position) and set ideal target values. Enable <em>"Consider as Check"</em> to calculate an objective check score (e.g., <strong>4/5</strong>) for every stock.
                  </li>
                  <li>
                    <strong>Sectors & Tags:</strong> Group stocks into industries under <em>Settings &gt; Sectors</em>, and add ad-hoc tags (e.g., "IPO Base", "Leader") for rapid filtering.
                  </li>
                  <li>
                    <strong>Rules & RS Timeframe:</strong> Lock historical weeks to maintain journal integrity, select your benchmark outperformance timeframe (1M, 3M, 6M, 1Y), and enable auto-fetching for ADR & Liquidity.
                  </li>
                </ul>
              </Section>

              <Section
                title="Step 3: Add & Import Stocks into Your Watchlist"
                actionLabel="Add / Import Stocks →"
                actionKey="add_stock"
                location="Top Right of Grid (+ Add Stock)"
                onNavigate={handleNavigate}
              >
                <p>
                  Populate your grid effortlessly using flexible manual entry or batch imports.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Bulk Add Tickers:</strong> Click <em>+ Add Stock</em> and paste comma-separated symbols (e.g., <code>AAPL, NVDA, MSFT</code>) to populate your active week in seconds.
                  </li>
                  <li>
                    <strong>TradingView Watchlist Import:</strong> Switch to the TradingView Import tab in the popup and paste exported watchlist text directly.
                  </li>
                  <div className="guide-tip mt-2 mb-2">
                    <strong>Pro Tip:</strong> Group your TradingView watchlist with section headers like <code>###Technology</code> or <code>###Semiconductors</code>. When imported, TradeClarity automatically assigns matching Sectors to those stocks!
                  </div>
                  <li>
                    <strong>Full Backup Import:</strong> Easily restore full JSON backups from the <em>Data Management</em> tab anytime you import or transfer setups between devices.
                  </li>
                </ul>
              </Section>

              <Section
                title="Step 4: Evaluate Setup Checks & Metrics in the Interactive Grid"
                actionLabel="Customize Columns →"
                actionKey="columns"
                location="Watchlist Dashboard Grid"
                onNavigate={handleNavigate}
              >
                <p>
                  Measure every stock candidate against your standard to filter out low-quality noise.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Sort by Checks Passed:</strong> Click the column header to rank top-scoring setups at the top of your grid.
                  </li>
                  <li>
                    <strong>Auto-Fetched Metrics:</strong> View background-calculated ADR (%), Average Daily Turnover (Liquidity), Moving Average alignments (5/10/21/50/200), and 5-tier Relative Strength (RS) outperformance ratings.
                  </li>
                  <li>
                    <strong>Imminent Earnings Countdown:</strong> Tickers with earnings coming up within 5 days are highlighted in red (e.g. <code>AAPL &lt;3d&gt;</code>) with 8-hour dynamic TTL caching.
                  </li>
                  <li>
                    <strong>Daily Trend Filter Badges:</strong> Click the Advances or Declines badges in the header to instantly filter momentum leaders up or down today.
                  </li>
                  <li>
                    <strong>Mark Tradable:</strong> Check the <em>Tradable</em> box on your highest conviction setups to commit them to your execution plan.
                  </li>
                </ul>
              </Section>

              <Section
                title="Step 5: Set Up AI Keys & Proprietary AI Analysis"
                actionLabel="AI Integration Settings →"
                actionKey="settings"
                location="Settings > AI Integration"
                onNavigate={handleNavigate}
              >
                <p>
                  Bring institutional AI directly into your trading workflow with zero cloud data sharing.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Add Google Gemini API Key:</strong> Enter your API key in <em>Settings &gt; AI Integration</em>. Your key is stored 100% locally on your browser. Click <strong>Test Connection</strong> to verify API connectivity.
                  </li>
                  <li>
                    <strong>Proprietary Strategy Library:</strong> Customize prompt templates for <em>Watchlist Macro Bias</em>, <em>Sector Phenomena Deep Research</em>, and <em>Single Stock Micro Analysis</em>. Use dynamic variables like <code>{"{stocks}"}</code>, <code>{"{sectors}"}</code>, and <code>{"{symbol}"}</code> to feed live grid data into prompts.
                  </li>
                  <li>
                    <strong>Generate AI Insights:</strong> Click the AI Insights button in the header toolbar to receive a complete institutional market bias analysis, leading sector breakdown, and risk assessment.
                  </li>
                </ul>
              </Section>

              <Section
                title="Step 6: Execute & Audit Trades in the Trading Journal"
                location="Main Menu > Trading Journal"
              >
                <p>
                  Treat your trading as a business by auditing executions and risk metrics.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Position Ledger & Sizing:</strong> Log open, closed, and planned trades. Use the built-in <strong>Position Sizing Calculator</strong> to determine exact share quantities based on your account risk percentage and stop-loss distance.
                  </li>
                  <li>
                    <strong>Auto-Import Executions:</strong> Drag and drop Zerodha Tradebook or Tax P&L files (.xlsx, .csv) to auto-import trades with FIFO matching and Liquid ETF filtering.
                  </li>
                  <li>
                    <strong>Performance Edge Analytics:</strong> Audit Win Rate, Profit Factor, R-Multiple distributions, and equity curves compared against market index benchmarks.
                  </li>
                </ul>
              </Section>

              <Section
                title="Step 7: Live TradingView Overlay & Hands-Free Dictation"
                location="TradingView.com Extension Widget"
              >
                <p>
                  Seamlessly sync your charting and journaling directly on TradingView.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Injected TradingView Widget:</strong> Open any ticker on TradingView to see the TradeClarity floating widget automatically. Add notes, checks, and tags without leaving your chart.
                  </li>
                  <li>
                    <strong>Voice Dictation (Ctrl+Shift+S):</strong> Press <code>Ctrl+Shift+S</code> on TradingView to dictate setups hands-free (e.g. <em>"Set target to 150"</em>, <em>"Add tag IPO Base"</em>, <em>"Tradable Yes"</em>, <em>"Save setup"</em>).
                  </li>
                </ul>
              </Section>
            </>
          )}

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
                  <li>
                    <strong>Full Screen Mode (⛶):</strong> Click the Expand/Compress icon or press <strong>Alt + F</strong> to expand TradeClarity to 100% full screen mode without UI distractions.
                  </li>
                </ul>
              </Section>

              <Section
                title="2. Custom Watchlists"
                icon="📋"
                actionLabel="Manage Watchlists →"
                actionKey="watchlists"
                location="Settings > Watchlists"
                onNavigate={handleNavigate}
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
                onNavigate={handleNavigate}
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
                onNavigate={handleNavigate}
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
                onNavigate={handleNavigate}
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
                title="6. Rules & Relative Strength (RS)"
                icon="🛡️"
                actionLabel="Configure Rules →"
                actionKey="rules"
                location="Settings > Rules"
                onNavigate={handleNavigate}
              >
                <p>
                  Configure automated technical parameters, history protection, and benchmark outperformance rules.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Lock Previous Weeks:</strong> Enable this to make past
                    weeks read-only. This is crucial for maintaining an accurate
                    trading journal.
                  </li>
                  <li>
                    <strong>Auto-Fetch Lookback:</strong> Enable background fetching of ADR, Liquidity, and Moving Averages across trading days.
                  </li>
                  <li>
                    <strong>Relative Strength (RS) Timeframe:</strong> Configure RS calculation duration in <em>Settings &gt; Rules</em> (1 Month, 3 Months [Default], 6 Months, or 1 Year).
                  </li>
                  <li>
                    <strong>Smart Benchmark Resolution:</strong> Automatically compares stock performance against market indices (Nifty Mid/Smallcap for India; Nasdaq 100 for US Tech / S&P 500 for US Non-Tech).
                  </li>
                  <li>
                    <strong>5-Tier Threshold Categorization:</strong> Categorizes net outperformance into <strong>Very Strong</strong> (&gt; +25%), <strong>Strong</strong> (+15% to +25%), <strong>Neutral</strong> (-3% to +15%), <strong>Weak</strong> (-15% to -3%), and <strong>Very Weak</strong> (&lt; -15%). Values auto-populate across Watchlist grids and background sync based on your exact Rule settings.
                  </li>
                  <li>
                    <strong>RS Chart View:</strong> In Deep View charts, toggle between <strong>% Change</strong> (normalized percentage overlay) and <strong>RS Line</strong> (Mansfield RS ratio indicator in a dedicated bottom sub-pane).
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
                    <strong>TradingView Export:</strong> Export your selected watchlist formatted with TradingView section headers (<code>###</code>). Choose to group stocks by <strong>Sector</strong>, <strong>Tag</strong>, or <strong>None</strong> for direct copying or <code>.txt</code> download.
                  </li>
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

          {activeTab === "ai_settings" && (
            <>
              <h2 className="guide-tab-title">AI Configurations & Prompt Library</h2>

              <div className="guide-intro">
                <p>
                  <strong>Proprietary Strategy Edge:</strong> TradeClarity.market lets you
                  integrate institutional AI directly into your trading workflow. Rather than using generic prompts, you can configure your own proprietary strategy templates (instructions) for analysis.
                </p>
              </div>

              <Section
                title="1. General AI Configuration"
                icon="🤖"
                actionLabel="AI Settings →"
                actionKey="settings"
                location="Settings > AI Integration > General"
                onNavigate={handleNavigate}
              >
                <p>
                  Set up your secure connection to the Google Gemini API.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Secure API Key:</strong> Obtain an API Key from the Google AI Studio portal. Your key is stored strictly on your local device (in Chrome Storage or browser LocalStorage) and never sent to external servers.
                  </li>
                  <li>
                    <strong>Connection Testing:</strong> Enter your key and click <strong>Test Connection</strong> to perform a live diagnostic check. You will receive a visual success status banner if the API is configured correctly.
                  </li>
                  <li>
                    <strong>Model Selection:</strong> Switch between available models (e.g., <em>Gemini 1.5 Flash</em> for fast, cost-efficient analysis; or <em>Gemini 1.5 Pro</em> for complex logic and premium reasoning). You can also type in a Custom Model ID if desired.
                  </li>
                  <li>
                    <strong>Pro Mode (Premium):</strong> Toggle the Pro Mode checkbox to enable premium templates and advanced reasoning features.
                  </li>
                </ul>
              </Section>

              <Section
                title="2. Proprietary Strategy Library"
                icon="📚"
                location="Settings > AI Integration > Prompt Library"
              >
                <p>
                  Customize the exact instructions sent to the AI for each of the core workflows. The library organizes templates into three distinct categories:
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Watchlist (Macro Bias):</strong> Used when analyzing the weekly watchlist. It defines how the AI evaluates weekly data, identifies risk-on/risk-off macro biases, highlights leading sectors, and flags potential SEPA setups.
                  </li>
                  <li>
                    <strong>Phenomena (Sector Deep Research):</strong> Used in the Category Analysis modal to analyze entire sectors. It guides the AI to perform leadership tiering and identify relative resilience/group anomalies.
                  </li>
                  <li>
                    <strong>Single Stock (Micro Deep-Dive):</strong> Used for micro analysis of a single stock. It defines how the AI conducts technical deep-dives covering trend structure, key levels, and execution triggers.
                  </li>
                </ul>
              </Section>

              <Section
                title="3. Mini Prompt Editor & Dynamic Variables"
                icon="✍️"
                location="Settings > AI Integration > Prompt Library > Editor"
              >
                <p>
                  You can edit strategies or create new ones using the built-in mini editor. The system supports <strong>real-time character counting</strong> and <strong>dynamic variables</strong>.
                </p>
                <p className="mt-2">
                  To feed active watchlist data into your AI instructions, click on any of the variable badges below the editor text area. This inserts placeholders that the system automatically hydrates:
                </p>
                
                <h5 className="guide-subsection-title">Watchlist Tab Variables</h5>
                <ul className="guide-list">
                  <li><code>{"{stocks}"}</code>: Hydrates a clean JSON dataset of all active stocks in the grid along with their notes, tags, checks, and metrics.</li>
                  <li><code>{"{sectors}"}</code>: Injects a list of sectors represented in your active watchlist.</li>
                  <li><code>{"{tickers}"}</code>: Injects a simple comma-separated list of all symbols in the grid.</li>
                </ul>

                <h5 className="guide-subsection-title">Phenomena Tab Variables</h5>
                <ul className="guide-list">
                  <li><code>{"{category}"}</code>: The name of the active sector or category being researched.</li>
                  <li><code>{"{tickers}"}</code>: Comma-separated list of all symbols belonging to that sector.</li>
                </ul>

                <h5 className="guide-subsection-title">Single Stock Tab Variables</h5>
                <ul className="guide-list">
                  <li><code>{"{symbol}"}</code> / <code>{"{name}"}</code>: The stock ticker code and company name.</li>
                  <li><code>{"{price}"}</code>: Injects the current last-traded price of the stock.</li>
                  <li><code>{"{sector}"}</code>: The assigned sector.</li>
                  <li><code>{"{notes}"}</code>: Injects your manual journal notes or voice-dictated remarks.</li>
                </ul>
              </Section>

              <Section
                title="4. Library Operations & Actions"
                icon="⚡"
                location="Settings > AI Integration > Prompt Library > Actions"
              >
                <p>
                  Manage multiple proprietary strategies efficiently with intuitive control buttons:
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Active Default (🎯):</strong> Set any custom or system prompt as the default analysis template. The system will automatically use the active default strategy when you trigger AI analyses.
                  </li>
                  <li>
                    <strong>Clone/Duplicate (📋):</strong> Instantly duplicate any template, including system defaults, so you can easily modify or customize the instructions without losing the original.
                  </li>
                  <li>
                    <strong>Edit / Update (📝):</strong> Tweak the name and instructions of any custom template inline and save changes instantly.
                  </li>
                  <li>
                    <strong>Delete (🗑️):</strong> Clean up unused strategies from your list. Deleting custom prompts includes safety checks to prevent deleting active defaults.
                  </li>
                  <li>
                    <strong>System Defaults (⚙️):</strong> Built-in professional templates are always kept safe. If you ever want to revert, you can clone or reference the system default cards marked with a "System default" badge.
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
                  <li>
                    <strong>Imminent Earnings Countdown (&lt;= 5d):</strong> When opening the Edit Stock modal for any stock, the sidebar list automatically highlights all eligible stocks that have earnings within 5 days (e.g. <code>AAPL &lt;3d&gt;</code>) next to their prices.
                  </li>
                  <li>
                    <strong>8-Hour Cache & Dynamic Countdown:</strong> Earnings & Fundamentals data is cached with an 8-hour TTL policy and dynamically calculates exact days remaining from your current local clock, ensuring date countdowns stay 100% accurate.
                  </li>
                </ul>
              </Section>

              <Section
                title="3. The Grid & Columns"
                icon="📝"
                actionLabel="Customize Columns →"
                actionKey="columns"
                location="Settings > Columns"
                onNavigate={handleNavigate}
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
                    <strong>Live Syncing:</strong> When adding stocks or switching weeks, the app automatically fetches ADR and Liquidity in the background. A progress capsule in the header tracks both technical metrics sync and AI processing simultaneously — hover it to see exact progress.
                  </li>
                  <li>
                    <strong>VCP Tightness Badges:</strong> Volatility Contraction Pattern tightness is displayed as inline badges (<em>Tight</em>, <em>Moderate</em>, <em>Wide</em>) directly in the grid, letting you spot stage 2 base quality at a glance without opening each stock.
                  </li>
                </ul>
              </Section>

              <Section
                title="4. Search & Filters"
                icon="🔍"
                actionLabel="Configure Filters →"
                actionKey="filter"
                location="Settings > Filters"
                onNavigate={handleNavigate}
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
                  <li>
                    <strong>Multi-Select Dropdown Search:</strong> Filter dropdowns for Sectors, Tags, Patterns and other multi-value criteria include an embedded live search bar — type to instantly narrow long option lists without scrolling.
                  </li>
                  <li>
                    <strong>Interactive Daily Trend Filters:</strong> Click the
                    Advances (▲) or Declines (▼) count badges in the grid header
                    to filter the list instantly for stocks that are UP or DOWN
                    today. The list is automatically sorted by the daily percent
                    change, letting you spot momentum leaders immediately. Click
                    the active badge again to clear the filter.
                  </li>
                </ul>
              </Section>

              <Section
                title="5. Visual Analytics & AI"
                icon="📊"
                actionLabel="AI Settings →"
                actionKey="settings"
                location="Top Left Icons"
                onNavigate={handleNavigate}
              >
                <p>Go beyond the spreadsheet view with visual insights.</p>
                <ul className="guide-list">
                  <li>
                    <strong>Weekly Summary:</strong> Click the info icon next to the
                    date picker to see a snapshot of the week's health.
                  </li>
                  <li>
                    <strong>Analytics Dashboard (Chart Icon):</strong> Visualize distributions of Sectors, Tags, Parameters, and AI Scope to spot concentration risks. Use the <strong>Download</strong> button to save a professional PDF report.
                  </li>
                  <li>
                    <strong>AI Business Scope & Macro Theme Detector (✨ AI Scope):</strong> Click <strong>AI Scope</strong> in the Stock Grid header or use <em>Bulk Categorization</em> to automatically classify each stock's primary revenue drivers, business scopes, and dependent macro market themes using Gemini AI. Results populate the <strong>Business Scope</strong> and <strong>Macro Theme</strong> columns in the grid.
                  </li>
                  <li>
                    <strong>AI Scope Breakdown Widgets:</strong> The Analytics Dashboard includes dedicated tag-pill breakdown widgets for Business Scope Distribution and Macro Theme Distribution — replacing generic bar charts with richer intelligence-driven layouts. Each widget shows category pills, stock counts, and color-coded mini progress bars.
                  </li>
                  <li>
                    <strong>Expanded Explorer (⤢ Expand):</strong> Click the expand icon on any AI Scope widget to open a full-width 3-column explorer. Use the built-in <strong>search bar</strong> to filter categories in real time, and toggle between <strong>Most Stocks</strong> and <strong>Name (A-Z)</strong> sort modes. Each category card shows all stocks assigned to it.
                  </li>
                  <li>
                    <strong>AI Analysis (✨):</strong> Sends anonymized data to Google
                    Gemini to generate a professional summary of Market Bias, Top
                    Sectors, and Key Risks.
                  </li>
                  <li>
                    <strong>Custom AI Strategies:</strong> Go to <em>Settings {"→"} AI Settings</em> to create your own instructions. You can define specific ways the AI should evaluate your watchlist (e.g. 'Conservative Evaluation', 'Aggressive Growth Focus'). Learn more details in the <strong>AI & Strategy Library</strong> tab of this guide!
                  </li>
                  <li>
                    <strong>Circuit Breakers & Rate Limits:</strong> On HTTP 429 API quota limit errors, the app triggers an automatic 15-minute circuit breaker to protect your API quota and displays a countdown notice banner.
                  </li>
                  <li>
                    <strong>Manual AI Cancellation (⏹ Stop AI):</strong> Click the red <strong>⏹ Stop AI</strong> mini button rendered inside the toolbar progress badge anytime to abort active bulk AI analysis or sector detection manually.
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

              <Section
                title="8. Deep View Workspace & Watchlist Grouping"
                icon="📋"
                location="Stock Symbol Click"
              >
                <p>
                  Click any stock symbol to open the <strong>Deep View Workspace</strong> for technical research, chart overlays, and watchlist organization.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Watchlist Grouping:</strong> Click the <em>Layers Icon (Group & Categorize)</em> in the sidebar toolbar to group stocks by <strong>Sector</strong>, <strong>Tag</strong>, <strong>Flag Color</strong>, or keep them flat.
                  </li>
                  <li>
                    <strong>Collapsible Groups:</strong> Sidebar sections collapse and expand dynamically. Stocks with no assigned category are placed under "Unassigned" at the bottom.
                  </li>
                  <li>
                    <strong>Moving Average settings (MAs):</strong> Click the <em>Gear Icon (MAs)</em> next to the timeframe selector to toggle which SMAs are displayed on the chart, customize line colors, and adjust thicknesses (1px to 4px).
                  </li>
                  <li>
                    <strong>Infinity Chart Data Loading:</strong> Charts in Deep View Workspace support continuous historical price backfilling. Scroll left on the chart to dynamically load older price bars on demand — seamlessly browse years of price action without hitting a data cutoff.
                  </li>
                  <li>
                    <strong>Navigation:</strong> Use <code>ArrowUp</code> / <code>ArrowDown</code> and <code>ArrowLeft</code> / <code>ArrowRight</code> keys to browse watchlist stocks. Switch symbols quickly via the <em>Search (Ctrl+K)</em> bar.
                  </li>
                </ul>
              </Section>

              <Section title="9. Keyboard Shortcuts" icon="⌨️">
                <ul className="guide-list">
                  <li><strong>Alt + N:</strong> Add New Stock</li>
                  <li><strong>Ctrl + K</strong> (or Cmd + K): Focus Search Bar</li>
                  <li><strong>Alt + S:</strong> Open Settings</li>
                  <li><strong>Alt + A:</strong> Open Analytics Dashboard</li>
                  <li><strong>Alt + I:</strong> Generate AI Insights</li>
                  <li><strong>Alt + T:</strong> Toggle Light/Dark Theme</li>
                  <li><strong>Alt + F:</strong> Toggle Full Screen Mode</li>
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
                    <strong>Mini Candlestick Charts:</strong> Small charts displaying the historical price action of each index. Click the fullscreen expand icon for an interactive chart view. Charts support <strong>continuous historical backfilling</strong> — scroll left to load older bars on demand, giving you seamless access to years of price data.
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

              <Section title="3. Auto-Importing Trades (Zerodha, Drag & Drop, Excel/CSV)" icon="📥">
                <p>
                  Quickly populate your journal by importing executions and tax P&L statements without manual data entry.
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>Drag & Drop Upload:</strong> Drag any Zerodha Tradebook, Zerodha Tax P&L Statement, or broker export file (.xlsx, .xls, .csv, .txt) directly onto the upload zone, or click to select from your file browser.
                  </li>
                  <li>
                    <strong>Broker Support & Intelligence:</strong> Auto-detects Zerodha Tax P&L summary sheets, Zerodha Tradebook executions, or general broker CSVs. Automatically groups buy and sell trades using FIFO position matching.
                  </li>
                  <li>
                    <strong>Trade Status Intelligence:</strong> Positions with 0 open quantity are automatically identified as <strong>Closed</strong> with locked realized P&L and holding days, while remaining open shares are imported as <strong>Active</strong>.
                  </li>
                  <li>
                    <strong>Exclude Liquid ETFs:</strong> Enable the <em>Exclude Liquid ETFs (LIQUIDCASE)</em> checkbox to filter out cash liquid funds (LIQUIDCASE, LIQUIDBEES, ICICILIQ, etc.) from importing into your stock journal.
                  </li>
                  <li>
                    <strong>Interactive Preview & Customization:</strong> Review matched positions in a spacious 1280px grid, adjust initial stop loss levels or setup tags inline, and use <em>Select All</em> or <em>Clear Selection</em> controls before saving.
                  </li>
                </ul>
              </Section>

              <Section title="4. Creating & Editing Trades (Form Fields)" icon="📝">
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
