/**
 * Netlify Functions v1 入口（v1.9.29 Netlify 部署）
 *
 * 工作流：
 * - netlify.toml redirects: /api/* → /.netlify/functions/api
 * - 用 serverless-http 把 Express app 包成 Netlify Function handler
 * - 复用 backend/src/index.ts 的 Express app（Vercel 改造时已经导出 default）
 *
 * 配置：
 * - netlify.toml functions.* memory 1024MB / timeout 30s
 * - Netlify Functions body 限制 6MB（比 Vercel 4.5MB 略大）
 * - node_bundler = "esbuild"（Lambda 风格，Node 原生 req/res）
 */
import serverless from 'serverless-http';
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import app from '../../backend/src/index';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // serverless-http 把 Netlify (event, context) 转成 Express (req, res)
  // 然后再转回 Netlify response
  return (serverless(app) as any)(event, context);
};

export { handler };
