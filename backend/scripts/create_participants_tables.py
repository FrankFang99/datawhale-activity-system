"""建 dw_participants 和 dw_interests 表（v4 修订：参与者视角）"""
import json
import subprocess

LARK_NODE = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node.exe"
LARK_RUN = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node_modules\@larksuite\cli\scripts\run.js"
BASE_TOKEN = "T3lJbRN7LaqdQqs3AlUchCxLnKb"

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

def create_table(name, fields):
    print(f"\n=== 建 {name}（{len(fields)} 字段）===")
    res = call_lark([
        "base", "+table-create",
        "--base-token", BASE_TOKEN,
        "--name", name,
        "--fields", json.dumps(fields, ensure_ascii=False),
        "--as", "user",
        "--format", "json",
    ])
    if res and res.get("ok"):
        table_id = res["data"]["table"]["id"]
        print(f"  OK {name} 表 ID: {table_id}")
        return table_id
    print(f"  FAIL 失败: {res}")
    return None

def add_field(table_id, field):
    name = field.get("name", "?")
    res = call_lark([
        "base", "+field-create",
        "--base-token", BASE_TOKEN,
        "--table-id", table_id,
        "--json", json.dumps(field, ensure_ascii=False),
        "--as", "user",
        "--format", "json",
    ])
    if res and res.get("ok"):
        print(f"  OK {name} ({field['type']})")
        return True
    print(f"  FAIL {name}: {json.dumps(res, ensure_ascii=False)[:200] if res else 'None'}")
    return False

# ===== dw_activities 加 series 字段 =====
ACTIVITIES_TABLE = "tblg4WP41rKbilJR"
print("=== 给 dw_activities 加 series 字段 ===")
add_field(ACTIVITIES_TABLE, {
    "type": "text",
    "name": "series",
    "description": "活动系列名（如 AI+X创造节 / Datawhale学习沙龙）",
    "style": {"type": "plain"}
})

# ===== dw_participants 表（参与者报名）=====
PARTICIPANTS_FIELDS = [
    {"type": "text", "name": "participantId", "description": "参与者 ID", "style": {"type": "plain"}},
    {"type": "text", "name": "activityId", "description": "活动 ID", "style": {"type": "plain"}},
    {"type": "text", "name": "userId", "description": "用户 ID（已登录）", "style": {"type": "plain"}},
    {"type": "text", "name": "userName", "description": "参与者姓名", "style": {"type": "plain"}},
    {"type": "text", "name": "email", "description": "联系邮箱", "style": {"type": "plain"}},
    {"type": "text", "name": "phone", "description": "联系手机", "style": {"type": "plain"}},
    {"type": "text", "name": "school", "description": "所在学校", "style": {"type": "plain"}},
    {"type": "text", "name": "remark", "description": "备注", "style": {"type": "plain"}},
    {"type": "select", "name": "status", "multiple": False, "options": [
        {"name": "REGISTERED", "hue": "Blue", "lightness": "Lighter"},
        {"name": "UNREGISTERED", "hue": "Gray", "lightness": "Lighter"},
    ]},
    {"type": "datetime", "name": "registeredAt", "description": "报名时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
    {"type": "datetime", "name": "cancelledAt", "description": "取消时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
]
create_table("dw_participants", PARTICIPANTS_FIELDS)

# ===== dw_interests 表（对未确定站点感兴趣）=====
INTERESTS_FIELDS = [
    {"type": "text", "name": "interestId", "description": "兴趣登记 ID", "style": {"type": "plain"}},
    {"type": "text", "name": "schoolName", "description": "感兴趣的学校名", "style": {"type": "plain"}},
    {"type": "text", "name": "userId", "description": "用户 ID（已登录；游客可空）", "style": {"type": "plain"}},
    {"type": "text", "name": "userName", "description": "姓名", "style": {"type": "plain"}},
    {"type": "text", "name": "email", "description": "联系邮箱", "style": {"type": "email"}},
    {"type": "text", "name": "phone", "description": "联系手机", "style": {"type": "phone"}},
    {"type": "text", "name": "remark", "description": "备注/想参加的原因", "style": {"type": "plain"}},
    {"type": "select", "name": "status", "multiple": False, "options": [
        {"name": "PENDING", "hue": "Gold", "lightness": "Lighter"},
        {"name": "NOTIFIED", "hue": "Green", "lightness": "Lighter"},
    ]},
    {"type": "datetime", "name": "createdAt", "description": "登记时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
]
create_table("dw_interests", INTERESTS_FIELDS)


