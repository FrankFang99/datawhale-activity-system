/**
 * 飞书机器人告警（v1 落地版）
 *
 * 配置：backend/.env 加
 *   LARK_ALERT_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
 *   LARK_ALERT_LEVEL=ERROR   # ERROR / WARN / INFO，低于这个级别不发
 *   LARK_ALERT_ENABLED=true  # 默认 true
 *
 * 用法：
 *   import { alert } from '../utils/alert';
 *   await alert('ERROR', '后端崩溃', { stack: err.stack });
 *
 * 特性：
 * - 异步发送（不阻塞主流程）
 * - 失败也不抛错（告警失败不能反过来把业务搞挂）
 * - 自动节流：同一类型消息 1 分钟内最多发 1 次
 * - 敏感字段过滤（password / token / jwt / cookie）
 */

const WEBHOOK_URL = process.env.LARK_ALERT_WEBHOOK_URL || '';
const LEVEL = (process.env.LARK_ALERT_LEVEL || 'ERROR').toUpperCase();
const ENABLED = process.env.LARK_ALERT_ENABLED !== 'false';

const LEVEL_ORDER: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };

const throttleMap = new Map<string, number>();
const THROTTLE_MS = 60_000; // 1 分钟

const SENSITIVE_KEYS = ['password', 'token', 'jwt', 'cookie', 'authorization', 'secret', 'apikey', 'api_key'];

function sanitize(obj: any, depth = 0): any {
  if (depth > 3) return '[truncated]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 10).map((v) => sanitize(v, depth + 1));
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const lowerK = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerK.includes(s))) {
      out[k] = '***';
    } else {
      out[k] = sanitize(obj[k], depth + 1);
    }
  }
  return out;
}

function shouldThrottle(key: string): boolean {
  const now = Date.now();
  const last = throttleMap.get(key) || 0;
  if (now - last < THROTTLE_MS) return true;
  throttleMap.set(key, now);
  return false;
}

function shouldSend(level: string): boolean {
  const lv = LEVEL_ORDER[level] ?? 3;
  const threshold = LEVEL_ORDER[LEVEL] ?? 3;
  return lv >= threshold;
}

export async function alert(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL',
  title: string,
  data?: Record<string, any>
): Promise<void> {
  if (!ENABLED) return;
  if (!WEBHOOK_URL) {
    if (process.env.NODE_ENV !== 'production') {
      // dev 环境只 console
      console.log(`[alert] ${level} ${title}`, data);
    }
    return;
  }
  if (!shouldSend(level)) return;
  const throttleKey = `${level}:${title}`;
  if (shouldThrottle(throttleKey)) return;

  // 异步 fire-and-forget
  setImmediate(async () => {
    try {
      const sanitized = data ? sanitize(data) : {};
      const card = {
        msg_type: 'interactive',
        card: {
          header: {
            template: level === 'FATAL' || level === 'ERROR' ? 'red' : 'orange',
            title: { tag: 'plain_text', content: `[${level}] ${title}` },
          },
          elements: [
            {
              tag: 'div',
              fields: [
                { is_short: true, text: { tag: 'lark_md', content: `**环境**\n${process.env.NODE_ENV || '?'}` } },
                { is_short: true, text: { tag: 'lark_md', content: `**时间**\n${new Date().toISOString()}` } },
              ],
            },
            {
              tag: 'pre',
              content: { tag: 'plain_text', content: JSON.stringify(sanitized, null, 2).slice(0, 3000) },
            },
          ],
        },
      };
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      // 告警失败不能 throw
      console.error('[alert] failed to send:', err);
    }
  });
}
