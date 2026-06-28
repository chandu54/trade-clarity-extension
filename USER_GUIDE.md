# TradeClarity User Guide: Mastering Your Swing Trading Routine

**Welcome to TradeClarity!**

TradeClarity is more than just a stock list; it is a **process enforcer**. It is designed to help swing traders move from chaotic, emotional decisions to a structured, data-driven routine. By organizing your watchlists weekly and quantifying your strategy into "Checks," TradeClarity helps you focus only on the highest-quality setups.

---

## 1. Getting Started

### 🌍 Select Your Region

TradeClarity supports isolated environments for different markets.

- **Locate the Flag Icon** in the top header.
- Click to switch between **United States (US)** 🇺🇸 and **India (IN)** 🇮🇳.
- _Note: Your watchlists, sectors, and settings are saved separately for each region._

### 🌗 Set Your Theme

- Toggle the **Sun/Moon icon** in the header to switch between Light and Dark modes based on your preference.

---

## 2. Defining Your Strategy (Crucial Step)

Before adding stocks, you must define _what_ you are looking for. This is how you enforce discipline.

1.  Click **Settings (⚙️)** > **Parameters**.
2.  **Add New Parameter**: Create fields for your technical criteria.
    - _Example 1_: **"Relative Strength"** (Type: Dropdown [A+, A, B, C]).
    - _Example 2_: **"Price > 50SMA"** (Type: Checkbox).
    - _Example 3_: **"Pattern"** (Type: Text).
3.  **The Power of "Checks"**:
    - Check the box **"Consider as Check"**.
    - **Ideal Value**: Define what "Good" looks like (e.g., for a Checkbox, the ideal value is `true`; for Relative Strength, it might be `A+, A`).
    - _Result_: The app will calculate a **"Checks Passed"** score (e.g., 4/5) for every stock, giving you an objective quality score.

---

## 3. The Weekly Workflow

TradeClarity organizes data by **Week**. This prevents stale watchlists and allows you to review past performance.

### 📅 Managing Weeks

- **Week Selector**: Use the dropdown in the top-left to navigate history.
- **New Week**: If you select a future date or click **"Create Current Week"** (when empty), a new watchlist is initialized.
- **Locking History**: Go to **Settings > Editing Rules** to enable "Read-only Previous Weeks". This prevents you from accidentally changing historical data, preserving your trading journal.

### ➕ Adding Stocks

1.  Click **+ Add Stock** in the top right.
2.  **Bulk Add**: Paste a list of comma-separated tickers (e.g., `AAPL, MSFT, TSLA, NVDA`).
3.  Click **Add**.

---

## 4. Custom Watchlists

TradeClarity allows you to organize your stocks into custom watchlists for better focus and segmentation.

### 📋 Creating and Managing Watchlists

- Go to **Settings (⚙️) > Watchlists**.
- **Create**: Enter a name and click "Add" to create a new watchlist.
- **Default Watchlist**: Select the radio button next to a watchlist to make it the default view when you open the app.
- **Edit/Delete**: Rename or delete existing watchlists. _(Note: Deleting a watchlist does not delete the stocks within it, it only removes the grouping)._

### ➕ Assigning Stocks to Watchlists

- **Adding/Importing**: When using **+ Add Stock** (either manually or via TradingView import), you can check the boxes for the specific watchlists you want the stocks added to.
- **Editing**: Click on a stock's symbol in the grid to open the Edit Modal and update its assigned watchlists.

### 🔍 Viewing and Customizing Watchlists

- **Switching Views**: Use the Watchlist dropdown next to the Week Selector (top-left) to toggle between "All Stocks" and your custom watchlists.
- **Per-Watchlist Configuration**: Go to **Settings > Columns** or **Settings > Filters** and change the "Configuration Scope" dropdown at the top. You can define unique visible columns and filters for _each specific watchlist_!

---

## 5. Analyzing & Filtering

Once your stocks are in the grid, it's time to process them.

