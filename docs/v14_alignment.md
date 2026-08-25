# v14 对齐理解文档（Frank 2026-08-23 19:46 反馈）

> v1 上线倒计时：2 天（2026-08-25 硬节点）
> 本文档回应 Frank 19:46 反馈的 4 个新问题 + 1 个对齐需求

---

## 0. v14 范围（v13 ship 后增量）

| # | 项 | 状态 | 备注 |
|---|---|---|---|
| 1 | 申请详情页要根据飞书 base 填充（不跳转） | ✅ 已修 | 后端 `GET /api/applications/:id` 扩展 15 字段 + 删 v13 跳转按钮 |
| 2 | ownerType tag 用意 | 📋 解释 | 不删，UI 加 tooltip |
| 3 | 打勾功能 | 📋 解释 | 已实现（"上传凭证 + 自核"按钮） |
| 4 | 7 角色合作动线模拟 | ✅ 已做 | `docs/v14_mock_journey.md` |
| 5 | 对齐理解 | ✅ 本文档 |  |

---

## 0.5 v15 范围（Frank 2026-08-23 20:49 反馈）

| # | Frank 反馈 | 实施范围 | 状态 |
|---|---|---|---|
| 1 | "如果这是你说的打勾的地方，那不能换一下我们的UI设计方案，除了字太小，也没人知道这里需要打勾" | **v15 SubTaskCard 改版** | ✅ 已改 |
| 2 | "暂时保留一下, 但是我想如果可以放在和子任务描述同一行,是不是可以省下一行的空间, 后面的字体可以大一些. 我现在看不到打勾的效果,你可以通过某个活动模拟一下吗?" | **v15 ownerType 同行 + 字号大 + mock step1** | ✅ 已做 |
| 3 | "这个UI确实有点丑, 分布不太合理, 也没有留下上传文件的通道和打勾确认/审核的地方" | **v15 3 步进度横向 + 上传凭证显式 + 大按钮** | ✅ 已改 |
| 4 | "能说一下我们的测试每一条都测了哪些流程吗?" | **v14_test_coverage.md** | ✅ 已写 |
| 5 | "继续对齐理解" | **本文档 v15 章节** | ✅ 已做 |

### v15 改版核心变更（Frank 20:49 反馈 Comment 1+2+3）

#### 1. ownerType tag 同行 + 字号大（Frank 反馈 2）
- **位置**：从第二行（独立 Space）改到第一行**同行右侧**（v15 行内）
- **样式**：圆角胶囊（borderRadius: 14）+ 14px 字体 + 半透明背景色（v15 bg/fg 对比）
- **图标**：emoji 🟢/🔵/🟠 强化视觉
- **示例**：`<div style={{ background: '#ECFDF5', color: '#10B981', padding: '4px 12px', borderRadius: 14, fontSize: 14 }}>🟢 组织者</div>`

#### 2. 3 步进度横向布局（Frank 反馈 1+3）
- **原 v10/v13 布局**：纵向 3 行（在独立 block 内，字号 11/12）
- **v15 新布局**：横向 3 列（一行可见，步骤间连接线）
- **步骤可视化**：
  - 圆圈（32x32 + 圆角 16）
  - 完成：绿色背景 + ✓ 白色
  - 拒绝：红色背景 + ✗ 白色
  - 激活：蓝色背景 + 序号 + 4px 蓝色 box-shadow 圈
  - 未激活：灰色背景 + 序号灰色
- **连接线**：步骤间 20x2 矩形，颜色 = 上一状态（绿色完成 / 灰色未完成）

#### 3. 上传凭证 + 自核大按钮（Frank 反馈 3）
- **原 v10/v13 按钮**：`<Button size="small">上传凭证 + 自核</Button>`（小尺寸）
- **v15 新按钮**：`<Button size="middle" style={{ height: 36, fontSize: 14, fontWeight: 600 }}>📎 上传凭证 + 自核</Button>`
- **志愿者按钮**：`<Button size="middle" type="primary">志愿者审核（通过/打回/无法判断）</Button>` — **完整写明 3 个 action**
- **运营按钮**：`<Button size="middle" type="primary" ghost>运营复核（通过/打回）</Button>`

#### 4. 凭证显式可见（Frank 反馈 3 "没有留下上传文件的通道"）
- **原 v10/v13**：凭证 URL 只在 Modal 内输入，卡片上只显示"凭证"链接（如果有）
- **v15 新布局**：卡片上**独立行**显示凭证：
  ```
  📎 查看凭证   2026/8/23 20:56:11
  ```
  - 凭证 URL 可点击
  - 提交时间戳
  - 即使没凭证，提交按钮也清晰可见

