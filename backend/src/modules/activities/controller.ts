/**
 * 活动模块：列表 / 详情（v4 修订：支持系列+状态筛选 + 参与者视角）
 *
 * PRD §4.1.2 (列表) + §4.1.3 (详情) + Frank 2026-08-20 补充：
 * - 活动按系列组织（如"AI+X 创造节"下挂各个学校站点）
 * - 活动状态扩展：PENDING（待确定组织者）/ PUBLISHED（准备举办）/ ONGOING（举办中）/ FINISHED（已结束）
 * - 普通用户（参与者）可浏览活动、加入参与者名单
 */

import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired } from '../../middleware/auth';

const router = Router();

interface ActivityRecord extends LarkRecord {
  fields: {
    activityId?: string;
    title?: string;
    description?: string;
    coverImage?: string;
    status?: string;
    startDate?: number;
    endDate?: number;
    location?: string;
    maxParticipants?: number;
    requirements?: string;
    series?: string;
    // Frank 2026-08-21 #4：组织者确认后精确字段
    startTime?: string;       // HH:mm (e.g. "14:00")
    endTime?: string;         // HH:mm (e.g. "18:00")
    confirmedAddress?: string;// 精确地址（楼/层/房间）
  };
}

const normStatus = (a: ActivityRecord | { fields: { status?: any } }): string => {
  const s = a.fields.status;
  if (Array.isArray(s)) return String(s[0] ?? '');
  return String(s ?? '');
};

// v4 修订：状态展示映射
const STATUS_DISPLAY: Record<string, string> = {
  PENDING: '待确定',
  PUBLISHED: '准备举办',
  ONGOING: '举办中',
  FINISHED: '已结束',
  CANCELLED: '已取消',
  DRAFT: '草稿',
  ARCHIVED: '已归档',
};

// Frank 2026-08-21 21:35 #2 升级：活动状态 4 分类规则
//   - 已确定组织者（PUBLISHED）+ 日期已过 → 已结束
//   - 已确定组织者（PUBLISHED）+ 活动当天 → 举办中
//   - 已确定组织者（PUBLISHED）+ 日期未到 → 准备举办
//   - 未确定组织者（PENDING）+ 截止时间已过 → 已结束（Frank 原话：活动办完归入已结束，没办成也是已结束）
//   - 未确定组织者（PENDING）+ 截止时间未到 → 待确定
//   - 活动当天（ONGOING）→ 举办中
//   - 已结案（FINISHED）→ 已结束
//   - 取消（CANCELLED）→ 已取消
//   - 归档（ARCHIVED）→ 已归档
//   - 草稿（DRAFT）→ 草稿
function effectiveStatus(a: ActivityRecord, now: number = Date.now()): string {
  const status = normStatus(a);
  if (status === 'CANCELLED' || status === 'ARCHIVED' || status === 'DRAFT') return status;
  if (status === 'FINISHED' || status === 'ONGOING') return status;  // 已结案 / 进行中
  // Frank 2026-08-22 09:17 修复：飞书 datetime 字段返回 ISO 字符串，需要 parse
  const parseDate = (v: any): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = new Date(v).getTime();
      return isNaN(t) ? 0 : t;
    }
    return 0;
  };
  const start = parseDate(a.fields.startDate);
  const end = parseDate(a.fields.endDate);
  if (end && end < now) return 'FINISHED';   // 截止时间已过 → 已结束（不管是否确定组织者）
  if (start && start <= now && now <= end) return 'ONGOING';  // 活动当天
  // 日期未到，按原 status
  return status;
}

// Frank 2022-08-21 #2：默认排序权重（ONGOING 排最前）
const STATUS_SORT_WEIGHT: Record<string, number> = {
  ONGOING: 0,
  PENDING: 1,
  PUBLISHED: 2,
  FINISHED: 3,
  CANCELLED: 4,
  DRAFT: 5,
  ARCHIVED: 6,
};

function serialize(a: ActivityRecord, detail = false, effective: string = normStatus(a)) {
  const start = typeof a.fields.startDate === 'string' ? new Date(a.fields.startDate).getTime() : (a.fields.startDate ?? 0);
  const end = typeof a.fields.endDate === 'string' ? new Date(a.fields.endDate).getTime() : (a.fields.endDate ?? 0);
  const now = Date.now();
  const daysToStart = start ? Math.ceil((start - now) / (24 * 3600 * 1000)) : null;
  return {
    activityId: a.fields.activityId ?? a.record_id,
    title: a.fields.title ?? '',
    description: a.fields.description ?? '',
    coverImage: a.fields.coverImage ?? '',
    status: effective, // Frank #2: 返回 effective status（按日期动态计算）
    rawStatus: normStatus(a), // 保留原始 status 字段供调试
    statusDisplay: STATUS_DISPLAY[effective] ?? effective,
    series: a.fields.series ?? '',
    startDate: start ? new Date(start).toISOString().slice(0, 10) : null,
    endDate: end ? new Date(end).toISOString().slice(0, 10) : null,
    location: a.fields.location ?? '',
    // Frank #4：精确时间 + 地址（组织者确认后才填）
    startTime: a.fields.startTime ?? '',
    endTime: a.fields.endTime ?? '',
    confirmedAddress: a.fields.confirmedAddress ?? '',
    maxParticipants: a.fields.maxParticipants ?? 0,
    daysToStart,
    requirements: detail ? a.fields.requirements : undefined,
  };
}

