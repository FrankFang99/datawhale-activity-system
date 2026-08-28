/**
 * 6 维评分引擎单测（Frank 27 16:22 反馈：v2 7 维 → v3 6 维）
 * 覆盖 RC001 ~ RC006 全部规则分支 + 等级映射 + 边界条件
 */
import { describe, it, expect } from 'vitest';
import { scoreApplication, ScoreInput } from './engine';

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    venueStatus: '已确定',
    recruitChannel: ['社群', '公众号', '高校社团'],
    experience: '曾组织过 3 场校内 AI 分享会，累计参与人数 100+',
    // Frank 27 16:42 反馈：v3 RC004 按 expectedTimeRangeDateCount 1:1 严格打分
    // baseInput 不再预设 expectedDate（历史字段），让时间测试显式 override
    activityStartDate: Date.now() + 7 * 24 * 3600 * 1000,
    activityEndDate: Date.now() + 60 * 24 * 3600 * 1000,
    expectedTimeRangeDateCount: 1,
    motivation: '目标是降低 AI 工具使用门槛；让零基础同学快速上手；通过实操让同学们掌握 AI 应用；搭建本地 AI 交流社群。',
    participantValue: '希望参与者能做出可展示的 AI 作品；积累求职作品集。',
    ...overrides,
  };
}

describe('RC001 场地确认（20 分 · v1 不变）', () => {
  it('已确定 → 20 分', () => {
    const r = scoreApplication(baseInput({ venueStatus: '已确定' }));
    expect(r.RC001.score).toBe(20);
    expect(r.RC001.reason).toContain('已确认');
  });
  it('有潜在 → 12 分', () => {
    const r = scoreApplication(baseInput({ venueStatus: '有潜在' }));
    expect(r.RC001.score).toBe(12);
  });
  it('暂无 → 0 分', () => {
    const r = scoreApplication(baseInput({ venueStatus: '暂无' }));
    expect(r.RC001.score).toBe(0);
  });
  it('非法值 → 0 分（异常）', () => {
    const r = scoreApplication(baseInput({ venueStatus: '未知' as any }));
    expect(r.RC001.score).toBe(0);
    expect(r.RC001.reason).toContain('异常');
  });
});

describe('RC002 招募能力（10 分 · v1 20 → v2 15 → v3 10）', () => {
  it('4 渠道（含 暂无）→ 10 分（按非"暂无"渠道数=3）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['暂无', '社群', '公众号', '高校社团'] }));
    expect(r.RC002.score).toBe(10);
    expect(r.RC002.count).toBe(3);
  });
  it('3 渠道 → 10 分（强）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群', '公众号', '高校社团'] }));
    expect(r.RC002.score).toBe(10);
  });
  it('2 渠道 → 7 分（良好）', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群', '公众号'] }));
    expect(r.RC002.score).toBe(7);
  });
  it('1 渠道 → 4 分', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['社群'] }));
    expect(r.RC002.score).toBe(4);
  });
  it('0 渠道 → 0 分', () => {
    const r = scoreApplication(baseInput({ recruitChannel: [] }));
    expect(r.RC002.score).toBe(0);
  });
  it('只"暂无" → 0 分', () => {
    const r = scoreApplication(baseInput({ recruitChannel: ['暂无'] }));
    expect(r.RC002.score).toBe(0);
  });
});

describe('RC003 组织经验（25 分 · 不变）', () => {
  it('空 → 0 分', () => {
    const r = scoreApplication(baseInput({ experience: '' }));
    expect(r.RC003.score).toBe(0);
  });
  it('高经验：组织过+多场+Datawhale+规模数据 → 接近满分', () => {
    const r = scoreApplication(baseInput({
      experience: '曾组织过多场 Datawhale 校内 AI 分享会、编程工坊等活动，累计参与人数 100+ 人',
    }));
    // 组织行为(+8) + 多场(+5) + Datawhale(+4) + 规模数据(+3) + 长度≥60(+3) = 23
    expect(r.RC003.score).toBeGreaterThanOrEqual(20);
    // Frank 28 12:18：hitKeywords 改为 "命中词(分类)" 格式
    expect(r.RC003.hitKeywords).toContain('组织过(组织行为)');
    expect(r.RC003.hitKeywords).toContain('多场(多场经验)');
    expect(r.RC003.hitKeywords).toContain('Datawhale(Datawhale 经验)');
  });
  it('中等经验：组织过+规模 → 中等分', () => {
    const r = scoreApplication(baseInput({
      experience: '曾组织过校内 AI 分享会，参与人数 50+',
    }));
    expect(r.RC003.score).toBeGreaterThanOrEqual(10);
    expect(r.RC003.score).toBeLessThan(20);
  });
  it('低经验：单关键词 → 低分', () => {
    const r = scoreApplication(baseInput({
      experience: '参加过一次活动',
    }));
    expect(r.RC003.score).toBeLessThan(10);
  });
  it('防刷：关键词命中 ≥3 但长度 <5 → 清零', () => {
    const r = scoreApplication(baseInput({
      experience: '组织过举办过主办',  // 3 关键词但长度 6 → 不应清零
    }));
    expect(r.RC003.score).toBeGreaterThan(0);
  });
  it('负责人角色识别', () => {
    const r = scoreApplication(baseInput({
      experience: '作为社长，组织过 5 场 AI 社团活动',
    }));
    // Frank 28 12:18：hitKeywords 改为 "命中词(分类)" 格式
    expect(r.RC003.hitKeywords).toContain('组织过(组织行为)');
    expect(r.RC003.hitKeywords).toContain('社长(负责人角色)');
  });
  it('截断到 25', () => {
    const r = scoreApplication(baseInput({
      experience: '组织过多场系列活动连续举办 Datawhale 校内 千人参与 负责人 会长 社长 队长 50+ 人',
    }));
    expect(r.RC003.score).toBeLessThanOrEqual(25);
  });
});

