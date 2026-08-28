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
  // Frank 28 12:30 反馈：时间维度满分从 15 改 10（"10 个日期拿满分"），5 分挪到 RC006
  RC004: { score: number; max: 10; reason: string; input?: string; dateCount?: number };
  RC005: { score: number; max: 15; reason: string; hitKeywords?: string[]; length?: number };
  // Frank 28 12:30 反馈：参与者价值满分 15 改 20，从时间维度挪 5 分过来
  RC006: { score: number; max: 20; reason: string; hitKeywords?: string[]; length?: number };
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
  // Frank 28 12:50 放宽：单字"组织/举办"也算（之前 3 字"组织过/举办过"过严了）
  score += add('组织行为', ['组织', '组织过', '举办', '举办过', '主办', '承办', '牵头'], 8);
  // 加"分享"扩展词让"3 次分享"命中
  score += add('多场经验', ['多场', '多次', '数场', '系列活动', '连续', '分享'], 5);
  // Datawhale 经验 4→5（增强 Datawhale 生态参与权重）
  score += add('Datawhale 经验', ['Datawhale', 'DW', '数据鲸'], 5);
  if (/\d+\s*(人|名|参与者|\+|余|次|场)|百人|千人/.test(text)) {
    const m = text.match(/\d+\s*(人|名|参与者|\+|余|次|场)|百人|千人/);
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

// ===== RC004 时间合理性（v3.2 · Frank 28 12:30 反馈：满分 15→10）=====
// 规则：每个日期 1 分，封顶 10 分
//   0 个 = 0
//   1 个 = 1
//   ...
//   10 个 = 10（满分）
//   10+ 个 = 10（封顶 = 满分）
// 兼容：expectedDate（历史精确日期）= 1 分
function scoreDate(input: ScoreInput): ScoreBreakdown['RC004'] {
  // 兼容历史：精确日期按 1 个日期计
  const d = input.expectedDate;
  const dc = input.expectedTimeRangeDateCount ?? 0;
  if (d && dc === 0) {
    return { score: 1, max: 10, reason: '已选 1 个候选日期（历史精确日期）', input: '1 个日期', dateCount: 1 };
  }
  if (dc === 0) {
    return { score: 0, max: 10, reason: '未提供候选日期', input: '', dateCount: 0 };
  }
  if (dc >= 10) {
    return { score: 10, max: 10, reason: `已选 ${dc} 个候选日期（每日期 1 分，已封顶 10）`, input: `${dc} 个日期`, dateCount: dc };
  }
  return { score: dc, max: 10, reason: `已选 ${dc} 个候选日期（每日期 1 分）`, input: `${dc} 个日期`, dateCount: dc };
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

// ===== RC006 参与者价值（v3.2 · Frank 28 12:30 反馈：满分 15→20）=====
// 社群(6) + 就业(5) + 工具(3) + 量化数据(3) + 资源对接(3) = 20
// Frank 28 12:30：把时间维度腾出的 5 分加到参与者价值，扩展为 5 维关键词
function scoreParticipantValue(input: ScoreInput): ScoreBreakdown['RC006'] {
  const text = (input.participantValue ?? '').trim();
  if (!text) return { score: 0, max: 20, reason: '未填写参与者价值' };

  const hits: string[] = [];
  const add = (cls: string, words: string[], inc: number) => {
    for (const w of words) {
      if (text.includes(w)) {
        hits.push(`${w}(${cls})`);
        return inc;
      }
    }
    return 0;
  };

  let score = 0;
  // 社群建设 6 分（+1 关键类别，加"协会"等扩展词）
  score += add('社群建设', ['社群', '社区', '协会', '平台', '网络', '圈子', '生态', '共学'], 6);
  // 就业指导 5 分
  score += add('就业指导', ['就业', '职业', '求职', '简历', '面试', '工作', '实习'], 5);
  // 工具使用 3 分
  score += add('工具使用', ['工具', 'AI', '大模型', '提示词', 'Prompt', '应用', 'Demo'], 3);
  // 量化数据 3 分（"50+ 同学" 这种）
  if (/\d+\s*(\+|人|同学|名|位|资源)|百人|千人/.test(text)) {
    const m = text.match(/\d+\s*(\+|人|同学|名|位|资源)|百人|千人/);
    hits.push(m ? `${m[0]}(量化数据)` : '量化数据');
    score += 3;
  }
  // 资源对接 3 分
  score += add('资源对接', ['资源', '对接', '联动', '合作', '导师', '客户', '路演'], 3);

  // 防刷
  if (hits.length >= 3 && text.length < 5) {
    score = 0;
    return { score: 0, max: 20, reason: '疑似刷分，已清零', hitKeywords: hits, length: text.length };
  }

  const final = Math.min(score, 20);
  return {
    score: final,
    max: 20,
    reason: final >= 15 ? '参与者价值清晰，资源丰富' : final >= 10 ? '有一定参与者价值' : '参与者价值描述较弱',
    hitKeywords: hits,
    length: text.length,
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
