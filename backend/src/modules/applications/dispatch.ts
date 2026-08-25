/**
 * 同校多申请者分流（v8 · TDD · PRD §5.3.5 US-O13）
 *
 * 规则：同活动（同 activityId）+ 同 user 已 CONFIRMED → 第 2 个起自动派生为 ASSISTANT
 * v1 简化：用 city 字段判断同校（同 city = 同城市 = 同校近似）
 * v2 可改为 user.school 字段
 *
 * 同站只能有 1 个 PRIMARY 组织者（v4 PRD §3.1 US-O13）
 */

export type ApplicantRole = 'PRIMARY' | 'ASSISTANT';

export interface ApplicationLite {
  userId?: string;
  activityId?: string;
  status?: string;
  city?: string;
}

// 终态 / 失败状态（不算"已有组织者"）
const ACTIVE_ORGANIZER_STATES = ['CONFIRMED', 'REVIEWING', 'REVIEW_CONFIRMED', 'COMPLETED'];

/**
 * 判断新申请者应该被分配的角色
 *
 * @param newApp 即将提交的新申请
 * @param existingApps 飞书 dw_applications 所有已有记录
 * @param newUserCity 申请人城市（用于同校判断；v2 可用 user.school）
 * @returns PRIMARY（主组织者）/ ASSISTANT（助教）
 */
export function detectApplicantRole(
  newApp: { userId: string; activityId: string; city?: string },
  existingApps: ApplicationLite[],
  newUserCity?: string
): ApplicantRole {
  // 1. 同一活动 + 同一用户：重复申请（防 dup 是 controller 的另一道）
  // 2. 同一活动 + 已存在 CONFIRMED 状态 + 同城市 → 派生 ASSISTANT
  const existingPrimary = existingApps.find(
    (a) =>
      a.activityId === newApp.activityId &&
      a.userId !== newApp.userId &&
      ACTIVE_ORGANIZER_STATES.includes(a.status ?? '') &&
      isSameCity(a.city, newUserCity)
  );

  if (existingPrimary) return 'ASSISTANT';
  return 'PRIMARY';
}

// 同校判定：v1 简化用 city 字段（精确同字串）
// v2 可用 school 字段或地址标准化
export function isSameCity(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

/**
 * 站内消息文案（dispatch 时给 applicant 推）
 */
export function getDispatchNotice(role: ApplicantRole, existingOrganizerName?: string): {
  title: string;
  content: string;
} {
  if (role === 'ASSISTANT') {
    return {
      title: '🤝 你将成为助教',
      content: existingOrganizerName
        ? `该活动站点已有主组织者 ${existingOrganizerName}，你将作为助教参与。请联系主组织者协调分工。`
        : '该活动站点已有主组织者，你将作为助教参与。请联系运营协调。',
    };
  }
  return {
    title: '🎉 申请已提交',
    content: '申请已提交，预计 3 个工作日内通知您结果',
  };
}
