/**
 * Datawhale 高校活动智能管理系统 · 后端入口
 * 切片 1：邮箱注册 + 活动大厅 + 申请表单 + 5 维评分
 *
 * 启动：pnpm dev 或 npm run dev
 * 端口：4000（与前端 Vite 5173 区分）
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { authRequired, requireRole } from './middleware/auth';
import authRouter from './modules/auth/controller';
import activitiesRouter from './modules/activities/controller';
import applicationsRouter from './modules/applications/controller';
import adminRouter from './modules/admin/controller';
import adminDashboardRouter from './modules/admin/dashboard';
import adminActivitiesRouter from './modules/admin/activities';
import stagesRouter from './modules/stages/controller';
import reimbursementsRouter from './modules/reimbursements/controller';
import aiRouter from './modules/ai/controller';
import participantsRouter from './modules/participants/controller';
import interestsRouter from './modules/interests/controller';
import volunteerRouter from './modules/volunteer/controller';
import usersRouter from './modules/users/controller';
import messagesRouter from './modules/messages/controller';
import materialsRouter from './modules/materials/controller';
import uploadRouter from './modules/upload/controller';  // v16.8 Frank 9:04：图片上传
import { ok, fail, ErrorCode } from './utils/response';

const app = express();

// 全局兜底：捕获异步异常
// v1.2 Frank 20:40：用 String() 避免 Node inspect 内部对 undefined Error 报 TypeError
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', String(err?.stack ?? err));
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', String(err?.stack ?? err));
});

// 中间件
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// 请求日志
app.use((req: Request, _res: Response, next: NextFunction) => {
  const t0 = Date.now();
  _res.on('finish', () => {
    const ms = Date.now() - t0;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${_res.statusCode} ${ms}ms`);
  });
  next();
});

// 路由
app.get('/api/health', (_req, res) => {
  return ok(res, { status: 'ok', env: config.env, ts: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/admin/applications', adminRouter);
app.use('/api/admin/dashboard', adminDashboardRouter);  // v5 数据看板（ADMIN 默认工作台）
app.use('/api/admin/activities', adminActivitiesRouter);  // v6 活动管理（PRD §4.2.3）
app.use('/api', stagesRouter);  // /api/applications/:id/tasks + /api/stages/:taskId/...
app.use('/api', reimbursementsRouter);  // 切片 5 报销中心
app.use('/api', aiRouter);  // 切片 6 AI 助手
app.use('/api/participants', participantsRouter);  // v4 修订 参与者报名
app.use('/api/interests', interestsRouter);     // v4 修订 站点兴趣登记
app.use('/api/volunteer', volunteerRouter);    // v5 志愿者工作台（VOLUNTEER 默认）
app.use('/api/users', usersRouter);          // v7 个人中心（PRD §4.1.9）
app.use('/api/messages', messagesRouter);    // v7 站内消息（PRD §4.1.8）
app.use('/api/materials', materialsRouter);  // v9 物料下载（PRD §4.1.6 US-V5）
app.use('/api/upload', uploadRouter);        // v16.8 Frank 9:04：图片上传
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));  // 静态 serving

// v1.2 Frank 17:08：高校库（公开 + admin CRUD）
import universitiesRouter from './modules/universities/controller';
app.use('/api/universities', universitiesRouter);     // 公开（活动大厅 / KPI 用）
app.use('/api/admin/universities', authRequired, requireRole('ADMIN', 'OPERATOR'), universitiesRouter);  // admin/operator CRUD

// 404
app.use((_req, res) => {
  res.status(404).json({ code: 40401, message: '接口不存在' });
});

// 错误处理
app.use(errorHandler);

const port = config.port;
app.listen(port, () => {
  console.log(`\n🚀 Datawhale backend running at http://localhost:${port}`);
  console.log(`   env = ${config.env}`);
  console.log(`   feishu base = ${config.feishu.baseToken.slice(0, 10)}...`);
  console.log(`\n   API endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   GET  /api/activities`);
  console.log(`   GET  /api/activities/:id`);
  console.log(`   POST /api/applications/submit`);
  console.log(`   GET  /api/applications/mine`);
  console.log(`   GET  /api/applications/:id`);
  console.log(`   GET  /api/admin/applications/pending       [OPERATOR/ADMIN]`);
  console.log(`   POST /api/admin/applications/:id/approve   [OPERATOR/ADMIN]`);
  console.log(`   GET  /api/admin/applications/:id/audit-log [OPERATOR/ADMIN]`);
  console.log(`   GET  /api/admin/applications/review-pending [OPERATOR/ADMIN]`);
  console.log(`   POST /api/admin/applications/:id/review-confirm [OPERATOR/ADMIN]`);
  console.log(`   GET  /api/applications/:id/tasks            [任意已登录]`);
  console.log(`   POST /api/applications/:id/tasks/initialize [OPERATOR/ADMIN]`);
  console.log(`   POST /api/stages/:taskId/submit             [组织者]`);
  console.log(`   POST /api/stages/:taskId/review             [志愿者/OPERATOR/ADMIN]`);
  console.log(`   --- 切片 5 报销中心 ---`);
  console.log(`   POST /api/reimbursements/submit            [组织者]`);
  console.log(`   GET  /api/reimbursements/mine              [任意已登录]`);
  console.log(`   GET  /api/reimbursements/:id               [任意已登录]`);
  console.log(`   GET  /api/reimbursements/application/:id   [任意已登录]`);
  console.log(`   GET  /api/reimbursements/pending           [OPERATOR/ADMIN/VOLUNTEER]`);
  console.log(`   POST /api/reimbursements/:id/review        [OPERATOR/ADMIN/VOLUNTEER]`);
  console.log(`   POST /api/reimbursements/:id/pay           [OPERATOR/ADMIN]`);
  console.log(`   --- 切片 6 AI 助手 ---`);
  console.log(`   POST /api/ai/chat            [任意已登录]`);
  console.log(`   POST /api/ai/feedback        [任意已登录]`);
  console.log(`   GET  /api/ai/hot-faqs        [任意已登录]`);
  console.log(`   --- v4 修订 参与者 + 兴趣 ---`);
  console.log(`   POST /api/participants/register              [任意已登录]`);
  console.log(`   POST /api/participants/:id/cancel            [本人/OPERATOR/ADMIN]`);
  console.log(`   GET  /api/participants/mine                  [任意已登录]`);
  console.log(`   GET  /api/participants/activity/:id          [公开]`);
  console.log(`   GET  /api/participants/activity/:id/list     [OPERATOR/ADMIN]`);
  console.log(`   POST /api/interests                          [公开]`);
  console.log(`   GET  /api/interests/mine                     [任意已登录]`);
  console.log(`   GET  /api/interests/admin/all                [OPERATOR/ADMIN]`);
  console.log(`   --- v5 4-role workspace ---`);
  console.log(`   GET  /api/admin/dashboard/kpi                [ADMIN/OPERATOR]`);
  console.log(`   GET  /api/admin/dashboard/grade              [ADMIN/OPERATOR]`);
  console.log(`   GET  /api/volunteer/workbench                [VOLUNTEER/OPERATOR/ADMIN]`);
  console.log(`   GET  /api/volunteer/workbench/summary        [VOLUNTEER/OPERATOR/ADMIN]`);
  console.log(`   --- v6 活动管理 + 审批详情 + 分配志愿者 ---`);
  console.log(`   GET  /api/admin/activities                   [ADMIN/OPERATOR]`);
  console.log(`   POST /api/admin/activities                   [ADMIN/OPERATOR]`);
  console.log(`   PUT  /api/admin/activities/:id               [ADMIN/OPERATOR]`);
  console.log(`   POST /api/admin/activities/:id/publish      [ADMIN/OPERATOR]`);
  console.log(`   POST /api/admin/activities/:id/unpublish    [ADMIN/OPERATOR]`);
  console.log(`   POST /api/admin/activities/:id/archive      [ADMIN/OPERATOR]`);
  console.log(`   GET  /api/admin/applications/:id            [ADMIN/OPERATOR/VOLUNTEER]`);
  console.log(`   POST /api/admin/applications/:id/draft-review [ADMIN/OPERATOR/VOLUNTEER]`);
  console.log(`   POST /api/admin/applications/:id/assign     [ADMIN/OPERATOR]`);
  console.log(`   GET  /api/admin/applications/volunteers      [ADMIN/OPERATOR/VOLUNTEER]`);
  console.log(`   --- v7 Personal Center (PRD §4.1.9) ---`);
  console.log(`   GET  /api/users/me                           [any logged-in]`);
  console.log(`   PUT  /api/users/me                           [any logged-in]`);
  console.log(`   POST /api/users/change-password              [any logged-in]`);
  console.log(`   --- v7 In-app Messages (PRD §4.1.8) ---`);
  console.log(`   GET  /api/messages/mine                      [any logged-in]`);
  console.log(`   GET  /api/messages/unread/count              [any logged-in]`);
  console.log(`   POST /api/messages/:id/read                  [any logged-in]`);
  console.log(`   POST /api/messages/read-all                  [any logged-in]\n`);
});
