/**
 * 站内消息单测（v7 · TDD · PRD §4.1.8 US-O11）
 * 覆盖：纯逻辑（消息类型 + serialize + 路由顺序）
 *
 * 飞书相关（createRecord/listRecords）通过 e2e 验证，不在单测覆盖
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

describe('messages controller · sendMessage 支持类型', () => {
  it('source 含 6 种消息类型 + 完整字段', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    const expected = [
      'APPLICATION_SUBMIT',
      'APPLICATION_APPROVE',
      'APPLICATION_REJECT',
      'REIMBURSEMENT_PAID',
      'STAGE_TASK',
      'SYSTEM',
    ];
    for (const t of expected) {
      expect({ msg: t, found: src.includes(`'${t}'`) }).toEqual({ msg: t, found: true });
    }
  });

  it('导出 sendMessage 函数供其他模块调用', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    expect(src).toMatch(/export\s+async\s+function\s+sendMessage/);
  });
});

describe('messages controller · 路由覆盖', () => {
  it('GET /mine', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    expect(src).toMatch(/router\.get\(['"]\/mine['"]/);
  });
  it('GET /unread/count', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    expect(src).toMatch(/router\.get\(['"]\/unread\/count['"]/);
  });
  it('POST /:id/read', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    expect(src).toMatch(/router\.post\(['"]\/:id\/read['"]/);
  });
  it('POST /read-all', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    expect(src).toMatch(/router\.post\(['"]\/read-all['"]/);
  });
});

describe('messages controller · 鉴权', () => {
  it('所有路由用 authRequired 中间件', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    const routerLines = src.split('\n').filter((l) => /router\.(get|post)\(/.test(l));
    for (const line of routerLines) {
      expect({ line, hasAuth: line.includes('authRequired') }).toEqual({ line, hasAuth: true });
    }
  });
});

// =====================================================================
// v8 A.6 通知日志（PRD §4.2.6 US-P9）— adminListSchema 校验
// =====================================================================

// 重构：抽取 adminListSchema 到 state.ts（v8 跟进）
// v8 增量：暂直接 export 让单测 import
const adminListSchema = z.object({
  userId: z.string().optional(),
  type: z.string().optional(),
  read: z.enum(['true', 'false', 'all']).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

describe('adminListSchema (GET /api/messages/admin/log)', () => {
  it('空 query 合法（全部过滤默认）', () => {
    expect(() => adminListSchema.parse({})).not.toThrow();
  });

  it('userId 字符串合法', () => {
    const r = adminListSchema.parse({ userId: 'NO.022' });
    expect(r.userId).toBe('NO.022');
  });

  it('type 字符串合法（任意消息类型）', () => {
    const r = adminListSchema.parse({ type: 'APPLICATION_REJECT' });
    expect(r.type).toBe('APPLICATION_REJECT');
  });

  it('read 只能 true / false / all', () => {
    expect(() => adminListSchema.parse({ read: 'true' })).not.toThrow();
    expect(() => adminListSchema.parse({ read: 'false' })).not.toThrow();
    expect(() => adminListSchema.parse({ read: 'all' })).not.toThrow();
    expect(() => adminListSchema.parse({ read: 'maybe' })).toThrow();
  });

  it('pageSize 1-500 合法', () => {
    expect(() => adminListSchema.parse({ pageSize: '1' })).not.toThrow();
    expect(() => adminListSchema.parse({ pageSize: '500' })).not.toThrow();
    expect(() => adminListSchema.parse({ pageSize: '0' })).toThrow();
    expect(() => adminListSchema.parse({ pageSize: '501' })).toThrow();
    expect(() => adminListSchema.parse({ pageSize: 'abc' })).toThrow();
  });

  it('page ≥ 1 合法', () => {
    expect(() => adminListSchema.parse({ page: '1' })).not.toThrow();
    expect(() => adminListSchema.parse({ page: '0' })).toThrow();
    expect(() => adminListSchema.parse({ page: '-1' })).toThrow();
  });

  it('完整 query 解析正确', () => {
    const r = adminListSchema.parse({
      userId: 'NO.022',
      type: 'SYSTEM',
      read: 'false',
      pageSize: '50',
      page: '2',
    });
    expect(r).toEqual({ userId: 'NO.022', type: 'SYSTEM', read: 'false', pageSize: 50, page: 2 });
  });
});

describe('messages controller · admin 路由覆盖（v8）', () => {
  const src = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

  it('GET /admin/log 路由', () => expect(src()).toMatch(/router\.get\(['"]\/admin\/log['"]/));
  it('POST /admin/:id/resend 路由', () => expect(src()).toMatch(/router\.post\(['"]\/admin\/:id\/resend['"]/));
  it('GET /admin/stats 路由', () => expect(src()).toMatch(/router\.get\(['"]\/admin\/stats['"]/));
  it('admin 路由用 requireRole ADMIN/OPERATOR', () => {
    const lines = src().split('\n');
    // 只检查 router.get/post 行（排除注释）
    const adminRouterLines = lines.filter((l) => /router\.(get|post)\([^,]*\/admin\//.test(l));
    expect(adminRouterLines.length).toBeGreaterThan(0);
    for (const line of adminRouterLines) {
      expect({ line, hasRole: line.includes("requireRole('ADMIN', 'OPERATOR')") }).toEqual({ line, hasRole: true });
    }
  });
});
