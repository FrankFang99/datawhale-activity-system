# 周五 2026-08-28 演示 SOP · Datawhale 高校活动智能管理系统 v1.0

> 飞书会议共享屏幕场景 · 本地前后端 + Frank 账号
> 演示时长建议 20-30 分钟 · 配截图回放

## 演示前 5 分钟

### 1. 启动服务（如果没跑）

```powershell
# Backend
cd D:\Learning\AI\Datawhale
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d D:\Learning\AI\Datawhale\backend && npm run dev" -WindowStyle Hidden

# Frontend
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d D:\Learning\AI\Datawhale\frontend && npx vite" -WindowStyle Hidden

# 等 5 秒
Start-Sleep 5

# 验证
Test-NetConnection 127.0.0.1 -Port 4000  # 应 True
Test-NetConnection 127.0.0.1 -Port 5173  # 应 True
```

### 2. 准备截图（备份用，演示出错时展示）

```powershell
cd D:\Learning\AI\Datawhale
python frontend\scripts\screenshot_5roles.py
# 14 张截图存到 C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\real_v1.2\
```

### 3. 打开浏览器

- Chrome 无痕模式：`Ctrl + Shift + N`
- 访问：`http://127.0.0.1:5173`
- 缩放：100%（1440×900 视口）

## 演示账号（统一密码 `datawhale123`）

| 角色 | 邮箱 | 演示场景 |
|---|---|---|
| **ADMIN** | `frank@datawhale.cn` | 数据看板 + 审批工作台 + 活动管理 + 通知日志 |
| OPERATOR | `operator@x.cn` | 审批 + 报销审核 + 活动管理 |
| VOLUNTEER | `volunteer@x.cn` | 我对接的申请 + 5 阶段任务审核 |
| ORGANIZER | `org-thu@x.cn` | 活动大厅 + 我的申请 + 任务看板 |
| PARTICIPANT | `participant1@x.cn` | 活动大厅 + 我的报名 |

## 演示路径（20-30 分钟）

### 1. 公开页 · 活动大厅（3 分钟）

- 打开 `http://127.0.0.1:5173`（未登录态）
- 介绍：3 个 AI+X 创造节活动卡片（复旦 / 清华 / Test-1）
- 重点：**搜索 + 系列筛选 + 状态筛选**
- 点"AI+X 创造节 - 清华大学站" → 活动详情页 → 介绍 AI 评分逻辑（5 维）

**话术**：
> "这是公开页，未登录也能浏览。我们支持按系列/状态/搜索筛选活动，每张卡片都展示 AI 5 维评分和评分等级。"

### 2. 管理员视角（5 分钟）

#### 2.1 登录 Frank
- 点右上角"登录" → 邮箱 `frank@datawhale.cn` + 密码 `datawhale123`
- 自动跳到活动大厅（管理员也能浏览）

#### 2.2 数据看板
- 点菜单"数据看板" → `/admin/dashboard`
- 介绍：4 个 KPI 卡片（申请数 / 通过数 / 进行中 / 志愿者数）
- 介绍：5 维评分分布图

**话术**：
> "这是管理员工作台。可以看到全平台的申请总数、转化漏斗、5 维评分分布。"

#### 2.3 审批工作台（**重点演示 v1.2 修复**）
- 点菜单"审批工作台" → `/admin/approvals`
- 介绍：**初审 (0) / 复审 (2) 两个 Tab**（v1.2 修复：之前只显示初审 0 条让人误以为没工作）
- 点"复审" Tab → 展示 2 条待复审申请
- 点任意一条 → 右侧 Drawer 展示**申请原文 / AI 评分 / 审核日志 3 个 Tab**
- 重点展示 **AI 草拟意见**（点"AI 草拟"按钮）

**话术**：
> "审批工作台支持初审 / 复审两个状态分流。点开任意一条，可以看到 AI 自动草拟的审核意见，包括评分理由、风险提示。运营可以采纳 AI 意见，也可以手动修改。"

