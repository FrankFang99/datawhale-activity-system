"""建 dw_reimbursements 表（切片 5）
通过 lark-cli +field-create 增量加字段，避免 1.0.88 schema 解析问题
"""
import json
import subprocess
import sys
from pathlib import Path

LARK_NODE = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node.exe"
LARK_RUN = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node_modules\@larksuite\cli\scripts\run.js"
BASE_TOKEN = "T3lJbRN7LaqdQqs3AlUchCxLnKb"

# 字段定义（v1 简化版）
# 顺序：先建表，再批量加字段
FIELDS = [
    # 1. applicationId 关联申请（auto_number 不可写，做成 text）
    {"type": "text", "name": "applicationId", "description": "关联申请 ID（如 NO.001）", "style": {"type": "plain"}},
    # 2. amount 金额
    {"type": "number", "name": "amount", "description": "报销金额（元，>0，≤10000）", "style": {"type": "plain", "precision": 2, "thousands_separator": True}},
    # 3. description 报销事由
    {"type": "text", "name": "description", "description": "报销事由", "style": {"type": "plain"}},
    # 4. receipts 发票/凭证 URL 列表（v1 简化为 text 存 JSON 数组，v2 可换 attachment）
    {"type": "text", "name": "receipts", "description": "发票 URL 列表 JSON 数组", "style": {"type": "plain"}},
    # 5. status 状态
    {"type": "select", "name": "status", "multiple": False, "options": [
        {"name": "DRAFT", "hue": "Gray", "lightness": "Lighter"},
        {"name": "SUBMITTED", "hue": "Blue", "lightness": "Lighter"},
        {"name": "APPROVED", "hue": "Green", "lightness": "Lighter"},
        {"name": "REJECTED", "hue": "Red", "lightness": "Lighter"},
        {"name": "PAID", "hue": "Purple", "lightness": "Lighter"},
    ]},
    # 6. submittedAt
    {"type": "datetime", "name": "submittedAt", "description": "提交时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
    # 7. reviewedAt
    {"type": "datetime", "name": "reviewedAt", "description": "审核时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
    # 8. reviewerId
    {"type": "text", "name": "reviewerId", "description": "审核人 ID", "style": {"type": "plain"}},
    # 9. reviewRemark
    {"type": "text", "name": "reviewRemark", "description": "审核意见/打回原因", "style": {"type": "plain"}},
    # 10. paidAt
    {"type": "datetime", "name": "paidAt", "description": "打款时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
    # 11. paidBy
    {"type": "text", "name": "paidBy", "description": "打款操作人", "style": {"type": "plain"}},
    # 12. paymentRef
    {"type": "text", "name": "paymentRef", "description": "打款流水号", "style": {"type": "plain"}},
    # 13. organizerId
    {"type": "text", "name": "organizerId", "description": "报销人 userId", "style": {"type": "plain"}},
    # 14. organizerName
    {"type": "text", "name": "organizerName", "description": "报销人姓名", "style": {"type": "plain"}},
]


def call_lark(args):
    """用 node execFile 调 lark-cli，避开 PowerShell JSON 解析"""
    cmd = [LARK_NODE, LARK_RUN] + args
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        print(f"  STDERR: {res.stderr[:500]}")
        print(f"  STDOUT: {res.stdout[:500]}")
        return None
    try:
        return json.loads(res.stdout)
    except:
        print(f"  非 JSON: {res.stdout[:300]}")
        return None


def create_table_with_fields():
    """一次建表 + 全部字段"""
    res = call_lark([
        "base", "+table-create",
        "--base-token", BASE_TOKEN,
        "--name", "dw_reimbursements",
        "--fields", json.dumps(FIELDS, ensure_ascii=False),
        "--as", "user",
        "--format", "json",
    ])
    print(f"建表结果: {json.dumps(res, ensure_ascii=False) if res else 'None'}")
    if res and res.get("ok"):
        # data.table.id
        return res["data"]["table"]["id"]
    return None


if __name__ == "__main__":
    print(f"=== 切片 5.1：建 dw_reimbursements 表（{len(FIELDS)} 字段一次建好） ===\n")
    table_id = create_table_with_fields()
    if not table_id:
        print("建表失败")
        sys.exit(1)
    print(f"\n表 ID: {table_id}")
    print(f"\n请在 backend/.env 加：FEISHU_TABLE_REIMBURSEMENTS={table_id}")
