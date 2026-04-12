# Privacy Policy for TradeClarity.market

**Effective Date:** April 12, 2026

At **TradeClarity.market**, we believe that your trading data is your business. This Privacy Policy describes how our Chrome Extension handles information when you use our services.

## 1. Local-First Data Philosophy
TradeClarity.market is built on a "local-first" architecture. 
- **Storage:** All your stock lists, parameters, tags, and personal notes are stored locally in your browser using `chrome.storage.local`.
- **No Tracking:** We do not track your browsing history, your personal identity, or your trading performance.
- **No Central Servers:** We do not maintain any central servers that collect or store your trading data.

## 2. Information We Access
To provide professional research features, the extension requires access to the following:
- **Yahoo Finance:** We fetch public market data (price, volume) directly from Yahoo Finance to calculate metrics like ADR and Liquidity. No user data is sent to Yahoo Finance.
- **Google Gemini AI:** When you request an AI Analysis or Category Research report, sectoral data (symbols and industry names only) is sent to Google's Gemini API to generate insights. No personal notes are ever shared with the AI.

## 3. Permissions Justification
- **Storage:** Required to save your trading weeks and settings across browser sessions.
- **Host Permissions:** Required to securely fetch financial data from external financial sources.
- **ActiveTab:** Used to interact with TradingView or Screener.in only when you are actively using those sites.

## 4. Data Control
You have absolute control over your data.
- **Export:** You can export your entire database as a JSON file at any time.
- **Purge:** You can delete specific weeks or perform a "Full Reset" via the application settings, which permanently wipes all data from your local storage.

## 5. Changes to This Policy
We may update this policy occasionally. Any changes will be reflected in the "Effective Date" at the top of this document.

---

**Contact**
For support or inquiries, please visit our official GitHub repository: [https://github.com/chandu54/trade-clarity-extension](https://github.com/chandu54/trade-clarity-extension)
