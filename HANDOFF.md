# Datawhale 高校活动智能管理系统 · 交付与对接文档

> **读者**：Datawhale IT（接手部署/运维）+ Frank Fang（交付方）
> **交付状态**：v1.0.0（2026-08-25 已交付部署包 + 2026-08-28 本地演示全业务流程跑通）
> **本次验收范围**（**Datawhale 上次明确**）：**主流程跑通**，专注于**运营 / 组织者 / 志愿者** 3 角色
> **配套文档**：`PRD.md`（业务规则唯一真相源）/ `README.md`（启动 + 演示）/ `AGENTS.md`（AI agent 工作规则）/ `PROJECT_SUMMARY.md`（项目总览 5 分钟版）/ `TODO.md`（等 Datawhale 推进 9 项）/ `DEPLOY.md`（v1.0.0 部署指南，v1.9.28 评估暂缓）

---

## 0. 30 秒定位

面向 Datawhale 高校 AI+X 创造节活动的**智能管理系统**。组织者申请 → 5 维 AI 评分 → 运营审批 → 自动分配志愿者 → 5 阶段任务陪跑（T-10 → T+3）→ 活动复盘 + 报销。

- **后端**：Node 24 + Express 4 + TypeScript 5 + JWT，端口 4000
- **前端**：React 18 + Vite 5 + Ant Design 5 + Zustand，端口 5173
- **数据**：飞书个人版 Base（lark-cli 1.0.91 wrapper），7 张业务表
- **代码量**：backend 16 module / frontend 17 router / 19 子任务模板 / 242 测试全过
- **演示数据**：飞书 base `T3lJbRN7LaqdQqs3AlUchCxLnKb`（7 账号 + 1 活动 NO.049 + 19 子任务，A 选项重置后状态）

---

## 1. 项目结构（清晰易维护）

```
D:\Learning\AI\Datawhale\
├── PRD.md                    # 业务规则唯一真相源（246KB，13 章节）
├── README.md                 # 启动 + 演示（v1.9 实际状态）
├── AGENTS.md                 # AI agent 工作规则（含 v1.9 6 条关键经验）
├── PROJECT_SUMMARY.md        # 项目总览 5 分钟版（替代读 240KB PRD + 13 commit log）
├── HANDOFF.md                # 本文件（交付与对接文档，Datawhale IT 必读）
├── TODO.md                   # 等 Datawhale 推进 9 项
├── DEPLOY.md                 # v1.0.0 部署指南（v1.9.28 评估暂缓，待选 Vercel 方案）
├── design.md                 # UI 设计规范
├── data/test/                # 测试数据（AI+X 创造节 8 sheet + 常见问题 QA + 申请问卷）
│
├── backend/                  # Node + Express + TS 后端
│   ├── src/
│   │   ├── config/           # 环境变量加载
│   │   ├── middleware/       # JWT 鉴权 + 错误处理
│   │   ├── modules/          # 16 个业务模块（auth/activities/applications/admin/stages/...）
│   │   │   ├── auth/         # 登录注册 + JWT
│   │   │   ├── activities/   # 活动大厅
│   │   │   ├── applications/ # 申请提交 + 5 维评分
│   │   │   ├── admin/        # 审批工作台 + 数据看板 + 活动管理
│   │   │   ├── stages/       # 5 阶段子任务（核心，含 SUBTASK_TEMPLATES 19 子任务）
│   │   │   ├── reimbursements/ # 报销中心
│   │   │   ├── score/        # 5 维评分引擎
│   │   │   ├── ai/           # AI 助手（关键词匹配 + 33 FAQ）
│   │   │   ├── messages/     # 站内消息 + Inbox
│   │   │   ├── upload/       # 图片上传（multer）
│   │   │   ├── materials/    # 物料下载
│   │   │   ├── participants/ # 参与者报名
│   │   │   ├── interests/    # 站点兴趣登记
│   │   │   ├── volunteer/    # 志愿者工作台
│   │   │   ├── users/        # 个人中心
│   │   │   ├── universities/ # 高校 CRUD
│   │   │   └── ai/           # AI 助手
│   │   ├── services/feishu/  # 飞书 Base SDK（lark-cli 1.0.91 wrapper）
│   │   ├── utils/            # jwt / password / alert
│   │   └── index.ts          # Express 入口（17 router）
│   ├── scripts/              # 飞书建表 + 迁移 + e2e 测试脚本（12 个真实资产）
│   │   ├── setup_*.py        # 3 个飞书 base 初始化脚本
│   │   ├── create_*.py       # 4 个飞书建表脚本
│   │   ├── migrate_base.py   # 字段迁移（8-26 userId 8 位 padded）
│   │   ├── validate_sanitized_data.py  # 脱敏数据校验
│   │   ├── test_parse.py     # 字段解析测试
│   │   └── e2e/fullFlow.ts   # 端到端流程测试
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.mts
│   ├── .env.example          # 环境变量模板（实际 .env gitignored）
│   └── uploads/              # multer 本地存储（gitignored）
│
└── frontend/                 # Vite + React + Ant Design 前端
    ├── src/
    │   ├── pages/            # 17 页面（Login/Register/ActivityList/ActivityDetail/...）
    │   ├── components/       # 共享组件（Layout/AIAssistant/ProofFileList/...）
    │   ├── data/             # stageSubtasks / stageCredentialSpec / universities / china-regions
    │   ├── services/         # api.ts（API 客户端 + 类型定义）
    │   ├── store/            # zustand auth + theme
    │   ├── router/           # react-router
    │   ├── styles/           # tokens.ts + styles.css
    │   └── main.tsx
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts        # dev base='/'  /  prod base='/activity/'
    └── vitest.config.ts
```

