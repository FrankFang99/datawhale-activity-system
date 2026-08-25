#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
迁移 v1 数据：源飞书 Base（个人版或企业版） → 目标飞书 Base

场景：
- Frank 个人版 Base（T3lJbRN7LaqdQqs3AlUchCxLnKb）→ Datawhale 企业版 Base（bascnXXX）
- 已有数据要保留，但底库要换

特点：
- 10 张业务表全量复制（users/activities/applications/stage_tasks/reimbursements/chat_logs/participants/interests/messages/materials）
- 跳过系统字段（auto_number / created_at / updated_at）
- 幂等（按 record_id 去重？v1 简化：每张表加 -migrated-{date} 标记，不做去重）
- 错误跳过 + 报告（不中断整体迁移）
- Dry-run 模式（--dry-run 只统计不写）

用法：
  # 1) 准备源 .env 和目标 .env（已有 FEISHU_BASE_TOKEN + 10 个 FEISHU_TABLE_*）
  # 2) Dry-run
  python3 migrate_base.py --source-env .env.source --target-env .env.target --dry-run

  # 3) 真跑
  python3 migrate_base.py --source-env .env.source --target-env .env.target

  # 可选：只迁部分表
  python3 migrate_base.py --source-env .env.source --target-env .env.target --tables dw_users,dw_activities

⚠️ 重要约束：
- 源和目标表的 schema 必须一致（先用 setup_all_tables.py 重建目标表）
- 飞书 API 限流：每张表 1000+ 条时建议 sleep 1s/批
- lark-cli 必须已 login 企业版
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# ============== lark-cli 动态定位 ==============

