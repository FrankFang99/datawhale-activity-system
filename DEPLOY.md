# Datawhale 高校活动智能管理系统 · 生产环境部署指南

> **读者**：Datawhale IT / 运维（主），Frank 了解进度（次）
> **版本**：v1.0.0（2026-08-25）
> **关联文档**：`README.md`（项目总览）/ `TODO.md`（待办事项）/ `PRD.md`（业务规则）
> **交付方**：Frank Fang（frank-fangyz@139.com）

---

## 0. 文档目的

本指南面向**第一次部署 v1 系统的 Datawhale IT 工程师**，按章节顺序执行可完成从 0 到上线的全过程。预计完整部署时间 **2-3 个工作日**（含飞书企业版申请 + 服务器准备 + 数据迁移）。

> ⚠️ **重要原则**：v1 系统数据存在**飞书 Base**，**不需要自建数据库**。后端只是逻辑层 + API 层 + JWT 鉴权。
> 这极大简化了部署——不用考虑 MySQL/PostgreSQL/Redis。

> 🔴 **必读警示**：本文档中出现的 `base_token` / `app_id` / `table_id`（如 `T3lJbRN7LaqdQqs3AlUchCxLnKb` / `cli_aa82e11c78b81cbb` / `tblI7XAVJsXh2lRz`）**全部是 Frank 个人版飞书的标识，生产环境**禁止使用**。生产环境必须用 Datawhale 飞书企业版的 app + 重建 Base。详见 §3.2。

---

## 1. 部署前必问 Frank 的 9 个问题（Frank 不懂技术，照搬问 Datawhale IT 即可）

> 这些问题 Frank 没法决定，必须问 Datawhale IT。建议 Frank 把这 9 个问题直接转发给 Datawhale 对接人。

### 🔴 必答（不答不能开工）

| # | 问题 | 涉及章节 | 备注 |
|---|---|---|---|
| 1 | 域名是 `datawhale.cn` 还是其他？前端挂哪个子路径（`/activity/` 还是 `/activity-admin/`）？ | §5 域名 + §6 nginx | 决定 Vite build 的 `base` 配置 |
| 2 | 服务器在哪（自有 / 阿里云 / 腾讯云 / 其他）？操作系统？ | §4 服务器 | 影响 systemd / docker / 部署脚本 |
| 3 | 飞书**企业版 app_id + app_secret** 什么时候能拿到？ | §3 飞书准备 | 阻塞所有飞书调用 |
| 4 | 飞书 Base 是新建企业版 Base，还是把 Frank 个人版 Base（`T3lJbRN7LaqdQqs3AlUchCxLnKb`）迁过来？ | §3.2 Base | 决定数据迁移方式 |
| 5 | 邮件通知：v1 当前是 stub（仅控制台打印），要发真实邮件的话用哪个 SMTP（QQ 邮箱 / 网易 / Datawhale 企业邮箱）？ | §7.2 邮件 | 决定是否需要接 SMTP |
| 6 | HTTPS 证书谁负责（Datawhale / Let's Encrypt / 云厂商）？ | §5 域名 | 决定 nginx 是否需要配 SSL |

### 🟡 重要（不答也能开工，但建议尽快答）

| # | 问题 | 涉及章节 | 备注 |
|---|---|---|---|
| 7 | 后端服务要多大配置（CPU/内存）？预期并发量？ | §4.2 配置 | v1 是低并发，但还是要规划 |
| 8 | 日志和监控：是否要 ELK / Sentry / 阿里云日志？ | §9 监控 | v1 默认控制台日志 |
| 9 | 备份策略：飞书 Base 是否需要每日自动备份？ | §10 备份 | 飞书云端已有版本历史，但建议本地再备份一份 |

### 📋 Frank 已知默认（不知道可改）

- **测试账号统一密码**：`datawhale123`（仅测试，生产环境需重置）
- **JWT 密钥**：v1 默认 `datawhale-dev-secret-change-me-in-production-please`，**生产必须改**（见 §7.1）
- **通知收件人**：v1 测试模式统一发到 `frank-fangyz@139.com`，**生产环境按角色发到不同人**

---

## 2. 系统架构（5 分钟理解）

