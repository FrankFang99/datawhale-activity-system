/**
 * 同校多申请者分流单测（v8 · TDD · PRD §5.3.5 US-O13）
 */
import { describe, it, expect } from 'vitest';
import {
  detectApplicantRole,
  isSameCity,
  getDispatchNotice,
  ApplicantRole,
} from './dispatch';

const baseExisting = [
  // 同活动 + 同城市 + CONFIRMED → 应派生 ASSISTANT
  { userId: 'U1', activityId: 'NO.001', status: 'CONFIRMED', city: '北京' },
];

describe('detectApplicantRole (PRD §5.3.5 US-O13)', () => {
  it('同活动 + 无已有组织者 → PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('同活动 + 同城市 + 已 CONFIRMED 别人 → ASSISTANT', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      baseExisting,
      '北京'
    );
    expect(r).toBe('ASSISTANT');
  });

  it('同活动 + 不同城市 → PRIMARY（v1 简化：city 不同 = 不同校）', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '上海' },
      baseExisting,  // city=北京
      '上海'
    );
    expect(r).toBe('PRIMARY');
  });

  it('同活动 + 已有 SCREENING（未审核）→ PRIMARY（不算已有组织者）', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'SCREENING', city: '北京' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('同活动 + 已有 REJECTED → PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'REJECTED', city: '北京' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('不同活动 + 同城市 + 已 CONFIRMED → PRIMARY（不影响）', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.002', city: '北京' },
      baseExisting,  // activityId=NO.001
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('同活动 + 已 COMPLETED → ASSISTANT（v2 强需求：默认派生助教）', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'COMPLETED', city: '北京' }],
      '北京'
    );
    expect(r).toBe('ASSISTANT');
  });

  it('新申请人 city 为空（兜底）→ PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001' },  // 无 city
      baseExisting,
      undefined
    );
    expect(r).toBe('PRIMARY');
  });

  it('新申请人是自己（重复申请）→ 仍按 PRIMARY 算（防 dup 是 controller 另一道）', () => {
    const r = detectApplicantRole(
      { userId: 'U1', activityId: 'NO.001', city: '北京' },
      baseExisting,  // U1 自己的
      '北京'
    );
    expect(r).toBe('PRIMARY');  // userId 相同不视为已有组织者
  });
});

describe('isSameCity 同校判定', () => {
  it('完全相同 → true', () => {
    expect(isSameCity('北京', '北京')).toBe(true);
  });

  it('带空格相同 → true', () => {
    expect(isSameCity(' 北京 ', '北京')).toBe(true);
  });

  it('不同 → false', () => {
    expect(isSameCity('北京', '上海')).toBe(false);
  });

  it('任一为空 → false', () => {
    expect(isSameCity('', '北京')).toBe(false);
    expect(isSameCity('北京', '')).toBe(false);
    expect(isSameCity(undefined, '北京')).toBe(false);
  });
});

describe('getDispatchNotice 站内消息文案', () => {
  it('PRIMARY → 通用提交成功文案', () => {
    const n = getDispatchNotice('PRIMARY');
    expect(n.title).toBe('🎉 申请已提交');
  });

  it('ASSISTANT + 有组织者姓名 → 助教文案', () => {
    const n = getDispatchNotice('ASSISTANT', '小王');
    expect(n.title).toBe('🤝 你将成为助教');
    expect(n.content).toContain('小王');
  });

  it('ASSISTANT + 无组织者姓名 → 仍走助教文案', () => {
    const n = getDispatchNotice('ASSISTANT');
    expect(n.title).toBe('🤝 你将成为助教');
  });
});

describe('ApplicantRole 枚举完整性', () => {
  it('只有 PRIMARY 和 ASSISTANT 两种', () => {
    const roles: ApplicantRole[] = ['PRIMARY', 'ASSISTANT'];
    expect(roles.length).toBe(2);
  });
});

// =====================================================================
// B.1 完整版 v9 增量测试（多 CONFIRMED / 边界 / 字段语义）
// =====================================================================

describe('B.1 完整版 · 多 CONFIRMED 边界', () => {
  it('多个已 CONFIRMED 别人 + 同站 → 仍派 ASSISTANT', () => {
    const r = detectApplicantRole(
      { userId: 'U3', activityId: 'NO.001', city: '北京' },
      [
        { userId: 'U1', activityId: 'NO.001', status: 'CONFIRMED', city: '北京' },
        { userId: 'U2', activityId: 'NO.001', status: 'CONFIRMED', city: '北京' },
      ],
      '北京'
    );
    expect(r).toBe('ASSISTANT');
  });

  it('已 CONFIRMED 但不同站 → PRIMARY（v1 简化：city 不同 = 不同校）', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'CONFIRMED', city: '上海' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('已 CONFIRMED 但不同活动 → PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.002', status: 'CONFIRMED', city: '北京' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('空字符串 city（兜底）→ PRIMARY（isSameCity 返回 false）', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'CONFIRMED', city: '北京' }],
      ''
    );
    expect(r).toBe('PRIMARY');
  });
});

describe('B.1 完整版 · ACTIVE_ORGANIZER_STATES 覆盖', () => {
  it('REVIEWING 视为已存在组织者 → ASSISTANT', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'REVIEWING', city: '北京' }],
      '北京'
    );
    expect(r).toBe('ASSISTANT');
  });

  it('REVIEW_CONFIRMED 视为已存在组织者 → ASSISTANT', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'REVIEW_CONFIRMED', city: '北京' }],
      '北京'
    );
    expect(r).toBe('ASSISTANT');
  });

  it('DRAFT 状态不算已存在组织者 → PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'DRAFT', city: '北京' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('WITHDRAWN 状态不算已存在组织者 → PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'WITHDRAWN', city: '北京' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });

  it('CANCELLED 状态不算已存在组织者 → PRIMARY', () => {
    const r = detectApplicantRole(
      { userId: 'U2', activityId: 'NO.001', city: '北京' },
      [{ userId: 'U1', activityId: 'NO.001', status: 'CANCELLED', city: '北京' }],
      '北京'
    );
    expect(r).toBe('PRIMARY');
  });
});

describe('B.1 完整版 · getDispatchNotice 边界', () => {
  it('PRIMARY 始终返回通用文案（无视 organizerName）', () => {
    const n = getDispatchNotice('PRIMARY', '任何人');
    expect(n.title).toBe('🎉 申请已提交');
    expect(n.content).not.toContain('任何人');
  });

  it('ASSISTANT + 空字符串 organizerName → 仍走助教文案', () => {
    const n = getDispatchNotice('ASSISTANT', '');
    expect(n.title).toBe('🤝 你将成为助教');
    expect(n.content).toContain('主组织者');
  });

  it('ASSISTANT + undefined → 仍走助教文案', () => {
    const n = getDispatchNotice('ASSISTANT', undefined);
    expect(n.title).toBe('🤝 你将成为助教');
  });
});
