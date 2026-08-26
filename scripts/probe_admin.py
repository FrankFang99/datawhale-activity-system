"""
Probe: 看 admin 账号在飞书里是什么 + login 响应完整 shape
"""
import urllib.request, urllib.parse, json

BASE = "http://127.0.0.1:4000"

def post(path, body):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode("utf-8"),
                                method="POST",
                                headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get(path, token=None):
    headers = {}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, method="GET", headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

# 1. 看登录成功响应完整 shape
print("=== 1. login operator (成功) - 看响应 shape ===")
s, r = post("/api/auth/login", {"email": "operator@x.cn", "password": "datawhale123"})
print(f"status: {s}")
print(f"keys: {list(r.keys()) if isinstance(r, dict) else r}")
print(f"token: {str(r.get('token'))[:50] if isinstance(r, dict) else 'N/A'}")
print(f"user: {r.get('user') if isinstance(r, dict) else 'N/A'}")

# 2. admin 错误响应详细
print("\n=== 2. login admin (失败) - 看响应 ===")
s, r = post("/api/auth/login", {"email": "admin@x.cn", "password": "datawhale123"})
print(f"status: {s}")
print(f"full response: {r}")

# 3. 试其他密码
print("\n=== 3. admin 其他常见密码尝试 ===")
for pw in ["admin123", "Datawhale123", "12345678", "admin@x.cn", "frank123"]:
    s, r = post("/api/auth/login", {"email": "admin@x.cn", "password": pw})
    print(f"  {pw:20} -> {s} {r.get('message', r)}")

# 4. 试 frank 不同密码
print("\n=== 4. frank 其他常见密码 ===")
for pw in ["frank123", "Frank123", "datawhale", "Datawhale", "12345678"]:
    s, r = post("/api/auth/login", {"email": "frank@datawhale.cn", "password": "datawhale123"})
    if s == 200:
        print(f"  datawhale123 OK")
        break

# 5. 健康 + 关键查询
print("\n=== 5. health ===")
s, r = get("/api/health")
print(f"status: {s}, body: {r}")