**关键设计原则**：
- **唯一真相源**：PRD.md（业务规则） + 代码（实现）
- **数据 in 飞书 base**：不引入 MySQL/PostgreSQL，简化部署
- **业务流程能力降级**：v1 用个人版飞书（流程功能受限）→ 按企业版设计，PRD §11 列降级路径
- **演示专用代码不留在交付里**（v1.9.28 演示后已清：`clearTestData.ts` / `seedDemoUsers.ts` / `seed_activities.py` / `reScorePending.ts` / 8 个过时 docs/）

---

## 2. Datawhale 验收范围（本次）：主流程跑通

> **上次 Datawhale 明确**：**主流程跑通**，专注于 **运营 / 组织者 / 志愿者** 3 角色

### 2.1 运营视角（OPERATOR / ADMIN）

**核心能力**：
- **审批工作台**：待审申请 → 详情 Drawer → 5 维评分 Tabs + 审计日志 → 通过 / 打回 / 拒绝
- **数据看板**：累计申请 / 通过率 / 完成率 / 报销总额 / 近 7 日趋势 / 等级分布 / 志愿者负载
- **活动管理**：CRUD 活动 + 上下架
- **通知日志**：发送记录 + 失败重发
- **报销审核**：SUBMITTED → APPROVED/REJECTED/RETURNED；ADMIN 额外有打款权限（PAID）
- **5 阶段兜底介入**：REVIEW 阶段志愿者求助 / 争议 / 超时 → 运营介入

**关键 UI**：
- `/admin/approvals` 审批工作台（v1.9.14 重构：Drawer 内 3 决策按钮）
- `/admin/dashboard` 数据看板
- `/admin/activities` 活动管理
- `/admin/notif-log` 通知日志

**数据可见性**：
- 看到**所有申请 + 全部 5 维评分明细**（包括 scoreBreakdown）
- 看到**所有 5 阶段子任务 + 凭证 + 审核记录**
- 看到**所有志愿者分配 + 负载**
- 看到**所有报销 + 凭证**

