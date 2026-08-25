/**
 * 物料下载（v9 · PRD §4.1.6 US-V5 / §4.2.5 US-P8）
 *
 * 接口：
 * - GET  /api/materials                  - 列出物料（按 scope/activityId/category 过滤）
 * - GET  /api/materials/:id              - 物料详情
 * - POST /api/materials                  - 上传物料（admin/operator）
 * - DELETE /api/materials/:id            - 删除物料（admin/operator）
 * - GET  /api/activities/:id/materials    - 某活动可见的物料（该活动 scope + 全局 GLOBAL）
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface MaterialRecord extends LarkRecord {
  fields: {
    materialId?: string;
    name?: string;
    category?: string;
    scope?: string;
    activityId?: string;
    fileUrl?: string;
    fileSize?: number;
    description?: string;
    uploadedBy?: string;
    uploadedAt?: number;
  };
}

const normStr = (s: any): string =>
  Array.isArray(s) ? String(s[0] ?? '') : String(s ?? '');

function serialize(m: MaterialRecord) {
  return {
    recordId: m.record_id,
    materialId: m.fields.materialId,
    name: m.fields.name,
    category: normStr(m.fields.category),
    scope: normStr(m.fields.scope),
    activityId: m.fields.activityId,
    fileUrl: m.fields.fileUrl,
    fileSize: m.fields.fileSize,
    description: m.fields.description,
    uploadedBy: m.fields.uploadedBy,
    uploadedAt: m.fields.uploadedAt,
  };
}

function nextMaterialId(): string {
  return `MAT-${String(Date.now()).slice(-6)}`;
}

const listSchema = z.object({
  scope: z.enum(['GLOBAL', 'ACTIVITY']).optional(),
  activityId: z.string().optional(),
  category: z.string().optional(),
});

// GET /api/materials - 列出物料（admin/operator 视角，含所有用户上传）
router.get('/', authRequired, async (req: Request, res: Response) => {
  const data = listSchema.parse(req.query);
  const { items } = await feishuClient.listRecords(config.feishu.tables.materials, { pageSize: 200 });
  let filtered = items as MaterialRecord[];
  if (data.scope) filtered = filtered.filter((m) => normStr(m.fields.scope) === data.scope);
  if (data.activityId) {
    filtered = filtered.filter((m) => m.fields.activityId === data.activityId);
  }
  if (data.category) {
    filtered = filtered.filter((m) => normStr(m.fields.category) === data.category);
  }
  filtered = filtered.sort((a, b) => (b.fields.uploadedAt ?? 0) - (a.fields.uploadedAt ?? 0));
  return ok(res, { list: filtered.map(serialize), total: filtered.length });
});

// GET /api/activities/:id/materials - 某活动可见的物料（该活动 + 全局）
router.get('/activities/:id/materials', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.materials, { pageSize: 200 });
  const visible = (items as MaterialRecord[]).filter(
    (m) => m.fields.activityId === id || normStr(m.fields.scope) === 'GLOBAL'
  ).sort((a, b) => (b.fields.uploadedAt ?? 0) - (a.fields.uploadedAt ?? 0));
  return ok(res, { list: visible.map(serialize), total: visible.length });
});

// GET /api/materials/:id
router.get('/:id', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(
    config.feishu.tables.materials,
    'materialId',
    id
  );
  const m = records[0] as MaterialRecord | undefined;
  if (!m) return fail(res, 404, ErrorCode.NOT_FOUND, '物料不存在');
  return ok(res, { material: serialize(m) });
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['POSTER', 'GUIDE', 'TEMPLATE', 'SLIDES', 'VIDEO', 'OTHER']),
  scope: z.enum(['GLOBAL', 'ACTIVITY']).default('GLOBAL'),
  activityId: z.string().optional(),
  fileUrl: z.string().min(1).max(2000),
  fileSize: z.number().int().min(0).optional(),
  description: z.string().max(500).optional(),
});

// POST /api/materials - 上传物料（v1 简化：URL + 元数据，文件直传走飞书云空间 UI）
router.post('/', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const data = createSchema.parse(req.body);

  if (data.scope === 'ACTIVITY' && !data.activityId) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, 'scope=ACTIVITY 必须指定 activityId');
  }

  const materialId = nextMaterialId();
  await feishuClient.createRecord(config.feishu.tables.materials, {
    materialId,
    name: data.name,
    category: data.category,
    scope: data.scope,
    activityId: data.activityId ?? '',
    fileUrl: data.fileUrl,
    fileSize: data.fileSize ?? 0,
    description: data.description ?? '',
    uploadedBy: userId,
    uploadedAt: Date.now(),
  });

  return ok(res, { materialId, message: '物料已上传' });
});

// DELETE /api/materials/:id
router.delete('/:id', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(
    config.feishu.tables.materials,
    'materialId',
    id
  );
  const m = records[0] as MaterialRecord | undefined;
  if (!m) return fail(res, 404, ErrorCode.NOT_FOUND, '物料不存在');
  await feishuClient.deleteRecord(config.feishu.tables.materials, m.record_id);
  return ok(res, { materialId: id, message: '已删除' });
});

export default router;
