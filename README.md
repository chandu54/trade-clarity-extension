# TradeClarity.market

**Your disciplined path to smarter trades.**

TradeClarity.market is a professional-grade trading workstation and browser extension designed for swing traders to manage weekly watchlists, automate technical scans, track setups, execute trade journals, and maintain institutional discipline. It operates both as a standalone web application and as an integrated Chrome Extension sidecar docked directly inside **Zerodha Kite** and **TradingView**.

<img width="958" height="456" alt="image" src="https://github.com/user-attachments/assets/9700b7d1-7573-4a5e-b1be-4edde64faa2b" />

---

## 🚀 Key Features

### ⚡ 1. Zerodha Kite Seamless Watchlist Integration
A zero-friction in-chart sidecar and floating metrics dock embedded directly into Zerodha Kite charts (`kite.zerodha.com`):
- **Side-by-Side Docking & Smart Canvas Compression**: Automatically mounts on any Kite chart window and dynamically compresses the chart canvas by the exact width of the sidecar—keeping candles, indicators, order controls, and watchlist 100% visible side-by-side without overlapping.
- **Draggable Top Header Metrics Dock**: Floats directly on the Kite navbar displaying live Price, Daily Change %, **Average Daily Range (ADR %)**, **50-Day Turnover / Liquidity (💧)**, **Relative Strength vs Nifty (RS 🔥)**, and **Moving Average Ribbon** (10, 21, 50, 200 SMA). Minimizes into a sleek glowing circular FAB.
- **Smart Earnings Countdown Pill**: Displays upcoming earnings countdown badges with instant visual priority (`⚡ TODAY`, `⚡ 2d` imminent earnings in orange, `📅 14d` upcoming in cyan, and `✓ Reported` for past results).
- **0ms Two-Way Synchronization**: Intercepts Zerodha's client-side history navigation (`pushState` / `replaceState`). When you search for any stock in Zerodha Kite, TradeClarity immediately detects the symbol with 0ms latency, highlights it, smoothly scrolls it into view, and auto-expands its collapsed sector group.
- **Active External Stock Banner & 1-Click "+ Add"**: When you search for a stock in Kite that is not currently in your TradeClarity watchlist, a clean banner appears (`SYMBOL • Active in Kite`) with a single-click `+ Add` button to instantly import it.
- **TradingView-Style 5-Color Flagging**: Quick-cycle flag ribbon system (Red, Blue, Green, Orange, Purple) with instant 1-click recent color apply/toggle and color palette popover.
- **Institutional Right-Click Context Menu**:
  - Crisp, monochrome TradingView-style vector SVG icons (zero emoji visual noise).
  - **Capture-Phase Keyboard Shortcuts**: `W` (Watchlists), `S` (Sector), `F` (Flag color), `T` (Tradable), `C` (Copy ticker), `Enter` (Edit setup), and `Del` / `Backspace` (Remove stock).
  - **160ms Hover-Intent Grace Buffer & Click-to-Lock**: Prevents submenus from prematurely vanishing during diagonal cursor travel to the left, with full click-to-lock support.
- **Section Headers & Market Breadth**: Title Case formatted sector and flag headers with live Advancers vs. Decliners breadth pill counters (e.g. `5▲ : 6▼`) and total stock count badges.
- **Accurate % Change Benchmark Calculation**: Uses official exchange previous close benchmarks from Yahoo Finance, eliminating intraday candle timing offsets.
- **Rapid Keyboard Flipping**: Press **`↑` / `↓` Arrow Keys** to step through stocks and switch Kite charts instantly without page reloads.

---

### 🤖 2. Built-in Automation Center & Autonomous CLI Agents
An automated scanning engine that eliminates repetitive manual scanning and spreadsheet work:
- **In-App Automation Center (`AutomationModal`)**: Accessible from the header (`⚡ Automations`) with real-time multi-stage visual progress bars:
  - **Recipe 1: Chartink Scanner » Qualified Setups (`chartink_scanner` — India 🇮🇳)**:
    - Programmatically ingests ~300 tickers from Chartink screener endpoints without manual copy-pasting.
    - **Smart Weekend Routing**: Automatically routes scans run on Saturday or Sunday to the upcoming Monday's weekly watchlist.
    - **Deep Technical Hydration**: Concurrently calculates 10/21/50/200 EMAs & SMAs, 50-day Turnover Liquidity (₹ Cr), Relative Strength vs Nifty (RS 🔥), and Stan Weinstein Stage analysis.
    - **Multi-Work-Item Slicing**: Splits setups into High Liquidity (> 50 Cr, above 21/50/200 MAs) assigned to the Primary Watchlist, and Mid-Cap Liquidity (25–50 Cr, above 50/200 MAs) assigned to the Mid-Cap Watchlist.
    - **Safety Circuit Breakers & Pruning**: Verifies at least 80% hydration before pruning non-qualifying symbols, protecting against network/latency drops.
  - **Recipe 2: IPO Radar Prep » Tagged Candidates (`ipo_radar_prep` — US 🇺🇸 & India 🇮🇳)**:
    - Downloads official listing archives from NSE (Mainboard & SME) and US (NASDAQ, NYSE, AMEX).
    - Evaluates Young IPO age (<60d), IPO Base consolidations, and VCP tightness contractions, importing qualified setups into `wl_ipo`.