### 2.2 组织者视角（ORGANIZER / ASSISTANT）

**核心能力**：
- **活动大厅**：浏览活动（PUBLISHED）→ 详情 → 立即申请
- **申请表单**：13 字段（v1.9）→ 提交即 5 维评分
- **5 阶段任务提交**：19 子任务按 ownerType 触发
  - INTENT-1/4 volunteer-first 流程（志愿者先做 → 组织者后确认）
  - PREPARE-1 场地信息 3 类凭证（精确地址 + 使用时段 + 现场图片 ≥3 张 + 5 项设备 Checkbox）
  - 其他 ORGANIZER 子任务
- **报销提交**：银行信息 + 金额 + 凭证 URL 列表

**关键 UI**：
- `/` 活动大厅
- `/apply/:id` 申请表单
- `/my-applications` 我的申请
- `/activities/:id` 活动详情（5 阶段 Segmented Tab + "📋 全部 5 阶段"）
- `/reimbursements` 报销中心

**数据可见性**：
- 看到**自己的申请 + 自己的 5 阶段子任务 + 凭证**
- 看到**自己的报销 + 凭证**
- **不直接看** scoreBreakdown（避免先入为主；运营审批后详情页才展示）

### 2.3 志愿者视角（VOLUNTEER）

**核心能力**：
- **志愿者工作台**：我对接的申请列表（同校优先 + 按省匹配）
- **5 阶段任务审核**：5 阶段统一志愿者审核（运营**默认不介入**，仅作兜底）
  - INTENT-1/4 volunteer-first 流程（志愿者先做 step1）
  - REVIEW-3 志愿者审核作品 + 反馈 + 可推荐优秀
- **同校多申请者分流**：同校 3 人同时申请 → 志愿者私聊后选定 1 位组织者 → 其他人接受/拒绝助教邀请
- **求助运营**：志愿者无法决定时点击"求助运营" → 触发升级

**关键 UI**：
- `/volunteer` 志愿者工作台
- 活动详情页"5 阶段"（同组织者视角，但看到的是审核按钮）

**数据可见性**：
- 看到**自己对接的申请 + 对应 5 阶段子任务 + 凭证**（含 `proofFile` 完整内容）
- 看到**同校申请合并列表**（v1 简化：dispatch 纯函数自动写 applicantRole 字段）

### 2.4 主流程验收清单（Datawhale 验收用例）

> 详细 50+ 验收用例见 PRD §10 AC1-AC12，**本次验收重点**：

| # | 角色 | 流程 | 验收点 |
|---|---|---|---|
| 1 | 组织者 | 注册 → 登录 → 浏览活动 → 提交申请（13 字段）→ 状态 SCREENING | 申请写入 dw_applications，5 维评分同步 |
| 2 | 运营 | 审批工作台 → 详情 → 5 维评分 Tabs → 通过 → 状态 CONFIRMED | 后端自动 init 19 子任务 + 用户角色升级 |
| 3 | 志愿者 | 工作台 → 看到对接申请 → INTENT-1 加飞书好友 → 提交 step1 | 任务 IN_PROGRESS，ownerType=VOLUNTEER 验证 |
| 4 | 组织者 | INTENT-2 阅读行动指南 + INTENT-3 双方确认方案 + INTENT-4 组织者确认 step2 | 4 个 INTENT 子任务 COMPLETED |
| 5 | 组织者 | RECRUIT 1-4（建群/物料/报名/宣传）→ 提交凭证 | 凭证分类渲染：text / timeRange / multiImage / singleUrl / url |
| 6 | 志愿者 | RECRUIT 审核通过 → 5 阶段 lock 解锁 → PREPARE 1-5 | lock 逻辑：上一阶段没全完成 → 下一阶段 disabled |
| 7 | 组织者 | PREPARE-1 提交 3 类凭证（精确地址 + 使用时段 + 现场图片 ≥3 张 + 5 项设备 Checkbox） | proofFile JSON 序列化正确 |
| 8 | 组织者 | EXECUTE 1-3（含现场照片 ≥1 张） | EXECUTE-3 视频分类已删（v1.9.27） |
| 9 | 志愿者 | REVIEW 1-3 → 审核作品 + excellentOrganizer=Y/N + 推荐理由 | 申请进入 REVIEW_CONFIRMED（v1 实际 1-2h 后自动转 COMPLETED） |
| 10 | 运营 | 数据看板看 KPI 卡片 + 近 7 日趋势 + 等级分布 | 与飞书 base 数据一致 |

