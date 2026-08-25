/**
 * 认证模块：注册 / 登录 / 当前用户
 * 切片 1：ORGANIZER 自助注册；其他 3 个角色由 ADMIN 后台创建
 *
 * PRD §4.1.1
 * - 注册：email + password(6-32) + name + role(仅 ORGANIZER)
 * - 登录：返回 JWT (24h)
 * - 错误码：USER_001~005
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired } from '../../middleware/auth';

const router = Router();

// 简单的登录失败计数（生产应放 Redis；v1 用内存）
const loginFailCount = new Map<string, { count: number; firstAt: number }>();
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isLoginLocked(email: string): boolean {
  const r = loginFailCount.get(email);
  if (!r) return false;
  if (Date.now() - r.firstAt > LOGIN_WINDOW_MS) {
    loginFailCount.delete(email);
    return false;
  }
  return r.count >= LOGIN_LIMIT;
}

function recordLoginFail(email: string) {
  const r = loginFailCount.get(email);
  if (!r || Date.now() - r.firstAt > LOGIN_WINDOW_MS) {
    loginFailCount.set(email, { count: 1, firstAt: Date.now() });
  } else {
    r.count += 1;
  }
}

function clearLoginFail(email: string) {
  loginFailCount.delete(email);
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确').max(64),
  password: z.string().min(6, '密码至少 6 位').max(32),
  name: z.string().min(1, '姓名不能为空').max(20),
  // Frank 2026-08-21 #6 升级：新注册用户 = 普通用户（USER 角色）
  // 升级路径：
  //  ① USER → PARTICIPANT：报名活动 + 活动当天成功打卡（POST /api/participants/:id/checkin）
  //  ② USER/PARTICIPANT → ORGANIZER：申请组织者 + 审核通过（POST /api/admin/applications/:id/approve）
  //  ③ USER/PARTICIPANT → ASSISTANT：同校第二申请者自动派
  //  ADMIN/OPERATOR/VOLUNTEER 仍走 admin 后台手动创建
});

// 角色登录后默认跳转路径（PRD §3.1-3.3 / §4.1.5）
const REDIRECT_BY_ROLE: Record<string, { path: string; landing: string; label: string }> = {
  ADMIN: { path: '/admin/dashboard', landing: 'admin', label: '数据看板' },
  OPERATOR: { path: '/admin/approvals', landing: 'operator', label: '审批工作台' },
  VOLUNTEER: { path: '/volunteer/workbench', landing: 'volunteer', label: '我对接的申请' },
  ORGANIZER: { path: '/', landing: 'organizer', label: '活动大厅' },
  PARTICIPANT: { path: '/', landing: 'participant', label: '活动大厅' },
  ASSISTANT: { path: '/', landing: 'assistant', label: '活动大厅' },
};

function getRedirect(role: string) {
  return REDIRECT_BY_ROLE[role] ?? { path: '/', landing: 'unknown', label: '活动大厅' };
}

// 飞书 select 字段返回总是数组；归一化为单个字符串
const normRole = (r: any): string => (Array.isArray(r) ? String(r[0] ?? '') : String(r ?? ''));

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

interface UserRecord extends LarkRecord {
  fields: {
    userId?: string;
    email?: string;
    passwordHash?: string;
    name?: string;
    role?: string;
    status?: string;
    creditScore?: number;
  };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);

  // 检查邮箱是否已注册
  const existing = await feishuClient.searchRecords(
    config.feishu.tables.users,
    'email',
    data.email
  );
  if (existing.length > 0) {
    return fail(res, 409, ErrorCode.USER_001_EMAIL_EXISTS, '该邮箱已注册，请直接登录');
  }

  // 创建用户（Frank 2026-08-21 #6 升级：默认 USER 角色 = 普通用户）
  const passwordHash = await hashPassword(data.password);
  const recordId = await feishuClient.createRecord(config.feishu.tables.users, {
    email: data.email,
    passwordHash,
    name: data.name,
    role: 'USER',
    status: 'ACTIVE',
    creditScore: 100,
    isExternalUser: true,
  });

  // 飞书 userId 是 auto_number 字段（系统自动），不能手动写
  // 直接用 record_id 末尾作为 userId
  const userId = `USR-${recordId.slice(-4)}`;

  return ok(res, { userId, message: '注册成功，请登录' });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  if (isLoginLocked(data.email)) {
    return fail(res, 429, ErrorCode.USER_005_LOGIN_LOCKED, '登录失败次数过多，请 15 分钟后再试');
  }

  const records = await feishuClient.searchRecords(
    config.feishu.tables.users,
    'email',
    data.email
  );
  const user = records[0] as UserRecord | undefined;
  if (!user || !user.fields.passwordHash) {
    recordLoginFail(data.email);
    return fail(res, 401, ErrorCode.USER_004_INVALID_CREDENTIALS, '账号或密码错误');
  }

  const valid = await verifyPassword(data.password, user.fields.passwordHash);
  if (!valid) {
    recordLoginFail(data.email);
    return fail(res, 401, ErrorCode.USER_004_INVALID_CREDENTIALS, '账号或密码错误');
  }

  if (user.fields.status === 'DISABLED') {
    return fail(res, 403, ErrorCode.FORBIDDEN, '账号已停用，请联系运营');
  }

  clearLoginFail(data.email);

  // 写 lastLoginAt
  await feishuClient.updateRecord(config.feishu.tables.users, user.record_id, {
    lastLoginAt: Date.now(),
  }).catch(() => {/* 失败不影响登录 */});

  const role = normRole(user.fields.role) || 'ORGANIZER';
  const token = signToken({
    userId: user.fields.userId ?? user.record_id,
    email: user.fields.email!,
    role: role as any,
    name: user.fields.name ?? '',
  });

  return ok(res, {
    token,
    expiresIn: config.jwt.expiresIn,
    user: {
      userId: user.fields.userId ?? user.record_id,
      email: user.fields.email,
      name: user.fields.name,
      role,
    },
    redirect: getRedirect(role),
  });
});

// GET /api/auth/me
router.get('/me', authRequired, async (req: Request, res: Response) => {
  return ok(res, { user: req.user });
});

export default router;
