# Datawhale 高校活动智能管理系统 · 项目总览

> **v1 状态**：8-25 已交付部署包（v1-delivery.zip，0.52 MB，126 文件）；8-28 本地演示全业务流程跑通
> **本文件用途**：Frank 用 5 分钟了解项目全貌（替代读 240KB PRD.md + 13 个 commit log）
> **配套文档**：`PRD.md`（业务规则唯一真相源）/ `README.md`（启动 + 演示）/ `AGENTS.md`（AI agent 工作规则）

---

## 1. 项目一句话

**面向 Datawhale 高校 AI+X 创造节活动的智能管理系统**：组织者申请 → 5 维 AI 评分 → 运营审批 → 自动分配志愿者 → 5 阶段任务陪跑（T-10 → T+3）→ 活动复盘 + 报销。

## 2. 关键事实

| 项 | 状态 |
|---|---|
| v1 上线 | 2026-08-25 ✅ |
| 演示数据 | 飞书 base `T3lJbRN7LaqdQqs3AlUchCxLnKb`（Frank 个人版，7 账号 + 1 活动 NO.049 + 19 子任务） |
| 演示账号密码 | 统一 `datawhale123`（v1 测试临时约束） |
| Frank 角色 | 一人 4 角色（ADMIN/OPERATOR/VOLUNTEER/ORGANIZER） |
| 通知收件人 | 统一 `frank-fangyz@139.com` |
| 后端 | Node 24 + Express 4 + TS 5 + JWT，端口 4000 |
| 前端 | React 18 + Vite 5 + Ant Design 5 + Zustand，端口 5173 |
| 数据 | 飞书个人版 Base（lark-cli 1.0.91 wrapper），7 张业务表 |
| 部署 | `datawhale.cn/activity/` 子路径（Vite build）—— 暂缓部署（v1.9.28 评估 GitHub Pages 不可行，Vercel 方案待选） |
| 代码 | backend 16 module / frontend 17 router / 19 子任务模板 |
| 测试 | 后端 14 测试集 / 229 测试 / 前端 13 测试，242 全过 |

## 3. 5 角色权限矩阵

| 角色 | 关键能力 | 默认登录账号 |
|---|---|---|
| **ADMIN** | 数据看板 + 审批 + 活动管理 + 通知日志 + 报销打款 | `frank@datawhale.cn` |
| **OPERATOR** | 审批 + 活动管理 + 通知日志 + 报销审核（**不打款**） | `operator@x.cn` |
| **VOLUNTEER** | 5 阶段任务陪跑 + 审核 + 同校多申请者分流 + 求助运营 | `volunteer@x.cn` |
| **ORGANIZER** | 活动大厅 + 我的申请 + 5 阶段任务提交 + 报销提交 | `org-thu/sjtu/szu@x.cn` |
| **PARTICIPANT** | 活动大厅 + 我的报名 + **可看完整 5 阶段**（v1.9 改） | `participant1@x.cn` |
| **ASSISTANT**（v2） | 助教（同校多申请者未被选中的同意转化） | （v2 待启用） |

权限细节：5 角色 + 助手共 6 角色（USER 角色升级路径：USER/PARTICIPANT → 申请通过 → ORGANIZER；详见 `PRD.md` §2.1 + §2.2）。

## 4. 5 阶段 19 子任务（核心工作流）

> **5 阶段 = 确认意向 → 对外招募 → 现场筹备 → 活动执行 → 活动复盘**（T-10 → T+3）
> 19 子任务按"组织者提交 + 志愿者审核"两环节拆分，每阶段统一志愿者审核（运营**默认不介入**，仅作兜底）

