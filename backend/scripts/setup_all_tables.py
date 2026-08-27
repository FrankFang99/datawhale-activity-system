#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键建 v1 全部 10 张业务表（Datawhale IT 生产环境部署用）

特点：
- 动态定位 lark-cli（不依赖 Windows / 个人版硬编码路径）
- 从环境变量 / CLI 参数读 base_token（生产环境用企业版 base）
- 已有表自动跳过（幂等）
- 建完自动写 backend/.env

用法：
  # 1) 先 lark-cli auth login（已登录则跳过）
  lark-cli auth status

  # 2) 准备 base_token
  #    新建企业版 Base：在飞书后台建一个空 Base，复制 URL 里的 base_token（bascnXXXX 开头）
  #    或迁移个人版 Base：lark-cli base +list 找 base_token

  # 3) 跑本脚本
  python3 setup_all_tables.py --base-token bascnXXXXXXXX

  # 可选：指定 env 文件路径（默认 backend/.env）
  python3 setup_all_tables.py --base-token bascnXXX --env-file /opt/datawhale/backend/.env

幂等：表已存在会跳过，写 .env 时只更新 FEISHU_TABLE_* 字段，其他保留。

⚠️ 与 setup_feishu_base.py 的关系：
- setup_feishu_base.py：仅建 4 张表（dw_users/activities/applications/stage_tasks）
- 本脚本：建全部 10 张表（包含上 4 + reimbursements/chat_logs/participants/interests/messages/materials）
- 生产环境推荐用本脚本
- setup_feishu_base.py 保留用于 Frank dev（个人版兼容）
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# ============== lark-cli 动态定位 ==============

