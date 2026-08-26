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

// v1.2 Frank 21:21：封面图接受 3 种格式
// 1) data:image/<任意>;base64,...  (前端 Upload 组件拿到后端响应前)
// 2) https://... 或 http://...     (外链 CDN 图)
// 3) /uploads/...                  (后端 upload 路由返回的相对路径，前端 Upload onChange setFieldValue 写入)
// 注意：第 3 种之前没被接受 → Frank 上传图后保存失败（schema 第三次改漏了）
const coverImageSchema = z
  .string()
  .max(500000)
  .refine(
    (s) => {
      const t = s.trim();
      // 1) data URL
      if (t.startsWith('data:image/') && t.includes(';base64,')) return true;
      // 2) 绝对 URL
      if (/^https?:\/\//i.test(t)) return true;
      // 3) 相对路径（后端 /uploads/...）
      if (t.startsWith('/')) return true;
      return false;
    },
    { message: '请填写有效的图片 URL（https:// 开头）或上传图片文件' }
  );

const createSchema = z.object({
  title: z.string().min(1).max(100),
  series: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  // v1.2 Frank 21:00：coverImage 用 coverImageSchema（接受 data:base64），不再用 .url()
  coverImage: coverImageSchema.optional(),
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
  // v1.2 Frank 22:29 反馈：5 阶段时间线 JSON 字符串
  // 运营创建活动时存到飞书，活动详情页读出渲染
  // 空字符串/null = 用代码默认骨架 (DEFAULT_ACTIVITY_STAGES)
  stages: z.string().max(20000).optional(),
});

const updateSchema = createSchema.partial();

// Frank 2026-08-21 #4: HH:mm 格式校验
const timeRegex = /^\d{2}:\d{2}$/;

// v1.2 Frank 22:29 反馈：5 阶段时间轴默认骨架（活动级别 T-10→T+3）
// v1.2 Frank 23:37 升级：每个阶段拆解为子任务
// 数据源：frontend/src/data/stageSubtasks.ts 的 STAGE_TEMPLATES_FRANK（Frank 之前交付版）
// 同 series 的活动后续会复用此模板作为起点（v2 完善：dw_activity_series_templates 表）
export const DEFAULT_ACTIVITY_STAGES = [
  {
    name: '确认意向', offsetDays: -10, stage: 'INTENT',
    description: '志愿者与组织者飞书 IM 沟通，最终确定活动方案；组织者阅读并确认行动指南后开始填空表单。',
    subTasks: [
      { order: 1, name: '志愿者和组织者互加飞书好友',         ownerType: 'VOLUNTEER', proofHint: '好友关系建立截图' },
      { order: 2, name: '阅读并确认行动指南',                 ownerType: 'ORGANIZER', proofHint: '飞书文档（已读 + 确认）' },
      { order: 3, name: '双方最终确认活动方案/时间/地点/规模',  ownerType: 'ORGANIZER', proofHint: '组织者填写具体时间（必填到日，几点到几点可选）、具体地点、预计规模 → 同步飞书 base' },
      { order: 4, name: '飞书日历登记活动',                   ownerType: 'ORGANIZER', proofHint: '志愿者添加日历后，组织者确认打勾' },
    ],
  },
  {
    name: '对外招募', offsetDays: -7, stage: 'RECRUIT',
    description: '建群、定制视觉物料、发布报名表单、联系助教/嘉宾、启动本地招募宣传。',
    subTasks: [
      { order: 1, name: '建立活动群聊（现场微信群、飞书 QQ 兴趣群等）',  ownerType: 'ORGANIZER', proofHint: '群二维码或链接' },
      { order: 2, name: '定制视觉物料（海报、横幅、手举牌、旗帜、推文等）', ownerType: 'ORGANIZER', proofHint: '海报图' },
      { order: 3, name: '启动招募宣传（公众号、朋友圈、微信群、小红书等）', ownerType: 'ORGANIZER', proofHint: '推文截图' },
      { order: 4, name: '联系助教 / 主讲嘉宾',                                ownerType: 'ORGANIZER', proofHint: '沟通记录' },
    ],
  },
  {
    name: '现场筹备', offsetDays: -3, stage: 'PREPARE',
    description: '确认场地、运营/组织者/助教完成实操教程培训、准备现场物料（邮寄/打印/PPT/相机）。',
    subTasks: [
      { order: 1, name: '确认场地并上传信息',     ownerType: 'ORGANIZER', proofHint: '场地照片 + 精确地址' },
      { order: 2, name: '和助教一起完成实操教程', ownerType: 'ORGANIZER', proofHint: '培训截图' },
      { order: 3, name: '准备现场物料（邮寄、打印、PPT、相机等）', ownerType: 'ORGANIZER', proofHint: '物料清单' },
    ],
  },
  {
    name: '活动执行', offsetDays: 0, stage: 'EXECUTE',
    description: '现场签到、嘉宾分享 + 动手实操、采集现场素材、引导参与者上传作品墙获取徽章认证。',
    subTasks: [
      { order: 1, name: '现场签到与引导',                                  ownerType: 'ORGANIZER', proofHint: '签到截图' },
      { order: 2, name: '嘉宾分享 + 动手实操',                              ownerType: 'ORGANIZER', proofHint: '现场照片≥3 张' },
      { order: 3, name: '采集现场素材（横版高清照片，视频可选）',           ownerType: 'ORGANIZER', proofHint: '素材链接' },
      { order: 4, name: '引导参与者上传到作品墙获取徽章认证',                ownerType: 'ORGANIZER', proofHint: '作品墙截图' },
    ],
  },
  {
    name: '活动复盘', offsetDays: 3, stage: 'REVIEW',
    description: '提交复盘文档（含现场素材）、整理活动素材、志愿者审核。',
    subTasks: [
      { order: 1, name: '提交活动复盘',       ownerType: 'ORGANIZER', proofHint: '复盘文档' },
      { order: 2, name: '整理活动素材',       ownerType: 'ORGANIZER', proofHint: '素材汇总' },
      { order: 3, name: '志愿者审核 + 可推荐优秀', ownerType: 'VOLUNTEER', proofHint: 'reviewStatus=APPROVED' },
    ],
  },
];

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
    stages: a.fields.stages,
  }));
  return ok(res, { list, total: list.length });
});

