"""
Stage 1.2 — NDAP Dynamic Web Scraper (Playwright)

NDAP does NOT allow direct file download — it emails the CSV to you.
This script automates the "Download Table → CSV" click flow for all 7 datasets.

Flow:
  1. Opens NDAP catalogue in a visible browser.
  2. Pauses 30s for user to LOG IN manually.
  3. Navigates to each dataset → Data Table tab → Download Table → CSV.
  4. NDAP emails the CSV to the logged-in user's email.

Usage:
    python stage1_scrape_ndap.py
"""

import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# ── Configuration ───────────────────────────────────────────────────────────
NDAP_BASE = "https://ndap.niti.gov.in"
NDAP_CATALOGUE_URL = (
    f"{NDAP_BASE}/catalogue?sectors=2"
    "&search=Variables%2CDatasetInfo&query=*&domain=ndap&timefrequency=2"
)

LOGIN_PAUSE_SECONDS = 30

# All 7 dataset IDs (confirmed from catalogue)
DATASETS = [
    {"id": "7104", "name": "Statewise Statistics Account Opening Report"},
    {"id": "8675", "name": "Accounts Opened under PMJDY"},
    {"id": "7492", "name": "RBI Liabilities and Assets"},
    {"id": "7500", "name": "Major Price Indices"},
    {"id": "7496", "name": "RBI Weekly Statistics Ratios Rates"},
    {"id": "7501", "name": "Certificates of Deposit"},
    {"id": "6725", "name": "Bank Credit and Investments"},
]


async def wait_for_login(page):
    """Pause so the user can log in manually."""
    print("\n" + "=" * 60)
    print("  🔓 LOGIN REQUIRED — You have 30 seconds")
    print("=" * 60)
    print("  ➡️  Click 'Login' (top-right), sign in with Google.")
    print("=" * 60)

    for remaining in range(LOGIN_PAUSE_SECONDS, 0, -1):
        sys.stdout.write(f"\r  ⏳ {remaining:>3}s remaining   ")
        sys.stdout.flush()
        await asyncio.sleep(1)

    print(f"\r  ✅ Resuming...                        ")


