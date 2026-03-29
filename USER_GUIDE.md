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
- **Symbol Detection**: The widget automatically updates to match the ticker symbol of the chart you are viewing.

### 2. Interface Controls

- **Minimize/Maximize**: Click the header bar (where the logo and symbol are) to toggle the widget open or closed.
- **Move**: Click and drag the header to reposition the widget anywhere on your screen. The position is saved for your session.
- **Region**: Use the dropdown in the header to switch between market regions (e.g., `IN` for India, `US` for USA).
- **Date**: The date picker defaults to the current week. Change this if you are planning for a future week or reviewing a past one.

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
