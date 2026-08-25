/**
 * 志愿者工作台（PRD §3.2 US-V1 / §4.1.5 v2 新增）
 *
 * VOLUNTEER 登录后的默认工作台：「我管理的组织者」申请列表
 * - 按当前 volunteerId 过滤 dw_applications
 * - 按当前 stage（5 阶段）排序
 *
 * 接口：
 * - GET /api/volunteer/workbench           - 我对接的申请列表
 * - GET /api/volunteer/workbench/summary   - 汇总（各阶段数量 + 待办数）
 */

import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface ApplicationRecord extends LarkRecord {
  fields: {
    applicationId?: string;
    applicationNo?: string;
    activityId?: string;
    userId?: string;
    organizerName?: string;
    status?: string;
    score?: number;
    grade?: string;
    scoreBreakdown?: string;
    submittedAt?: number;
    volunteerId?: string;
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  SUBMITTED: { label: '已提交', color: 'blue' },
  SCREENING: { label: '待审批', color: 'gold' },
  CONFIRMED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已拒绝', color: 'red' },
  CANCELLED: { label: '已取消', color: 'default' },
  REVIEWING: { label: 'REVIEW 中', color: 'purple' },
  REVIEW_CONFIRMED: { label: 'REVIEW 已确认', color: 'purple' },
  COMPLETED: { label: '已结案', color: 'green' },
};

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

// GET /api/volunteer/workbench - 列出我对接的申请
router.get('/workbench', authRequired, requireRole('VOLUNTEER', 'OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const volunteerId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });

  // VOLUNTEER 只见自己；OPERATOR/ADMIN 可见全部（兜底）
  const filtered = (items as ApplicationRecord[]).filter((a) => {
    if (req.user!.role === 'VOLUNTEER') return a.fields.volunteerId === volunteerId;
    return true;
  });

  const list = filtered
    .map((a) => {
      const status = normStatus(a.fields.status);
      return {
        applicationId: a.fields.applicationId,
        applicationNo: a.fields.applicationNo,
        activityId: a.fields.activityId,
        organizerName: a.fields.organizerName,
        status,
        statusLabel: STATUS_MAP[status]?.label ?? status,
        statusColor: STATUS_MAP[status]?.color ?? 'default',
        score: a.fields.score,
        grade: a.fields.grade,
        submittedAt: a.fields.submittedAt,
        volunteerId: a.fields.volunteerId,
      };
    })
    .sort((a, b) => {
      // 待办（SCREENING/REVIEWING）排前，已结案排后
      const aActive = ['SCREENING', 'SUBMITTED', 'REVIEWING'].includes(a.status) ? 0 : 1;
      const bActive = ['SCREENING', 'SUBMITTED', 'REVIEWING'].includes(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (b.submittedAt ?? 0) - (a.submittedAt ?? 0);
    });

  return ok(res, { list, total: list.length });
});

// GET /api/volunteer/workbench/summary - 各阶段汇总
router.get('/workbench/summary', authRequired, requireRole('VOLUNTEER', 'OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const volunteerId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });

  const filtered = (items as ApplicationRecord[]).filter((a) => {
    if (req.user!.role === 'VOLUNTEER') return a.fields.volunteerId === volunteerId;
    return true;
  });

  const byStatus: Record<string, number> = {};
  for (const a of filtered) {
    const s = normStatus(a.fields.status);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  return ok(res, {
    total: filtered.length,
    byStatus,
    pending: byStatus['SCREENING'] ?? 0,
    reviewing: byStatus['REVIEWING'] ?? 0,
    completed: (byStatus['COMPLETED'] ?? 0) + (byStatus['CONFIRMED'] ?? 0),
  });
});

export default router;