```
┌────────────────── 用户层 ──────────────────┐
│ 5 角色：管理员/运营/志愿者/组织者/参与者       │
│ 浏览器（无客户端，纯 SPA）                   │
└──────────────────┬─────────────────────────┘
                   │ HTTPS (443)
┌──────────────────▼─────────────────────────┐
│ Nginx 反代（80/443）                        │
│   - /activity/  → 前端静态文件                │
│   - /activity/api/ → 后端 4000 端口            │
└──────────────────┬─────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐      ┌──────────────────────┐
│ 前端         │      │ 后端                 │
│ React 18     │      │ Node.js 20 + Express │
│ Vite 5       │      │ TypeScript + JWT     │
│ Ant Design 5 │      │ 监听 :4000           │
│ 静态文件     │      │ 进程管理: PM2/systemd │
└──────────────┘      └──────┬───────────────┘
                             │ HTTPS (飞书 OpenAPI)
                             ▼
                  ┌──────────────────────┐
                  │ 飞书企业版 Base       │
                  │ 11 张表 (dw_*)        │
                  │ 5 角色用户 + 申请数据  │
                  └──────────────────────┘
```

**核心认知**：
- **数据库 = 飞书 Base**（v1 没自建 MySQL/PG/Redis）
- **后端 = 纯逻辑 + JWT + 调用飞书 API**
- **前端 = 纯静态文件 + 反代到后端**

---

## 3. 飞书企业版准备（最重要 · 第 1-2 天）

### 3.1 申请企业版权限清单

向 Datawhale 飞书企业版管理员（一般是 IT 负责人）申请以下**应用权限**：

| 权限 scope | 用途 | 是否必须 |
|---|---|---|
| `base:table:read` | 读 Base 表（用户/活动/申请等）| ✅ 必 |
| `base:table:write` | 写 Base 表 | ✅ 必 |
| `bitable:app:readonly` | 读 Base 元信息 | ✅ 必 |
| `bitable:app` | 创建/修改 Base | 🟡 仅建表时用 |
| `im:message` | 发飞书消息（v1 不用，v2 用）| ⏸ v2 |
| `im:message:send_as_bot` | 机器人发消息（v2 通知）| ⏸ v2 |
| `contact:user.employee_id:readonly` | 读员工 ID（v1 不用）| ⏸ v2 |

**v1 最低必备**：前 3 个 + `bitable:app`（建表阶段）

### 3.2 Base 创建策略

v1 的 Base 是 Frank 在**个人版**建的（`base_token = T3lJbRN7LaqdQqs3AlUchCxLnKb`），生产环境**必须**切到企业版。

**两种方案**：

| 方案 | 步骤 | 适用场景 |
|---|---|---|
| **A. 新建企业版 Base（推荐）** | 1) Datawhale IT 申请企业版 Base 2) 跑 `backend/scripts/setup_feishu_base.py --rebuild` 重建 11 张表 3) 用 `seed_activities.py` 灌测试数据 | 全新上线 |
| **B. 迁移个人版 Base 到企业版** | 1) 飞书后台"个人版 → 企业版"迁移 2) 验证 11 张表完整 3) 改 `.env` 的 `FEISHU_BASE_TOKEN` | 已有数据要保留 |

**11 张业务表**（v1 已建好，详见 `backend/scripts/setup_feishu_base.py`）：

| 表名 | table_id (个人版) | 字段数 | 用途 |
|---|---|---|---|
| `dw_users` | `tblI7XAVJsXh2lRz` | 6 | 5 角色用户 |
| `dw_activities` | `tblg4WP41rKbilJR` | 9 | 活动管理 |
| `dw_applications` | `tblZRjMNbwNCDHwq` | 23 | 申请 + 4 v4 修订字段 |
| `dw_stage_tasks` | `tblw8ZI45cUslzXl` | 14 | 5 阶段子任务 |
| `dw_reimbursements` | `tblQLMHEAC6HcVZs` | 14 | 报销单 |
| `dw_chat_logs` | `tblgLhFZO5TmQkPg` | 10 | AI 助手对话日志 |
| `dw_participants` | `tbljAGe59BXIxRuw` | — | 参与者报名 |
| `dw_interests` | `tbllx0h7bzwoXPPC` | — | 站点兴趣登记 |
| `dw_messages` | `tblsfSU3cdkwOWWX` | — | 站内消息 |
| `dw_materials` | `tbl4pA9qtNyJSxoo` | — | 物料下载 |
| `dw_notification_logs` | — | — | 通知日志 |

