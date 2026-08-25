"""建 dw_chat_logs 表（切片 6 · AI 助手日志）"""
import json
import subprocess

LARK_NODE = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node.exe"
LARK_RUN = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node_modules\@larksuite\cli\scripts\run.js"
BASE_TOKEN = "T3lJbRN7LaqdQqs3AlUchCxLnKb"

FIELDS = [
    {"type": "text", "name": "logId", "description": "日志 ID", "style": {"type": "plain"}},
    {"type": "text", "name": "question", "description": "匹配到的标准问法（命中时）", "style": {"type": "plain"}},
    {"type": "text", "name": "questionRaw", "description": "用户原始问题", "style": {"type": "plain"}},
    {"type": "select", "name": "matched", "multiple": False, "options": [
        {"name": "Y", "hue": "Green", "lightness": "Lighter"},
        {"name": "N", "hue": "Red", "lightness": "Lighter"},
    ]},
    {"type": "text", "name": "faqId", "description": "命中 FAQ ID", "style": {"type": "plain"}},
    {"type": "number", "name": "confidence", "description": "置信度 0-1", "style": {"type": "plain", "precision": 2}},
    {"type": "text", "name": "userId", "description": "提问用户 ID", "style": {"type": "plain"}},
    {"type": "datetime", "name": "at", "description": "提问时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
    {"type": "select", "name": "feedback", "multiple": False, "options": [
        {"name": "UP", "hue": "Green", "lightness": "Lighter"},
        {"name": "DOWN", "hue": "Red", "lightness": "Lighter"},
    ]},
    {"type": "text", "name": "feedbackComment", "description": "反馈意见", "style": {"type": "plain"}},
]

def call_lark(args):
    cmd = [LARK_NODE, LARK_RUN] + args
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        print(f"  STDERR: {res.stderr[:500]}")
        return None
    try:
        return json.loads(res.stdout)
    except:
        print(f"  非 JSON: {res.stdout[:300]}")
        return None

if __name__ == "__main__":
    print(f"=== 切片 6.1：建 dw_chat_logs 表（{len(FIELDS)} 字段）===")
    res = call_lark([
        "base", "+table-create",
        "--base-token", BASE_TOKEN,
        "--name", "dw_chat_logs",
        "--fields", json.dumps(FIELDS, ensure_ascii=False),
        "--as", "user",
        "--format", "json",
    ])
    if res and res.get("ok"):
        table_id = res["data"]["table"]["id"]
        print(f"\n表 ID: {table_id}")
        print(f"请在 backend/.env 加：FEISHU_TABLE_CHAT_LOGS={table_id}")
    else:
        print("建表失败")
        print(res)
