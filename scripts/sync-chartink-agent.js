/**
 * TradeClarity Autonomous Stock Scanner Agent
 * 
 * Flow:
 * 1. Programmatically fetches stock symbols from Chartink screener:
 *    - Fetches CSRF token, session cookies, and scan clause
 *    - Issues POST request to https://chartink.com/screener/process
 *    - Extracts ticker list (item.nsecode) with retry backoff & fallback
 * 2. Connects to or launches Chrome with TradeClarity extension
 * 3. Handles Weekend Date Routing (If Saturday or Sunday -> Sets Date to Next Monday)
 * 4. Injects all Chartink symbols into current week's "All Stocks" watchlist
 * 5. Waits for Technical Engine & Market Data Hydration (MAs, RS, Liquidity, Stage)
 * 6. Automates Advanced Filtering:
 *    - Moving Averages: Above 21, 50, 200
 *    - Liquidity: > 50 Cr
 *    - Relative Strength: Strong, Very Strong, Neutral
 *    - Stage: Stage 2
 * 7. Closes Filter panel, captures qualified setup symbols
 * 8. Switches Watchlist to "Default Watchlist" and copies qualified symbols via Add Stocks
 * 9. Leaves the populated view active and ready for filtering
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION & DEFAULTS
// ==========================================
const CHARTINK_SCREENER_URL = 'https://chartink.com/screener/legacy-scanner-atvvvstockanalyst';
const CHARTINK_PROCESS_URL = 'https://chartink.com/screener/process';
const DEFAULT_EXTENSION_ID = 'ljlmionnjohcgjmifipdhlgdinjaangg';
const USER_PROFILE = process.env.USERPROFILE || 'C:/Users/chand';
const DEFAULT_CHROME_USER_DATA = path.join(USER_PROFILE, 'AppData/Local/Google/Chrome/User Data');
const DEFAULT_PROFILE_NAME = 'Default';
const PATH_TO_EXTENSION = path.resolve(__dirname, '../../extension');

const FALLBACK_SCAN_CLAUSE = '( {cash} ( latest close >= latest max( 250 , latest high ) * 0.75 and market cap >= 1000 and latest close >= latest ema( latest close , 50 ) and latest close >= latest ema( latest close , 200 ) ) )';

// ==========================================
// HELPER: PARSE CLI ARGS
// ==========================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    profileDir: DEFAULT_CHROME_USER_DATA,
    profileName: DEFAULT_PROFILE_NAME,
    extensionId: process.env.TRADECLARITY_EXTENSION_ID || DEFAULT_EXTENSION_ID,
    cdpPort: process.env.CDP_PORT || 9222,
    hydrationWaitSec: 12,
    isolated: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--profile-dir' && args[i + 1]) options.profileDir = args[++i];
    else if (arg === '--profile' && args[i + 1]) options.profileName = args[++i];
    else if (arg === '--ext-id' && args[i + 1]) options.extensionId = args[++i];
    else if (arg === '--cdp' && args[i + 1]) options.cdpPort = parseInt(args[++i], 10);
    else if (arg === '--wait' && args[i + 1]) options.hydrationWaitSec = parseInt(args[++i], 10);
    else if (arg === '--isolated') options.isolated = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

// ==========================================
// 1. CHARTINK EXTRACTION ENGINE
// ==========================================
async function fetchChartinkSymbols(maxRetries = 3) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const getRes = await fetch(CHARTINK_SCREENER_URL, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
      });

      if (!getRes.ok) throw new Error(`HTTP ${getRes.status} ${getRes.statusText}`);

      const html = await getRes.text();
      const rawCookies = getRes.headers.get('set-cookie');

      const csrfMatch = html.match(/<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i);
      const csrfToken = csrfMatch ? csrfMatch[1] : null;

      if (!csrfToken) throw new Error('CSRF token not found in screener markup.');

      let scanClause = null;
      const inputMatch = html.match(/name=["']scan_clause["'][^>]*value=["']([^"']+)["']/i);
      if (inputMatch) {
        scanClause = inputMatch[1];
      } else {
        const jsonMatch = html.match(/:scan-json="([^"]+)"/i);
        if (jsonMatch) {
          try {
            const decoded = jsonMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>');
            const parsed = JSON.parse(decoded);
            scanClause = parsed.atlas_query || parsed.scan_clause;
          } catch (_err) {
            // Fall back to fallback clause if parse fails
          }
        }
      }

      if (!scanClause) scanClause = FALLBACK_SCAN_CLAUSE;

      const cookieHeader = rawCookies
        ? rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ')
        : '';

      console.log(`[1/3] Connected to Chartink (CSRF token verified)`);

      const postRes = await fetch(CHARTINK_PROCESS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-csrf-token': csrfToken,
          'Referer': CHARTINK_SCREENER_URL,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        },
        body: new URLSearchParams({ scan_clause: scanClause })
      });

      if (!postRes.ok) throw new Error(`Process endpoint status: ${postRes.status}`);

      const json = await postRes.json();
      if (!json || !Array.isArray(json.data)) throw new Error('Invalid JSON payload returned.');

      const blacklist = ['RUN', 'SCAN', 'LEGACY', 'SR.', 'VIEW', 'COPY', 'CSV', 'JSON', 'EXCEL', 'FILTER', 'CHART', 'LOGOUT'];
      const rawSymbols = json.data.map(item => item.nsecode || item.name || '');
      
      const cleanSymbols = [];
      for (const raw of rawSymbols) {
        const sym = String(raw).trim().toUpperCase().replace(/\.NS|\.BO/, '');
        if (sym && /^[A-Z0-9.\-_]{2,15}$/.test(sym) && !blacklist.includes(sym)) {
          if (!cleanSymbols.includes(sym)) cleanSymbols.push(sym);
        }
      }

      console.log(`[2/3] Extracted ${cleanSymbols.length} symbols from Chartink screener`);
      return cleanSymbols;

    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Chartink extraction attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Extraction failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// ==========================================
// 2. BROWSER CONNECTION STRATEGY
// ==========================================
async function getBrowserContext(opts) {
  // Option A/B Hybrid: Connect via CDP if Chrome is open on port 9222
  try {
    const cdpCheck = await fetch(`http://127.0.0.1:${opts.cdpPort}/json/version`, { signal: AbortSignal.timeout(1000) });
    if (cdpCheck.ok) {
      console.log(`🔗 Connecting to active Chrome session via CDP (port ${opts.cdpPort})...`);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${opts.cdpPort}`);
      const contexts = browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      return { context, isCDP: true };
    }
  } catch (_err) {
    // No existing CDP session found, proceeding to persistent context
  }

  // Option A (Preferred): Launch persistent context with extension
  const fullProfilePath = opts.isolated
    ? path.resolve(__dirname, '../scratch/auto_profile')
    : path.join(opts.profileDir, opts.profileName);

  console.log(`🌐 Launching browser with extension loaded from: ${PATH_TO_EXTENSION}`);

  const extensionArgs = fs.existsSync(PATH_TO_EXTENSION) ? [
    `--disable-extensions-except=${PATH_TO_EXTENSION}`,
    `--load-extension=${PATH_TO_EXTENSION}`
  ] : [];

  try {
    const context = await chromium.launchPersistentContext(fullProfilePath, {
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: [...extensionArgs, '--no-first-run', '--no-default-browser-check']
    });

    return { context, isCDP: false };
  } catch (launchErr) {
    if (launchErr.message?.includes('Target page, context or browser has been closed') || launchErr.message?.includes('EBUSY') || launchErr.message?.includes('locked')) {
      console.error('\n❌ Profile directory is locked by an existing Chrome window!');
      console.log('💡 Options: 1) Close running Chrome, 2) Run with --isolated, or 3) Start Chrome with --remote-debugging-port=9222');
    }
    throw launchErr;
  }
}

// ==========================================
// 3. COMPLETE WORKFLOW AUTOMATION
// ==========================================
async function runTradeClarityWorkflow(context, symbols, opts) {
  let extensionId = opts.extensionId;

  // Auto-detect extension ID from active service workers
  const workers = context.serviceWorkers();
  if (workers.length > 0) {
    const detectedId = workers[0].url().split('/')[2];
    if (detectedId) extensionId = detectedId;
  } else {
    try {
      const bg = await context.waitForEvent('serviceworker', { timeout: 2000 });
      const detectedId = bg.url().split('/')[2];
      if (detectedId) extensionId = detectedId;
    } catch (_err) {
      // Service worker not yet available
    }
  }

  const dashboardUrl = `chrome-extension://${extensionId}/dashboard.html`;

  let page = context.pages().find(p => p.url().includes(extensionId));
  if (!page) {
    page = await context.newPage();
    await page.goto(dashboardUrl, { waitUntil: 'load', timeout: 30000 });
  } else {
    await page.bringToFront();
  }

  await page.waitForSelector('#root', { timeout: 15000 });
  await page.waitForTimeout(800);

  // STEP A: Ensure Region is set to India (IN)
  try {
    const regionTrigger = await page.waitForSelector('button.region-trigger', { timeout: 4000 });
    const activeRegion = await regionTrigger.evaluate(el => el.querySelector('.region-label')?.textContent || '');
    if (activeRegion.trim() !== 'IN') {
      await regionTrigger.click();
      const inOption = await page.waitForSelector('button.dropdown-item:has-text("India")', { timeout: 3000 });
      await inOption.click();
      await page.waitForTimeout(500);
    }
  } catch (_err) {
    // Region trigger not found or already on IN
  }

  // STEP B: Handle Weekend Date Selection (If Saturday or Sunday -> Next Monday)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 6 || dayOfWeek === 0) {
    const daysToAdd = dayOfWeek === 6 ? 2 : 1;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToAdd);
    const targetMondayStr = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`;
    
    console.log(`📅 Weekend detected (Day ${dayOfWeek}). Setting date to upcoming Monday: ${targetMondayStr}...`);
    await page.evaluate((dateStr) => {
      const input = document.querySelector('input.date-picker-input-v2');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, dateStr);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, targetMondayStr);
    await page.waitForTimeout(800);
  }

  // STEP C: Ensure Watchlist is set to 'All Stocks'
  try {
    const wlSelect = await page.$('select:has(option[value="all"])');
    if (wlSelect) {
      await page.selectOption('select:has(option[value="all"])', 'all');
      await page.dispatchEvent('select:has(option[value="all"])', 'change');
      await page.waitForTimeout(400);
    }
  } catch (_err) {
    // Watchlist select not present or already set
  }

  // STEP D: Deduplicate & Inject All Stocks for this week
  const existingSymbols = await page.evaluate(() => {
    const cells = document.querySelectorAll('table tbody tr td:first-child, .symbol-cell, [data-symbol]');
    return Array.from(cells).map(el => (el.textContent || '').trim().toUpperCase());
  });

  const symbolsToInject = symbols.filter(sym => !existingSymbols.includes(sym));
  const skippedCount = symbols.length - symbolsToInject.length;

  if (symbolsToInject.length > 0) {
    console.log(`📥 Injecting ${symbolsToInject.length} fresh symbols into All Stocks (${skippedCount} already exist)...`);
    const addBtn = await page.waitForSelector('button.add-stock-cta, button:has-text("Add")', { timeout: 10000 });
    await addBtn.click();

    const modalInput = await page.waitForSelector('.add-stock-modal input[type="text"], input[placeholder*="e.g. AAPL"]', { timeout: 8000 });
    await modalInput.fill(symbolsToInject.join(', '));
    await page.waitForTimeout(300);

    const submitBtn = await page.waitForSelector('.modal-actions button:has-text("Add")', { timeout: 5000 });
    await submitBtn.click();

    await page.waitForSelector('.add-stock-modal', { state: 'detached', timeout: 10000 }).catch(() => null);
    await page.waitForSelector('table tbody tr, .stock-row', { state: 'attached', timeout: 15000 }).catch(() => null);
  } else {
    console.log(`ℹ️ All ${symbols.length} symbols are already present in this week's list.`);
  }

  // STEP E: Wait for Data & Technical Metrics Hydration
  const waitTime = opts.hydrationWaitSec;
  console.log(`⏳ Waiting ${waitTime}s for technical indicators & market data hydration (MAs, RS, Liquidity, Stage)...`);
  await page.waitForTimeout(waitTime * 1000);

  // STEP F: Open Filters Drawer
  console.log(`🔍 Opening Filters drawer to apply technical setup rules...`);
  const filterBtn = await page.waitForSelector('button.funnel-filter-btn', { timeout: 5000 });
  await filterBtn.click();
  await page.waitForSelector('.watchlist-filter-drawer-panel', { timeout: 5000 });

  // 1. Moving Averages: Above 21, 50, 200
  console.log('   - Applying Moving Averages: Above 21, 50, 200...');
  const maTrigger = await page.waitForSelector('#drawer-param-movingAverages, .ma-popover-trigger', { timeout: 5000 });
  await maTrigger.click();
  await page.waitForSelector('.ma-popover-dropdown.matrix-style', { timeout: 5000 });

  for (const period of ['21', '50', '200']) {
    const row = page.locator(`.ma-matrix-row:has(.ma-period-label:text("${period} MA"))`);
    const aboveCell = row.locator('.ma-matrix-cell').first();
    const isActive = await aboveCell.evaluate(el => el.classList.contains('active')).catch(() => false);
    if (!isActive) {
      await aboveCell.click();
    }
  }
  await maTrigger.click(); // Close MA popover
  await page.waitForTimeout(300);

  // 2. Liquidity: > 50
  console.log('   - Applying Liquidity > 50...');
  const liqInput = page.locator('#drawer-param-in\\.liquidity, input[placeholder*="Filter (Cr)"], input[id*="liquidity"]').first();
  await liqInput.fill('> 50');
  await liqInput.dispatchEvent('change');
  await page.waitForTimeout(300);

  // 3. Relative Strength: Strong, Very Strong, Neutral
  console.log('   - Applying Relative Strength: Strong, Very Strong, Neutral...');
  const rsTrigger = await page.waitForSelector('#drawer-param-rs, .multi-select-container:has(label:has-text("Relative Strength")) .multi-select-trigger', { timeout: 5000 });
  await rsTrigger.click();
  await page.waitForSelector('.multi-select-dropdown', { timeout: 5000 });

  for (const targetOpt of ['Strong', 'Very Strong', 'Neutral']) {
    const optEl = page.locator('.multi-select-option').filter({ hasText: new RegExp(`^${targetOpt}$`, 'i') });
    const isSelected = await optEl.evaluate(el => el.classList.contains('selected')).catch(() => false);
    if (!isSelected) {
      await optEl.click();
    }
  }
  await rsTrigger.click(); // Close RS dropdown
  await page.waitForTimeout(300);

  // 4. Stage: Stage 2
  console.log('   - Applying Stage: Stage 2...');
  const stageTrigger = await page.waitForSelector('#drawer-param-stage, .multi-select-container:has(label:has-text("Stage")) .multi-select-trigger', { timeout: 5000 });
  await stageTrigger.click();
  await page.waitForSelector('.multi-select-dropdown', { timeout: 5000 });

  const stage2Opt = page.locator('.multi-select-option').filter({ hasText: /^Stage 2$/i });
  const isStage2Selected = await stage2Opt.evaluate(el => el.classList.contains('selected')).catch(() => false);
  if (!isStage2Selected) {
    await stage2Opt.click();
  }
  await stageTrigger.click(); // Close Stage dropdown
  await page.waitForTimeout(300);

  // 5. Close Filter Drawer
  console.log('   - Closing Filters panel...');
  const closeBtn = await page.waitForSelector('.drawer-close-btn', { timeout: 5000 });
  await closeBtn.click();
  await page.waitForSelector('.watchlist-filter-drawer-backdrop', { state: 'detached', timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(1000);

  // STEP G: Extract Filtered Candidate Symbols
  const filteredTickers = await page.evaluate(() => {
    const cells = document.querySelectorAll('table tbody tr td:first-child, .symbol-cell, [data-symbol]');
    return Array.from(cells)
      .map(el => (el.textContent || '').trim().toUpperCase())
      .filter(sym => /^[A-Z0-9.\-_]{2,15}$/.test(sym) && !['ALL', 'SR.'].includes(sym));
  });

  const uniqueFiltered = [...new Set(filteredTickers)];
  console.log(`🎯 Filter Results: Found ${uniqueFiltered.length} high-probability setups passing all criteria:`);
  console.log(uniqueFiltered.length > 0 ? uniqueFiltered.join(', ') : '(No stocks strictly matched all 4 filters)');

  // STEP H: Switch Watchlist to "Default Watchlist" & Copy Filtered Stocks
  if (uniqueFiltered.length > 0) {
    console.log(`📋 Switching Watchlist to "Default Watchlist"...`);
    const wlDropdown = page.locator('select:has(option[value="all"])');
    
    // Find Default Watchlist option value
    const targetWlValue = await page.evaluate(() => {
      const select = document.querySelector('select:has(option[value="all"])');
      if (!select) return null;
      const opts = Array.from(select.options);
      // Look for option with text matching 'default' (case insensitive) or first non-all option
      const match = opts.find(o => o.value !== 'all' && o.text.toLowerCase().includes('default'))
        || opts.find(o => o.value !== 'all');
      return match ? match.value : null;
    });

    if (targetWlValue) {
      await wlDropdown.selectOption(targetWlValue);
      await wlDropdown.dispatchEvent('change');
      await page.waitForTimeout(800);

      // Open Add Stock modal for Default Watchlist
      console.log(`➕ Copying ${uniqueFiltered.length} filtered stocks into Default Watchlist...`);
      const addBtnWl = await page.waitForSelector('button.add-stock-cta, button:has-text("Add")', { timeout: 10000 });
      await addBtnWl.click();

      const modalInputWl = await page.waitForSelector('.add-stock-modal input[type="text"], input[placeholder*="e.g. AAPL"]', { timeout: 8000 });
      await modalInputWl.fill(uniqueFiltered.join(', '));
      await page.waitForTimeout(400);

      const submitBtnWl = await page.waitForSelector('.modal-actions button:has-text("Add")', { timeout: 5000 });
      await submitBtnWl.click();

      await page.waitForSelector('.add-stock-modal', { state: 'detached', timeout: 8000 }).catch(() => null);
      await page.waitForSelector('table tbody tr, .stock-row', { state: 'attached', timeout: 10000 }).catch(() => null);
      console.log(`[3/3] TradeClarity updated: ${uniqueFiltered.length} filtered setups copied into Default Watchlist!`);
    } else {
      console.log(`ℹ️ Only 'All Stocks' watchlist exists. Filtered view is active in current tab.`);
    }
  } else {
    console.log(`[3/3] TradeClarity updated: All stocks loaded and technical filters applied.`);
  }
}

// ==========================================
// MAIN RUNNER
// ==========================================
async function main() {
  const opts = parseArgs();

  if (opts.help) {
    console.log(`
TradeClarity Autonomous Stock Scanner Agent
Usage:
  node scripts/sync-chartink-agent.js [options]
  npm run sync:agent -- [options]

Options:
  --profile <name>     Chrome profile folder name (default: "Default", e.g. "Profile 1")
  --profile-dir <dir>  Chrome User Data root directory
  --ext-id <id>        TradeClarity Chrome Extension ID
  --cdp <port>         Connect via remote debugging port (default: 9222)
  --wait <sec>         Hydration wait time in seconds (default: 12)
  --isolated           Launch using isolated temporary automation profile
  --dry-run            Fetch and print symbols from Chartink without opening browser
  --help, -h           Show this help message
`);
    return;
  }

  console.log('====================================================');
  console.log('🤖 TRADECLARITY AUTONOMOUS SCANNER AGENT');
  console.log('====================================================');

  // 1. Fetch symbols programmatically from Chartink
  const symbols = await fetchChartinkSymbols();

  if (opts.dryRun) {
    console.log('\n[DRY RUN] Tickers extracted:');
    console.log(symbols.join(', '));
    return;
  }

  // 2. Connect / Launch Browser
  const { context } = await getBrowserContext(opts);

  // 3. Run complete TradeClarity workflow
  await runTradeClarityWorkflow(context, symbols, opts);

  console.log('====================================================');
  console.log('✨ SUCCESS: View is active in Chrome and ready for filtering.');
  console.log('ℹ️ Browser session left open. Feel free to inspect your setups.');
  console.log('====================================================');

  // Keep process alive so the browser window remains open until user closes it
  await new Promise(() => {});
}

main().catch(err => {
  console.error('\n❌ Agent execution error:', err.message || err);
  process.exit(1);
});