> ⚠️ 上述 table_id 是**个人版**的。企业版重建后 ID 会变，但脚本会自动写入新 ID 到 `.env`，无需手动记。

### 3.3 lark-cli 安装（v1 部署期必备，v2 可改 HTTP 直连）

```bash
# 升级 lark-cli ≥ 1.0.88
npm install -g @larksuite/cli
lark-cli update
lark-cli --version  # 应输出 1.0.88+

# 用企业版 app_id 登录（Datawhale IT 提供）
lark-cli auth login --app-id <APP_ID> --app-secret <APP_SECRET>
lark-cli auth status  # 期望 identity: app + appId 匹配
```

---

## 4. 服务器准备（第 1-2 天 · 与 §3 并行）

### 4.1 最低配置

| 项 | 最低 | 推荐 |
|---|---|---|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 40 GB | 100 GB（含日志）|
| 操作系统 | Ubuntu 22.04 / CentOS 8 | Ubuntu 22.04 LTS |
| Node.js | 20.x LTS | 20.x LTS |
| 公网 IP | 必备 | 必备 |

### 4.2 安装基础环境

```bash
# Ubuntu 22.04
sudo apt update
sudo apt install -y nginx python3 python3-pip nodejs npm
sudo npm install -g n
sudo n 20
hash -r
node --version  # 期望 v20.x

# 装 PM2（进程守护）
sudo npm install -g pm2

# 装 lark-cli
sudo npm install -g @larksuite/cli
```

### 4.3 防火墙

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
# 注意：4000 端口不对外开放，只给 nginx 反代
```

---

## 5. 域名 + SSL（第 2 天）

### 5.1 DNS 配置

Datawhale IT 在 DNS 服务商加 A 记录：
```
activity.datawhale.cn  →  <服务器公网 IP>
```

### 5.2 SSL 证书

推荐用 Let's Encrypt（免费 + 自动续期）：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d activity.datawhale.cn
# 按提示输入邮箱 + 同意条款
# 自动生成证书 + 配置 nginx
```

### 5.3 子路径决策

**默认方案**：`https://activity.datawhale.cn/`（独立子域名）

**如果 Datawhale 要求挂在主域名下**：
- `https://datawhale.cn/activity/`（Vite build 时 `VITE_DEPLOY_BASE=/activity/`）
- `https://datawhale.cn/activity-admin/`（管理后台）
- 后端 API 建议挂 `/activity/api/`

修改子路径时需要：
1. 前端 build：`VITE_DEPLOY_BASE=/activity/ npm run build`
2. nginx 反代改路径（见 §6.2）

---

## 6. 部署代码（第 2-3 天）

### 6.0 Docker 一键部署（推荐 · 替代 6.1-6.4 全部）

> **2026-08-25 新增**：项目已配置 Dockerfile + docker-compose，Datawhale IT **跳过 6.1-6.4 直接看 6.0**。
> 一条命令起完整 stack（后端 + 前端 + nginx 反代 + 飞书告警）。

```bash
# 0) 安装 Docker + docker-compose（Ubuntu 22.04）
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
docker --version

# 1) 上传项目代码到 /opt/datawhale/
scp -r datawhale-v1-delivery/* root@<server>:/opt/datawhale/

# 2) 准备 .env
cd /opt/datawhale
cp backend/.env.example backend/.env
nano backend/.env  # 填 11 个 FEISHU_TABLE_* + JWT_SECRET + 飞书企业版凭证 + SMTP（可选）+ 告警 webhook

# 3) 跑建表脚本（自动写 11 个表 ID 到 .env）
docker compose run --rm backend python3 scripts/setup_all_tables.py --base-token bascnXXX

# 4) 一键启动
docker compose up -d --build

# 5) 验证
curl http://localhost/api/health
# 期望 {"status":"ok","feishu":"connected"}

# 6) 配 SSL（可选）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d activity.datawhale.cn
```

