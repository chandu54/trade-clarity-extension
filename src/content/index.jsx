import React from 'react';
import { createRoot } from 'react-dom/client';
import TradeClarityWidget from './TradeClarityWidget';
// Import your main CSS file here so Tailwind classes get bundled into content.css
// Adjust this path if your main CSS file is named differently or located elsewhere
import '../styles.css'; 

const MOUNT_POINT_ID = 'trade-clarity-shadow-host';

function injectWidget() {
  // DEBUG: Log version to confirm code update
  console.log("%c TradeClarity Widget Starting... ", "background: #222; color: #bada55; font-size: 14px", new Date().toISOString());

  // DEBUG: Check if data exists in storage immediately
  chrome.storage.local.get(null, (items) => {
    console.log("TradeClarity: ALL Storage Items:", items);
    if (items.trading_app_data) {
      console.log("TradeClarity: paramDefinitions:", items.trading_app_data.paramDefinitions);
    }
  });

  // Prevent duplicate injection
  if (document.getElementById(MOUNT_POINT_ID)) return;

  // 1. Create the Host Element (The container that lives in the light DOM)
  const host = document.createElement('div');
  host.id = MOUNT_POINT_ID;
  
  // Position fixed/absolute ensures it sits on top of the chart
  // pointer-events: none allows clicking "through" the empty areas of the host
  host.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647; /* Max Z-Index */
    pointer-events: none; 
  `;
  document.body.appendChild(host);

  // 2. Attach Shadow DOM (Open mode allows us to inspect it if needed)
  const shadow = host.attachShadow({ mode: 'open' });

  // 3. Inject Styles
  // We reference 'content.css' which we configured Vite to output in Step 1
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('content.css');
  shadow.appendChild(styleLink);

  // 4. Create the React Root Element inside Shadow DOM
  const rootElement = document.createElement('div');
  rootElement.id = 'trade-clarity-app';
  // Re-enable pointer events for the actual widget so buttons work
  rootElement.style.pointerEvents = 'auto'; 
  shadow.appendChild(rootElement);

  // 5. Mount React
  const root = createRoot(rootElement);
  root.render(<TradeClarityWidget />);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectWidget);
} else {
  injectWidget();
}
