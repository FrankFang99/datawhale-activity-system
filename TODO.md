# TODO · Datawhale 高校活动智能管理系统

> 待 Frank 联系 Datawhale 推进的事项。**8-25 交付前**必须解决 🔴，其他标记 🟡。
> 来源：2026-08-17 PRD v2 改稿过程中识别。

## 🔴 没有跑不通（必须解决 / 阻塞 v1）

### 1. 飞书企业版权限申请

- **背景**：PRD §11 按企业版设计；个人版能力受限（业务流程功能：审批/通讯录/群消息）
- **现状**：Frank 已申请个人版 app_id；**等企业版 app_id + 权限清单**（附录 A）
- **负责人**：Frank + Datawhale IT
- **影响范围**：§4.1.1 登录 / §4.2.2 审批工作台 / §5.5 通知 IM
- **替代方案**（最坏自建）：
  - 登录：邮箱/手机注册 + 密码
  - 审批：Web 审批工作台（不走飞书审批 API）
  - 通知：邮件 + 站内信（不走飞书 IM）

### 2. 报销审批标准

- **背景**：PRD §4.1.7 报销中心 + §5 报销相关规则都是 v1 暂行版，**未获 Datawhale 财务审批**
- **现状**：等 Datawhale 财务/运营给出：
  - 报销类别（TRANSPORT/ACCOMMODATION/MATERIAL/FOOD/OTHER）的具体限制
  - 发票抬头要求（Datawhale / 上海鲸歌教育科技有限公司）
  - 总金额上限（500 元/校 vs 1000 元/校 vs 特殊）
  - 财务打款周期
- **影响范围**：§4.1.7 / §5 报销状态机 / §12 场景三 OCR

### 3. 5 维评分字段映射 + 阈值 + 权重

- **背景**：§5.1 5 维评分规则 + §5.1.2 字段映射，**业务侧未对齐**（用户原话"等到对齐 AI 评审标准时再说"）
- **现状**：测试数据 11 条脱敏数据**没有"是否通过"或"是否办好"标签** + 样本量少；用户原话 2026-08-18："可以先用 Datawhale 的数据试试，但是现在样本量不够，难以实施"
- **需 Datawhale 给出**：
  - §5.1.7 时间合理性：如何判断"与学期/假期冲突"？如何赋分？
  - **§5.1.7 时间窗是否改为多选 slot**（用户原话 2026-08-18 建议）：给几个时间区间 slot 让申请者多选，**多选 slot = 灵活度高 → 得分更高**（如 1 个→5 / 2-3 个→10 / ≥4 个→15）；字段类型从 `string` 改为 `multi-enum`；待 Datawhale 业务对齐
  - 5 维权重：当前 20/20/25/15/20 是否合理？
  - 阈值：当前 S/A/B/C/D 90/75/60/40 是否合理？
  - 字段映射：每维具体对应表单哪个字段？
- **影响范围**：§5.1 全部 / §4.1.4 申请表单（已 v3 改稿待对齐）

## 🟡 有了更好（nice-to-have / 不阻塞 v1）

### 4. 发票 OCR 测试数据

- **背景**：§12 场景三 发票 OCR + 校验，**暂无测试数据**
- **现状**：等 Datawhale 财务提供 5-10 张脱敏发票样本（含正常/异常）
- **替代方案**：v1 暂用纯规则校验（§4.1.7），OCR 待切片 5 启动
- **影响范围**：§12.4 发票 OCR / §4.1.7 报销流程

### 5. 飞书企业版 OAuth 共用身份

- **背景**：用户原话"等待是否能取得与 Datawhale 官网共用身份认证的机会"
- **现状**：等 Datawhale IT 确认是否能打通企业版 OAuth
- **替代方案**（不能共用）：自建邮箱/手机注册 + 密码
- **影响范围**：§4.1.1 登录 / §4.1.9 个人中心 + 密码修改

### 6. PRD §5 / §12 详细规则标"未经 Datawhale 确认"

- **背景**：之前 AI 写过的详细规则（§5 报销状态机 + §12 OCR 3/12 规则 + §5.3 志愿者分配），**未经 Datawhale 确认**
- **建议**：在 PRD 相应位置加 ⚠️ 警告标记
- **影响范围**：§4.1.7 / §5 / §12

### 7. 申请表单 v2 字段改进空间

- **背景**：用户原话"虽然我觉得有提升空间，等到对齐 AI 评审标准的时候再说"
- **现状**：§4.1.4 v2 改稿为暂行版，**正式版待 §5.1 5 维评分对齐后定稿**
- **影响范围**：§4.1.4 申请表单

### 8. 外部用户飞书 IM（付费功能 · v2 启用）

- **背景**（用户原话 2026-08-19）："飞书也可以通过自动化工作流等方式给企业外部的指定用户/群组发送消息（**付费功能**），可以先跑通保底的方式（比如**邮件**）通知外部用户。**这个功能（外部飞书 IM）也先写上**，需要 Frank 手动配置。**默认外部人士都已有个人版飞书**"
- **现状**：v1 走保底——所有外部用户仅 **邮件 + 站内信**；v2 启用后追加飞书 IM（个人版）通道
- **依赖**：
  - 🔴 第 1 项 飞书企业版权限（先拿到企业版 app_id）
  - 🟡 第 5 项 官网 OAuth 共用身份（可选，不强依赖）
  - 飞书后台申请"企业外部联系人"能力（**付费项**，按调用量计费）
  - 申请"应用权限" `im:message` / `im:message:send_as_bot` / `contact:user.employee_id:readonly`