#### 2.4 活动管理 + 通知日志
- 点菜单"活动管理" → 上下架活动
- 点菜单"通知日志"（如果有）→ 站内消息 / 重发

### 3. 组织者视角（5 分钟）

#### 3.1 切换账号
- 点右上角头像 → 退出登录
- 登录 `org-thu@x.cn` / `datawhale123`

#### 3.2 我的申请
- 点菜单"我的申请" → 清华小王
- 如果空状态：点"去活动大厅看看" → 选一个活动 → 点"申请成为组织者"
- 介绍：14 字段申请表单 + 5 维评分实时计算

#### 3.3 任务看板（5 阶段）
- 如果有申请 → 点"详情" → 点"任务看板"
- 介绍：5 阶段 22 子任务 + 自动解锁

### 4. 志愿者视角（3 分钟）

#### 4.1 切换账号
- 退出 → 登录 `volunteer@x.cn` / `datawhale123`

#### 4.2 我对接的申请
- 自动跳到"我对接的申请"
- 展示 4 个 KPI（对接总数 / 待办 / REVIEW 中 / 已结案）
- 展示 4 条申请列表 + 评分

**话术**：
> "志愿者看到的是自己对接的申请。按待办优先级排序，每条都显示 AI 评分。"

### 5. 参与者视角（2 分钟）

#### 5.1 切换账号
- 退出 → 登录 `participant1@x.cn` / `datawhale123`

#### 5.2 我的报名
- 点菜单"我的报名" → 空状态

### 6. 暗色模式 + 404（2 分钟）

- 点右上角 🌙 主题切换 → 暗色模式
- 访问 `http://127.0.0.1:5173/random-page` → 404 大渐变数字页

**话术**：
> "v1.2 加了暗色模式和 404 错误页，方便长时间使用。"

## 演示 Q&A 预案

| 问题 | 回答 |
|---|---|
| 数据存在哪？ | 飞书个人版 Base（11 张表，详见 DEPLOY.md） |
| 性能怎么样？ | 首屏 1.5-3s（飞书单次查询 1-1.5s） |
| 支持企业版 SSO 吗？ | v1 走邮箱注册，v2 接飞书企业版 OAuth |
| OCR 发票识别？ | v2 启动，等 Datawhale 财务提供测试数据 |
| 部署到哪？ | 本周内提供 Dockerfile + docker-compose，部署到 datawhale.cn/activity/ |
| AI 评分哪里来？ | 5 维规则评分（场地 20% / 招募 20% / 经验 25% / 时间 15% / 价值 20%） |
| 怎么保证数据合规？ | 飞书 Base + 飞书权限管控，所有外部用户走邮件 + 站内信 |

## 演示后 5 分钟

### 1. 截图归档

```powershell
# 拷贝截图到项目
Copy-Item -Path "C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\real_v1.2\*" `
          -Destination "D:\Learning\AI\Datawhale\docs\demo-2026-08-28\"
```

### 2. 关闭服务

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 3. 反馈记录

- 演示完立刻问 Frank 哪些功能需要调整
- 更新 TODO.md（如果有问题）

## 服务状态检查（如果演示卡住）

```powershell
# Backend 日志
Get-Content "$env:TEMP\datawhale_backend.log" -Tail 30

# Frontend 日志
Get-Content "$env:TEMP\datawhale_frontend.log" -Tail 10

# 重启服务
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d D:\Learning\AI\Datawhale\backend && npm run dev" -WindowStyle Hidden
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d D:\Learning\AI\Datawhale\frontend && npx vite" -WindowStyle Hidden
```

## 备份演示（服务挂了用截图）

`C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\real_v1.2\`
- `01_login.png` 登录页
- `02_register.png` 注册页
- `10_admin_landing.png` 管理员活动大厅
- `11_admin_admin_approvals.png` 审批工作台（含 v1.2 修复的 Tabs）
- `20_admin_dark_landing.png` 暗色模式
- `30_404.png` 404 错误页