def find_lark_runner():
    """动态定位 lark-cli 的 node runner（不依赖硬编码路径）

    Returns:
        tuple(node_exe, run_js_path) 或 None
    """
    lark_bin = shutil.which("lark-cli")
    if not lark_bin:
        print("❌ lark-cli 未安装，请先: npm install -g @larksuite/cli")
        return None

    # Windows: lark-cli 是 .cmd / .ps1，需要找同目录的 node.exe + run.js
    if sys.platform == "win32":
        for ext in (".CMD", ".cmd", ".EXE", ".exe", ""):
            cand = lark_bin[:-len(ext)] if ext else lark_bin
            if Path(cand + ".ps1").exists():
                ps1 = cand + ".ps1"
                basedir = Path(ps1).parent
                node_exe = str(basedir / "node.exe")
                if not Path(node_exe).exists():
                    node_exe = "node"
                run_js = str(basedir / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
                if Path(run_js).exists():
                    return (node_exe, run_js)
    else:
        # Linux/Mac: lark-cli 是 shell 脚本，node 走 PATH
        lark_dir = Path(lark_bin).resolve().parent
        node_exe = "node"
        run_js = str(lark_dir.parent / "lib" / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
        if not Path(run_js).exists():
            # 备用：npm global 路径
            run_js = str(lark_dir.parent / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
        if Path(run_js).exists():
            return (node_exe, run_js)
    return None


LARK_RUNNER = find_lark_runner()
if not LARK_RUNNER:
    print("❌ 无法定位 lark-cli node runner，请确认 @larksuite/cli ≥ 1.0.88 已安装")
    sys.exit(1)


def run_lark(args, check_ok=True):
    """调 lark-cli，解析 stdout JSON"""
    cmd = list(LARK_RUNNER) + args
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    out = proc.stdout
    if proc.returncode != 0:
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


# ============== 表字段定义（合并 setup_feishu_base + 4 create_*.py + 2 新增）==============

# ----- dw_users -----
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
    ], "description": "5 角色"},
    {"name": "province", "type": "text"},
    {"name": "city", "type": "text"},
    {"name": "school", "type": "text"},
    {"name": "creditScore", "type": "number", "style": {"type": "plain", "precision": 0}, "description": "信用分默认 100"},
    {"name": "status", "type": "select", "options": [
        {"name": "ACTIVE", "hue": "Green"},
        {"name": "DISABLED", "hue": "Gray"},
    ]},
    {"name": "isExternalUser", "type": "checkbox", "description": "是否外部用户"},
    {"name": "lastLoginAt", "type": "datetime"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]

# ----- dw_activities -----
ACTIVITIES_FIELDS = [
    {"name": "activityId", "type": "auto_number"},
    {"name": "title", "type": "text"},
    {"name": "description", "type": "text"},
    {"name": "coverImage", "type": "text", "description": "封面图 URL"},
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
    {"name": "series", "type": "text", "description": "活动系列名"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]

# ----- dw_applications -----
APPLICATIONS_FIELDS = [
    {"name": "applicationId", "type": "auto_number"},
    {"name": "applicationNo", "type": "text", "description": "业务编号 NO.XXX"},
    {"name": "activityId", "type": "text", "description": "关联活动 ID"},
    {"name": "userId", "type": "text"},
    {"name": "userName", "type": "text"},
    {"name": "status", "type": "select", "options": [
        {"name": "DRAFT", "hue": "Gray"},
        {"name": "SUBMITTED", "hue": "Blue"},
        {"name": "SCREENING", "hue": "Wathet"},
        {"name": "CONFIRMED", "hue": "Green"},
        {"name": "REJECTED", "hue": "Red"},
    ]},
    {"name": "applicantRole", "type": "select", "options": [
        {"name": "PRIMARY", "hue": "Green"},
        {"name": "ASSISTANT", "hue": "Purple"},
    ], "description": "PRIMARY = 主组织者；ASSISTANT = 助教"},
    {"name": "organizerName", "type": "text"},
    {"name": "organizerPhone", "type": "text", "style": {"type": "phone"}},
    {"name": "organizerEmail", "type": "text", "style": {"type": "email"}},
    {"name": "expectedDate", "type": "datetime"},
    # v1.2 Frank 27 09:49 反馈：申请时就要具体时间段 + 精确地址
    # CONFIRMED 时升级到活动表的 startTime/endTime/confirmedAddress
    {"name": "expectedStartTime", "type": "text", "description": "预计开始时间 HH:mm"},
    {"name": "expectedEndTime", "type": "text", "description": "预计结束时间 HH:mm"},
    {"name": "confirmedAddress", "type": "text", "description": "精确地址（楼/层/房间）"},
    {"name": "location", "type": "text"},
    {"name": "motivation", "type": "text", "description": "活动动机"},
    {"name": "participantValue", "type": "text", "description": "对参与者的价值"},
    {"name": "experience", "type": "text", "description": "过往组织经验"},
    {"name": "venueStatus", "type": "text", "description": "场地状态（已确认/待确认/无）"},
    {"name": "recruitChannel", "type": "text", "description": "招募渠道（多选 JSON 数组）"},
    {"name": "score", "type": "number", "style": {"type": "plain", "precision": 1}},
    {"name": "grade", "type": "select", "options": [
        {"name": "S", "hue": "Green"},
        {"name": "A", "hue": "Blue"},
        {"name": "B", "hue": "Wathet"},
        {"name": "C", "hue": "Orange"},
        {"name": "D", "hue": "Red"},
    ]},
    {"name": "scoreDetails", "type": "text", "description": "5 维评分 JSON"},
    {"name": "auditLog", "type": "text", "description": "审批日志 JSON"},
    {"name": "volunteerId", "type": "text"},
    {"name": "volunteerName", "type": "text"},
    {"name": "submittedAt", "type": "datetime"},
    {"name": "reviewedAt", "type": "datetime"},
    {"name": "reviewerId", "type": "text"},
    {"name": "reviewRemark", "type": "text"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]

# ----- dw_stage_tasks -----
STAGE_TASKS_FIELDS = [
    {"name": "taskId", "type": "auto_number"},
    {"name": "applicationId", "type": "text", "description": "关联申请"},
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
    ]},
    {"name": "assigneeId", "type": "text"},
    {"name": "dueDate", "type": "datetime"},
    {"name": "completedAt", "type": "datetime"},
    {"name": "proofFile", "type": "text", "description": "凭证 URL"},
    {"name": "remark", "type": "text"},
    {"name": "submittedAt", "type": "datetime"},
    {"name": "reviewerId", "type": "text"},
    {"name": "reviewStatus", "type": "select", "options": [
        {"name": "PENDING", "hue": "Gray"},
        {"name": "APPROVED", "hue": "Green"},
        {"name": "REJECTED", "hue": "Red"},
    ]},
    {"name": "reviewRemark", "type": "text"},
    {"name": "createdAt", "type": "created_at"},
    {"name": "updatedAt", "type": "updated_at"},
]

# ----- dw_reimbursements -----
REIMBURSEMENTS_FIELDS = [
    {"name": "reimbursementId", "type": "auto_number"},
    {"name": "applicationId", "type": "text", "description": "关联申请 ID（如 NO.001）"},
    {"name": "amount", "type": "number", "style": {"type": "plain", "precision": 2, "thousands_separator": True}, "description": "报销金额（元，1-10000）"},
    {"name": "description", "type": "text", "description": "报销事由"},
    {"name": "receipts", "type": "text", "description": "发票 URL 列表 JSON 数组"},
    {"name": "status", "type": "select", "options": [
        {"name": "DRAFT", "hue": "Gray"},
        {"name": "SUBMITTED", "hue": "Blue"},
        {"name": "APPROVED", "hue": "Green"},
        {"name": "REJECTED", "hue": "Red"},
        {"name": "PAID", "hue": "Purple"},
    ]},
    {"name": "submittedAt", "type": "datetime"},
    {"name": "reviewedAt", "type": "datetime"},
    {"name": "reviewerId", "type": "text"},
    {"name": "reviewRemark", "type": "text"},
    {"name": "paidAt", "type": "datetime"},
    {"name": "paidBy", "type": "text"},
    {"name": "paymentRef", "type": "text", "description": "打款流水号"},
    {"name": "organizerId", "type": "text"},
    {"name": "organizerName", "type": "text"},
]

# ----- dw_chat_logs -----
CHAT_LOGS_FIELDS = [
    {"name": "logId", "type": "text", "description": "日志 ID"},
    {"name": "question", "type": "text", "description": "匹配到的标准问法"},
    {"name": "questionRaw", "type": "text", "description": "用户原始问题"},
    {"name": "matched", "type": "select", "options": [
        {"name": "Y", "hue": "Green"},
        {"name": "N", "hue": "Red"},
    ]},
    {"name": "faqId", "type": "text"},
    {"name": "confidence", "type": "number", "style": {"type": "plain", "precision": 2}},
    {"name": "userId", "type": "text"},
    {"name": "at", "type": "datetime"},
    {"name": "feedback", "type": "select", "options": [
        {"name": "UP", "hue": "Green"},
        {"name": "DOWN", "hue": "Red"},
    ]},
    {"name": "feedbackComment", "type": "text"},
]

# ----- dw_participants -----
PARTICIPANTS_FIELDS = [
    {"name": "participantId", "type": "text"},
    {"name": "activityId", "type": "text"},
    {"name": "userId", "type": "text"},
    {"name": "userName", "type": "text"},
    {"name": "email", "type": "text"},
    {"name": "phone", "type": "text"},
    {"name": "school", "type": "text"},
    {"name": "remark", "type": "text"},
    {"name": "status", "type": "select", "options": [
        {"name": "REGISTERED", "hue": "Blue"},
        {"name": "UNREGISTERED", "hue": "Gray"},
    ]},
    {"name": "registeredAt", "type": "datetime"},
    {"name": "cancelledAt", "type": "datetime"},
]

# ----- dw_interests -----
INTERESTS_FIELDS = [
    {"name": "interestId", "type": "text"},
    {"name": "schoolName", "type": "text"},
    {"name": "userId", "type": "text"},
    {"name": "userName", "type": "text"},
    {"name": "email", "type": "text", "style": {"type": "email"}},
    {"name": "phone", "type": "text", "style": {"type": "phone"}},
    {"name": "remark", "type": "text"},
    {"name": "status", "type": "select", "options": [
        {"name": "PENDING", "hue": "Gold"},
        {"name": "NOTIFIED", "hue": "Green"},
    ]},
    {"name": "createdAt", "type": "datetime"},
]

# ----- dw_messages（v1 站内消息，v2 飞书 IM） -----
MESSAGES_FIELDS = [
    {"name": "messageId", "type": "auto_number"},
    {"name": "userId", "type": "text", "description": "接收者 userId"},
    {"name": "userName", "type": "text"},
    {"name": "type", "type": "select", "options": [
        {"name": "APPLICATION_SUBMIT", "hue": "Blue"},
        {"name": "APPLICATION_APPROVE", "hue": "Green"},
        {"name": "APPLICATION_REJECT", "hue": "Red"},
        {"name": "REIMBURSEMENT_PAID", "hue": "Purple"},
        {"name": "STAGE_TASK", "hue": "Wathet"},
        {"name": "SYSTEM", "hue": "Gray"},
    ]},
    {"name": "title", "type": "text"},
    {"name": "content", "type": "text"},
    {"name": "link", "type": "text", "description": "跳转链接"},
    {"name": "read", "type": "checkbox"},
    {"name": "createdAt", "type": "datetime"},
]

# ----- dw_materials（v9 物料下载） -----
MATERIALS_FIELDS = [
    {"name": "materialId", "type": "auto_number"},
    {"name": "name", "type": "text", "description": "物料名称"},
    {"name": "category", "type": "select", "options": [
        {"name": "POSTER", "hue": "Blue"},
        {"name": "GUIDE", "hue": "Green"},
        {"name": "TEMPLATE", "hue": "Wathet"},
        {"name": "SLIDES", "hue": "Purple"},
        {"name": "VIDEO", "hue": "Carmine"},
        {"name": "OTHER", "hue": "Gray"},
    ]},
    {"name": "scope", "type": "select", "options": [
        {"name": "GLOBAL", "hue": "Blue"},
        {"name": "ACTIVITY", "hue": "Green"},
    ]},
    {"name": "activityId", "type": "text", "description": "scope=ACTIVITY 时必填"},
    {"name": "fileUrl", "type": "text"},
    {"name": "fileSize", "type": "number", "style": {"type": "plain", "precision": 0}},
    {"name": "description", "type": "text"},
    {"name": "uploadedBy", "type": "text"},
    {"name": "uploadedAt", "type": "datetime"},
]

# ============== 全部表清单 ==============

ALL_TABLES = {
    "dw_users": USERS_FIELDS,
    "dw_activities": ACTIVITIES_FIELDS,
    "dw_applications": APPLICATIONS_FIELDS,
    "dw_stage_tasks": STAGE_TASKS_FIELDS,
    "dw_reimbursements": REIMBURSEMENTS_FIELDS,
    "dw_chat_logs": CHAT_LOGS_FIELDS,
    "dw_participants": PARTICIPANTS_FIELDS,
    "dw_interests": INTERESTS_FIELDS,
    "dw_messages": MESSAGES_FIELDS,
    "dw_materials": MATERIALS_FIELDS,
}


# ============== 核心逻辑 ==============

def list_existing_tables(base_token):
    """列已存在的表（用于幂等判断）"""
    res = run_lark([
        "base", "+list-tables",
        "--base-token", base_token,
        "--as", "user",
        "--format", "json",
    ], check_ok=False)
    existing = {}
    if res and res.get("ok"):
        items = res.get("data", {}).get("items") or res.get("data", {}).get("tables") or []
        for t in items:
            existing[t.get("name")] = t.get("table_id") or t.get("id")
    return existing


def create_table(base_token, name, fields):
    """建表（带字段），返回 table_id"""
    res = run_lark([
        "base", "+table-create",
        "--base-token", base_token,
        "--name", name,
        "--fields", json.dumps(fields, ensure_ascii=False),
        "--as", "user",
        "--format", "json",
    ])
    table_id = res.get("data", {}).get("table", {}).get("id") or res.get("data", {}).get("table_id")
    return table_id


def update_env_file(env_path, base_token, table_ids):
    """更新 .env 文件（保留其他字段）"""
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8")
    else:
        content = "# ===== 服务配置（自动生成） =====\n"

    # 更新 FEISHU_BASE_TOKEN
    if "FEISHU_BASE_TOKEN=" in content:
        content = "\n".join(
            f"FEISHU_BASE_TOKEN={base_token}" if line.startswith("FEISHU_BASE_TOKEN=") else line
            for line in content.splitlines()
        )
    else:
        content += f"\nFEISHU_BASE_TOKEN={base_token}\n"

    # 更新 10 个 FEISHU_TABLE_*
    for table_name, table_id in table_ids.items():
        env_key = f"FEISHU_TABLE_{table_name.upper().replace('DW_', '')}"
        line_pattern = f"{env_key}="
        if line_pattern in content:
            content = "\n".join(
                f"{env_key}={table_id}" if line.startswith(line_pattern) else line
                for line in content.splitlines()
            )
        else:
            content += f"{env_key}={table_id}\n"

    env_path.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="一键建 v1 全部 10 张业务表（Datawhale IT 生产环境用）")
    parser.add_argument("--base-token", required=True, help="飞书 Base token（生产环境用企业版 bascnXXX）")
    parser.add_argument("--env-file", default=None, help="env 文件路径（默认 backend/.env）")
    parser.add_argument("--rebuild", action="store_true", help="重建（已存在表也建，会失败但跳过）")
    args = parser.parse_args()

    base_token = args.base_token
    if not base_token.startswith(("bascn", "T", "BAS")):
        print(f"⚠️  base_token 格式可能不对（生产环境应该 bascn 开头），继续尝试...")

    # env 文件路径
    if args.env_file:
        env_path = Path(args.env_file)
    else:
        env_path = Path(__file__).parent.parent / ".env"

    print(f"=== 一键建表（v1 全部 10 张表）===")
    print(f"base_token: {base_token}")
    print(f"env_file:   {env_path}")
    print(f"lark-cli:   {LARK_RUNNER[0]} + {LARK_RUNNER[1]}")
    print()

    # 1. 列已存在的表
    print("① 检查已存在的表...")
    existing = list_existing_tables(base_token)
    print(f"   已存在 {len(existing)} 张表：{list(existing.keys())}")
    print()

    # 2. 建 10 张表
    table_ids = {}
    success = 0
    skip = 0
    fail = 0
    for name, fields in ALL_TABLES.items():
        if name in existing and not args.rebuild:
            table_ids[name] = existing[name]
            print(f"   ⏭  {name} 已存在（id={existing[name]}）")
            skip += 1
            continue
        try:
            table_id = create_table(base_token, name, fields)
            if table_id:
                table_ids[name] = table_id
                print(f"   ✓  {name} = {table_id}（{len(fields)} 字段）")
                success += 1
            else:
                print(f"   ✗  {name} 建表失败")
                fail += 1
        except Exception as e:
            print(f"   ✗  {name} 异常: {e}")
            fail += 1

    print()
    print(f"建表结果：成功 {success} / 跳过 {skip} / 失败 {fail} / 总计 {len(ALL_TABLES)}")
    print()

    # 3. 写 .env
    if fail == 0 and len(table_ids) == len(ALL_TABLES):
        print("③ 写 .env...")
        update_env_file(env_path, base_token, table_ids)
        print(f"   ✓ 已写入 {env_path}")
        print()
        print("🎉 全部完成！10 张表 + .env 全部就绪。")
        print("   下一步：")
        print("   1) cd backend && npm ci --production")
        print("   2) npm run build && node dist/index.js")
        print("   3) 验证 GET /api/health")
        return 0
    else:
        print("⚠️  有建表失败，.env 未更新（避免写入不完整 ID）")
        print("   请检查错误后重跑（idempotent，已成功的会跳过）")
        return 1


if __name__ == "__main__":
    sys.exit(main())
