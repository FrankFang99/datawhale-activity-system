/**
 * 资源所有权检查（v1.2 Frank 27 21:40 反馈：权限漏洞修复）
 *
 * 之前只有"角色检查"，没有"资源所有权检查"：
 * - org-thu 改 NO.018 子任务 = role=ORGANIZER 通过，但实际不是 NO.018 活动的组织者
 *
 * 修复：每个写接口 + 部分读接口都要先查 application，再做 stakeholder 检查
 *
 * 角色映射：
 * - ADMIN / OPERATOR：全管
 * - ORGANIZER：仅 app.userId（活动组织者本人）
 * - VOLUNTEER：仅 app.volunteerId（对接志愿者本人）
 * - ASSISTANT：同 ORGANIZER
 */

export function isAdminOrOperator(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'OPERATOR';
}

/**
 * 检查 user 是否是 application 的组织者（含 ASSISTANT）或运营/管理员
 * 适用：组织者写操作（submit / organizer-confirm / 申请详情读 / 草拟审核）
 */
export function isAppOrganizerOrAdmin(
  app: { fields?: { userId?: string } } | undefined,
  userId: string,
  role: string | undefined
): boolean {
  if (isAdminOrOperator(role)) return true;
  if (!app?.fields) return false;
  return app.fields.userId === userId;
}

/**
 * 检查 user 是否是 application 的对接志愿者或运营/管理员
 * 适用：志愿者写操作（review / 报销审核）
 */
export function isAppVolunteerOrAdmin(
  app: { fields?: { volunteerId?: string } } | undefined,
  userId: string,
  role: string | undefined
): boolean {
  if (isAdminOrOperator(role)) return true;
  if (!app?.fields) return false;
  return app.fields.volunteerId === userId;
}

/**
 * 检查 user 是否是 application 的活动相关方（组织者或志愿者）或运营/管理员
 * 适用：所有 stakeholder 都能看的读操作（如任务列表、申请详情）
 */
export function isAppStakeholderOrAdmin(
  app: { fields?: { userId?: string; volunteerId?: string } } | undefined,
  userId: string,
  role: string | undefined
): boolean {
  if (isAdminOrOperator(role)) return true;
  if (!app?.fields) return false;
  return app.fields.userId === userId || app.fields.volunteerId === userId;
}