### 📝 Processing the List

- **Edit Details**: Click on any cell to modify values directly, or click the **Stock Symbol** to open a detailed Edit Modal.
- **Tags**: Hover over a stock symbol and click the small `+` icon to add quick tags like "Earnings Soon" or "Leader".
- **Notes**: Use the Notes column for specific trade plans (e.g., "Buy stop @ 150.50").

### 🔍 Finding the Best Setups

- **Sort**: Click the **"Checks Passed"** column header. Focus your attention on stocks with the highest scores (e.g., 5/5).
- **Filter**:
  - Use the **Filters** bar (top of grid) to show only specific Sectors or Tags.
  - Filter by your custom parameters (e.g., Show only stocks where "Trend" is "Up").
- **Mark as Tradable**: When a stock meets all your criteria, check the **Tradable** box. This is your final "Shortlist."
- **Live Syncing**: When you add new symbols or switch weeks, TradeClarity automatically fetches metrics like ADR and Liquidity in the background. A progress bar will appear in the grid header during this process.
- **Data Freshness**: Check the **"Last synced"** timestamp in the top-left of the grid header. It shows the exact time your technical data was last refreshed from the market.
- **Institutional Technicals (New)**: Both the grid and edit modal now feature a centralized **Moving Average Ribbon**.
  - **Color-Coded Trend**: Green/Emerald badges indicate price is **ABOVE** that MA level; Red/Rose badges indicate price is **BELOW**.
  - **Quick Scan**: Instantly see if a stock is in a "Full Trend" (all 5 badges green) or showing weakness.

---

## 6. Visual Insights & AI

### 📊 Analytics Dashboard

Click the **Bar Chart Icon** next to the "Analyze" button to open the dashboard.

- **Distributions**: See visual breakdowns of your watchlist by Sector, Tags, and your Custom Parameters.
- **Interactive**: Click a slice of a Pie Chart or a Bar to see exactly which stocks belong to that category.
- **Customize**:
  - **Toggle Charts**: Switch individual widgets between Pie and Bar charts using the small icon in the widget header.
  - **Reorder**: Drag and drop widgets to arrange them by importance.
  - **Visibility**: Use the **Settings (⚙️)** inside the dashboard to hide less relevant metrics.
- **Trend**: View the "Stock Universe Trend" to see if your watchlist size is expanding (bullish) or contracting (bearish) over time.
- **Download Report**: Click the **Download (Arrow Down)** icon in the dashboard header to generate a professional PDF report. This opens your browser's print dialog—select **"Save as PDF"** to keep or share your analysis.

### 🔍 Category Analysis (Deep Dive)

From any chart or list, click a **Category/Sector badge** to open the specialized Category Analysis modal. This provides a professional-grade drill-down into an entire market group.

- **Snapshot Tab**: 
  - View a "Bird's Eye" grid of all stocks in the category.
  - Interactive mini-candlestick charts (toggle between 1M, 3M, 6M, and 1Y views).
  - Hover to expand and inspect specific price action.
  - Click any mini-chart to open a full TradingView chart for that symbol.
- **Phenomena Tab (AI Research)**:
  - Generate a professional **Institutional Research Report** for the entire category.
  - **Leadership Tiering**: Identify high-conviction leaders vs. tactical laggards.
  - **Entry Triggers**: Get specific technical catalysts and risk parameters defined by AI.
- **Category Header**:
  - **Adv/Dec Breadth**: Instantly see how many stocks in the group are advancing vs. declining.
  - **Top Picks**: Automatically identifies the performance leaders (Relative Strength) for your selected timeframe.

### 🎯 Phenomena Strategies (Use Cases)

To get the most out of the Deep Research tab, focus on these four professional scenarios:

