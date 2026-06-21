# TradeClarity.market (Core System Architecture & Technical Reference)

This reference document serves as an architectural blueprint and implementation reference for the TradeClarity Chrome Extension & Web Application. It outlines the design philosophy, file structures, data schemas, API integrations, NLP voice dictation mappings, and future extension guidelines. Use this as a foundation when introducing new features.

---

## 📂 Core File & Directory Mapping

```
trade-clarity-plugin/
├── public/                 # Static assets and Extension manifest
├── src/
│   ├── assets/             # Extension icons, UI illustrations
│   ├── components/         # Core UI Components
│   │   ├── AddStockModal.jsx         # Handles stock ingestion (Bulk & TV imports)
│   │   ├── AnalyticsDashboard.jsx    # Visual distributions, custom layouts, PDF engine
│   │   ├── CategoryAnalysisView.jsx  # Drill-down Snapshot (sparklines) & Phenomena (AI)
│   │   ├── EditStockModal.jsx        # Detail panel for editing checklist params, notes, tags
│   │   ├── Header.jsx                # Global navigation, region toggle, settings links
│   │   ├── MiniCandlestickChart.jsx  # High-density SVG sparkline charts
│   │   ├── MovingAverageRibbon.jsx   # Institutional trend ribbon (5, 10, 21, 50, 200 SMA badges)
│   │   ├── StockGrid.jsx             # Grid checklist UI, sorting, filtering, editing rules
│   │   ├── WeekSelector.jsx          # Timeframe traversal and AI panel trigger
│   │   └── ...                       # Modals, context providers, layout elements
│   ├── constants/          # Global application configs and structural models
│   ├── content/            # Chrome Content Scripts
│   │   └── TradeClarityWidget.jsx    # Floating TradingView Widget with Speech Recognition
│   ├── hooks/              # Custom React Hooks (useTheme, useModalState)
│   ├── services/           # Network APIs & Local Storage management
│   │   ├── ai.js                     # Gemini & OpenAI integrations (v1beta model fetches)
│   │   ├── marketPulse.js            # Index & Sectoral Health Score engines
│   │   └── storage.js                # Chrome Storage Local & Web LocalStorage adapters
│   ├── utils/              # Calculation helpers & formatting libraries
│   │   ├── metrics.js                # ADR, Liquidity buckets, and SMA mappings
│   │   ├── paramUtils.js             # Region-aware custom parameter helpers
│   │   ├── weekHelpers.js            # Sunday-based week calculation helpers
│   │   └── yahooFinanceMap.js        # Historical Yahoo Finance scraping & proxy mapping
│   ├── App.jsx             # Global App State, keyboard shortcuts, view router
│   ├── main.jsx            # React root mount point
│   ├── seed.js             # Initial database models, standard parameters, and sector taxonomy
│   └── styles.css          # Core Design System, CSS Variables, Theme colors
├── package.json            # Vite & React configurations
├── vite.config.js          # Core app builder config
└── vite.content.config.js  # Dedicated bundler for the TradingView content script
```

---

