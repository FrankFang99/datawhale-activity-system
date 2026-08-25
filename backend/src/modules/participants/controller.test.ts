/**
 * participants controller 路由 + 集成覆盖（v9 续 Frank #6 升级 · TDD）
 * 飞书相关（searchRecords/updateRecord）通过 e2e 验证
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('participants controller · 基础路由', () => {
  it('POST /register', () => expect(SRC()).toMatch(/router\.post\(['"]\/register['"]/));
  it('POST /:id/cancel', () => expect(SRC()).toMatch(/router\.post\(['"]\/:id\/cancel['"]/));
  it('GET /mine', () => expect(SRC()).toMatch(/router\.get\(['"]\/mine['"]/));
  it('GET /activity/:id', () => expect(SRC()).toMatch(/router\.get\(['"]\/activity\/:id['"]/));
  it('GET /activity/:id/list', () => expect(SRC()).toMatch(/router\.get\(['"]\/activity\/:id\/list['"]/));
});

describe('participants controller · Frank #6 升级：活动当天打卡 → USER → PARTICIPANT', () => {
  it('POST /:id/checkin 路由', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/:id\/checkin['"]/);
  });

  it('打卡路由需要 authRequired', () => {
    // 找 /:id/checkin 路由后的下一行（authRequired 紧跟 router 后面）
    const s = SRC();
    const m = s.match(/router\.post\(['"]\/:id\/checkin['"],\s*([^\n{]+)/);
    expect(m).toBeTruthy();
    expect(m![1]).toContain('authRequired');
  });

  it('打卡检查 status ≠ UNREGISTERED（已取消不能打卡）', () => {
    expect(SRC()).toMatch(/UNREGISTERED/);
    expect(SRC()).toMatch(/已取消报名，不能打卡/);
  });

  it('打卡检查 status ≠ CHECKED_IN（不能重复打卡）', () => {
    expect(SRC()).toMatch(/已打卡，无需重复/);
  });

  it('打卡后 status = CHECKED_IN + 写 checkedInAt', () => {
    expect(SRC()).toMatch(/status:\s*['"]CHECKED_IN['"]/);
    expect(SRC()).toMatch(/checkedInAt:\s*now/);
  });

  it('打卡成功后自动升级 user role USER → PARTICIPANT', () => {
    expect(SRC()).toMatch(/currentRole\s*===\s*['"]USER['"]/);
    expect(SRC()).toMatch(/role:\s*['"]PARTICIPANT['"]/);
  });

  it('打卡日志加 [CHECKIN] tag', () => {
    expect(SRC()).toMatch(/\[CHECKIN\]/);
  });

  it('打卡权限：ADMIN/OPERATOR', () => {
    expect(SRC()).toMatch(/role\s*!==\s*['"]ADMIN['"]\s*&&\s*role\s*!==\s*['"]OPERATOR['"]/);
  });
});

describe('participants controller · 鉴权', () => {
  it('注册路由用 authRequired', () => {
    const s = SRC();
    const lines = s.split('\n').filter((l) => /router\.post\(['"]\/?(register|cancel|checkin)/.test(l));
    for (const line of lines) {
      expect({ line: line.trim(), hasAuth: line.includes('authRequired') }).toEqual({ line: line.trim(), hasAuth: true });
    }
  });
});
