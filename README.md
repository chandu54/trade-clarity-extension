# TradeClarity

**Your disciplined path to smarter trades.**

TradeClarity is a powerful React-based application designed for swing traders to manage weekly watchlists, analyze stock setups, and maintain trading discipline. It functions both as a standalone web application and a browser extension, allowing you to keep your trading data organized and accessible.
<img width="956" height="454" alt="image" src="https://github.com/user-attachments/assets/8341508c-b4fd-44ba-ac4c-870ca5ccd65c" />

## 🚀 Features

- **Weekly Watchlists**: Organize your stock ideas by week. Navigate through history to review past setups.
- **Multi-Region Support**: Switch seamlessly between **US** 🇺🇸 and **India** 🇮🇳 markets with isolated data contexts.
- **Customizable Parameters**: Define your own technical criteria (e.g., "Relative Strength", "Stage 2", "VCP Pattern") using Text, Dropdown, or Checkbox inputs.
- **Smart Filtering, Sorting & Search**: Quickly find stocks by symbol or notes. Filter by Sector, Tags, Tradable status, or any of your custom parameters.
- **AI-Powered Analysis**: Integrated with **Google Gemini** and **OpenAI** to generate professional market summaries, identify top sectors, and highlight actionable setups based on your watchlist data.
- <img width="368" height="377" alt="image" src="https://github.com/user-attachments/assets/b0c3af44-51ad-4fee-9b04-f23fbd0e3844" />
- **Analytics Dashboard**: Gain visual insights into your watchlist.
  - **Interactive Charts**: Visualize distributions by Sector, Tags, Tradable status, and custom parameters using Pie and Bar charts.
  - **Trend Analysis**: Track the size of your stock universe over time.
  - **Customizable Layout**: Reorder widgets via drag-and-drop and toggle visibility to focus on what matters.
  - <img width="316" height="350" alt="image" src="https://github.com/user-attachments/assets/2e56e688-5ebf-4a11-a8f7-10bd1d5c0180" />

**Stock Management**:

- Add stocks in bulk (Manual entry or TradingView Import).
- Edit details in a focused modal or directly in the grid.
- Tag stocks for quick categorization.
- Mark stocks as "Tradable" to highlight best setups.
- **Data Persistence**: Automatically saves your data to Local Storage (Web) or Chrome Storage (Extension).
- **Import / Export**:
  - **Watchlist Export**: Export current week's stocks to CSV or JSON for external analysis.
  - **TradingView Import**: Import watchlists directly from TradingView text exports.
  - **Full App Backup**: Export/Import the entire application data (all weeks, settings, parameters) to a JSON file for safekeeping or migration.
- **Dark / Light Mode**: Toggle themes for comfortable viewing in any environment.
- **Configurable UI**:
  - Manage Sectors.
  - Toggle Column Visibility.
  - Set Editing Rules (e.g., Lock previous weeks).

** Weekly Summary Info**:
<img width="485" height="705" alt="image" src="https://github.com/user-attachments/assets/281214c2-63bf-48a9-aa14-95bf9d82dd7e" />

## 🛠️ Technology Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: CSS Variables for theming
- **AI Integration**: Google Generative AI & OpenAI API

---

## 📦 How to Run

### Prerequisites

- Node.js installed on your machine.

### 1. As a Normal React Web App

Use this mode for development or if you want to host it as a static website.

1.  **Clone the repository** (if applicable) or navigate to the project folder.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the development server**:
    ```bash
    npm run dev
    ```
4.  Open your browser and navigate to the URL shown (usually `http://localhost:5173`).

### 2. As a Chrome Browser Extension

Use this mode to have TradeClarity accessible as a sidebar or popup in your browser.

1.  **Install dependencies** (if not already done):
    ```bash
    npm install
    ```
2.  **Build the project**:

    ```bash
    npm run build
    ```

    This will generate a `dist` folder containing the compiled assets.

3.  **Load into Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable **Developer mode** (toggle in the top right corner).
    - Click **Load unpacked**.
    - Select the `dist` folder generated in the previous step.
    - The TradeClarity extension icon should now appear in your browser toolbar.

---

## 🤖 AI Configuration

To use the "Analyze" feature:

1.  Click the **Settings (⚙️)** button in the header.
2.  Click **AI Settings**.
3.  Enter your API Key:
    - **Google Gemini**: [Get Key](https://aistudio.google.com/app/apikey) (Free tier available)
    - **OpenAI**: [Get Key](https://platform.openai.com/api-keys)
4.  (Optional) Specify a custom model (e.g., `gemini-1.5-pro`).
5.  **Custom Strategies**:
    - Create new analysis templates using the **"+ Create New Strategy"** option.
    - Use variables like `{stocks}`, `{sectors}`, and `{tickers}` to inject your watchlist data into the prompt.
    - Edit or Delete custom strategies directly from the settings interface.
6.  Save Settings.

The app automatically detects the provider based on the API key format. Prompt selection is available in both the Settings and the AI Analyze modal for a streamlined workflow.

## 🔒 Security Note

**API Keys**: Your API keys are stored locally on your device (Local Storage for Web, Chrome Storage for Extension). They are never sent to any server other than the respective AI provider (Google or OpenAI).

**Data Privacy**: All watchlist data resides locally on your machine.

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
- <img width="928" height="473" alt="image" src="https://github.com/user-attachments/assets/70419318-1dcf-430a-bf16-f3c9b19dd5d3" />
- **Hands-Free Voice Commands**:
  - Dictate setups instantly using the Web Speech API by clicking the microphone icon or using the global shortcut (`Ctrl + Shift + S` / `Cmd + Shift + S`).
  - **Natural Language Parsing**: Say "Set target to 150", "Tradable Yes", "Stage 2", or "Add tag IPO" and the widget will intelligently map your speech to your custom parameters.
  - **Save via Voice**: Say "Save the setup" or "Save the data" to instantly log the stock to your dashboard.

### Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Build**:
   ```bash
   npm run build
   ```
   This generates the `dist` folder containing the Dashboard and the Content Script.
3. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode".
   - Click "Load unpacked" and select the `dist` folder.
