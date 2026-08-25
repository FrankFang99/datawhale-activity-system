# AGENTS.md · Datawhale 高校活动智能管理系统

> 项目级 AI agent 规则。**500 词以内**。每加一条问"值不值得 / 重复吗 / 能否更简洁"。

## 项目

- 路径：`D:\Learning\AI\Datawhale`（不新建目录）
- 品牌：Datawhale（仅首字母大写，禁用 `DataWhale` / `DATAWHALE`）
- v1 上线：2026-08-25（硬节点，质量优先于速度）
- 关键文件：`PRD.md`（唯一真相源）/ `design.md`（UI）/ `data/test/` / `docs/` / `TODO.md`

## 当前任务

**改 PRD**。不写代码、不改测试数据、不动 design.md。详见 PRD §13 切片 + `TODO.md` 待推进项。

## 核心约定

1. **改稿严格按用户指定范围**（用户说改 X 就只改 X；觉得其他部分要改 → 先说再改）
2. **主动提问直到清楚**（3-4 个 blocking 封顶；抓不到就说，不瞎猜）
3. **敏感信息不外泄**（飞书 secret / LLM key / token → `.env` 已 gitignore）
4. **不臃肿**（不写 v2/v3 路线 / 不主动加版本号/CHANGELOG/git tag）
5. **改完先给"改了哪些、为什么"清单**

## 资源

- **飞书**：个人版 app_id + secret 在 `.env`；**业务流程功能受限**（审批/通讯录/群消息因无组织架构）→ 按企业版设计，§11 列降级路径
- **LLM**：MiniMax TokenPlanMax 订阅 key 在 `.env`；v1 不强依赖
- **测试数据**：`data/test/AI+X创造节_测试数据.xlsx`（8 sheet）+ Q&A 12 类 40+ 条 + 9 字段真实问卷

## v1 测试临时约束

- Frank 一人 4 角色（ADMIN/OPERATOR/VOLUNTEER/ORGANIZER）
- 邮件/通知收件人统一 `frank-fangyz@139.com`
- 企业版到位后此约束**自动废止**

## 元规则 + 反例

**加新规则前问**：值不值得 / 重复吗 / 能否更简洁。**优先项目特定信息**（不是通用 AI 知识）。每条规则要有：触发条件 / 行为 / 例外。

**反例**：
- "Phase 0 Demo 已完成"（假）/ 50+ 验收用例 / 文档写明文 key
- 用户没确认前删 PRD / 用"我猜"补内容
- 大刀阔斧重写用户没明说的部分（2026-08-17 真实案例：用户只让加痛点 9，AI 重写痛点表 1-8，被打回）
