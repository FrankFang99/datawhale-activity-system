/**
 * 站点兴趣登记（v4 修订 · Frank 2026-08-20）
 *
 * 场景：用户在他学校没有活动时，可以登记"我对我学校感兴趣"
 * - 游客/任何用户可登记（v1 不强制登录）
 * - 运营后续根据登记找到组织者人选
 *
 * 接口：
 * - POST /api/interests      - 登记兴趣 { schoolName, userName, email, phone?, remark? }
 * - GET  /api/interests/mine - 我登记的（已登录）
 * - GET  /api/admin/interests [OPERATOR/ADMIN] - 全部登记
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface InterestRecord extends LarkRecord {
  fields: {
    interestId?: string;
    schoolName?: string;
    userId?: string;
    userName?: string;
    email?: string;
    phone?: string;
    remark?: string;
    status?: string;
    createdAt?: number;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

const interestSchema = z.object({
  schoolName: z.string().min(1).max(100, '请填写学校名'),
  userName: z.string().min(1).max(50, '请填写姓名'),
  email: z.string().email('请填写正确的邮箱'),
  phone: z.string().regex(/^1\d{10}$/, '请填写 11 位手机号').optional(),
  remark: z.string().max(500).optional(),
});

// POST /api/interests - 登记兴趣（不强制登录）
router.post('/', async (req: Request, res: Response) => {
  // 可选：登录态
  const userId = (req as any).user?.userId ?? '';
  const data = interestSchema.parse(req.body);

  // 简单去重：同邮箱 + 同学校 7 天内不重复登记
  const { items } = await feishuClient.listRecords(config.feishu.tables.interests, { pageSize: 200 });
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const dup = (items as InterestRecord[]).find(
    (x) =>
      x.fields.email === data.email &&
      x.fields.schoolName === data.schoolName &&
      (x.fields.createdAt ?? 0) > sevenDaysAgo
  );
  if (dup) {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '您已对该学校登记过兴趣，请耐心等待运营联系');
  }

  const now = Date.now();
  const interestNo = `INT-${String(now).slice(-6)}`;
  const recordId = await feishuClient.createRecord(config.feishu.tables.interests, {
    interestId: interestNo,
    schoolName: data.schoolName,
    userId,
    userName: data.userName,
    email: data.email,
    phone: data.phone ?? '',
    remark: data.remark ?? '',
    status: 'PENDING',
    createdAt: now,
  });

  return ok(res, {
    recordId,
    interestId: interestNo,
    schoolName: data.schoolName,
    status: 'PENDING',
    message: '已登记对该学校的兴趣，运营会尽快联系你',
  });
});

// GET /api/interests/mine
router.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.interests, { pageSize: 200 });
  const list = (items as InterestRecord[])
    .filter((i) => i.fields.userId === userId)
    .sort((a, b) => (b.fields.createdAt ?? 0) - (a.fields.createdAt ?? 0))
    .map((i) => ({
      recordId: i.record_id,
      interestId: i.fields.interestId,
      schoolName: i.fields.schoolName,
      status: normStatus(i.fields.status),
      createdAt: i.fields.createdAt,
    }));
  return ok(res, { list, total: list.length });
});

// GET /api/admin/interests [OPERATOR/ADMIN]
router.get('/admin/all', authRequired, requireRole('OPERATOR', 'ADMIN'), async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.interests, { pageSize: 200 });
  const list = (items as InterestRecord[])
    .sort((a, b) => (b.fields.createdAt ?? 0) - (a.fields.createdAt ?? 0))
    .map((i) => ({
      recordId: i.record_id,
      interestId: i.fields.interestId,
      schoolName: i.fields.schoolName,
      userId: i.fields.userId,
      userName: i.fields.userName,
      email: i.fields.email,
      phone: i.fields.phone,
      status: normStatus(i.fields.status),
      createdAt: i.fields.createdAt,
      remark: i.fields.remark,
    }));
  return ok(res, { list, total: list.length });
});

export default router;