1. **The Leadership Filter**: When a sector moves, don't buy the whole group. Use Phenomena to identify the **Top 1-2 Leaders** showing the highest "Relative Strength." These usually provide the most profit with the least risk.
2. **The Trap Warning**: If your favorite stock looks like a breakout, but "Phenomena Research" flags the group as **"Structural Weakness,"** be careful. Individual breakouts in weak sectors are "traps" that rarely sustain.
3. **Institutional Accumulation**: Look for "Group Anomalies"—stocks that stay flat or move up while their entire sector is crashing. This "relative resilience" is a massive signal that institutions are buying the dip.
4. **Precision Execution**: Use the **Entry Triggers** in the Decision Matrix to set your alerts. Instead of buying "whenever," buy only when the technical catalyst identified by the AI is triggered.

### ✨ AI Analysis

1.  **Configure**: Go to **Settings > AI Settings** and enter your Google Gemini or OpenAI API Key.
2.  **Analyze**: Click the **✨ Button** next to the week selector.
3.  **Result**: The AI reads your watchlist data and generates a professional summary:
    - **Market Bias**: Are you finding mostly bullish or bearish setups?
    - **Top Sectors**: Where is the money flowing?
    - **Actionable Setups**: Specific stocks that look ready.

### ℹ️ Weekly Summary

Hover over the **"i" icon** next to the week dropdown.

- See a quick health check of your watchlist (e.g., "Bullish" if >50% of stocks pass high checks).
- Compare counts vs. the previous week.

---

## 7. Data Management

### 💾 Backup & Restore (Full App)

- **Export Backup**: Go to **Export > JSON / Full App Backup**. This saves a single file containing **all** your weeks, settings, and parameters. Save this regularly!
- **Restore**: Go to **Import > JSON / Restore Full Backup**. _Warning: This overwrites current data._

### 📤 Exporting Watchlists (For Trading)

- To import your picks into a trading platform (like TradingView or a broker):
  1.  Filter your grid (e.g., show only "Tradable" stocks).
  2.  Click **Export > CSV / Filtered Stocks**.

### 🗑️ Data Purging (Maintenance)

As your database grows over many months, you may want to clean up old data to keep the app performing optimally.

- **Location**: **Settings (⚙️) > Data Management**.
- **Purge Specific Weeks**: Select multiple historical weeks from the list to permanently delete them from the local database.
- **Safety Lock**: 
    - You cannot delete the **Current Active Week**.
    - For bulk deletions, you must type a confirmation string (e.g., `delete US data`) to finalize the action.
- **Full Reset**: Use the **Reset All** button in the main header for a complete factory reset (Irreversible).

---

## 8. Configuration Tips

- **Manage Sectors**: Go to **Settings > Sectors** to customize the dropdown list to match your preferred taxonomy.
- **Column Visibility**: Go to **Settings > Columns** to hide parameters you don't need to see in the main grid every day.
- **Tags**: Go to **Settings > Tags** to clean up old tags.

---

### 🚀 Efficiency Hack: The "Sunday Routine"

1.  **Create** the new week.
2.  **Import** your raw scan list (via Bulk Add).
3.  **Sort** by "Checks Passed" (if you imported data) or manually run through the list filling in your Parameters.
4.  **Mark** the best 5-10 stocks as **Tradable**.
5.  **Run AI Analysis** to get a macro view of your list.
6.  **Export** the "Tradable" list to your broker.

# TradeClarity User Guide

## TradingView Widget

The TradeClarity Widget allows you to manage your weekly watchlist directly from TradingView.

### 1. Accessing the Widget

- Navigate to any chart on TradingView.
- The **TradeClarity** widget will appear automatically as a floating panel.
- **High-Density Header**: The widget uses a 3-row "Cockpit" layout to maximize your research space:
  - **Row 1**: Branding and Window Controls (Mic, Dashboard Link, Close).
  - **Row 2**: Region Selector (US/IN) and Date/Week Picker.
  - **Row 3**: Active Symbol and **Integrated Technical Ribbon** (MA Status).
