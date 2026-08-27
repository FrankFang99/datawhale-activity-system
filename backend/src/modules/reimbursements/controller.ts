/**
 * 报销中心（切片 5 · PRD §5.2 / US-O8 / US-P6）
 *
 * 状态机：DRAFT → SUBMITTED → APPROVED → PAID
 *                  └─ REJECTED → (组织者修改) → SUBMITTED
 *
 * 接口：
 * - POST /api/reimbursements/submit          - 组织者提交报销（状态 SUBMITTED）
 * - GET  /api/reimbursements/mine            - 当前用户的报销
 * - GET  /api/reimbursements/:id             - 报销详情
 * - GET  /api/reimbursements/application/:id - 某申请的所有报销单
 * - GET  /api/reimbursements/pending         [OPERATOR/ADMIN/VOLUNTEER] - 待审列表
 * - POST /api/reimbursements/:id/approve     [OPERATOR/ADMIN/VOLUNTEER] - 审核通过
 * - POST /api/reimbursements/:id/reject      [OPERATOR/ADMIN/VOLUNTEER] - 打回（需原因）
 * - POST /api/reimbursements/:id/pay         [OPERATOR/ADMIN] - 标记打款（需流水号）
 *
 * v1 简化：无 OCR（receipts 是 URL 列表）；金额上限 10000；助教不独立报销（单条报销只挂一个 organizerId）
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';
import { isAppVolunteerOrAdmin } from '../../utils/ownership';

const router = Router();

interface ReimbursementRecord extends LarkRecord {
  fields: {
    applicationId?: string;
    amount?: number;
    description?: string;
    receipts?: string;          // JSON 数组字符串
    status?: string;
    submittedAt?: number;
    reviewedAt?: number;
    reviewerId?: string;
    reviewRemark?: string;
    paidAt?: number;
    paidBy?: string;
    paymentRef?: string;
    organizerId?: string;
    organizerName?: string;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

const MAX_AMOUNT = 10000;

function serialize(r: ReimbursementRecord) {
  let receipts: string[] = [];
  if (r.fields.receipts) {
    try { receipts = JSON.parse(r.fields.receipts); } catch { receipts = []; }
  }
  return {
    reimbursementId: r.fields.applicationId && r.fields.organizerId
      ? `${r.fields.applicationId}-${r.fields.organizerId}`
      : r.record_id,
    recordId: r.record_id,
    applicationId: r.fields.applicationId,
    amount: r.fields.amount,
    description: r.fields.description,
    receipts,
    status: normStatus(r.fields.status),
    submittedAt: r.fields.submittedAt,
    reviewedAt: r.fields.reviewedAt,
    reviewerId: r.fields.reviewerId,
    reviewRemark: r.fields.reviewRemark,
    paidAt: r.fields.paidAt,
    paidBy: r.fields.paidBy,
    paymentRef: r.fields.paymentRef,
    organizerId: r.fields.organizerId,
    organizerName: r.fields.organizerName,
  };
}

// ===== 提交报销 =====
const submitSchema = z.object({
  applicationId: z.string().min(1),
  amount: z.number().positive().max(MAX_AMOUNT),
  description: z.string().min(1).max(500),
  receipts: z.array(z.string().url()).max(20).optional(),  // v1 简化为 URL 列表
});

router.post('/reimbursements/submit', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userName = req.user!.name;
  const data = submitSchema.parse(req.body);

  // 检查申请是否在 REVIEW_CONFIRMED 状态（v1 简化：必须是这个状态才能报销）
  const appRecords = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    data.applicationId
  );
  const app = appRecords[0] as any;
  if (!app) return fail(res, 404, ErrorCode.NOT_FOUND, '申请不存在');

  const appStatus = normStatus(app.fields.status);
  if (appStatus !== 'REVIEW_CONFIRMED') {
    return fail(res, 400, ErrorCode.BAD_REQUEST,
      `当前申请状态 ${appStatus} 不可报销（仅 REVIEW_CONFIRMED 可报销）`);
  }

  // 查 application 表中的 organizerName/userId（用于关联报销人；dw_applications 用 userId 字段）
  const organizerId = app.fields.userId || userId;
  const organizerName = app.fields.organizerName || userName;

  // 创建报销单
  const recordId = await feishuClient.createRecord(config.feishu.tables.reimbursements, {
    applicationId: data.applicationId,
    amount: data.amount,
    description: data.description,
    receipts: JSON.stringify(data.receipts || []),
    status: 'SUBMITTED',
    submittedAt: Date.now(),
    organizerId,
    organizerName,
  });

  return ok(res, {
    recordId,
    reimbursementId: `${data.applicationId}-${organizerId}`,
    applicationId: data.applicationId,
    amount: data.amount,
    status: 'SUBMITTED',
    message: '报销单已提交，等待运营/志愿者审核',
  });
});

// ===== 我的报销 =====
router.get('/reimbursements/mine', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.reimbursements, { pageSize: 200 });
  const list = (items as ReimbursementRecord[])
    .filter((r) => r.fields.organizerId === userId)
    .sort((a, b) => (b.fields.submittedAt ?? 0) - (a.fields.submittedAt ?? 0))
    .map(serialize);
  return ok(res, { list, total: list.length });
});

// ===== 某申请的所有报销单 =====
router.get('/reimbursements/application/:id', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.reimbursements, { pageSize: 200 });
  const list = (items as ReimbursementRecord[])
    .filter((r) => r.fields.applicationId === id)
    .sort((a, b) => (b.fields.submittedAt ?? 0) - (a.fields.submittedAt ?? 0))
    .map(serialize);
  return ok(res, { list, total: list.length });
});

// ===== 待审列表（运营/志愿者/ADMIN） — 必须在 /:id 之前，否则被拦截 =====
router.get('/reimbursements/pending', authRequired, requireRole('OPERATOR', 'ADMIN', 'VOLUNTEER'), async (req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.reimbursements, { pageSize: 200 });
  const list = (items as ReimbursementRecord[])
    .filter((r) => {
      const s = normStatus(r.fields.status);
      return s === 'SUBMITTED' || s === 'APPROVED';
    })
    .sort((a, b) => (a.fields.submittedAt ?? 0) - (b.fields.submittedAt ?? 0))
    .map(serialize);
  return ok(res, { list, total: list.length });
});

// ===== 报销详情 =====
router.get('/reimbursements/:id', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.reimbursements, { pageSize: 200 });
  const found = (items as ReimbursementRecord[]).find(
    (r) => r.record_id === id || `${r.fields.applicationId}-${r.fields.organizerId}` === id
  );
  if (!found) return fail(res, 404, ErrorCode.NOT_FOUND, '报销单不存在');
  return ok(res, serialize(found));
});

// ===== 审核 =====
const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reviewRemark: z.string().max(500).optional(),
});

// POST /api/reimbursements/:id/review
// v1.2 Frank 27 21:40 反馈：资源所有权检查（org-thu 改 NO.018 报销 bug）
router.post('/reimbursements/:id/review', authRequired, requireRole('OPERATOR', 'ADMIN', 'VOLUNTEER'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const reviewerId = req.user!.userId;
  const role = req.user!.role;
  const data = reviewSchema.parse(req.body);

  const { items } = await feishuClient.listRecords(config.feishu.tables.reimbursements, { pageSize: 200 });
  const r = (items as ReimbursementRecord[]).find(
    (x) => x.record_id === id || `${x.fields.applicationId}-${x.fields.organizerId}` === id
  );
  if (!r) return fail(res, 404, ErrorCode.NOT_FOUND, '报销单不存在');

  // v1.2 资源所有权检查：OPERATOR/ADMIN 全管；VOLUNTEER 必须是 app.volunteerId
  // 查 application（用 reimbursement 的 applicationId）
  if (r.fields.applicationId) {
    const appRecs = await feishuClient.searchRecords(
      config.feishu.tables.applications,
      'applicationId',
      r.fields.applicationId
    );
    const app = appRecs[0] as any;
    if (!isAppVolunteerOrAdmin(app, reviewerId, role)) {
      return fail(res, 403, ErrorCode.FORBIDDEN, '仅该申请的运营、对接志愿者或管理员可审核报销');
    }
  }

  const currentStatus = normStatus(r.fields.status);
  if (currentStatus !== 'SUBMITTED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, `当前状态 ${currentStatus} 不可审核（仅 SUBMITTED 可审核）`);
  }
  if (data.action === 'REJECT' && !data.reviewRemark) {
    return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '打回需填写原因');
  }

  const newStatus = data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  await feishuClient.updateRecord(config.feishu.tables.reimbursements, r.record_id, {
    status: newStatus,
    reviewedAt: Date.now(),
    reviewerId,
    reviewRemark: data.reviewRemark,
  });

  return ok(res, {
    recordId: r.record_id,
    status: newStatus,
    message: data.action === 'APPROVE' ? '审核通过' : '已打回',
  });
});

// ===== 标记打款 =====
const paySchema = z.object({
  paymentRef: z.string().min(1).max(100),  // 打款流水号必填
});

router.post('/reimbursements/:id/pay', authRequired, requireRole('OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const paidBy = req.user!.userId;
  const data = paySchema.parse(req.body);

  const { items } = await feishuClient.listRecords(config.feishu.tables.reimbursements, { pageSize: 200 });
  const r = (items as ReimbursementRecord[]).find(
    (x) => x.record_id === id || `${x.fields.applicationId}-${x.fields.organizerId}` === id
  );
  if (!r) return fail(res, 404, ErrorCode.NOT_FOUND, '报销单不存在');

  const currentStatus = normStatus(r.fields.status);
  if (currentStatus !== 'APPROVED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, `当前状态 ${currentStatus} 不可打款（仅 APPROVED 可打款）`);
  }

  await feishuClient.updateRecord(config.feishu.tables.reimbursements, r.record_id, {
    status: 'PAID',
    paidAt: Date.now(),
    paidBy,
    paymentRef: data.paymentRef,
  });

  // 写回到 application：标记 reimbursementStatus
  const appRecords = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    r.fields.applicationId!
  );
  const app = appRecords[0] as any;
  if (app) {
    let newBreakdown: any = {};
    try { newBreakdown = app.fields.scoreBreakdown ? JSON.parse(app.fields.scoreBreakdown) : {}; } catch {}
    newBreakdown.auditLog = newBreakdown.auditLog || [];
    newBreakdown.auditLog.push({
      action: 'REIMBURSEMENT_PAID',
      reimbursementRecordId: r.record_id,
      amount: r.fields.amount,
      paidBy,
      paymentRef: data.paymentRef,
      at: Date.now(),
    });
    await feishuClient.updateRecord(config.feishu.tables.applications, app.record_id, {
      scoreBreakdown: JSON.stringify(newBreakdown),
    });
  }

  return ok(res, {
    recordId: r.record_id,
    status: 'PAID',
    paidBy,
    paymentRef: data.paymentRef,
    message: '已标记打款',
  });
});

export default router;
