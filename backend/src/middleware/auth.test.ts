/**
 * RoleGuard 中间件单测（v7 · TDD · PRD §2.2 权限矩阵）
 * 覆盖：未登录 / 角色不符 / 角色符合 3 路径
 */
import { describe, it, expect, vi } from 'vitest';
import { requireRole, authRequired } from './auth';
import { signToken } from '../utils/jwt';

describe('Auth 中间件', () => {
  const mockRes = () => {
    const r: any = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) { r.statusCode = code; return r; },
      json(data: any) { r.body = data; return r; },
    };
    return r;
  };

  const mockReq = (user: any, headers: Record<string, string> = {}) => {
    const req: any = { user, headers };
    return req;
  };
  const mockNext = () => vi.fn();

  // ============== authRequired ==============
  describe('authRequired', () => {
    it('无 Authorization 头 → 401 UNAUTHORIZED', () => {
      const req = mockReq(undefined, {});
      const res = mockRes();
      const next = mockNext();
      authRequired(req as any, res as any, next);
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe(40101);
      expect(next).not.toHaveBeenCalled();
    });

    it('Authorization 头格式错 → 401', () => {
      const req = mockReq(undefined, { authorization: 'NoBearer prefix' });
      const res = mockRes();
      const next = mockNext();
      authRequired(req as any, res as any, next);
      expect(res.statusCode).toBe(401);
    });

    it('有效 Bearer token → next() 调用 + req.user 填充', () => {
      const token = signToken({ userId: 'U1', email: 'a@b.cn', role: 'ADMIN', name: 'A' });
      const req = mockReq(undefined, { authorization: `Bearer ${token}` });
      const res = mockRes();
      const next = mockNext();
      authRequired(req as any, res as any, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('ADMIN');
    });

    it('过期/伪造 token → 401', () => {
      const req = mockReq(undefined, { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.fake.token' });
      const res = mockRes();
      const next = mockNext();
      authRequired(req as any, res as any, next);
      expect(res.statusCode).toBe(401);
    });
  });

  // ============== requireRole ==============
  describe('requireRole', () => {
    it('req.user 未设 → 401', () => {
      const req = mockReq(undefined);
      const res = mockRes();
      const next = mockNext();
      const mw = requireRole('ADMIN', 'OPERATOR');
      mw(req as any, res as any, next);
      expect(res.statusCode).toBe(401);
    });

    it('角色不在 allow 列表 → 403 FORBIDDEN', () => {
      const req = mockReq({ userId: 'U1', email: 'a@b.cn', role: 'ORGANIZER', name: 'O' });
      const res = mockRes();
      const next = mockNext();
      const mw = requireRole('ADMIN', 'OPERATOR');
      mw(req as any, res as any, next);
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe(40301);
    });

    it('角色在 allow 列表 → next() 调用', () => {
      const req = mockReq({ userId: 'U1', email: 'a@b.cn', role: 'ADMIN', name: 'A' });
      const res = mockRes();
      const next = mockNext();
      const mw = requireRole('ADMIN', 'OPERATOR');
      mw(req as any, res as any, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('5 角色权限矩阵：ORGANIZER 调 admin 路由 → 403', () => {
      const req = mockReq({ role: 'ORGANIZER' });
      const res = mockRes();
      const next = mockNext();
      requireRole('ADMIN')(req as any, res as any, next);
      expect(res.statusCode).toBe(403);
    });

    it('PARTICIPANT 角色（v5 扩展）调 /admin/dashboard → 403', () => {
      const req = mockReq({ role: 'PARTICIPANT' });
      const res = mockRes();
      const next = mockNext();
      requireRole('ADMIN', 'OPERATOR')(req as any, res as any, next);
      expect(res.statusCode).toBe(403);
    });
  });
});
