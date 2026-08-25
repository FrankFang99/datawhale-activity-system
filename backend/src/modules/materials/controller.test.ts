/**
 * 物料下载单测（v9 · TDD · PRD §4.1.6 US-V5）
 * 覆盖：路由覆盖 + 鉴权 + 路由路径
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('materials controller · 路由覆盖', () => {
  const src = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

  it('GET / 列出物料', () => expect(src()).toMatch(/router\.get\(['"]\/['"]/));
  it('GET /activities/:id/materials 活动物料', () => expect(src()).toMatch(/router\.get\(['"]\/activities\/:id\/materials['"]/));
  it('GET /:id 物料详情', () => expect(src()).toMatch(/router\.get\(['"]\/:id['"]/));
  it('POST / 上传物料', () => expect(src()).toMatch(/router\.post\(['"]\/['"]/));
  it('DELETE /:id 删除物料', () => expect(src()).toMatch(/router\.delete\(['"]\/:id['"]/));
});

describe('materials controller · 鉴权', () => {
  const src = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

  it('所有路由（除公开下载）用 authRequired 中间件', () => {
    const lines = src().split('\n');
    // 排除公开下载路由：/activities/:id/materials
    const routerLines = lines.filter((l) => /router\.(get|post|delete)\(/.test(l) && !l.includes('/activities/:id/materials'));
    for (const line of routerLines) {
      expect({ line, hasAuth: line.includes('authRequired') }).toEqual({ line, hasAuth: true });
    }
  });

  it('/activities/:id/materials 是公开路由（无需登录）', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    const match = src.match(/router\.get\(['"]\/activities\/:id\/materials['"],\s*async/);
    expect(match).not.toBeNull();
    // 不应有 authRequired
    expect(match?.[0]).not.toContain('authRequired');
  });

  it('写操作（POST/DELETE）用 requireRole ADMIN/OPERATOR', () => {
    const lines = src().split('\n');
    const writeLines = lines.filter((l) => /router\.(post|delete)\(/.test(l));
    for (const line of writeLines) {
      expect({ line, hasRole: line.includes("requireRole('ADMIN', 'OPERATOR')") }).toEqual({ line, hasRole: true });
    }
  });
});

describe('materials controller · 6 个物料类型枚举', () => {
  it('source 含 6 个 category 选项', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    const expected = ['POSTER', 'GUIDE', 'TEMPLATE', 'SLIDES', 'VIDEO', 'OTHER'];
    for (const c of expected) {
      expect({ c, found: src.includes(`'${c}'`) }).toEqual({ c, found: true });
    }
  });
});

describe('materials controller · scope 双值', () => {
  it('source 含 GLOBAL + ACTIVITY', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    expect(src).toMatch(/'GLOBAL'/);
    expect(src).toMatch(/'ACTIVITY'/);
  });
});

describe('materials controller · 路由顺序（防 /:id 抢先匹配）', () => {
  it('/activities/:id/materials 在 /:id 之前', () => {
    const src = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
    const actMatch = src.match(/router\.get\(['"]\/activities\/:id\/materials['"]/);
    const idMatch = src.match(/router\.get\(['"]\/:id['"]/);
    expect(actMatch?.index).toBeLessThan(idMatch?.index ?? Infinity);
  });
});
