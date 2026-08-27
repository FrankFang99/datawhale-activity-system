/**
 * 申请状态机纯逻辑（v7 · TDD · PRD §5.2）
 *
 * 从 controller 抽出，方便单测：
 * - findDuplicateApplication()
 * - getNextStatus()  状态流转
 * - isValidTransition()  流转合法性
 * - isApplicationActive()  申请是否还在进行中
 */

import { z } from 'zod';

export const APPLICATION_SCHEMA = z.object({
  activityId: z.string().min(1, '活动不能为空'),
  organizerName: z.string().min(1).max(20),
  organizerPhone: z.string().regex(/^1\d{10}$/, '请填写 11 位手机号'),
  organizerEmail: z.string().email(),
  // Frank 27 12:50 反馈：宽泛时间段（月份/季度），不强制具体日期
  expectedTimeRange: z.string().min(1).max(100),
  // Frank 27 12:50 反馈：基础信息增加身份 + 现居地
  applicantIdentity: z.enum(['在校', '在职', '自由职业', '其他']),
  currentCity: z.string().min(1).max(50),
  location: z.string().min(1).max(100),  // 模糊地区（保留给报名者了解）
  motivation: z.string().min(1).max(500),
  participantValue: z.string().min(1).max(500),
  experience: z.string().max(500).optional(),
  venueStatus: z.enum(['已确定', '有潜在', '暂无']),
  recruitChannel: z.array(z.enum(['社群', '公众号', '高校社团', '企业园区', '暂无'])).min(1, '请至少选择 1 个招募渠道'),
});

export const MIN_LEAD_DAYS = 7;

export const TERMINAL_STATES = ['REJECTED', 'CANCELLED', 'WITHDRAWN'] as const;
export type TerminalState = (typeof TERMINAL_STATES)[number];

// Frank #9 重复申请：同活动同一人"被打回/拒绝/撤回/草稿"都允许重新申请
// DRAFT（被打回）也可重新申请（与"等打回/拒绝之后才能继续申请"一致）
export const RESUBMITTABLE_STATES = ['REJECTED', 'CANCELLED', 'WITHDRAWN', 'DRAFT'];

// 状态机（PRD §5.2 + v4/v6 修订）
// DRAFT → SUBMITTED → SCREENING → CONFIRMED/REJECTED
// SCREENING → REVIEWING（v6）
// REVIEWING → REVIEW_CONFIRMED/COMPLETED
export const ALL_STATES = [
  'DRAFT',
  'SUBMITTED',
  'SCREENING',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
  'REVIEWING',
  'REVIEW_CONFIRMED',
  'COMPLETED',
] as const;
export type ApplicationStatus = (typeof ALL_STATES)[number];

// 合法流转表（自上到下）
const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT:            ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED:        ['SCREENING', 'WITHDRAWN'],
  SCREENING:        ['CONFIRMED', 'REJECTED', 'REVIEWING'],
  REVIEWING:        ['REVIEW_CONFIRMED', 'REJECTED', 'COMPLETED'],  // v4: REJECTED 兜底
  REVIEW_CONFIRMED: ['COMPLETED'],
  CONFIRMED:        ['REVIEWING'],  // v6: 可能再次 REVIEW
  REJECTED:         [],  // 终态
  CANCELLED:        [],  // 终态
  WITHDRAWN:        [],  // 终态
  COMPLETED:        [],  // 终态
};

export function isValidTransition(from: string, to: string): boolean {
  if (!ALL_STATES.includes(from as ApplicationStatus)) return false;
  if (!ALL_STATES.includes(to as ApplicationStatus)) return false;
  return VALID_TRANSITIONS[from as ApplicationStatus]?.includes(to as ApplicationStatus) ?? false;
}

export function getNextStatus(action: string): ApplicationStatus | null {
  switch (action) {
    case 'SUBMIT':         return 'SUBMITTED';
    case 'APPROVE':        return 'CONFIRMED';
    case 'REJECT':         return 'REJECTED';
    case 'RETURN':         return 'DRAFT';
    case 'CANCEL':         return 'CANCELLED';
    case 'WITHDRAW':       return 'WITHDRAWN';
    case 'START_REVIEW':   return 'REVIEWING';
    case 'CONFIRM_REVIEW': return 'REVIEW_CONFIRMED';
    case 'COMPLETE':       return 'COMPLETED';
    case 'TRANSFER':       return null;  // TRANSFER 不改状态
    default:               return null;
  }
}

// 申请是否还在进行中（不可重新申请）
export function isApplicationActive(status: string | undefined): boolean {
  if (!status) return false;
  return !TERMINAL_STATES.includes(status as TerminalState);
}

// 找同活动 + 同 user 的重复申请
// Frank #9: 只拦截"进行中"（SCREENING/SUBMITTED/CONFIRMED/REVIEWING/REVIEW_CONFIRMED/COMPLETED）
// 允许重新申请的状态：REJECTED / CANCELLED / WITHDRAWN / DRAFT（被打回）
export interface ApplicationLite {
  userId?: string;
  activityId?: string;
  status?: string;
}

export function findDuplicateApplication(
  apps: ApplicationLite[],
  userId: string,
  activityId: string
): ApplicationLite | undefined {
  return apps.find(
    (a) =>
      a.userId === userId &&
      a.activityId === activityId &&
      isApplicationActive(a.status) &&
      !RESUBMITTABLE_STATES.includes(a.status ?? '')
  );
}

// 活动校验
export interface ActivityLite {
  activityId?: string;
  status?: string;
  endDate?: number;
}

export function validateActivityForApply(activity: ActivityLite | undefined, now: number): { ok: true } | { ok: false; code: string; message: string } {
  if (!activity) {
    return { ok: false, code: 'ACT_001_NOT_FOUND', message: '活动不存在' };
  }
  if (activity.status === 'DRAFT' || activity.status === 'ARCHIVED') {
    return { ok: false, code: 'ACT_002_NOT_PUBLISHED', message: '活动未发布' };
  }
  if (activity.endDate && activity.endDate < now) {
    return { ok: false, code: 'ACT_003_EXPIRED', message: '活动已截止' };
  }
  return { ok: true };
}

// Frank 27 12:50：宽泛时间段不需要具体日期校验（保留 MIN_LEAD_DAYS 给后续使用）
export function validateExpectedDate(_expectedDate: number, _now: number, _minLeadDays: number = MIN_LEAD_DAYS): { ok: true } | { ok: false; code: string; message: string } {
  return { ok: true };
}