**Docker 部署优势**：
- ✅ 不需要 Datawhale IT 装 Node.js / nginx / PM2
- ✅ 后端 / 前端 / 反代全自动，零配置
- ✅ 容器重启自动恢复（restart: unless-stopped）
- ✅ 健康检查内置（30s 一次）

### 6.1 传统部署（不推荐 · 仅留作参考）

如果 Datawhale IT 不想用 Docker（必须用裸机 / K8s），按下面手动部署：

#### 6.1.1 部署目录结构

```
/opt/datawhale/
├── backend/              # 后端 Node.js
│   ├── src/              # 源码
│   ├── scripts/          # 飞书建表脚本
│   ├── package.json
│   ├── .env              # 生产环境配置（手工创建，权限 600）
│   └── .env.example      # 配置模板
├── frontend/             # 前端（只需要 dist/）
│   └── dist/             # Vite build 产物
├── logs/                 # 日志
│   ├── backend-out.log
│   ├── backend-err.log
│   ├── nginx-access.log
│   └── nginx-error.log
└── DEPLOY.md             # 本文档
```

#### 6.1.2 nginx 配置（关键）

文件：`/etc/nginx/sites-available/datawhale`

```nginx
# 后端 API 反代
server {
    listen 80;
    server_name activity.datawhale.cn;

    # Certbot 会自动加 listen 443 + SSL 证书配置
    # 下面是 SSL 配置示例
    # listen 443 ssl;
    # ssl_certificate /etc/letsencrypt/live/activity.datawhale.cn/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/activity.datawhale.cn/privkey.pem;

    # 前端静态文件
    root /opt/datawhale/frontend/dist;
    index index.html;

    # SPA 路由 fallback（所有未知路径 fallback 到 index.html）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 安全 headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/datawhale /etc/nginx/sites-enabled/
sudo nginx -t  # 验证配置
sudo systemctl reload nginx
```

#### 6.1.3 后端部署

```bash
# 上传代码
cd /opt/datawhale
# scp/rsync 从本地传 backend/ frontend/ 源码

# 装依赖
cd backend
npm ci --production  # 用 package-lock.json 严格安装

# 创建 .env（关键，见 §7）
cp .env.example .env
nano .env  # 填入真实配置
chmod 600 .env

# 编译
npm run build
# 输出 dist/index.js

# 启动（用 PM2 守护）
pm2 start dist/index.js --name datawhale-backend
pm2 startup  # 生成开机自启
pm2 save
pm2 logs datawhale-backend  # 看日志
```

#### 6.1.4 前端部署

```bash
cd /opt/datawhale/frontend

# 装依赖
npm ci

# 构建（生产环境用绝对路径 / 相对路径都 OK，默认 / 即可）
# 如果是子路径：VITE_DEPLOY_BASE=/activity/ npm run build
npm run build
# 输出 dist/

# 复制到 nginx 目录
sudo cp -r dist/* /opt/datawhale/frontend/dist/
# 或者直接让 nginx 指向 /opt/datawhale/frontend/dist
```

---

## 7. 环境变量（最关键 · Frank 要逐项跟 Datawhale IT 确认）

### 7.1 后端 .env 完整配置