---

## 3. 5 阶段 19 子任务（核心工作流）

> 完整表见 `PRD.md` §5.4.3；前端实现：`frontend/src/data/stageSubtasks.ts` + `stageCredentialSpec.ts`
> **ownerType 语义**：第一个操作者（step1），不是 step2 的人。志愿者先 → `VOLUNTEER`；组织者先 → `ORGANIZER`

| 阶段 | 时间 | 子任务 | ownerType |
|---|---|---|---|
| **INTENT**（4）| T-10 | 1. 志愿者和组织者互加飞书好友 | VOLUNTEER |
| | | 2. 阅读并确认行动指南 | ORGANIZER |
| | | 3. 双方最终确认活动方案/时间/地点/规模 | ORGANIZER |
| | | 4. 飞书日历登记活动 | VOLUNTEER |
| **RECRUIT**（4）| T-7 | 1. 建活动群聊 / 2. 定制视觉物料 / 3. 发布报名 / 4. 启动本地招募 | ORGANIZER |
| **PREPARE**（5）| T-5 | 1. 确认场地（3 类凭证）/ 2. 培训 / 3. 物料 / 4. 推文 / 5. 作品认证 | ORGANIZER |
| **EXECUTE**（3）| T | 1. 现场签到 / 2. 主题分享+实操 / 3. 采集素材（≥1 张） | ORGANIZER |
| **REVIEW**（3）| T+3 | 1. 提交复盘 / 2. 推动作品上墙 / 3. 志愿者审核（含运营兜底） | 1-2 ORGANIZER / 3 VOLUNTEER |

**5 字段类型**（v1.9.19，按 `PROOF_CATEGORY_TYPE_MAP` 字符串精确匹配）：
- `text`：Input 填空（如"精确地址"）
- `timeRange`：TimePicker.RangePicker（如"使用时段"）
- `multiImage`：Upload + ≥N 张验证（如"现场图片 ≥3 张"）
- `singleUrl`：Input 单 URL（如 PREPARE-3 PPT）
- `url`：TextArea 多行 URL（**默认**）

**5 阶段 lock 逻辑**（v1.9.18）：上一阶段子任务**没全完成** → 下一阶段按钮 `disabled` + 顶部 lock banner

**5 阶段 "全部" Tab**（v1.9.27）：`selectedStage='all'` 模式按阶段分组渲染所有 19 子任务

---

## 4. 5 维评分（v1 暂行版 · 业务待对齐）

> 详细规则见 `PRD.md` §5.1；评分引擎：`backend/src/modules/score/`

| 维度 | 满分 | 表单字段 | 评分依据 |
|---|---|---|---|
| RC-001 场地确认 | 20 | `venueStatus` | 已确定 20 / 有潜在 12 / 暂无 0 |
| RC-002 招募能力 | 20 | `recruitChannel` | 多选：0→0 / 1→8 / 2→14 / ≥3→20 |
| RC-003 组织经验 | 25 | `experience` | 关键词加权 + 文本长度 |
| RC-004 时间合理性 | 15 | `expectedTimeRange` | 日期解析与活动周期比对（**多选 slot 规则待对齐**） |
| RC-005 活动价值 | 20 | `motivation` + `participantValue` | 两字段关键词加权 + 文本长度 |

