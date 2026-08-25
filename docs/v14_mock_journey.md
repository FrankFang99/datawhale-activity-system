# v14 7 角色合作动线（Frank 19:46 反馈 Comment 4）

> Frank 原话："要不你模拟一下不同的角色一起合作的动线?让他们完整地经历一次活动,中间的具体的证据提交可以用模拟的数据."

## 0. 模拟场景

**活动**：AI+X 创造节 · 清华大学站（NO.001）
**申请**：APP-2026-205815（NO.012，方逸之 CONFIRMED）
**对接志愿者**：志愿者小李（NO.024，volunteer@x.cn）
**审批运营**：运营小张（NO.023，operator@x.cn）
**5 阶段子任务**：17 条（v13 改后），共 5 阶段

**v1 测试约束**：Frank 一人 7 角色
- ADMIN：Frank 管理员
- OPERATOR：运营小张（NO.023）
- VOLUNTEER：志愿者小李（NO.024）
- ORGANIZER：方逸之（NO.031）/ 清华参与者小王（NO.025）
- ASSISTANT：派生于同校多申请者（v1 自动派角色）
- PARTICIPANT：参与者小赵（NO.028）
- USER：默认注册角色

---

## 1. 完整 7 角色动线（5 阶段 × 7 角色）

### 1.1 阶段 0：申请（CONFIRMED 之前）

| # | 角色 | 行为 | 系统响应 | 截图 |
|---|---|---|---|---|
| 1 | USER（注册用户） | 注册账号 → 浏览活动大厅 → 报名某活动 | USER → PARTICIPANT 升级（打卡后） | — |
| 2 | ORGANIZER（方逸之） | 申请成为活动组织者 → 填 14 字段表单 | dw_applications 创建 → status=SCREENING | v13 截图 01 |
| 3 | OPERATOR（运营小张） | 审批工作台查看 → 通过申请 | status=CONFIRMED + 角色升级 USER→ORGANIZER + 自动创建 5 阶段 17 子任务 | — |
| 4 | OPERATOR | 自动派志愿者（按同校 > 同省 > 同负载硬规则） | dw_applications.volunteerId = NO.024 | — |
| 5 | VOLUNTEER（志愿者小李） | 收到"对接申请"站内消息 | 志愿者工作台看到 | — |

### 1.2 阶段 1：INTENT（确认意向 · 4 子任务 · T-10）

| # | 角色 | 子任务 | 行为 | 进度 |
|---|---|---|---|---|
| 6 | VOLUNTEER | 1 互加飞书好友 | 飞书 IM 互加好友 + 截图上传 | 自核 ✓ → 审核待 → 复核待 |
| 7 | ORGANIZER | 2 阅读并确认行动指南 | 读飞书 docx + 点"上传凭证 + 自核" | 自核 ✓ → 审核待 → 复核待 |
| 8 | ORGANIZER | 3 双方最终确认活动方案 | 填具体时间（日）+ 地点 + 规模 → 同步飞书 base → 自核 | 自核 ✓ → 审核待 → 复核待 |
| 9 | ORGANIZER | 4 飞书日历登记活动 | 志愿者加日历 → 组织者确认 → 自核 | 自核 ✓ → 审核待 → 复核待 |
| 10 | VOLUNTEER | 审核所有 4 个子任务 | 点"审核"通过 | 审核 ✓ → 复核待 |
| 11 | OPERATOR | 复核所有 4 个子任务 | 点"复核"通过 | 复核 ✓ |
| 12 | ORGANIZER | 点底部"解锁下一阶段：对外招募（通知志愿者审核）"按钮 | 后端 `POST /api/applications/:id/notify-volunteer-review` → 发站内信给 volunteer | 阶段切换 |

**截图**：
- `datawhale_screenshots/v14/04_5stage_intent_3tasks_organizer.png`（组织者视角 3 子任务 + 3 步进度）
- `datawhale_screenshots/v14/07_5stage_intent_bottom_organizer.png`（底部"完成本阶段 0/3 项后解锁「对外招募」"）

### 1.3 阶段 2：RECRUIT（对外招募 · 4 子任务 · T-7）

| # | 角色 | 子任务 |
|---|---|---|
| 13 | ORGANIZER | 1 建立活动群聊（飞书/微信/QQ 兴趣群） |
| 14 | ORGANIZER | 2 定制视觉物料（海报/横幅/手举牌/旗帜/推文） |
| 15 | ORGANIZER | 3 启动招募宣传（公众号/朋友圈/微信群/小红书） |
| 16 | ORGANIZER | 4 联系助教 / 主讲嘉宾 |

