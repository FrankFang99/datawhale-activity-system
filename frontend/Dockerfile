# ===================================================================
# Datawhale 高校活动智能管理系统 · 前端 Dockerfile
# ===================================================================
# 多阶段：builder (vite build) + runner (nginx serve)
# 内置 nginx 反代到后端，Datawhale IT 不用再装 nginx
# 镜像名：datawhale-frontend
# ===================================================================

# -------- Stage 1: 编译 --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

# 构建参数：可覆盖 VITE_DEPLOY_BASE
ARG VITE_DEPLOY_BASE=/
ENV VITE_DEPLOY_BASE=$VITE_DEPLOY_BASE

RUN npm run build

# -------- Stage 2: nginx 服务 --------
FROM nginx:1.27-alpine AS runner

# 复制 vite 产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制自定义 nginx.conf（含 API 反代 + SPA fallback + 静态缓存）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