**S/A/B/C/D 阈值**：≥90 / 75-89 / 60-74 / 40-59 / <40
**S/A 自动通过** / **D 自动拒绝** / **B/C 人工确认**

> 🔧 **业务待对齐**（TODO.md §3）：5 维权重 + 阈值 + 关键词词典为 v1 暂行版，**等 Datawhale 业务会议**调整

---

## 5. 飞书 Base Schema（7 张业务表）

| 表名 | table_id | 用途 |
|---|---|---|
| `dw_users` | `tblI7XAVJsXh2lRz` | 用户（20 字段：role / feishuOpenId / isExternalUser / creditScore） |
| `dw_universities` | — | 高校（含多校区 `campusList` JSON） |
| `dw_activities` | `tblg4WP41rKbilJR` | 活动（12 字段：confirmedAddress / startTime / endTime） |
| `dw_applications` | `tblZRjMNbwNCDHwq` | 申请（23 字段：v1.9 加 `applicantIdentity` / `currentCity` / `expectedTimeRange` / `applicantRole`，`experience` 必填） |
| `dw_stage_tasks` | `tblw8ZI45cUslzXl` | 5 阶段 19 子任务（14 字段：reviewerId / submittedAt / reviewStatus / reviewRemark） |
| `dw_messages` | `tblsfSU3cdkwOWWX` | 站内消息（含 UNCERTAIN 高亮类型） |
| `dw_reimbursements` | `tblQLMHEAC6HcVZs` | 报销（14 字段） |
| `dw_participants` | `tbljAGe59BXIxRuw` | 参与者报名 |

> 字段级 schema 见 `PRD.md` §7.2

---

## 6. 演示账号（v1 测试临时约束，**企业版到位后自动废止**）

7 账号统一密码 `datawhale123`：

| 角色 | 邮箱 | userId |
|---|---|---|
| ADMIN | frank@datawhale.cn | NO.00000022 |
| OPERATOR | operator@x.cn | NO.00000023 |
| VOLUNTEER | volunteer@x.cn | NO.00000024 |
| ORGANIZER（清华）| org-thu@x.cn | NO.00000025 |
| ORGANIZER（上交）| org-sjtu@x.cn | NO.00000026 |
| ORGANIZER（深大）| org-szu@x.cn | NO.00000027 |
| PARTICIPANT | participant1@x.cn | NO.00000028 |

通知收件人统一 `frank-fangyz@139.com`。

---

## 7. 启动指南（Datawhale IT 接手）

```powershell
# 后端
cd D:\Learning\AI\Datawhale\backend
# 复制 .env.example → .env（填飞书 base_token / app_id / app_secret / JWT_SECRET）
npx tsx watch src/index.ts
# 期望：🚀 Datawhale backend running at http://localhost:4000

# 前端
cd D:\Learning\AI\Datawhale\frontend
npm run dev
# 期望：➜  Local:   http://localhost:5173/
```

**演示 URL**：`http://localhost:5173/activities/NO.049`

**环境变量**（`.env`）：
- `FEISHU_BASE_TOKEN`（必填）
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（必填）
- `JWT_SECRET`（必填，至少 32 字符）
- `CORS_ORIGIN`（默认 `http://localhost:5173`）

**首次部署需要跑**（飞书 base 建表）：
```bash
cd backend
python scripts/setup_feishu_base.py          # dw_users / dw_activities / dw_applications
python scripts/create_reimbursements_table.py # dw_reimbursements
python scripts/create_participants_tables.py  # dw_participants
python scripts/create_interests_table.py      # dw_interests
python scripts/create_chatlogs_table.py       # dw_chat_logs
python scripts/setup_dw_universities.py       # 高校 + 多校区 campusList
```

---

## 8. 部署状态（v1.9.29 Netlify 一体化落地）

