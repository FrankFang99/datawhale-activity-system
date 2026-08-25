import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { fail, ErrorCode } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    fail(res, 401, ErrorCode.UNAUTHORIZED, '未登录');
    return;
  }
  try {
    req.user = verifyToken(m[1]);
    next();
  } catch {
    fail(res, 401, ErrorCode.UNAUTHORIZED, '登录已过期，请重新登录');
  }
}

export function requireRole(...roles: Array<JwtPayload['role']>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      fail(res, 401, ErrorCode.UNAUTHORIZED, '未登录');
      return;
    }
    if (!roles.includes(req.user.role)) {
      fail(res, 403, ErrorCode.FORBIDDEN, '权限不足');
      return;
    }
    next();
  };
}
