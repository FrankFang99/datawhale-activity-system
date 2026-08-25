#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
加测试活动数据（切片 1 验证用）
- 3 条活动：北京/上海/深圳站
- 状态全部 PUBLISHED
"""
import json
import subprocess
import sys
from pathlib import Path

CONFIG_FILE = Path(__file__).parent.parent / ".feishu_base.json"
LARK_NODE = "C:\\Users\\15088\\.trae-cn\\binaries\\node\\versions\\24.13.0\\node.exe"
LARK_RUN_JS = "C:\\Users\\15088\\.trae-cn\\binaries\\node\\versions\\24.13.0\\node_modules\\@larksuite\\cli\\scripts\\run.js"


def run(args):
    proc = subprocess.run([LARK_NODE, LARK_RUN_JS, *args], capture_output=True, text=True, encoding="utf-8")
    out = proc.stdout
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"ok": False, "raw": out, "stderr": proc.stderr[:500]}


def main():
    if not CONFIG_FILE.exists():
        print("ERROR: 请先跑 setup_feishu_base.py", file=sys.stderr)
        sys.exit(1)
    cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    base_token = cfg["base_token"]
    activities_table = cfg["tables"]["dw_activities"]

    # 3 个时间点：2026-10-01, 2026-10-15, 2026-11-01
    records = [
        {
            "title": "AI+X 创造节 - 清华大学站",
            "description": "Datawhale 联合清华 AI 社举办的首场 AI+X 创造节。主题：大模型应用 + 校园场景。内容包括：AI 工具实操、作品集共创、AI 求职经验分享。",
            "status": "PUBLISHED",
            "startDate": 1727712000000,  # 2024-10-01
            "endDate": 1730304000000,    # 2024-10-31
            "location": "北京·海淀区",
            "maxParticipants": 100,
            "requirements": "1. 清华大学在校学生优先；2. 有 AI 项目经验加分；3. 团队可 2-3 人合作；4. 需自备笔记本电脑",
        },
        {
            "title": "AI+X 创造节 - 上海交通大学站",
            "description": "上海交大站，主题：AI 工具实操 + 求职作品集。邀请一线大厂 AI 工程师分享 Prompt 工程、RAG 应用、AI 简历优化。",
            "status": "PUBLISHED",
            "startDate": 1729017600000,  # 2024-10-16
            "endDate": 1731609600000,    # 2024-11-15
            "location": "上海·徐汇区",
            "maxParticipants": 80,
            "requirements": "1. 上海交大学生；2. 想做 AI 工具作品集优先；3. 对大模型应用感兴趣",
        },
        {
            "title": "AI+X 创造节 - 深圳大学站",
            "description": "深圳大学站，主题：AI + 硬件创新。聚焦 AI 嵌入式应用、边缘计算、机器人控制。结合粤港澳大湾区硬件供应链优势。",
            "status": "PUBLISHED",
            "startDate": 1730419200000,  # 2024-11-01
            "endDate": 1732924800000,    # 2024-11-30
            "location": "广东·深圳市",
            "maxParticipants": 60,
            "requirements": "1. 深圳市内高校学生；2. 对 AI 硬件感兴趣；3. 有单片机/嵌入式经验加分",
        },
    ]

    data = run([
        "base", "+record-batch-create",
        "--base-token", base_token,
        "--table-id", activities_table,
        "--json", json.dumps({"create_records": records}, ensure_ascii=False),
        "--as", "user",
    ])
    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
