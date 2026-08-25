import { Request, Response, NextFunction } from 'express';
import { fail, ErrorCode } from '../utils/response';
import { ZodError } from 'zod';
import { alert } from '../utils/alert';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    fail(res, 400, ErrorCode.BAD_REQUEST, `${firstIssue.path.join('.')}: ${firstIssue.message}`);
    return;
  }
  console.error('[ERROR]', err);
  // 500 错误触发飞书告警
  void alert('ERROR', `${req.method} ${req.path} → 500`, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    error: { name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 5) },
  });
  fail(res, 500, ErrorCode.INTERNAL_ERROR, '服务器内部错误');
}
