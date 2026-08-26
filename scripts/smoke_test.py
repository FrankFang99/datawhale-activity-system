"""
Smoke test v1.2 - 用 FRONTEND 实际调用的路径（来自 src/services/api.ts）
"""
import urllib.request, urllib.parse, json, time

BASE = "http://127.0.0.1:4000"
results = []

def req(method, path, token=None, body=None, expect_status=None, label=""):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            status, text = resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        results.append((label, method, path, "ERR", str(e), 0))
        return None
    dt = round((time.time() - t0) * 1000)
    try: parsed = json.loads(text) if text else {}
    except: parsed = text[:200]
    ok = "[OK]" if (expect_status is None or status == expect_status) else f"[FAIL] expect {expect_status}"
    if isinstance(parsed, dict):
        if "data" in parsed and isinstance(parsed["data"], dict):
            keys_of_interest = ("token","user","id","name","role","count","total","applications","tasks","list","grade","byGrade","score")
            extracted = {k: (v[:50]+"..." if isinstance(v,str) and len(v)>50 else
                            (str(v)[:80] if not isinstance(v,(int,float,bool,type(None))) else v))
                         for k,v in parsed["data"].items() if k in keys_of_interest}
            data_preview = str(extracted)[:140]
        else:
            data_preview = str({k: parsed.get(k) for k in ("code","message")})[:100]
    else:
        data_preview = str(parsed)[:80]
    results.append((label, method, path, status, parsed, dt))
    print(f"  {ok} {status:>3} {dt:>4}ms {method:6} {path:55} | {label} :: {data_preview}")
    if status >= 400 and status != 403:
        print(f"     ERR body: {str(parsed)[:200]}")
    return parsed

def login(email, pw="datawhale123"):
    r = req("POST", "/api/auth/login", body={"email": email, "password": pw}, expect_status=200, label=f"login {email}")
    if r and isinstance(r, dict) and r.get("code") == 0 and isinstance(r.get("data"), dict):
        return r["data"].get("token")
    return None

print("="*90)
print("Datawhale v1.2 Backend Smoke Test (FRONTEND 真实调用路径)")
print("="*90)

# 0. health
print("\n[0] Health")
req("GET", "/api/health", label="health")

# 1. 8 角色登录
print("\n[1] Login 8 角色")
ACCOUNTS = [
    ("frank@datawhale.cn", "ADMIN"),
    ("operator@x.cn",      "OPERATOR"),
    ("volunteer@x.cn",     "VOLUNTEER"),
    ("org-thu@x.cn",       "ORGANIZER"),
    ("org-sjtu@x.cn",      "ORGANIZER"),
    ("org-szu@x.cn",       "ORGANIZER"),
    ("participant1@x.cn",  "PARTICIPANT"),
    ("participant2@x.cn",  "PARTICIPANT"),
]
tokens = {}
for email, _ in ACCOUNTS:
    tok = login(email)
    if tok: tokens[email] = tok
print(f"  -> {len(tokens)}/{len(ACCOUNTS)} tokens")

# 2. Frontend 真实路径
print("\n[2] Activities 公开 (ActivityList.tsx)")
for email, tok in list(tokens.items())[:4]:
    req("GET", "/api/activities", token=tok, label=f"activities {email}")

print("\n[3] Inbox (Inbox.tsx)")
for email, tok in list(tokens.items())[:3]:
    req("GET", "/api/messages/mine", token=tok, label=f"messages/mine {email}")
    req("GET", "/api/messages/unread/count", token=tok, label=f"unread/count {email}")

print("\n[4] Admin Dashboard (Dashboard.tsx)")
admin_tok = tokens.get("frank@datawhale.cn")
if admin_tok:
    req("GET", "/api/admin/dashboard/kpi", token=admin_tok, label="dashboard kpi")
    req("GET", "/api/admin/dashboard/grade", token=admin_tok, label="dashboard grade")

print("\n[5] Approval Workbench (ApprovalWorkbench.tsx)")
if admin_tok:
    req("GET", "/api/admin/applications/pending", token=admin_tok, label="apps pending")
    req("GET", "/api/admin/applications/review-pending", token=admin_tok, label="apps review-pending")
    req("GET", "/api/admin/applications/volunteers", token=admin_tok, label="apps volunteers")

print("\n[6] Activity Manager (ActivityManager.tsx)")
if admin_tok:
    req("GET", "/api/admin/activities", token=admin_tok, label="admin activities")

print("\n[7] NotifLog (NotifLog.tsx)")
if admin_tok:
    req("GET", "/api/messages/admin/log", token=admin_tok, label="notif log")
    req("GET", "/api/messages/admin/stats", token=admin_tok, label="notif stats")

print("\n[8] Materials (Materials.tsx)")
if admin_tok:
    req("GET", "/api/materials", token=admin_tok, label="materials")

print("\n[9] Reimbursements (ReimbursementCenter.tsx)")
for email in ["frank@datawhale.cn", "operator@x.cn", "org-thu@x.cn"]:
    tok = tokens.get(email)
    if tok:
        req("GET", "/api/reimbursements/mine", token=tok, label=f"reimburse/mine {email}")

print("\n[10] AI Assistant (AIAssistant.tsx)")
if admin_tok:
    req("POST", "/api/ai/chat", token=admin_tok, body={"question": "如何申请成为组织者"}, label="ai chat")

print("\n[11] Volunteer Workbench (volunteer/Workbench.tsx)")
vol_tok = tokens.get("volunteer@x.cn")
if vol_tok:
    req("GET", "/api/volunteer/workbench", token=vol_tok, label="volunteer workbench")
    req("GET", "/api/volunteer/workbench/summary", token=vol_tok, label="volunteer summary")

print("\n[12] My Applications (MyApplications.tsx)")
for email in ["org-thu@x.cn", "org-sjtu@x.cn", "org-szu@x.cn"]:
    tok = tokens.get(email)
    if tok:
        req("GET", "/api/applications/mine", token=tok, label=f"apps/mine {email}")

print("\n[13] My Registrations (MyRegistrations.tsx)")
for email in ["participant1@x.cn", "participant2@x.cn"]:
    tok = tokens.get(email)
    if tok:
        req("GET", "/api/participants/mine", token=tok, label=f"participants/mine {email}")

# Summary
print("\n" + "="*90)
print("SUMMARY")
print("="*90)
err_count = sum(1 for r in results if isinstance(r[3], int) and r[3] >= 400 and r[3] != 403)
print(f"Total: {len(results)}, errors (excl 403): {err_count}, 403s: {sum(1 for r in results if r[3]==403)}")
slow_count = sum(1 for r in results if isinstance(r[5], (int, float)) and r[5] > 1500)
print(f"Slow (>1.5s): {slow_count}")
total_ms = sum(r[5] for r in results if isinstance(r[5], (int, float)))
print(f"Total: {total_ms}ms, avg: {round(total_ms/max(len(results),1))}ms")

if err_count > 0:
    print("\nREAL ERRORS (4xx/5xx, not 403):")
    for r in results:
        if isinstance(r[3], int) and r[3] >= 400 and r[3] != 403:
            print(f"  [{r[3]}] {r[1]} {r[2]} {r[0]}")

if slow_count > 0:
    print("\nSLOW (>1.5s):")
    for r in sorted(results, key=lambda x: -x[5] if isinstance(x[5], (int, float)) else 0)[:15]:
        if isinstance(r[5], (int, float)) and r[5] > 1500:
            print(f"  [{r[5]}ms] {r[1]} {r[2]} {r[0]}")
