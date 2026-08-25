/**
 * AI 智能助手（切片 6 · PRD §4.1.10）
 *
 * v1 简化：纯规则关键词匹配（不接 LLM）
 * - FAQ 库：33 条，覆盖 12 大类（经费/物料/嘉宾/权限/报名/宣发/收尾/补充/系统功能）
 * - 匹配算法：分词 + 关键词命中数 + 同义词扩展 + 排序取 Top 1
 * - 置信度 = 命中关键词数 / FAQ 关键词总数
 * - 未匹配：返回 fallback，UI 提示用户重试
 *
 * v2 升级：迁移 FAQ 到飞书 Base + 运营 CRUD + LLM 兜底
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { config } from '../../config';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired } from '../../middleware/auth';
import { FAQS, GREETINGS, FAQ } from './faq-data';

const router = Router();

interface ChatLogRecord extends LarkRecord {
  fields: {
    logId?: string;
    question?: string;
    questionRaw?: string;
    matched?: string;
    faqId?: string;
    confidence?: number;
    userId?: string;
    at?: number;
    feedback?: string;
    feedbackComment?: string;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

// ===== 关键词匹配引擎 =====
function matchFAQ(question: string): { faq: FAQ; confidence: number } | null {
  const q = question.toLowerCase().trim();
  if (!q) return null;

  // 1. 先匹配快捷问答
  for (const g of GREETINGS) {
    if (g.match.some((k) => q.includes(k.toLowerCase()))) {
      return {
        faq: {
          id: 'GREETING',
          category: '快捷',
          question: q,
          answer: g.answer,
          keywords: [],
          synonyms: [],
        },
        confidence: 1.0,
      };
    }
  }

  // 2. 关键词命中排序
  const scored = FAQS.map((faq) => {
    let hit = 0;
    const allKws = [...faq.keywords, ...faq.synonyms];
    for (const kw of allKws) {
      if (q.includes(kw.toLowerCase())) hit++;
    }
    if (hit === 0) return { faq, score: 0, confidence: 0 };
    // 置信度：命中关键词数 / 总关键词数（封顶 1.0）
    const confidence = Math.min(1, hit / Math.max(faq.keywords.length, 3));
    return { faq, score: hit, confidence };
  });

  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  const best = scored[0];
  if (!best || best.score === 0) return null;

  return { faq: best.faq, confidence: Number(best.confidence.toFixed(2)) };
}

// ===== 写日志到飞书 =====
async function writeLog(record: Partial<ChatLogRecord['fields']>): Promise<string> {
  try {
    return await feishuClient.createRecord(config.feishu.tables.chatLogs, record);
  } catch (e: any) {
    // 表不存在或失败时降级：返回 fake logId
    console.warn('[ai] write log failed:', e?.message);
    return `LOG-${Date.now()}`;
  }
}

// ===== POST /api/ai/chat =====
const chatSchema = z.object({
  question: z.string().min(1).max(500),
});

router.post('/ai/chat', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { question } = chatSchema.parse(req.body);

  const result = matchFAQ(question);

  if (result) {
    const logId = await writeLog({
      question: result.faq.question,
      questionRaw: question,
      matched: 'Y',
      faqId: result.faq.id,
      confidence: result.confidence,
      userId,
      at: Date.now(),
    });
    return ok(res, {
      matched: true,
      question: result.faq.question,
      answer: result.faq.answer,
      faqId: result.faq.id,
      category: result.faq.category,
      confidence: result.confidence,
      logId,
    });
  }

  // 未匹配
  const logId = await writeLog({
    questionRaw: question,
    matched: 'N',
    userId,
    at: Date.now(),
  });
  return ok(res, {
    matched: false,
    answer: null,
    logId,
    fallback: 'NOT_FOUND',
    message: '没找到匹配答案，请尝试更具体的关键词，或在对接群提问。',
    suggest: [
      '试试搜索「报销」「海报」「嘉宾」「权限」',
      '或访问活动统筹表 / 飞书文档',
      '对接群提问可帮助补充 FAQ',
    ],
  });
});

// ===== POST /api/ai/feedback =====
const feedbackSchema = z.object({
  logId: z.string().min(1),
  action: z.enum(['UP', 'DOWN']),
  comment: z.string().max(200).optional(),
});

router.post('/ai/feedback', authRequired, async (req: Request, res: Response) => {
  const { logId, action, comment } = feedbackSchema.parse(req.body);

  try {
    const { items } = await feishuClient.listRecords(config.feishu.tables.chatLogs, { pageSize: 200 });
    const r = items.find((x: any) => x.fields.logId === logId);
    if (r) {
      await feishuClient.updateRecord(config.feishu.tables.chatLogs, r.record_id, {
        feedback: action,
        feedbackComment: comment,
      });
    }
  } catch {
    // 降级：更新失败也不影响用户
  }

  return ok(res, { logId, feedback: action, updatedAt: Date.now() });
});

// ===== GET /api/ai/hot-faqs（v1 简化：返回 Top 5 FAQ 快捷入口）=====
router.get('/ai/hot-faqs', authRequired, async (_req: Request, res: Response) => {
  // v1 硬编码 Top 5（v2 从日志统计）
  const hot = FAQS.slice(0, 5).map((f) => ({
    id: f.id,
    question: f.question,
    category: f.category,
  }));
  return ok(res, { list: hot });
});

export default router;