**ownerType 全是 ORGANIZER**：组织者全包

**截图**：`datawhale_screenshots/v14/05_5stage_recruit_4tasks_organizer.png`

### 1.4 阶段 3：PREPARE（现场筹备 · 3 子任务 · T-3）

| # | 角色 | 子任务 |
|---|---|---|
| 17 | ORGANIZER | 1 确认场地并上传信息（精确地址 + 照片） |
| 18 | ORGANIZER | 2 和助教一起完成实操教程（v2 联动） |
| 19 | ORGANIZER | 3 准备现场物料（邮寄/打印/PPT/相机） |

### 1.5 阶段 4：EXECUTE（活动执行 · 4 子任务 · T）

| # | 角色 | 子任务 |
|---|---|---|
| 20 | ORGANIZER | 1 现场签到与引导 |
| 21 | ORGANIZER | 2 嘉宾分享 + 动手实操（≥3 张现场照片） |
| 22 | ORGANIZER | 3 采集现场素材（横版高清照片，视频可选） |
| 23 | ORGANIZER | 4 引导参与者上传到作品墙获取徽章认证 |
| 24 | PARTICIPANT | 现场签到 → 打卡 → 升级为 PARTICIPANT | USER → PARTICIPANT 升级

### 1.6 阶段 5：REVIEW（活动复盘 · 3 子任务 · T+3 · v13 删 1 运营兜底）

| # | 角色 | 子任务 |
|---|---|---|
| 25 | ORGANIZER | 1 提交活动复盘（含现场素材到飞书文档） |
| 26 | ORGANIZER | 2 推动作品上墙（参与 OPC 能力认证） |
| 27 | VOLUNTEER | 3 志愿者审核作品 + 反馈 + 可推荐优秀 |

**截图**：`datawhale_screenshots/v14/06_5stage_review_3tasks_organizer.png`

---

## 2. Mock 数据样例（关键节点）

### 2.1 申请提交（v3 修订 14 字段）

```json
{
  "organizerName": "方逸之",
  "organizerPhone": "15088028668",
  "organizerEmail": "15088028668@139.com",
  "city": "上海",
  "schoolName": "上海交通大学",
  "campusId": "上海交通大学-闵行校区",
  "expectedPeople": 50,
  "venueAvailable": "有潜在",
  "venueDescription": "可申请学生活动中心或食堂广场",
  "recruitChannel": ["社群", "公众号", "高校社团", "企业园区"],
  "experience": "在英国组织过 'World Fest' 活动，吸引超过 30+ 的社团和 1000+ 的观众入场。领导或参与 30+ 志愿者活动的举行。",
  "expectedDate": "2026-09-19",
  "motivation": "之前就参与过 Datawhale 的活动，有很好的印象...我们需要 Datawhale 这样的实践平台",
  "participantValue": "我希望给初学者提供正向反馈的开端...从已经用 AI 改变自己生活的人那里汲取灵感..."
}
```

### 2.2 5 维评分结果（v1 暂行）

| 维度 | 得分 | 满分 | 理由 |
|---|---|---|---|
| RC-001 场地 | 12 | 20 | 有潜在场地，需协助最终确定 |
| RC-002 招募 | 20 | 20 | 拥有 4 个本地招募渠道，能力强 |
| RC-003 经验 | 14 | 25 | "组织过活动"关键词命中 |
| RC-004 时间 | 15 | 15 | 活动时窗在学期中，9月19日 |
| RC-005 价值 | 8 | 20 | "社群/分享"等关键词 |
| **总分** | **69** | **100** | **B · 中等** |

### 2.3 申请详情（v14 完整返回）

```json
{
  "applicationId": "NO.012",
  "applicationNo": "APP-2026-205815",
  "activityId": "NO.004",
  "userId": "NO.031",
  "status": "CONFIRMED",
  "applicantRole": "PRIMARY",
  "organizerName": "方逸之",
  "organizerPhone": "15088028668",
  "organizerEmail": "15088028668@139.com",
  "expectedDate": "2026-09-20T00:00:00.000+08:00",
  "location": "上海虹口区",
  "motivation": "之前就参与过 Datawhale 的活动，有很好的印象...",
  "experience": "在英国组织过 'World Fest' 活动...",
  "venueStatus": ["有潜在"],
  "recruitChannel": ["社群", "公众号", "高校社团", "企业园区"],
  "volunteerId": "NO.024",
  "score": 69,
  "grade": ["B"],
  "scoreDetails": {
    "RC001": "有潜在场地，需协助最终确定",
    "RC002": "拥有 4+ 个本地招募渠道，能力强",
    "RC003": "组织过活动",
    "RC004": "活动时窗在学期中，9月19日",
    "RC005": "活动价值较高"
  },
  "auditLog": [
    {"action": "VOLUNTEER_ASSIGNED", "operatorId": "NO.023", "volunteerId": "NO.024", "volunteerName": "志愿者小李", "at": 1787288435636},
    {"action": "APPROVE", "operatorId": "NO.023", "fromStatus": "SCREENING", "toStatus": "CONFIRMED", "at": 1787289016292}
  ],
  "riskFlags": {"motivationShort": false, "experienceShort": false}
}
```

