"""Generate batch-update JSON for 9 users to 8-digit padded userId."""
import json

# 9 users: record_id -> old_userId (NO.022 .. NO.031)
users = {
    "recvsPbTBvQgst": "NO.022",
    "recvsPBqm54PIk": "NO.023",
    "recvsPBr6UEKdu": "NO.024",
    "recvsPBrBZYOo3": "NO.025",
    "recvsPBs4KAfUC": "NO.026",
    "recvsPBsxNmJaV": "NO.027",
    "recvsPBt2T2WJg": "NO.028",
    "recvsPBtvW0ct2": "NO.029",
    "recvsTQXESCab7": "NO.031",
}

update_records = {}
for rid, old in users.items():
    n = int(old[3:])  # 22, 23, ..., 31
    new_id = f"NO.{str(n).zfill(8)}"  # NO.00000022
    update_records[rid] = {"userId": new_id}

payload = {"update_records": update_records}

with open(r"D:\Learning\AI\Datawhale\data\test\cleanup_2026-08-26\migrate_user_ids.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print("Generated migrate_user_ids.json:")
for rid, new in update_records.items():
    print(f"  {rid:20} -> {new['userId']}")
