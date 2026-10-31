"""
TradeClarity Autonomous Stock Scanner Agent (Python Edition)

Flow:
1. Programmatically fetches stock symbols from Chartink screener:
   - Fetches CSRF token, session cookies, and scan clause
   - Issues POST request to https://chartink.com/screener/process
   - Extracts ticker list (item.nsecode) with retry backoff & fallback
2. Connects to or launches Chrome with TradeClarity extension
3. Handles Weekend Date Routing (If Saturday or Sunday -> Sets Date to Next Monday)
4. Injects all Chartink symbols into current week's "All Stocks" watchlist
5. Waits for Technical Engine & Market Data Hydration (MAs, RS, Liquidity, Stage)
6. Automates Advanced Filtering:
   - Moving Averages: Above 21, 50, 200
   - Liquidity: > 50 Cr
   - Relative Strength: Strong, Very Strong, Neutral
   - Stage: Stage 2
7. Closes Filter panel, captures qualified setup symbols
8. Switches Watchlist to "Default Watchlist" and copies qualified symbols via Add Stocks
9. Leaves the populated view active and ready for filtering
"""

import os
import sys
import time
import json
import re
import html
import argparse
from datetime import datetime, timedelta
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

CHARTINK_SCREENER_URL = "https://chartink.com/screener/legacy-scanner-atvvvstockanalyst"
CHARTINK_PROCESS_URL = "https://chartink.com/screener/process"
DEFAULT_EXTENSION_ID = "ljlmionnjohcgjmifipdhlgdinjaangg"
FALLBACK_SCAN_CLAUSE = "( {cash} ( latest close >= latest max( 250 , latest high ) * 0.75 and market cap >= 1000 and latest close >= latest ema( latest close , 50 ) and latest close >= latest ema( latest close , 200 ) ) )"

BASE_DIR = Path(__file__).resolve().parent.parent
PATH_TO_EXTENSION = BASE_DIR.parent / "extension"
USER_PROFILE = os.environ.get("USERPROFILE", "C:/Users/chand")
DEFAULT_CHROME_USER_DATA = os.path.join(USER_PROFILE, "AppData", "Local", "Google", "Chrome", "User Data")


def parse_args():
    parser = argparse.ArgumentParser(description="TradeClarity Autonomous Stock Scanner Agent")
    parser.add_argument("--profile-dir", default=DEFAULT_CHROME_USER_DATA, help="Chrome User Data directory")
    parser.add_argument("--profile", default="Default", help="Chrome profile folder name (e.g. Default, Profile 1)")
    parser.add_argument("--ext-id", default=DEFAULT_EXTENSION_ID, help="TradeClarity Extension ID")
    parser.add_argument("--cdp", type=int, default=9222, help="Remote debugging CDP port (default: 9222)")
    parser.add_argument("--wait", type=int, default=12, help="Hydration wait time in seconds (default: 12)")
    parser.add_argument("--isolated", action="store_true", help="Launch isolated temporary automation profile")
    parser.add_argument("--dry-run", action="store_true", help="Extract and display symbols without launching browser")
    return parser.parse_args()


