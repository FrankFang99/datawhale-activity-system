/**
 * 5 维评分引擎（PRD §5.1 v1 现行版）
 *
 * 维度：
 * - RC-001 场地确认  20 分
 * - RC-002 招募能力  20 分
 * - RC-003 组织经验  25 分
 * - RC-004 时间合理性 15 分
 * - RC-005 活动价值    20 分
 *
 * 等级：S≥90 / A 75-89 / B 60-74 / C 40-59 / D<40
 *
 * 业务对齐（TODO §3）：当前规则为 v1 暂行版，待 Datawhale 业务对齐后调整权重/阈值/关键词。
 */

export interface ScoreInput {
  venueStatus: '已确定' | '有潜在' | '暂无';
  recruitChannel: string[]; // 5 选多
  experience?: string;
  // Frank 27 12:50：申请时只填宽泛时间段，expectedTimeRange 字符串（如「2026 年 9 月」）
  expectedTimeRange?: string;  // 宽泛时间字符串
  expectedDate?: number;        // 兼容历史数据
  activityStartDate: number;
  activityEndDate: number;
  motivation: string;
  participantValue?: string;
}

export interface ScoreBreakdown {
  RC001: { score: number; max: 20; reason: string; input?: string };
  RC002: { score: number; max: 20; reason: string; count?: number };
  RC003: { score: number; max: 25; reason: string; hitKeywords?: string[]; length?: number };
  RC004: { score: number; max: 15; reason: string; input?: string };
  RC005: { score: number; max: 20; reason: string; hitKeywords?: string[]; length?: number };
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  scoredAt: string;
  engineVersion: string;
}

// ===== RC-001 场地确认 =====
function scoreVenue(input: ScoreInput): ScoreBreakdown['RC001'] {
  const map: Record<string, { score: number; reason: string }> = {
    '已确定': { score: 20, reason: '场地已确认，可直接推进' },
    '有潜在': { score: 12, reason: '有潜在场地，需协助最终确认' },
    '暂无': { score: 0, reason: '暂无场地，需协助寻找' },
  };
  const v = map[input.venueStatus] ?? { score: 0, reason: '场地信息异常' };
  return { ...v, max: 20, input: input.venueStatus };
}

// ===== RC-002 招募能力 =====
function scoreRecruit(input: ScoreInput): ScoreBreakdown['RC002'] {
  // "暂无" 与其他互斥：v1 简单按"非'暂无'渠道数"算
  const channels = (input.recruitChannel ?? []).filter((c) => c !== '暂无');
  const count = channels.length;
  let score = 0;
  let reason = '';
  if (count === 0) {
    score = 0;
    reason = '暂无可用招募渠道，需协助搭建';
  } else if (count === 1) {
    score = 8;
    reason = '已有 1 个本地招募渠道';
  } else if (count === 2) {
    score = 14;
    reason = '已有 2 个本地招募渠道，招募能力良好';
  } else {
    score = 20;
    reason = `已有 ${count}+ 个本地招募渠道，招募能力强`;
  }
  return { score, max: 20, reason, count };
}

// ===== RC-003 组织经验 =====
function scoreExperience(input: ScoreInput): ScoreBreakdown['RC003'] {
  const text = input.experience?.trim() ?? '';
  if (!text) return { score: 0, max: 25, reason: '未填写组织经验' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], add: number) => {
    for (const w of words) {
      if (text.toLowerCase().includes(w.toLowerCase())) {
        hits.push(cls);
        return add;
      }
    }
    return 0;
  };

  let score = 0;
  score += add('组织行为', ['组织过', '举办过', '主办', '承办', '牵头'], 8);
  score += add('多场经验', ['多场', '多次', '数场', '系列活动', '连续'], 5);
  score += add('Datawhale 经验', ['Datawhale', 'DW', '数据鲸'], 4);
  if (/\d+\s*(人|名|参与者|\+|余)|百人|千人/.test(text)) {
    hits.push('规模数据');
    score += 3;
  }
  score += add('负责人角色', ['负责人', '会长', '社长', '队长', '组织者', '主理人'], 3);
  if (/\d+/.test(text) && !hits.includes('规模数据')) {
    hits.push('数字出现');
    score += 2;
  }

  // 文本长度
  const len = text.length;
  if (len < 10) {
    /* +0 */
  } else if (len < 30) {
    score += 1;
  } else if (len < 60) {
    score += 2;
  } else {
    score += 3;
  }

  // 防刷：关键词命中 ≥3 但长度 <5
  if (hits.length >= 3 && len < 5) {
    score = 0;
    return { score: 0, max: 25, reason: '疑似刷分，已清零', hitKeywords: hits, length: len };
  }

  // 截断
  const final = Math.min(score, 25);
  return {
    score: final,
    max: 25,
    reason: final >= 18 ? '组织过多场活动，经验丰富' : '有组织经验',
    hitKeywords: hits,
    length: len,
  };
}

