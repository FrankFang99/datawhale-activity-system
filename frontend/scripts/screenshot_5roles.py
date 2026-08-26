"""
Datawhale v1.2 完整截图脚本（Frank 本地真飞书 Base）
- 5 角色分别登录拍活动大厅
- 各角色拍 1-2 个核心页面（审批 / 任务 / 报销 / 报名 / 个人）
- 5 角色 × 2 张（Landing + 1 核心页） = 10 张
- 输出：data/screenshots/2026-08-25_real/
- 依赖：playwright（已装）+ chromium

用法：
  # 先起 vite dev + backend
  cd D:\Learning\AI\Datawhale\frontend && npx vite &
  cd D:\Learning\AI\Datawhale\backend && npx tsx watch src/index.ts &
  # 跑截图
  python scripts/screenshot_5roles.py
"""

import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

# dev 模式 base = '/'（v1.2 改了 vite.config.ts）
FRONTEND = "http://127.0.0.1:5173"
OUT_DIR = Path(r"C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\real_v1.2")
VIEWPORT = {"width": 1440, "height": 900}

# 5 角色测试账号（v1 临时约束：全 Frank 一人，密码统一 datawhale123）
ACCOUNTS = [
    ("ADMIN",       "frank@datawhale.cn",   "/admin/approvals"),     # 审批工作台
    ("OPERATOR",    "operator@x.cn",         "/admin/approvals"),     # 审批工作台
    ("VOLUNTEER",   "volunteer@x.cn",        "/volunteer/workbench"),# 我对接的申请
    ("ORGANIZER",   "org-thu@x.cn",          "/my-applications"),    # 我的申请
    ("PARTICIPANT", "participant1@x.cn",     "/my-registrations"),   # 我的报名
]

PASSWORD = "datawhale123"

async def login_via_api(page, email: str):
    """绕过 UI：直接打 /api/auth/login，拿到 token 后写 localStorage，再 reload。
    比走 UI 表单快 + 稳 + 不受 React 异步 hydrate 影响。"""
    try:
        resp = await page.request.post(
            f"http://127.0.0.1:4000/api/auth/login",
            data={"email": email, "password": PASSWORD},
            headers={"Content-Type": "application/json"},
        )
        body = await resp.json()
        if body.get("code") != 0:
            raise Exception(f"login failed: {body}")
        token = body["data"]["token"]
        user = body["data"]["user"]
        # zustand persist 期望的格式
        await page.evaluate(f"""([token, user]) => {{
            localStorage.setItem('datawhale-auth', JSON.stringify({{
                state: {{ token: token, user: user }},
                version: 0
            }}));
        }}""", [token, user])
    except Exception as e:
        print(f"  [WARN] API login failed: {e}, fallback to UI")
        # fallback: 走 UI
        await page.goto(f"{FRONTEND}/login", wait_until="networkidle", timeout=20000)
        await asyncio.sleep(0.5)
        await page.fill('input[type="email"], input[autocomplete="email"]', email)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle", timeout=15000)
        await asyncio.sleep(1.0)

async def logout(page):
    await page.evaluate("() => { localStorage.removeItem('datawhale-auth'); }")
    await page.evaluate("() => { localStorage.removeItem('datawhale-theme'); }")

async def shoot(page, name: str):
    out = OUT_DIR / f"{name}.png"
    await page.screenshot(path=str(out), full_page=True)
    print(f"  [shot] {out.name}")

async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[OUT] {OUT_DIR}")
    print(f"[URL] {FRONTEND}")
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport=VIEWPORT, locale="zh-CN")
        page = await context.new_page()

        # ===== 1. 公开页（未登录） =====
        print("[PAGE] 01 Login light")
        await page.goto(f"{FRONTEND}/login", wait_until="networkidle")
        await asyncio.sleep(1.0)
        await shoot(page, "01_login")

        print("[PAGE] 02 Register light")
        await page.goto(f"{FRONTEND}/register", wait_until="networkidle")
        await asyncio.sleep(1.0)
        await shoot(page, "02_register")

        # ===== 2. 5 角色 Landing + 核心页 =====
        for role, email, core_path in ACCOUNTS:
            print(f"\n[ROLE] {role} ({email})")
            await login_via_api(page, email)
            # 拍 Landing
            await page.goto(f"{FRONTEND}/", wait_until="networkidle", timeout=20000)
            await asyncio.sleep(2.5)  # 等 zustand hydrate + 数据 + AI 浮窗
            await shoot(page, f"10_{role.lower()}_landing")

            # 截该角色核心工作页
            if core_path:
                await page.goto(f"{FRONTEND}{core_path}", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(2.5)
                page_name = core_path.strip("/").replace("/", "_") or "home"
                await shoot(page, f"11_{role.lower()}_{page_name}")
            await logout(page)

        # ===== 3. 暗色模式 Landing（ADMIN） =====
        print("\n[DARK] ADMIN dark mode")
        await page.evaluate("""() => {
            localStorage.setItem('datawhale-theme', JSON.stringify({
                state: { mode: 'dark' },
                version: 0
            }));
        }""")
        await login_via_api(page, "frank@datawhale.cn")
        await page.goto(f"{FRONTEND}/", wait_until="networkidle", timeout=20000)
        await asyncio.sleep(2.5)
        await shoot(page, "20_admin_dark_landing")

        # ===== 4. 404 =====
        print("\n[404] 404 page (light)")
        await page.evaluate("() => { document.documentElement.dataset.theme = 'light'; }")
        await page.goto(f"{FRONTEND}/this-does-not-exist", wait_until="networkidle")
        await asyncio.sleep(1.0)
        await shoot(page, "30_404")

        await browser.close()

    n = len(list(OUT_DIR.glob("*.png")))
    print(f"\n[DONE] {OUT_DIR} ({n} png)")

if __name__ == "__main__":
    asyncio.run(main())
