"""
PCStudio.in PC Builder — Component Database Scraper
====================================================
Extracts all PC components (CPUs, GPUs, RAM, etc.) from the dynamic
PC builder at https://www.pcstudio.in/pc-build/

Uses Playwright (async) to handle the JavaScript-rendered modal UI.
Outputs: pcstudio_components.json + pcstudio_components.csv

Usage:
    pip install playwright pandas
    playwright install chromium
    python scrape_pcstudio.py
"""

import asyncio
import json
import re
import time
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    pd = None
    print("[WARN] pandas not installed — CSV export will be skipped. pip install pandas")

from playwright.async_api import async_playwright, TimeoutError as PwTimeout

# ── Configuration ─────────────────────────────────────────────────────────────
TARGET_URL = "https://www.pcstudio.in/pc-build/"
OUTPUT_JSON = Path("pcstudio_components.json")
OUTPUT_CSV = Path("pcstudio_components.csv")

HEADLESS = True  # Set False to watch the browser
SLOW_MO = 0  # ms between actions (increase for debugging)
NAV_TIMEOUT = 60_000  # 60 s page load timeout
ACTION_TIMEOUT = 20_000  # 20 s per-action timeout

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)


def clean_price(raw: str) -> float | None:
    """Strip ₹, commas, whitespace and return a float (or None)."""
    if not raw:
        return None
    digits = re.sub(r"[^\d.]", "", raw)
    try:
        return float(digits)
    except ValueError:
        return None


async def extract_products_from_page(page) -> list[dict]:
    """
    Read every `.woopb-modal-product` card currently visible inside the modal
    and return a list of product dicts.
    """
    return await page.evaluate("""() => {
        const cards = document.querySelectorAll('#woopb-modal .woopb-modal-product');
        return [...cards].map(card => {
            // ── Name ─────────────────────────────────────────────
            const titleEl = card.querySelector('.woopb-product-title a');
            const name = titleEl ? titleEl.textContent.trim() : '';
            const url  = titleEl ? titleEl.href : '';

            // ── Price (current / sale) ───────────────────────────
            const insEl = card.querySelector('.woopb-product-price ins .woocommerce-Price-amount');
            const currentPrice = insEl ? insEl.textContent.trim() : '';

            // ── Original price ───────────────────────────────────
            const delEl = card.querySelector('.woopb-product-price del .woocommerce-Price-amount');
            const originalPrice = delEl ? delEl.textContent.trim() : '';

            // If there is no sale, the price sits directly in .woopb-product-price
            let displayPrice = currentPrice;
            if (!displayPrice) {
                const priceEl = card.querySelector('.woopb-product-price .woocommerce-Price-amount');
                displayPrice = priceEl ? priceEl.textContent.trim() : '';
            }

            // ── Stock status ─────────────────────────────────────
            const stockEl = card.querySelector('.stock');
            let stockStatus = 'In Stock';           // default when purchasable
            if (stockEl) {
                if (stockEl.classList.contains('out-of-stock')) {
                    stockStatus = 'Out of Stock';
                } else {
                    stockStatus = stockEl.textContent.trim();  // e.g. "1 in stock"
                }
            }

            return { name, url, displayPrice, originalPrice, stockStatus };
        });
    }""")


async def close_modal(page):
    """
    Robustly close the WooPB modal by clicking its close button
    and then confirming the modal content is gone.
    """
    await page.evaluate("""() => {
        const btn = document.querySelector('.woopb-close-modal');
        if (btn) btn.click();
    }""")
    # Give the close animation time to complete
    await page.wait_for_timeout(1000)
    # Verify modal products are gone; if not, forcibly clear
    still_open = await page.evaluate("""() => {
        return document.querySelectorAll('#woopb-modal .woopb-modal-product').length > 0;
    }""")
    if still_open:
        await page.evaluate("""() => {
            const m = document.querySelector('#woopb-modal');
            if (m) m.innerHTML = '';
        }""")
        await page.wait_for_timeout(300)