// POST /api/admin/activities - 创建活动
router.post('/', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  // v1.2 Frank 21:00：try-catch zod 错误返 400，避免 unhandled rejection → 前端 hang 到 timeout
  let data;
  try {
    data = createSchema.parse(req.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const detail = err.errors.map((e) => `${e.path.join('.') || '<root>'}: ${e.message}`).join('; ');
      return fail(res, 400, ErrorCode.BAD_REQUEST, `活动字段不合法 — ${detail}`);
    }
    throw err;
  }
  const activityId = await nextActivityId();

  // v1.2 Frank 22:29：5 阶段时间线
  // 1) 运营传了 stages → 用运营的
  // 2) 没传 + 同 series 有老活动 → 复制同 series 最新一个的 stages（系列复用）
  // 3) 都没 → 用代码默认骨架
  let stagesStr = data.stages;
  if (!stagesStr) {
    if (data.series) {
      const sameSeries = (await feishuClient.listRecords(config.feishu.tables.activities, { pageSize: 200 })).items as ActivityRecord[];
      const latest = sameSeries
        .filter((a) => a.fields.series === data.series && a.fields.stages)
        .sort((a, b) => (b.fields.createdAt ?? 0) - (a.fields.createdAt ?? 0))[0];
      if (latest?.fields.stages) {
        stagesStr = latest.fields.stages;
      }
    }
    if (!stagesStr) {
      stagesStr = JSON.stringify(DEFAULT_ACTIVITY_STAGES);
    }
  }

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
    stages: stagesStr,
  });
  return ok(res, { activityId, recordId, message: '活动已创建（草稿状态）' });
});

// PUT /api/admin/activities/:id - 更新
router.put('/:id', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  // v1.2 Frank 21:00：同上，try-catch zod 错误返 400
  let data;
  try {
    data = updateSchema.parse(req.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const detail = err.errors.map((e) => `${e.path.join('.') || '<root>'}: ${e.message}`).join('; ');
      return fail(res, 400, ErrorCode.BAD_REQUEST, `活动字段不合法 — ${detail}`);
    }
    throw err;
  }

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

  // v1.2 Frank 21:40：放宽上架校验
  // 之前要求精确时间 + 精确地址，但 Frank 产品设计是「时间双轨」：
  // 模糊日期（运营填）+ 精确时间（组织者 INT-1 阶段补）
  // 上架时只用模糊日期/地点，组织者接 INT-1 后再补精确时间/地址
  // → 上架时不再强制要求精确时间+地址
  // startTime / endTime / confirmedAddress 仍可填，但 optional（编辑已有活动时可补）

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