## 🎨 System Philosophy & Design Aesthetics
TradeClarity acts as a **swing trading process enforcer** (referencing Mark Minervini's SEPA and William O'Neil's CANSLIM methodologies).
*   **Structured Quality Scores**: Instead of simple watchlists, the system computes a "Checks Passed" score (e.g., `4/5`) for every stock based on custom user-defined technical rules.
*   **Time-Locked History**: Encourages a systematic **"Sunday Routine"** where traders plan the week, shortlist "Tradable" ideas, and lock past weeks (`Settings > Editing Rules`) to prevent historical journal tempering.
*   **Unified Visual Identity**: Utilizes rich glassmorphic aesthetics, harmonious tailwind-grade CSS variables (emerald, rose, slate), custom Google Fonts (Inter, Outfit), and dynamic micro-animations.

---

## 💾 Data Schema & Storage Architecture (`storage.js` & `seed.js`)

TradeClarity supports dual-mode persistence:
1.  **Chrome Storage API (`chrome.storage.local`)**: Activated when running inside an unpacked Chrome extension context.
2.  **Web LocalStorage API**: Fallback context utilized when run as a standalone React web app.

### Database Schema Structure (`DEFAULT_DATA` in `seed.js`)
```json
{
  "theme": "dark",
  "isPro": false,
  "watchlists": [],
  "analyticsLayout": {},
  "sectors": [
    { "name": "IT", "countries": ["IN", "US"] },
    { "name": "AI Stocks", "countries": ["US"] }
  ],
  "paramDefinitions": {
    "stage": {
      "label": "Stage",
      "type": "select",
      "options": ["Stage 1", "Stage 2", "Stage 3", "Stage 4"],
      "filterable": true,
      "isCheck": true,
      "idealValues": ["Stage 2"],
      "order": 70
    },
    "us.adr": {
      "label": "ADR",
      "type": "number",
      "countries": ["US"],
      "filterable": true,
      "order": 30
    }
  },
  "weeks": {
    "IN": {
      "2026-05-17": {
        "stocks": {
          "RELIANCE": {
            "symbol": "RELIANCE",
            "sector": "Oil Refinery",
            "tradable": true,
            "notes": "Buy breakout above 2500",
            "tags": ["Leader"],
            "params": {
              "stage": "Stage 2",
              "rs": "Strong"
            }
          }
        }
      }
    },
    "US": {}
  },
  "uiConfig": {
    "readOnlyPastWeeks": false,
    "enableApiHydration": true,
    "columnVisibility": {
      "__stock__": true,
      "__checks__": true,
      "__tradable__": true
    },
    "sectors": [],
    "tags": ["IPO Base", "Large Base", "OTB"]
  },
  "aiSettings": {
    "apiKey": "",
    "model": "gemini-1.5-flash",
    "systemPrompt": "...",
    "phenomenaPrompt": "...",
    "singleStockPrompt": "...",
    "customPrompts": [],
    "promptLibrary": {
      "watchlist": [],
      "phenomena": [],
      "stock": []
    }
  }
}
```

---

## 📈 Auto-Fetch Engine & Technical Calculations

### 1. ADR & Liquidity Bucket Hydration (`metrics.js`)
When a stock is registered in the database, TradeClarity initiates a background task (`FETCH_STOCK_METRICS`) that triggers historical data fetching from Yahoo Finance.
*   **Average Daily Range (ADR)**: Represents price volatility over the configured lookback window (default: 20 days).
    $$\text{ADR \%} = \frac{1}{N}\sum_{i=1}^{N}\left(\frac{\text{High}_i - \text{Low}_i}{\text{Low}_i}\right) \times 100$$
    *   Mapped into integers (1-10) for India (`IN`) to simplify sorting, or stored as exact decimals for the US (`US`).
*   **Liquidity Bucket Mapping**: Calculated using $\text{Average Daily Volume} \times \text{Closing Price}$. Mapped into dynamic currency thresholds:
    *   **India (IN)**: Represented in Crores (`Cr`). Example brackets: `<=20Cr`, `21 to 49Cr`, `100Cr to 199Cr`, `2000Cr+`.
    *   **United States (US)**: Represented in Millions (`M`).

### 2. Centralized Technical Moving Average Ribbon (`metrics.js` & `MovingAverageRibbon.jsx`)
Automatically calculates the relationship of current price relative to 5 SMAs: **5 EMA/SMA, 10 EMA/SMA, 21 EMA/SMA, 50 SMA, and 200 SMA**.
*   **Color-Coded Status Badge**:
    *   `Green/Emerald Badge`: Current price is **ABOVE** that SMA level.
    *   `Red/Rose Badge`: Current price is **BELOW** that SMA level.
*   **Full Trend State**: When all 5 badges are green, the stock is flagged as in a "Full Technical Trend" (highly prioritized in swing screening).

---

## 🔌 Yahoo Finance Engine & Network Layer (`yahooFinanceMap.js`)

Scrapes/fetches institutional market data securely with several fail-safe protocols:
1.  **Dual Environment Routing**:
    *   *Local Dev (localhost)*: Proxies requests to `/yahoo-api` to bypass CORS blocks.
    *   *Production / Extension Context*: Executes direct network requests targeting `https://query1.finance.yahoo.com/v8/finance/chart/...` with `cache: 'no-cache'`.
2.  **Rate-Limit Batching**: Processes requests in strict batches of **15 symbols** with a `100ms` throttle delay to prevent IP bans.
3.  **Benchmark Dynamic RS Rating**: Computes relative strength by subtracting index benchmark moves:
    $$\text{RS Rating} = \text{Symbol Daily Change \%} - \text{Index Daily Change \%}$$
    *   Benchmark Index for US is `^GSPC` (S&P 500).
    *   Benchmark Index for India is `^NSEI` (Nifty 50).
4.  **Deep History Index Proxies**:
    Yahoo often truncates historical indexes (e.g. Midcap/Smallcap). The engine intercepts those queries and grafts deep historical proxies:
    *   `^CNXSC` (Nifty Smallcap 100) $\rightarrow$ mapped to `SMALLCAP.NS`
    *   `NIFTY_MIDCAP_100.NS` $\rightarrow$ mapped to `MIDCAP.NS`
    *   `^CRSLDX` (Nifty 500) $\rightarrow$ mapped to `NIFTY_500.NS`

---

## 🤖 AI Context Builder & Strategy Templates (`ai.js`)

Leverages the **Google Gemini API (v1beta API)** to analyze watchlist structures.

### Prompts & Strategy Library
Three institutional strategy frameworks are configured in the library:
1.  **Swing Trading Strategy (Default)**: Maps watchlist concentrations and identifies macro market bias (`Risk-On`, `Risk-Off`, `Neutral`), leading sectors, and SEPA setups.
2.  **Market Phenomena Sector Analysis**: Triggers institutional report creation on sectors, establishing:
    *   *Leadership Tiering*: Classifies high-conviction group leaders vs laggards.
    *   *Group Decoupling Anomalies*: Stocks displaying relative resilience.
    *   *Execution Matrix*: Specific entry triggers and risk levels.
3.  **Single Stock Deep Technical View**: Conducts single symbol Technical deep-dives covering Trend, Key Levels (S1/S2, R1/R2), Patterns, and Verdict.

### Resilient JSON Extraction Engine (`ai.js`)
To guarantee frontend rendering stability under conversational model generation, the system parses API responses utilizing a **greedy boundary match**:
```javascript
function parseResponse(text, isCustom = false) {
  if (isCustom) return { isCustom: true, rawText: text };
  try {
    // Robust extraction: Captures the outermost JSON curly brackets
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON structure found.");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error("Invalid response format. Refine your prompt template.");
  }
}
```

---

## 💻 TradingView Widget Content Script (`TradeClarityWidget.jsx`)

Injected directly into TradingView (`*.tradingview.com/chart*`) as a floating React portal.

### Draggable & Resizable Portal Mechanics
*   **Header Handle Dragging**: Captured via mouse tracking (`clientX`, `clientY`) relative to the screen boundaries. Positions are stored per-session to prevent UI overlap.
*   **Corner Edge Resizing**: Listens to mouse triggers on absolute-positioned corner guides (`n`, `s`, `e`, `w`, `se`, `nw`, etc.), adjusting widget width and height dynamically.
*   **Bubble Firewall**: Integrates strict keyboard input capture:
    ```javascript
    const handleWidgetKeyDown = (e) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
    };
    ```
    This firewall stops TradingView from hijacking shortcuts (like symbol typing or chart scrolling) when interacting with input boxes in the widget.

### 🎙️ Speech Recognition & NLP Parsing Engine
Provides hands-free trading journaling by converting real-time audio input (`Web Speech API`) into structured technical parameters.

#### 1. Phonetic Correction Dictionary
Before parsing parameters, voice transcripts undergo phonetic sanitization:
```javascript
const corrections = {
  "falls": "false", "fawls": "false", "faults": "false",
  "week": "weak", "strenth": "strength", "pour": "poor", "four": "poor",
  "one": "1", "two": "2", "to": "2", "too": "2", "three": "3"
};
```

#### 2. Advanced NLP Parameter Extraction
*   **Checks & Boolean Matching**: Listens for the parameter label + affirm/deny words:
    *   *Affirming*: `['yes', 'true', 'on', 'enable', 'check', 'yeah']` $\rightarrow$ sets `true`.
    *   *Denying*: `['no', 'false', 'off', 'disable', 'uncheck', 'nope']` $\rightarrow$ sets `false`.
*   **Categorical Options Match**: Performs a two-pass matching algorithm:
    1.  *First Pass*: Exact multi-word matching (e.g. "Stage 3", "Very Strong").
    2.  *Second Pass*: Tokenized word-boundary matching (e.g. matching "Strong" as a sub-option).
*   **Dynamic Liquidity Bracket Mapping**: Translates raw numerical numbers mentioned in voice commands (e.g., "Liquidity 150 Crores") into complex, sorted database range buckets:
    ```javascript
    // Resolving numeric spoken value to database bucket options
    for (const opt of parsedOptions) {
      if (opt.isLessThan && targetNumVal <= opt.max) matchedBucket = opt.original;
      else if (opt.numbers && targetNumVal >= opt.min && targetNumVal <= opt.max) matchedBucket = opt.original;
    }
    ```
*   **Voice Actions**: Triggers database updates when saying "Save setup", "Update stock", or "Close widget".

---

## 🛠️ Developer Roadmap & Guidelines for Future Features

When designing or writing new functionalities, adhere to these architectural standards:

### 1. Preserving Regional Data Isolation
TradeClarity stores US (`US`) and India (`IN`) datasets in isolated keys. If you add database nodes (e.g., alarms, trades, journal posts), **always scope them by the active region**:
```javascript
// Good practice
const activeWeekData = data.weeks[country][weekKey];
```

### 2. Extending Custom Checklist Parameters
If you design new custom parameters, ensure they are registered within `paramDefinitions` in `seed.js`. Specify their properties completely:
```javascript
paramDefinitions: {
  myNewParam: {
    label: "My New Param",
    type: "select", // 'select' | 'checkbox' | 'number' | 'text' | 'date'
    options: ["Option A", "Option B"],
    countries: ["US", "IN"], // Restrict display if needed
    isCheck: true, // Will calculate automatically in "Checks Passed"
    idealValues: ["Option A"] // ideal values to trigger score increment
  }
}
```

### 3. Adding New API Integrations
When adding alternative web scraping interfaces or technical indicator APIs (e.g. MACD, Bollinger Bands):
*   Add the network wrapper in `src/utils/` or `src/services/`.
*   Wrap fetches in try/catch bounds to prevent rendering crashes.
*   Enforce batch throttles (use `BATCH_SIZE = 15` and a short delay) to respect rate limits.

### 4. Updating the TradingView content script
If modifying files inside `src/content/`:
*   Remember that content scripts run in an **isolated context** within the browser tab.
*   Always check if the extension context remains valid: `chrome.runtime?.id`.
*   Run the specific compiler command to build the widget bundles:
    ```bash
    npm run build
    ```
    *Note: Standard `vite.config.js` builds the main app; `vite.content.config.js` builds the TradingView script injection.*
