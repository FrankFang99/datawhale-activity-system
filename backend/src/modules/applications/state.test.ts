/**
 * 申请状态机纯逻辑单测（v7 · TDD · PRD §5.2）
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_STATES,
  APPLICATION_SCHEMA,
  isValidTransition,
  getNextStatus,
  isApplicationActive,
  findDuplicateApplication,
  validateActivityForApply,
  validateExpectedDate,
  MIN_LEAD_DAYS,
  TERMINAL_STATES,
  RESUBMITTABLE_STATES,
} from './state';

describe('申请状态机 · 状态流转合法性（PRD §5.2）', () => {
  it('所有 10 个状态定义完整', () => {
    expect(ALL_STATES.length).toBe(10);
    expect(ALL_STATES).toContain('DRAFT');
    expect(ALL_STATES).toContain('SCREENING');
    expect(ALL_STATES).toContain('REVIEWING');
  });

  it('DRAFT → SUBMITTED 合法', () => {
    expect(isValidTransition('DRAFT', 'SUBMITTED')).toBe(true);
  });

  it('SUBMITTED → SCREENING 合法（v4 修订：所有都进 SCREENING）', () => {
    expect(isValidTransition('SUBMITTED', 'SCREENING')).toBe(true);
  });

  it('SCREENING → CONFIRMED 合法', () => {
    expect(isValidTransition('SCREENING', 'CONFIRMED')).toBe(true);
  });

  it('SCREENING → REJECTED 合法', () => {
    expect(isValidTransition('SCREENING', 'REJECTED')).toBe(true);
  });

  it('SCREENING → REVIEWING 合法（v6 加）', () => {
    expect(isValidTransition('SCREENING', 'REVIEWING')).toBe(true);
  });

  it('REVIEWING → COMPLETED 合法', () => {
    expect(isValidTransition('REVIEWING', 'COMPLETED')).toBe(true);
  });

  it('DRAFT → CONFIRMED 非法（不能跳级）', () => {
    expect(isValidTransition('DRAFT', 'CONFIRMED')).toBe(false);
  });

  it('REJECTED → CONFIRMED 非法（终态）', () => {
    expect(isValidTransition('REJECTED', 'CONFIRMED')).toBe(false);
  });

  it('CANCELLED → SUBMITTED 非法（终态）', () => {
    expect(isValidTransition('CANCELLED', 'SUBMITTED')).toBe(false);
  });

  it('COMPLETED → REVIEWING 非法（终态）', () => {
    expect(isValidTransition('COMPLETED', 'REVIEWING')).toBe(false);
  });

  it('未知状态返回 false', () => {
    expect(isValidTransition('UNKNOWN', 'SUBMITTED')).toBe(false);
    expect(isValidTransition('DRAFT', 'UNKNOWN')).toBe(false);
  });
});

describe('申请状态机 · getNextStatus(action)', () => {
  it('SUBMIT → SUBMITTED', () => {
    expect(getNextStatus('SUBMIT')).toBe('SUBMITTED');
  });
  it('APPROVE → CONFIRMED', () => {
    expect(getNextStatus('APPROVE')).toBe('CONFIRMED');
  });
  it('REJECT → REJECTED', () => {
    expect(getNextStatus('REJECT')).toBe('REJECTED');
  });
  it('RETURN → DRAFT（v4 打回）', () => {
    expect(getNextStatus('RETURN')).toBe('DRAFT');
  });
  it('TRANSFER → null（不改变状态）', () => {
    expect(getNextStatus('TRANSFER')).toBeNull();
  });
  it('未知 action → null', () => {
    expect(getNextStatus('FOOBAR')).toBeNull();
  });
});

describe('申请状态机 · isApplicationActive 终态判定', () => {
  it('3 个终态：REJECTED / CANCELLED / WITHDRAWN', () => {
    expect(TERMINAL_STATES.length).toBe(3);
    expect(isApplicationActive('REJECTED')).toBe(false);
    expect(isApplicationActive('CANCELLED')).toBe(false);
    expect(isApplicationActive('WITHDRAWN')).toBe(false);
  });

  it('非终态视为 active', () => {
    expect(isApplicationActive('DRAFT')).toBe(true);
    expect(isApplicationActive('SUBMITTED')).toBe(true);
    expect(isApplicationActive('SCREENING')).toBe(true);
    expect(isApplicationActive('CONFIRMED')).toBe(true);
    expect(isApplicationActive('REVIEWING')).toBe(true);
    expect(isApplicationActive('COMPLETED')).toBe(true);
  });

  it('undefined / 空视为非 active', () => {
    expect(isApplicationActive(undefined)).toBe(false);
    expect(isApplicationActive('')).toBe(false);
  });
});

describe('申请提交 · findDuplicateApplication 重复申请', () => {
  it('同 user + 同活动 + SCREENING 状态 → 算重复', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'SCREENING' },
      { userId: 'U2', activityId: 'NO.001', status: 'SUBMITTED' },
    ];
    expect(findDuplicateApplication(apps, 'U1', 'NO.001')?.userId).toBe('U1');
  });

  it('同 user + 同活动 + REJECTED 状态 → 不算重复（v4 允许重新申请）', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'REJECTED' },
    ];
    expect(findDuplicateApplication(apps, 'U1', 'NO.001')).toBeUndefined();
  });

  it('同 user + 同活动 + CANCELLED → 不算重复', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'CANCELLED' },
    ];
    expect(findDuplicateApplication(apps, 'U1', 'NO.001')).toBeUndefined();
  });

  it('不同 user + 同活动 → 不算重复', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'SCREENING' },
    ];
    expect(findDuplicateApplication(apps, 'U2', 'NO.001')).toBeUndefined();
  });

  it('同 user + 不同活动 → 不算重复', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'SCREENING' },
    ];
    expect(findDuplicateApplication(apps, 'U1', 'NO.002')).toBeUndefined();
  });

  it('空数组 → undefined', () => {
    expect(findDuplicateApplication([], 'U1', 'NO.001')).toBeUndefined();
  });
});

describe('申请提交 · validateActivityForApply 活动校验', () => {
  it('活动存在 + PUBLISHED → ok', () => {
    const r = validateActivityForApply({ status: 'PUBLISHED', endDate: Date.now() + 1e9 }, Date.now());
    expect(r).toEqual({ ok: true });
  });

  it('活动 DRAFT → 未发布', () => {
    const r = validateActivityForApply({ status: 'DRAFT' }, Date.now());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ACT_002_NOT_PUBLISHED');
  });

  it('活动 ARCHIVED → 未发布', () => {
    const r = validateActivityForApply({ status: 'ARCHIVED' }, Date.now());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ACT_002_NOT_PUBLISHED');
  });

  it('活动已截止（endDate 过去）→ 失败', () => {
    const r = validateActivityForApply({ status: 'PUBLISHED', endDate: Date.now() - 1000 }, Date.now());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ACT_003_EXPIRED');
  });

  it('活动 undefined → 不存在', () => {
    const r = validateActivityForApply(undefined, Date.now());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ACT_001_NOT_FOUND');
  });

  it('活动 PENDING 状态 → 可以申请（v6 修订）', () => {
    const r = validateActivityForApply({ status: 'PENDING', endDate: Date.now() + 1e9 }, Date.now());
    expect(r).toEqual({ ok: true });
  });
});

describe('申请提交 · validateExpectedDate（Frank 27 12:50 改：宽泛时间不需要具体日期校验）', () => {
  const now = 1700000000000;  // 2023-11-14

  it('任何日期都通过（宽泛时间不需要校验）', () => {
    expect(validateExpectedDate(now + 7 * 24 * 3600 * 1000, now)).toEqual({ ok: true });
    expect(validateExpectedDate(now + 6 * 24 * 3600 * 1000, now).ok).toBe(true);
    expect(validateExpectedDate(now - 1000, now).ok).toBe(true);
  });

  it('MIN_LEAD_DAYS = 7', () => {
    expect(MIN_LEAD_DAYS).toBe(7);
  });
});

describe('申请提交 · APPLICATION_SCHEMA 字段校验', () => {
  it('正常字段通过', () => {
    const r = APPLICATION_SCHEMA.safeParse({
      activityId: 'NO.001',
      organizerName: '张三',
      organizerPhone: '13800138000',
      organizerEmail: 'a@b.cn',
      expectedTimeRange: '2026 年 9 月',
      applicantIdentity: '在校',
      currentCity: '北京',
      location: '北京',
      motivation: '推动 AI 教育进校园',
      participantValue: '希望参与者能做出 AI 作品',
      experience: '组织过 3 场',
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号'],
    });
    expect(r.success).toBe(true);
  });

  it('organizerName >20 字 → 失败', () => {
    const r = APPLICATION_SCHEMA.safeParse({
      activityId: 'NO.001',
      organizerName: 'a'.repeat(21),
      organizerPhone: '13800138000',
      organizerEmail: 'a@b.cn',
      expectedDate: Date.now() + 14 * 86400000,
      location: '北京',
      motivation: 'm',
      participantValue: 'v',
      venueStatus: '已确定',
      recruitChannel: ['社群'],
    });
    expect(r.success).toBe(false);
  });

  it('phone 非 11 位手机号 → 失败', () => {
    const r = APPLICATION_SCHEMA.safeParse({
      activityId: 'NO.001',
      organizerName: '张三',
      organizerPhone: '12345',
      organizerEmail: 'a@b.cn',
      expectedDate: Date.now() + 14 * 86400000,
      location: '北京',
      motivation: 'm',
      participantValue: 'v',
      venueStatus: '已确定',
      recruitChannel: ['社群'],
    });
    expect(r.success).toBe(false);
  });

  it('email 非法 → 失败', () => {
    const r = APPLICATION_SCHEMA.safeParse({
      activityId: 'NO.001',
      organizerName: '张三',
      organizerPhone: '13800138000',
      organizerEmail: 'not-an-email',
      expectedDate: Date.now() + 14 * 86400000,
      location: '北京',
      motivation: 'm',
      participantValue: 'v',
      venueStatus: '已确定',
      recruitChannel: ['社群'],
    });
    expect(r.success).toBe(false);
  });

  it('recruitChannel 空数组 → 失败', () => {
    const r = APPLICATION_SCHEMA.safeParse({
      activityId: 'NO.001',
      organizerName: '张三',
      organizerPhone: '13800138000',
      organizerEmail: 'a@b.cn',
      expectedDate: Date.now() + 14 * 86400000,
      location: '北京',
      motivation: 'm',
      participantValue: 'v',
      venueStatus: '已确定',
      recruitChannel: [],
    });
    expect(r.success).toBe(false);
  });

  it('venueStatus 非法值 → 失败', () => {
    const r = APPLICATION_SCHEMA.safeParse({
      activityId: 'NO.001',
      organizerName: '张三',
      organizerPhone: '13800138000',
      organizerEmail: 'a@b.cn',
      expectedDate: Date.now() + 14 * 86400000,
      location: '北京',
      motivation: 'm',
      participantValue: 'v',
      venueStatus: '已确定yes',  // 非法
      recruitChannel: ['社群'],
    });
    expect(r.success).toBe(false);
  });
});

// =====================================================================
// v9 续 Frank #9：findDuplicateApplication 允许 DRAFT/REJECTED/WITHDRAWN/CANCELLED 重新申请
// =====================================================================

describe('RESUBMITTABLE_STATES（Frank #9）', () => {
  it('包含 REJECTED / CANCELLED / WITHDRAWN / DRAFT', () => {
    expect(RESUBMITTABLE_STATES).toContain('REJECTED');
    expect(RESUBMITTABLE_STATES).toContain('CANCELLED');
    expect(RESUBMITTABLE_STATES).toContain('WITHDRAWN');
    expect(RESUBMITTABLE_STATES).toContain('DRAFT');
    expect(RESUBMITTABLE_STATES.length).toBe(4);
  });
});

describe('findDuplicateApplication 允许 DRAFT 重新申请（Frank #9）', () => {
  it('DRAFT 状态不拦截（被打回后可重新申请）', () => {
    const dup = findDuplicateApplication(
      [{ userId: 'U1', activityId: 'NO.001', status: 'DRAFT' }],
      'U1',
      'NO.001'
    );
    expect(dup).toBeUndefined();
  });

  it('REJECTED 状态不拦截（拒绝后可重新申请）', () => {
    const dup = findDuplicateApplication(
      [{ userId: 'U1', activityId: 'NO.001', status: 'REJECTED' }],
      'U1',
      'NO.001'
    );
    expect(dup).toBeUndefined();
  });

  it('WITHDRAWN 状态不拦截', () => {
    const dup = findDuplicateApplication(
      [{ userId: 'U1', activityId: 'NO.001', status: 'WITHDRAWN' }],
      'U1',
      'NO.001'
    );
    expect(dup).toBeUndefined();
  });

  it('CANCELLED 状态不拦截', () => {
    const dup = findDuplicateApplication(
      [{ userId: 'U1', activityId: 'NO.001', status: 'CANCELLED' }],
      'U1',
      'NO.001'
    );
    expect(dup).toBeUndefined();
  });

  it('SCREENING 状态仍拦截（审核中不能重复申请）', () => {
    const dup = findDuplicateApplication(
      [{ userId: 'U1', activityId: 'NO.001', status: 'SCREENING' }],
      'U1',
      'NO.001'
    );
    expect(dup).toBeDefined();
  });

  it('CONFIRMED 状态仍拦截（已通过不能再申请同活动）', () => {
    const dup = findDuplicateApplication(
      [{ userId: 'U1', activityId: 'NO.001', status: 'CONFIRMED' }],
      'U1',
      'NO.001'
    );
    expect(dup).toBeDefined();
  });

  it('REVIEWING / REVIEW_CONFIRMED / COMPLETED 状态拦截', () => {
    for (const s of ['REVIEWING', 'REVIEW_CONFIRMED', 'COMPLETED']) {
      const dup = findDuplicateApplication(
        [{ userId: 'U1', activityId: 'NO.001', status: s }],
        'U1',
        'NO.001'
      );
      expect(dup).toBeDefined();
    }
  });

  it('多状态混合：REJECTED 旧记录 + SCREENING 新记录 → 拦截（最新的 SCREENING）', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'REJECTED' },
      { userId: 'U1', activityId: 'NO.001', status: 'SCREENING' },
    ];
    const dup = findDuplicateApplication(apps, 'U1', 'NO.001');
    expect(dup).toBeDefined();
  });

  it('多状态混合：DRAFT 旧记录 + REJECTED 新记录 → 不拦截', () => {
    const apps = [
      { userId: 'U1', activityId: 'NO.001', status: 'DRAFT' },
      { userId: 'U1', activityId: 'NO.001', status: 'REJECTED' },
    ];
    const dup = findDuplicateApplication(apps, 'U1', 'NO.001');
    expect(dup).toBeUndefined();
  });
});