#### 5. mock step1 状态（Frank 反馈 2 "我现在看不到打勾的效果"）
- **mock 方式**：用 lark-cli +record-upsert 把 NO.037（INTENT.2 双方最终确认 · ORGANIZER）的 `organizerSubmittedAt` + `proofFile` 字段填上
- **Frank 看效果**：登录任意角色 → /activities/NO.001 → INTENT 阶段 → 看到"双方最终确认活动方案/时间/地点/规模"卡片：
  - 凭证链接 + 2026/8/23 20:56:11 时间戳
  - 步骤 1 ✓ 组织者自核（绿色 ✓）
  - 步骤 2 志愿者审核（蓝色激活，等志愿者打勾）
  - 步骤 3 灰色
  - 底部"组织者已自核 · 等待志愿者审核" tag
  - 操作按钮根据角色：
    - 志愿者：志愿者审核大按钮
    - 运营：运营复核大按钮
    - 组织者：无按钮（已自核）

### v15 截图清单（7 张）

| 文件 | 视角 | 关键证据 |
|---|---|---|
| `01_5stage_intent_v15_organizer.png` | 清华组织者 | 3 子任务 v15 UI + mock step1 ✓ |
| `02_intent_2_mock_step1_organizer.png` | 清华组织者 | INTENT.2 mock 特写 |
| `03_5stage_recruit_v15_organizer.png` | 清华组织者 | 4 子任务 v15 UI |
| `04_5stage_review_v15_organizer.png` | 清华组织者 | 3 子任务 v15 UI（v13 删 1 运营兜底） |
| `05_5stage_intent_bottom_v15_organizer.png` | 清华组织者 | 底部 v15 提示块 |
| `06_5stage_intent_v15_operator.png` | 运营 | 运营视角大按钮（运营复核） |
| `07_5stage_intent_v15_volunteer_mock.png` | 志愿者 | 志愿者视角大按钮（志愿者审核） |

### v15 测试

| 类型 | v14 | v15 | 合计 |
|---|---|---|---|
| 后端 | 334 | 0 | **334** |
| 前端 | 78 | 0 | **78** |
| **合计** | **412** | 0 | **412 全过** |
| 截图 | 107 | +7 | **114** |

### v15 关键文件

```
frontend/src/pages/ActivityDetail.tsx        # v15 SubTaskCard 重构（300+ 行）
docs/v15_alignment.md                         # v15 改版说明（本文）
docs/v14_test_coverage.md                    # Comment 4 测试覆盖
docs/ACCEPTANCE.md §27                       # v15 验收记录
datawhale_screenshots/v15/                   # 7 张 v15 截图
```

---

## 1. 申请详情页要根据飞书 base 填充（核心阻塞 · 已修）

### 1.1 根因（v13 留下的问题）

**后端 `GET /api/applications/:id`（v13）只返回 4 个核心字段**：
- applicationId / applicationNo / activityId / status
- applicantRole / submittedAt
- score / grade / scoreBreakdown（仅审核后）

**完全不返回**飞书 base 里的 15 个字段：
- organizerName / organizerPhone / organizerEmail
- expectedDate / location / motivation / experience / participantValue
- venueStatus / recruitChannel
- volunteerId / volunteerName
- scoreDetails / auditLog / riskFlags

**前端 ApplicationReview.tsx 定义了所有 15 个字段**，但都是 undefined → 显示"—"（截图证据：Frank 19:46 反馈"联系手机 — / 联系邮箱 — / 预期日期 —"）

### 1.2 v14 修复

**后端 controller.ts:389-440 改造**：
- 返回 14+ 字段（organizerName/Phone/Email/expectedDate/location/motivation/experience/participantValue/venueStatus/recruitChannel/volunteerId/volunteerName）
- 解析 scoreDetails JSON（5 维 reason 文本）
- 解析 auditLog JSON（来自 scoreBreakdown.auditLog）
- 计算 riskFlags（motivation<30 字 / experience<20 字）
- volunteerName 兜底 null（飞书 base 没填时）

**前端 ApplicationReview.tsx 修改**：
- ❌ 删 v13 顶部"在飞书中查看完整记录"按钮（Frank 否决跳转方案）
- ❌ 删"本页面展示申请摘要"Alert（因为现在就是完整数据）
- ✅ 顶部"志愿者 NO.024"tag 加 Tooltip（解释不是 ownerType 字段）

### 1.3 隐私策略