- **Headless Autonomous CLI Agents (Playwright)**:
  - **Node.js Playwright Scanner** (`npm run sync:agent` / `scripts/sync-chartink-agent.js`): Connects to your Chrome profile via CDP remote debugging port (9222) or launches headless to execute Chartink scans, hydrate technicals, and populate watchlists automatically.
  - **Python Playwright Scanner** (`scripts/chartink_tradeclarity_agent.py`): Python implementation with exponential retry backoff, custom scan clause overrides, and headless browser automation.

---

### 📊 3. Trading Journal (`JournalView`)
A comprehensive execution ledger and risk management platform:
- **Position Ledger**: Custom table view tracking Planned, Open, Scaled, and Closed trades.
- **P&L & Return Metrics**: Live floating P&L for active trades and locked-in realized P&L and holding days for closed trades.
- **Automated Broker Import**: Drag and drop Zerodha Tradebook or Zerodha Tax P&L files (`.xlsx`, `.csv`) with automatic FIFO position matching, realized P&L calculation, and Liquid ETF filtering (`LIQUIDCASE`, `LIQUIDBEES`).
- **Position Sizing Calculator**: Input total account capital and risk percentage (0.5%, 1%, 2%) to automatically compute max share quantity and defensive risk exposure.
- **Scale-In / Pyramiding Support**: Log multi-transaction add-ons or partial exits with automated weighted average entry price calculation.
- **Executive System Analytics**: Track your statistical edge with **Win Rate %**, **Profit Factor**, **Expectancy**, **Average Winner vs. Loser**, **R-Multiple distribution**, and equity curves plotted against Nifty 50 or S&P 500 benchmarks.

---

### 🌐 4. Market Pulse & Regime Radar (`MarketPulseView`)
Bird’s-eye view of macro market health and sector rotation:
- **Major Indices Matrix**: Real-time coverage across **India** (Nifty 50, Nifty Bank, Nifty IT, Nifty Smallcap 100, India VIX) and **United States** (S&P 500, NASDAQ 100, Dow Jones, Russell 2000, VIX).
- **Multi-Timeframe Trend Tracking**: Performance heatmaps across **1D**, **1W**, **1M**, **YTD**, and **1Y**.
- **52-Week Range & MA Deviation**: Visual range bars showing proximity to yearly highs and percentage deviation from 21, 50, and 200-day moving averages.
- **AI-Powered Technical Thesis**: Automated daily macro tape summary, market regime classification, and tactical action plans.

---

### 🎯 5. Full Stock Screener Terminal (`ScreenerView`)
Institutional equity screener across all US & Indian stocks:
- **Free-Form Numeric Filters**: Filter by ADR % volatility (e.g. `>5`, `3-5`) and Turnover Liquidity (e.g. `>50 Cr`, `20-50M`).
- **Moving Average Posture**: Filter stocks constructively trading above the 10 EMA, 21 EMA, 50 SMA, and 200 SMA.
- **Pattern Detectors**: Instantly isolate IPO Bases and Tight VCP contractions.
- **1-Click Batch Import**: Select passing candidates and import them directly into the active weekly watchlist.

---

### 🚀 6. IPO Master Radar (US & India)
A dedicated institutional discovery terminal tracking all newly listed companies over their 1-year horizon:
- **Rolling 365-Day Window**: Continuously scans, archives, and tracks every stock listed within the past 365 days across NSE (Mainboard & SME) and US (NASDAQ, NYSE, AMEX).
- **Live Candle Hydration**: Computes Day 1 listing gains, return since listing close, ADR % volatility, and daily turnover liquidity.
- **Adaptive Young IPO Handling**: Automatically calculates ADR and Liquidity across exact available trading days for fresh listings without zero-padded distortion.

---

