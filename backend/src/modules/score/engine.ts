/**
 * 6 维评分引擎（PRD §5.1 v3 · Frank 2026-08-27 16:22 反馈）
 *
 * 维度（每维对应一个问卷字段，总分 100）：
 * - RC001 场地确认    20 分  venueStatus
 * - RC002 招募能力    10 分  recruitChannel
 * - RC003 组织经验    25 分  experience 关键词 + 长度
 * - RC004 时间合理性  15 分  按预期日期数量（expectedTimeRangeDateCount）
 * - RC005 申请动机    15 分  motivation 关键词（v1 6 类拆 3 类）+ 长度
 * - RC006 参与者价值  15 分  participantValue 关键词（v1 6 类拆 3 类）+ 长度
 *
 * 等级：S≥90 / A 75-89 / B 60-74 / C 40-59 / D<40
 *
 * 变更（v3 · Frank 27 16:22/16:42 反馈）：
 * - v2 7 维 → v3 6 维：删 RC001 基础信息维度（基础信息不参与评分）
 * - 场地：v1 20 分 → v3 20 分（不变）
 * - 招募：v1 20 分 → v2 15 分 → v3 10 分（缩）
 * - 时间：v1 15 分 → v2 10 分 → v3 15 分（Frank 16:42 改成 1:1 严格：每日期 1 分，封顶 10）
 * - 动机/价值：v1 共 20 分 → v2 各 15 分 → v3 各 15 分（关键词参考 v1 6 类，3+3 分）
 *
 * 关键词分配（v1 RC005 6 类，v3 拆两维各 3 类，比例 5/4/3 + 长度 3）：
 * - 动机(15)：目标(5) + 实操(4) + 学习(3) + 长度 3
 * - 价值(15)：社群(5) + 就业(4) + 工具(3) + 长度 3
 *
 * 业务对齐（TODO §3）：当前规则为 v3 暂行版。
 */

export interface ScoreInput {
  venueStatus: '已确定' | '有潜在' | '暂无';
  recruitChannel: string[];        // 5 选多
  experience?: string;
  // Frank 27 12:50：申请时只填宽泛时间段，expectedTimeRange 字符串（如「2026-09-15,2026-09-20」）
  expectedTimeRange?: string;      // 宽泛时间字符串（多个日期用「,」分隔）
  expectedTimeRangeDateCount?: number;  // Frank 27 16:22 反馈：按预期日期数量打分
  expectedDate?: number;           // 兼容历史数据
  activityStartDate: number;
  activityEndDate: number;
  motivation: string;
  participantValue?: string;
}

export interface ScoreBreakdown {
  RC001: { score: number; max: 20; reason: string; input?: string };
  RC002: { score: number; max: 10; reason: string; count?: number };
  RC003: { score: number; max: 25; reason: string; hitKeywords?: string[]; length?: number };
  RC004: { score: number; max: 15; reason: string; input?: string; dateCount?: number };
  RC005: { score: number; max: 15; reason: string; hitKeywords?: string[]; length?: number };
  RC006: { score: number; max: 15; reason: string; hitKeywords?: string[]; length?: number };
  total: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  scoredAt: string;
  engineVersion: string;
}

// ===== RC001 场地确认（v1 不变 20 分）=====
function scoreVenue(input: ScoreInput): ScoreBreakdown['RC001'] {
  const map: Record<string, { score: number; reason: string }> = {
    '已确定': { score: 20, reason: '场地已确认，可直接推进' },
    '有潜在': { score: 12, reason: '有潜在场地，需协助最终确认' },
    '暂无': { score: 0, reason: '暂无场地，需协助寻找' },
  };
  const v = map[input.venueStatus] ?? { score: 0, reason: '场地信息异常' };
  return { ...v, max: 20, input: input.venueStatus };
}

// ===== RC002 招募能力（v1 20 → v2 15 → v3 10）=====
function scoreRecruit(input: ScoreInput): ScoreBreakdown['RC002'] {
  const channels = (input.recruitChannel ?? []).filter((c) => c !== '暂无');
  const count = channels.length;
  let score = 0;
  let reason = '';
  if (count === 0) {
    score = 0;
    reason = '暂无可用招募渠道，需协助搭建';
  } else if (count === 1) {
    score = 4;
    reason = '已有 1 个本地招募渠道';
  } else if (count === 2) {
    score = 7;
    reason = '已有 2 个本地招募渠道，招募能力良好';
  } else {
    score = 10;
    reason = `已有 ${count} 个本地招募渠道，招募能力强`;
  }
  return { score, max: 10, reason, count };
}

