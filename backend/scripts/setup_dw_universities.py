"""
v1.2 Frank 17:08 Comment 1 升级：加 dw_universities 表 + 导入 universities.ts 的 57 所头部本科

建表 schema (v1 简化):
- univId (auto_number 1, 2, 3...) 飞书自增
- name (text, 唯一索引？飞书 Bitable 不支持，先不做)
- shortName (text)
- tier (select: 985/211/双一流/本科/高职)
- city (text)
- province (text)
- district (text)
- address (text)
- createdAt (created_at)

依赖：lark-cli + FEISHU_BASE_TOKEN (从 backend/.env)
"""
import os
import sys
import json
import subprocess
from pathlib import Path

LARK_CLI = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\lark-cli.cmd"
ENV_FILE = Path(__file__).parent.parent / ".env"

def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"): continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def lark(args, as_user=True):
    cmd = [LARK_CLI, "base"] + args + ["--as", "user" if as_user else "bot"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        try:
            err = json.loads(r.stdout)
            print(f"  ERR: {err.get('error', {})}")
            return err
        except:
            print(f"  RAW: {r.stdout[:300]} {r.stderr[:200]}")
            return None
    return json.loads(r.stdout)

env = load_env()
BASE_TOKEN = env.get("FEISHU_BASE_TOKEN")
if not BASE_TOKEN:
    print("[FATAL] backend/.env 缺 FEISHU_BASE_TOKEN")
    sys.exit(1)

UNIVERSITIES_FIELDS = [
    {"name": "univId", "type": "auto_number"},
    {"name": "name", "type": "text", "description": "学校全名"},
    {"name": "shortName", "type": "text", "description": "学校简称"},
    {"name": "tier", "type": "select", "options": [
        {"name": "985", "hue": "Red"},
        {"name": "211", "hue": "Orange"},
        {"name": "双一流", "hue": "Yellow"},
        {"name": "本科", "hue": "Blue"},
        {"name": "高职", "hue": "Green"},
    ]},
    {"name": "city", "type": "text"},
    {"name": "province", "type": "text"},
    {"name": "district", "type": "text"},
    {"name": "address", "type": "text"},
    {"name": "createdAt", "type": "created_at"},
]

# 1. 查是否已存在
print("=" * 60)
print(f"Setup dw_universities on base {BASE_TOKEN[:10]}...")
print("=" * 60)

list_data = lark(["+table-list", "--base-token", BASE_TOKEN])
existing = {}
for t in list_data.get("data", {}).get("tables", []):
    existing[t["name"]] = t["id"]
print(f"  已存在 {len(existing)} 张表")

if "dw_universities" in existing:
    print(f"  >> dw_universities 已存在 (id={existing['dw_universities']})，跳过建表")
    table_id = existing["dw_universities"]
else:
    # 2. 建表（--fields 写到文件用 @file 传）
    fields_json = json.dumps(UNIVERSITIES_FIELDS, ensure_ascii=False)
    fields_file = Path(__file__).parent / ".tmp_universities_fields.json"
    fields_file.write_text(fields_json, encoding="utf-8")
    original_cwd = os.getcwd()
    os.chdir(Path(__file__).parent)
    try:
        create_data = lark([
            "+table-create",
            "--base-token", BASE_TOKEN,
            "--name", "dw_universities",
            "--fields", "@.tmp_universities_fields.json",
        ])
    finally:
        os.chdir(original_cwd)
    fields_file.unlink(missing_ok=True)
    if not create_data or not create_data.get("ok"):
        print(f"  [FAIL] 建表失败: {create_data}")
        sys.exit(1)
    # lark-cli 返回的 key 是 "table_id"
    table_id = create_data.get("data", {}).get("table_id") or create_data.get("data", {}).get("id")
    print(f"  >> 建表成功: dw_universities = {table_id}")

# 3. 查现有记录数
list_records = lark([
    "+record-list",
    "--base-token", BASE_TOKEN,
    "--table-id", table_id,
    "--limit", "1",
    "--format", "json",
])
existing_count = len(list_records.get("data", {}).get("data", []))
print(f"  现有记录数: {existing_count}")

if existing_count > 0:
    print(f"  >> dw_universities 已有数据，跳过导入")
else:
    # 4. 从 universities.ts 导入 57 所头部本科
    uni_path = Path(__file__).parent.parent.parent / "frontend" / "src" / "data" / "universities.ts"
    print(f"  读取: {uni_path}")
    txt = uni_path.read_text(encoding="utf-8")

    import re
    # 找 UNIV_BY_PROVINCE 整块
    prov_match = re.search(r"const UNIV_BY_PROVINCE[^=]*=\s*\{(.*?)\n\};", txt, re.DOTALL)
    if not prov_match:
        print("  [FATAL] UNIV_BY_PROVINCE not found")
        sys.exit(1)
    body = prov_match.group(1)

    # 单条大学解析
    unit_pattern = re.compile(
        r"name:\s*'(?P<name>[^']+)'\s*"
        r"(?:,\s*shortName:\s*'(?P<shortName>[^']+)')?\s*"
        r",\s*tier:\s*'(?P<tier>[^']+)'\s*"
        r",\s*city:\s*'(?P<city>[^']+)'\s*"
        r",\s*province:\s*'(?P<province>[^']+)'\s*"
        r",\s*district:\s*'(?P<district>[^']+)'\s*"
        r",\s*address:\s*'(?P<address>[^']+)'"
    )

    records = []
    seen = set()
    for m in unit_pattern.finditer(body):
        d = m.groupdict()
        if d["name"] in seen:
            continue
        seen.add(d["name"])
        tier = d["tier"]
        if tier not in ("985", "211", "双一流", "本科", "高职"):
            tier = "本科"
        records.append({
            "name": d["name"],
            "shortName": d.get("shortName") or "",
            "tier": [tier],
            "city": d["city"],
            "province": d["province"],
            "district": d["district"],
            "address": d["address"],
        })

    print(f"  解析出 {len(records)} 所大学")

    # 5. 批量创建（飞书 batch-create 单批 1000）
    BATCH = 200
    total_created = 0
    original_cwd = os.getcwd()
    script_dir = Path(__file__).parent
    os.chdir(script_dir)  # lark-cli @file 从 cwd 解析
    try:
        for i in range(0, len(records), BATCH):
            batch = records[i:i+BATCH]
            records_json = json.dumps({"create_records": batch}, ensure_ascii=False)
            rec_file = script_dir / f".tmp_universities_records.json"
            rec_file.write_text(records_json, encoding="utf-8")
            result = lark([
                "+record-batch-create",
                "--base-token", BASE_TOKEN,
                "--table-id", table_id,
                "--json", "@.tmp_universities_records.json",
            ])
            rec_file.unlink(missing_ok=True)
            if result and result.get("ok"):
                created = len(result.get("data", {}).get("record_id_list", []))
                total_created += created
                print(f"    批次 {i//BATCH + 1}: +{created}")
            else:
                print(f"    批次 {i//BATCH + 1}: FAIL {result}")
    finally:
        os.chdir(original_cwd)

    print(f"  >> 导入完成: {total_created} 条")

# 6. 写到 .env
print()
print("更新 .env (FEISHU_TABLE_UNIVERSITIES)...")
env_lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
new_key = f"FEISHU_TABLE_UNIVERSITIES={table_id}"
if any("FEISHU_TABLE_UNIVERSITIES" in l for l in env_lines):
    env_lines = [new_key if l.startswith("FEISHU_TABLE_UNIVERSITIES") else l for l in env_lines]
else:
    env_lines.append(new_key)
ENV_FILE.write_text("\n".join(env_lines) + "\n", encoding="utf-8")
print(f"  >> 已写入 {new_key}")
print()
print("=" * 60)
print(f"✅ dw_universities ready: {table_id}")
print("=" * 60)
