/**
 * 高校库（v1.2 Frank 17:08 加 · PRD §2.2 高校库 R/W）
 *
 * 飞书表 dw_universities 字段：
 * - univId (auto_number 1, 2, 3...) — 飞书自增
 * - name (text) - 学校全名
 * - shortName (text) - 简称
 * - tier (select: 985/211/双一流/本科/高职)
 * - city (text)
 * - province (text)
 * - district (text)
 * - address (text)
 * - createdAt (created_at)
 *
 * v1 接口（v1 简化）：
 * - GET  /api/universities           - 公开（活动大厅 Cascader 用）
 * - GET  /api/universities/count     - 公开（KPI "覆盖高校" 用）
 * - GET  /api/admin/universities      - 列表（admin/operator）
 * - POST /api/admin/universities      - 新增（admin/operator）
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface UnivRecord extends LarkRecord {
  fields: {
    univId?: number;
    name?: string;
    shortName?: string;
    tier?: string[] | string;
    city?: string;
    province?: string;
    district?: string;
    address?: string;
  };
}

const normTier = (t: any): string => (Array.isArray(t) ? String(t[0] ?? '') : String(t ?? ''));

// 列表返回结构
interface UnivListItem {
  univId: number;
  name: string;
  shortName: string;
  tier: string;
  city: string;
  province: string;
  district: string;
  address: string;
}

function toItem(r: UnivRecord): UnivListItem {
  return {
    univId: r.fields.univId ?? 0,
    name: r.fields.name ?? '',
    shortName: r.fields.shortName ?? '',
    tier: normTier(r.fields.tier),
    city: r.fields.city ?? '',
    province: r.fields.province ?? '',
    district: r.fields.district ?? '',
    address: r.fields.address ?? '',
  };
}

// ========== 公开接口 ==========

// GET /api/universities - 列表（活动大厅 Cascader 用）
router.get('/', async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.universities, { pageSize: 200 });
  const list = (items as UnivRecord[]).map(toItem);
  // 按 province 排序，再按 name 排序
  list.sort((a, b) => {
    if (a.province !== b.province) return a.province.localeCompare(b.province, 'zh-CN');
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return ok(res, { list, total: list.length });
});

// GET /api/universities/count - KPI 覆盖高校用
router.get('/count', async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.universities, { pageSize: 200 });
  return ok(res, { total: (items as UnivRecord[]).length });
});

// ========== Admin 接口 ==========

const createSchema = z.object({
  name: z.string().min(1).max(50),
  shortName: z.string().max(20).optional(),
  tier: z.enum(['985', '211', '双一流', '本科', '高职']),
  city: z.string().min(1).max(20),
  province: z.string().min(1).max(20),
  district: z.string().min(1).max(20),
  address: z.string().min(1).max(200),
});

// GET /api/admin/universities
router.get('/', authRequired, requireRole('ADMIN', 'OPERATOR'), async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.universities, { pageSize: 200 });
  const list = (items as UnivRecord[]).map(toItem);
  list.sort((a, b) => {
    if (a.province !== b.province) return a.province.localeCompare(b.province, 'zh-CN');
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return ok(res, { list, total: list.length });
});

// POST /api/admin/universities
router.post('/', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const data = createSchema.parse(req.body);
  const recordId = await feishuClient.createRecord(config.feishu.tables.universities, {
    name: data.name,
    shortName: data.shortName ?? '',
    tier: [data.tier],
    city: data.city,
    province: data.province,
    district: data.district,
    address: data.address,
  });
  return ok(res, { recordId, message: '高校已添加' });
});

export default router;
