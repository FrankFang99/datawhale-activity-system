/**
 * 数据看板（PRD §4.2.1 · §4.1.10 v2 新增）— ADMIN 默认工作台
 *
 * v1 简化：从 dw_applications + dw_activities + dw_users 实时聚合
 * 后续 v2 可加 Redis 缓存 + 看板布局
 *
 * 接口（挂在 /api/admin/dashboard）：
 * - GET /kpi    - 总览 KPI（申请/活动/用户）
 * - GET /grade  - 评分等级分布
 */

import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface ApplicationRecord extends LarkRecord {
  fields: {
    status?: string;
    grade?: string;
    submittedAt?: number;
  };
}

interface ActivityRecord extends LarkRecord {
  fields: {
    status?: string;
  };
}

interface UserRecord extends LarkRecord {
  fields: {
    role?: string;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

// GET /api/admin/dashboard/kpi
router.get('/kpi', authRequired, requireRole('ADMIN', 'OPERATOR'), async (_req: Request, res: Response) => {
  // 顺序调用飞书（lark-cli 1.0.88 + tsx watch 并行句柄会冲突）
  const apps = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const acts = await feishuClient.listRecords(config.feishu.tables.activities, { pageSize: 200 });
  const users = await feishuClient.listRecords(config.feishu.tables.users, { pageSize: 200 });

  const byAppStatus: Record<string, number> = {};
  let thisMonthApps = 0;
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  for (const a of apps.items as ApplicationRecord[]) {
    const s = normStatus(a.fields.status);
    byAppStatus[s] = (byAppStatus[s] ?? 0) + 1;
    if ((a.fields.submittedAt ?? 0) > monthAgo) thisMonthApps += 1;
  }

  const byActStatus: Record<string, number> = {};
  for (const a of acts.items as ActivityRecord[]) {
    const s = normStatus(a.fields.status);
    byActStatus[s] = (byActStatus[s] ?? 0) + 1;
  }

  const byRole: Record<string, number> = {};
  for (const u of users.items as UserRecord[]) {
    const r = normStatus(u.fields.role);
    byRole[r] = (byRole[r] ?? 0) + 1;
  }

  return ok(res, {
    applications: {
      total: apps.items.length,
      byStatus: byAppStatus,
      pending: byAppStatus['SCREENING'] ?? 0,
      reviewing: byAppStatus['REVIEWING'] ?? 0,
      thisMonth: thisMonthApps,
    },
    activities: {
      total: acts.items.length,
      byStatus: byActStatus,
    },
    users: {
      total: users.items.length,
      byRole,
    },
  });
});

// GET /api/admin/dashboard/grade
router.get('/grade', authRequired, requireRole('ADMIN', 'OPERATOR'), async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const byGrade: Record<string, number> = {};
  for (const a of items as ApplicationRecord[]) {
    const g = a.fields.grade;
    if (g) byGrade[g] = (byGrade[g] ?? 0) + 1;
  }
  return ok(res, { byGrade });
});

export default router;