- **Symbol Detection**: The widget automatically updates to match the ticker symbol of the chart you are viewing.
- **Trend at a Glance**: Check the 5 technical badges next to the symbol to verify the trend without leaving your chart.

### 2. Interface Controls

- **Minimize/Maximize**: Click the header bar (where the logo and symbol are) to toggle the widget open or closed.
- **Move**: Click and drag the header to reposition the widget anywhere on your screen. The position is saved for your session.

### 3. Managing a Setup

Once the correct symbol is detected, you can input your trade plan:

- **Custom Parameters**: If you have defined custom fields in the Dashboard (like "Entry Price", "Stop Loss", "Strategy"), they will appear here as input fields or dropdowns.
- **Tags**:
  - **Add**: Select from existing tags or type a new tag and press `Enter` (or click `+`).
  - **Remove**: Click the `×` on a tag to remove it.
- **Notes**: Enter your analysis, thesis, or execution plan in the text area.
- **Tradable**: Check the **"Mark as Tradable"** box if this stock meets your criteria for the week.

### 4. Saving

- Click the **"Save to Watchlist"** button.
- A confirmation message will appear.
- The data is instantly saved to your Chrome Storage and will be visible in the main TradeClarity Dashboard.

### Troubleshooting

- **Widget not appearing?**
  - Refresh the TradingView page.
  - Ensure the extension is enabled in Chrome.
- **Symbol not updating?**
  - The widget relies on the document title. Wait for the chart to fully load.
- **Data not saving?**
  - Ensure you have initialized the main Dashboard at least once to set up the data structure.

---

## 9. Market Pulse Guide

The **Market Pulse** dashboard acts as your bird's-eye view of indices and sector performance. Rather than evaluating tickers in isolation, you should first look here to understand the broader market trend, momentum strength, and system risk levels.

### 🖼️ Snapshot (Indices Grid)
A real-time overview of the indices, sector ETFs, or breadth indicators.
- **Mini Candlestick Charts**: Small charts displaying the historical price action of each index. Hover or check the fullscreen layout for details.
- **52-Week Range Bar**: Shows the current position of the index between its yearly low (L) and yearly high (H). A fill ratio near 100% signifies it is trading at or near new yearly highs, indicating potential breakouts.
- **MAs Bar (Moving Averages)**: Five small blocks displaying whether the current price is above (Green/Bullish) or below (Red/Bearish) the **5MA, 10MA, 21MA, 50MA, and 200MA**.
- **Drag and Drop ordering**: Rearrange cards by dragging the drag handle in the upper left corner to sort them based on your monitoring needs.
- **Favorites**: Click the star icon to save indices as favorites. You can sort the screen to show favorites first.
- **Fullscreen Charting**: Click the expand icon to view an interactive chart, switch timeframes from 1d to 5y, see exact moving average values, or click *Analyze ↗* to open it directly in TradingView.

### 🧠 Intelligence (Market Matrix)
An institutional-grade, detailed breakdown of all index metrics.
- **RS Rating (Relative Strength)**: Measures how strongly the index is outperforming (+) or underperforming (-) the primary benchmark (Nifty 50 in India, S&P 500 in the US) on a rolling timeframe.
- **52W High %**: Distance of the current index price from its 52-week high. 0.0% means it is currently trading at a yearly high.
- **RSI (14)**: Relative Strength Index. Values above 70 indicate an overbought market (vulnerable to consolidation/pullbacks), while values below 30 indicate oversold conditions (potential reversal candidates).
- **Moving Average Deviations (21MA, 50MA, 200MA)**: Percentage distance of the current price from its short, medium, and long-term trendlines. Large deviations highlight overextended markets.
- **Market Phase / Verdict**: The color-coded badge displays the structural phase (e.g. Bullish, Consolidation, Bearish, or Distribution) determined by the alignment of the moving averages and price behavior.

