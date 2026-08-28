/**
 * Vercel Serverless Function wrapper（v1.9.28 部署评估）
 *
 * 工作流：
 * - Vercel 自动识别 api/*.ts 为 Serverless Function
 * - 入口接收 (req, res) HTTP 事件
 * - 转给 backend Express app 处理
 * - vercel.json rewrites: /api/* → /api/index
 *
 * 配置：
 * - vercel.json functions.api/index.ts: memory 1024MB / maxDuration 30s
 * - backend/.env.example 列了 Vercel 部署需要的所有环境变量
 */
import app from '../backend/src/index';

export default app;