```env
# ===== 服务配置 =====
NODE_ENV=production
PORT=4000
# CORS 必须包含前端实际域名（多域名逗号分隔）
CORS_ORIGIN=https://activity.datawhale.cn

# ===== JWT 密钥（必改 · 用 32+ 字符随机串）=====
# 生成命令：node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<paste-random-48-bytes-hex-here>
JWT_EXPIRES_IN=86400

# ===== 飞书企业版配置（Datawhale IT 提供）=====
# 申请企业版 app 后，飞书后台 → 应用详情 → 凭证与基础信息
LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 企业版 Base（运行 setup_feishu_base.py 后自动写入）
FEISHU_BASE_TOKEN=bascnxxxxxxxxxxxxxxxx
FEISHU_TABLE_USERS=tblxxxxxxxxxxxx
FEISHU_TABLE_ACTIVITIES=tblxxxxxxxxxxxx
FEISHU_TABLE_APPLICATIONS=tblxxxxxxxxxxxx
FEISHU_TABLE_STAGE_TASKS=tblxxxxxxxxxxxx
FEISHU_TABLE_REIMBURSEMENTS=tblxxxxxxxxxxxx
FEISHU_TABLE_CHAT_LOGS=tblxxxxxxxxxxxx
FEISHU_TABLE_PARTICIPANTS=tblxxxxxxxxxxxx
FEISHU_TABLE_INTERESTS=tblxxxxxxxxxxxx
FEISHU_TABLE_MESSAGES=tblxxxxxxxxxxxx
FEISHU_TABLE_MATERIALS=tblxxxxxxxxxxxx

# ===== 邮件通知 =====
# v1 当前是 console.log stub，生产环境建议配 SMTP
# 如暂不接 SMTP，留空即可（通知只输出到日志）
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=noreply@datawhale.cn
SMTP_PASSWORD=xxxxxxxxxxxx
SMTP_FROM="Datawhale 活动系统 <noreply@datawhale.cn>"

# ===== 通知收件人（v1 测试模式 Frank 一人 4 角色）=====
# ⚠️ 生产环境必须改 false + 按角色配置收件人
NOTIFY_TEST_MODE=false
NOTIFY_DEFAULT_EMAIL=ops@datawhale.cn

# ===== 业务阈值（可选 · Frank 已经定好默认值）=====
# 5 维评分阈值 S/A/B/C/D
SCORE_GRADE_S=90
SCORE_GRADE_A=75
SCORE_GRADE_B=60
SCORE_GRADE_C=40
# 5 维评分权重（合计 100）
SCORE_WEIGHT_VENUE=20
SCORE_WEIGHT_RECRUIT=20
SCORE_WEIGHT_EXPERIENCE=25
SCORE_WEIGHT_TIMING=15
SCORE_WEIGHT_VALUE=20
```

### 7.2 .env 权限

```bash
chmod 600 /opt/datawhale/backend/.env
chown www-data:www-data /opt/datawhale/backend/.env  # 如果 PM2 用 www-data 跑
```

---

## 8. 飞书 Base 初始化（第 3 天上午 · 自动化）

### 8.1 自动建表（一键建 10 张 · 推荐）

```bash
cd /opt/datawhale/backend

# 安装 Python 依赖
pip3 install --user requests

# 确认 lark-cli 已登录企业版
lark-cli auth status  # 期望 identity: app + Datawhale 企业版 appId

# 准备企业版 base_token：
#   方式 A（推荐）：Datawhale IT 在飞书企业版后台新建一个空 Base，复制 URL 里的 bascnXXX
#   方式 B：迁移 Frank 个人版 Base（base_token = T3lJbRN7LaqdQqs3AlUchCxLnKb）

# 一键建 10 张业务表 + 自动写 .env
python3 scripts/setup_all_tables.py --base-token bascnXXXXXXXX
# 输出：成功 10 / 跳过 0 / 失败 0
# 自动写入 /opt/datawhale/backend/.env 的 10 个 FEISHU_TABLE_* 字段

# 灌测试活动数据（可选 · 生产环境可跳过）
python3 scripts/seed_activities.py
```

> **这个新脚本解决了什么**：原 `setup_feishu_base.py` 只建 4 张表（users/activities/applications/stage_tasks），其他 6 张（reimbursements/chat_logs/participants/interests/messages/materials）需要分别跑 4 个 `create_*.py` 脚本，但这些脚本硬编码了 Frank 个人版路径 + base_token，**生产环境会失败**。`setup_all_tables.py` 动态定位 lark-cli + 支持任意 base_token，**一个命令搞定全部 10 张表**。

### 8.2 验证

```bash
# 1. 检查后端启动日志
pm2 logs datawhale-backend --lines 50
# 期望看到 "🚀 Datawhale backend running at http://0.0.0.0:4000"

# 2. 检查飞书连接
curl http://localhost:4000/api/health
# 期望 {"status": "ok", "feishu": "connected"}

# 3. 检查前端可访问
curl -I https://activity.datawhale.cn/
# 期望 200 OK
```