// ===== RC-004 时间合理性 =====
function scoreDate(input: ScoreInput): ScoreBreakdown['RC004'] {
  // Frank 27 12:50：宽泛时间（expectedTimeRange 字符串）只判断是否认真填了
  const tr = (input.expectedTimeRange ?? '').trim();
  if (tr) {
    // 填了宽泛时间 → 12 分（比精确日期 15 分少点，宽泛信息少）
    return { score: 12, max: 15, reason: `已填写宽泛时间「${tr}」`, input: tr };
  }
  // 兼容历史：精确日期
  const d = input.expectedDate;
  if (!d) return { score: 0, max: 15, reason: '未提供有效活动时间', input: '' };
  const start = input.activityStartDate;
  const end = input.activityEndDate;
  if (start && end && d >= start && d <= end + 24 * 3600 * 1000) {
    return { score: 15, max: 15, reason: '活动时间在周期内，安排合理', input: new Date(d).toISOString().slice(0, 10) };
  }
  if (start && end && d < start) {
    return { score: 15, max: 15, reason: '活动时间在活动开始前，安排合理', input: new Date(d).toISOString().slice(0, 10) };
  }
  // 偏离
  return {
    score: 8,
    max: 15,
    reason: '活动时间偏离周期，需协调',
    input: new Date(d).toISOString().slice(0, 10),
  };
}

// ===== RC-005 活动价值 =====
function scoreValue(input: ScoreInput): ScoreBreakdown['RC005'] {
  // v7 容错：motivation/participantValue 可能为 null/undefined（前端表单未填）
  const text = `${input.motivation ?? ''} ${input.participantValue ?? ''}`.trim();
  if (!text) return { score: 0, max: 20, reason: '未填写申请动机' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], inc: number) => {
    for (const w of words) {
      if (text.includes(w)) {
        hits.push(cls);
        return inc;
      }
    }
    return 0;
  };

  let score = 0;
  score += add('目标清晰', ['目标', '规划', '计划', '旨在', '致力于'], 5);
  score += add('实操价值', ['实操', '实战', '项目', '作品', '落地', '上手'], 4);
  score += add('社群建设', ['社群', '社区', '交流', '平台', '网络'], 3);
  score += add('就业指导', ['就业', '职业', '求职', '简历', '面试'], 3);
  score += add('学习习惯', ['习惯', '坚持', '打卡', '共学', '陪伴'], 3);
  score += add('工具使用', ['工具', 'AI', '大模型', '提示词', 'Prompt'], 2);

  const len = text.length;
  if (len < 10) {
    /* +0 */
  } else if (len < 30) {
    score += 1;
  } else if (len < 60) {
    score += 2;
  } else {
    score += 3;
  }

  if (hits.length >= 3 && len < 5) {
    score = 0;
    return { score: 0, max: 20, reason: '疑似刷分，已清零', hitKeywords: hits, length: len };
  }

  const final = Math.min(score, 20);
  return {
    score: final,
    max: 20,
    reason: '活动价值清晰',
    hitKeywords: hits,
    length: len,
  };
}

// ===== 评分汇总 =====
export function scoreApplication(input: ScoreInput): ScoreBreakdown {
  const RC001 = scoreVenue(input);
  const RC002 = scoreRecruit(input);
  const RC003 = scoreExperience(input);
  const RC004 = scoreDate(input);
  const RC005 = scoreValue(input);
  const total = Math.max(0, Math.min(100, RC001.score + RC002.score + RC003.score + RC004.score + RC005.score));
  const grade: ScoreBreakdown['grade'] =
    total >= 90 ? 'S' :
    total >= 75 ? 'A' :
    total >= 60 ? 'B' :
    total >= 40 ? 'C' : 'D';
  return {
    RC001, RC002, RC003, RC004, RC005,
    total,
    grade,
    scoredAt: new Date().toISOString(),
    engineVersion: 'v1',
  };
}
