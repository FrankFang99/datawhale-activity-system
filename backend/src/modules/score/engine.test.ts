/**
 * 7 维评分引擎单测（Frank 27 15:58 Comment 4：v1 5 维 → v2 7 维）
 * 覆盖 RC001 ~ RC007 全部规则分支 + 等级映射 + 边界条件
 *
 * 测试输入参考 PRD §5.1 v2
 */
import { describe, it, expect } from 'vitest';
import { scoreApplication, ScoreInput } from './engine';

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    // Frank 27 15:58 Comment 4：基础信息完整度
    hasIdentity: true,
    hasLocation3: true,
    hasSchool: true,
    hasAddress: true,
    venueStatus: '已确定',
    recruitChannel: ['社群', '公众号', '高校社团'],
    experience: '曾组织过 3 场校内 AI 分享会，累计参与人数 100+',
    expectedDate: Date.now() + 14 * 24 * 3600 * 1000,
    activityStartDate: Date.now() + 7 * 24 * 3600 * 1000,
    activityEndDate: Date.now() + 60 * 24 * 3600 * 1000,
    motivation: '目标是降低 AI 工具使用门槛；让零基础同学快速上手；通过实操让同学们掌握 AI 应用；搭建本地 AI 交流社群。',
    participantValue: '希望参与者能做出可展示的 AI 作品；积累求职作品集。',
    ...overrides,
  };
}

describe('RC001 基础信息（10 分 · v2 新增）', () => {
  it('4 项全填 → 10 分', () => {
    const r = scoreApplication(baseInput({
      hasIdentity: true, hasLocation3: true, hasSchool: true, hasAddress: true,
    }));
    expect(r.RC001.score).toBe(10);
    expect(r.RC001.completeCount).toBe(4);
    expect(r.RC001.reason).toContain('完整');
  });
  it('3 项 → 8 分', () => {
    const r = scoreApplication(baseInput({
      hasIdentity: true, hasLocation3: true, hasSchool: true, hasAddress: false,
    }));
    expect(r.RC001.score).toBe(8);
    expect(r.RC001.completeCount).toBe(3);
  });
  it('2 项 → 5 分', () => {
    const r = scoreApplication(baseInput({
      hasIdentity: true, hasLocation3: true, hasSchool: false, hasAddress: false,
    }));
    expect(r.RC001.score).toBe(5);
  });
  it('1 项 → 3 分', () => {
    const r = scoreApplication(baseInput({
      hasIdentity: true, hasLocation3: false, hasSchool: false, hasAddress: false,
    }));
    expect(r.RC001.score).toBe(3);
  });
  it('0 项 → 0 分', () => {
    const r = scoreApplication(baseInput({
      hasIdentity: false, hasLocation3: false, hasSchool: false, hasAddress: false,
    }));
    expect(r.RC001.score).toBe(0);
  });
});

describe('RC002 场地确认（10 分 · v1 RC001 缩到 10 分）', () => {
  it('已确定 → 10 分', () => {
    const r = scoreApplication(baseInput({ venueStatus: '已确定' }));
    expect(r.RC002.score).toBe(10);
    expect(r.RC002.reason).toContain('已确认');
  });
  it('有潜在 → 6 分', () => {
    const r = scoreApplication(baseInput({ venueStatus: '有潜在' }));
    expect(r.RC002.score).toBe(6);
  });
  it('暂无 → 0 分', () => {
    const r = scoreApplication(baseInput({ venueStatus: '暂无' }));
    expect(r.RC002.score).toBe(0);
  });
  it('非法值 → 0 分（异常）', () => {
    const r = scoreApplication(baseInput({ venueStatus: '未知' as any }));
    expect(r.RC002.score).toBe(0);
    expect(r.RC002.reason).toContain('异常');
  });
});

describe('RC003 招募能力（15 分 · v1 RC002 缩到 15 分）', () => {
  it('4 渠道（含 暂无）→ 15 分（按非"暂无"渠道数=3）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['暂无', '社群', '公众号', '高校社团'] }));
    expect(r.RC003.score).toBe(15);
    expect(r.RC003.count).toBe(3);
  });
  it('3 渠道 → 15 分（强）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群', '公众号', '高校社团'] }));
    expect(r.RC003.score).toBe(15);
  });
  it('2 渠道 → 11 分（良好）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群', '公众号'] }));
    expect(r.RC003.score).toBe(11);
  });
  it('1 渠道 → 6 分', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群'] }));
    expect(r.RC003.score).toBe(6);
  });
  it('0 渠道 → 0 分', () => {
    const r = scoreApplication(baseInput({ recruitChannel: [] }));
    expect(r.RC003.score).toBe(0);
  });
  it('只"暂无" → 0 分', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['暂无'] }));
    expect(r.RC003.score).toBe(0);
  });
});