### 🔥 Heatmap (Sector Relative Strength)
A visual relative strength grid of sectors to identify where institutions are rotating capital.
- **Intensity Shading**: Tiled sectors are sorted by daily percent change. Strong gainers are colored in deep green, while strong decliners are shaded deep red.
- **Sector Breadth**: If most tiles are green, it signals strong market-wide participation. If only a few defensive sectors are green, it suggests market caution.

### 📝 Technical Thesis
At the bottom of the Snapshot page, the system displays the **Technical Thesis**. This is an automated analysis summarizing the daily tape, structural trends, leading sectors, and key tactical action plans based on the current matrix data.

---

## 10. Trading Journal Guide

A professional trading journal enforces discipline. Recording your setups, risk-reward parameters, and scaling points prevents impulsive decisions, provides audit trails, and lets you calculate performance stats objectively. Treating trading as a business requires tracking every unit of risk and analyzing your performance parameters over time.

### 📝 Position Ledger (Standard Tab)
The position ledger is your central trade database. It displays all open, closed, scaled, and planned positions in a custom table view.
- **Table Customization**: Click the gear icon next to table columns to customize column visibility, adjust width, and change sorting priority. You can sort by columns to analyze specific trades.
- **Real-time P&L**: Computes floating profit/loss for open positions based on live index price ticks, and locks in realized P&L when a trade status is changed to "Closed".
- **Search & Filter**: Search for trades instantly by symbol or text in notes, and filter trades by status (Open, Closed, Scaled, Planned) or strategies (e.g. Pullback, Breakout).

### 📝 Creating & Editing Trades (Form Fields)
When you add a trade or click the edit icon in the ledger, a comprehensive detail form opens:
- **Ticker Symbol**: The stock ticker code representing your trade (e.g. AAPL or RELIANCE).
- **Strategy / Setup**: Select the technical setup or strategy used. Select "Other" to input a custom strategy name.
- **Entry Price & Quantity**: The initial execution price and number of shares/units purchased.
- **Entry Date**: The execution date and time.
- **Stop Loss & Target Price**: Define your defensive exit point (Stop Loss Price or %) and profit goal (Target Price or %).
- **Current / Trailing Stop Loss**: Adjust this field to trace a trailing stop as the stock price moves in your direction, ensuring you lock in profits and protect capital.
- **Position Status**: Define the current state of the trade (Planned, Open, Scaled, Closed).
- **Exit Price & Date**: Input the average exit price and date when closing the position to calculate finalized returns.
- **Entry Thesis & Chart Snapshot**: Document your setup rationale and paste a TradingView chart screenshot URL to log visual technical entry points.
- **Post-Mortem & Reflections**: For closed trades, record key psychological lessons, execution notes, or mistakes to improve future decisions.

### ⚖️ Advanced Position Sizing Calculator
Enforces risk discipline before you click buy. The form contains an automatic sizing calculator:
- **Account Capital & Risk %**: Enter your total trading capital and select the capital risk percentage you want to allocate to this trade (e.g., 0.5%, 1%, 2%, or a custom amount).
- **Quantity & Max Risk Calculation**: Based on the distance between your Entry Price and Stop Loss, the calculator automatically suggests the optimal share quantity to buy, ensuring that if you get stopped out, your loss is strictly limited to your risk percentage (Max Cash Risk).

### ➕ Scale-In & Pyramiding (Multi-Transaction Support)
Professional traders scale their trades. The journal supports managing multiple entries or partial exits under a single position:
- **Scaling Log**: Under the scaling form, log each subsequent addition (scale-in buy) or partial exit (scale-out sell).
- **Average Cost Basis**: The system automatically computes the weighted average entry price and updates the total quantity of active shares in real-time, preventing messy duplicate logs.

### 🖼️ Visual Candlesticks (Snapshot Tab)
A visual overview gallery of all open positions.
- **Price Chart Overlays**: Displays active positions as mini candlestick charts.
- **Technical Reference Levels**: Plots three key horizontal lines representing your trade parameters: **Entry Price (Blue)**, **Stop Loss (Red)**, and **Target Price (Green)**.
- **Distance Stats**: Displays real-time percentages indicating how far the current price is from your stop-loss or target, giving you a clear visual of trade progression.