// ===== RC003 组织经验（v1 不变 25 分）=====
function scoreExperience(input: ScoreInput): ScoreBreakdown['RC003'] {
  const text = input.experience?.trim() ?? '';
  if (!text) return { score: 0, max: 25, reason: '未填写组织经验' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], inc: number) => {
    for (const w of words) {
      if (text.toLowerCase().includes(w.toLowerCase())) {
        // Frank 28 12:18：记录真实命中的关键词（之前 push className 太抽象）
        hits.push(`${w}(${cls})`);
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
    const m = text.match(/\d+\s*(人|名|参与者|\+|余)|百人|千人/);
    hits.push(m ? `${m[0]}(规模数据)` : '规模数据');
    score += 3;
  }
  score += add('负责人角色', ['负责人', '会长', '社长', '队长', '组织者', '主理人'], 3);
  if (/\d+/.test(text) && !hits.some((h) => h.includes('规模数据'))) {
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

// ===== RC004 时间合理性（v3 · Frank 27 16:42 反馈：1:1 严格）=====
// 规则：每个日期 1 分，封顶 10 分
//   0 个 = 0
//   1 个 = 1
//   2 个 = 2
//   ...
//   10 个 = 10
//   10+ 个 = 10（封顶）
// 兼容：expectedDate（历史精确日期）= 1 分（按 1 个日期计）
function scoreDate(input: ScoreInput): ScoreBreakdown['RC004'] {
  // 兼容历史：精确日期按 1 个日期计
  // Frank 28 12:18 修复：只有当宽泛时间（expectedTimeRangeDateCount）也为空时才走精确日期分支，
  // 否则 10 个宽泛日期会被精确日期 fallback 误判成 1 分
  const d = input.expectedDate;
  const dc = input.expectedTimeRangeDateCount ?? 0;
  if (d && dc === 0) {
    return { score: 1, max: 15, reason: '已选 1 个候选日期（历史精确日期）', input: '1 个日期', dateCount: 1 };
  }
  if (dc === 0) {
    return { score: 0, max: 15, reason: '未提供候选日期', input: '', dateCount: 0 };
  }
  if (dc >= 10) {
    return { score: 10, max: 15, reason: `已选 ${dc} 个候选日期（每日期 1 分，已封顶 10）`, input: `${dc} 个日期`, dateCount: dc };
  }
  return { score: dc, max: 15, reason: `已选 ${dc} 个候选日期（每日期 1 分）`, input: `${dc} 个日期`, dateCount: dc };
}

// ===== RC005 申请动机（v3 · 关键词参考 v1 6 类拆 3 类）=====
// 目标(5) + 实操(4) + 学习(3) + 长度(3) = 15
function scoreMotivation(input: ScoreInput): ScoreBreakdown['RC005'] {
  const text = (input.motivation ?? '').trim();
  if (!text) return { score: 0, max: 15, reason: '未填写申请动机' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], inc: number) => {
    for (const w of words) {
      if (text.includes(w)) {
        // Frank 28 12:18：记录真实命中的关键词
        hits.push(`${w}(${cls})`);
        return inc;
      }
    }
    return 0;
  };

  let score = 0;
  score += add('目标清晰', ['目标', '规划', '计划', '旨在', '致力于'], 5);
  score += add('实操价值', ['实操', '实战', '项目', '作品', '落地', '上手'], 4);
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

// ===== RC006 参与者价值（v3 · 关键词参考 v1 6 类拆 3 类）=====
// 社群(5) + 就业(4) + 工具(3) + 长度(3) = 15
function scoreParticipantValue(input: ScoreInput): ScoreBreakdown['RC006'] {
  const text = (input.participantValue ?? '').trim();
  if (!text) return { score: 0, max: 15, reason: '未填写参与者价值' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], inc: number) => {
    for (const w of words) {
      if (text.includes(w)) {
        // Frank 28 12:18：记录真实命中的关键词
        hits.push(`${w}(${cls})`);
        return inc;
      }
    }
    return 0;
  };

  let score = 0;
  score += add('社群建设', ['社群', '社区', '交流', '平台', '网络', '圈子'], 5);
  score += add('就业指导', ['就业', '职业', '求职', '简历', '面试', '工作'], 4);
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
  const RC001 = scoreVenue(input);
  const RC002 = scoreRecruit(input);
  const RC003 = scoreExperience(input);
  const RC004 = scoreDate(input);
  const RC005 = scoreMotivation(input);
  const RC006 = scoreParticipantValue(input);
  const total = Math.max(
    0,
    Math.min(
      100,
      RC001.score + RC002.score + RC003.score + RC004.score + RC005.score + RC006.score,
    ),
  );
  const grade: ScoreBreakdown['grade'] =
    total >= 90 ? 'S' :
    total >= 75 ? 'A' :
    total >= 60 ? 'B' :
    total >= 40 ? 'C' : 'D';
  return {
    RC001, RC002, RC003, RC004, RC005, RC006,
    total,
    grade,
    scoredAt: new Date().toISOString(),
    engineVersion: 'v3',
  };
}
