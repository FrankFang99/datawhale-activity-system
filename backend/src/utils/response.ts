/**
 * 统一响应格式：{ code, data, message }
 *
 * - code: 0 = 成功；非 0 = 错误码（与 PRD §4.1.1 / 5.x 错误码对齐）
 * - data: 业务数据
 * - message: 错误信息（成功时为空）
 */
import { Response } from 'express';

export interface ApiResponse<T = any> {
  code: number;
  data?: T;
  message?: string;
}

export function ok<T>(res: Response, data: T): Response {
  const body: ApiResponse<T> = { code: 0, data };
  return res.json(body);
}

export function fail(
  res: Response,
  httpStatus: number,
  code: number,
  message: string
): Response {
  const body: ApiResponse = { code, message };
  return res.status(httpStatus).json(body);
}

// 业务错误码（与 PRD §4.1.1 / 5.x 对齐）
export const ErrorCode = {
  // 通用
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  BAD_REQUEST: 40001,
  // 用户
  USER_001_EMAIL_EXISTS: 1001, // 邮箱已注册
  USER_002_INVALID_EMAIL: 1002, // 邮箱格式错误
  USER_003_PASSWORD_TOO_SHORT: 1003, // 密码 <6 位
  USER_004_INVALID_CREDENTIALS: 1004, // 账号或密码错误
  USER_005_LOGIN_LOCKED: 1005, // 登录失败次数过多
  // 申请
  APP_001_MISSING_FIELD: 2001, // 必填字段缺失
  APP_002_INVALID_DATE: 2002, // 日期不合法
  APP_003_ALREADY_APPLIED: 2003, // 重复申请
  APP_004_NOT_FOUND: 2004, // 申请不存在
  // 活动
  ACT_001_NOT_FOUND: 3001, // 活动不存在
  ACT_002_NOT_PUBLISHED: 3002, // 活动未发布
  ACT_003_EXPIRED: 3003, // 活动已截止
  // 评分
  SCORE_001_TIMEOUT: 4001, // 评分超时
  // 内部
  INTERNAL_ERROR: 50001,
} as const;
