/**
 * 7 维评分引擎（PRD §5.1 v2 · Frank 2026-08-27 15:58 反馈 Comment 4）
 *
 * 维度（每维对应一个问卷字段，总分 100）：
 * - RC001 基础信息    10 分  身份 + 现居地 3 级 + 学校 + 详细地址
 * - RC002 场地确认    10 分  venueStatus
 * - RC003 招募能力    15 分  recruitChannel
 * - RC004 组织经验    25 分  experience 关键词 + 长度
 * - RC005 时间合理性  10 分  expectedTimeRange 宽泛 / expectedDate 精确
 * - RC006 申请动机    15 分  motivation 关键词 + 长度
 * - RC007 参与者价值  15 分  participantValue 关键词 + 长度
 *
 * 等级：S≥90 / A 75-89 / B 60-74 / C 40-59 / D<40
 *
 * 变更（v2）：
 * - v1 5 维（场地 20 / 招募 20 / 经验 25 / 时间 15 / 价值 20）→ v2 7 维
 * - 新增 RC001 基础信息（对应问卷里 4 个基础字段）
 * - 价值拆成 RC006 动机 + RC007 价值
 * - 总分不变 100
 *
 * 业务对齐（TODO §3）：当前规则为 v2 暂行版，待 Datawhale 业务对齐后调整权重/阈值/关键词。
 */

export interface ScoreInput {
  // Frank 27 15:58 Comment 4：基础信息完整度
  hasIdentity: boolean;       // applicantIdentity 有值
  hasLocation3: boolean;      // currentCity（拼好的"省·市·区"）有值
  hasSchool: boolean;         // 学校字段有值（从 location 解析或独立字段）
  hasAddress: boolean;        // 详细地址（非空，location 拼好的最后一段）
  // 已有字段
  venueStatus: '已确定' | '有潜在' | '暂无';
  recruitChannel: string[];   // 5 选多
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
  RC001: { score: number; max: 10; reason: string; completeCount?: number };
  RC002: { score: number; max: 10; reason: string; input?: string };
  RC003: { score: number; max: 15; reason: string; count?: number };
  RC004: { score: number; max: 25; reason: string; hitKeywords?: string[]; length?: number };
  RC005: { score: number; max: 10; reason: string; input?: string };
  RC006: { score: number; max: 15; reason: string; hitKeywords?: string[]; length?: number };
  RC007: { score: number; max: 15; reason: string; hitKeywords?: string[]; length?: number };
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  scoredAt: string;
  engineVersion: string;
}

// ===== RC001 基础信息（新增 · Frank 27 15:58 Comment 4）=====
function scoreBasic(input: ScoreInput): ScoreBreakdown['RC001'] {
  const completeCount =
    (input.hasIdentity ? 1 : 0) +
    (input.hasLocation3 ? 1 : 0) +
    (input.hasSchool ? 1 : 0) +
    (input.hasAddress ? 1 : 0);
  // 4 项全填=10；3 项=8；2 项=5；1 项=3；0 项=0
  const map: Record<number, number> = { 4: 10, 3: 8, 2: 5, 1: 3, 0: 0 };
  const score = map[completeCount] ?? 0;
  const reason = completeCount === 4
    ? '基础信息完整'
    : `基础信息 ${completeCount}/4 项完整（身份/现居地/学校/详细地址）`;
  return { score, max: 10, reason, completeCount };
}

// ===== RC002 场地确认（v1 RC001 缩到 10 分）=====
function scoreVenue(input: ScoreInput): ScoreBreakdown['RC002'] {
  const map: Record<string, { score: number; reason: string }> = {
    '已确定': { score: 10, reason: '场地已确认，可直接推进' },
    '有潜在': { score: 6, reason: '有潜在场地，需协助最终确认' },
    '暂无': { score: 0, reason: '暂无场地，需协助寻找' },
  };
  const v = map[input.venueStatus] ?? { score: 0, reason: '场地信息异常' };
  return { ...v, max: 10, input: input.venueStatus };
}

// ===== RC003 招募能力（v1 RC002 缩到 15 分）=====
function scoreRecruit(input: ScoreInput): ScoreBreakdown['RC003'] {
  const channels = (input.recruitChannel ?? []).filter((c) => c !== '暂无');
  const count = channels.length;
  let score = 0;
  let reason = '';
  if (count === 0) {
    score = 0;
    reason = '暂无可用招募渠道，需协助搭建';
  } else if (count === 1) {
    score = 6;
    reason = '已有 1 个本地招募渠道';
  } else if (count === 2) {
    score = 11;
    reason = '已有 2 个本地招募渠道，招募能力良好';
  } else {
    score = 15;
    reason = `已有 ${count} 个本地招募渠道，招募能力强`;
  }
  return { score, max: 15, reason, count };
}

