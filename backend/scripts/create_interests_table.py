"""建 dw_interests 表（v4 修订：参与者视角 - 感兴趣登记）"""
import json
import subprocess

LARK_NODE = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node.exe"
LARK_RUN = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\node_modules\@larksuite\cli\scripts\run.js"
BASE_TOKEN = "T3lJbRN7LaqdQqs3AlUchCxLnKb"

INTERESTS_FIELDS = [
    {"type": "text", "name": "interestId", "description": "兴趣登记 ID", "style": {"type": "plain"}},
    {"type": "text", "name": "schoolName", "description": "感兴趣的学校名", "style": {"type": "plain"}},
    {"type": "text", "name": "userId", "description": "用户 ID（已登录；游客可空）", "style": {"type": "plain"}},
    {"type": "text", "name": "userName", "description": "姓名", "style": {"type": "plain"}},
    {"type": "text", "name": "email", "description": "联系邮箱", "style": {"type": "email"}},
    {"type": "text", "name": "phone", "description": "联系手机", "style": {"type": "phone"}},
    {"type": "text", "name": "remark", "description": "备注/想参加的原因", "style": {"type": "plain"}},
    {"type": "select", "name": "status", "multiple": False, "options": [
        {"name": "PENDING", "hue": "Yellow", "lightness": "Lighter"},
        {"name": "NOTIFIED", "hue": "Green", "lightness": "Lighter"},
    ]},
    {"type": "datetime", "name": "createdAt", "description": "登记时间", "style": {"format": "yyyy-MM-dd HH:mm"}},
]

cmd = [LARK_NODE, LARK_RUN, "base", "+table-create",
       "--base-token", BASE_TOKEN,
       "--name", "dw_interests",
       "--fields", json.dumps(INTERESTS_FIELDS, ensure_ascii=False),
       "--as", "user", "--format", "json"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
print("STDOUT:", res.stdout[:500])
if res.returncode != 0:
    print("STDERR:", res.stderr[:500])
else:
    r = json.loads(res.stdout)
    if r.get("ok"):
        print("dw_interests 表 ID:", r["data"]["table"]["id"])
    else:
        print("FAIL:", r)
