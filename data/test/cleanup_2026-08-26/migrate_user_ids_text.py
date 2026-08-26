"""Migrate all userIds to 8-digit padded (now that field is text, can write)."""
import json

# 9 users: record_id -> new userId (8-digit)
users = {
    "recvsPbTBvQgst": 22,
    "recvsPBqm54PIk": 23,
    "recvsPBr6UEKdu": 24,
    "recvsPBrBZYOo3": 25,
    "recvsPBs4KAfUC": 26,
    "recvsPBsxNmJaV": 27,
    "recvsPBt2T2WJg": 28,
    "recvsPBtvW0ct2": 29,
    "recvsTQXESCab7": 31,
}

update_records = {}
for rid, n in users.items():
    update_records[rid] = {"userId": f"NO.{str(n).zfill(8)}"}

payload = {"update_records": update_records}

with open(r"D:\Learning\AI\Datawhale\data\test\cleanup_2026-08-26\migrate_user_ids_text.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print("Generated:")
for rid, new in update_records.items():
    print(f"  {rid:20} -> {new['userId']}")