- **8-25 交付包**：`v1-delivery.zip` 0.52 MB / 126 文件（已可上传）
- **v1.9.28 GitHub Pages 评估**：纯 GitHub Pages 不可行（backend 是 Express + JWT + 飞书 base 代理，必须有 serverless 后端）
- **v1.9.28 Vercel 评估**：需要手机号验证（+86 收不到）
- **v1.9.29 Netlify 一体化落地**：
  - **为什么选 Netlify**：不要手机号（Frank 已有 Netlify 账号已验证）+ GitHub OAuth + 100GB free + serverless-http wrap express 1-1.5h 改造
  - **关键约束**：Netlify Function body 6MB 限制 + 无持久 fs + 冷启动 250ms-2s
  - **文件上传是 mock 版本**：演示版 picsum 占位图 URL，**v2 改飞书 Drive**
  - **lark-cli 1.0.91 在 Netlify Functions 可能 hang**：如果飞书 base 读不到，**v1.9.30 改 fetch 直连**
- **部署步骤**：5 步（Netlify Dashboard → Add new site → Import GitHub → 配 17 个 env → Deploy），详见 `DEPLOY.md` §8.3
- **演示 URL**：`https://datawhale-activity-system.netlify.app/`（Netlify 部署后）

详细部署方案见 `DEPLOY.md` §8（v1.9.29 Netlify 版）

---

## 9. 等 Datawhale 推进 9 项（TODO.md）

> 详见 `TODO.md` 完整版

| # | 项目 | 阻塞 |
|---|---|---|
| 🔴 1 | 飞书企业版权限（业务审批流 / 通讯录 / 群消息） | v1 走个人版降级路径 |
| 🔴 2 | 报销审核标准（类目细节 + 总额上限 + 财务打款周期） | v1 走暂行 500 元/校 |
| 🔴 3 | 5 维评分业务对齐（权重 20/20/25/15/20 + 阈值 90/75/60/40 + 关键词词典） | v1 暂行版 |
| 🟡 4 | 发票 OCR 测试数据 | v1 走纯规则校验 |
| 🟡 5 | 飞书企业版 OAuth 共用身份 | v1 走邮箱注册 |
| 🟡 6 | PRD §5/§12 详细规则标"未经 Datawhale 确认" | 未做 |
| 🟡 7 | 申请表单 v2 字段改进空间 | 等 §5.1 5 维评分对齐后定稿 |
| 🟡 8 | 外部用户飞书 IM（付费功能 · v2 启用） | v1 走保底邮件 + 站内信 |
| 🟡 9 | 同校多申请者处理流程 + REVIEW 运营兜底机制 | v1 简化版（dispatch 纯函数自动写 applicantRole） |

---

## 10. 未来 v2 方向（对使用主体都能更好、更自动化、评分更准、能自我迭代）

> Frank 2026-08-29 23:53 反馈：**未来希望对使用主体都能更好、更自动化、评分更准、能自我迭代**

### 10.1 运营更好

- **自动监控大屏**：实时申请流入 / 志愿者负载 / 5 阶段超时预警，**自动派单**
- **智能分发**：5 维评分 + 志愿者画像（同校 + 同省 + 同专业 + 历史成功案例）→ AI 推荐最佳匹配志愿者
- **异常检测**：申请模板相似度 + 同邮箱重复 + 活动日期冲突 → 自动标红 + 风险评分
- **自然语言审批**：运营写"通过，原因 XX" → 自动填字段 + 触发通知

### 10.2 组织者更好

- **AI 助手深度集成**（v1 是关键词匹配 + 33 FAQ）：用 LLM（如 MiniMax-M2.7）做兜底，**理解组织者真实问题**
- **智能提醒**：T-7 推文没发 → 自动邮件 + 站内信；T-3 场地没确认 → 升级志愿者主动联系
- **申请前预览**：组织者提交前 AI 模拟评分 → 提示"RC-002 招募能力偏低，建议补 1 个渠道"
- **OCR 自动识别凭证**：v2 接 PaddleOCR / tesseract → 发票 / 海报 / 截图自动识别关键信息