// GET /api/activities?keyword=&status=&series=
router.get('/', async (req: Request, res: Response) => {
  const { keyword, status, series, page = '1', pageSize = '12' } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(48, Math.max(1, parseInt(pageSize, 10) || 12));

  const { items } = await feishuClient.listRecords(config.feishu.tables.activities, {
    pageSize: 100,
  });

  let filtered = items as ActivityRecord[];

  // v4 修订：对外开放状态包括 PUBLISHED/PENDING/ONGOING/FINISHED
  filtered = filtered.filter((a) =>
    ['PUBLISHED', 'PENDING', 'ONGOING', 'FINISHED'].includes(normStatus(a))
  );

  // Frank 2026-08-21 #2：先用 effectiveStatus 过滤（用户传 status 时按 effective 匹配）
  if (status) {
    filtered = filtered.filter((a) => effectiveStatus(a) === status);
  }
  if (series) {
    filtered = filtered.filter((a) => (a.fields.series ?? '') === series);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.fields.title?.toLowerCase().includes(kw) ||
        a.fields.description?.toLowerCase().includes(kw) ||
        a.fields.location?.toLowerCase().includes(kw)
    );
  }

  // Frank 2026-08-21 #2：默认排序权重（ONGOING 排最前）
  // 1. effective status 权重（ONGOING=0 → 排最前；FINISHED=3 → 排后）
  // 2. 同 status 内按 startDate 升序（即将开始的在前）
  filtered.sort((a, b) => {
    const sa = effectiveStatus(a);
    const sb = effectiveStatus(b);
    const wa = STATUS_SORT_WEIGHT[sa] ?? 99;
    const wb = STATUS_SORT_WEIGHT[sb] ?? 99;
    if (wa !== wb) return wa - wb;
    // 同 status 内按 startDate 升序
    const da = a.fields.startDate ?? 0;
    const db = b.fields.startDate ?? 0;
    return da - db;
  });

  const total = filtered.length;
  const start = (pageNum - 1) * pageSizeNum;
  const list = filtered.slice(start, start + pageSizeNum).map((a) => serialize(a, false, effectiveStatus(a)));

  // 收集所有系列（前端筛选下拉）
  const allSeries = Array.from(new Set((items as ActivityRecord[]).map((a) => a.fields.series ?? '').filter(Boolean)));

  return ok(res, { list, total, page: pageNum, pageSize: pageSizeNum, series: allSeries });
});

// GET /api/activities/series/list — 列所有活动系列
router.get('/series/list', async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.activities, { pageSize: 100 });
  const series = Array.from(new Set((items as ActivityRecord[]).map((a) => a.fields.series ?? '').filter(Boolean)));
  return ok(res, { series });
});

// GET /api/activities/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(
    config.feishu.tables.activities,
    'activityId',
    id
  );
  const a = records[0] as ActivityRecord | undefined;
  if (!a) {
    return fail(res, 404, ErrorCode.ACT_001_NOT_FOUND, '活动不存在或已下架');
  }
  const status = normStatus(a);
  if (status === 'DRAFT' || status === 'ARCHIVED') {
    return fail(res, 404, ErrorCode.ACT_002_NOT_PUBLISHED, '活动不存在或已下架');
  }

  const data = serialize(a, true, effectiveStatus(a)) as any;  // Frank 2026-08-21 21:35：详情也用 effective status
  // 详情：附加参与者数（v4 修订）
  try {
    const { items: parts } = await feishuClient.listRecords(config.feishu.tables.participants, { pageSize: 200 });
    const activityId = a.fields.activityId ?? '';
    const registered = (parts as any[]).filter((p) =>
      p.fields.activityId === activityId && normStatusField(p.fields.status) === 'REGISTERED'
    );
    data.participantCount = registered.length;
    data.maxParticipants = a.fields.maxParticipants ?? 0;
  } catch { /* 容错 */ }

  // v1.2 Frank 22:29 反馈：判断「是否已确定组织者」
  // PENDING 状态 OR 任何状态但没 CONFIRMED/REVIEWING/COMPLETED 的组织者申请 = 还没组织者
  // 没组织者时，活动详情页显示「申请成为组织者」按钮
  try {
    const { items: apps } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
    const activityId = a.fields.activityId ?? '';
    const hasOrganizer = (apps as any[]).some((x) =>
      x.fields.activityId === activityId &&
      ['CONFIRMED', 'REVIEWING', 'REVIEW_CONFIRMED', 'COMPLETED', 'PREPARING', 'READY', 'RUNNING'].includes(normStatusField(x.fields.status))
    );
    data.hasOrganizer = hasOrganizer;
    data.needOrganizer = !hasOrganizer;
  } catch { /* 容错 */ data.needOrganizer = (status === 'PENDING'); }

  return ok(res, data);
});

function normStatusField(s: any): string {
  if (Array.isArray(s)) return String(s[0] ?? '');
  return String(s ?? '');
}

export default router;
