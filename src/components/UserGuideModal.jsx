import React from "react";
import Modal from "./Modal";

export default function UserGuideModal({
  isOpen,
  onClose,
  onOpenModal,
}) {
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
        <div className="guide-icon">{icon}</div>
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
      subtitle="Mastering your swing trading process with TradeClarity"
      className="modal-wide"
    >
      <div className="modal-body user-guide-body">
        <div className="guide-intro">
          <p>
            <strong>Philosophy:</strong> TradeClarity is not just a list; it is
            a <em>process enforcer</em>. It compels you to define your criteria
            first, then measure every stock against that standard, ensuring
            disciplined, data-driven decisions.
          </p>
        </div>

        <Section title="1. Global Settings" icon="🌍">
          <p>Configure the app environment before you start.</p>
          <ul className="guide-list">
            <li>
              <strong>Region (🇺🇸/🇮🇳):</strong> Use the flag icon in the header
              to switch between US and Indian markets. Data is stored separately
              for each region.
            </li>
            <li>
              <strong>Theme (🌗):</strong> Toggle the Sun/Moon icon to switch
              between Light and Dark modes.
            </li>
          </ul>
        </Section>

        <Section title="2. The Weekly Workflow" icon="📅">
          <p>
            TradeClarity is built around a weekly routine. Each week acts as a
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
          title="3. Adding Stocks"
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
              <div className="guide-tip mt-2" style={{ marginBottom: "8px" }}>
                <strong>💡 Pro Tip:</strong> In TradingView, use sections (e.g.
                '###Technology') to group stocks. If a section name matches a Sector
                defined here, the app will automatically assign that sector to the
                stocks added via TradingView Import.
              </div>
            </li>
            <li>
              <strong>Auto-Fetch Metrics:</strong> If enabled in Editing Rules, adding new stocks will automatically fetch and calculate their ADR and Liquidity in the background.
            </li>
          </ul>
        </Section>

        <Section
          title="4. Custom Watchlists"
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
          title="5. Parameters & Scoring"
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
          title="6. Sectors & Organization"
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
          title="7. Tags & Labels"
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
          title="8. The Grid & Columns"
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
          </ul>
        </Section>

        <Section
          title="9. Search & Filters"
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
          title="10. Visual Analytics & AI"
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
              of Sectors, Tags, and Parameters to spot concentration risks.
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
          title="11. Category Analysis (Deep Dive)"
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
          title="12. Editing Rules"
          icon="🛡️"
          actionLabel="Configure Rules →"
          actionKey="rules"
          location="Settings > Editing Rules"
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
          title="13. Data Management"
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

          <h5 className="guide-subsection-title">⚠️ Reset Data</h5>
          <ul className="guide-list">
            <li>
              <strong>Clear Week:</strong> Empties the current week only.
            </li>
            <li>
              <strong>Clear All Data:</strong> Permanently deletes everything.
              Irreversible.
            </li>
          </ul>
        </Section>

        <Section
          title="14. TradingView Integration"
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

        <Section title="15. Keyboard Shortcuts" icon="⌨️">
          <ul className="guide-list">
            <li><strong>Alt + N:</strong> Add New Stock</li>
            <li><strong>Ctrl + /</strong> (or Cmd + /): Focus Search Bar</li>
            <li><strong>Alt + S:</strong> Open Settings</li>
            <li><strong>Alt + A:</strong> Open Analytics Dashboard</li>
            <li><strong>Alt + I:</strong> Generate AI Insights</li>
            <li><strong>Escape:</strong> Close active modal</li>
          </ul>
        </Section>

      </div>
      <div className="modal-footer">
        <button className="outline" onClick={onClose}>
          Close Guide
        </button>
      </div>
    </Modal>
  );
}
