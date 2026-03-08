# TradeClarity

TradeClarity is a disciplined trading journal and watchlist management tool. It helps traders organize their weekly setups, analyze performance, and maintain consistency.

## TradingView Integration

This project includes a Chrome Extension content script that injects a helper widget directly into TradingView charts. This allows you to journal setups in real-time without switching tabs.

### Key Features

- **Smart Injection**: Automatically detects when you are on a TradingView chart.
- **Symbol Detection**: Reads the active ticker symbol from the page title.
- **Watchlist Sync**:
  - Add stocks to your weekly plan directly from the chart.
  - Mark setups as "Tradable".
  - Add detailed notes and tags.
  - Configure custom parameters (defined in the Dashboard).
- **Floating UI**: A draggable, collapsible widget that stays out of your way.
- **Region Support**: Toggle between market regions (e.g., US, IN).

### Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Build**:
   ```bash
   npm run build
   ```
   This generates the `extension` folder containing the Dashboard and the Content Script.
3. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode".
   - Click "Load unpacked" and select the `extension` folder.