### 2.4 5 阶段子任务进度样例

| 阶段 | 子任务 | ownerType | 状态 |
|---|---|---|---|
| INTENT.1 | 志愿者和组织者互加飞书好友 | VOLUNTEER | COMPLETED |
| INTENT.2 | 阅读并确认行动指南 | ORGANIZER | COMPLETED |
| INTENT.3 | 双方最终确认活动方案/时间/地点/规模 | ORGANIZER | PENDING |
| INTENT.4 | 飞书日历登记活动 | ORGANIZER | PENDING |
| RECRUIT.1 | 建立活动群聊 | ORGANIZER | PENDING |
| ... | ... | ... | ... |
| REVIEW.3 | 志愿者审核作品 + 反馈 + 可推荐优秀 | VOLUNTEER | PENDING |

---

## 3. 关键证据提交样例

### 3.1 INTENT.1（志愿者互加飞书好友）证据

```json
{
  "proofUrl": "https://datawhaler.feishu.cn/file/xxxxx",
  "proofType": "screenshot",
  "proofNote": "志愿者小李 + 方逸之 飞书好友关系截图（2026-08-20）",
  "uploadedBy": "NO.024",
  "uploadedAt": 1724080000000
}
```

### 3.2 INTENT.2（阅读并确认行动指南）证据

```json
{
  "docUrl": "https://datawhaler.feishu.cn/docx/K5G8dnWOEoxTC8xgxHHcSUMbni1",
  "confirmedAt": 1724090000000,
  "confirmedBy": "NO.031",
  "ipAddress": "...",
  "legalEffect": true
}
```

### 3.3 INTENT.3（双方最终确认活动方案）证据

```json
{
  "specificDate": "2026-09-20",
  "timeStart": "13:00",
  "timeEnd": "17:00",
  "location": "上海虹口区 XX 高校学生活动中心",
  "expectedSize": 50,
  "syncedToFeishu": true,
  "feishuRecordId": "recvs...",
  "confirmedBy": "NO.031"
}
```

### 3.4 EXECUTE.2（嘉宾分享 + 动手实操）证据

```json
{
  "photos": [
    {"url": "https://datawhaler.feishu.cn/file/photo1", "takenAt": 1724500000000, "caption": "嘉宾分享环节"},
    {"url": "https://datawhaler.feishu.cn/file/photo2", "takenAt": 1724503600000, "caption": "动手实操"},
    {"url": "https://datawhaler.feishu.cn/file/photo3", "takenAt": 1724507200000, "caption": "作品展示"}
  ],
  "videoUrl": "https://datawhaler.feishu.cn/file/video1",
  "uploadedBy": "NO.031"
}
```

---

## 4. 7 角色动线时间线

```
T-10  (8-20) ──┬─ 1. USER 注册 → 浏览活动
                 │   2. ORGANIZER 提交申请 → SCREENING
                 │   3. OPERATOR 审批通过 → CONFIRMED
                 │   4. OPERATOR 派志愿者 (volunteerId=NO.024)
                 │
T-9   (8-21) ──┼─ 5. VOLUNTEER 收"对接申请"站内信
                 │   INTENT.1: 志愿者互加飞书好友
T-8   (8-22) ──┼─ INTENT.2: ORGANIZER 读 + 确认行动指南
T-7   (8-23) ──┼─ INTENT.3: ORGANIZER 填时间地点规模
T-6   (8-24) ──┼─ INTENT.4: ORGANIZER 飞书日历登记
T-5   (8-25) ──┼─ 阶段切换：INTENT → RECRUIT（v14 · 通知志愿者）
                 │
T-4   (8-26) ──┼─ RECRUIT.1: 建立群聊
T-3   (8-27) ──┼─ RECRUIT.2: 定制视觉物料
T-2   (8-28) ──┼─ RECRUIT.3: 启动招募宣传
T-1   (8-29) ──┼─ RECRUIT.4: 联系助教 + 嘉宾
                 │
T-3   (8-27) ──┼─ PREPARE.1: 确认场地 + 照片
T-2   (8-28) ──┼─ PREPARE.2: 实操教程
T-1   (8-29) ──┼─ PREPARE.3: 现场物料
                 │
T     (8-30) ──┼─ EXECUTE.1-4: 现场执行
                 │   PARTICIPANT 签到 → 打卡 → 升级
                 │
T+1   (8-31) ──┼─ 阶段切换：RECRUIT → PREPARE → EXECUTE
T+3   (9-02) ──┼─ REVIEW.1: 提交复盘
T+5   (9-04) ──┼─ REVIEW.2: 推动作品上墙
T+7   (9-06) ──┼─ REVIEW.3: VOLUNTEER 审核
                 │
T+10  (9-09) ──┼─ 活动完结（REVIEW_CONFIRMED）
                 │   后续：报销（v1 暂不模拟）
```

