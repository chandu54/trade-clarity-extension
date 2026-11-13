import React from 'react';
import { createRoot } from 'react-dom/client';
import TradeClarityWidget from './TradeClarityWidget';
import ZerodhaIntegration from './zerodha/ZerodhaIntegration';
import { isZerodhaChartWindow } from './zerodha/kiteSymbolNavigator';
// Import main CSS file so Tailwind classes get bundled into content.css
import '../styles.css'; 

const MOUNT_POINT_ID = 'trade-clarity-shadow-host';
let reactRoot = null;

function cleanupZerodha() {
  const host = document.getElementById(MOUNT_POINT_ID);
  if (host) {
    if (reactRoot) {
      try {
        reactRoot.unmount();
      } catch (_e) {}
      reactRoot = null;
    }
    host.remove();
  }
  document.getElementById('tc-content-style')?.remove();
  document.getElementById('tc-zerodha-layout-style')?.remove();
  document.getElementById('trade-clarity-header-dock-container')?.remove();
  document.documentElement.classList.remove('tc-dock-active', 'tc-dock-collapsed', 'tc-resizing');
  document.body.style.marginRight = '';
  document.body.style.width = '';
  document.body.style.maxWidth = '';
}

function injectWidget() {
  if (document.getElementById(MOUNT_POINT_ID)) return;

  const isZerodha = typeof window !== 'undefined' && window.location.hostname.includes('zerodha.com');

  // If on Zerodha but NOT in an external popout chart window (e.g. /holdings, /dashboard, /positions), do NOT inject!
  if (isZerodha && !isZerodhaChartWindow()) {
    return;
  }

  // Inject styles into light DOM document head for portal elements (like Top Header Dock) and Side-by-Side Docking
  if (isZerodha && !document.getElementById('tc-content-style')) {
    const lightStyle = document.createElement('link');
    lightStyle.id = 'tc-content-style';
    lightStyle.rel = 'stylesheet';
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      lightStyle.href = chrome.runtime.getURL('content.css');
    }
    document.head.appendChild(lightStyle);

    // Side-by-side dock layout style: shrinks Kite's body and chart canvas so TradeClarity sits side-by-side
    const initialWidth = localStorage.getItem('tc_zerodha_panel_width') || '320';
    const layoutStyle = document.createElement('style');
    layoutStyle.id = 'tc-zerodha-layout-style';
    layoutStyle.textContent = `
      :root {
        --tc-dock-width: ${initialWidth}px;
      }
      html {
        overflow-x: hidden !important;
      }
      html.tc-dock-active body {
        margin-right: var(--tc-dock-width, 320px) !important;
        width: calc(100vw - var(--tc-dock-width, 320px)) !important;
        max-width: calc(100vw - var(--tc-dock-width, 320px)) !important;
        box-sizing: border-box !important;
        position: relative !important;
        transition: margin-right 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      html.tc-dock-active #app,
      html.tc-dock-active .container,
      html.tc-dock-active .page-content,
      html.tc-dock-active header,
      html.tc-dock-active .header,
      html.tc-dock-active .chart-container,
      html.tc-dock-active .tv-chart-container,
      html.tc-dock-active #tv_chart_container,
      html.tc-dock-active iframe {
        max-width: calc(100vw - var(--tc-dock-width, 320px)) !important;
        width: calc(100vw - var(--tc-dock-width, 320px)) !important;
        box-sizing: border-box !important;
      }

      /* Disable transitions during live dragging for 60fps responsiveness */
      html.tc-resizing body,
      html.tc-resizing .tc-zerodha-watchlist-panel,
      html.tc-resizing #app,
      html.tc-resizing .container,
      html.tc-resizing .page-content,
      html.tc-resizing header,
      html.tc-resizing .header,
      html.tc-resizing .chart-container,
      html.tc-resizing .tv-chart-container,
      html.tc-resizing #tv_chart_container,
      html.tc-resizing iframe {
        transition: none !important;
        user-select: none !important;
      }
      html.tc-resizing iframe {
        pointer-events: none !important;
      }

      html.tc-dock-collapsed body {
        margin-right: 38px !important;
        width: calc(100vw - 38px) !important;
        max-width: calc(100vw - 38px) !important;
        box-sizing: border-box !important;
        position: relative !important;
        transition: margin-right 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      html.tc-dock-collapsed #app,
      html.tc-dock-collapsed .container,
      html.tc-dock-collapsed .page-content,
      html.tc-dock-collapsed header,
      html.tc-dock-collapsed .header,
      html.tc-dock-collapsed .chart-container,
      html.tc-dock-collapsed .tv-chart-container,
      html.tc-dock-collapsed #tv_chart_container,
      html.tc-dock-collapsed iframe {
        max-width: calc(100vw - 38px) !important;
        width: calc(100vw - 38px) !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(layoutStyle);
  }

  // 1. Create the Host Element (The container that lives in the light DOM)
  const host = document.createElement('div');
  host.id = MOUNT_POINT_ID;
  
  // Position fixed ensures it sits correctly without interfering with light DOM flow
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

  // 3. Inject Styles into Shadow DOM
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    styleLink.href = chrome.runtime.getURL('content.css');
  } else {
    styleLink.href = '/content.css'; // Fallback for local web dev
  }
  shadow.appendChild(styleLink);

  // 4. Create the React Root Element inside Shadow DOM
  const rootElement = document.createElement('div');
  rootElement.id = 'trade-clarity-app';
  rootElement.style.pointerEvents = 'auto'; 
  shadow.appendChild(rootElement);

  // 5. Mount React
  reactRoot = createRoot(rootElement);
  reactRoot.render(isZerodha ? <ZerodhaIntegration /> : <TradeClarityWidget />);
}

function checkAndManageWidget() {
  const isZerodha = typeof window !== 'undefined' && window.location.hostname.includes('zerodha.com');

  if (isZerodha) {
    const onChart = isZerodhaChartWindow();
    if (!onChart) {
      cleanupZerodha();
      return;
    }
    if (!document.getElementById(MOUNT_POINT_ID)) {
      injectWidget();
    }
  } else {
    if (!document.getElementById(MOUNT_POINT_ID)) {
      injectWidget();
    }
  }
}

// Monitor single page application URL changes
let lastCheckedUrl = typeof window !== 'undefined' ? window.location.href : '';
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', checkAndManageWidget);
  window.addEventListener('hashchange', checkAndManageWidget);
  setInterval(() => {
    if (window.location.href !== lastCheckedUrl) {
      lastCheckedUrl = window.location.href;
      checkAndManageWidget();
    }
  }, 500);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndManageWidget);
} else {
  checkAndManageWidget();
}
