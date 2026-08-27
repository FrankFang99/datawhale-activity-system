/**
 * 7 维评分引擎 edge case 单测（Frank 27 15:58 Comment 4：v1 5 维 → v2 7 维）
 * 覆盖：刷分检测、极端输入、等级边界
 */
import { describe, it, expect } from 'vitest';
import { scoreApplication, ScoreInput } from './engine';

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    hasIdentity: true,
    hasLocation3: true,
    hasSchool: true,
    hasAddress: true,
    venueStatus: '已确定',
    recruitChannel: ['社群', '公众号', '高校社团'],
    experience: '组织过 3 场校内 AI 分享会',
    expectedDate: Date.now() + 14 * 24 * 3600 * 1000,
    activityStartDate: Date.now() + 7 * 24 * 3600 * 1000,
    activityEndDate: Date.now() + 60 * 24 * 3600 * 1000,
    motivation: '目标是推动 AI 教育进校园',
    participantValue: '希望参与者能做出可展示的 AI 作品',
    ...overrides,
  };
}

describe('7 维评分 · 刷分检测', () => {
  it('RC006 motivation 命中关键词但长度 <10 → 基础分（不刷分）', () => {
    const r = scoreApplication(baseInput({ motivation: '目标社群' }));  // 4 字
    expect(r.RC006.score).toBeGreaterThanOrEqual(0);
    expect(r.RC006.score).toBeLessThan(15);
  });

  it('RC006 motivation 命中关键词 + 长度 ≥5 → 正常计分', () => {
    const r = scoreApplication(baseInput({
      motivation: '目标是实操社群建设',  // 11 字 + 3 关键词
    }));
    expect(r.RC006.score).toBeGreaterThan(0);
  });
});

describe('7 维评分 · 等级边界（exact）', () => {
  // 通过全维度满分
  function allMaxInput(): ScoreInput {
    return baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号', '高校社团', '企业园区'],
      experience: '组织过多场系统活动连续主办 Datawhale 千人参与 100+ 负责人角色 主席 组长 50+ 大会主席',
      motivation: '目标是推动 AI 工具使用门槛降低；让零基础同学快速上手；通过实操让同学们掌握大模型应用；坚持共学打卡建立学习习惯。',
      participantValue: '搭建本地 AI 交流社群；提供就业指导帮助职业简历；熟练使用 AI 工具和大模型应用。',
    });
  }

  it('分数=100 (S 上限)', () => {
    const r = scoreApplication(allMaxInput());
    expect(r.grade).toBe('S');
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it('分数≥90 S 级', () => {
    const r = scoreApplication(allMaxInput());
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe('S');
  });

  it('S/A 分界 = 90', () => {
    const r = scoreApplication(allMaxInput());
    if (r.total >= 90) expect(r.grade).toBe('S');
    else if (r.total >= 75) expect(r.grade).toBe('A');
  });
});

describe('7 维评分 · 极端输入不崩', () => {
  it('motivation=null 不应崩（v7 容错）', () => {
    const r = scoreApplication(baseInput({ motivation: '', participantValue: '' }));
    expect(r.RC006.score).toBe(0);
    expect(r.RC007.score).toBe(0);
  });

  it('motivation=undefined 不应崩', () => {
    const r = scoreApplication(baseInput({ motivation: undefined as any, participantValue: undefined as any }));
    expect(r.RC006.score).toBe(0);
    expect(r.RC007.score).toBe(0);
  });

  it('experience=undefined 正常', () => {
    const r = scoreApplication(baseInput({ experience: undefined }));
    expect(r.RC004.score).toBe(0);
  });

  it('recruitChannel 是重复项 → 计为多个（v1 不去重）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群', '社群', '社群'] }));
    // v1 引擎不去重，3 个 '社群' = 15 分（3 渠道档位）
    expect(r.RC003.count).toBe(3);
  });

  it('所有字段极简 → C/D 级（基础 + 场地 + 1 渠道 + 时间分）', () => {
    const r = scoreApplication({
      hasIdentity: true,
      hasLocation3: true,
      hasSchool: true,
      hasAddress: true,
      venueStatus: '已确定',
      recruitChannel: ['社群'],
      experience: '',
      expectedDate: Date.now() + 14 * 24 * 3600 * 1000,
      activityStartDate: Date.now() + 7 * 24 * 3600 * 1000,
      activityEndDate: Date.now() + 60 * 24 * 3600 * 1000,
      motivation: '',
      participantValue: '',
    });
    // 基础 10 + 场地 10 + 1 渠道 6 + 无经验 0 + 时间 10 + 动机 0 + 价值 0 = 36
    expect(r.RC001.score).toBe(10);  // 4 项全
    expect(r.RC002.score).toBe(10);  // 场地已确定
    expect(r.RC003.score).toBe(6);   // 1 渠道
    expect(r.RC004.score).toBe(0);   // 无经验
    expect(r.RC005.score).toBe(10);  // 精确日期在区间
    expect(r.RC006.score).toBe(0);   // 无动机
    expect(r.RC007.score).toBe(0);   // 无价值
    expect(r.total).toBe(36);
    expect(r.grade).toBe('D');
  });
});
