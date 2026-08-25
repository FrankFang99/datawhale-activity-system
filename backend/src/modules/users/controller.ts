/**
 * 用户个人中心（PRD §4.1.9 US-O12 · v7）
 *
 * 接口：
 * - GET  /api/users/me         - 当前用户信息
 * - PUT  /api/users/me         - 更新昵称/手机/学校
 * - POST /api/users/change-password - 修改密码（需旧密码）
 *
 * v1 简化：邮箱/角色不可改（邮箱 = 账号，role = 后台分配）
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired } from '../../middleware/auth';
import { hashPassword, verifyPassword } from '../../utils/password';

const router = Router();

// 导出 schema 供单测用（v7 · TDD）
export const userUpdateSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(20, '姓名 ≤20 字符').optional(),
  phone: z.string().regex(/^1\d{10}$/, '请填写 11 位手机号').optional().or(z.literal('')),
  school: z.string().max(50, '学校名 ≤50 字符').optional().or(z.literal('')),
  city: z.string().max(20, '城市 ≤20 字符').optional().or(z.literal('')),
  province: z.string().max(20, '省份 ≤20 字符').optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6, '旧密码 ≥6 位'),
  newPassword: z.string().min(6, '新密码 ≥6 位').max(32, '新密码 ≤32 位'),
});

interface UserRecord extends LarkRecord {
  fields: {
    userId?: string;
    email?: string;
    name?: string;
    role?: string;
    status?: string;
    school?: string;
    city?: string;
    province?: string;
    phone?: string;
    passwordHash?: string;
  };
}

const normRole = (r: any): string =>
  Array.isArray(r) ? String(r[0] ?? '') : String(r ?? '');

function findUserById(userId: string): Promise<UserRecord | undefined> {
  return feishuClient.searchRecords(config.feishu.tables.users, 'userId', userId)
    .then((records) => records[0] as UserRecord | undefined);
}

function publicUser(u: UserRecord) {
  return {
    userId: u.fields.userId,
    email: u.fields.email,
    name: u.fields.name,
    role: normRole(u.fields.role),
    school: u.fields.school,
    city: u.fields.city,
    province: u.fields.province,
    phone: u.fields.phone,
  };
}

// GET /api/users/me - 当前用户信息
router.get('/me', authRequired, async (req: Request, res: Response) => {
  const user = await findUserById(req.user!.userId);
  if (!user) return fail(res, 404, ErrorCode.NOT_FOUND, '用户不存在');
  return ok(res, { user: publicUser(user) });
});

// PUT /api/users/me - 更新个人资料
router.put('/me', authRequired, async (req: Request, res: Response) => {
  const data = userUpdateSchema.parse(req.body);

  const user = await findUserById(req.user!.userId);
  if (!user) return fail(res, 404, ErrorCode.NOT_FOUND, '用户不存在');

  // 至少要有一个字段
  if (Object.keys(data).length === 0) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '请至少修改一个字段');
  }

  await feishuClient.updateRecord(config.feishu.tables.users, user.record_id, data);

  // 重新读一次
  const updated = await findUserById(req.user!.userId);
  return ok(res, { user: publicUser(updated!) , message: '已更新' });
});

// POST /api/users/change-password - 修改密码
router.post('/change-password', authRequired, async (req: Request, res: Response) => {
  const data = changePasswordSchema.parse(req.body);

  if (data.oldPassword === data.newPassword) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '新密码不能与旧密码相同');
  }

  const user = await findUserById(req.user!.userId);
  if (!user) return fail(res, 404, ErrorCode.NOT_FOUND, '用户不存在');
  if (!user.fields.passwordHash) {
    return fail(res, 500, ErrorCode.INTERNAL_ERROR, '账号密码缺失，请联系运营');
  }

  const valid = await verifyPassword(data.oldPassword, user.fields.passwordHash);
  if (!valid) {
    return fail(res, 401, ErrorCode.USER_004_INVALID_CREDENTIALS, '旧密码错误');
  }

  const newHash = await hashPassword(data.newPassword);
  await feishuClient.updateRecord(config.feishu.tables.users, user.record_id, {
    passwordHash: newHash,
  });

  return ok(res, { message: '密码已更新，请重新登录' });
});

export default router;
