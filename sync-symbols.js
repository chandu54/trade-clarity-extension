import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, 'scraped_symbols.txt');

async function run() {
  console.log("=========================================");
  console.log("🚀 STARTING SYNC-SYMBOLS AUTOMATION ENGINE");
  console.log("=========================================");

  // 1. Launch a completely fresh, isolated browser (No profile locks!)
  const browser = await chromium.launch({ headless: true }); // Can run completely silent in background
  const page = await browser.newPage();

  try {
    console.log("Navigating to Chartink screener...");
    await page.goto('https://chartink.com/screener/legacy-scanner-atvvvstockanalyst', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    console.log("Clicking 'Run Scan'...");
    const runBtn = await page.waitForSelector('#run_rules, .btn-run-scan, button:has-text("Run Scan")', { timeout: 10000 });
    await runBtn.click();

    console.log("Waiting for results table to populate...");
    const tableSelector = '#vol_table tbody tr, .bootstrap-table table tbody tr, table.table tbody tr, .bootstrap-table tbody tr, table tr';
    await page.waitForSelector(tableSelector, { state: 'attached', timeout: 20000 });

    // Wait until loading message disappears
    await page.waitForFunction((sel) => {
      const rows = document.querySelectorAll(sel);
      if (rows.length > 0) {
        const text = rows[0].textContent || "";
        return !text.includes("Loading") && !text.includes("Processing") && !text.includes("No data");
      }
      return false;
    }, tableSelector, { timeout: 20000 });

    console.log("Scraping symbols...");
    const symbols = await page.evaluate((sel) => {
      const rows = document.querySelectorAll(sel);
      const tickers = [];
      
      rows.forEach(row => {
        const anchors = row.querySelectorAll('a');
        anchors.forEach(a => {
          const text = (a.textContent || "").trim().toUpperCase();
          if (text && /^[A-Z0-9.\-_]{2,10}(\.NS|\.BO)?$/.test(text)) {
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

    console.log(`\n🎉 Extracted ${symbols.length} tickers successfully!`);
    
    if (symbols.length === 0) {
      console.log("❌ No symbols found. Please verify the scanner page. Exiting.");
      await browser.close();
      return;
    }

    const symbolsString = symbols.join(', ');

    // 2. Write to local scraped_symbols.txt file
    fs.writeFileSync(outputFile, symbolsString);
    console.log(`💾 Saved to: ${outputFile}`);

    // 3. NATIVE WINDOWS CLIPBOARD COPY (Zero-dependency PowerShell execution)
    try {
      // Escape single quotes for PowerShell
      const escapedSymbols = symbolsString.replace(/'/g, "''");
      execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${escapedSymbols}'"`);
      console.log("📋 Copied tickers directly to your Windows Clipboard!");
    } catch (_clipErr) {
      console.log("⚠️ Could not auto-copy to clipboard. Please copy manually from scraped_symbols.txt.");
    }

    console.log("\n=========================================");
    console.log("👉 NEXT STEP:");
    console.log("1. Open your TradeClarity Dashboard in Chrome");
    console.log("2. Click '+ Add Stock' (or press Alt + N)");
    console.log("3. Press 'Ctrl + V' to paste the copied symbols");
    console.log("4. Click 'Add'!");
    console.log("=========================================");

  } catch (err) {
    console.error("❌ Scraping failed:", err.message || err);
  } finally {
    await browser.close();
  }
}

run();