**志愿者/运营完整可见手机/邮箱**（脱敏反而不利于志愿者对接申请者）
- v1 测试模式：Frank 一人 7 角色，"完整显示"是合理选择
- 未来 v2 飞书企业版 OAuth 后，可加"按角色脱敏"逻辑

### 1.4 验证（截图见 `docs/ACCEPTANCE.md §26`）

| 视角 | 截图 | 关键字段 |
|---|---|---|
| 志愿者 | `datawhale_screenshots/v14/01_application_detail_volunteer_v14.png` | 申请人/手机/邮箱/活动 ID/角色/日期/地点/场地状态/招募渠道/AI 评分/申请原文 全有 |
| 运营 | `datawhale_screenshots/v14/02_application_detail_operator_v14.png` | 同上 |

---

## 2. ownerType tag 用意（不删，UI 加解释）

### 2.1 用意

`ownerType` 是 SUBTASK_TEMPLATES 字段（在 `frontend/src/data/stageSubtasks.ts` 和 `backend/src/modules/stages/controller.ts`），3 个值：
- `ORGANIZER`（组织者打勾）
- `VOLUNTEER`（志愿者打勾）
- `OPERATOR`（运营打勾）

**核心用意**：明确"谁负责"打勾这个子任务——这是**权限/责任分工**标识，类似项目管理的 RACI 责任矩阵。

**例**：5 阶段 INTENT 阶段 4 个子任务（v13 改后）：
- 1 志愿者和组织者互加飞书好友 → `ownerType=VOLUNTEER`（志愿者建好友关系）
- 2 阅读并确认行动指南 → `ownerType=ORGANIZER`（组织者读 + 勾）
- 3 双方最终确认活动方案 → `ownerType=ORGANIZER`（组织者填时间地点规模）
- 4 飞书日历登记活动 → `ownerType=ORGANIZER`（志愿者加日历，组织者确认）

**避免越权**：志愿者无法勾选"组织者"任务，反之亦然。

### 2.2 重要：和申请详情页"志愿者"tag 是不同字段

Frank 可能混淆了：
- **ownerType**（5 阶段子任务字段，区分打勾权限）— 19 个子任务
- **volunteerId/volunteerName**（申请字段，dw_applications.volunteerId）— 1 条申请 1 个对接志愿者

申请详情页顶部显示的"志愿者 NO.024"tag 是后者（对接该申请的志愿者 ID），不是 ownerType。

### 2.3 v14 改动

✅ 不删 ownerType
✅ 不删申请详情页"志愿者"tag
✅ 给"志愿者"tag 加 Tooltip：
```
"对接这个申请的志愿者 ID（来自 dw_applications.volunteerId 字段）— 注意：和 5 阶段子任务的 ownerType（打勾权限）是不同概念"
```

---

## 3. 打勾功能（已实现 · 已加强展示）

### 3.1 现状

**3 步进度**（每个子任务卡片内嵌）：
1. **组织者自核**（需上传凭证 + 打勾）
2. **志愿者审核**（需先自核完成）
3. **运营复核**（需志愿者审核完成）

**"上传凭证 + 自核"按钮**：仅当 `ownerType=ORGANIZER` 且当前用户角色匹配时显示
- 截图证据：`datawhale_screenshots/v14/04_5stage_intent_3tasks_organizer.png`
- 截图证据：`datawhale_screenshots/v14/07_5stage_intent_bottom_organizer.png`

**底部"进入下一阶段"按钮**（v13 Frank 14:12 反馈 Comment 6）：
- 当前阶段所有子任务 COMPLETED → 激活（仅组织者可点 + 通知志愿者）
- 未完成 → 灰色锁定 + 提示"完成本阶段 N 项后激活"
- 截图证据：`datawhale_screenshots/v14/07_5stage_intent_bottom_organizer.png`

### 3.2 Frank 没看到的原因

**猜测**：Frank 在 NO.001 活动截图时，登录的是 ORGANIZER 但还没切到 5 阶段 Tab（活动详情页默认是顶部信息卡片）。5 阶段 SubTaskCard 在页面中下部，需要滚动 + 切到对应阶段 Tab。

**v14 加强**：
- ✅ 顶部"3 步进度"提示块已加 icon 和说明（v10 已实现）
- ✅ 每个子任务有"上传凭证 + 自核"按钮（v8 已实现）
- ❌ 不动 SubTaskCard 结构（8-17 教训严守范围）

---

## 4. 多角色合作动线模拟（已做 · 见 v14_mock_journey.md）