---

## 9. 启动验证（部署后必跑 · 30 分钟）

### 9.1 基础检查

| # | 检查项 | 命令 | 期望 |
|---|---|---|---|
| 1 | 后端进程在跑 | `pm2 list` | `datawhale-backend` 状态 `online` |
| 2 | 前端可访问 | `curl -I https://activity.datawhale.cn/` | `200 OK` |
| 3 | API 健康 | `curl https://activity.datawhale.cn/api/health` | `{"status":"ok"}` |
| 4 | 飞书连通 | `curl https://activity.datawhale.cn/api/activities` | 返回活动列表（可能空数组）|

### 9.2 端到端冒烟测试

```bash
cd /opt/datawhale/backend
node test_integration_lite.js
# 期望：✅ 通过: 20   ❌ 失败: 0   总计: 20
```

### 9.3 浏览器手测（10 分钟）

1. 打开 `https://activity.datawhale.cn/` → 看到活动大厅
2. 注册新账号 → 登录 → 看到 5 角色布局
3. 切换到 ADMIN 角色 → 进审批工作台 → 看到 0 条待审（生产环境无数据）
4. 进 AI 助手 → 输入"5 阶段任务" → 看到回复
5. 进报销中心 → 看到 3 个 Tabs

> 详见 `docs/ACCEPTANCE.md` 7 场景验证清单。

---

## 10. 监控 + 备份（生产必备）

### 10.1 日志

```bash
# PM2 日志（自动滚动）
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 30  # 保留 30 天

# nginx 日志（系统 logrotate 默认）
# /var/log/nginx/activity-access.log
# /var/log/nginx/activity-error.log
```

### 10.2 监控（可选 · v1 可暂缓）

| 工具 | 用途 | 何时启用 |
|---|---|---|
| 阿里云监控 / 腾讯云监控 | 服务器 CPU/内存/磁盘 | 上线第 1 周 |
| UptimeRobot（免费）| 域名可用性监控 | 上线即用 |
| Sentry（付费）| 前端 + 后端错误监控 | v2 |
| 飞书告警机器人 | 业务异常告警 | v2 |

### 10.3 数据备份

**飞书 Base 自动备份**：
- 飞书云端有版本历史（默认 30 天）
- 企业版可开启每日自动备份到企业云盘

**手动备份**（推荐 · 每日凌晨）：
```bash
#!/bin/bash
# /opt/datawhale/scripts/backup-feishu.sh
BACKUP_DIR=/opt/datawhale/backups/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR
cd /opt/datawhale/backend
python3 scripts/inspect_feishu_counts.py > $BACKUP_DIR/counts.txt
# 导出所有表到 JSON（需用 lark-cli base export 命令）
# 详见 https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/list
```

### 10.4 飞书告警（v1 落地新增 · 推荐启用）

后端 500 错误自动推送飞书群机器人。

**配置步骤**：

1. 在 Datawhale 飞书群 → 右上角 设置 → 群机器人 → 添加机器人 → 自定义机器人
2. 复制 webhook URL（格式：`https://open.feishu.cn/open-apis/bot/v2/hook/xxxx`）
3. 填到 `backend/.env`：
   ```env
   LARK_ALERT_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxx
   LARK_ALERT_LEVEL=ERROR    # DEBUG/INFO/WARN/ERROR/FATAL，阈值
   LARK_ALERT_ENABLED=true
   ```
4. 重启后端：`docker compose restart backend`（或 PM2 reload）

**告警特性**：
- 500 错误自动推送（节流 1 分钟/类）
- 敏感字段自动脱敏（password / token / jwt / cookie）
- 异步发送（不阻塞主流程）
- 失败不影响业务（告警失败不 throw）

### 10.5 数据迁移（个人版 → 企业版 · 推荐 v1 上线做一次）

v1 测试数据存在 Frank 个人版 Base（`T3lJbRN7LaqdQqs3AlUchCxLnKb`），生产环境切到企业版 Base 时需要全量迁移。

**准备**：
1. 准备 `backend/.env.source`（个人版）和 `backend/.env.target`（企业版）
   - 都填 11 个 `FEISHU_*` 字段
