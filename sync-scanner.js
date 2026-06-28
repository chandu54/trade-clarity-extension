import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Vite build outputs the unpacked extension folder to "../extension"
const pathToExtension = path.resolve(__dirname, '../extension');

async function run() {
  console.log("=========================================");
  console.log("🚀 STARTING TRADECLARITY SCREENER SYNC ENGINE");
  console.log("=========================================");
  console.log(`Loading extension from: ${pathToExtension}`);

  const USER_PROFILE = process.env.USERPROFILE || 'C:/Users/chand';
  // Default Google Chrome User Data path on Windows
  const chromeDataDir = path.join(USER_PROFILE, 'AppData/Local/Google/Chrome/User Data');
  
  // NOTE: Set this to your specific profile folder name.
  // Standard folders: 'Default', 'Profile 1', 'Profile 2', etc.
  // You can verify yours by opening Chrome, going to 'chrome://version', and checking 'Profile Path'
  const profileFolder = 'Default';
  const profilePath = path.join(chromeDataDir, profileFolder);

  console.log(`Loading Google Chrome Profile from: ${profilePath}`);
  console.log("⚠️ IMPORTANT: Please close all Google Chrome windows before running to release database locks!");

  // 1. Launch your actual Chrome Browser using your personal profile
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chrome', // Use actual installed Google Chrome executable
    headless: false,   // Must be headful to allow bypass of Cloudflare/Captchas and render visually
    viewport: { width: 1280, height: 800 },
    args: [
      `--load-extension=${pathToExtension}`, // Dynamically load the fresh Vite build
    ],
  });

  try {
    // 2. Discover Extension ID dynamically, fallback to the user's verified ID if cached/active
    console.log("Detecting TradeClarity extension ID...");
    let extensionId = 'ljlmionnjohcgjmifipdhlgdinjaangg'; // Default/verified ID
    
    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      extensionId = workers[0].url().split('/')[2];
    } else {
      try {
        const background = await context.waitForEvent('serviceworker', { timeout: 2000 });
        extensionId = background.url().split('/')[2];
      } catch (_e) {
        console.log(`Dynamic detection skipped (profile is pre-cached). Using ID: ${extensionId}`);
      }
    }
    
    const dashboardUrl = `chrome-extension://${extensionId}/dashboard.html`;
    console.log(`Extension ID in use: ${extensionId}`);
    console.log(`Dashboard URL: ${dashboardUrl}`);

    // 3. Open Chartink Scanner Page
    console.log("Navigating to Chartink screener...");
    const chartinkPage = await context.newPage();
    await chartinkPage.goto('https://chartink.com/screener/legacy-scanner-atvvvstockanalyst', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    // 4. Click Run Scan
    console.log("Clicking 'Run Scan' button...");
    const runBtn = await chartinkPage.waitForSelector('#run_rules, .btn-run-scan, button:has-text("Run Scan")', { timeout: 10000 });
    await runBtn.click();

    // 5. Wait for the results table to load
    console.log("Waiting for scanner table to populate...");
    const tableSelector = '#vol_table tbody tr, .bootstrap-table table tbody tr, table.table tbody tr, .bootstrap-table tbody tr, table tr';
    await chartinkPage.waitForSelector(tableSelector, { state: 'attached', timeout: 20000 });

    // Wait until loading indicator is cleared and records are populated
    await chartinkPage.waitForFunction((sel) => {
      const rows = document.querySelectorAll(sel);
      if (rows.length > 0) {
        const text = rows[0].textContent || "";
        return !text.includes("Loading") && !text.includes("Processing") && !text.includes("No data");
      }
      return false;
    }, tableSelector, { timeout: 20000 });

    // 6. Extract Symbols
    console.log("Scraping symbols...");
    const symbols = await chartinkPage.evaluate((sel) => {
      const rows = document.querySelectorAll(sel);
      const tickers = [];
      
      rows.forEach(row => {
        // Find all links in the row
        const anchors = row.querySelectorAll('a');
        anchors.forEach(a => {
          const text = (a.textContent || "").trim().toUpperCase();
          // Stock symbol validation pattern:
          // Indian symbols: upper case alphabets, typically 2 to 10 chars.
          if (text && /^[A-Z0-9.\-_]{2,10}(\.NS|\.BO)?$/.test(text)) {
            // Specifically exclude common UI actions
            const blacklist = ['RUN', 'SCAN', 'LEGACY', 'SR.', 'VIEW', 'COPY', 'CSV', 'JSON', 'EXCEL', 'FILTER', 'CHART', 'LOGOUT'];
            if (!blacklist.includes(text)) {
              const baseSym = text.replace(/\.NS|\.BO/, '');
              if (!tickers.includes(baseSym)) {
                tickers.push(baseSym);
              }
            }
          }
        });
      });
      return tickers;
    }, tableSelector);

    console.log(`Successfully scraped ${symbols.length} tickers:`);
    console.log(symbols.join(', '));

    if (symbols.length === 0) {
      console.log("❌ No symbols found. Please verify the scanner results. Exiting.");
      await context.close();
      return;
    }

    // 7. Calculate Target Upcoming Monday Date (Step 5)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0-6 (Sunday-Saturday)
    let daysToMonday = 0;
    
    // Custom calendar routing:
    // If Fri, Sat, Sun: upcoming week's Monday is next Monday (add 3, 2, 1 days)
    // If Mon, Tue, Wed, Thu: upcoming week is next week's Monday (add 7, 6, 5, 4 days)
    if (dayOfWeek === 0) daysToMonday = 1;
    else if (dayOfWeek === 6) daysToMonday = 2;
    else if (dayOfWeek === 5) daysToMonday = 3;
    else if (dayOfWeek === 4) daysToMonday = 4;
    else daysToMonday = 8 - dayOfWeek;

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToMonday);
    
    const targetMondayStr = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`;
    console.log(`Upcoming Monday date calculated: ${targetMondayStr}`);

    // 8. Launch TradeClarity Dashboard
    console.log("Navigating to TradeClarity Dashboard...");
    const dashboardPage = await context.newPage();
    await dashboardPage.goto(dashboardUrl, { waitUntil: 'load' });

    // Close the Chartink tab and the default blank tab so we keep focus clean
    await chartinkPage.close();
    const pages = context.pages();
    if (pages.length > 1) {
      // Close the first tab if it is empty/about:blank
      if (pages[0].url() === 'about:blank') {
        await pages[0].close();
      }
    }

    // 9. Automate Dashboard: Region India (IN)
    console.log("Verifying region selector...");
    const regionTrigger = await dashboardPage.waitForSelector('button.region-trigger', { timeout: 10000 });
    const activeRegion = await regionTrigger.evaluate(el => el.querySelector('.region-label')?.textContent || "");
    
    if (activeRegion.trim() !== "IN") {
      console.log("Region is currently set to US. Switching to India (IN)...");
      await regionTrigger.click();
      const inOption = await dashboardPage.waitForSelector('button.dropdown-item:has-text("India")', { timeout: 5000 });
      await inOption.click();
      // Wait for layout rendering transition
      await dashboardPage.waitForTimeout(500);
    } else {
      console.log("Region is already set to India (IN).");
    }

    // 10. Automate Dashboard: Select Upcoming Monday (Step 5)
    console.log(`Setting date picker to upcoming Monday: ${targetMondayStr}...`);
    const dateInput = await dashboardPage.waitForSelector('input.date-picker-input-v2', { timeout: 5000 });
    await dateInput.fill(targetMondayStr);
    await dateInput.dispatchEvent('change');
    await dashboardPage.waitForTimeout(600); // Allow react state hooks to update

    // 11. Automate Dashboard: Set Watchlist select to "All Stocks" (Step 6)
    console.log("Setting watchlist scope to 'All Stocks'...");
    await dashboardPage.selectOption('select:has(option[value="all"])', 'all');
    await dashboardPage.waitForTimeout(400);

    // 12. Open "Add Stock" Modal (Step 7)
    console.log("Opening Add Stocks modal...");
    const addBtn = await dashboardPage.waitForSelector('button.add-stock-cta', { timeout: 10000 });
    await addBtn.click();
    
    console.log("Waiting for Add Stocks input field...");
    const modalInput = await dashboardPage.waitForSelector('input[placeholder*="e.g. AAPL"]', { timeout: 5000 });
    
    console.log("Pasting symbol string into modal...");
    const symbolText = symbols.join(', ');
    await modalInput.fill(symbolText);
    await dashboardPage.waitForTimeout(200);

    console.log("Clicking 'Add' button in modal...");
    const submitBtn = await dashboardPage.waitForSelector('.modal-actions button:has-text("Add")', { timeout: 5000 });
    await submitBtn.click();

    console.log("=========================================");
    console.log("🎉 SCREENER SYNC AUTOMATION COMPLETE!");
    console.log("Watchlist populated and background technical engines are now running!");
    console.log("Please keep this browser window open to inspect your new setups.");
    console.log("=========================================");

  } catch (err) {
    console.error("❌ Automation encounterd an error:", err);
  }
}

run();