### 10.3 志愿者更好

- **自动审核**：高频场景（建群二维码、推文截图）→ 志愿者一键通过 / 打回，AI 预判 + 志愿者终审
- **同校分流升级**：志愿者门户加"同校合并"提示（v1 简化版只 backend dispatch）；AI 提议 1 位最优组织者 + 理由
- **智能时间管理**：5 阶段子任务按 dueDate 排序 + 紧急度评级 → 志愿者每日看到 Top 3 待办
- **反馈沉淀**：志愿者打回原因自动聚合 → 培训新志愿者 + 优化模板

### 10.4 评分更准

- **5 维评分业务对齐**（TODO §3）：用真实通过率 + Badcase 持续调整权重 / 阈值 / 关键词词典
- **OCR + 文本结构化**：申请表单 v2 增加"活动方案 docx 链接" → 自动解析 + 关键词加权
- **多选 slot 时间窗**（TODO §3）：申请者勾选可接受时间区间 → 灵活度评分
- **样本累积 → 模型训练**：上线后累积 200+ 申请 + 真实通过标签 → 用 LLM 微调 5 维评分 + Badcase 反馈循环

### 10.5 自我迭代

- **AI Badcase 工作台**（PRD §12.6）：组织者申诉 + 志愿者反馈 + 运营打回 → 聚合到 Badcase 池
- **自动回归测试**：每次 5 维评分规则调整 → 跑历史数据 → 准确率对比 → 自动 commit 通过
- **A/B 评分**：新规则 10% 灰度 → 与旧规则对比通过率 → 自动选择胜出
- **自我监控**：5 维评分 + 业务规则变更后自动跑 242 测试 + 真实数据校验 → 失败告警
- **文档同步**：代码改产品 → 自动列"PRD 哪些章节要同步"清单（v1.9 教训：13 commit 改产品 PRD 落后）

---

## 11. 关键文件快速索引

| 想看什么 | 文件 |
|---|---|
| 5 分钟项目总览 | `PROJECT_SUMMARY.md` |
| 业务规则细节 | `PRD.md`（13 章节 / 246KB） |
| 启动 + 演示 | `README.md` |
| AI agent 规则 | `AGENTS.md` |
| 交付与对接（**Datawhale IT 必读**） | `HANDOFF.md`（本文件） |
| 待 Datawhale 推进 | `TODO.md` |
| 部署指南（v1.0.0，v2 待更新） | `DEPLOY.md` |
| 5 阶段后端模板 | `backend/src/modules/stages/controller.ts` `STAGE_TEMPLATES` |
| 5 阶段前端模板 | `frontend/src/data/stageSubtasks.ts` `STAGE_TEMPLATES_FRANK` |
| 凭证字段类型 + 5 设备 Checkbox | `frontend/src/data/stageCredentialSpec.ts` |
| 5 维评分引擎 | `backend/src/modules/score/engine.ts` |
| 飞书 Base SDK | `backend/src/services/feishu/client.ts`（lark-cli 1.0.91 wrapper） |
| 申请状态机 | `backend/src/modules/applications/state.ts` |
| 审批工作台 UI | `frontend/src/pages/admin/ApprovalWorkbench.tsx` |
| 活动详情 + 5 阶段 UI | `frontend/src/pages/ActivityDetail.tsx` |

---

## 12. 联系

- **Frank Fang**（交付方）：frank-fangyz@139.com
- **演示数据飞书 base**：https://my.feishu.cn/base/T3lJbRN7LaqdQqs3AlUchCxLnKb
- **演示账号密码**：`datawhale123`（v1 测试临时约束，企业版到位后自动废止）

---

v1.0.0 · 2026-08-29 · **交付与对接文档（Datawhale IT + 未来 agent 接手）**
