# AGENTS.md · Datawhale 高校活动智能管理系统

> 项目级 AI agent 规则。**500 词以内**。每加一条问"值不值得 / 重复吗 / 能否更简洁"。

## 项目

- 路径：`D:\Learning\AI\Datawhale`（不新建目录）
- 品牌：Datawhale（仅首字母大写，禁用 `DataWhale` / `DATAWHALE`）
- v1 状态：**8-25 已交付**（v1-delivery.zip 0.52 MB / 126 文件）；**8-28 演示日完成全业务流程跑通**
- 关键文件：`PRD.md`（业务规则唯一真相源）/ `PROJECT_SUMMARY.md`（项目总览）/ `README.md`（启动+演示）/ `design.md`（UI）/ `data/test/` / `docs/` / `TODO.md`

## 当前任务

**文档维护**。不写代码、不改测试数据、不动 design.md。改 PRD 严格按用户指定范围（用户说改 X 就只改 X；觉得其他部分要改 → 先说再改）。详见 `TODO.md` 待推进项。

## 核心约定

1. **改稿严格按用户指定范围**（用户说改 X 就只改 X；觉得其他部分要改 → 先说再改）
2. **主动提问直到清楚**（3-4 个 blocking 封顶；抓不到就说，不瞎猜）
3. **敏感信息不外泄**（飞书 secret / LLM key / token → `.env` 已 gitignore）
4. **不臃肿**（不写 v2/v3 路线 / 不主动加版本号/CHANGELOG/git tag）
5. **改完先给"改了哪些、为什么"清单**
6. **清空指令前先列范围 + commit**（2026-08-28 Frank 14:13 反馈：删 Card/字段前先搜引用）

## 资源

- **飞书**：个人版 app_id + secret 在 `.env`；**业务流程功能受限**（审批/通讯录/群消息因无组织架构）→ 按企业版设计，PRD §11 列降级路径
- **LLM**：MiniMax TokenPlanMax 订阅 key 在 `.env`；v1 不强依赖
- **测试数据**：`data/test/AI+X创造节_测试数据.xlsx`（8 sheet）+ Q&A 12 类 40+ 条 + 9 字段真实问卷
- **演示数据**（飞书 base `T3lJbRN7LaqdQqs3AlUchCxLnKb`）：7 账号 + 1 活动 NO.049 + 19 子任务（A 选项重置后状态：INTENT/RECRUIT 全完成，PREPARE 在 IN_PROGRESS 中止）

## 演示账号（v1 测试临时约束）

7 账号统一密码 `datawhale123`（Frank 8-25 seed + 8-28 演示重置后维持）：

| 角色 | 邮箱 | userId |
|---|---|---|
| ADMIN | frank@datawhale.cn | NO.00000022 |
| OPERATOR | operator@x.cn | NO.00000023 |
| VOLUNTEER | volunteer@x.cn | NO.00000024 |
| ORGANIZER | org-thu@x.cn | NO.00000025 |
| ORGANIZER | org-sjtu@x.cn | NO.00000026 |
| ORGANIZER | org-szu@x.cn | NO.00000027 |
| PARTICIPANT | participant1@x.cn | NO.00000028 |

通知收件人统一 `frank-fangyz@139.com`。**企业版到位后此约束自动废止**。

## 关键技术约束

- **5 阶段 19 子任务**（v1.9：22→19，INTENT 4 + RECRUIT 4 + PREPARE 5 + EXECUTE 3 + REVIEW 3）
- **5 字段类型**（v1.9.19）：`text` / `timeRange` / `multiImage` / `singleUrl` / `url`，按 `PROOF_CATEGORY_TYPE_MAP` 字符串精确匹配
- **5 阶段 lock 逻辑**（v1.9.18）：上一阶段子任务没全完成 → 下一阶段按钮 disabled + lock banner
- **ownerType 语义**：第一个操作者（step1），不是 step2 的人。志愿者先 → VOLUNTEER；组织者先 → ORGANIZER
- **dev 路径**：`vite.config.ts` dev 模式 `base='/'`（不是 `/activity/`），生产 build 走 `/activity/`

## 元规则 + 反例

**加新规则前问**：值不值得 / 重复吗 / 能否更简洁。**优先项目特定信息**（不是通用 AI 知识）。每条规则要有：触发条件 / 行为 / 例外。

**反例**：
- "Phase 0 Demo 已完成"（假）/ 50+ 验收用例 / 文档写明文 key
- 用户没确认前删 PRD / 用"我猜"补内容
- 大刀阔斧重写用户没明说的部分（2026-08-17 真实案例：用户只让加痛点 9，AI 重写痛点表 1-8，被打回）
- 改子任务 ownerType 不先列方案（2026-08-27 真实案例：直接改 INT-2 ownerType，Frank 反馈"只有 1 和 4 是志愿者先确认"要回退）
- "清空"指令前不列范围（2026-08-28 真实案例：删 19 子任务时一起清掉之前改好的东西）

## v1.9 关键经验（演示日 8-27 ~ 8-28 沉淀）

| 教训 | 触发 | 行为 |
|---|---|---|
| **A 选项重置**（演示前必做） | 演示日/第二轮测试前 | 保留 7 账号 + 1 活动 NO.049，**删所有 stage_tasks + applications**，让 Frank 重走全流程 |
| **演示专用代码不留在交付里** | 演示完成/准备交付 | 列残留清单（脚本/数据/临时文件如 `seedDemoUsers.ts` / `clearTestData.ts`）→ 一次 commit 清完 |
| **"尽情发挥"≠ 我认可** | 用户客气授权 | 先问 1-2 方向再动手，不要闷头全做（v1.2 UI 教训） |
| **antd 5.22 红星机制** | 必填/可选视觉区分 | 接受 `required={true}` + 红星 + 删"可选"分类标签（4 版本没 work，删 EXECUTE-3 视频分类绕过） |
| **verify UI 真实渲染** | 汇报"已就绪"前 | 必须 verify UI 真实渲染（截图/curl 模拟前端调用链），不只 curl 数据层（Frank 8-28 13:58 反馈"颠三倒四"教训） |
| **PRD 滞后 commit** | 13 commit 改产品，PRD/AGENTS 没同步 | **任何 commit 改产品前，先列"PRD 哪些章节要同步"清单**（v1.9 教训：交付日 PRD 仍是 22 子任务版本） |