describe('RC004 时间合理性（15 分 · Frank 27 16:42：1:1 严格，每日期 1 分封顶 10）', () => {
  it('1 个日期 → 1 分', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '2026-09-15',
      expectedTimeRangeDateCount: 1,
    }));
    expect(r.RC004.score).toBe(1);
    expect(r.RC004.dateCount).toBe(1);
  });
  it('2 个日期 → 2 分', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '2026-09-15,2026-09-20',
      expectedTimeRangeDateCount: 2,
    }));
    expect(r.RC004.score).toBe(2);
    expect(r.RC004.dateCount).toBe(2);
  });
  it('3 个日期 → 3 分', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '2026-09-15,2026-09-20,2026-09-25',
      expectedTimeRangeDateCount: 3,
    }));
    expect(r.RC004.score).toBe(3);
  });
  it('9 个日期 → 9 分', () => {
    const dates = Array.from({ length: 9 }, (_, i) => `2026-09-${15 + i}`).join(',');
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: dates,
      expectedTimeRangeDateCount: 9,
    }));
    expect(r.RC004.score).toBe(9);
  });
  it('10 个日期 → 10 分（封顶）', () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-09-${15 + i}`).join(',');
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: dates,
      expectedTimeRangeDateCount: 10,
    }));
    expect(r.RC004.score).toBe(10);
  });
  it('11+ 个日期 → 10 分（封顶）', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '11 个日期',
      expectedTimeRangeDateCount: 11,
    }));
    expect(r.RC004.score).toBe(10);
  });
  it('未填任何时间 → 0 分', () => {
    const r = scoreApplication(baseInput({
      expectedDate: undefined,
      expectedTimeRange: '',
      expectedTimeRangeDateCount: 0,
    }));
    expect(r.RC004.score).toBe(0);
  });
  it('历史精确日期（兼容）→ 1 分', () => {
    const start = Date.now() + 30 * 24 * 3600 * 1000;
    const end = start + 14 * 24 * 3600 * 1000;
    const r = scoreApplication(baseInput({
      expectedDate: start + 5 * 24 * 3600 * 1000,
      expectedTimeRange: undefined,
      expectedTimeRangeDateCount: 0,
      activityStartDate: start,
      activityEndDate: end,
    }));
    expect(r.RC004.score).toBe(1);
  });
});

describe('RC005 申请动机（15 分 · 关键词参考 v1 6 类拆 3 类）', () => {
  it('空 → 0 分', () => {
    const r = scoreApplication(baseInput({ motivation: '' }));
    expect(r.RC005.score).toBe(0);
  });
  it('高质量：3 关键词（目标/实操/学习）全命中 + 长度≥60 → 接近满分', () => {
    const r = scoreApplication(baseInput({
      motivation: '目标是降低 AI 工具使用门槛；让零基础同学通过实操快速上手；坚持共学打卡，培养学习习惯。',
    }));
    // 目标(5) + 实操(4) + 学习(3) + 长度≥60(3) = 15
    expect(r.RC005.score).toBeGreaterThanOrEqual(10);
    // Frank 28 12:18：hitKeywords 改为 "命中词(分类)" 格式
    expect(r.RC005.hitKeywords).toContain('目标(目标清晰)');
    expect(r.RC005.hitKeywords).toContain('实操(实操价值)');
    expect(r.RC005.hitKeywords).toContain('习惯(学习习惯)');
  });
  it('中等：2 关键词 → 中等分', () => {
    const r = scoreApplication(baseInput({
      motivation: '目标是推动 AI 教育进校园；通过实操让同学们掌握 AI 工具。',
    }));
    expect(r.RC005.score).toBeGreaterThanOrEqual(7);
    expect(r.RC005.score).toBeLessThan(15);
  });
  it('低质量：单关键词 → 低分', () => {
    const r = scoreApplication(baseInput({
      motivation: '想做点 AI 相关的事',
    }));
    expect(r.RC005.score).toBeLessThan(5);
  });
});

describe('RC006 参与者价值（15 分 · 关键词参考 v1 6 类拆 3 类）', () => {
  it('空 → 0 分', () => {
    const r = scoreApplication(baseInput({ participantValue: '' }));
    expect(r.RC006.score).toBe(0);
  });
  it('高质量：3 关键词（社群/就业/工具）全命中 + 长度≥60 → 接近满分', () => {
    const r = scoreApplication(baseInput({
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职简历竞争力；熟练使用 AI 工具和大模型提示词。',
    }));
    // 社群(5) + 就业(4) + 工具(3) + 长度≥60(3) = 15
    expect(r.RC006.score).toBeGreaterThanOrEqual(10);
    // Frank 28 12:18：hitKeywords 改为 "命中词(分类)" 格式
    expect(r.RC006.hitKeywords).toContain('社群(社群建设)');
    expect(r.RC006.hitKeywords).toContain('求职(就业指导)');
    expect(r.RC006.hitKeywords).toContain('工具(工具使用)');
  });
  it('中等：2 关键词 → 中等分', () => {
    const r = scoreApplication(baseInput({
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职竞争力。',
    }));
    expect(r.RC006.score).toBeGreaterThanOrEqual(7);
    expect(r.RC006.score).toBeLessThan(15);
  });
  it('低质量：单关键词 → 低分', () => {
    const r = scoreApplication(baseInput({
      participantValue: '想给同学们一些 AI 的帮助',
    }));
    expect(r.RC006.score).toBeLessThan(5);
  });
});

describe('总分 + 等级映射', () => {
  it('S 级（≥90）= 高质量申请', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号', '高校社团', '企业园区'],
      experience: '曾组织过多场 Datawhale 校内 AI 分享会、编程工坊等活动，累计参与人数 100+ 人',
      expectedTimeRangeDateCount: 10,  // Frank 27 16:42 1:1 严格封顶 10
      motivation: '目标是降低 AI 工具使用门槛；让零基础同学快速上手；通过实操让同学们掌握大模型应用；搭建本地 AI 交流社群，助力就业；坚持共学打卡。',
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职简历竞争力；熟练使用 AI 工具和大模型应用。',
    }));
    // 20+10+23+10+13+15 = 91
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe('S');
  });
  it('A 级（75-89）= 良好', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号', '高校社团'],
      experience: '曾组织过校内 AI 分享会，参与人数 100+',
      expectedTimeRangeDateCount: 10,  // Frank 27 16:42 1:1 严格封顶 10
      motivation: '目标是推动 AI 教育进校园；通过实操让同学们掌握 AI 工具',
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职竞争力；熟练使用 AI 工具',
    }));
    // 20+10+13+10+9+14 = 76
    expect(r.total).toBeGreaterThanOrEqual(75);
    expect(r.total).toBeLessThan(90);
    expect(r.grade).toBe('A');
  });
  it('B 级（60-74）= 中等', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '已确定',
      recruitChannel: ['社群', '公众号'],
      experience: '曾组织过校内 AI 分享会',
      expectedTimeRangeDateCount: 10,
      motivation: '目标是推动 AI 教育进校园',
      participantValue: '希望参与者能加入本地 AI 社群；通过作品集积累求职竞争力；熟练使用 AI 工具',
    }));
    // 20+7+9+10+5+14 = 65
    expect(r.total).toBeGreaterThanOrEqual(60);
    expect(r.total).toBeLessThan(75);
    expect(r.grade).toBe('B');
  });
  it('C 级（40-59）= 较弱', () => {
    const r = scoreApplication(baseInput({
      venueStatus: '有潜在',
      recruitChannel: ['社群', '公众号'],
      experience: '曾组织过几次活动',
      motivation: '目标是通过实操让同学们了解 AI 工具',
      participantValue: '希望参与者能做出 AI 作品',
    }));
    // 12+7+9+1+9+3 = 41
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
    expect(r.engineVersion).toBe('v3');
  });
});

describe('badcase 标注', () => {
  it('RC001 非法值 → 0 分 + reason 含"异常"', () => {
    const r = scoreApplication(baseInput({ venueStatus: '不一定' as any }));
    expect(r.RC001.score).toBe(0);
    expect(r.RC001.reason).toContain('异常');
  });
  it('RC003 关键词命中 ≥3 且长度 <5 → 清零', () => {
    const r = scoreApplication(baseInput({ experience: '组织过举办过主办' }));
    const r2 = scoreApplication(baseInput({ experience: '组主承' }));
    expect(r2.RC003.score).toBeLessThanOrEqual(3);
  });
});
