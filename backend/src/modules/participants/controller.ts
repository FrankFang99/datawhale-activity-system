/**
 * 参与者报名（v4 修订 · Frank 2026-08-20）
 *
 * 区别于"组织者申请（dw_applications）"：
 * - 组织者申请：提交问卷 → SCREENING → 审批 → 确认组织者资格
 * - 参与者报名：活动已开放后，用户一键报名 → REGISTERED
 *
 * 接口：
 * - POST /api/participants/register      - 报名（任意已登录用户）
 * - POST /api/participants/:id/cancel    - 取消报名
 * - GET  /api/participants/mine          - 我的报名
 * - GET  /api/participants/activity/:id  - 某活动报名列表（公开：仅返回数量；详情需 OPERATOR/ADMIN）
 * - GET  /api/participants/activity/:id/list - 某活动报名详情（OPERATOR/ADMIN）
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface ParticipantRecord extends LarkRecord {
  fields: {
    participantId?: string;
    activityId?: string;
    userId?: string;
    userName?: string;
    email?: string;
    phone?: string;
    school?: string;
    remark?: string;
    status?: string;
    registeredAt?: number;
    cancelledAt?: number;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

const registerSchema = z.object({
  activityId: z.string().min(1),
  remark: z.string().max(500).optional(),
});

// POST /api/participants/register
router.post('/register', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userName = req.user!.name;
  const userEmail = req.user!.email;
  const data = registerSchema.parse(req.body);

  // 1. 活动校验
  const acts = await feishuClient.searchRecords(config.feishu.tables.activities, 'activityId', data.activityId);
  const activity = acts[0] as any;
  if (!activity) return fail(res, 404, ErrorCode.ACT_001_NOT_FOUND, '活动不存在');

  const status = normStatus(activity.fields.status);
  if (status === 'PENDING') {
    return fail(res, 400, ErrorCode.ACT_002_NOT_PUBLISHED, '该活动尚未确定组织者，暂不可报名');
  }
  if (status === 'CANCELLED' || status === 'FINISHED') {
    return fail(res, 400, ErrorCode.ACT_002_NOT_PUBLISHED, '该活动已结束或取消');
  }

  // 2. 重复报名检查（同活动 + 同 user 仅允许 1 条 REGISTERED）
  const { items } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
  const dup = (items as ParticipantRecord[]).find(
    (p) => p.fields.userId === userId && p.fields.activityId === data.activityId && normStatus(p.fields.status) === 'REGISTERED'
  );
  if (dup) {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '您已报名该活动');
  }

  // 3. 容量校验
  const registeredCount = (items as ParticipantRecord[]).filter(
    (p) => p.fields.activityId === data.activityId && normStatus(p.fields.status) === 'REGISTERED'
  ).length;
  const maxParticipants = activity.fields.maxParticipants ?? 0;
  if (maxParticipants > 0 && registeredCount >= maxParticipants) {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '该活动报名人数已满');
  }

  // 4. 写库
  const now = Date.now();
  const participantNo = `PART-${String(now).slice(-6)}`;
  const recordId = await feishuClient.createRecord(config.feishu.tables.participants, {
    participantId: participantNo,
    activityId: data.activityId,
    userId,
    userName,
    email: userEmail,
    school: req.user!.email,
    remark: data.remark || '',
    status: 'REGISTERED',
    registeredAt: now,
  });

  return ok(res, {
    recordId,
    participantId: participantNo,
    activityId: data.activityId,
    status: 'REGISTERED',
    message: '已成功加入活动参与者名单',
  });
});

// POST /api/participants/:id/cancel
router.post('/:id/cancel', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const { items } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
  const p = (items as ParticipantRecord[]).find(
    (x) => x.record_id === id || x.fields.participantId === id
  );
  if (!p) return fail(res, 404, ErrorCode.NOT_FOUND, '报名记录不存在');
  if (p.fields.userId !== userId && !['ADMIN', 'OPERATOR'].includes(req.user!.role)) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '无权操作');
  }
  if (normStatus(p.fields.status) === 'UNREGISTERED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '已取消');
  }

  await feishuClient.updateRecord(config.feishu.tables.participants, p.record_id, {
    status: 'UNREGISTERED',
    cancelledAt: Date.now(),
  });

  return ok(res, { recordId: p.record_id, status: 'UNREGISTERED', message: '已取消报名' });
});

// GET /api/participants/mine
router.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
  const list = (items as ParticipantRecord[])
    .filter((p) => p.fields.userId === userId)
    .sort((a, b) => (b.fields.registeredAt ?? 0) - (a.fields.registeredAt ?? 0))
    .map((p) => ({
      recordId: p.record_id,
      participantId: p.fields.participantId,
      activityId: p.fields.activityId,
      status: normStatus(p.fields.status),
      registeredAt: p.fields.registeredAt,
      cancelledAt: p.fields.cancelledAt,
      remark: p.fields.remark,
    }));
  return ok(res, { list, total: list.length });
});

// GET /api/participants/activity/:id  - 某活动报名数（公开）
router.get('/activity/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
  const list = (items as ParticipantRecord[]).filter(
    (p) => p.fields.activityId === id && normStatus(p.fields.status) === 'REGISTERED'
  );
  return ok(res, {
    activityId: id,
    count: list.length,
  });
});

// GET /api/participants/activity/:id/list  - 某活动报名详情（OPERATOR/ADMIN）
router.get('/activity/:id/list', authRequired, requireRole('OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
  const list = (items as ParticipantRecord[])
    .filter((p) => p.fields.activityId === id)
    .sort((a, b) => (b.fields.registeredAt ?? 0) - (a.fields.registeredAt ?? 0))
    .map((p) => ({
      recordId: p.record_id,
      participantId: p.fields.participantId,
      userId: p.fields.userId,
      userName: p.fields.userName,
      email: p.fields.email,
      school: p.fields.school,
      status: normStatus(p.fields.status),
      registeredAt: p.fields.registeredAt,
      cancelledAt: p.fields.cancelledAt,
      remark: p.fields.remark,
    }));
  return ok(res, { list, total: list.length });
});

// =====================================================================
// Frank 2026-08-21 #6 升级：参与者当天打卡 → 升级 user role = PARTICIPANT
// 只有"报名 + 活动当天成功打卡"才是真正的 PARTICIPANT 角色
// =====================================================================

// POST /api/participants/:id/checkin - 活动当天打卡
// 权限：ADMIN/OPERATOR + 该活动的组织者
router.post('/:id/checkin', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const operatorId = req.user!.userId;
  const role = req.user!.role;

  // 1. 找报名记录
  const { items } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
  const p = (items as ParticipantRecord[]).find(
    (x) => x.record_id === id || x.fields.participantId === id
  );
  if (!p) return fail(res, 404, ErrorCode.NOT_FOUND, '报名记录不存在');

  // 2. 权限：ADMIN/OPERATOR 或同活动的组织者
  if (role !== 'ADMIN' && role !== 'OPERATOR') {
    // 查申请看是不是该活动组织者
    const apps = await feishuClient.searchRecords(
      config.feishu.tables.applications,
      'applicationId',
      `*` // 简化：列出后 filter（飞书 searchRecords 不支持通配）
    ).catch(() => []);
    // 简化：listRecords
    const allApps = (await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 })).items as any[];
    const myApp = allApps.find(
      (a) => a.fields.userId === operatorId
        && a.fields.activityId === p.fields.activityId
        && ['CONFIRMED', 'REVIEWING', 'REVIEW_CONFIRMED', 'COMPLETED'].includes(normStatus(a.fields.status))
    );
    if (!myApp) {
      return fail(res, 403, ErrorCode.FORBIDDEN, '仅运营或该活动组织者可打卡');
    }
  }

  // 3. 检查 status
  const currentStatus = normStatus(p.fields.status);
  if (currentStatus === 'UNREGISTERED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '已取消报名，不能打卡');
  }
  if (currentStatus === 'CHECKED_IN') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '已打卡，无需重复');
  }

  // 4. 更新状态
  const now = Date.now();
  await feishuClient.updateRecord(config.feishu.tables.participants, p.record_id, {
    status: 'CHECKED_IN',
    checkedInAt: now,
  });

  // 5. Frank #6 升级：user role USER → PARTICIPANT
  if (p.fields.userId) {
    try {
      const userRecs = await feishuClient.searchRecords(
        config.feishu.tables.users,
        'userId',
        p.fields.userId
      );
      const u = userRecs[0] as any;
      if (u) {
        const currentRole = Array.isArray(u.fields.role) ? String(u.fields.role[0] ?? '') : String(u.fields.role ?? '');
        if (currentRole === 'USER' || !currentRole) {
          await feishuClient.updateRecord(config.feishu.tables.users, u.record_id, {
            role: 'PARTICIPANT',
          });
          console.log(`[CHECKIN] 用户 ${p.fields.userId} 打卡成功，role: USER → PARTICIPANT`);
        }
      }
    } catch (e) {
      console.log(`[CHECKIN] 升级用户角色失败: ${(e as Error).message}`);
    }
  }

  return ok(res, {
    recordId: p.record_id,
    participantId: p.fields.participantId,
    status: 'CHECKED_IN',
    userId: p.fields.userId,
    checkedInAt: now,
    message: '打卡成功！用户角色已升级为 PARTICIPANT',
  });
});

export default router;
