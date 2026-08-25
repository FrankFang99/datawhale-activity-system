/**
 * JWT 工具单测（v7 · TDD）
 * 覆盖：signToken / verifyToken 正常 + 异常路径
 */
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt';

describe('JWT utils', () => {
  const payload = {
    userId: 'USR-0001',
    email: 'test@datawhale.cn',
    role: 'ADMIN' as const,
    name: '测试用户',
  };

  it('signToken → verifyToken 往返一致', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('USR-0001');
    expect(decoded.email).toBe('test@datawhale.cn');
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.name).toBe('测试用户');
  });

  it('verifyToken 对非法 token 抛错', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow();
  });

  it('verifyToken 对空字符串抛错', () => {
    expect(() => verifyToken('')).toThrow();
  });

  it('5 角色都能正确编码解码', () => {
    const roles = ['ADMIN', 'OPERATOR', 'VOLUNTEER', 'ORGANIZER', 'ASSISTANT'] as const;
    for (const r of roles) {
      const token = signToken({ ...payload, role: r });
      expect(verifyToken(token).role).toBe(r);
    }
  });

  it('不同 payload 签出不同 token', () => {
    const t1 = signToken(payload);
    const t2 = signToken({ ...payload, userId: 'USR-0002' });
    expect(t1).not.toBe(t2);
  });
});
