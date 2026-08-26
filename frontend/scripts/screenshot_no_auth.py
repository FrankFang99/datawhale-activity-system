"""
无后端截图脚本（v1.2 引入）
- 起 vite dev server 后跑（不需要 backend）
- 截 Login / Register / 404（这 3 个不依赖后端）
- 5 角色 Landing 截图：需 backend 跑通后跑 screenshot_5roles.py
- 输出到 data/screenshots/2026-08-25_ui_v1.2/
"""

import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

FRONTEND = "http://127.0.0.1:5173/activity"
OUT_DIR = Path(r"C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\v1.2_ui")
VIEWPORT = {"width": 1440, "height": 900}

PAGES = [
    ("01_login",   "/login"),
    ("02_register", "/register"),
    ("03_404",     "/this-does-not-exist"),
]

THEMES = ["light", "dark"]

async def shoot(page, name: str, theme: str):
    # 关键：通过 localStorage 写 zustand persist，再 reload 让 React 读到
    await page.evaluate(f"""() => {{
        localStorage.setItem('datawhale-theme', JSON.stringify({{
            state: {{ mode: '{theme}' }},
            version: 0
        }}));
    }}""")
    # 同步切 data-theme（不依赖 JS）
    await page.evaluate(f"() => {{ document.documentElement.dataset.theme = '{theme}'; }}")
    # reload 让 zustand persist 重新读
    await page.reload(wait_until="networkidle")
    await asyncio.sleep(1.0)
    out = OUT_DIR / f"{name}_{theme}.png"
    await page.screenshot(path=str(out), full_page=True)
    print(f"  [shot] {out.name}")

async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[OUT] {OUT_DIR}")
    print(f"[URL] {FRONTEND}\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport=VIEWPORT, locale="zh-CN")
        page = await context.new_page()

        for name, path in PAGES:
            print(f"[PAGE] {name} ({path})")
            await page.goto(f"{FRONTEND}{path}", wait_until="networkidle", timeout=20000)
            await asyncio.sleep(1.0)
            for theme in THEMES:
                await shoot(page, name, theme)
            print()

        await browser.close()

    n = len(list(OUT_DIR.glob("*.png")))
    print(f"\n[DONE] {OUT_DIR} ({n} png)")

if __name__ == "__main__":
    asyncio.run(main())