| 阶段 | 时间 | 子任务 | ownerType |
|---|---|---|---|
| **INTENT**（4 个） | T-10 | 1. 志愿者和组织者互加飞书好友 | VOLUNTEER |
| | | 2. 阅读并确认行动指南 | ORGANIZER |
| | | 3. 双方最终确认活动方案/时间/地点/规模 | ORGANIZER |
| | | 4. 飞书日历登记活动 | VOLUNTEER |
| **RECRUIT**（4 个） | T-7 | 1. 建活动群聊 | ORGANIZER |
| | | 2. 定制视觉物料（海报/横幅/手举牌） | ORGANIZER |
| | | 3. 复制专题并发布报名表单 | ORGANIZER |
| | | 4. 启动本地招募宣传（公众号/朋友圈/群转发） | ORGANIZER |
| **PREPARE**（5 个） | T-5 | 1. 确认场地并上传场地信息 | ORGANIZER |
| | | 2. 组织者+助教完成实操教程培训 | ORGANIZER |
| | | 3. 准备现场物料（接收/打印/任务卡PPT） | ORGANIZER |
| | | 4. 提交宣传推文 | ORGANIZER |
| | | 5. 参与者上传作品/申请的认证 | ORGANIZER |
| **EXECUTE**（3 个） | T | 1. 现场签到与引导 | ORGANIZER |
| | | 2. 主题分享+带教演示+实操+闪电分享 | ORGANIZER |
| | | 3. 采集现场素材（横版高清） | ORGANIZER |
| **REVIEW**（3 个） | T+3 | 1. 提交活动复盘（含现场素材到飞书文档） | ORGANIZER |
| | | 2. 推动作品上墙（参与 OPC 能力认证） | ORGANIZER |
| | | 3. 志愿者审核作品+反馈+可推荐优秀（含运营兜底） | VOLUNTEER |

**关键术语**：
- **ownerType**：表示"第一个操作者"（step1），不是 step2 的人。志愿者先 → VOLUNTEER；组织者先 → ORGANIZER（Frank 28 9:25 明确）
- **volunteer-first 流程**：INT-1（互加好友）+ INT-4（飞书日历）+ REVIEW-3（志愿者审核）都是志愿者先做，组织者后确认

## 5. 5 字段类型（凭证分类渲染）

> **v1.9.19 Frank 反馈**：`proofCategories` 按类别渲染不同 Form 控件，**按类别名字查 PROOF_CATEGORY_TYPE_MAP 决定**（不是按子任务决定）

| 字段类型 | Form 控件 | 触发关键词 | 例 |
|---|---|---|---|
| **text** | Input（填空题） | 精确地址（必填，填空 · 精确到门牌号） | PREPARE-1 精确地址 |
| **timeRange** | TimePicker.RangePicker | 使用时段（必填 · 几点到几点的下拉选择） | PREPARE-1 使用时段 |
| **multiImage** | Upload + ≥N 张验证 | 现场图片（必填，≥3 张） | PREPARE-1 现场图片 |
| **singleUrl** | Input（单 URL） | — | PREPARE-3 任务卡 PPT（v1.9.20 改） |
| **url** | TextArea（多行 URL，**默认**） | 任何不在 PROOF_CATEGORY_TYPE_MAP 里的 | 其他链接类凭证 |

**PROOF_CATEGORY_TYPE_MAP**（4 个固定映射，**字符串精确匹配**）：
```ts
'精确地址（必填，填空 · 精确到门牌号）' → 'text'
'使用时段（必填 · 几点到几点的下拉选择）' → 'timeRange'
'现场图片（必填，≥3 张）' → 'multiImage'
// 其他 → 'url'（默认）
```

**可选 vs 必填**：`label` 含"（可选）" → 不加红星（`isProofCategoryOptional` 判断）；其余必填加红星

**5 项场地设备 Checkbox**（PREPARE-1 内嵌，Frank "保证有"）：投影设备 / 稳定网络 / 话筒 / 电源 / 桌椅。提交时拼成 JSON 存 `proofFile` 同 key 下

## 6. 5 阶段 lock 逻辑（v1.9.18 新增）

```
当前阶段所有子任务 COMPLETED → 下一阶段 PENDING → IN_PROGRESS
若当前阶段为 PREPARE → 同时触发申请状态 PREPARING → READY
REVIEW 阶段志愿者审核通过 → 申请直接进入 COMPLETED（运营默认不介入）
```

**前端实现**（v1.9.18）：上一阶段子任务没全完成 → 下一阶段子任务按钮 **disabled** + 顶部加 **lock banner**（"上一阶段「XX」未全部完成"）