2. 企业版 Base 必须先用 `setup_all_tables.py` 建好 10 张表（schema 一致）

**执行**：
```bash
# 1) Dry-run（只统计不写）
docker compose run --rm backend python3 scripts/migrate_base.py \
  --source-env /tmp/.env.source \
  --target-env /tmp/.env.target \
  --dry-run

# 2) 真跑（全 10 张表）
docker compose run --rm backend python3 scripts/migrate_base.py \
  --source-env /tmp/.env.source \
  --target-env /tmp/.env.target

# 可选：只迁部分表
docker compose run --rm backend python3 scripts/migrate_base.py \
  --source-env /tmp/.env.source \
  --target-env /tmp/.env.target \
  --tables dw_users,dw_activities,dw_applications
```

**报告**：脚本自动输出每张表的 success/fail 数量，失败记录不中断整体迁移。

**注意事项**：
- v1 限流 1000 条/表内无需 sleep；> 1000 条时脚本自动 sleep 0.5s/批
- 系统字段（`record_id` / `created_at` / `updated_at`）自动跳过
- 不会去重（如果目标表已有数据，会重复）—— **建议先清空目标表再迁**

---

## 11. 已知限制 + v2 路线

### 11.1 v1 已知限制（生产心里有数）

| 限制 | 影响 | 缓解 |
|---|---|---|
| 邮件通知是 console.log stub | 测试场景通知收不到 | 接 SMTP（§7.1）|
| 5 维评分规则是暂行版 | 业务侧未对齐（TODO §3）| 待 Datawhale 业务确认 |
| 飞书 IM 通知未启用 | 申请状态变化只能站内信 | v2 启用 `im:message` 权限 |
| OCR 报销未实现 | 报销用 URL 列表代替 | v2 接 PaddleOCR |
| lark-cli 子进程调用慢（50-100ms）| 高并发下可能 hang | v2 改 HTTP 直连飞书 OpenAPI |
| 飞书个人版 Base 单表 5 万条上限 | 单表超限需归档 | 企业版无此限制 |

### 11.2 v2 路线（不在本指南范围）

详见 `TODO.md` §4-9 + `PRD.md` §13.3 切片计划。

---

## 12. 故障排查（FAQ）

| 症状 | 排查方向 | 命令 |
|---|---|---|
| 前端 502 Bad Gateway | nginx 配错 / 后端没起 | `sudo nginx -t` + `pm2 list` |
| API 超时 504 | 后端挂了 / 飞书慢 | `pm2 logs` + `lark-cli auth status` |
| 飞书 401 Unauthorized | app_secret 错 / token 过期 | `lark-cli auth status` + 重新 login |
| 飞书 403 Forbidden | 权限 scope 缺 | 检查 §3.1 权限清单是否申请全 |
| 前端白屏 | base 路径配错 | 检查 `VITE_DEPLOY_BASE` + nginx `try_files` |
| 登录后跳 404 | JWT 密钥改了 / 缓存 token 失效 | 强制刷新浏览器 + 重新登录 |
| 5 维评分全 0 | 评分引擎未加载 | `npm test -- score` 验证单测 |

---

## 13. 上线后必做

- [ ] Datawhale IT 改默认测试账号密码（`datawhale123` → 强密码）
- [ ] 删 Frank 测试账号（`frank@datawhale.cn` / `operator@x.cn` 等）
- [ ] 配置 SMTP（§7.1）
- [ ] 配 UptimeRobot 监控域名
- [ ] 配 PM2 开机自启
- [ ] 配飞书 Base 自动备份
- [ ] 通知 Frank 系统已上线（frank-fangyz@139.com）

---

## 14. 联系 Frank

- **邮箱**：frank-fangyz@139.com
- **响应时间**：工作日 24 小时内
- **紧急问题**：直接发邮件（标题加 `[紧急]`）
- **不接**：v2 需求 / 新功能 / 非阻塞问题（统一进 `TODO.md`）

---

**文档版本**：v1.0.0 · 2026-08-25
**下次更新**：v1.1（接 SMTP 后） / v2.0（OCR + 飞书 IM 启用后）
