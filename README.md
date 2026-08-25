# Datawhale 高校活动智能管理系统

> 部署在 [datawhale.cn](https://www.datawhale.cn/) 子路径下 · v1 上线 = **2026-08-25** ✅ 已完成

> 📦 **给 Datawhale IT 部署用**：请阅读 [`DEPLOY.md`](./DEPLOY.md) — 生产环境部署指南（含 Frank 待问 9 个问题清单）

## 🎉 v1 完成状态

按 PRD §13.2 切片计划，**所有切片提前 2-4 天完成**：

| 切片 | 模块 | 计划 | 实际完成 | 状态 |
|---|---|---|---|---|
| 1 | 注册/登录/活动大厅/申请表单/5 维评分 | 08-18 | 08-20 上午 | ✅ |
| 2 | 5 维评分引擎（33/33 单测 + 10 条脱敏数据） | 08-19 | 08-20 上午 | ✅ |
| 3 | 运营审批工作台（5 admin API + UI + 审计日志） | 08-20 | 08-20 中午 | ✅ |
| 4 | 5 阶段任务看板（10/10 e2e + 进度看板 UI） | 08-22 | **08-20 14:00** | ✅ 提前 2 天 |
| 5 | 报销中心（7 API + 报销中心 UI） | 08-23 | **08-20 14:45** | ✅ 提前 3 天 |
| 6 | AI 助手（10/10 e2e + 浮窗 UI + 33 条 FAQ） | 08-24 | **08-20 14:50** | ✅ 提前 4 天 |
| **联调** | 5 角色跨切片 20/20 全过 | 08-25 | **08-20 15:00** | ✅ 提前 5 天 |

**v1 联调冒烟**：`node backend/test_integration_lite.js` → ✅ 20/20（4 模块 + 14 API + 5 角色权限 + JWT 鉴权）。

---

## 项目结构

```
D:\Learning\AI\Datawhale\
├── PRD.md                # 业务规则 + 状态机 + 切片计划（唯一真相源）
├── design.md             # UI 设计规范（Datawhale 品牌色 / Ant Design 主题）
├── AGENTS.md             # AI agent 工作规则
├── TODO.md               # 待 Frank 联系 Datawhale 推进的事项
├── README.md             # 本文件
├── data/test/            # 测试数据（AI+X 创造节 8 sheet + 常见问题 QA 40+ 条）
├── docs/                 # 技术文档（待建）
├── backend/              # Node + Express + TS 后端
│   ├── src/
│   │   ├── config/       # 配置加载
│   │   ├── middleware/   # JWT / 错误处理
│   │   ├── modules/      # auth / activities / applications / admin / stages / reimbursements / score / ai
│   │   ├── services/feishu/  # 飞书 Base 客户端（lark-cli 1.0.88 wrapper）
│   │   └── index.ts
│   ├── scripts/          # 飞书 Base 建表脚本（setup_feishu_base + create_reimbursements + create_chatlogs + ...）
│   ├── test_*.js         # 端到端测试（5 个：test_e2e / test_stages / test_reimb_step / test_ai_assistant / test_integration_lite）
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/             # Vite + React + Ant Design 前端
│   ├── src/
│   │   ├── pages/        # Login/Register/ActivityList/ActivityDetail/ApplicationForm/MyApplications/admin/ApprovalWorkbench
│   │   │                # + stages/StageBoard + reimbursements/ReimbursementCenter
│   │   ├── components/   # Layout + AIAssistant 浮窗
│   │   ├── services/     # API 客户端
│   │   ├── store/        # zustand auth 状态
│   │   ├── router/       # react-router
│   │   └── main.tsx
│   ├── vite.config.ts    # base = /activity/
│   └── package.json
└── data/feishu/          # 飞书配置备份
```

## v1 测试模式（临时约束）

按 PRD §1.1 + AGENTS.md，v1 测试期间：

- **Frank 一人 4 角色**（ADMIN/OPERATOR/VOLUNTEER/ORGANIZER）
- **邮件/通知收件人统一** `frank-fangyz@139.com`
- **数据存储** 飞书个人版 Base
- **企业版到位后此约束自动废止**

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | React 18 + Vite 5 + Ant Design 5 + Zustand + React Router 6 | design.md 强制 AntD；Vite 快；TS 全栈 |
| 后端 | Node.js 20+ + Express 4 + TypeScript 5 | 轻、TS 严格、Bearer JWT |
| 数据 | **飞书个人版 Base**（Bitable） | PRD §1 原则 1"飞书优先"；Frank lark-cli 已就绪 |
| 部署 | `vite build` 输出到 `datawhale.cn/activity/` 子路径 | 单一仓 + 子路径挂载 |
| 评分 | **5 维纯规则引擎**（PRD §5.1 v1） | 切片 2 实现；33 单测 |
| AI | **关键词匹配 + 33 条 FAQ 知识库**（v1） | 切片 6 实现；v2 升级 LLM |

## 飞书 Base 准备

### 1. 检查 lark-cli 状态

```bash
lark-cli auth status
```

期望：`identity: user`, `appId: cli_aa82e11c78b81cbb`（Frank 个人版）

### 2. 升级 lark-cli（≥ 1.0.88）

```bash
lark-cli update
```

### 3. 跑 setup 脚本

```bash
cd backend
python scripts/setup_feishu_base.py         # 建 dw_users / dw_activities / dw_applications
python scripts/create_reimbursements_table.py  # 建 dw_reimbursements（切片 5）
python scripts/create_chatlogs_table.py        # 建 dw_chat_logs（切片 6）
```

**已建好的 base（Frank 个人版 v1）**：

- base_token: `T3lJbRN7LaqdQqs3AlUchCxLnKb`
- URL: https://my.feishu.cn/base/T3lJbRN7LaqdQqs3AlUchCxLnKb

业务表：

| 表名 | table_id | 切片 | 字段数 |
|---|---|---|---|
| `dw_users` | `tblI7XAVJsXh2lRz` | 1 | 6 |
| `dw_activities` | `tblg4WP41rKbilJR` | 1 | 9 |
| `dw_applications` | `tblZRjMNbwNCDHwq` | 1-3 | 23（含 4 v4 修订字段） |
| `dw_stage_tasks` | `tblw8ZI45cUslzXl` | 4 | 14 |
| `dw_reimbursements` | `tblQLMHEAC6HcVZs` | 5 | 14 |
| `dw_chat_logs` | `tblgLhFZO5TmQkPg` | 6 | 10 |

## 启动开发

### 后端

```bash
cd backend
# 安装依赖（首次）
npm install
# 启动 dev server
npx tsx watch src/index.ts
# 期望：🚀 Datawhale backend running at http://localhost:4000
```

### 前端

```bash
cd frontend
npm install
npm run dev
# 期望：➜  Local:   http://localhost:5173/activity/
```

### 访问入口

- 活动大厅：http://localhost:5173/activity/
- 登录页：http://localhost:5173/activity/login
- 注册页：http://localhost:5173/activity/register
- 我的申请：http://localhost:5173/activity/my-applications（需登录）
- 审批工作台：http://localhost:5173/activity/admin/approvals（需 OPERATOR/ADMIN）
- 5 阶段看板：http://localhost:5173/activity/applications/:id/tasks
- 报销中心：http://localhost:5173/activity/reimbursements

## v1 完整功能演示流程

> 用 Frank 邮箱注册一个账号或直接登录（已有测试数据：清华/上交/深大 3 场活动，5 条已 CONFIRMED 申请）

### 切片 1-2：注册 + 活动大厅 + 申请 + 5 维评分

1. 打开 http://localhost:5173/activity/
2. 点"注册" → 填邮箱（任意 `xxx@x.cn`）/ 密码（≥6 位）/ 姓名 → 注册成功跳登录
3. 登录后看到 3 张活动卡片（清华/上交/深大）
4. 点卡片 → 详情页 → "立即申请" → 填 14 字段表单 → 提交
5. "我的申请" → 看到刚提交记录（状态 SCREENING + 评分 71 + 等级 B）

### 切片 3：审批工作台

1. 用 OPERATOR/ADMIN 角色登录（Frank 4 角色切换）
2. 顶部导航点"审批工作台"
3. 看到 3 条待审申请（NO.002/003/004）
4. 点任意一条 → 详情 Drawer → 5 维评分 Tabs + 审计日志
5. 点"通过" → 状态变 CONFIRMED
6. 也支持"打回" + 必填原因

### 切片 4：5 阶段任务看板

1. 用 OPERATOR 进入刚审批通过的应用（NO.001 / NO.005）
2. 进度看板 → 看到 5 阶段 Steps 横向进度条
3. 步骤 1（INTENT）已完成，步骤 2（RECRUIT）已打回待重提，步骤 3-4 待开始，步骤 5（REVIEW）已完成
4. ORGANIZER 可点"提交凭证"（飞书日历登记 + 飞书好友）
5. VOLUNTEER 可点"审核通过"或"打回"（REJECT 必填原因）
6. REVIEW 阶段审核通过时可"推荐优秀"（v4 修订）

### 切片 5：报销中心

1. 等活动进入 REVIEW_CONFIRMED 状态后，ORGANIZER 进"报销中心"
2. 点"提交新报销" → 填申请编号（NO.001）/ 金额（1-10000）/ 事由 / 凭证 URL 列表
3. 提交后状态 SUBMITTED
4. 切到 OPERATOR → "待审列表" → 通过 / 打回（REJECT 必填原因）
5. 通过后状态 APPROVED → "待打款" tab → 点"标记打款" → 填流水号 → 状态 PAID

### 切片 6：AI 智能助手

1. 任意已登录用户看右下角浮窗（蓝色 🤖）
2. 点开 → 看到 Top 5 Hot FAQ 快捷入口
3. 输入"活动经费标准是多少？" → 答 150 元
4. 输入"5 阶段任务是什么" → 完整 5 阶段说明
5. 输入未匹配（如"今天天气如何"） → 友好降级 + 建议列表
6. 答案下方有 👍/👎 反馈按钮

## 端到端测试

```bash
cd backend
node test_integration_lite.js    # 20/20 全过 - 联调冒烟
node test_stages.js              # 切片 4（用 NO.001 测试前先跑这个初始化 5 阶段）
node test_ai_assistant.js        # 切片 6
```

## 部署到 datawhale.cn 子路径

```bash
cd frontend
npm run build
# 输出 dist/ 目录
# 部署到 datawhale.cn/activity/ 子路径（nginx/vercel 配 try_files）
```

后端需要单独部署到 `datawhale.cn/activity-api/` 或同域子路径：
- Vite dev proxy: `/api/*` → `localhost:4000`
- 生产环境：nginx 反代 `/activity/api/*` → 后端服务

## 已知限制 + 后续优化

1. **lark-cli 走 subprocess + 长期运行兼容性**：每次 API 调用 fork 进程，比直连 HTTP 慢 50-100ms。多次调用累积可能 hang（已加 60s timeout）。
   - **v2 优化**：改用飞书 OpenAPI HTTP 直连，跳过 lark-cli
2. **个人版飞书 Base**：单表记录上限 5 万条；v1 200+ 高校 / 200+ 申请够用
3. **OCR 未实现**（v1 简化）：报销中心用 URL 列表代替，v2 接 PaddleOCR / tesseract
4. **AI 用关键词匹配**（v1 简化）：v2 接 LLM（如 MiniMax-M2.7）做兜底
5. **缺邮件/短信通知**：v1 测试模式所有通知都发到 frank-fangyz@139.com，v2 接真实飞书消息推送
6. **缺飞书 OAuth 登录**：v1 用邮箱注册，v2 用飞书账号体系

## Frank 接下来做什么

1. ⏳ 浏览 http://localhost:5173/activity/ 跑通 6 个切片流程
2. ⏳ 截图发我确认 UI 体验
3. ⏳ 决定是否部署到 datawhale.cn 子路径
4. ⏳ 联系 Datawhale 推进 TODO.md 的 9 个 blocking

## 路径

- 项目：`D:\Learning\AI\Datawhale\`
- 飞书 base：https://my.feishu.cn/base/T3lJbRN7LaqdQqs3AlUchCxLnKb
- lark-cli：`C:\Users\15088\.trae-cn\binaries\node\versions\24.13.0\lark-cli`
- 启动 dev：http://localhost:5173/activity/
- API：http://localhost:4000/api/
- 截图：`C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\`

---

v1.0.0 · 2026-08-20 · **6 切片提前完成 + 联调 20/20 全过**