**5 阶段 Tab 模式**（v1.9.27）：支持 "📋 全部 5 阶段" `selectedStage='all'`，按阶段分组渲染所有 19 子任务（PARTICIPANT 等不可操作角色看全部工作流）

## 7. 6 维评分规则（v1 暂行版 · 业务待对齐）

> **数据源**：`backend/src/modules/score/` + `PRD.md` §5.1
> **5 维**（不是 6 维）：场地确认 / 招募能力 / 组织经验 / 时间合理性 / 活动价值

| 维度 | 满分 | 表单字段 | 评分依据 |
|---|---|---|---|
| **RC-001 场地确认** | 20 | venueStatus | 单选枚举（已确定→20 / 有潜在→12 / 暂无→0） |
| **RC-002 招募能力** | 20 | recruitChannel | 多选（按"非'暂无'渠道数"分段：0→0 / 1→8 / 2→14 / ≥3→20） |
| **RC-003 组织经验** | 25 | experience | 关键词加权（组织行为/多场/Datawhale/规模/负责人） + 文本长度加分 |
| **RC-004 时间合理性** | 15 | expectedTimeRange | 解析日期文本与活动周期比对（**多选 slot 赋分规则待对齐**） |
| **RC-005 活动价值** | 20 | motivation + participantValue | 两字段关键词加权 + 文本长度综合 |

**S/A/B/C/D 阈值**：≥90 / 75-89 / 60-74 / 40-59 / <40
**S/A 级自动通过**（→ CONFIRMED） / **D 级自动拒绝**（→ REJECTED） / **B/C 级人工确认**（停留 SCREENING）

> 🔧 **业务待对齐**（TODO.md §3）：5 维权重 20/20/25/15/20 + 阈值 90/75/60/40 + 关键词词典为 v1 暂行版，**8月第3周业务会议**调整

## 8. 申请表单字段（v1.9 实际 12 字段）

> ⚠️ **与 PRD §4.1.4 差异**：PRD 写 v3 设计（14 字段，identityStatus/city/schoolOrOrg/expectedDate/venueStatus/recruitChannel/motivation/participantValue/experience/expectedTimeWindow），v1.9 实际 v4 设计（字段名都变了）

| # | 字段 | 类型 | 必填 | 备注 |
|---|---|---|---|---|
| 1 | activityId | string | ✓ | 关联活动 ID |
| 2 | organizerName | string | ✓ | 1-20 字符 |
| 3 | organizerPhone | string | ✓ | 11 位手机号 |
| 4 | organizerEmail | string | ✓ | 邮箱格式 |
| 5 | applicantIdentity | enum | ✓ | 在校 / 在职 / 自由职业 / 其他 |
| 6 | currentCity | string | ✓ | 现居城市 |
| 7 | location | string | ✓ | 活动地点（≤100 字符） |
| 8 | expectedTimeRange | string | ✓ | 时间窗文本（≤500 字符，可日期 join） |
| 9 | venueStatus | enum | ✓ | 已确定 / 有潜在 / 暂无 |
| 10 | recruitChannel | multi-enum | ✓ | 5 选多（社群/公众号/高校社团/企业园区/暂无） |
| 11 | motivation | string | ✓ | 申请动机（≤500 字符） |
| 12 | participantValue | string | ✓ | 参与者价值（≤500 字符） |
| 13 | experience | string | ✓ | 历史经验（≤500 字符，**v1.9 改必填**） |

> 注：原 PRD §4.1.4 的 `expectedDate` / `expectedTimeWindow` / `schoolOrOrg` 字段 v1.9 已合并/改名为 `expectedTimeRange` + `location` + `applicantIdentity`

## 9. 飞书 Base 7 张业务表

| 表名 | table_id | 字段数 | 用途 |
|---|---|---|---|
| `dw_users` | `tblI7XAVJsXh2lRz` | 20 | 用户（含 role / feishuOpenId / isExternalUser） |
| `dw_universities` | `tblXXX` | — | 高校（含多校区 campusList JSON） |
| `dw_activities` | `tblg4WP41rKbilJR` | 12 | 活动（含 confirmedAddress / startTime / endTime） |
| `dw_applications` | `tblZRjMNbwNCDHwq` | 23 | 申请（含 venueStatus / recruitChannel / applicantRole） |
| `dw_stage_tasks` | `tblw8ZI45cUslzXl` | 14 | 子任务（19 条/申请） |
| `dw_messages` | `tblsfSU3cdkwOWWX` | — | 站内消息（含 UNCERTAIN 类型） |
| `dw_reimbursements` | `tblQLMHEAC6HcVZs` | 14 | 报销 |
| `dw_participants` | `tbljAGe59BXIxRuw` | — | 参与者报名 |

