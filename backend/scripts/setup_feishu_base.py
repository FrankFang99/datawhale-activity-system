#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
建飞书个人版 Base + 业务表（切片 1 必需）

依赖：
- lark-cli 1.0.88+（已升级）
- lark-cli auth status = ready（个人版 user access token）

用法：
  python setup_feishu_base.py            # 建 base（若不存在）+ 3 张切片 1 表
  python setup_feishu_base.py --rebuild  # 删掉 test base 重建
  python setup_feishu_base.py --base <base_token>  # 用已存在的 base_token

输出：打印 base_token + 各 table_id，保存到 backend/.env
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

BASE_TOKEN_FILE = Path(__file__).parent.parent / ".feishu_base.json"
ENV_FILE = Path(__file__).parent.parent / ".env"

# 找 lark-cli 真实入口（Windows 是 .ps1 + node 直调）
_LARK_BIN = shutil.which("lark-cli")
_LARK_NODE_RUNNER = None
if _LARK_BIN:
    # 找 .ps1 入口
    _ps1 = _LARK_BIN
    for ext in (".CMD", ".cmd", ".EXE", ".exe", ""):
        cand = _LARK_BIN[:-len(ext)] if ext else _LARK_BIN
        if Path(cand + ".ps1").exists():
            _ps1 = cand + ".ps1"
            break
    if Path(_ps1).exists() and _ps1.endswith(".ps1"):
        basedir = Path(_ps1).parent
        # node 在同目录
        node_exe = str(basedir / "node.exe")
        if not Path(node_exe).exists():
            node_exe = "node"  # fallback PATH
        run_js = str(basedir / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
        if Path(run_js).exists():
            _LARK_NODE_RUNNER = (node_exe, run_js)


def run_lark(args: list, check_ok: bool = True) -> dict:
    """运行 lark-cli，捕获 stdout/stderr，返回解析后的 JSON"""
    if _LARK_NODE_RUNNER:
        cmd = [*_LARK_NODE_RUNNER, *args]
    else:
        cmd = ["lark-cli", *args]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    out = proc.stdout
    if proc.returncode != 0:
        # 即使 returncode != 0，stdout 也可能有有效 JSON（lark-cli 习惯）
        try:
            data = json.loads(out)
            if check_ok and not data.get("ok", False):
                raise RuntimeError(f"lark-cli failed: {data.get('error', {})}")
            return data
        except json.JSONDecodeError:
            raise RuntimeError(
                f"lark-cli exit={proc.returncode} stderr={proc.stderr[:500]} stdout={out[:500]}"
            )
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"ok": True, "raw": out}


# ============== 表字段定义 ==============

