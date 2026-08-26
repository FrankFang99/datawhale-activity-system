"""
Delete records per summary.json (Frank-approved plan)
Delete order matters: child tables first to avoid foreign key orphan writes
  1. dw_chat_logs (no refs)
  2. dw_messages (no refs to other tables)
  3. dw_stage_tasks (refs applications)
  4. dw_applications (refs activities + users)
  5. dw_activities (refs users)
  6. dw_users (orphan 5)
"""
import json, subprocess, time, os

LARK_CLI = r"C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\lark-cli.cmd"
BASE_TOKEN = "T3lJbRN7LaqdQqs3AlUchCxLnKb"
SUMMARY = r"D:\Learning\AI\Datawhale\data\test\cleanup_2026-08-26\summary.json"

with open(SUMMARY, "r", encoding="utf-8") as f:
    summary = json.load(f)

# Order: messages/stage_tasks first, then applications, activities, users
delete_plan = []
# 1. chat_logs (all 2)
delete_plan += [("chat_logs", "tblgLhFZO5TmQkPg", rid) for rid in summary["chat_logs"]["delete"]]
# 2. messages (all 18)
delete_plan += [("messages", "tblsfSU3cdkwOWWX", rid) for rid in summary["messages"]["delete"]]
# 3. stage_tasks (all 19)
delete_plan += [("stage_tasks", "tblw8ZI45cUslzXl", rid) for rid in summary["stage_tasks"]["delete"]]
# 4. applications (all 11)
delete_plan += [("applications", "tblZRjMNbwNCDHwq", rid) for rid in summary["applications"]["delete"]]
# 5. activities (all 5)
delete_plan += [("activities", "tblg4WP41rKbilJR", rid) for rid in summary["activities"]["delete"]]
# 6. users (only the 5 orphans)
delete_plan += [("users", "tblI7XAVJsXh2lRz", rid) for rid in summary["users"]["delete"]]

print(f"Total to delete: {len(delete_plan)}")
print("=" * 80)

# Group by table for batch delete
from collections import defaultdict
by_table = defaultdict(list)
for tbl, tid, rid in delete_plan:
    by_table[tid].append(rid)

success_count = 0
fail_count = 0
failed_records = []

for tid, rids in by_table.items():
    print(f"\n[{tid}] deleting {len(rids)} records...")
    for i in range(0, len(rids), 100):
        batch = rids[i:i+100]
        # +record-delete accepts --record-id repeated or --json with list
        json_payload = json.dumps({"record_id_list": batch}, ensure_ascii=False)
        cmd = [LARK_CLI, "base", "+record-delete",
               "--base-token", BASE_TOKEN,
               "--table-id", tid,
               "--json", json_payload,
               "--yes",
               "--as", "user"]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if r.returncode == 0:
            try:
                data = json.loads(r.stdout)
                if data.get("ok"):
                    success_count += len(batch)
                    print(f"  [OK] {len(batch)} deleted (total success: {success_count})")
                else:
                    fail_count += len(batch)
                    failed_records.extend([(tid, rid, data) for rid in batch])
                    print(f"  [FAIL] {data.get('error', {})}")
            except:
                fail_count += len(batch)
                failed_records.extend([(tid, rid, r.stdout[:200]) for rid in batch])
                print(f"  [PARSE ERR] {r.stdout[:200]}")
        else:
            fail_count += len(batch)
            failed_records.extend([(tid, rid, r.stderr[:200]) for rid in batch])
            print(f"  [EXIT {r.returncode}] {r.stderr[:200]}")
        time.sleep(0.5)

print(f"\n{'=' * 80}")
print(f"DELETION SUMMARY")
print(f"  Success: {success_count}")
print(f"  Failed: {fail_count}")
if failed_records:
    print(f"\nFailures:")
    for tid, rid, err in failed_records[:10]:
        print(f"    {tid} | {rid} | {str(err)[:100]}")