- **手动配置 SOP**：详见 `PRD.md` §11.6（6 步：飞书后台开通 → 白名单 → `.env` 配置 → 后端代码启用 → 灰度 10% → 文档通知）
- **影响范围**：§5.5 通知策略 / §5.6 飞书能力使用 / §11.2 个人版能力清单 / §11.6 启用步骤

### 9. 同校多申请者处理流程 + REVIEW 阶段运营兜底机制

- **背景**（用户原话 2026-08-20）：
  1. "对于同一所学校多人同时申请为组织者的情况，**尽量交给同一个志愿者处理和沟通**，最终确定一个成为组织者（**无法抉择也可以询问运营**），剩余的人由志愿者通知，看看愿不愿意担任其他角色(**助教等**)"
  2. "**运营不是完全不参加陪跑，而是尽量不参加**，如果志愿者有事情无法确认，和运营联系就是**兜底措施**"
- **现状**（2026-08-21 v9 续 B.1 完整版）：
  - ✅ v1 简化：submit 路由自动 detectApplicantRole + 写 applicantRole 字段 + 站内消息（含群二维码 + 助教提示）
  - ✅ dw_applications 加 `applicantRole` (PRIMARY/ASSISTANT) 字段
  - ✅ dispatch 纯函数 30 测试覆盖（含 5 个 ACTIVE_ORGANIZER_STATES 状态边界）
  - ❌ v1 暂不做：志愿者门户同校合并提示 / 运营兜底升级 / WITHDRAWN_AS_ASSISTANT 状态 / escalation_requests 表
- **需 Datawhale 推进**：
  - 🔴 **业务确认**（8月第3周会议）：助教角色是否走 5 阶段？助教工作范围/报酬？助教是否计入报销？
  - 🟡 **功能落地**（v2）：
    - 志愿者门户加"同校申请合并"提示（§5.3.3 权重 10000）
    - 加 EVT-022 / EVT-023 / EVT-024 通知事件
    - dw_applications 加 `assistantForApplicationId` / `decidedBy` / `decidedAt` / `decisionReason` 字段 + `WITHDRAWN` / `WITHDRAWN_AS_ASSISTANT` 状态
    - 运营后台加"志愿者求助"列表（`dw_escalation_requests` 表）
  - 🟡 **流程对齐**：志愿者超时阈值（建议 7 天） / 争议上报路径
- **影响范围**：
  - `PRD.md` §3.2 US-V4 INTENT/REVIEW 阶段 / §4.2.2 审批工作台 / §5.3.3 匹配算法 / §5.3.5 同校多申请者（新）/ §5.4.2-5.4.4 任务流转 / §5.5.2 事件映射表 / §7.2 dw_applications 字段
  - 验证用例 §10 AC6（5 阶段验收）需要补充同校合并 / 助教转化 / 运营兜底 3 条用例

## 跟进方式

- Frank 联系 Datawhale 推进 🔴 项 1/2/3
- 切片 1（08-20）实测飞书个人版能力，回填 §11.2 表格
- 切片 5（08-23）启动前，确认 OCR 测试数据到位（🟡 项 4）
- 🟡 第 8 项 等 🔴 第 1 项（企业版权限）到位后，启动 §11.6 步骤 1
- 🟡 第 9 项 8月第3周业务会议对齐助教机制 + 运营兜底阈值
- 每推进一项，更新本 TODO 文件（已完成的标 ✅ + 移到末尾）


---

# v1 上线准备报告（2026-08-21 08:21 · Frank "按 PRD 逐个检查 + TDD" 目标累积）

## v1 范围（已完成 80%+ PRD）

**核心功能**（全部 work）：
- 注册/登录（ORGANIZER 邮箱）
- 5 角色工作台（ADMIN / OPERATOR / VOLUNTEER / ORGANIZER / PARTICIPANT / ASSISTANT）
- 活动大厅（系列/状态筛选 + 详情）
- 申请表单（14 字段 + 5 维评分）
- 审批工作台（详情 3 tab + AI 草拟意见 + 分配志愿者）
- 5 阶段任务看板（22 子任务 + 自动解锁）
- 报销中心
- AI 助手（33 FAQ 关键词匹配 + 反馈 + 历史）
- 活动管理（admin/operator CRUD + 上下架）
- 参与者报名（dw_participants）
- 站点兴趣登记（dw_interests）
- 邮件通知 stub（console.log + dw_chat_logs）
- 飞书群二维码
- 5 角色工作台 + 路由 RoleGuard
- 个人中心（资料 + 改密）
- 站内消息（6 类型 + Bell Badge）
- 通知日志（admin 端 log/stats/resend）
- 同校多申请者分流（PRIMARY/ASSISTANT 纯函数 + submit 集成 + 站内消息）
- 物料下载（dw_materials 6 类 2 范围）

