# ===================================================================
# Datawhale 高校活动智能管理系统 · 后端 Dockerfile
# ===================================================================
# 多阶段：builder (编译) + runner (运行)
# 大小：约 200 MB（不含 dev 依赖）
# 镜像名：datawhale-backend
# ===================================================================

# -------- Stage 1: 编译 --------
FROM node:20-alpine AS builder

WORKDIR /app

# 先 copy package.json 装依赖（利用 docker 缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码 + 编译
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 清理 dev 依赖
RUN npm prune --production

# -------- Stage 2: 运行 --------
FROM node:20-alpine AS runner

WORKDIR /app

# 装 Python + lark-cli 调用依赖（建表脚本 + 迁移工具）
RUN apk add --no-cache python3 py3-pip
RUN pip3 install --no-cache-dir --break-system-packages requests

# 装 lark-cli（Datawhale IT 可在此 build 时禁用：改为手动 npm install -g）
RUN npm install -g @larksuite/cli@latest

# 从 builder 复制 production 依赖 + 编译产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY scripts ./scripts

# 创建上传目录（凭证/物料）
RUN mkdir -p /app/uploads && chown -R node:node /app

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

# 用非 root 用户
USER node

EXPOSE 4000

# 默认启动
CMD ["node", "dist/index.js"]