USERS_FIELDS = [
    {"name": "userId", "type": "auto_number"},
    {"name": "email", "type": "text", "style": {"type": "email"}, "description": "登录邮箱，唯一"},
    {"name": "phone", "type": "text", "style": {"type": "phone"}},
    {"name": "passwordHash", "type": "text", "description": "bcrypt 哈希"},
    {"name": "name", "type": "text", "description": "姓名 1-20 字符"},
    {"name": "role", "type": "select", "options": [
        {"name": "ADMIN", "hue": "Red"},
        {"name": "OPERATOR", "hue": "Orange"},
        {"name": "VOLUNTEER", "hue": "Blue"},
        {"name": "ORGANIZER", "hue": "Green"},
        {"name": "ASSISTANT", "hue": "Purple"},
    ], "description": "v1 测试模式 Frank 一人 4 角色"},
    {"name": "province", "type": "text"},
    {"name": "city", "type": "text"},
    {"name": "school", "type": "text"},
    {"name": "creditScore", "type": "number", "style": {"type": "plain", "precision": 0}, "description": "信用分默认 100"},
    {"name": "status", "type": "select", "options": [
        {"name": "ACTIVE", "hue": "Green"},
        {"name": "DISABLED", "hue": "Gray"},
    ]},
    {"name": "isExternalUser", "type": "checkbox", "description": "v1 测试模式全部为 true"},
    {"name": "lastLoginAt", "type": "datetime"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]

STAGE_TASKS_FIELDS = [
    {"name": "taskId", "type": "auto_number"},
    {"name": "applicationId", "type": "text", "description": "关联申请（v1 文本，v2 改 link）"},
    {"name": "stage", "type": "select", "options": [
        {"name": "INTENT", "hue": "Blue"},
        {"name": "RECRUIT", "hue": "Carmine"},
        {"name": "PREPARE", "hue": "Wathet"},
        {"name": "EXECUTE", "hue": "Green"},
        {"name": "REVIEW", "hue": "Purple"},
    ]},
    {"name": "title", "type": "text"},
    {"name": "description", "type": "text"},
    {"name": "status", "type": "select", "options": [
        {"name": "PENDING", "hue": "Gray"},
        {"name": "IN_PROGRESS", "hue": "Blue"},
        {"name": "COMPLETED", "hue": "Green"},
        {"name": "OVERDUE", "hue": "Red"},
    ], "description": "v4 修订：5 阶段统一用 PENDING/IN_PROGRESS/COMPLETED/OVERDUE"},
    {"name": "assigneeId", "type": "text", "description": "负责人（v1 文本）"},
    {"name": "dueDate", "type": "datetime"},
    {"name": "completedAt", "type": "datetime"},
    {"name": "proofFile", "type": "text", "description": "凭证 URL（v1 文本占位，v2 改 attachment）"},
    {"name": "remark", "type": "text"},
    {"name": "submittedAt", "type": "datetime", "description": "v3 新增：组织者提交时间"},
    {"name": "reviewerId", "type": "text", "description": "v3 新增：志愿者审核人"},
    {"name": "reviewStatus", "type": "select", "options": [
        {"name": "PENDING", "hue": "Gray"},
        {"name": "APPROVED", "hue": "Green"},
        {"name": "REJECTED", "hue": "Red"},
    ], "description": "v3 新增：志愿者审核状态"},
    {"name": "reviewRemark", "type": "text", "description": "v3 新增：审核意见/打回原因"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]

ACTIVITIES_FIELDS = [
    {"name": "activityId", "type": "auto_number"},
    {"name": "title", "type": "text"},
    {"name": "description", "type": "text"},
    {"name": "coverImage", "type": "text", "description": "封面图 URL（v1 用占位图）"},
    {"name": "status", "type": "select", "options": [
        {"name": "DRAFT", "hue": "Gray"},
        {"name": "PUBLISHED", "hue": "Blue"},
        {"name": "ONGOING", "hue": "Green"},
        {"name": "COMPLETED", "hue": "Wathet"},
        {"name": "ARCHIVED", "hue": "Gray"},
    ]},
    {"name": "startDate", "type": "datetime"},
    {"name": "endDate", "type": "datetime"},
    {"name": "location", "type": "text"},
    {"name": "maxParticipants", "type": "number", "style": {"type": "plain", "precision": 0}},
    {"name": "requirements", "type": "text"},
    {"name": "createdAt", "type": "created_at"},
]

APPLICATIONS_FIELDS = [
    {"name": "applicationId", "type": "auto_number"},
    {"name": "applicationNo", "type": "text", "description": "申请编号 APP-2026-001 唯一"},
    {"name": "activityId", "type": "text", "description": "关联活动（v1 用 activityId 文本，v2 改 link 字段）"},
    {"name": "userId", "type": "text", "description": "关联用户（同上）"},
    {"name": "organizerName", "type": "text"},
    {"name": "organizerPhone", "type": "text", "style": {"type": "phone"}},
    {"name": "organizerEmail", "type": "text", "style": {"type": "email"}},
    {"name": "expectedDate", "type": "datetime"},
    {"name": "location", "type": "text"},
    {"name": "motivation", "type": "text", "description": "申请动机（≤500 字符）→ RC-005"},
    {"name": "experience", "type": "text", "description": "历史经验（≤500 字符）→ RC-003"},
    {"name": "participantValue", "type": "text", "description": "参与者价值（≤500 字符）→ RC-005 辅助"},
    {"name": "venueStatus", "type": "select", "options": [
        {"name": "已确定", "hue": "Green"},
        {"name": "有潜在", "hue": "Yellow"},
        {"name": "暂无", "hue": "Red"},
    ], "description": "RC-001"},
    {"name": "recruitChannel", "type": "select", "multiple": True, "options": [
        {"name": "社群", "hue": "Blue"},
        {"name": "公众号", "hue": "Blue"},
        {"name": "高校社团", "hue": "Blue"},
        {"name": "企业园区", "hue": "Blue"},
        {"name": "暂无", "hue": "Gray"},
    ], "description": "RC-002"},
    {"name": "status", "type": "select", "options": [
        {"name": "DRAFT", "hue": "Gray"},
        {"name": "SUBMITTED", "hue": "Blue"},
        {"name": "SCREENING", "hue": "Yellow"},
        {"name": "CONFIRMED", "hue": "Green"},
        {"name": "PREPARING", "hue": "Wathet"},
        {"name": "READY", "hue": "Turquoise"},
        {"name": "RUNNING", "hue": "Lime"},
        {"name": "REVIEWING", "hue": "Purple"},
        {"name": "REVIEW_CONFIRMED", "hue": "Purple"},
        {"name": "COMPLETED", "hue": "Green"},
        {"name": "REJECTED", "hue": "Red"},
        {"name": "CANCELLED", "hue": "Gray"},
    ]},
    {"name": "score", "type": "number", "style": {"type": "plain", "precision": 1}, "description": "AI 评分 0-100，-1 待补评"},
    {"name": "grade", "type": "select", "options": [
        {"name": "S", "hue": "Orange"},
        {"name": "A", "hue": "Green"},
        {"name": "B", "hue": "Blue"},
        {"name": "C", "hue": "Yellow"},
        {"name": "D", "hue": "Red"},
    ]},
    {"name": "scoreBreakdown", "type": "text", "description": "JSON 评分明细（5 维）"},
    {"name": "scoreDetails", "type": "text", "description": "JSON 评分理由"},
    {"name": "volunteerId", "type": "text"},
    {"name": "assignedAt", "type": "datetime"},
    {"name": "submittedAt", "type": "datetime"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]


def create_base() -> str:
    """建新 base，返回 base_token"""
    print(">> 创建飞书 Base ...")
    data = run_lark([
        "base", "+base-create",
        "--name", "Datawhale 高校活动管理系统 v1",
        "--time-zone", "Asia/Shanghai",
        "--as", "user",
    ])
    base_token = data["data"]["base"]["base_token"]
    url = data["data"]["base"]["url"]
    print(f"   ✓ base_token = {base_token}")
    print(f"   ✓ url = {url}")
    return base_token


def create_table(base_token: str, table_name: str, fields: list) -> str:
    """建表（带字段），返回 table_id"""
    print(f">> 建表 {table_name} ...")
    fields_json = json.dumps(fields, ensure_ascii=False)
    data = run_lark([
        "base", "+table-create",
        "--base-token", base_token,
        "--name", table_name,
        "--fields", fields_json,
        "--as", "user",
    ])
    # lark-cli 1.0.88 返回结构：data.table.id / data.table_id
    table_id = (
        data.get("data", {}).get("table", {}).get("id")
        or data.get("data", {}).get("table", {}).get("table_id")
        or data.get("data", {}).get("table_id")
    )
    print(f"   ✓ {table_name} = {table_id}")
    return table_id


def main():
    # 解析参数
    base_token = None
    rebuild = False
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--rebuild":
            rebuild = True
        elif a == "--base" and i + 1 < len(args):
            base_token = args[i + 1]
            i += 1
        i += 1

    # 1. 决定 base_token
    if base_token is None and BASE_TOKEN_FILE.exists():
        info = json.loads(BASE_TOKEN_FILE.read_text(encoding="utf-8"))
        if not rebuild:
            base_token = info.get("base_token")
            print(f">> 复用已记录的 base_token = {base_token}")
        else:
            print(">> --rebuild：忽略旧 base_token，新建")

    if base_token is None:
        base_token = create_base()
    else:
        print(f">> 用已存在 base_token = {base_token}")

    # 2. 列出当前 base 的表，避免重复建
    print(">> 检查已存在的表 ...")
    list_data = run_lark([
        "base", "+table-list",
        "--base-token", base_token,
        "--as", "user",
    ])
    # lark-cli 1.0.88 返回结构：data.tables[].id / .name
    existing = {}
    for t in list_data.get("data", {}).get("tables", []):
        existing[t["name"]] = t["id"]
    # 也兼容 items 结构
    for t in list_data.get("data", {}).get("items", []):
        existing[t.get("name")] = t.get("table_id") or t.get("id")
    print(f"   已存在 {len(existing)} 张表：{list(existing.keys())}")

    # 3. 建业务表（切片 1-4 必需）
    tables = {
        "dw_users": USERS_FIELDS,
        "dw_activities": ACTIVITIES_FIELDS,
        "dw_applications": APPLICATIONS_FIELDS,
        "dw_stage_tasks": STAGE_TASKS_FIELDS,
    }
    result = {"base_token": base_token, "tables": {}}
    for name, fields in tables.items():
        if name in existing and not rebuild:
            print(f">> 表 {name} 已存在（id={existing[name]}），跳过")
            result["tables"][name] = existing[name]
            continue
        result["tables"][name] = create_table(base_token, name, fields)

    # 4. 保存 base_token + table_ids
    BASE_TOKEN_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n✅ 已保存到 {BASE_TOKEN_FILE}")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 5. 追加到 .env
    env_lines = [
        "",
        "# ===== 飞书 Base（自动生成） =====",
        f"FEISHU_BASE_TOKEN={result['base_token']}",
    ]
    for table_name, table_id in result["tables"].items():
        env_key = f"FEISHU_TABLE_{table_name.upper().replace('DW_', '')}"
        env_lines.append(f"{env_key}={table_id}")

    if not ENV_FILE.exists():
        ENV_FILE.write_text("\n".join(env_lines), encoding="utf-8")
        print(f"✅ 已创建 {ENV_FILE}")
    else:
        # 追加（先删旧 block）
        content = ENV_FILE.read_text(encoding="utf-8")
        # 移除旧的 base 块
        import re
        content = re.sub(
            r"\n# ===== 飞书 Base（自动生成） =====.*?(?=\n# ====|\Z)",
            "",
            content,
            flags=re.DOTALL,
        )
        content = content.rstrip() + "\n" + "\n".join(env_lines) + "\n"
        ENV_FILE.write_text(content, encoding="utf-8")
        print(f"✅ 已更新 {ENV_FILE}")


if __name__ == "__main__":
    main()
