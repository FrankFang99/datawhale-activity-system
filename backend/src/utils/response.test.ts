/**
 * 响应工具单测（v7 · TDD）
 * 覆盖：ok / fail / ErrorCode 编码一致性
 */
import { describe, it, expect } from 'vitest';
import { ok, fail, ErrorCode } from './response';

describe('Response utils', () => {
  // 模拟 express Response
  const mockRes = () => {
    const r: any = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) { r.statusCode = code; return r; },
      json(data: any) { r.body = data; return r; },
    };
    return r;
  };

  it('ok 返 code=0 + data + 默认 200', () => {
    const r = mockRes();
    ok(r, { foo: 'bar' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ code: 0, data: { foo: 'bar' } });
  });

  it('fail 返 code + message + 自定义 http 状态', () => {
    const r = mockRes();
    fail(r, 404, ErrorCode.NOT_FOUND, '资源不存在');
    expect(r.statusCode).toBe(404);
    expect(r.body).toEqual({ code: 40401, message: '资源不存在' });
  });

  it('ErrorCode 关键码值稳定（防误改）', () => {
    // 这些是契约码，前端/移动端可能依赖
    expect(ErrorCode.UNAUTHORIZED).toBe(40101);
    expect(ErrorCode.FORBIDDEN).toBe(40301);
    expect(ErrorCode.NOT_FOUND).toBe(40401);
    expect(ErrorCode.BAD_REQUEST).toBe(40001);
    expect(ErrorCode.USER_004_INVALID_CREDENTIALS).toBe(1004);
    expect(ErrorCode.APP_004_NOT_FOUND).toBe(2004);
    expect(ErrorCode.ACT_001_NOT_FOUND).toBe(3001);
  });
});