## 10. 后端 17 router / 前端 17 页面

**后端路由**（backend/src/index.ts）：
- `/api/auth` 登录注册 + JWT
- `/api/activities` 活动大厅
- `/api/applications` 申请提交 + 评分
- `/api/admin/applications` 审批工作台（3 步：自核/审核/复核）
- `/api/admin/dashboard` 数据看板
- `/api/admin/activities` 活动管理
- `/api/admin/universities` 高校 CRUD
- `/api/stages/:taskId` 5 阶段子任务 submit/review/operatorReview
- `/api/reimbursements` 报销
- `/api/ai` AI 助手
- `/api/participants` 参与者报名
- `/api/interests` 站点兴趣登记
- `/api/volunteer` 志愿者工作台
- `/api/users` 个人中心
- `/api/messages` 站内消息 + Inbox
- `/api/materials` 物料下载
- `/api/upload` 图片上传（multer 本地 uploads/）
- `/uploads` 静态 serving

**前端页面**：Login / Register / ActivityList / ActivityDetail / ApplicationForm / MyApplications / ApprovalWorkbench / Dashboard / StageBoard / ReimbursementCenter / AIAssistant 浮窗 / Inbox / Profile 等

## 11. dev 启动

```powershell
# 后端（detached tsx watch）
cd D:\Learning\AI\Datawhale\backend
npx tsx watch src/index.ts
# 期望：🚀 Datawhale backend running at http://localhost:4000

# 前端（dev 模式 base='/'，直接 localhost:5173 访问）
cd D:\Learning\AI\Datawhale\frontend
npm run dev
# 期望：➜  Local:   http://localhost:5173/
```

> ⚠️ **dev path**：`vite.config.ts` dev 模式 `base='/'`（不是 `/activity/`），生产 build 才走 `/activity/`（部署到 datawhale.cn/activity/）
> **演示 URL**：`http://localhost:5173/activities/NO.049`（活动 NO.049 "AI+X 创造节-清华大学站"）

## 12. v1.9 迭代日志（8-27 ~ 8-28 演示日）

| 版本 | 改动 | 原因 |
|---|---|---|
| v1.9.14 | 审批工作台：3 个决策按钮移到 Drawer + RC004/RC006 满分修正 | 解决审批页面决策按钮不明显 |
| v1.9.15 | 抽 `ProofFileList` 组件 + 活动页 header 地点用 `confirmedAddress` fallback | 凭证链接统一展示 |
| v1.9.16 | 修 byActivity 缺 userId/volunteerId + 删 setTimeout 强跳 | Frank 自 commit |
| v1.9.17 | 时区 bug 修（`toISOString` → `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' })`）+ 必填字段加红星 | 时区 8h 偏差 + 表单必填视觉提示 |
| v1.9.18 | 5 阶段 lock 逻辑：上一阶段子任务没全完成 → 下一阶段按钮 disabled + lock banner | 防止越阶段提交 |
| v1.9.19 | PREPARE-1 3 类字段类型：text (精确地址) / timeRange / multiImage (≥3 张 + 5 项设备 Checkbox) | 场地信息精确化 |
| v1.9.20 | PREPARE-3 PPT 分类改单 URL Input | 简化 PPT 链接录入 |
| v1.9.21 | 可选 category（label 含"（可选）"）不加红星 | 区分必填/可选视觉 |
| v1.9.22 | EXECUTE-3 横版高清照片 ≥5 张改 ≥1 张 | "一张即可" |
| v1.9.23-25 | 3 个失败版本尝试修 antd 5.22 红星机制 bug | Frank 决定接受必填红星 + 删视频分类 |
| v1.9.26 | 通知中心 Inbox：UNCERTAIN 通知黄色高亮 + 置顶 | 不确定反馈优先关注 |
| v1.9.27 | 5 阶段 Segmented Tab 加 "📋 全部 5 阶段" + 删 EXECUTE-3 视频分类 + 恢复 v1.9.21 红星方式 | 完整工作流可视化 + 绕开红星机制 bug |