### 📈 Auditing Performance Edge (Analytics Tab)
An analytical dashboard to audit your system edge.
- **Win Rate & Profit Factor**: Win Rate calculates the percentage of closed positions that resulted in profits. Profit Factor is the ratio of gross gains to gross losses. A value above 1.5 indicates a highly profitable strategy.
- **R-Multiple Metrics**: Measures your returns in units of risk (R). A trade that returns 2R means your gain was 2 times your initial dollar risk. The analytics tab aggregates total R-Multiple returns to measure the efficiency of your risk management.
- **Performance Curve**: A line graph charting your account equity over time.
- **Benchmark Comparison**: Plots your equity curve directly against indices (Nifty 50 or S&P 500) to confirm if you are outperforming the market index.

---

## 11. AI Settings & Prompt Library

TradeClarity.market lets you integrate institutional-grade AI analysis (powered securely by the Google Gemini API) directly into your trading workflow. Instead of relying on generic prompts, you can create and manage a proprietary strategy library to dictate exactly how the AI evaluates your watchlists, sectors, and individual setups.

### 🤖 1. General AI Configuration
- **Access**: Open **Settings (⚙️) > AI integration** (at the bottom of the dropdown).
- **Secure API Key**: Enter your Google Gemini API key. For maximum privacy, this key is saved exclusively in your local browser's storage and is never sent to external servers.
- **Connection Testing**: Click **Test Connection** to perform a live diagnostic check. A success status banner will confirm if the API is configured correctly.
- **Model Selection**: Choose between available models:
  - *Gemini 1.5 Flash*: Best for fast, cost-efficient, everyday analysis.
  - *Gemini 1.5 Pro*: Best for premium features, complex logic, and deep reasoning.
  - *Custom Model ID*: You can type in any specific model ID from Google AI Studio.
- **Pro Mode**: Check "Enable Premium Features (Pro Mode)" to activate premium strategy models.

### 📚 2. Proprietary Strategy Library Tabs
The Prompt Library tab organizes your custom AI instructions into three distinct scopes:
1. **Watchlist**: Used when analyzing the weekly watchlist (macro bias, sector flow, SEPA setups).
2. **Phenomena**: Used in the Category Analysis modal to analyze entire sectors (leadership tiering, relative strength decoupling anomalies).
3. **Single Stock**: Used in the Journal Detail view to conduct deep technical and setup research on a single symbol.

### ✍️ 3. Variable Placeholders & Mini Editor
The mini editor allows you to type custom analysis instructions. To inject real-time data from your database, click the variable badges below the text area to insert placeholders:
- **Watchlist Variables**:
  - `{stocks}`: Clean JSON of all active stocks, checks, notes, and tags in the grid.
  - `{sectors}`: A list of sectors present in the current grid.
  - `{tickers}`: A comma-separated list of symbols.
- **Phenomena Variables**:
  - `{category}`: The active sector or category name.
  - `{tickers}`: Comma-separated list of symbols in that category.
- **Single Stock Variables**:
  - `{symbol}` / `{name}`: The stock symbol and company name.
  - `{price}`: The last-traded price.
  - `{sector}`: The assigned sector.
  - `{notes}`: Your manual journal notes or speech-dictated remarks.

### ⚡ 4. Library Operations & Actions
- **Set as Default (🎯)**: Mark any custom or system strategy as the default analyzer for that tab. The system will automatically use the default template when triggering AI actions.
- **Clone / Duplicate (📋)**: Copy any strategy, including system templates, to create a customizable copy without losing the original.
- **Edit / Update (📝)**: Modify prompt names and text inline, with a character counter to monitor length.
- **Delete (🗑️)**: Safely delete custom strategies. Active defaults are protected to prevent accidental deletion.