---

## 5. 关键 API 端点（v14 状态）

| 端点 | 用途 | 角色权限 |
|---|---|---|
| `POST /api/applications/submit` | 提交申请 | USER→ORGANIZER |
| `POST /api/admin/applications/:id/approve` | 运营审批 | OPERATOR/ADMIN |
| `POST /api/admin/applications/migrate/v12-stage-tasks` | v12 数据迁移 | ADMIN |
| `POST /api/admin/applications/migrate/v13-stage-tasks` | v13 数据迁移 | ADMIN |
| `GET /api/applications/:id` | **v14 申请详情** | 自己/ADMIN/OPERATOR/VOLUNTEER |
| `GET /api/applications/:id/dispatch` | 同校多申请者分流 | 自己/ADMIN/OPERATOR/VOLUNTEER |
| `POST /api/applications/:id/notify-volunteer-review` | 通知志愿者审核阶段 | ORGANIZER/ASSISTANT/ADMIN/OPERATOR |
| `GET /api/applications/by-activity/:activityId` | 找活动 CONFIRMED 申请 | 所有登录 |
| `GET /api/applications/mine` | 我的申请 | ORGANIZER/ASSISTANT/ADMIN/OPERATOR |

---

## 6. 截图清单（v14 修复后）

| # | 视角 | 文件 | 说明 |
|---|---|---|---|
| 01 | 志愿者 | `01_application_detail_volunteer_v14.png` | **v14 核心修复**：申请详情完整字段填充 + 删跳转按钮 |
| 02 | 运营 | `02_application_detail_operator_v14.png` | 运营视角申请详情 |
| 03 | 清华组织者 | `03_application_detail_organizer_v14.png` | 跨学校组织者 → 无权看（正确鉴权） |
| 04 | 清华组织者 | `04_5stage_intent_3tasks_organizer.png` | **5 阶段 INTENT 3 子任务** + 3 步进度 + "上传凭证+自核"按钮 |
| 05 | 清华组织者 | `05_5stage_recruit_4tasks_organizer.png` | 5 阶段 RECRUIT 4 子任务 |
| 06 | 清华组织者 | `06_5stage_review_3tasks_organizer.png` | **5 阶段 REVIEW 3 子任务**（v13 删 1 运营兜底） |
| 07 | 清华组织者 | `07_5stage_intent_bottom_organizer.png` | INTENT 阶段底部"完成本阶段 0/3 项后解锁「对外招募」" |
| 08 | 运营 | `08_5stage_intent_bottom_operator.png` | 运营视角 INTENT 阶段（无组织者打勾按钮） |

---

## 7. 总结

**v14 7 角色合作动线** 完整覆盖：
- 申请前：USER 浏览 → ORGANIZER 申请 → OPERATOR 审批
- 申请后：VOLUNTEER 对接 + OPERATOR 派志愿者
- 5 阶段 × 17 子任务 × 3 步进度（自核 → 审核 → 复核）
- 阶段切换：ORGANIZER 触发 + 通知志愿者
- 完结：REVIEW → REVIEW_CONFIRMED
- 后续：报销（v1 暂不模拟）

**核心改动（v14）**：
- ✅ 申请详情页填飞书 base 全字段（Frank Comment 1）
- ✅ 删 v13 跳转飞书按钮
- ✅ ownerType tag 解释（Frank Comment 2）
- ✅ 打勾功能 UI 展示（Frank Comment 3）
- ✅ 7 角色动线模拟（Frank Comment 4 · 本文档）
- ✅ 对齐理解文档（Frank Comment 5）