## 13. 部署状态（暂缓）

- **8-25 交付包**：`v1-delivery.zip` 0.52 MB / 126 文件（Frank 确认可上传）
- **8-28 部署评估**：纯 GitHub Pages 不可行（backend 是 Express + JWT + 飞书 base 代理，不能跑静态）
  - **方案 A**：Vercel Serverless Function (backend) + GitHub Pages (frontend) + 飞书 base
  - **方案 B**：Vercel 一体化（前后端都 Vercel Serverless Functions）
  - **关键约束**：Vercel Function body 4.5MB 限制 + 无持久 fs + CORS + 飞书字段 5 万字符
  - **文件上传方案**待选：A base64 飞书 / B 飞书 Drive / C Vercel KV
  - **评估时间 + 代码改造约 1.5-2h**
- **Frank 决策**："看样子挺复杂的"——先做项目总结 + 更新 PRD 文档，部署待后续

## 14. 关键文件清单

```
D:\Learning\AI\Datawhale\
├── PRD.md                    # 业务规则唯一真相源（240KB）
├── README.md                 # 启动 + 演示
├── AGENTS.md                 # AI agent 工作规则
├── PROJECT_SUMMARY.md        # 本文件（项目总览）
├── TODO.md                   # 待 Frank 联系 Datawhale 推进事项
├── DEPLOY.md                 # 生产部署指南（v1.0.0 8-25）
├── design.md                 # UI 设计规范
├── docs/                     # 技术文档（7 个：ACCEPTANCE / FRIDAY_DEMO / v14/v16 系列）
├── data/test/                # 测试数据（AI+X 创造节 8 sheet + 常见问题 QA）
├── backend/                  # Node + Express + TS 后端
│   ├── src/
│   │   ├── modules/          # 16 module：auth/activities/applications/admin/stages/...
│   │   ├── services/feishu/  # 飞书 Base 客户端（lark-cli 1.0.91 wrapper）
│   │   └── index.ts          # Express 入口
│   ├── scripts/              # seedDemoUsers / clearTestData / debug 脚本
│   └── uploads/              # multer 本地文件存储
└── frontend/                 # Vite + React + Ant Design 前端
    ├── src/
    │   ├── pages/            # 17 页面
    │   ├── components/       # ProofFileList / Layout / AIAssistant
    │   ├── data/             # stageSubtasks / stageCredentialSpec
    │   └── services/         # api.ts
    └── vite.config.ts        # dev base='/'  /  prod base='/activity/'
```

## 15. 演示数据状态（8-28 重置后）

| 表 | 记录数 | 说明 |
|---|---|---|
| `dw_users` | 7 | 演示账号：frank/operator/volunteer/org-thu/sjtu/szu/participant1（密码 `datawhale123`） |
| `dw_activities` | 1 | NO.049 "AI+X 创造节-清华大学站"（PUBLISHED，confirmedAddress=清华大学A501，startDate=2026-09-15） |
| `dw_applications` | 0 | （A 选项重置后清空） |
| `dw_stage_tasks` | 19 | NO.302-305 INTENT 全 COMPLETED + NO.306-309 RECRUIT 全 COMPLETED + NO.310-314 PREPARE 全 IN_PROGRESS + NO.315-317 EXECUTE 全 PENDING + NO.318-320 REVIEW 全 PENDING |
| `dw_messages` | 19 | 之前测试产生的通知（已清 UNCERTAIN 高亮 + 置顶） |

**演示完整流程**（已跑通）：NO.049 活动发布 → 申请 → 5 维评分 → 审批 → 自动 init 19 子任务 → INTENT/RECRUIT 全完成 → PREPARE 在 IN_PROGRESS 中止（Frank 8-28 23:28 完成演示）

---

v1.0.0 · 2026-08-28 · **项目总览（替代读 240KB PRD + 13 commit log）**