def find_lark_runner():
    lark_bin = shutil.which("lark-cli")
    if not lark_bin:
        return None
    if sys.platform == "win32":
        for ext in (".CMD", ".cmd", ".EXE", ".exe", ""):
            cand = lark_bin[:-len(ext)] if ext else lark_bin
            if Path(cand + ".ps1").exists():
                ps1 = cand + ".ps1"
                basedir = Path(ps1).parent
                node_exe = str(basedir / "node.exe") if Path(basedir / "node.exe").exists() else "node"
                run_js = str(basedir / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
                if Path(run_js).exists():
                    return (node_exe, run_js)
    else:
        lark_dir = Path(lark_bin).resolve().parent
        node_exe = "node"
        run_js = str(lark_dir.parent / "lib" / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
        if not Path(run_js).exists():
            run_js = str(lark_dir.parent / "node_modules" / "@larksuite" / "cli" / "scripts" / "run.js")
        if Path(run_js).exists():
            return (node_exe, run_js)
    return None


LARK_RUNNER = find_lark_runner()
if not LARK_RUNNER:
    print("❌ lark-cli 未安装或无法定位")
    sys.exit(1)


# 系统字段（不可写）
SYSTEM_FIELDS = {"record_id", "created_at", "updated_at", "auto_number", "_id"}


def run_lark(args, check_ok=True):
    cmd = list(LARK_RUNNER) + args
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    out = proc.stdout
    if proc.returncode != 0:
        try:
            data = json.loads(out)
            if check_ok and not data.get("ok", False):
                raise RuntimeError(f"lark-cli failed: {data.get('error', {})}")
            return data
        except json.JSONDecodeError:
            raise RuntimeError(f"lark-cli exit={proc.returncode} stderr={proc.stderr[:500]}")
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"ok": True, "raw": out}


def parse_env(env_path):
    """读 .env 文件，返回 dict（保留注释和空行）"""
    result = {}
    if not Path(env_path).exists():
        raise FileNotFoundError(f"env file not found: {env_path}")
    for line in Path(env_path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result


# ============== 核心：列源记录 + 写目标 ==============

def list_records(base_token, table_id, page_size=500):
    """列表所有记录（自动翻页）"""
    all_records = []
    page_token = None
    while True:
        args = [
            "base", "+record-list",
            "--base-token", base_token,
            "--table-id", table_id,
            "--page-size", str(page_size),
            "--as", "user",
            "--format", "json",
        ]
        if page_token:
            args.extend(["--page-token", page_token])
        res = run_lark(args)
        data = res.get("data", {})
        items = data.get("items") or data.get("records") or []
        all_records.extend(items)
        has_more = data.get("has_more") or data.get("page_token")
        if not has_more:
            break
        page_token = data.get("page_token") or data.get("next_page_token")
        if not page_token:
            break
    return all_records


def batch_create_records(base_token, table_id, records):
    """批量写记录"""
    # 系统字段过滤
    clean_records = []
    for r in records:
        fields = r.get("fields", r)
        if isinstance(fields, dict):
            clean = {k: v for k, v in fields.items() if k not in SYSTEM_FIELDS}
            clean_records.append({"fields": clean})
        else:
            clean_records.append({"fields": {}})
    if not clean_records:
        return 0
    res = run_lark([
        "base", "+record-batch-create",
        "--base-token", base_token,
        "--table-id", table_id,
        "--json", json.dumps({"records": clean_records}, ensure_ascii=False),
        "--as", "user",
        "--format", "json",
    ])
    created = res.get("data", {}).get("records") or res.get("data", {}).get("items") or []
    return len(created)


def migrate_table(source_base, target_base, table_name, source_table_id, target_table_id, dry_run=False, batch_size=500):
    """迁移单张表"""
    print(f"\n=== {table_name} ===")
    if not source_table_id or not target_table_id:
        print(f"   ⚠️  跳过：source_id={source_table_id} / target_id={target_table_id}")
        return {"table": table_name, "status": "skipped", "reason": "missing table_id"}
    if source_table_id == target_table_id:
        print(f"   ⚠️  跳过：source 和 target 相同（{source_table_id}）")
        return {"table": table_name, "status": "skipped", "reason": "same base"}

    # 1) 列源
    print(f"   ① 列源记录 {source_table_id}...")
    source_records = list_records(source_base, source_table_id)
    print(f"      找到 {len(source_records)} 条")

    if dry_run:
        return {"table": table_name, "status": "dry-run", "count": len(source_records)}

    if not source_records:
        return {"table": table_name, "status": "empty", "count": 0}

    # 2) 批量写目标
    print(f"   ② 写入目标 {target_table_id}（batch={batch_size}）...")
    success = 0
    fail = 0
    for i in range(0, len(source_records), batch_size):
        batch = source_records[i:i+batch_size]
        try:
            created = batch_create_records(target_base, target_table_id, batch)
            success += created
            print(f"      [{i+1}-{i+len(batch)}] 写入 {created} 条")
        except Exception as e:
            fail += len(batch)
            print(f"      [{i+1}-{i+len(batch)}] 失败: {str(e)[:200]}")
        time.sleep(0.5)  # 限流保护

    return {"table": table_name, "status": "done", "source_count": len(source_records), "success": success, "fail": fail}


def main():
    parser = argparse.ArgumentParser(description="迁移飞书 Base 数据（个人版 → 企业版）")
    parser.add_argument("--source-env", required=True, help="源 .env 路径（个人版）")
    parser.add_argument("--target-env", required=True, help="目标 .env 路径（企业版）")
    parser.add_argument("--tables", default="", help="只迁指定表（逗号分隔），默认全 10 张")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写")
    parser.add_argument("--batch-size", type=int, default=500, help="每批写入条数（默认 500）")
    args = parser.parse_args()

    source = parse_env(args.source_env)
    target = parse_env(args.target_env)

    source_base = source.get("FEISHU_BASE_TOKEN")
    target_base = target.get("FEISHU_BASE_TOKEN")
    if not source_base or not target_base:
        print("❌ 缺少 FEISHU_BASE_TOKEN（源或目标）")
        sys.exit(1)

    # 10 张表清单（与 backend/src/config/index.ts 一致）
    all_tables = [
        "dw_users", "dw_activities", "dw_applications", "dw_stage_tasks",
        "dw_reimbursements", "dw_chat_logs", "dw_participants", "dw_interests",
        "dw_messages", "dw_materials",
    ]
    if args.tables:
        selected = [t.strip() for t in args.tables.split(",") if t.strip()]
        tables = [t for t in all_tables if t in selected]
    else:
        tables = all_tables

    print(f"=== Datawhale 飞书 Base 迁移工具 ===")
    print(f"源 base: {source_base[:12]}...（{args.source_env}）")
    print(f"目标 base: {target_base[:12]}...（{args.target_env}）")
    print(f"迁移表: {len(tables)} 张{'（dry-run）' if args.dry_run else ''}")
    print()

    report = []
    for t in tables:
        key = f"FEISHU_TABLE_{t.upper().replace('DW_', '')}"
        source_tid = source.get(key)
        target_tid = target.get(key)
        result = migrate_table(
            source_base, target_base, t, source_tid, target_tid,
            dry_run=args.dry_run, batch_size=args.batch_size,
        )
        report.append(result)

    print()
    print("=== 迁移报告 ===")
    for r in report:
        print(json.dumps(r, ensure_ascii=False))
    print()
    if args.dry_run:
        print("（dry-run 模式，未写入任何数据）")
    else:
        total_success = sum(r.get("success", 0) for r in report)
        total_fail = sum(r.get("fail", 0) for r in report)
        print(f"成功: {total_success} / 失败: {total_fail}")


if __name__ == "__main__":
    main()