# ==========================================
# 1. CHARTINK EXTRACTION ENGINE
# ==========================================
def fetch_chartink_symbols(max_retries=3):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })

    attempt = 0
    last_err = None

    while attempt < max_retries:
        attempt += 1
        try:
            resp = session.get(CHARTINK_SCREENER_URL, timeout=20)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")

            csrf_tag = soup.find("meta", attrs={"name": "csrf-token"})
            csrf_token = csrf_tag["content"] if csrf_tag and csrf_tag.has_attr("content") else None

            if not csrf_token:
                m = re.search(r'name=["\']csrf-token["\'][^>]*content=["\']([^"\']+)["\']', resp.text, re.I)
                if not m:
                    m = re.search(r'content=["\']([^"\']+)["\'][^>]*name=["\']csrf-token["\']', resp.text, re.I)
                csrf_token = m.group(1) if m else None

            if not csrf_token:
                raise ValueError("Could not extract CSRF token from Chartink screener page.")

            scan_clause = None
            input_tag = soup.find("input", attrs={"name": "scan_clause"})
            if input_tag and input_tag.has_attr("value"):
                scan_clause = input_tag["value"]
            else:
                scanner_tag = soup.find("scanner")
                if scanner_tag and scanner_tag.has_attr(":scan-json"):
                    raw_json = html.unescape(scanner_tag[":scan-json"])
                    try:
                        parsed = json.loads(raw_json)
                        scan_clause = parsed.get("atlas_query") or parsed.get("scan_clause")
                    except Exception:
                        pass

            if not scan_clause:
                scan_clause = FALLBACK_SCAN_CLAUSE

            print("[1/3] Connected to Chartink (CSRF token verified)")

            post_headers = {
                "x-csrf-token": csrf_token,
                "Referer": CHARTINK_SCREENER_URL,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json, text/javascript, */*; q=0.01",
            }

            post_resp = session.post(CHARTINK_PROCESS_URL, headers=post_headers, data={"scan_clause": scan_clause}, timeout=25)
            post_resp.raise_for_status()

            data = post_resp.json()
            if "data" not in data or not isinstance(data["data"], list):
                raise ValueError("Invalid JSON response from Chartink process endpoint.")

            blacklist = {"RUN", "SCAN", "LEGACY", "SR.", "VIEW", "COPY", "CSV", "JSON", "EXCEL", "FILTER", "CHART", "LOGOUT"}
            clean_symbols = []

            for item in data["data"]:
                raw_code = item.get("nsecode") or item.get("name") or ""
                sym = str(raw_code).strip().upper()
                sym = re.sub(r"\.(NS|BO)$", "", sym)
                if sym and re.match(r"^[A-Z0-9.\-_]{2,15}$", sym) and sym not in blacklist:
                    if sym not in clean_symbols:
                        clean_symbols.append(sym)

            print(f"[2/3] Extracted {len(clean_symbols)} symbols from Chartink screener")
            return clean_symbols

        except Exception as e:
            last_err = e
            print(f"⚠️ Chartink extraction attempt {attempt}/{max_retries} failed: {e}")
            if attempt < max_retries:
                time.sleep(2 ** attempt)

    raise RuntimeError(f"Chartink extraction failed after {max_retries} attempts: {last_err}")


# ==========================================
# 2. WORKFLOW AUTOMATION
# ==========================================
def run_tradeclarity_workflow(playwright, symbols, args):
    ext_path = str(PATH_TO_EXTENSION)
    extension_id = args.ext_id
    context = None

    # Connect CDP or Launch
    try:
        cdp_resp = requests.get(f"http://127.0.0.1:{args.cdp}/json/version", timeout=1)
        if cdp_resp.status_code == 200:
            print(f"🔗 Connecting to running Chrome session via CDP (port {args.cdp})...")
            browser = playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{args.cdp}")
            contexts = browser.contexts
            context = contexts[0] if contexts else browser.new_context()
    except Exception:
        pass

    if not context:
        profile_path = str(BASE_DIR / "scratch" / "auto_profile") if args.isolated else os.path.join(args.profile_dir, args.profile)
        print(f"🌐 Launching browser with extension loaded from: {ext_path}")

        ext_args = [
            f"--disable-extensions-except={ext_path}",
            f"--load-extension={ext_path}",
            "--no-first-run",
            "--no-default-browser-check",
        ] if os.path.exists(ext_path) else []

        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=profile_path,
                headless=False,
                viewport={"width": 1440, "height": 900},
                args=ext_args,
            )
        except Exception as err:
            if "locked" in str(err).lower() or "target page" in str(err).lower() or "ebusy" in str(err).lower():
                print("\n❌ Chrome profile is locked! Please close Chrome, or use --isolated, or run with --cdp 9222.\n")
            raise err

    # Auto-detect extension ID from service worker
    workers = context.service_workers
    if workers:
        detected_id = workers[0].url.split("/")[2]
        if detected_id:
            extension_id = detected_id
    else:
        try:
            bg = context.wait_for_event("serviceworker", timeout=2000)
            detected_id = bg.url.split("/")[2]
            if detected_id:
                extension_id = detected_id
        except Exception:
            pass

    dashboard_url = f"chrome-extension://{extension_id}/dashboard.html"

    page = next((p for p in context.pages if extension_id in p.url), None)
    if not page:
        page = context.new_page()
        page.goto(dashboard_url, wait_until="load", timeout=30000)
    else:
        page.bring_to_front()

    page.wait_for_selector("#root", timeout=15000)
    page.wait_for_timeout(800)

    # 1. Region: Ensure India (IN)
    try:
        region_trigger = page.wait_for_selector("button.region-trigger", timeout=4000)
        label = region_trigger.eval_on_selector(".region-label", "el => el.textContent") or ""
        if label.strip() != "IN":
            region_trigger.click()
            in_option = page.wait_for_selector('button.dropdown-item:has-text("India")', timeout=3000)
            in_option.click()
            page.wait_for_timeout(500)
    except Exception:
        pass

    # 2. Weekend Date Routing (Saturday/Sunday -> Next Monday)
    now = datetime.now()
    weekday = now.weekday()  # Monday=0, Saturday=5, Sunday=6
    if weekday in (5, 6):
        days_ahead = 2 if weekday == 5 else 1
        target_monday = now + timedelta(days=days_ahead)
        monday_str = target_monday.strftime("%Y-%m-%d")
        print(f"📅 Weekend detected (Day {weekday}). Setting date to upcoming Monday: {monday_str}...")

        page.evaluate("""(dateStr) => {
            const input = document.querySelector('input.date-picker-input-v2');
            if (input) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, dateStr);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }""", monday_str)
        page.wait_for_timeout(800)

    # 3. Watchlist: Ensure 'all'
    try:
        wl_select = page.query_selector('select:has(option[value="all"])')
        if wl_select:
            page.select_option('select:has(option[value="all"])', "all")
            page.wait_for_timeout(400)
    except Exception:
        pass

    # 4. Deduplicate and Inject into All Stocks
    existing_symbols = page.evaluate("""() => {
        const cells = document.querySelectorAll('table tbody tr td:first-child, .symbol-cell, [data-symbol]');
        return Array.from(cells).map(el => (el.textContent || '').trim().toUpperCase());
    }""")

    symbols_to_inject = [s for s in symbols if s not in existing_symbols]
    skipped_count = len(symbols) - len(symbols_to_inject)

    if symbols_to_inject:
        print(f"📥 Injecting {len(symbols_to_inject)} symbols into All Stocks ({skipped_count} existing skipped)...")
        add_btn = page.wait_for_selector('button.add-stock-cta, button:has-text("Add")', timeout=10000)
        add_btn.click()

        modal_input = page.wait_for_selector('.add-stock-modal input[type="text"], input[placeholder*="e.g. AAPL"]', timeout=8000)
        modal_input.fill(", ".join(symbols_to_inject))
        page.wait_for_timeout(300)

        submit_btn = page.wait_for_selector('.modal-actions button:has-text("Add")', timeout=5000)
        submit_btn.click()

        try:
            page.wait_for_selector(".add-stock-modal", state="detached", timeout=8000)
        except Exception:
            pass
        try:
            page.wait_for_selector("table tbody tr, .stock-row", state="attached", timeout=15000)
        except Exception:
            pass
    else:
        print(f"ℹ️ All {len(symbols)} symbols are already present in this week's list.")

    # 5. Wait for Technical Engine & Market Data Hydration
    wait_sec = args.wait
    print(f"⏳ Waiting {wait_sec}s for technical indicator hydration (MAs, RS, Liquidity, Stage)...")
    page.wait_for_timeout(wait_sec * 1000)

    # 6. Open Filters Drawer & Apply Filters
    print("🔍 Opening Filters drawer to apply technical setup rules...")
    filter_btn = page.wait_for_selector("button.funnel-filter-btn", timeout=5000)
    filter_btn.click()
    page.wait_for_selector(".watchlist-filter-drawer-panel", timeout=5000)

    # MA: Above 21, 50, 200
    print("   - Applying Moving Averages: Above 21, 50, 200...")
    ma_trigger = page.wait_for_selector("#drawer-param-movingAverages, .ma-popover-trigger", timeout=5000)
    ma_trigger.click()
    page.wait_for_selector(".ma-popover-dropdown.matrix-style", timeout=5000)

    for period in ["21", "50", "200"]:
        row = page.locator(f'.ma-matrix-row:has(.ma-period-label:text("{period} MA"))')
        above_cell = row.locator(".ma-matrix-cell").first
        is_active = above_cell.evaluate("el => el.classList.contains('active')")
        if not is_active:
            above_cell.click()

    ma_trigger.click()
    page.wait_for_timeout(300)

    # Liquidity: > 50
    print("   - Applying Liquidity > 50...")
    liq_input = page.locator('#drawer-param-in\\.liquidity, input[placeholder*="Filter (Cr)"], input[id*="liquidity"]').first
    liq_input.fill("> 50")
    liq_input.dispatch_event("change")
    page.wait_for_timeout(300)

    # Relative Strength: Strong, Very Strong, Neutral
    print("   - Applying Relative Strength: Strong, Very Strong, Neutral...")
    rs_trigger = page.wait_for_selector('#drawer-param-rs, .multi-select-container:has(label:has-text("Relative Strength")) .multi-select-trigger', timeout=5000)
    rs_trigger.click()
    page.wait_for_selector(".multi-select-dropdown", timeout=5000)

    for opt_name in ["Strong", "Very Strong", "Neutral"]:
        opt_el = page.locator(".multi-select-option").filter(has_text=re.compile(f"^{opt_name}$", re.I))
        is_sel = opt_el.evaluate("el => el.classList.contains('selected')")
        if not is_sel:
            opt_el.click()

    rs_trigger.click()
    page.wait_for_timeout(300)

    # Stage: Stage 2
    print("   - Applying Stage: Stage 2...")
    stage_trigger = page.wait_for_selector('#drawer-param-stage, .multi-select-container:has(label:has-text("Stage")) .multi-select-trigger', timeout=5000)
    stage_trigger.click()
    page.wait_for_selector(".multi-select-dropdown", timeout=5000)

    stage2_opt = page.locator(".multi-select-option").filter(has_text=re.compile(r"^Stage 2$", re.I))
    is_stage2_sel = stage2_opt.evaluate("el => el.classList.contains('selected')")
    if not is_stage2_sel:
        stage2_opt.click()

    stage_trigger.click()
    page.wait_for_timeout(300)

    # Close Filters
    print("   - Closing Filters panel...")
    close_btn = page.wait_for_selector(".drawer-close-btn", timeout=5000)
    close_btn.click()
    try:
        page.wait_for_selector(".watchlist-filter-drawer-backdrop", state="detached", timeout=5000)
    except Exception:
        pass
    page.wait_for_timeout(1000)

    # 7. Extract Filtered Stocks
    filtered_tickers = page.evaluate("""() => {
        const cells = document.querySelectorAll('table tbody tr td:first-child, .symbol-cell, [data-symbol]');
        return Array.from(cells)
            .map(el => (el.textContent || '').trim().toUpperCase())
            .filter(sym => /^[A-Z0-9.\-_]{2,15}$/.test(sym) && !['ALL', 'SR.'].includes(sym));
    }""")
    unique_filtered = sorted(list(set(filtered_tickers)))
    print(f"🎯 Filter Results: Found {len(unique_filtered)} high-probability setups passing all criteria:")
    print(", ".join(unique_filtered) if unique_filtered else "(No stocks strictly matched all 4 filters)")

    # 8. Switch to Default Watchlist & Copy Filtered Stocks
    if unique_filtered:
        print('📋 Switching Watchlist to "Default Watchlist"...')
        wl_dropdown = page.locator('select:has(option[value="all"])')

        target_wl_val = page.evaluate("""() => {
            const select = document.querySelector('select:has(option[value="all"])');
            if (!select) return null;
            const opts = Array.from(select.options);
            const match = opts.find(o => o.value !== 'all' && o.text.toLowerCase().includes('default'))
                || opts.find(o => o.value !== 'all');
            return match ? match.value : null;
        }""")

        if target_wl_val:
            wl_dropdown.select_option(target_wl_val)
            wl_dropdown.dispatch_event("change")
            page.wait_for_timeout(800)

            print(f"➕ Copying {len(unique_filtered)} filtered stocks into Default Watchlist...")
            add_btn_wl = page.wait_for_selector('button.add-stock-cta, button:has-text("Add")', timeout=10000)
            add_btn_wl.click()

            modal_input_wl = page.wait_for_selector('.add-stock-modal input[type="text"], input[placeholder*="e.g. AAPL"]', timeout=8000)
            modal_input_wl.fill(", ".join(unique_filtered))
            page.wait_for_timeout(400)

            submit_btn_wl = page.wait_for_selector('.modal-actions button:has-text("Add")', timeout=5000)
            submit_btn_wl.click()

            try:
                page.wait_for_selector(".add-stock-modal", state="detached", timeout=8000)
            except Exception:
                pass
            try:
                page.wait_for_selector("table tbody tr, .stock-row", state="attached", timeout=10000)
            except Exception:
                pass

            print(f"[3/3] TradeClarity updated: {len(unique_filtered)} filtered setups copied into Default Watchlist!")
        else:
            print("ℹ️ Only 'All Stocks' watchlist exists. Filtered view is active.")
    else:
        print("[3/3] TradeClarity updated: All stocks loaded and technical filters applied.")

    return context


def main():
    args = parse_args()

    print("====================================================")
    print("🤖 TRADECLARITY AUTONOMOUS SCANNER AGENT (PYTHON)")
    print("====================================================")

    symbols = fetch_chartink_symbols()

    if args.dry_run:
        print("\n[DRY RUN] Tickers extracted:")
        print(", ".join(symbols))
        return

    with sync_playwright() as playwright:
        run_tradeclarity_workflow(playwright, symbols, args)

        print("====================================================")
        print("✨ SUCCESS: View is active in Chrome and ready for filtering.")
        print("ℹ️ Browser session left open. Press Ctrl+C in terminal when finished.")
        print("====================================================")

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down agent session. Goodbye!")


if __name__ == "__main__":
    main()
