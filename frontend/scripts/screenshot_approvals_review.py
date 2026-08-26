"""
screenshot_approvals_review.py - 验证审批工作台 REVIEW tab 显示 2 条
"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900}, locale="zh-CN")
        page = await context.new_page()

        # API login
        resp = await page.request.post(
            "http://127.0.0.1:4000/api/auth/login",
            data={"email": "frank@datawhale.cn", "password": "datawhale123"},
            headers={"Content-Type": "application/json"},
        )
        body = await resp.json()
        token, user = body["data"]["token"], body["data"]["user"]

        # 先访问一次获取 origin，再写 localStorage
        await page.goto("http://127.0.0.1:5173/", wait_until="domcontentloaded")
        await page.evaluate(
            "([t,u]) => localStorage.setItem('datawhale-auth', JSON.stringify({state:{token:t,user:u},version:0}))",
            [token, user],
        )

        # 进审批工作台
        await page.goto("http://127.0.0.1:5173/admin/approvals", wait_until="networkidle")
        await asyncio.sleep(2.0)

        # 点 "复审 (2)" tab
        await page.click("text=复审")
        await asyncio.sleep(1.5)

        out = r"C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\real_v1.2\12_admin_approvals_review.png"
        await page.screenshot(path=out, full_page=True)
        print(f"[shot] {out}")

        await browser.close()

asyncio.run(main())
