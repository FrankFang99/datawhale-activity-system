/**
 * 活动管理（PRD §4.2.3 · v6）— ADMIN / OPERATOR 专用
 *
 * 接口（挂在 /api/admin/activities）：
 * - GET    /                  - 活动列表（admin/operator 可见全部状态）
 * - POST   /                  - 创建活动（默认 DRAFT）
 * - PUT    /:id               - 更新活动信息
 * - POST   /:id/publish       - 上架（DRAFT/PENDING → PUBLISHED）
 * - POST   /:id/unpublish     - 下架（PUBLISHED → DRAFT）
 * - POST   /:id/archive       - 归档（→ ARCHIVED）
 *
 * v1 简化：不做并发控制（依赖飞书 Base 乐观锁）
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

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
    groupQrCode?: string;
    // Frank 2026-08-21 #4：组织者确认后精确字段（确认后必填）
    startTime?: string;
    endTime?: string;
    confirmedAddress?: string;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

// activityId 自增（NO.0001 起，4 位 0-padded；v1.2 Frank 17:08 Comment 1）
async function nextActivityId(): Promise<string> {
  const { items } = await feishuClient.listRecords(config.feishu.tables.activities, { pageSize: 200 });
  const ids = (items as ActivityRecord[])
    .map((a) => a.fields.activityId)
    .filter((s): s is string => !!s && /^NO\.\d+$/.test(s))
    .map((s) => parseInt(s.slice(3), 10));
  const max = ids.length > 0 ? Math.max(...ids) : 0;
  return `NO.${String(max + 1).padStart(4, '0')}`;
}

// Frank 2026-08-21 #5 飞书群二维码必填：链接格式校验
// 接受：
//  - 飞书群 PC 端链接：https://feishu.cn/group/<chat_id> 或 https://*.larksuite.com/group/<chat_id>
//  - 飞书群 QR 图 URL：https://applink.feishu.cn/client/chat/...
//  - 飞书群 QR 码 base64：data:image/...;base64,...
//  - 任何 https:// 开头的 URL（v1 简化：运营手工粘贴后我们存原样，活动详情"扫码加群"按钮直接跳转）
const groupQrCodeSchema = z
  .string()
  .min(1, '飞书群二维码不能为空')
  .max(2000)
  .refine(
    (s) => {
      const trimmed = s.trim();
      // 飞书群链接
      if (/^https?:\/\/([\w-]+\.)?(feishu\.cn|larksuite\.com)\//i.test(trimmed)) return true;
      // base64 QR 图
      if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(trimmed)) return true;
      // 任何 https URL（兜底：v1 简化）
      if (/^https:\/\//i.test(trimmed)) return true;
      return false;
    },
    { message: '请填写有效的飞书群链接（feishu.cn 或 larksuite.com 域名）或飞书群 QR 图 URL（https:// 开头）' }
  );

const createSchema = z.object({
  title: z.string().min(1).max(100),
  series: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  coverImage: z.string().url().optional(),
  location: z.string().max(100).optional(),
  startDate: z.number().int().positive().optional(),
  endDate: z.number().int().positive().optional(),
  maxParticipants: z.number().int().min(1).max(500).optional(),
  requirements: z.string().max(1000).optional(),
  // Frank 2026-08-21 #5: 飞书群二维码必填
  groupQrCode: groupQrCodeSchema,
  // Frank 2026-08-21 #4: 精确时间 + 地址（PENDING 时不填，PUBLISHED 时由组织者补）
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime 需为 HH:mm 格式，如 14:00').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime 需为 HH:mm 格式，如 18:00').optional(),
  confirmedAddress: z.string().max(200).optional(),
});

const updateSchema = createSchema.partial();

// Frank 2026-08-21 #4: HH:mm 格式校验
const timeRegex = /^\d{2}:\d{2}$/;

// GET /api/admin/activities - 活动列表（admin/operator 可见全部）
router.get('/', authRequired, requireRole('ADMIN', 'OPERATOR'), async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.activities, { pageSize: 100 });
  const list = (items as ActivityRecord[]).map((a) => ({
    activityId: a.fields.activityId,
    title: a.fields.title,
    description: a.fields.description,
    coverImage: a.fields.coverImage,
    status: normStatus(a.fields.status),
    series: a.fields.series,
    startDate: a.fields.startDate,
    endDate: a.fields.endDate,
    location: a.fields.location,
    maxParticipants: a.fields.maxParticipants,
    requirements: a.fields.requirements,
    groupQrCode: a.fields.groupQrCode,
  }));
  return ok(res, { list, total: list.length });
});

// POST /api/admin/activities - 创建活动
router.post('/', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const data = createSchema.parse(req.body);
  const activityId = await nextActivityId();
  const recordId = await feishuClient.createRecord(config.feishu.tables.activities, {
    activityId,
    title: data.title,
    series: data.series ?? '',
    description: data.description ?? '',
    coverImage: data.coverImage ?? '',
    location: data.location ?? '',
    startDate: data.startDate,
    endDate: data.endDate,
    maxParticipants: data.maxParticipants ?? 50,
    requirements: data.requirements ?? '',
    groupQrCode: data.groupQrCode ?? '',
    status: 'DRAFT',
  });
  return ok(res, { activityId, recordId, message: '活动已创建（草稿状态）' });
});

// PUT /api/admin/activities/:id - 更新
router.put('/:id', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.activities,
    'activityId',
    id
  );
  const a = records[0] as ActivityRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.ACT_001_NOT_FOUND, '活动不存在');

  await feishuClient.updateRecord(config.feishu.tables.activities, a.record_id, data);
  return ok(res, { activityId: id, message: '活动已更新' });
});

// POST /api/admin/activities/:id/publish - 上架
router.post('/:id/publish', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(config.feishu.tables.activities, 'activityId', id);
  const a = records[0] as ActivityRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.ACT_001_NOT_FOUND, '活动不存在');

  const currentStatus = normStatus(a.fields.status);
  if (currentStatus === 'PUBLISHED') return ok(res, { activityId: id, status: 'PUBLISHED', message: '活动已是发布状态' });

  // Frank 2026-08-21 #5: 飞书群二维码必填才能上架（否则活动详情"扫码加群"按钮不显示）
  const qr = (a.fields.groupQrCode ?? '').trim();
  if (!qr) {
    return fail(res, 400, ErrorCode.ACT_001_NOT_FOUND, '飞书群二维码不能为空，请先填写后再上架');
  }

  // Frank 2026-08-21 #4: 已确定组织者后，精确时间 + 精确地址必填才能上架
  const startTime = (a.fields.startTime ?? '').trim();
  const endTime = (a.fields.endTime ?? '').trim();
  const confirmedAddress = (a.fields.confirmedAddress ?? '').trim();
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime) || !confirmedAddress) {
    return fail(res, 400, ErrorCode.ACT_001_NOT_FOUND, '请先填写精确开始时间 + 结束时间 + 确认地址（HH:mm 格式，如 14:00）');
  }

  await feishuClient.updateRecord(config.feishu.tables.activities, a.record_id, { status: 'PUBLISHED' });
  return ok(res, { activityId: id, status: 'PUBLISHED', message: '活动已上架' });
});

// POST /api/admin/activities/:id/unpublish - 下架
router.post('/:id/unpublish', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(config.feishu.tables.activities, 'activityId', id);
  const a = records[0] as ActivityRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.ACT_001_NOT_FOUND, '活动不存在');

  await feishuClient.updateRecord(config.feishu.tables.activities, a.record_id, { status: 'DRAFT' });
  return ok(res, { activityId: id, status: 'DRAFT', message: '活动已下架' });
});

// POST /api/admin/activities/:id/archive - 归档
router.post('/:id/archive', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(config.feishu.tables.activities, 'activityId', id);
  const a = records[0] as ActivityRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.ACT_001_NOT_FOUND, '活动不存在');

  await feishuClient.updateRecord(config.feishu.tables.activities, a.record_id, { status: 'ARCHIVED' });
  return ok(res, { activityId: id, status: 'ARCHIVED', message: '活动已归档' });
});

export default router;