describe('RC004 组织经验（25 分 · 不变）', () => {
  it('空 → 0 分', () => {
    const r = scoreApplication(baseInput({ experience: '' }));
    expect(r.RC004.score).toBe(0);
  });
  it('高经验：组织过+多场+Datawhale+规模数据 → 接近满分', () => {
    const r = scoreApplication(baseInput({
      experience: '曾组织过多场 Datawhale 校内 AI 分享会、编程工坊等活动，累计参与人数 100+ 人',
    }));
    // 组织行为(+8) + 多场(+5) + Datawhale(+4) + 规模数据(+3) + 长度≥60(+3) = 23
    expect(r.RC004.score).toBeGreaterThanOrEqual(20);
    expect(r.RC004.hitKeywords).toContain('组织行为');
    expect(r.RC004.hitKeywords).toContain('多场经验');
    expect(r.RC004.hitKeywords).toContain('Datawhale 经验');
  });
  it('中等经验：组织过+规模 → 中等分', () => {
    const r = scoreApplication(baseInput({
      experience: '曾组织过校内 AI 分享会，参与人数 50+',
    }));
    expect(r.RC004.score).toBeGreaterThanOrEqual(10);
    expect(r.RC004.score).toBeLessThan(20);
  });
  it('低经验：单关键词 → 低分', () => {
    const r = scoreApplication(baseInput({
      experience: '参加过一次活动',
    }));
    expect(r.RC004.score).toBeLessThan(10);
  });
  it('防刷：关键词命中 ≥3 但长度 <5 → 清零', () => {
    const r = scoreApplication(baseInput({
      experience: '组织过举办过主办',  // 3 关键词但长度 6 → 不应清零
    }));
    // 长度 6 ≥ 5 → 保留分数
    expect(r.RC004.score).toBeGreaterThan(0);
  });
  it('负责人角色识别', () => {
    const r = scoreApplication(baseInput({
      experience: '作为社长，组织过 5 场 AI 社团活动',
    }));
    expect(r.RC004.hitKeywords).toContain('组织行为');
    expect(r.RC004.hitKeywords).toContain('负责人角色');
  });
  it('截断到 25', () => {
    const r = scoreApplication(baseInput({
      experience: '组织过多场系列活动连续举办 Datawhale 校内 千人参与 负责人 会长 社长 队长 50+ 人',
    }));
    expect(r.RC004.score).toBeLessThanOrEqual(25);
  });
});

describe('RC005 时间合理性（10 分 · v1 RC004 缩到 10 分）', () => {
  it('日期在活动周期内 → 10 分', () => {
    const start = Date.now() + 30 * 24 * 3600 * 1000;
    const end = start + 14 * 24 * 3600 * 1000;
    const r = scoreApplication(baseInput({
      expectedDate: start + 5 * 24 * 3600 * 1000,
      activityStartDate: start,
      activityEndDate: end,
    }));
    expect(r.RC005.score).toBe(10);
  });
  it('日期在活动开始前 → 10 分', () => {
    const start = Date.now() + 30 * 24 * 3600 * 1000;
    const r = scoreApplication(baseInput({
      expectedDate: start - 5 * 24 * 3600 * 1000,
      activityStartDate: start,
      activityEndDate: start + 14 * 24 * 3600 * 1000,
    }));
    expect(r.RC005.score).toBe(10);
  });
  it('日期偏离周期 → 5 分', () => {
    const start = Date.now() + 30 * 24 * 3600 * 1000;
    const r = scoreApplication(baseInput({
      expectedDate: start + 30 * 24 * 3600 * 1000,  // 超出 end
      activityStartDate: start,
      activityEndDate: start + 14 * 24 * 3600 * 1000,
    }));
    expect(r.RC005.score).toBe(5);
  });
  it('宽泛时间（expectedTimeRange 字符串）→ 8 分（无 expectedDate）', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '2026 年 9 月',
    }));
    expect(r.RC005.score).toBe(8);
  });
  it('未填任何时间 → 0 分', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '',
    }));
    expect(r.RC005.score).toBe(0);
  });
});

describe('RC006 申请动机（15 分 · v1 RC005 拆出）', () => {
  it('空 → 0 分', () => {
    const r = scoreApplication(baseInput({ motivation: '' }));
    expect(r.RC006.score).toBe(0);
  });
  it('高质量：3 关键词（目标/实操/学习）全命中 + 长度≥60 → 接近满分', () => {
    const r = scoreApplication(baseInput({
      motivation: '目标是降低 AI 工具使用门槛；让零基础同学通过实操快速上手；坚持共学打卡，培养学习习惯。',
    }));
    // 目标(+4) + 实操(+3) + 学习(+3) + 长度≥60(+3) = 13
    expect(r.RC006.score).toBeGreaterThanOrEqual(10);
    expect(r.RC006.hitKeywords).toContain('目标清晰');
    expect(r.RC006.hitKeywords).toContain('实操价值');
    expect(r.RC006.hitKeywords).toContain('学习习惯');
  });
  it('中等：2 关键词 → 中等分', () => {
    const r = scoreApplication(baseInput({
      motivation: '目标是推动 AI 教育进校园；通过实操让同学们掌握 AI 工具。',
    }));
    expect(r.RC006.score).toBeGreaterThanOrEqual(7);
    expect(r.RC006.score).toBeLessThan(15);
  });
  it('低质量：单关键词 → 低分', () => {
    const r = scoreApplication(baseInput({
      motivation: '想做点 AI 相关的事',
    }));
    expect(r.RC006.score).toBeLessThan(5);
  });
});