### 🔬 7. Deep View Workspace & Modular Tools Dock
High-performance workstation modal for technical chart analysis:
- **Infinity Candlestick Charting**: Dynamic historical price backfilling by scrolling left on the chart, loaded on demand with custom SMA/EMA overlays.
- **Modular Right Rail Dock**: Persistent dock providing instant overlays for your **Position Ledger**, **AI Micro-Analysis** (with Radium motion pulse feedback), and **News & Catalysts Radar**.
- **📰 News & Catalysts Radar**: Real-time breaking news feed combining Google News RSS and Yahoo Finance:
  - **Reverse Chronological Ranking**: Strictly sorted descending by publication timestamp (*2h ago, 12h ago, Yesterday*).
  - **Cascading Freshness Filters**: Uses dynamic recency filters (`when:14d` → `when:30d`) to eliminate months-old archives.
  - **Word-Boundary Symbol Isolation**: Regex word boundary (`\bSYMBOL\b`) prevents false ticker matches (e.g. `ABB` will never match AbbVie or Abbott).

---

### 🔍 8. Unified Stock Universe & Autocomplete (`stockUniverseService`)
- Preloaded offline universe covering all active NSE (Nifty 500 + active universe) and US equities.
- Real-time Yahoo Finance fallback search for unlisted, newly listed, or global tickers.
- Quick search & add directly inside Edit Stock Modal and StockGrid.

---

### 🧠 9. Visual Insights & AI Integration
- **Google Gemini & OpenAI Integration**: Generate professional market summaries, sector rotation analyses, and actionable setup ratings.
- **Proprietary Strategy Library**: Build custom prompt templates using dynamic variables (`{stocks}`, `{sectors}`, `{tickers}`) for Watchlist, Phenomena, or Single Stock analysis.
- **Category Analysis**: Modal-based drill-down view featuring "Bird's Eye" mini-candlestick grids and deep AI institutional research reports.
- **Analytics Dashboard**: Interactive distribution charts by Sector, Tags, Tradable status, and custom parameters with printable PDF reports.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| **↑ / ↓** | Zerodha Kite | Step through stocks & switch charts instantly |
| **Enter** | Zerodha / Grid | Open Edit Setup Modal |
| **W** | Zerodha Context Menu | Toggle Watchlist Assignment submenu |
| **S** | Zerodha Context Menu | Toggle Sector Assignment submenu |
| **F** | Zerodha Context Menu | Toggle Flag Color palette / cycle recent flag |
| **T** | Zerodha Context Menu | Toggle Tradable status |
| **C** | Zerodha Context Menu | Copy ticker symbol to clipboard |
| **Del / Backspace** | Zerodha Kite | Remove active stock from watchlist |
| **Ctrl + K** | Global | Focus Search bar |
| **Alt + N** | Dashboard | Add New Stock |
| **Alt + S** | Dashboard | Open Global Settings |
| **Alt + A** | Dashboard | Open Analytics Dashboard |
| **Alt + I** | Dashboard | Generate AI Insights |
| **Alt + T** | Dashboard | Toggle Light/Dark Theme |
| **Esc** | Global | Close Active Modal / Menu |
| **Ctrl + Shift + S** | TradingView | Voice-dictated setup journaling |

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TailwindCSS, CSS Variables
- **Build Tool**: Vite 5
- **Charts**: TradingView Lightweight Charts
- **Automation / Headless**: Playwright (Node.js & Python)
- **Market Data**: Yahoo Finance API & Chartink Screener API
- **AI Engines**: Google Generative AI (Gemini 1.5 Flash / Pro) & OpenAI API

---

## 📦 How to Run

### Prerequisites
- Node.js (v18+) installed on your machine.

### 1. As a Normal React Web App
Use this mode for development or static web hosting:
```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 2. As a Chrome Browser Extension (Zerodha Kite & TradingView In-Chart Sidecar)
Use this mode to mount the sidecar panel directly on **`kite.zerodha.com`** and **`tradingview.com`**:

```bash
# 1. Install dependencies
npm install

# 2. Build the extension bundle
npm run build
```

> [!IMPORTANT]
> The build process outputs the Chrome Extension directly into the **`extension/`** folder (containing `manifest.json`, `content.js`, `background.js`, `dashboard.html`, etc.).

3. **Load into Google Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked**.
   - Select the **`extension/`** folder (located in the project root).
   - The TradeClarity icon will appear in your Chrome toolbar. Open any chart on [Zerodha Kite](https://kite.zerodha.com) or [TradingView](https://www.tradingview.com) to see the in-chart integration active immediately!

---

### 3. Running Autonomous CLI Scans
To execute scheduled or headless scans directly into your Chrome profile:

```bash
# Run Node.js Playwright automated Chartink sync
npm run sync:agent

# Or run the standalone Python agent
python scripts/chartink_tradeclarity_agent.py
```

---

## 🔒 Security & Privacy Note

- **Local-First Storage**: All watchlists, trades, notes, and technical parameters are stored locally on your device (Chrome Storage / LocalStorage).
- **Direct API Communication**: Your Google Gemini and OpenAI API keys are kept strictly in your local browser storage and are sent only to the respective AI provider endpoints.
- **Zero Third-Party Relays**: No trading credentials or watchlist data are ever transmitted to any intermediary server.
