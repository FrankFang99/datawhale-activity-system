"""
Dump all 11 Feishu Base tables → for Frank to decide what to clean
"""
import urllib.request, json

BASE = "http://127.0.0.1:4000"
TABLES = {
    "users": "tblI7XAVJsXh2lRz",
    "activities": "tblg4WP41rKbilJR",
    "applications": "tblZRjMNbwNCDHwq",
    "stage_tasks": "tblw8ZI45cUslzXl",
    "chat_logs": "tblgLhFZO5TmQkPg",
    "messages": "tblsfSU3cdkwOWWX",
    "materials": "tbl4pA9qtNyJSxoo",
    "interests": "tbllx0h7bzwoXPPC",
    "participants": "tbljAGe59BXIxRuw",
    "reimbursements": "tblQLMHEAC6HcVZs",
}

def login(email="frank@datawhale.cn", pw="datawhale123"):
    r = urllib.request.Request(BASE + "/api/auth/login",
        data=json.dumps({"email": email, "password": pw}).encode(),
        method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())["data"]["token"]

def get(path, token):
    r = urllib.request.Request(BASE + path, method="GET",
        headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}

tok = login()
print(f"TOKEN OK\n")

# ============ Users (admin endpoint - all users) ============
print("=" * 80)
print("USERS (14 records in dw_users, 8 should be the test accounts)")
print("=" * 80)
# no admin/all-users endpoint, query via /api/users/me for each
# Or use admin dashboard kpi
data = get("/api/admin/dashboard/kpi", tok)
if "data" in data:
    print(f"  Total users: {data['data']['users']['total']}")
    print(f"  By role: {data['data']['users']['byRole']}")

# Query all users via search? try messages admin log has userId
print("\n  -- via messages admin log userIds --")
msgs = get("/api/messages/admin/log?pageSize=100", tok)
user_ids_seen = set()
if "data" in msgs:
    for m in msgs["data"]["list"]:
        if m.get("userId"): user_ids_seen.add(m["userId"])
print(f"  User IDs in messages: {sorted(user_ids_seen)}")

# ============ Activities ============
print("\n" + "=" * 80)
print("ACTIVITIES (5 records in dw_activities)")
print("=" * 80)
acts = get("/api/admin/activities", tok)
if "data" in acts:
    for a in acts["data"]["list"]:
        print(f"  {a.get('activityId'):8} | {a.get('title', '?'):40} | status={a.get('status', '?')} | series={a.get('series', '?')}")

# ============ Applications ============
print("\n" + "=" * 80)
print("APPLICATIONS (11 records in dw_applications)")
print("=" * 80)
apps = get("/api/admin/applications/pending?pageSize=20", tok)
apps_r = get("/api/admin/applications/review-pending?pageSize=20", tok)
print(f"  pending (SCREENING): {apps.get('data', {}).get('total', '?')}")
print(f"  review-pending (REVIEW): {apps_r.get('data', {}).get('total', '?')}")
data = get("/api/admin/dashboard/kpi", tok)
if "data" in data:
    print(f"  total applications: {data['data']['applications']['total']}")
    print(f"  by status: {data['data']['applications']['byStatus']}")
print(f"  -- Pending list --")
if "data" in apps and apps["data"]["list"]:
    for a in apps["data"]["list"][:10]:
        print(f"    {a.get('applicationId', '?')} | {a.get('organizerName', '?')} | {a.get('status', '?')} | score={a.get('score', '?')} {a.get('grade', '')}")
print(f"  -- Review-pending list --")
if "data" in apps_r and apps_r["data"]["list"]:
    for a in apps_r["data"]["list"][:10]:
        print(f"    {a.get('applicationId', '?')} | {a.get('organizerName', '?')} | {a.get('status', '?')} | score={a.get('score', '?')} {a.get('grade', '')}")

# ============ Stage tasks ============
print("\n" + "=" * 80)
print("STAGE TASKS (19 records in dw_stage_tasks)")
print("=" * 80)
print(f"  -- Volunteer workbench --")
vol = get("/api/volunteer/workbench", tok)
if "data" in vol:
    print(f"  total: {vol['data'].get('total', '?')}")
    for a in vol["data"]["list"][:10]:
        print(f"    {a.get('applicationId', '?')} | {a.get('applicationNo', '?')} | {a.get('activityId', '?')} | {a.get('organizerName', '?')} | {a.get('status', '?')}")

# ============ Messages ============
print("\n" + "=" * 80)
print("MESSAGES (dw_messages)")
print("=" * 80)
msgs_total = get("/api/messages/admin/stats", tok)
if "data" in msgs_total:
    print(f"  total: {msgs_total['data'].get('total', '?')}")
    print(f"  byType: {msgs_total['data'].get('byType', '?')}")
    print(f"  byUser count: {len(msgs_total['data'].get('byUser', {}))}")

# ============ Materials ============
print("\n" + "=" * 80)
print("MATERIALS (dw_materials)")
print("=" * 80)
mats = get("/api/materials", tok)
if "data" in mats:
    print(f"  total: {mats['data'].get('total', '?')}")
    for m in mats["data"].get("list", [])[:10]:
        print(f"    {m.get('materialId', '?')} | {m.get('name', '?')} | type={m.get('type', '?')}")

# ============ Chat logs ============
print("\n" + "=" * 80)
print("CHAT LOGS (dw_chat_logs - 1 record)")
print("=" * 80)
print(f"  (smoke test shows 1 record, likely a stub)")

# ============ Reimbursements ============
print("\n" + "=" * 80)
print("REIMBURSEMENTS (0 records)")
print("=" * 80)
print("  empty")

# ============ Participants + Interests ============
print("\n" + "=" * 80)
print("PARTICIPANTS / INTERESTS")
print("=" * 80)
parts = get("/api/participants/activity/NO.001", tok)  # public endpoint
print(f"  public participants on NO.001: {parts.get('data', {}).get('total', '?')}")
ints = get("/api/interests/mine", tok)
if "data" in ints:
    print(f"  my interests: {ints['data'].get('total', '?')}")
