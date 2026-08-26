"""
dump all record_ids to ndjson files for cleanup
"""
import json, subprocess, os, time

BASE_TOKEN = "T3lJbRN7LaqdQqs3AlUchCxLnKb"
TABLES = {
    "users": "tblI7XAVJsXh2lRz",
    "activities": "tblg4WP41rKbilJR",
    "applications": "tblZRjMNbwNCDHwq",
    "stage_tasks": "tblw8ZI45cUslzXl",
    "chat_logs": "tblgLhFZO5TmQkPg",
    "messages": "tblsfSU3cdkwOWWX",
}

LARK_CLI = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\lark-cli.cmd"
# ndjson output must be relative path
OUT_DIR_REL = "data/test/cleanup_2026-08-26"
OUT_DIR_ABS = os.path.abspath(OUT_DIR_REL)
os.makedirs(OUT_DIR_ABS, exist_ok=True)
# chdir to project root so relative paths work
os.chdir(r"D:\Learning\AI\Datawhale")

KEEP_EMAILS = {
    "frank@datawhale.cn", "operator@x.cn", "volunteer@x.cn",
    "org-thu@x.cn", "org-sjtu@x.cn", "org-szu@x.cn",
    "participant1@x.cn", "participant2@x.cn",
}

summary = {}
for name, table_id in TABLES.items():
    out_path = os.path.join(OUT_DIR_REL, f"{name}.ndjson")
    if os.path.exists(out_path): os.remove(out_path)
    r = subprocess.run(
        [LARK_CLI, "base", "+record-list",
         "--base-token", BASE_TOKEN,
         "--table-id", table_id,
         "--format", "ndjson",
         "--output", out_path,
         "--overwrite",
         "--as", "user"],
        capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        print(f"[FAIL] {name}: {r.stderr[:200]}")
        continue

    # Read ndjson
    records = []
    if os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                try:
                    records.append(json.loads(line))
                except: pass

    # For users: identify who to keep vs delete
    if name == "users":
        keep, delete = [], []
        for r in records:
            email = r.get("email", "")
            role = r.get("role")
            role_val = role[0] if isinstance(role, list) and role else (role or "")
            userId = r.get("userId", "")
            label = f"{email or '?'} role={role_val or '(空)'} userId={userId or '?'}"
            if email in KEEP_EMAILS or (role_val and role_val != ""):
                keep.append((r.get("record_id"), label))
            else:
                delete.append((r.get("record_id"), label))
        print(f"\n=== {name} (total {len(records)}) ===")
        print(f"  KEEP ({len(keep)}):")
        for rid, lbl in keep:
            print(f"    {rid:25} | {lbl}")
        print(f"  DELETE ({len(delete)}):")
        for rid, lbl in delete:
            print(f"    {rid:25} | {lbl}")
        summary[name] = {
            "total": len(records),
            "keep": [r for r, _ in keep],
            "delete": [r for r, _ in delete],
        }
    else:
        print(f"\n=== {name} (total {len(records)}) ===")
        for r in records[:5]:
            label = (r.get("title") or r.get("applicationNo") or r.get("name")
                     or r.get("userId") or r.get("activityId") or r.get("subject") or
                     r.get("type") or r.get("content") or "")
            if isinstance(label, list): label = label[0] if label else ""
            print(f"  {r.get('record_id'):25} | {str(label)[:60]}")
        if len(records) > 5:
            print(f"  ... +{len(records) - 5} more")
        summary[name] = {"total": len(records), "delete": [r.get("record_id") for r in records]}

# Write summary
with open(os.path.join(OUT_DIR_REL, "summary.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
print(f"\nSummary saved: {OUT_DIR_ABS}\\summary.json")