## v1 上线硬节点 8-25 准备

### 测试覆盖（2026-08-21 v9 续 B.1 完整版）

后端 14 测试集 / 229 测试（1.86s）
前端 2 测试集  /  13 测试
总计 242 测试全过

测试包括：
- 5 维评分（33 原有 + 7 edge = 40）
- JWT / bcrypt / Response 契约（14）
- auth middleware + requireRole 5 角色（10）
- 5 阶段 22 子任务模板（11）
- 申请状态机（44）：状态流转 + 重复申请 + 活动校验 + 日期校验
- 5 阶段解锁（21）：阶段完成 + 进度 + 解锁判定
- messages 路由 + admin schema（18）
- users 个人中心 schema（15）
- 同校分流 detectApplicantRole（30）：v8 17 + v9 续 13（多 CONFIRMED / 5 个 ACTIVE_ORGANIZER_STATES 状态 / getDispatchNotice 边界）
- applications controller（15）：submit 集成 dispatch + 路由覆盖 + 鉴权 + 状态机集成
- materials 物料（11）：5 路由 + 鉴权 + 6 类型 + 2 范围 + 路由顺序
- 6 角色权限测试（5 角色 + 路由 403 截图）
- 5 角色布局菜单（8）

### 服务状态

- 后端 4000 ✅（detached 模式，新 controller 自动 reload）
- 前端 5173 ✅
- 飞书 Base 11 张表全建好（dw_users/activities/applications/stage_tasks/reimbursements/chat_logs/participants/interests/messages/materials/auto_id）
- 飞书 dw_applications 加 applicantRole 字段（fldNtTm8mA）

### 测试账号

统一密码 `datawhale123`：

| 角色 | 邮箱 | 用途 |
|---|---|---|
| ADMIN | frank@datawhale.cn | 数据看板 + 审批 + 活动管理 + 通知日志 |
| OPERATOR | operator@x.cn | 审批 + 报销审核 + 活动管理 + 通知日志 |
| VOLUNTEER | volunteer@x.cn | 我对接的申请 + 5 阶段任务审核 |
| ORGANIZER | org-thu/sjtu/szu@x.cn | 活动大厅 + 我的申请 + 任务看板 + 报销 |
| PARTICIPANT | participant1/2@x.cn | 活动大厅 + 我的报名 |

### 一键跑测试

```bash
powershell -ExecutionPolicy Bypass -File D:\Learning\AI\Datawhale\scripts\test-all.ps1
# 后端 229 + 前端 13 + Selenium 5 角色回归（全过）
```

### v1 上线前 Frank 需要做的 9 件事

按 TODO.md §1-9（按优先级降序）：

#### 🔴 必修（阻 v1 上线）

1. **飞书企业版 app_id + secret**（TODO §1）：当前用个人版，1 优先级
2. **报销审核标准**（TODO §2）：5 类目细节 + 总额上限 + 100/1000/特殊规则 + 打款周期
3. **5 维评分业务对齐**（TODO §3）：20/20/25/15/20 权重 + S/A/B/C/D 阈值（v1 已按 PRD 跑，Datawhale 业务确认）
4. **物料管理运营 SOP**（TODO §7）：dw_materials 表已建好，缺运营上传物料 SOP + Datawhale 物料清单（海报/PPT/二维码）

#### 🟡 Nice-to-have（不阻 v1）

5. **发票 OCR 测试数据**（TODO §4）：5-10 张新发票等 Datawhale 业务提供
6. **5 维评分字段详细改进**（TODO §3）：v2 字段升级 multi-enum
7. **PRD §5/§12 详尽规则**（TODO §6）：等 Datawhale 业务确认

#### 🔵 强需求（v2 路线）

8. **飞书 IM 自动入群**（TODO §8）：企业版 OAuth + 群机器人
9. **同校多申请者完整流程**（TODO §9）：US-V4 助教派生 ✅ v1 已自动派 + 运营兜底 + 升级流程（v2）

### 已知限制（v1 上线时心里有数）

1. 邮件通知是 console.log（v2 接 SMTP）
2. 飞书群二维码是 URL（v2 上传图片到飞书）
3. 5 维评分用 location 判同校（v2 改 user.school）
4. 站内消息是 In-App（v2 加飞书 IM）
5. OCR 报销暂未实现（v2 接入）
6. 部署到 datawhale.cn/activity/ 待 Frank 提供域名/服务器
7. 同校分流仅 v1 自动派角色（v2 加志愿者合并提示 + 运营兜底升级）

### 验收截图位置

`C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\`
- v1-v6 主流程截图（home, approval, stage_board, profile, inbox, notif_log）
- role_admin/operator/volunteer/organizer/participant 工作台对比
- v5_5role_roleguard.png 路由 403 验证
- v9_material_manager.png 物料管理

### 文档

- README.md v1.0.0
- ACCEPTANCE.md v1.1 → v1.9（含 v1-v9 + v9 续 B.1 全部变更）
- TODO.md 待 Frank 推动
- docs/ACCEPTANCE.md §0-18（详细）