async def scrape_category(page, step_index: int, category_name: str) -> list[dict]:
    """
    Reload the page, click into one category, paginate through all
    products, and return the full product list for that category.
    """
    products: list[dict] = []
    print(f"  [{step_index + 1:02d}] Opening: {category_name}")

    # Reload for a clean slate — the WooPB plugin keeps modal state
    # that interferes with opening subsequent categories.
    if step_index > 0:
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await page.wait_for_selector(".woopb-step", state="attached", timeout=NAV_TIMEOUT)

    # Use JS to click the nth .woopb-load-step
    opened = await page.evaluate("""(idx) => {
        const btns = document.querySelectorAll('.woopb-load-step');
        if (btns[idx]) { btns[idx].click(); return true; }
        return false;
    }""", step_index)
    if not opened:
        print(f"       ⚠ Could not find Select button — skipping")
        return products

    # Wait for the modal to populate with product cards
    try:
        await page.wait_for_selector(
            "#woopb-modal .woopb-modal-product",
            state="attached",
            timeout=ACTION_TIMEOUT,
        )
        # Small extra settle time for AJAX to finish
        try:
            await page.wait_for_load_state("networkidle", timeout=10_000)
        except PwTimeout:
            pass
    except PwTimeout:
        print(f"       ⚠ No products loaded for {category_name} — skipping")
        return products

    # ── Paginate ──────────────────────────────────────────────────────────
    current_page = 1
    while True:
        batch = await extract_products_from_page(page)
        products.extend(batch)
        print(f"       Page {current_page}: {len(batch)} products")

        # Check if a next page exists (via JS to avoid interception issues)
        next_page_id = current_page + 1
        has_next = await page.evaluate("""(nextId) => {
            const el = document.querySelector(
                `.woopb-step-pagination .woopb-page-item[data-page_id="${nextId}"]`
            );
            if (el) { el.click(); return true; }
            return false;
        }""", next_page_id)
        if not has_next:
            break  # no more pages

        # Wait for the AJAX response to replace products
        await page.wait_for_timeout(1200)
        try:
            await page.wait_for_load_state("networkidle", timeout=10_000)
        except PwTimeout:
            pass  # proceed anyway — data may already be ready
        current_page += 1

    print(f"       ✓ Total: {len(products)} products")
    return products


async def main():
    t0 = time.perf_counter()
    all_data: dict[str, list[dict]] = {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080},
        )
        page = await context.new_page()
        page.set_default_timeout(ACTION_TIMEOUT)

        # ── Navigate & wait for the builder shell ─────────────────────────
        print(f"Navigating to {TARGET_URL} …")
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await page.wait_for_selector(".woopb-step", state="attached", timeout=NAV_TIMEOUT)
        print("Builder interface loaded.\n")

        # ── Discover categories ───────────────────────────────────────────
        categories = await page.evaluate("""() => {
            const steps = document.querySelectorAll('.woopb-step');
            return [...steps].map(s => {
                const title = s.querySelector('.woopb-step-title');
                return title ? title.textContent.trim().replace(/^Select\\s*/i, '') : 'Unknown';
            });
        }""")
        print(f"Found {len(categories)} categories: {', '.join(categories)}\n")

        # ── Iterate through each category ─────────────────────────────────
        for idx, cat_name in enumerate(categories):
            products = await scrape_category(page, idx, cat_name)

            # Clean prices and attach category
            cleaned = []
            for p in products:
                cleaned.append({
                    "category": cat_name,
                    "name": p["name"],
                    "price": clean_price(p["displayPrice"]),
                    "original_price": clean_price(p["originalPrice"]),
                    "stock_status": p["stockStatus"],
                    "url": p["url"],
                })
            all_data[cat_name] = cleaned

        await browser.close()

    # ── Export JSON ────────────────────────────────────────────────────────
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    total = sum(len(v) for v in all_data.values())
    print(f"\n{'='*60}")
    print(f"Scraped {total} products across {len(all_data)} categories")
    print(f"JSON → {OUTPUT_JSON.resolve()}")

    # ── Export CSV (flat) ─────────────────────────────────────────────────
    if pd is not None:
        rows = [item for items in all_data.values() for item in items]
        df = pd.DataFrame(rows)
        df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
        print(f"CSV  → {OUTPUT_CSV.resolve()}")

    elapsed = time.perf_counter() - t0
    print(f"Done in {elapsed:.1f}s")


if __name__ == "__main__":
    asyncio.run(main())
