/**
 * 用户个人中心 schema 单测（v7 · TDD · PRD §4.1.9 US-O12）
 * 覆盖：userUpdateSchema / changePasswordSchema 边界
 */
import { describe, it, expect } from 'vitest';
import { userUpdateSchema, changePasswordSchema } from './controller';

describe('userUpdateSchema (PUT /api/users/me)', () => {
  it('空对象合法（至少要 1 字段在 controller 层校验）', () => {
    expect(() => userUpdateSchema.parse({})).not.toThrow();
  });

  it('正常字段', () => {
    const r = userUpdateSchema.parse({
      name: '张三',
      phone: '13800138000',
      school: '清华大学',
      city: '北京',
      province: '北京',
    });
    expect(r.name).toBe('张三');
    expect(r.phone).toBe('13800138000');
  });

  it('name 空字符串 → 失败', () => {
    expect(() => userUpdateSchema.parse({ name: '' })).toThrow();
  });

  it('name >20 字 → 失败', () => {
    expect(() => userUpdateSchema.parse({ name: 'a'.repeat(21) })).toThrow();
  });

  it('phone 非 11 位手机号 → 失败', () => {
    expect(() => userUpdateSchema.parse({ phone: '12345' })).toThrow();
    expect(() => userUpdateSchema.parse({ phone: '23800138000' })).toThrow();  // 首位非 1
    expect(() => userUpdateSchema.parse({ phone: '1234567890' })).toThrow();   // 10 位
  });

  it('phone 11 位手机号（首位 1）合法', () => {
    expect(() => userUpdateSchema.parse({ phone: '13800138000' })).not.toThrow();
    expect(() => userUpdateSchema.parse({ phone: '12345678901' })).not.toThrow();
  });

  it('phone 空字符串合法（允许清空）', () => {
    const r = userUpdateSchema.parse({ phone: '' });
    expect(r.phone).toBe('');
  });

  it('phone 11 位手机号合法', () => {
    const r = userUpdateSchema.parse({ phone: '13800138000' });
    expect(r.phone).toBe('13800138000');
  });

  it('school >50 字 → 失败', () => {
    expect(() => userUpdateSchema.parse({ school: 'a'.repeat(51) })).toThrow();
  });

  it('只改 1 字段也合法', () => {
    const r = userUpdateSchema.parse({ name: '新名' });
    expect(r.name).toBe('新名');
    expect(r.phone).toBeUndefined();
  });
});

describe('changePasswordSchema (POST /api/users/change-password)', () => {
  it('正常密码', () => {
    const r = changePasswordSchema.parse({
      oldPassword: 'old-pass-1',
      newPassword: 'new-pass-2',
    });
    expect(r.oldPassword).toBe('old-pass-1');
    expect(r.newPassword).toBe('new-pass-2');
  });

  it('旧密码 <6 位 → 失败', () => {
    expect(() => changePasswordSchema.parse({ oldPassword: '123', newPassword: 'new-pass-2' })).toThrow();
  });

  it('新密码 <6 位 → 失败', () => {
    expect(() => changePasswordSchema.parse({ oldPassword: 'old-pass-1', newPassword: '123' })).toThrow();
  });

  it('新密码 >32 位 → 失败', () => {
    expect(() => changePasswordSchema.parse({
      oldPassword: 'old-pass-1',
      newPassword: 'a'.repeat(33),
    })).toThrow();
  });

  it('旧/新密码相同合法（controller 层校验"不能相同"）', () => {
    // schema 只校验长度，不校验相同
    expect(() => changePasswordSchema.parse({ oldPassword: 'same-pass', newPassword: 'same-pass' })).not.toThrow();
  });

  it('缺字段 → 失败', () => {
    expect(() => changePasswordSchema.parse({ oldPassword: 'old-pass-1' })).toThrow();
    expect(() => changePasswordSchema.parse({ newPassword: 'new-pass-2' })).toThrow();
  });
});
