/**
 * 站内消息（v7 · PRD §4.1.8 US-O11）
 *
 * 接口：
 * - GET  /api/messages/mine          - 我的消息（按时间倒序）
 * - GET  /api/messages/unread/count   - 未读数量（用于 Bell Badge）
 * - POST /api/messages/:id/read      - 标记已读
 * - POST /api/messages/read-all      - 全部已读
 *
 * v1 简化：消息从 events 触发（applications controller submit / admin approve 等）
 * v2 改用事件总线统一管理
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

interface MessageRecord extends LarkRecord {
  fields: {
    messageId?: string;
    userId?: string;
    userName?: string;
    type?: string;
    title?: string;
    content?: string;
    link?: string;
    read?: boolean;
    createdAt?: number;
  };
}

const normType = (s: any): string =>
  Array.isArray(s) ? String(s[0] ?? '') : String(s ?? '');

const normRead = (r: any): boolean => {
  if (typeof r === 'boolean') return r;
  if (Array.isArray(r)) return r[0] === true || r[0] === 'true';
  return r === true || r === 'true';
};

function serialize(m: MessageRecord) {
  return {
    recordId: m.record_id,
    messageId: m.fields.messageId,
    userId: m.fields.userId,
    userName: m.fields.userName,
    type: normType(m.fields.type),
    title: m.fields.title,
    content: m.fields.content,
    link: m.fields.link,
    read: normRead(m.fields.read),
    createdAt: m.fields.createdAt,
  };
}

function nextMessageId(): string {
  return `MSG-${String(Date.now()).slice(-6)}`;
}

// 供其他模块调用：发站内消息
export async function sendMessage(opts: {
  userId: string;
  userName?: string;
  type: 'APPLICATION_SUBMIT' | 'APPLICATION_APPROVE' | 'APPLICATION_REJECT' | 'REIMBURSEMENT_PAID' | 'STAGE_TASK' | 'SYSTEM';
  title: string;
  content: string;
  link?: string;
}): Promise<string> {
  const messageId = nextMessageId();
  await feishuClient.createRecord(config.feishu.tables.messages, {
    messageId,
    userId: opts.userId,
    userName: opts.userName ?? '',
    type: opts.type,
    title: opts.title,
    content: opts.content,
    link: opts.link ?? '',
    read: false,
    createdAt: Date.now(),
  });
  return messageId;
}

// GET /api/messages/mine
router.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, { pageSize: 200 });
  const mine = (items as MessageRecord[])
    .filter((m) => m.fields.userId === userId)
    .sort((a, b) => (b.fields.createdAt ?? 0) - (a.fields.createdAt ?? 0))
    .map(serialize);
  return ok(res, { list: mine, total: mine.length });
});

// GET /api/messages/unread/count - Bell Badge
router.get('/unread/count', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, { pageSize: 200 });
  const count = (items as MessageRecord[]).filter(
    (m) => m.fields.userId === userId && !normRead(m.fields.read)
  ).length;
  return ok(res, { count });
});

// POST /api/messages/:id/read - 标记已读
router.post('/:id/read', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  // id 可为 messageId 或 recordId
  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, { pageSize: 200 });
  const m = (items as MessageRecord[]).find(
    (x) => x.record_id === id || x.fields.messageId === id
  );
  if (!m) return fail(res, 404, ErrorCode.NOT_FOUND, '消息不存在');
  if (m.fields.userId !== userId) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '无权操作该消息');
  }

  await feishuClient.updateRecord(config.feishu.tables.messages, m.record_id, {
    read: true,
  });

  return ok(res, { messageId: id, read: true, message: '已标记已读' });
});

// POST /api/messages/read-all - 全部已读
router.post('/read-all', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, { pageSize: 200 });
  const mine = (items as MessageRecord[]).filter(
    (m) => m.fields.userId === userId && !normRead(m.fields.read)
  );
  for (const m of mine) {
    await feishuClient.updateRecord(config.feishu.tables.messages, m.record_id, {
      read: true,
    });
  }
  return ok(res, { count: mine.length, message: '已全部标记已读' });
});

// =====================================================================
// v8 A.6 通知日志（PRD §4.2.6 US-P9）— 运营看消息发送记录 + 重发
// =====================================================================

const adminListSchema = z.object({
  userId: z.string().optional(),
  type: z.string().optional(),
  read: z.enum(['true', 'false', 'all']).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

// GET /api/messages/admin/log - 运营看所有消息（按 user/type/read 过滤）
router.get('/admin/log', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const data = adminListSchema.parse(req.query);

  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, {
    pageSize: data.pageSize ?? 200,
  });

  let filtered = items as MessageRecord[];
  if (data.userId) {
    filtered = filtered.filter((m) => m.fields.userId === data.userId);
  }
  if (data.type) {
    filtered = filtered.filter((m) => normType(m.fields.type) === data.type);
  }
  if (data.read && data.read !== 'all') {
    const want = data.read === 'true';
    filtered = filtered.filter((m) => normRead(m.fields.read) === want);
  }

  filtered = filtered.sort((a, b) => (b.fields.createdAt ?? 0) - (a.fields.createdAt ?? 0));

  const page = data.page ?? 1;
  const pageSize = data.pageSize ?? 200;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return ok(res, {
    list: paged.map(serialize),
    total: filtered.length,
    page,
    pageSize,
  });
});

// POST /api/messages/admin/:id/resend - 重发某条消息
router.post('/admin/:id/resend', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, { pageSize: 200 });
  const m = (items as MessageRecord[]).find(
    (x) => x.record_id === id || x.fields.messageId === id
  );
  if (!m) return fail(res, 404, ErrorCode.NOT_FOUND, '消息不存在');

  const newMessageId = `MSG-${String(Date.now()).slice(-6)}`;
  await feishuClient.createRecord(config.feishu.tables.messages, {
    messageId: newMessageId,
    userId: m.fields.userId,
    userName: m.fields.userName,
    type: m.fields.type,
    title: m.fields.title,
    content: m.fields.content,
    link: m.fields.link,
    read: false,
    createdAt: Date.now(),
  });

  console.log(`[NOTIFY-RESEND] 重发消息 ${id} → ${m.fields.userId} (新 messageId: ${newMessageId})`);

  return ok(res, {
    originalMessageId: id,
    newMessageId,
    userId: m.fields.userId,
    message: '已重发',
  });
});

// GET /api/messages/admin/stats - 消息统计（按 type 聚合）
router.get('/admin/stats', authRequired, requireRole('ADMIN', 'OPERATOR'), async (_req: Request, res: Response) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.messages, { pageSize: 500 });

  const byType: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  let unread = 0;
  for (const m of items as MessageRecord[]) {
    const t = normType(m.fields.type) || 'UNKNOWN';
    byType[t] = (byType[t] ?? 0) + 1;
    const u = m.fields.userId || 'UNKNOWN';
    byUser[u] = (byUser[u] ?? 0) + 1;
    if (!normRead(m.fields.read)) unread += 1;
  }

  return ok(res, {
    total: items.length,
    unread,
    byType,
    byUser,
  });
});

export default router;
