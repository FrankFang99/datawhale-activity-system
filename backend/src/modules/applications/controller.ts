/**
 * 申请模块：草稿 / 提交 / 我的申请
 * 切片 1：实现 §4.1.4 v3 修订版（14 字段）+ §5.1 5 维评分
 *
 * 状态机：DRAFT → SUBMITTED → SCREENING → CONFIRMED/REJECTED
 * v1 提交即自动跑评分；S/A 自动通过（CONFIRMED）；D 自动拒绝（REJECTED）；B/C 留 SCREENING 等运营
 */

import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';
import { scoreApplication, ScoreBreakdown } from '../score/engine';
import {
  APPLICATION_SCHEMA,
  findDuplicateApplication,
  validateActivityForApply,
  validateExpectedDate,
} from './state';
import { detectApplicantRole, ApplicantRole, getDispatchNotice } from './dispatch';
import { sendMessage } from '../messages/controller';

const router = Router();

interface ApplicationRecord extends LarkRecord {
  fields: {
    applicationId?: string;
    applicationNo?: string;
    activityId?: string;
    userId?: string;
    status?: string;
    score?: number;
    grade?: string;
    scoreBreakdown?: string;
  };
}

interface ActivityRecord extends LarkRecord {
  fields: {
    activityId?: string;
    title?: string;
    startDate?: number;
    endDate?: number;
    status?: string;
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

// POST /api/applications/submit（v7 重构：调 state.ts 纯函数消除 hardcode）
router.post('/submit', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userEmail = req.user!.email;
  const data = APPLICATION_SCHEMA.parse(req.body);

  // 1. 活动校验（v7 调纯函数）
  const acts = await feishuClient.searchRecords(
    config.feishu.tables.activities,
    'activityId',
    data.activityId
  );
  const activity = acts[0] as ActivityRecord | undefined;
  const activityCheck = validateActivityForApply(activity, Date.now());
  if (!activityCheck.ok) {
    const code = activityCheck.code === 'ACT_001_NOT_FOUND' ? ErrorCode.ACT_001_NOT_FOUND
      : activityCheck.code === 'ACT_002_NOT_PUBLISHED' ? ErrorCode.ACT_002_NOT_PUBLISHED
      : ErrorCode.ACT_003_EXPIRED;
    return fail(res, 400, code, activityCheck.message);
  }

  // 2. 日期校验（v7 调纯函数）— Frank 27 12:50 改：宽泛时间不需要具体日期校验
  // const dateCheck = validateExpectedDate(data.expectedDate, Date.now());
  // if (!dateCheck.ok) {
  //   return fail(res, 400, ErrorCode.APP_002_INVALID_DATE, dateCheck.message);
  // }

  // 3. 重复申请检查（v7 调纯函数 + 飞书查询）
  const allApps = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const dup = findDuplicateApplication(
    allApps.items as ApplicationRecord[],
    userId,
    data.activityId
  );
  if (dup) {
    return fail(res, 409, ErrorCode.APP_003_ALREADY_APPLIED, '您已申请该活动');
  }

  // 4. 跑 6 维评分（Frank 27 16:22 反馈：v2 7 维 → v3 6 维，删 RC001 基础信息维度）
  //    RC004 时间按 expectedTimeRange 字符串里的日期数量打分
  const expectedTimeRangeDateCount = (data.expectedTimeRange ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;
  let breakdown: ScoreBreakdown;
  try {
    breakdown = scoreApplication({
      // 已有字段
      venueStatus: data.venueStatus,
      recruitChannel: data.recruitChannel,
      experience: data.experience,
      // Frank 27 12:50：宽泛时间
      expectedTimeRange: data.expectedTimeRange,
      expectedTimeRangeDateCount,
      expectedDate: data.expectedDate ?? Date.now() + 60 * 24 * 3600 * 1000,
      activityStartDate: activity.fields.startDate ?? Date.now(),
      activityEndDate: activity.fields.endDate ?? Date.now() + 30 * 24 * 3600 * 1000,
      motivation: data.motivation,
      participantValue: data.participantValue,
    });
  } catch {
    return fail(res, 500, ErrorCode.SCORE_001_TIMEOUT, '评分异常，请稍后重试');
  }

  // 5. 状态机（v4 修订：所有申请均进入 SCREENING，等待运营/志愿者人工审核；
  //    不再根据 AI 评分自动 CONFIRMED 或 REJECTED）
  const newStatus = 'SCREENING';

  // 5.5 同校多申请者分流（B.1 完整版 v9 · PRD §5.3.5 US-O13）
  //   同活动 + 同城市 + 已有 CONFIRMED 别人 → 自动派生 ASSISTANT
  const allAppsForDispatch = (await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 })).items as ApplicationRecord[];
  const applicantRole: ApplicantRole = detectApplicantRole(
    { userId, activityId: data.activityId, city: data.location },
    allAppsForDispatch,
    data.location
  );

  // 5.6 找已有主组织者姓名（ASSISTANT 时站内消息用）
  let existingOrganizerName: string | undefined;
  if (applicantRole === 'ASSISTANT') {
    const existing = allAppsForDispatch.find(
      (x) =>
        x.fields.activityId === data.activityId &&
        x.fields.userId !== userId &&
        ['CONFIRMED', 'REVIEWING', 'REVIEW_CONFIRMED', 'COMPLETED'].includes(x.fields.status ?? '') &&
        x.fields.location === data.location
    );
    existingOrganizerName = existing?.fields.organizerName;
  }

  // 6. 写库
  const now = Date.now();
  const applicationNo = `APP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const recordId = await feishuClient.createRecord(config.feishu.tables.applications, {
    applicationNo,
    activityId: data.activityId,
    userId,
    organizerName: data.organizerName,
    organizerPhone: data.organizerPhone,
    organizerEmail: data.organizerEmail,
    // Frank 27 12:50 改：宽泛时间 + 身份 + 现居地
    expectedTimeRange: data.expectedTimeRange,
    applicantIdentity: data.applicantIdentity,
    currentCity: data.currentCity,
    // expectedDate 保留字段存 null（飞书表 datetime 必填，宽泛时间用 expectedTimeRange）
    expectedDate: null,
    location: data.location,
    motivation: data.motivation,
    experience: data.experience ?? '',
    participantValue: data.participantValue ?? '',
    venueStatus: data.venueStatus,
    recruitChannel: data.recruitChannel,
    applicantRole,
    status: newStatus,
    score: breakdown.total,
    grade: breakdown.grade,
    scoreBreakdown: JSON.stringify(breakdown),
    scoreDetails: JSON.stringify({
      RC001: breakdown.RC001.reason,
      RC002: breakdown.RC002.reason,
      RC003: breakdown.RC003.reason,
      RC004: breakdown.RC004.reason,
      RC005: breakdown.RC005.reason,
    }),
    submittedAt: now,
  });

  // 7. 读回 applicationId（飞书 auto_number 字段自动填，如 NO.012）
  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationNo',
    applicationNo
  );
  const created = records[0] as ApplicationRecord | undefined;
  const applicationId = created?.fields.applicationId ?? `APP-${recordId.slice(-6)}`;

  // 8. 返回（v2 设计：前端不直接看 score/grade/scoreBreakdown，避免先入为主）
  // v6 修订：返回活动飞书群二维码 URL（PRD §1.2 痛点 9）
  const groupQrCode = activity.fields.groupQrCode ?? null;

  // v6 修订：邮件通知 stub（v1 简化 = console.log + dw_chat_logs 写一条）
  const notifyAt = Date.now();
  console.log(`[NOTIFY] 申请提交成功 → 申请人 ${data.organizerEmail} (${data.organizerName}) / 活动 ${activity.fields.title} / 申请号 ${applicationNo} / role=${applicantRole} / groupQrCode=${groupQrCode ?? '无'}`);
  try {
    await feishuClient.createRecord(config.feishu.tables.chatLogs, {
      logId: `NOTIFY-${String(notifyAt).slice(-6)}`,
      userId: userId,
      userName: data.organizerName,
      message: `申请 ${applicationNo} 已提交成功，${groupQrCode ? '请扫码加入活动飞书群' : '请等待运营通知活动群'}`,
      at: notifyAt,
      type: 'APPLICATION_SUBMIT_NOTIFY',
    });
  } catch {
    /* 写日志失败不影响申请提交 */
  }

  // 8.5 站内消息（B.1 完整版 v9 · PRD §4.1.8 US-O11 + §5.3.5 US-O13）
  //   PRIMARY → 通用提交成功
  //   ASSISTANT → 提示该站点已有主组织者
  const notice = getDispatchNotice(applicantRole, existingOrganizerName);
  try {
    await sendMessage({
      userId,
      userName: data.organizerName,
      type: 'APPLICATION_SUBMIT',
      title: notice.title,
      content: notice.content + (groupQrCode ? '\n\n活动飞书群二维码：' + groupQrCode : ''),
      // Frank 2026-08-23 09:17 反馈：消息 Modal "查看详情" 跳申请审批详情页
      // → v12 改为 /applications/:id（新建的 ApplicationReview 页面，所有角色可看）
      link: `/applications/${applicationId}`,
    });
  } catch (e) {
    console.log(`[MESSAGE] 站内消息发送失败（不影响申请提交）: ${(e as Error).message}`);
  }

  return ok(res, {
    applicationId,
    applicationNo,
    status: newStatus,
    applicantRole,
    message: '申请已提交，预计 3 个工作日内通知您结果',
    activityTitle: activity.fields.title,
    groupQrCode,
  });
});

// GET /api/applications/:id/dispatch - B.1 同校多申请者分流（v8 · PRD §5.3.5 US-O13）
// 返回该申请者的角色（PRIMARY / ASSISTANT） + 已有主组织者姓名（如果是 ASSISTANT）
router.get('/:id/dispatch', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  // 鉴权：本人/运营/志愿者/管理员可看
  if (a.fields.userId !== req.user!.userId && !['ADMIN', 'OPERATOR', 'VOLUNTEER'].includes(req.user!.role)) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '无权查看');
  }

  // 调纯函数判定角色（v9 B.1 完整版：直接读 applicantRole 字段，如未填则实时计算）
  const allApps = (await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 })).items as ApplicationRecord[];
  const storedRole = a.fields.applicantRole;
  const role: ApplicantRole = (storedRole === 'PRIMARY' || storedRole === 'ASSISTANT')
    ? storedRole
    : detectApplicantRole(
        {
          userId: a.fields.userId ?? '',
          activityId: a.fields.activityId ?? '',
          city: a.fields.location,  // v1 简化：location 近似 city
        },
        allApps,
        a.fields.location
      );

  // 找已有主组织者
  let existingOrganizerName: string | undefined;
  if (role === 'ASSISTANT') {
    const existing = allApps.find(
      (x) =>
        x.fields.activityId === a.fields.activityId &&
        x.fields.userId !== a.fields.userId &&
        ['CONFIRMED', 'REVIEWING', 'REVIEW_CONFIRMED', 'COMPLETED'].includes(x.fields.status ?? '') &&
        x.fields.location === a.fields.location
    );
    existingOrganizerName = existing?.fields.organizerName;
  }

  return ok(res, {
    applicationId: id,
    applicantRole: role,
    existingOrganizerName,
    activityId: a.fields.activityId,
    userId: a.fields.userId,
  });
});

// GET /api/applications/mine - Frank 27 15:37：所有已登录用户都能看自己提交的申请（不限角色）
router.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const mine = (items as ApplicationRecord[])
    .filter((a) => a.fields.userId === userId)
    .sort((a, b) => (b.fields.applicationId?.localeCompare(a.fields.applicationId ?? '') ?? 0))
    .map((a) => {
      // v4 修订：申请处于 SCREENING（未审核）状态时，不向申请者展示分数与等级；
      // 待运营/志愿者审核后（CONFIRMED/REJECTED/PREPARING/REVIEW_CONFIRMED）才显示。
      const status = normStatus(a.fields.status);
      const showScore = !['SCREENING', 'DRAFT', 'SUBMITTED'].includes(status);
      const role = a.fields.applicantRole;
      return {
        applicationId: a.fields.applicationId,
        applicationNo: a.fields.applicationNo,
        activityId: a.fields.activityId,
        status,
        applicantRole: (role === 'PRIMARY' || role === 'ASSISTANT') ? role : 'PRIMARY',
        score: showScore ? a.fields.score : null,
        grade: showScore ? a.fields.grade : null,
        submittedAt: a.fields.applicationId,
      };
    });
  return ok(res, { list: mine, total: mine.length });
});

// v10 找该活动当前 CONFIRMED 申请（让志愿者/运营/助教可拿到 applicationId 看 3 步进度）
// GET /api/applications/by-activity/:activityId
router.get('/by-activity/:activityId', authRequired, async (req: Request, res: Response) => {
  const { activityId } = req.params;
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  // 仅返回 CONFIRMED 状态的申请（v10 限定：3 步进度只对已确认组织者的活动展示）
  const list = (items as ApplicationRecord[])
    .filter((a) => a.fields.activityId === activityId && normStatus(a.fields.status) === 'CONFIRMED')
    .map((a) => ({
      applicationId: a.fields.applicationId,
      applicationNo: a.fields.applicationNo,
      organizerName: a.fields.organizerName,
      organizerId: a.fields.userId,
    }));
  return ok(res, { list, total: list.length });
});

// v13 Frank 14:12 反馈 Comment 6：组织者完成阶段所有子任务 → 通知志愿者审核该阶段
// v16.7 Frank 19:41 反馈：志愿者也能触发解锁下一阶段（v16.7 volunteer-first 流程下志愿者先完成子任务）
// POST /api/applications/:id/notify-volunteer-review  body: { stage: 'INTENT' }
router.post('/:id/notify-volunteer-review', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stage } = req.body;
  if (!stage) return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '缺少 stage 参数');

  // 1. 查申请
  const appRecords = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const app = appRecords[0] as any;
  if (!app) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  // 2. 权限：组织者本人 / 对接该申请的志愿者 / ADMIN / OPERATOR
  // v16.7 Frank 19:41 反馈：志愿者也能触发（按 volunteer-first 流程志愿者先完成子任务）
  const isOrganizerSelf = app.fields.userId === req.user!.userId;
  const isAssignedVolunteer = req.user!.role === 'VOLUNTEER' && app.fields.volunteerId === req.user!.userId;
  const isAdminOrOperator = ['ADMIN', 'OPERATOR'].includes(req.user!.role);
  if (!isOrganizerSelf && !isAssignedVolunteer && !isAdminOrOperator) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '仅组织者或对接志愿者可触发解锁下一阶段');
  }

  // 3. 校验：该阶段所有子任务都 status=COMPLETED
  const { items: stageTasks } = await feishuClient.listRecords(config.feishu.tables.stageTasks, { pageSize: 200 });
  const targetStageTasks = (stageTasks as any[]).filter(
    (t) => t.fields.applicationId === id && t.fields.stage === stage
  );
  if (targetStageTasks.length === 0) {
    return fail(res, 404, ErrorCode.NOT_FOUND, `未找到 ${stage} 阶段子任务`);
  }
  const allCompleted = targetStageTasks.every((t) => t.fields.status === 'COMPLETED');
  if (!allCompleted) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, `该阶段还有 ${targetStageTasks.filter((t) => t.fields.status !== 'COMPLETED').length} 项未完成`);
  }

  // 4. 通知该申请对接的志愿者
  const { sendMessage } = await import('../messages/controller');
  const volunteerId = app.fields.volunteerId;
  if (!volunteerId) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '该申请未分配志愿者');
  }

  const stageLabel: Record<string, string> = {
    INTENT: '确认意向', RECRUIT: '对外招募', PREPARE: '现场筹备', EXECUTE: '活动执行', REVIEW: '活动复盘',
  };
  const stageName = stageLabel[stage] ?? stage;
  // v16.8 Frank 23:03/25 07:54 反馈：跳转到活动详情 5 阶段时间轴（不跳 StageBoard）
  const link = `/activities/${app.fields.activityId}?stage=${stage}`;

  await sendMessage({
    userId: volunteerId,
    userName: app.fields.volunteerName ?? volunteerId,
    type: 'STAGE_TASK',
    title: `🔓 组织者请求审核「${stageName}」阶段`,
    content: `活动 ${id} 的组织者已完成「${stageName}」阶段所有子任务，请审核该阶段后解锁下一阶段。`,
    link,
  });

  return ok(res, {
    applicationId: id,
    stage,
    stageName,
    volunteerId,
    completedTasks: targetStageTasks.length,
    message: `已通知志愿者（${volunteerId}）审核「${stageName}」阶段`,
  });
});

// GET /api/applications/:id
// v14 Frank 19:46 反馈 Comment 1：申请详情页要根据飞书 base 完整填充，不要跳飞书
// 修复：返回飞书 base 全部 14+ 字段（organizerName/Phone/Email/expectedDate/location/
//   motivation/experience/participantValue/venueStatus/recruitChannel/volunteerId/resources/
//   scoreDetails/auditLog/scoreBreakdown），志愿者/运营完整可见
// 隐私策略：志愿者需要联系申请者 → 完整显示手机/邮箱（Frank 8-22 v1 测试 Frank 一人 7 角色）
router.get('/:id', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  // Frank 27 15:05：飞书搜索索引有延迟（提交后立即查 applicationId 字段会 404）
  // 多字段 fallback：先 applicationId（auto_number）→ applicationNo（text）→ 整表 list 扫描
  let records: any[] = [];
  for (const field of ['applicationId', 'applicationNo']) {
    records = await feishuClient.searchRecords(
      config.feishu.tables.applications,
      field,
      id
    );
    if (records.length > 0) break;
  }
  // 仍找不到：list 全表 + 内存过滤（兜底 100% 能找到）
  if (records.length === 0) {
    const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 500 });
    records = items.filter((r: any) =>
      r.fields.applicationId === id ||
      r.fields.applicationNo === id ||
      r.record_id === id
    );
  }
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在或飞书索引尚未追上，请稍后再试');
  // 权限：自己 / 志愿者 / 运营可看（v12 扩展志愿者可见）
  if (a.fields.userId !== req.user!.userId && !['ADMIN', 'OPERATOR', 'VOLUNTEER'].includes(req.user!.role)) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '无权查看');
  }
  // Frank 27 16:22 反馈：详情页给用户看的别显示 activityId，直接显示活动名
  //   从 dw_activities 拉 title（兜底 list 全表 200 条内存过滤）
  let activityTitle: string | null = null;
  try {
    const act = await feishuClient.searchRecords(config.feishu.tables.activities, 'activityId', a.fields.activityId);
    if (act.length > 0) {
      activityTitle = act[0].fields.title ?? null;
    }
  } catch { /* 容错：飞书查不到就显示 activityId */ }
  // v4 修订：未审核前不展示 AI 评语；运营/志愿者审核后才展示 scoreBreakdown
  const status = normStatus(a.fields.status);
  const showBreakdown = !['SCREENING', 'DRAFT', 'SUBMITTED'].includes(status);
  const role = a.fields.applicantRole;
  // v14：解 scoreDetails（5 维 reason 文本）和 auditLog
  let scoreDetails: Record<string, string> | null = null;
  if (showBreakdown && a.fields.scoreDetails) {
    try { scoreDetails = JSON.parse(a.fields.scoreDetails); } catch { /* 容错 */ }
  }
  let auditLog: any[] = [];
  if (a.fields.scoreBreakdown) {
    try {
      const bd = JSON.parse(a.fields.scoreBreakdown);
      auditLog = bd?.auditLog ?? [];
    } catch { /* 容错 */ }
  }
  // 风险标记（v8 · 申请动机<30 字或经验<20 字）
  const motivationLen = (a.fields.motivation ?? '').length;
  const experienceLen = (a.fields.experience ?? '').length;
  const riskFlags = {
    motivationShort: motivationLen > 0 && motivationLen < 30,
    experienceShort: experienceLen > 0 && experienceLen < 20,
  };
  return ok(res, {
    // 核心标识
    applicationId: a.fields.applicationId,
    applicationNo: a.fields.applicationNo,
    activityId: a.fields.activityId,
    // Frank 27 16:22 反馈：给用户看的别显示 activityId，直接显示活动名
    activityTitle,
    userId: a.fields.userId,
    status,
    applicantRole: (role === 'PRIMARY' || role === 'ASSISTANT') ? role : 'PRIMARY',
    submittedAt: a.fields.applicationId,
    // 申请者联系信息（v14 完整返回，志愿者对接需要）
    organizerName: a.fields.organizerName,
    organizerPhone: a.fields.organizerPhone,
    organizerEmail: a.fields.organizerEmail,
    // 活动规划
    expectedDate: a.fields.expectedDate,
    location: a.fields.location,
    motivation: a.fields.motivation,
    experience: a.fields.experience,
    resources: a.fields.resources,
    participantValue: a.fields.participantValue,
    venueStatus: a.fields.venueStatus,
    recruitChannel: a.fields.recruitChannel ?? [],
    // 对接志愿者（v14 兜底：飞书 base 没填 volunteerName 时返回 null 而不是 undefined，让前端可读）
    volunteerId: a.fields.volunteerId ?? null,
    volunteerName: a.fields.volunteerName ?? null,
    // 评分（仅审核后展示）
    score: showBreakdown ? a.fields.score : null,
    grade: showBreakdown ? a.fields.grade : null,
    scoreBreakdown: showBreakdown && a.fields.scoreBreakdown ? JSON.parse(a.fields.scoreBreakdown) : null,
    scoreDetails,
    auditLog,
    riskFlags,
  });
});

export default router;