async def trigger_download(page, ds_id, ds_name, idx, total):
    """
    Navigate to dataset page, switch to Data Table tab,
    click Download Table, select CSV.
    NDAP will email the file — no browser download expected.
    """
    url = f"{NDAP_BASE}/dataset/{ds_id}"
    print(f"\n{'─'*60}")
    print(f"  [{idx+1}/{total}] {ds_name}")
    print(f"  {url}")
    print(f"{'─'*60}")

    # ── Navigate ────────────────────────────────────────────────────
    try:
        await page.goto(url, wait_until="networkidle", timeout=45000)
    except PlaywrightTimeout:
        try:
            await page.goto(url, timeout=45000)
        except Exception as e:
            print(f"  ❌ Navigation failed: {e}")
            return False
    except Exception as e:
        print(f"  ❌ Navigation failed: {e}")
        return False

    await page.wait_for_timeout(4000)

    # ── Dismiss any modals ──────────────────────────────────────────
    for _ in range(3):
        for sel in ['.ant-modal-close', 'button:has-text("×")',
                    'button:has-text("Close")', 'button:has-text("Proceed")',
                    'button:has-text("Do not show")']:
            try:
                btn = await page.wait_for_selector(sel, timeout=1500)
                if btn and await btn.is_visible():
                    await btn.click()
                    await page.wait_for_timeout(1000)
            except (PlaywrightTimeout, Exception):
                continue

    # ── Switch to "Data Table" tab if present ───────────────────────
    try:
        data_tab = await page.wait_for_selector(
            'text="Data Table", div:has-text("Data Table")', timeout=5000
        )
        if data_tab and await data_tab.is_visible():
            await data_tab.click()
            print(f"  📊 Switched to Data Table tab")
            await page.wait_for_timeout(3000)

            # Dismiss modals that appear after tab switch
            for sel in ['button:has-text("Proceed")', '.ant-modal-close',
                        'button:has-text("×")', 'button:has-text("Close")']:
                try:
                    btn = await page.wait_for_selector(sel, timeout=2000)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await page.wait_for_timeout(1000)
                except (PlaywrightTimeout, Exception):
                    continue
    except (PlaywrightTimeout, Exception):
        print(f"  ℹ️  No Data Table tab found, staying on current view")

    # ── Click "Download Table" ──────────────────────────────────────
    download_btn = None
    for sel in ['button:has-text("Download Table")', 'button:has-text("Download")',
                'a:has-text("Download Table")', 'a:has-text("Download")']:
        try:
            download_btn = await page.wait_for_selector(sel, timeout=5000)
            if download_btn and await download_btn.is_visible():
                break
            download_btn = None
        except PlaywrightTimeout:
            continue

    if not download_btn:
        print(f"  ❌ No Download button found")
        return False

    await download_btn.click()
    print(f"  📥 Clicked 'Download Table'")
    await page.wait_for_timeout(3000)

    # ── Select CSV format if a format picker appears ────────────────
    csv_clicked = False
    for sel in ['text="Download as CSV"', 'text="CSV"', 'text="csv"',
                'div:has-text("CSV")', 'span:has-text("CSV")',
                'label:has-text("CSV")', 'button:has-text("CSV")']:
        try:
            csv_opt = await page.wait_for_selector(sel, timeout=3000)
            if csv_opt and await csv_opt.is_visible():
                await csv_opt.click()
                csv_clicked = True
                print(f"  📄 Selected CSV format")
                await page.wait_for_timeout(2000)
                break
        except (PlaywrightTimeout, Exception):
            continue

    if not csv_clicked:
        # Maybe the download was triggered directly
        print(f"  ℹ️  No CSV picker appeared — download may have been triggered")

    # ── Click any confirm/submit button ─────────────────────────────
    for sel in ['button:has-text("Download")', 'button:has-text("Submit")',
                'button:has-text("OK")', 'button:has-text("Confirm")',
                'button:has-text("Send")', 'button:has-text("Request")']:
        try:
            confirm = await page.wait_for_selector(sel, timeout=3000)
            if confirm and await confirm.is_visible():
                await confirm.click()
                print(f"  ✉️  Confirmed — CSV will be emailed to you")
                await page.wait_for_timeout(2000)
                break
        except (PlaywrightTimeout, Exception):
            continue

    print(f"  ✅ Download request sent for: {ds_name}")
    return True


async def main():
    print("=" * 60)
    print("  NDAP DATASET SCRAPER")
    print("  (Downloads are emailed to your NDAP account)")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=200)
        context = await browser.new_context(
            accept_downloads=True,
            viewport={"width": 1366, "height": 900},
        )
        page = await context.new_page()

        # ── Open catalogue for login ────────────────────────────────
        print("\n📌 Opening NDAP...")
        try:
            await page.goto(NDAP_CATALOGUE_URL, wait_until="networkidle",
                          timeout=30000)
        except Exception:
            await page.goto(NDAP_CATALOGUE_URL, timeout=30000)
        await page.wait_for_timeout(2000)

        # Dismiss intro modal
        try:
            close = await page.wait_for_selector('.ant-modal-close', timeout=3000)
            if close:
                await close.click()
        except PlaywrightTimeout:
            pass

        # Click Login
        try:
            login_btn = await page.wait_for_selector(
                'a:has-text("Login"), button:has-text("Login")', timeout=5000)
            if login_btn:
                await login_btn.click()
                await page.wait_for_timeout(2000)
        except PlaywrightTimeout:
            pass

        # ── Wait for login ──────────────────────────────────────────
        await wait_for_login(page)

        # ── Process all 7 datasets ──────────────────────────────────
        results = {}
        for idx, ds in enumerate(DATASETS):
            try:
                ok = await trigger_download(page, ds["id"], ds["name"],
                                          idx, len(DATASETS))
            except Exception as e:
                print(f"  ❌ Error: {e}")
                ok = False
            results[ds["name"]] = ok
            # Brief pause between datasets
            await page.wait_for_timeout(2000)

        try:
            await browser.close()
        except Exception:
            pass

    # ── Summary ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    for name, ok in results.items():
        print(f"  {'✅' if ok else '❌'}  {name}")
    n_ok = sum(results.values())
    print(f"\n  {n_ok}/{len(results)} download requests sent")
    if n_ok > 0:
        print("  📧 Check your email for the CSV files from NDAP!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
