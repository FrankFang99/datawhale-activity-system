/**
 * auth controller 路由 + 集成覆盖（v9 续 Frank #6 · TDD）
 * 飞书相关（searchRecords/createRecord）通过 e2e 验证；
 * 本测试只覆盖 source 层（路由、import、schema 默认值、role 升级）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('auth controller · Frank #6 注册默认 PARTICIPANT', () => {
  it('registerSchema 不强制 role 字段', () => {
    const s = SRC();
    expect(s).not.toMatch(/role:\s*z\.literal\(['"]ORGANIZER['"]\)/);
  });

  it('registerSchema 仅含 email + password + name', () => {
    const s = SRC();
    const schemaMatch = s.match(/registerSchema = z\.object\(\{([\s\S]*?)\}\)/);
    expect(schemaMatch).toBeTruthy();
    expect(schemaMatch![1]).toContain('email');
    expect(schemaMatch![1]).toContain('password');
    expect(schemaMatch![1]).toContain('name');
    expect(schemaMatch![1]).not.toMatch(/role\s*:/);
  });

  it('POST /register 创建用户 role = USER（Frank 2026-08-21 升级：默认普通用户）', () => {
    const s = SRC();
    const createUserBlock = s.match(/feishuClient\.createRecord\([^,]+,\s*\{([\s\S]*?)\}\s*\)/);
    expect(createUserBlock).toBeTruthy();
    expect(createUserBlock![1]).toMatch(/role:\s*['"]USER['"]/);
    expect(createUserBlock![1]).not.toMatch(/role:\s*['"]PARTICIPANT['"]/);
    expect(createUserBlock![1]).not.toMatch(/role:\s*['"]ORGANIZER['"]/);
  });

  it('REDIRECT_BY_ROLE 含 PARTICIPANT（普通用户登录后跳转）', () => {
    const s = SRC();
    expect(s).toMatch(/PARTICIPANT:\s*\{\s*path:\s*['"]\//);
  });
});
