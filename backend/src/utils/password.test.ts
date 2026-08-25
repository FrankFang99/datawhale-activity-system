/**
 * Password 工具单测（v7 · TDD）
 * 覆盖：bcrypt 哈希 + 校验
 */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Password utils', () => {
  it('hashPassword 不返明文', async () => {
    const hash = await hashPassword('datawhale123');
    expect(hash).not.toBe('datawhale123');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifyPassword 正确密码通过', async () => {
    const hash = await hashPassword('datawhale123');
    expect(await verifyPassword('datawhale123', hash)).toBe(true);
  });

  it('verifyPassword 错误密码拒绝', async () => {
    const hash = await hashPassword('datawhale123');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('同一明文每次 hash 不同（bcrypt salt）', async () => {
    const h1 = await hashPassword('datawhale123');
    const h2 = await hashPassword('datawhale123');
    expect(h1).not.toBe(h2);
    // 但都能 verify 通过
    expect(await verifyPassword('datawhale123', h1)).toBe(true);
    expect(await verifyPassword('datawhale123', h2)).toBe(true);
  });
});