详见 `docs/v14_mock_journey.md`

---

## 5. 系统设计对齐理解（v14 整体架构）

### 5.1 数据流

```
┌─────────── 用户层 ───────────┐
│ ADMIN (1) │ OPERATOR (1) │ VOLUNTEER (1) │ ORGANIZER (1) │ ASSISTANT (派生) │ PARTICIPANT (派生) │ USER (默认) │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                  ↓ JWT
┌─────────── 应用层 ───────────┐
│ Frontend (React 5173)  →  Backend (Express 4000)  →  Feishu Base (T3lJbRN7LaqdQqs3AlUchCxLnKb)
│                                                                                (11 张表)
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 11 张飞书表

| 表 | table_id | 用途 |
|---|---|---|
| dw_users | tblI7XAVJsXh2lRz | 7 角色用户 |
| dw_activities | tblg4WP41rKbilJR | 活动（11 城市/30+ 商圈/级联） |
| dw_applications | tblZRjMNbwNCDHwq | 申请（v14 返回 14+ 字段完整） |
| dw_stage_tasks | tblw8ZI45cUslzXl | 5 阶段子任务（v13 19 条） |
| dw_materials / dw_reimbursements / dw_participants / dw_interests / dw_messages / dw_chat_logs / dw_faqs / dw_notification_logs | — | 其他 |

### 5.3 5 维评分（v1 暂行 · TODO 业务对齐）

| 维度 | 满分 | 字段 |
|---|---|---|
| RC-001 场地 | 20 | venueStatus |
| RC-002 招募 | 20 | recruitChannel（多选） |
| RC-003 经验 | 25 | experience |
| RC-004 时间 | 15 | expectedDate |
| RC-005 价值 | 20 | motivation + participantValue |

### 5.4 状态机

申请：DRAFT → SUBMITTED → SCREENING → CONFIRMED/REJECTED
阶段任务：PENDING → COMPLETED（3 步：自核 → 审核 → 复核）

### 5.5 隐私策略

- 手机/邮箱：志愿者/运营完整可见（v1 测试模式 Frank 一人 7 角色）
- AI 评分：申请未审核前不展示（避免先入为主）；审核后展示 scoreDetails/auditLog
- 飞书 IM：v1 站内信（v2 飞书 IM 个人版/企业版）

### 5.6 已知 v1 限制

- 邮件通知 console.log stub（v2 SMTP）
- 飞书群二维码 URL 运营手工 + 系统校验格式
- 5 维用 location 判同校（v2 改 user.school）
- 站内消息 In-App（v2 飞书 IM）
- OCR 报销 v1 纯规则（v2 接 PaddleOCR）
- lark-cli 句柄累积（detached 模式 + 偶尔重启）
- 部署域名 datawhale.cn/activity/ 待提供
- 同校多申请者完整流程仅自动派角色（v2 升级完整流程）

---

## 6. Frank 待拍板项（不强 UI 改动 / 等拍板）

| # | 项 | Frank 拍板 |
|---|---|---|
| 1 | 隐私字段志愿者完整可见 vs 脱敏 | 默认完整（待拍板调整） |
| 2 | ownerType 标签 tooltip 解释 | 待确认（截图证据 04_5stage_intent 已展示） |
| 3 | 打勾功能是否需要 UI 加强 | 暂不动 SubTaskCard（截图 04 + 07 已展示） |
| 4 | 7 角色动线是否要补更多截图 | 详见 v14_mock_journey.md |

---

## 7. 测试覆盖（v14）

| 类型 | 文件 | 测试数 | 状态 |
|---|---|---|---|
| 后端 applications controller | controller.test.ts | 24（v13 16 + v14 8） | ✅ 全过 |
| 后端 total | 20 文件 | **334**（v13 326 + v14 8） | ✅ 全过 |
| 前端 total | 7 文件 | 78 | ✅ 全过 |
| 截图 | 8 张 v14 | — | ✅ |
| **合计** | — | **412 测试 + 8 截图** | ✅ |

---

## 8. 关键文件清单

```
backend/src/modules/applications/controller.ts        # v14 GET /:id 扩展 15 字段
backend/src/modules/applications/controller.test.ts   # v14 新增 8 测试
frontend/src/pages/ApplicationReview.tsx              # v14 删 v13 跳转按钮
docs/v14_alignment.md                                  # 本文档
docs/v14_mock_journey.md                               # Comment 4 mock 动线
docs/ACCEPTANCE.md §26                                # v14 验收记录
datawhale_screenshots/v14/                            # 8 张 v14 截图
```