// ===== RC004 组织经验（v1 RC003 不变，25 分）=====
function scoreExperience(input: ScoreInput): ScoreBreakdown['RC004'] {
  const text = input.experience?.trim() ?? '';
  if (!text) return { score: 0, max: 25, reason: '未填写组织经验' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], inc: number) => {
    for (const w of words) {
      if (text.toLowerCase().includes(w.toLowerCase())) {
        hits.push(cls);
        return inc;
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

  const final = Math.min(score, 25);
  return {
    score: final,
    max: 25,
    reason: final >= 18 ? '组织过多场活动，经验丰富' : '有组织经验',
    hitKeywords: hits,
    length: len,
  };
}

// ===== RC005 时间合理性（v1 RC004 缩到 10 分）=====
function scoreDate(input: ScoreInput): ScoreBreakdown['RC005'] {
  // 优先：精确日期（兼容历史 + 未来扩展）
  const d = input.expectedDate;
  if (d) {
    const start = input.activityStartDate;
    const end = input.activityEndDate;
    if (start && end && d >= start && d <= end + 24 * 3600 * 1000) {
      return { score: 10, max: 10, reason: '活动时间在周期内，安排合理', input: new Date(d).toISOString().slice(0, 10) };
    }
    if (start && d < start) {
      return { score: 10, max: 10, reason: '活动时间在活动开始前，安排合理', input: new Date(d).toISOString().slice(0, 10) };
    }
    return { score: 5, max: 10, reason: '活动时间偏离周期，需协调', input: new Date(d).toISOString().slice(0, 10) };
  }
  // 宽泛时间（Frank 27 12:50）
  const tr = (input.expectedTimeRange ?? '').trim();
  if (tr) {
    // 填了宽泛时间 → 8 分（信号少，10 分制下给 8）
    return { score: 8, max: 10, reason: `已填写宽泛时间「${tr}」`, input: tr };
  }
  return { score: 0, max: 10, reason: '未提供有效活动时间', input: '' };
}

// ===== RC006 申请动机（v1 RC005 拆出 15 分）=====
// 关键词聚焦"申请人的目标"：目标/实操/学习
function scoreMotivation(input: ScoreInput): ScoreBreakdown['RC006'] {
  const text = (input.motivation ?? '').trim();
  if (!text) return { score: 0, max: 15, reason: '未填写申请动机' };

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
  score += add('目标清晰', ['目标', '规划', '计划', '旨在', '致力于'], 4);
  score += add('实操价值', ['实操', '实战', '项目', '作品', '落地', '上手'], 3);
  score += add('学习习惯', ['习惯', '坚持', '打卡', '共学', '陪伴', '学习'], 3);

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
    return { score: 0, max: 15, reason: '疑似刷分，已清零', hitKeywords: hits, length: len };
  }

  const final = Math.min(score, 15);
  return {
    score: final,
    max: 15,
    reason: final >= 10 ? '申请动机清晰' : '有申请动机',
    hitKeywords: hits,
    length: len,
  };
}

// ===== RC007 参与者价值（v1 RC005 拆出 15 分）=====
// 关键词聚焦"给参与者的好处"：社群/就业/工具
function scoreParticipantValue(input: ScoreInput): ScoreBreakdown['RC007'] {
  const text = (input.participantValue ?? '').trim();
  if (!text) return { score: 0, max: 15, reason: '未填写参与者价值' };

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
  score += add('社群建设', ['社群', '社区', '交流', '平台', '网络', '圈子'], 4);
  score += add('就业指导', ['就业', '职业', '求职', '简历', '面试', '工作'], 3);
  score += add('工具使用', ['工具', 'AI', '大模型', '提示词', 'Prompt', '应用'], 3);

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
    return { score: 0, max: 15, reason: '疑似刷分，已清零', hitKeywords: hits, length: len };
  }

  const final = Math.min(score, 15);
  return {
    score: final,
    max: 15,
    reason: final >= 10 ? '参与者价值清晰' : '有一定参与者价值',
    hitKeywords: hits,
    length: len,
  };
}

// ===== 评分汇总 =====
export function scoreApplication(input: ScoreInput): ScoreBreakdown {
  const RC001 = scoreBasic(input);
  const RC002 = scoreVenue(input);
  const RC003 = scoreRecruit(input);
  const RC004 = scoreExperience(input);
  const RC005 = scoreDate(input);
  const RC006 = scoreMotivation(input);
  const RC007 = scoreParticipantValue(input);
  const total = Math.max(
    0,
    Math.min(
      100,
      RC001.score + RC002.score + RC003.score + RC004.score + RC005.score + RC006.score + RC007.score,
    ),
  );
  const grade: ScoreBreakdown['grade'] =
    total >= 90 ? 'S' :
    total >= 75 ? 'A' :
    total >= 60 ? 'B' :
    total >= 40 ? 'C' : 'D';
  return {
    RC001, RC002, RC003, RC004, RC005, RC006, RC007,
    total,
    grade,
    scoredAt: new Date().toISOString(),
    engineVersion: 'v2',
  };
}