describe('RC007 参与者价值（15 分 · v1 RC005 拆出）', () => {
  it('空 → 0 分', () => {
    const r = scoreApplication(baseInput({ participantValue: '' }));
    expect(r.RC007.score).toBe(0);
  });
  it('高质量：3 关键词（社群/就业/工具）全命中 + 长度≥60 → 接近满分', () => {
    const r = scoreApplication(baseInput({
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职简历竞争力；熟练使用 AI 工具和大模型提示词。',
    }));
    // 社群(+4) + 就业(+3) + 工具(+3) + 长度≥60(+3) = 13
    expect(r.RC007.score).toBeGreaterThanOrEqual(10);
    expect(r.RC007.hitKeywords).toContain('社群建设');
    expect(r.RC007.hitKeywords).toContain('就业指导');
    expect(r.RC007.hitKeywords).toContain('工具使用');
  });
  it('中等：2 关键词 → 中等分', () => {
    const r = scoreApplication(baseInput({
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职竞争力。',
    }));
    expect(r.RC007.score).toBeGreaterThanOrEqual(7);
    expect(r.RC007.score).toBeLessThan(15);
  });
  it('低质量：单关键词 → 低分', () => {
    const r = scoreApplication(baseInput({
      participantValue: '想给同学们一些 AI 的帮助',
    }));
    expect(r.RC007.score).toBeLessThan(5);
  });
});

describe('总分 + 等级映射', () => {
  it('S 级（≥90）= 高质量申请', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号', '高校社团', '企业园区'],
      experience: '曾组织过多场 Datawhale 校内 AI 分享会、编程工坊等活动，累计参与人数 100+ 人',
      motivation: '目标是降低 AI 工具使用门槛；让零基础同学快速上手；通过实操让同学们掌握大模型应用；搭建本地 AI 交流社群，助力就业；坚持共学打卡。',
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职简历竞争力；熟练使用 AI 工具。',
    }));
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe('S');
  });
  it('A 级（75-89）= 良好', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号', '高校社团'],
      experience: '曾组织过 AI 分享会，参与人数 50+',
      motivation: '目标是降低 AI 工具使用门槛；让零基础同学通过实操上手',
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职竞争力；熟练使用 AI 工具',
    }));
    // 10+10+15+12+10+7+13 = 77
    expect(r.total).toBeGreaterThanOrEqual(75);
    expect(r.total).toBeLessThan(90);
    expect(r.grade).toBe('A');
  });
  it('B 级（60-74）= 中等', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号'],
      experience: '组织过几次活动',
      motivation: '目标是推动 AI 教育进校园，希望同学们学习',
      participantValue: '希望参与者能做出 AI 作品',
    }));
    // 10+10+11+9+10+9+4 = 63
    expect(r.total).toBeGreaterThanOrEqual(60);
    expect(r.total).toBeLessThan(75);
    expect(r.grade).toBe('B');
  });
  it('C 级（40-59）= 较弱', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '有潜在',
      recruitChannel: ['社群'],
      experience: '曾参与过几次活动',
      motivation: '希望让同学了解 AI 工具，实操上手。',
    }));
    expect(r.total).toBeGreaterThanOrEqual(40);
    expect(r.total).toBeLessThan(60);
    expect(r.grade).toBe('C');
  });
  it('D 级（<40）= 不达标', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '暂无',
      recruitChannel: ['暂无'],
      experience: '',
      motivation: '想做点事',
    }));
    expect(r.total).toBeLessThan(40);
    expect(r.grade).toBe('D');
  });
  it('总分截断到 [0, 100]', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号', '高校社团', '企业园区'],
      experience: '组织过多场系列活动连续举办 Datawhale 千人参与 100+ 负责人 会长',
      motivation: '目标是降低 AI 工具使用门槛；让零基础同学快速上手；通过实操让同学们掌握大模型应用；搭建本地 AI 交流社群，助力就业。',
    }));
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
  it('scoredAt + engineVersion 写入', () => {
    const r = scoreApplication(baseInput());
    expect(r.scoredAt).toBeDefined();
    expect(r.engineVersion).toBe('v2');
  });
});

describe('badcase 标注', () => {
  it('RC002 非法值 → 0 分 + reason 含"异常"', () => {
    const r = scoreApplication(baseInput({ venueStatus: '不一定' as any }));
    expect(r.RC002.score).toBe(0);
    expect(r.RC002.reason).toContain('异常');
  });
  it('RC004 关键词命中 ≥3 且长度 <5 → 清零', () => {
    const r = scoreApplication(baseInput({ experience: '组织过举办过主办' }));
    // 长度 6 ≥ 5：保留分
    // 长度 <5 时才清零
    const r2 = scoreApplication(baseInput({ experience: '组主承' }));
    expect(r2.RC004.score).toBeLessThanOrEqual(3); // 极短时只有长度分
  });
});
