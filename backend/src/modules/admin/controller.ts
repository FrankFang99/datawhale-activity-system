/**
 * 管理后台：审批工作台（切片 3 · PRD §4.2.2）
 * v7：审批/分配后发站内消息（dw_messages）
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';

const router = Router();

// 飞书 select 字段返回总是数组；归一化为单个字符串
const normRole = (r: any): string => (Array.isArray(r) ? String(r[0] ?? '') : String(r ?? ''));

interface ApplicationRecord extends LarkRecord {
  fields: {
    applicationId?: string;
    applicationNo?: string;
    activityId?: string;
    userId?: string;
    organizerName?: string;
    status?: string;
    score?: number;
    grade?: string;
    scoreBreakdown?: string;
    scoreDetails?: string;
    submittedAt?: number;
    volunteerId?: string;
    organizerPhone?: string;
    // v1.2 Frank 27 09:49 反馈：精确时间/地址（CONFIRMED 时升级到活动表）
    expectedStartTime?: string;
    expectedEndTime?: string;
    confirmedAddress?: string;
    organizerEmail?: string;
    expectedDate?: number;
    location?: string;
    motivation?: string;
    participantValue?: string;
    experience?: string;
    venueStatus?: string;
    recruitChannel?: string | string[];
  };
}

interface UserRecord extends LarkRecord {
  fields: {
    userId?: string;
    email?: string;
    name?: string;
    role?: string;
    province?: string;
    status?: string;
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  SUBMITTED: { label: '已提交', color: 'blue' },
  SCREENING: { label: '待审批', color: 'gold' },
  CONFIRMED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已拒绝', color: 'red' },
  CANCELLED: { label: '已取消', color: 'default' },
  REVIEWING: { label: 'REVIEW 中', color: 'purple' },
  REVIEW_CONFIRMED: { label: 'REVIEW 已确认', color: 'purple' },
  COMPLETED: { label: '已结案', color: 'green' },
};

const GRADE_MAP: Record<string, { label: string; color: string }> = {
  S: { label: 'S · 优质', color: 'orange' },
  A: { label: 'A · 良好', color: 'green' },
  B: { label: 'B · 中等', color: 'blue' },
  C: { label: 'C · 较弱', color: 'orange' },
  D: { label: 'D · 不达标', color: 'red' },
};

const normStatus = (s: any): string => {
  if (Array.isArray(s)) return String(s[0] ?? '');
  return String(s ?? '');
};

function getAuditLog(scoreBreakdownStr?: string): any[] {
  if (!scoreBreakdownStr) return [];
  try {
    const b = JSON.parse(scoreBreakdownStr);
    return Array.isArray(b.auditLog) ? b.auditLog : [];
  } catch {
    return [];
  }
}

function appendAuditLog(scoreBreakdownStr: string | undefined, entry: any): string {
  let base: any = {};
  try {
    if (scoreBreakdownStr) base = JSON.parse(scoreBreakdownStr);
  } catch {
    base = {};
  }
  if (!Array.isArray(base.auditLog)) base.auditLog = [];
  base.auditLog.push({ ...entry, at: Date.now() });
  return JSON.stringify(base);
}

function serialize(a: ApplicationRecord) {
  const status = normStatus(a.fields.status);
  return {
    applicationId: a.fields.applicationId,
    applicationNo: a.fields.applicationNo,
    activityId: a.fields.activityId,
    userId: a.fields.userId,
    organizerName: a.fields.organizerName,
    status,
    statusLabel: STATUS_MAP[status]?.label ?? status,
    statusColor: STATUS_MAP[status]?.color ?? 'default',
    score: a.fields.score,
    grade: a.fields.grade,
    gradeLabel: GRADE_MAP[a.fields.grade ?? '']?.label,
    gradeColor: GRADE_MAP[a.fields.grade ?? '']?.color,
    submittedAt: a.fields.submittedAt,
    volunteerId: a.fields.volunteerId,
    organizerPhone: a.fields.organizerPhone,
    organizerEmail: a.fields.organizerEmail,
    expectedDate: a.fields.expectedDate,
    // v1.2 Frank 27 09:49 反馈：申请时的精确时间段和地址
    expectedStartTime: a.fields.expectedStartTime,
    expectedEndTime: a.fields.expectedEndTime,
    confirmedAddress: a.fields.confirmedAddress,
    location: a.fields.location,
    motivation: a.fields.motivation,
    participantValue: a.fields.participantValue,
    experience: a.fields.experience,
    venueStatus: normStatus(a.fields.venueStatus),
    recruitChannel: Array.isArray(a.fields.recruitChannel)
      ? a.fields.recruitChannel
      : a.fields.recruitChannel
      ? [a.fields.recruitChannel as string]
      : [],
  };
}

// 列出志愿者（必须在 /:id 之前定义，路由匹配顺序）
router.get('/volunteers', authRequired, requireRole('ADMIN', 'OPERATOR', 'VOLUNTEER'), async (_req, res) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.users, { pageSize: 200 });
  const list = (items as UserRecord[])
    .filter((u) => {
      const r = Array.isArray(u.fields.role) ? String(u.fields.role[0] ?? '') : String(u.fields.role ?? '');
      return r === 'VOLUNTEER' && u.fields.status !== 'DISABLED';
    })
    .map((u) => ({
      userId: u.fields.userId,
      email: u.fields.email,
      name: u.fields.name,
      province: u.fields.province ?? '',
    }));
  return ok(res, { list, total: list.length });
});

// GET /api/admin/applications/pending
router.get('/pending', authRequired, requireRole('OPERATOR', 'ADMIN'), async (_req, res) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const pending = (items as ApplicationRecord[])
    .filter((a) => normStatus(a.fields.status) === 'SCREENING')
    .map(serialize);
  return ok(res, { list: pending, total: pending.length });
});

// GET /api/admin/applications/review-pending
router.get('/review-pending', authRequired, requireRole('OPERATOR', 'ADMIN'), async (_req, res) => {
  const { items } = await feishuClient.listRecords(config.feishu.tables.applications, { pageSize: 200 });
  const pending = (items as ApplicationRecord[])
    .filter((a) => {
      const s = normStatus(a.fields.status);
      return s === 'REVIEWING' || s === 'REVIEW_CONFIRMED';
    })
    .map(serialize);
  return ok(res, { list: pending, total: pending.length });
});

// GET /api/admin/applications/:id
router.get('/:id', authRequired, requireRole('OPERATOR', 'ADMIN', 'VOLUNTEER'), async (req, res) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  let breakdown: any = null;
  try {
    if (a.fields.scoreBreakdown) breakdown = JSON.parse(a.fields.scoreBreakdown);
  } catch { /* ignore */ }

  const motivation = (breakdown?.RC005?.length ?? 0) > 0 ? 'OK' : 'short';
  const experience = (breakdown?.RC003?.length ?? 0) > 0 ? 'OK' : 'short';

  return ok(res, {
    ...serialize(a),
    scoreBreakdown: breakdown,
    scoreDetails: (() => {
      try {
        return a.fields.scoreDetails ? JSON.parse(a.fields.scoreDetails) : null;
      } catch {
        return null;
      }
    })(),
    auditLog: getAuditLog(a.fields.scoreBreakdown),
    riskFlags: {
      motivationShort: motivation === 'short',
      experienceShort: experience === 'short',
    },
  });
});

// GET /api/admin/applications/:id/audit-log
router.get('/:id/audit-log', authRequired, requireRole('OPERATOR', 'ADMIN', 'VOLUNTEER'), async (req, res) => {
  const { id } = req.params;
  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');
  return ok(res, { auditLog: getAuditLog(a.fields.scoreBreakdown) });
});

// =====================================================================
// AI 草拟审核意见（v6 · Frank 2026-08-20 反馈）
// =====================================================================

const GRADE_DRAFT: Record<string, (ctx: any) => string> = {
  S: (ctx) =>
    `【建议：通过 + 优先志愿者】${ctx.organizerName} 同学申请 ${ctx.activityId} 活动，AI 总分 ${ctx.score}（S 级 · 优质），5 维评分表现优秀，建议直接通过并标记为优质申请，分配资深志愿者对接。`,
  A: (ctx) =>
    `【建议：通过】${ctx.organizerName} 同学申请 ${ctx.activityId} 活动，AI 总分 ${ctx.score}（A 级 · 良好），整体表现良好，建议通过并分配志愿者跟进。`,
  B: (ctx) => {
    const notes: string[] = [];
    if (ctx.venueStatus && ctx.venueStatus !== '已确定') notes.push(`场地状态为"${ctx.venueStatus}"，需关注`);
    if (!ctx.experience || ctx.experience.length < 20) notes.push('经验描述偏短');
    if (notes.length === 0) {
      return `【建议：通过】${ctx.organizerName} 同学申请 ${ctx.activityId} 活动，AI 总分 ${ctx.score}（B 级 · 中等），整体可行，建议通过并分配志愿者。`;
    }
    return `【建议：通过但需关注】${ctx.organizerName} 同学申请 ${ctx.activityId} 活动，AI 总分 ${ctx.score}（B 级 · 中等），${notes.join('；')}。建议通过并由志愿者重点跟进。`;
  },
  C: (ctx) => {
    const notes: string[] = [];
    if (!ctx.experience || ctx.experience.length < 20) notes.push('经验不足');
    if (!ctx.motivation || ctx.motivation.length < 30) notes.push('活动动机描述偏短');
    if (ctx.venueStatus === '暂无') notes.push('场地未确定');
    return `【建议：需补充资料】${ctx.organizerName} 同学申请 ${ctx.activityId} 活动，AI 总分 ${ctx.score}（C 级 · 较弱），${notes.length ? notes.join('；') : '整体可行性偏低'}。建议打回补充${notes[0] ?? '资料'}后再评估。`;
  },
  D: (ctx) =>
    `【建议：拒绝】${ctx.organizerName} 同学申请 ${ctx.activityId} 活动，AI 总分 ${ctx.score}（D 级 · 不达标），整体可行性低于预期，建议拒绝并附理由。`,
};

const draftSchema = z.object({
  customPrompt: z.string().max(200).optional(),
});

router.post('/:id/draft-review', authRequired, requireRole('OPERATOR', 'ADMIN', 'VOLUNTEER'), async (req, res) => {
  const { id } = req.params;
  draftSchema.parse(req.body ?? {});

  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  const grade = Array.isArray(a.fields.grade) ? String(a.fields.grade[0] ?? 'C') : String(a.fields.grade ?? 'C');
  const score = a.fields.score ?? 0;
  const ctx = {
    organizerName: a.fields.organizerName ?? '同学',
    activityId: a.fields.activityId ?? '',
    score,
    location: a.fields.location,
    motivation: a.fields.motivation,
    experience: a.fields.experience,
    venueStatus: Array.isArray(a.fields.venueStatus) ? a.fields.venueStatus[0] : a.fields.venueStatus,
  };

  const drafter = GRADE_DRAFT[grade] ?? GRADE_DRAFT['C'];
  const draft = drafter(ctx);

  return ok(res, {
    applicationId: id,
    grade,
    score,
    draft,
    basis: 'v1 模板化草拟（基于 grade + 风险标记）',
    editable: true,
  });
});

const approveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'RETURN', 'TRANSFER']),
  comment: z.string().max(200).optional(),
  transferTo: z.string().optional(),
});

// POST /api/admin/applications/:id/approve
router.post('/:id/approve', authRequired, requireRole('OPERATOR', 'ADMIN'), async (req, res) => {
  const { id } = req.params;
  const operatorId = req.user!.userId;
  const data = approveSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  const currentStatus = normStatus(a.fields.status);
  if (currentStatus !== 'SCREENING' && currentStatus !== 'SUBMITTED') {
    return fail(res, 409, ErrorCode.APP_004_NOT_FOUND, '该申请已被处理');
  }

  let newStatus: string | null = null;
  switch (data.action) {
    case 'APPROVE':
      newStatus = 'CONFIRMED';
      break;
    case 'REJECT':
      newStatus = 'REJECTED';
      if (!data.comment) return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '拒绝需填写原因');
      break;
    case 'RETURN':
      newStatus = 'DRAFT';
      if (!data.comment) return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '打回修改需填写原因');
      break;
    case 'TRANSFER':
      if (!data.transferTo) return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '转交需指定目标用户');
      break;
    default:
      return fail(res, 400, ErrorCode.BAD_REQUEST, '未知操作');
  }

  const newScoreBreakdown = appendAuditLog(a.fields.scoreBreakdown, {
    action: data.action,
    operatorId,
    comment: data.comment,
    transferTo: data.transferTo,
    fromStatus: currentStatus,
    toStatus: newStatus,
  });

  const updateFields: Record<string, any> = { scoreBreakdown: newScoreBreakdown };
  if (newStatus) updateFields.status = newStatus;
  await feishuClient.updateRecord(config.feishu.tables.applications, a.record_id, updateFields);

  // Frank 2026-08-21 #6 升级：APPROVE 时如果申请者 role = USER 或 PARTICIPANT，自动升级为 ORGANIZER
  // v1 简化：申请通过即升级（v2 加志愿者确认意向步骤后再升级）
  if (newStatus === 'CONFIRMED' && a.fields.userId) {
    // v1.2 Frank 27 09:49 反馈：CONFIRMED 时升级模糊时间/地点为精确时间/地址（无论用户是否已为 ORGANIZER）
    // 申请表里组织者填了 expectedStartTime/expectedEndTime/confirmedAddress
    // 写回活动表 → 活动详情/大厅显示精确时间
    if (a.fields.activityId) {
      try {
        const actRecs = await feishuClient.searchRecords(
          config.feishu.tables.activities,
          'activityId',
          a.fields.activityId
        );
        const act = actRecs[0] as LarkRecord | undefined;
        if (act) {
          const updateFields: any = {};
          if (a.fields.expectedStartTime) updateFields.startTime = a.fields.expectedStartTime;
          if (a.fields.expectedEndTime) updateFields.endTime = a.fields.expectedEndTime;
          if (a.fields.confirmedAddress) updateFields.confirmedAddress = a.fields.confirmedAddress;
          if (Object.keys(updateFields).length > 0) {
            await feishuClient.updateRecord(config.feishu.tables.activities, act.record_id, updateFields);
          }
        }
      } catch (e) {
        console.log(`[PROMOTE-PRECISE] 升级精确时间失败: ${(e as Error).message}`);
      }
    }

    // Frank #11: CONFIRMED 时自动初始化 5 阶段 19 个子任务（不再需要运营手动）
    try {
      let activityStartDate = Date.now() + 30 * 24 * 3600 * 1000;
      if (a.fields.activityId) {
        const actRecs = await feishuClient.searchRecords(
          config.feishu.tables.activities,
          'activityId',
          a.fields.activityId
        );
        const act = actRecs[0] as LarkRecord | undefined;
        const start = act?.fields?.startDate;
        if (typeof start === 'number') activityStartDate = start;
      }
      const { initializeStageTasks } = await import('../stages/controller');
      await initializeStageTasks(
        a.fields.applicationId ?? a.record_id,
        a.fields.userId,
        activityStartDate
      );
    } catch (e) {
      console.log(`[STAGE-INIT] 自动初始化 5 阶段任务失败: ${(e as Error).message}`);
    }

    // 角色升级（普通用户/参与者 → ORGANIZER）
    try {
      const userRecs = await feishuClient.searchRecords(
        config.feishu.tables.users,
        'userId',
        a.fields.userId
      );
      const u = userRecs[0] as UserRecord | undefined;
      if (u) {
        const currentRole = normRole(u.fields.role);
        if (['USER', 'PARTICIPANT', ''].includes(currentRole)) {
          await feishuClient.updateRecord(config.feishu.tables.users, u.record_id, {
            role: 'ORGANIZER',
          });
        }
      }
    } catch (e) {
      console.log(`[AUTO-PROMOTE] 升级用户角色失败: ${(e as Error).message}`);
    }
  }

  // v7：发站内消息给申请人
  if (newStatus && ['CONFIRMED', 'REJECTED', 'DRAFT'].includes(newStatus) && a.fields.userId) {
    try {
      const { sendMessage } = await import('../messages/controller');
      const titles: Record<string, string> = {
        CONFIRMED: '🎉 申请已通过',
        REJECTED: '❌ 申请未通过',
        DRAFT: '✏️ 申请被打回修改',
      };
      const actionLabel =
        data.action === 'APPROVE' ? '已通过审批' :
        data.action === 'REJECT' ? '未通过' : '被打回修改';
      await sendMessage({
        userId: a.fields.userId,
        type: newStatus === 'CONFIRMED' ? 'APPLICATION_APPROVE' : 'APPLICATION_REJECT',
        title: titles[newStatus],
        content: `申请 ${a.fields.applicationNo}（${a.fields.organizerName ?? '你'}）${actionLabel}${data.comment ? '：' + data.comment : ''}`,
        // Frank 2026-08-21 23:35 #3: 消息收件人是申请者，link 改 /my-applications（不再跳 /admin/approvals 否则 403）
        link: '/my-applications',
      });
    } catch { /* 推送失败不影响主流程 */ }
  }

  return ok(res, {
    applicationId: a.fields.applicationId,
    action: data.action,
    fromStatus: currentStatus,
    toStatus: newStatus ?? currentStatus,
    message: `${data.action} 成功`,
  });
});

const reviewConfirmSchema = z.object({
  action: z.enum(['CONFIRM', 'REJECT']),
  excellentOrganizer: z.enum(['Y', 'N']).optional(),
  comment: z.string().max(200).optional(),
  triggerReason: z.enum(['VOLUNTEER_TIMEOUT', 'VOLUNTEER_ESCALATION', 'MATERIAL_VIOLATION', 'OTHER']),
});

// POST /api/admin/applications/:id/review-confirm
router.post('/:id/review-confirm', authRequired, requireRole('OPERATOR', 'ADMIN'), async (req, res) => {
  const { id } = req.params;
  const operatorId = req.user!.userId;
  const data = reviewConfirmSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  const currentStatus = normStatus(a.fields.status);
  if (currentStatus !== 'REVIEWING' && currentStatus !== 'REVIEW_CONFIRMED') {
    return fail(res, 409, ErrorCode.APP_004_NOT_FOUND, '该申请未在 REVIEW 阶段');
  }

  let newStatus: string;
  if (data.action === 'CONFIRM') {
    newStatus = 'COMPLETED';
  } else {
    newStatus = 'REVIEWING';
    if (!data.comment) return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, 'REJECT 需填写原因');
  }

  const newScoreBreakdown = appendAuditLog(a.fields.scoreBreakdown, {
    action: `REVIEW_${data.action}`,
    operatorId,
    triggerReason: data.triggerReason,
    excellentOrganizer: data.excellentOrganizer,
    comment: data.comment,
    fromStatus: currentStatus,
    toStatus: newStatus,
  });

  await feishuClient.updateRecord(config.feishu.tables.applications, a.record_id, {
    status: newStatus,
    scoreBreakdown: newScoreBreakdown,
    ...(data.excellentOrganizer ? { excellentOrganizer: data.excellentOrganizer } : {}),
  });

  // v7：REVIEW 阶段确认后通知申请人
  if (newStatus === 'COMPLETED' && a.fields.userId) {
    try {
      const { sendMessage } = await import('../messages/controller');
      await sendMessage({
        userId: a.fields.userId,
        type: 'APPLICATION_APPROVE',
        title: '🎉 活动已结案',
        content: `申请 ${a.fields.applicationNo}（${a.fields.organizerName ?? '你'}）已结案，辛苦了！`,
        // Frank 2026-08-21 23:35 #3: 申请者收件人 link 改 /my-applications
        link: '/my-applications',
      });
    } catch { /* */ }
  }

  return ok(res, {
    applicationId: a.fields.applicationId,
    action: data.action,
    triggerReason: data.triggerReason,
    fromStatus: currentStatus,
    toStatus: newStatus,
    message: `REVIEW ${data.action} 成功`,
  });
});

// =====================================================================
// 分配志愿者（PRD §5.3.2 · v6）— ADMIN / OPERATOR 手动分配
// =====================================================================

const assignSchema = z.object({
  volunteerId: z.string().min(1, '请选择志愿者'),
  remark: z.string().max(200).optional(),
});

router.post('/:id/assign', authRequired, requireRole('ADMIN', 'OPERATOR'), async (req, res) => {
  const { id } = req.params;
  const data = assignSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const a = records[0] as ApplicationRecord | undefined;
  if (!a) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  const userRecords = await feishuClient.searchRecords(
    config.feishu.tables.users,
    'userId',
    data.volunteerId
  );
  const u = userRecords[0] as UserRecord | undefined;
  if (!u) return fail(res, 404, ErrorCode.NOT_FOUND, '志愿者不存在');
  const volunteerRole = Array.isArray(u.fields.role) ? String(u.fields.role[0] ?? '') : String(u.fields.role ?? '');
  if (volunteerRole !== 'VOLUNTEER') {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '该用户不是志愿者角色');
  }

  const newScoreBreakdown = appendAuditLog(a.fields.scoreBreakdown, {
    action: 'VOLUNTEER_ASSIGNED',
    operatorId: req.user!.userId,
    volunteerId: data.volunteerId,
    volunteerName: u.fields.name ?? '',
    remark: data.remark,
  });

  await feishuClient.updateRecord(config.feishu.tables.applications, a.record_id, {
    volunteerId: data.volunteerId,
    assignedAt: Date.now(),
    scoreBreakdown: newScoreBreakdown,
  });

  console.log(`[NOTIFY] 志愿者分配 → 志愿者 ${u.fields.email} (${u.fields.name}) / 申请 ${a.fields.applicationNo}`);

  // v7：发站内消息给志愿者
  try {
    const { sendMessage } = await import('../messages/controller');
    await sendMessage({
      userId: data.volunteerId,
      type: 'SYSTEM',
      title: '🤝 新申请分配给你',
      content: `申请 ${a.fields.applicationNo}（${a.fields.organizerName ?? '匿名'}）已分配给你跟进，${data.remark ? '备注：' + data.remark : '请尽快联系组织者'}`,
      link: '/volunteer/workbench',
    });
  } catch { /* */ }

  return ok(res, {
    applicationId: id,
    volunteerId: data.volunteerId,
    volunteerName: u.fields.name,
    message: `已分配志愿者 ${u.fields.name}`,
  });
});

// v12 数据迁移：删 4 条凑数 + 改 1 条子任务名（Frank 09:17 拍板"删"）
// POST /api/admin/migrate/v12-stage-tasks
router.post('/migrate/v12-stage-tasks', authRequired, requireRole('ADMIN'), async (_req, res) => {
  const { feishuClient } = await import('../../services/feishu/client');
  const TABLE = config.feishu.tables.stageTasks;

  // 1) 找 4 条凑数 + 1 条要改名的 record_id
  const all = await feishuClient.listRecords(TABLE, { pageSize: 200 });
  const toDelete: Array<{ record_id: string; taskId: string; subTaskName: string }> = [];
  const toUpdate: Array<{ record_id: string; taskId: string; oldName: string; newName: string }> = [];

  for (const r of all.items) {
    const name = r.fields.subTaskName ?? '';
    if (typeof name === 'string' && name.includes('志愿者审核') && name.includes('前')) {
      toDelete.push({ record_id: r.record_id, taskId: r.fields.taskId, subTaskName: name });
    } else if (name === '志愿者加组织者飞书 IM 好友') {
      toUpdate.push({
        record_id: r.record_id,
        taskId: r.fields.taskId,
        oldName: name,
        newName: '志愿者和组织者互加飞书好友',
      });
    }
  }

  // 2) 执行
  const deleteResults: Array<{ record_id: string; ok: boolean; taskId: string }> = [];
  for (const d of toDelete) {
    const ok = await feishuClient.deleteRecord(TABLE, d.record_id);
    deleteResults.push({ record_id: d.record_id, taskId: d.taskId, ok });
  }
  const updateResults: Array<{ record_id: string; ok: boolean; oldName: string; newName: string }> = [];
  for (const u of toUpdate) {
    try {
      await feishuClient.updateRecord(TABLE, u.record_id, { subTaskName: u.newName, title: `${u.newName} - 确认意向` });
      updateResults.push({ record_id: u.record_id, ok: true, oldName: u.oldName, newName: u.newName });
    } catch {
      updateResults.push({ record_id: u.record_id, ok: false, oldName: u.oldName, newName: u.newName });
    }
  }

  return ok(res, {
    message: `v12 数据迁移完成 · 删 ${deleteResults.filter((r) => r.ok).length}/${toDelete.length}，改 ${updateResults.filter((r) => r.ok).length}/${toUpdate.length}`,
    deleted: deleteResults,
    updated: updateResults,
  });
});

// v13 数据迁移：删 1 条"运营兜底确认" + 改 INTENT 阶段子任务 2/3 ownerType 为 ORGANIZER（Frank 14:12）
// POST /api/admin/migrate/v13-stage-tasks
router.post('/migrate/v13-stage-tasks', authRequired, requireRole('ADMIN'), async (_req, res) => {
  const { feishuClient } = await import('../../services/feishu/client');
  const TABLE = config.feishu.tables.stageTasks;

  const all = await feishuClient.listRecords(TABLE, { pageSize: 200 });
  const toDelete: Array<{ record_id: string; taskId: string; subTaskName: string }> = [];
  const toUpdate: Array<{ record_id: string; taskId: string; subTaskName: string; oldOwner: string; newOwner: string }> = [];

  for (const r of all.items) {
    const name = r.fields.subTaskName ?? '';
    const owner = Array.isArray(r.fields.ownerType) ? r.fields.ownerType[0] : r.fields.ownerType;
    if (typeof name === 'string' && name.includes('运营兜底确认')) {
      // Comment 2: 删
      toDelete.push({ record_id: r.record_id, taskId: r.fields.taskId, subTaskName: name });
    } else if (name === '双方最终确认活动方案/时间/地点/规模' && owner === 'VOLUNTEER') {
      // Comment 4: 改 ownerType
      toUpdate.push({ record_id: r.record_id, taskId: r.fields.taskId, subTaskName: name, oldOwner: owner, newOwner: 'ORGANIZER' });
    } else if (name === '飞书日历登记活动' && owner === 'VOLUNTEER') {
      // Comment 5: 改 ownerType
      toUpdate.push({ record_id: r.record_id, taskId: r.fields.taskId, subTaskName: name, oldOwner: owner, newOwner: 'ORGANIZER' });
    }
  }

  // 1) 删 1 条
  const deleteResults: Array<{ record_id: string; ok: boolean; taskId: string }> = [];
  for (const d of toDelete) {
    const ok = await feishuClient.deleteRecord(TABLE, d.record_id);
    deleteResults.push({ record_id: d.record_id, taskId: d.taskId, ok });
  }

  // 2) 改 ownerType
  const updateResults: Array<{ record_id: string; ok: boolean; subTaskName: string; oldOwner: string; newOwner: string }> = [];
  for (const u of toUpdate) {
    try {
      await feishuClient.updateRecord(TABLE, u.record_id, { ownerType: u.newOwner });
      updateResults.push({ record_id: u.record_id, ok: true, subTaskName: u.subTaskName, oldOwner: u.oldOwner, newOwner: u.newOwner });
    } catch {
      updateResults.push({ record_id: u.record_id, ok: false, subTaskName: u.subTaskName, oldOwner: u.oldOwner, newOwner: u.newOwner });
    }
  }

  return ok(res, {
    message: `v13 数据迁移完成 · 删 ${deleteResults.filter((r) => r.ok).length}/${toDelete.length}，改 ${updateResults.filter((r) => r.ok).length}/${toUpdate.length}（"阅读并确认行动指南"是新增模板，仅影响未来新申请）`,
    deleted: deleteResults,
    updated: updateResults,
  });
});

// =====================================================================
// v1 上线前重置（Frank 2026-08-25 12:19 拍板）
// 用途：清空 NO.001 清华站 + NO.002 申请 + 19 子任务 + 关联数据
// 保留：申请 status / score / volunteerId / userId（审批核心字段）
// 清空：所有过程字段（凭证/审核/确认/时间戳）+ 关联的物料/参与者/消息
// =====================================================================

// NO.001 站点 + NO.002 申请 record_id（飞书 base）
const NO001_RECORD = 'recvsOfT6SoGeS';
const NO002_RECORD = 'recvsOnFFzZbc6';

// 子任务重置：清空所有过程字段，状态由调用方显式设为 'PENDING'
// v16.5/v16.6/v16.7/v16.8 后 dw_stage_tasks 真实存在的字段：
// status, proofFile, reviewStatus, reviewRemark, reviewerId,
// operatorReviewStatus, operatorReviewRemark, operatorReviewerId, operatorReviewedAt,
// organizerSubmittedAt, organizerConfirmedAt, organizerReviewRemark,
// completedAt, submittedAt, dueDate, remark
// 注意：不能在此对象里写 status: null（会被调用方的 status: 'PENDING' spread 覆盖逻辑相反）
const RESET_TASK_FIELDS: Record<string, null> = {
  proofFile: null,
  reviewStatus: null,
  reviewRemark: null,
  reviewerId: null,
  operatorReviewStatus: null,
  operatorReviewRemark: null,
  operatorReviewerId: null,
  operatorReviewedAt: null,
  organizerSubmittedAt: null,
  organizerConfirmedAt: null,
  organizerReviewRemark: null,
  completedAt: null,
  submittedAt: null,
};

// 申请重置：v16.5 简化后 dw_applications 不存 stage 进度（仅子任务表存）
// 保留 status / score / grade / volunteerId / userId / scoreBreakdown / assignedAt
const RESET_APP_FIELDS: Record<string, null> = {
  // （v16.5 后无阶段进度字段，applications 表只存审批核心数据）
};

// 活动重置：清空 coverImage
const RESET_ACTIVITY_FIELDS: Record<string, null> = {
  coverImage: null,
};

// 从 listRecords 返回值中提取关联某 ID 的记录
function filterByField(records: any[], fieldName: string, target: string): any[] {
  return records.filter((r) => {
    const v = r.fields[fieldName];
    if (v == null) return false;
    if (Array.isArray(v)) return v.includes(target);
    return String(v) === target;
  });
}

// POST /api/admin/migrate/reset-no001
// Frank 2026-08-25 12:19 拍板：清空 NO.001 + NO.002 状态和附件
router.post('/migrate/reset-no001', authRequired, requireRole('ADMIN'), async (_req, res) => {
  const TABLES = config.feishu.tables;
  const log: string[] = [];

  // ===== 1) 重置 19 个 NO.002 子任务 =====
  const stageTasksAll = await feishuClient.listRecords(TABLES.stageTasks, { pageSize: 200 });
  const tasks = filterByField(stageTasksAll.items, 'applicationId', 'NO.002');
  log.push(`找到 ${tasks.length} 个 NO.002 子任务`);

  const taskResults: Array<{ record_id: string; taskId: string; subTaskName: string; ok: boolean; error?: string }> = [];
  for (const t of tasks) {
    try {
      await feishuClient.updateRecord(TABLES.stageTasks, t.record_id, {
        status: 'PENDING', // status 必须显式设为 PENDING（null 会被跳过）
        ...RESET_TASK_FIELDS, // 其他字段全部 null
      });
      taskResults.push({
        record_id: t.record_id,
        taskId: t.fields.taskId,
        subTaskName: t.fields.subTaskName,
        ok: true,
      });
    } catch (e: any) {
      taskResults.push({
        record_id: t.record_id,
        taskId: t.fields.taskId,
        subTaskName: t.fields.subTaskName,
        ok: false,
        error: String(e?.message ?? e),
      });
    }
  }
  log.push(`重置 ${taskResults.filter((r) => r.ok).length}/${tasks.length} 子任务 → PENDING`);

  // ===== 2) 重置 NO.002 申请（清空阶段进度） =====
  try {
    await feishuClient.updateRecord(TABLES.applications, NO002_RECORD, RESET_APP_FIELDS);
    log.push(`重置 NO.002 申请 currentStage/currentOrder/stageStartedAt/unlockedStages`);
  } catch (e: any) {
    log.push(`重置 NO.002 申请失败: ${String(e?.message ?? e)}`);
  }

  // ===== 3) 重置 NO.001 活动（清空 coverImage） =====
  try {
    await feishuClient.updateRecord(TABLES.activities, NO001_RECORD, RESET_ACTIVITY_FIELDS);
    log.push(`重置 NO.001 活动 coverImage → null`);
  } catch (e: any) {
    log.push(`重置 NO.001 活动失败: ${String(e?.message ?? e)}`);
  }

  // ===== 4) 删除关联数据 =====
  // dw_participants
  const participantsAll = await feishuClient.listRecords(TABLES.participants, { pageSize: 200 });
  const participants = filterByField(participantsAll.items, 'activityId', 'NO.001');
  for (const p of participants) {
    await feishuClient.deleteRecord(TABLES.participants, p.record_id);
  }
  log.push(`删除 ${participants.length} 条 dw_participants`);

  // dw_materials
  const materialsAll = await feishuClient.listRecords(TABLES.materials, { pageSize: 200 });
  const materials = filterByField(materialsAll.items, 'activityId', 'NO.001');
  for (const m of materials) {
    await feishuClient.deleteRecord(TABLES.materials, m.record_id);
  }
  log.push(`删除 ${materials.length} 条 dw_materials`);

  // dw_reimbursements（按 applicationId='NO.002'）
  const reimbursementsAll = await feishuClient.listRecords(TABLES.reimbursements, { pageSize: 200 });
  const reimbursements = filterByField(reimbursementsAll.items, 'applicationId', 'NO.002');
  for (const r of reimbursements) {
    await feishuClient.deleteRecord(TABLES.reimbursements, r.record_id);
  }
  log.push(`删除 ${reimbursements.length} 条 dw_reimbursements`);

  // dw_chat_logs
  const chatLogsAll = await feishuClient.listRecords(TABLES.chatLogs, { pageSize: 200 });
  const chatLogs = filterByField(chatLogsAll.items, 'activityId', 'NO.001');
  for (const c of chatLogs) {
    await feishuClient.deleteRecord(TABLES.chatLogs, c.record_id);
  }
  log.push(`删除 ${chatLogs.length} 条 dw_chat_logs`);

  // dw_interests
  const interestsAll = await feishuClient.listRecords(TABLES.interests, { pageSize: 200 });
  const interests = filterByField(interestsAll.items, 'activityId', 'NO.001');
  for (const i of interests) {
    await feishuClient.deleteRecord(TABLES.interests, i.record_id);
  }
  log.push(`删除 ${interests.length} 条 dw_interests`);

  // dw_messages（按 link 包含 /activities/NO.001 或 /applications/NO.002）
  const messagesAll = await feishuClient.listRecords(TABLES.messages, { pageSize: 200 });
  const messages = messagesAll.items.filter((r) => {
    const link = String(r.fields.link ?? '');
    return link.includes('NO.001') || link.includes('NO.002');
  });
  for (const m of messages) {
    await feishuClient.deleteRecord(TABLES.messages, m.record_id);
  }
  log.push(`删除 ${messages.length} 条 dw_messages（按 link 字段匹配）`);

  return ok(res, {
    message: `NO.001 + NO.002 重置完成 · ${taskResults.filter((r) => r.ok).length}/${tasks.length} 子任务已 PENDING`,
    log,
    taskResults,
    summary: {
      tasksReset: taskResults.filter((r) => r.ok).length,
      tasksTotal: tasks.length,
      participantsDeleted: participants.length,
      materialsDeleted: materials.length,
      reimbursementsDeleted: reimbursements.length,
      chatLogsDeleted: chatLogs.length,
      interestsDeleted: interests.length,
      messagesDeleted: messages.length,
    },
  });
});

// =====================================================================
// v1 上线种子数据（Frank 2026-08-25 14:13 拍板"恢复为原始状态"）
// 在 reset-no001 基础上重建一个能演示的合理状态：
// - INT 阶段 4 个子任务全 COMPLETED（让 Frank 看 5 阶段时间轴有"已完成"标记）
// - INT-3 formData 写好 → 活动表 location/scale/date 自动同步
// - RECRUIT 1 IN_PROGRESS（让 Frank 测"上传凭证"流程）
// - 其他子任务 PENDING
// - 加 3 个 participants + 2 条 messages（让 Inbox/活动大厅有内容）
// =====================================================================

// POST /api/admin/migrate/seed-no001
router.post('/migrate/seed-no001', authRequired, requireRole('ADMIN'), async (_req, res) => {
  const TABLES = config.feishu.tables;
  const log: string[] = [];

  // 1) 先清空（基于 reset-no001 逻辑）
  const stageTasksAll = await feishuClient.listRecords(TABLES.stageTasks, { pageSize: 200 });
  const tasks = stageTasksAll.items.filter((r) => {
    const aid = r.fields.applicationId;
    return aid === 'NO.002' || (Array.isArray(aid) && aid.includes('NO.002'));
  });
  for (const t of tasks) {
    await feishuClient.updateRecord(TABLES.stageTasks, t.record_id, {
      status: 'PENDING',
      proofFile: null, reviewStatus: null, reviewRemark: null, reviewerId: null,
      operatorReviewStatus: null, operatorReviewRemark: null, operatorReviewerId: null, operatorReviewedAt: null,
      organizerSubmittedAt: null, organizerConfirmedAt: null, organizerReviewRemark: null,
      completedAt: null, submittedAt: null,
    });
  }
  log.push(`重置 ${tasks.length} 个 NO.002 子任务 → PENDING`);

  // 清空关联数据
  for (const r of (await feishuClient.listRecords(TABLES.participants, { pageSize: 200 })).items.filter((r) => r.fields.activityId === 'NO.001' || (Array.isArray(r.fields.activityId) && r.fields.activityId.includes('NO.001')))) {
    await feishuClient.deleteRecord(TABLES.participants, r.record_id);
  }
  for (const r of (await feishuClient.listRecords(TABLES.materials, { pageSize: 200 })).items.filter((r) => r.fields.activityId === 'NO.001' || (Array.isArray(r.fields.activityId) && r.fields.activityId.includes('NO.001')))) {
    await feishuClient.deleteRecord(TABLES.materials, r.record_id);
  }
  for (const r of (await feishuClient.listRecords(TABLES.messages, { pageSize: 200 })).items.filter((r) => String(r.fields.link ?? '').includes('NO.001') || String(r.fields.link ?? '').includes('NO.002'))) {
    await feishuClient.deleteRecord(TABLES.messages, r.record_id);
  }

  // 2) 标记 INT 阶段 4 个子任务为 COMPLETED
  const intTaskNames = ['志愿者和组织者互加飞书好友', '阅读并确认行动指南', '双方最终确认活动方案/时间/地点/规模', '飞书日历登记活动'];
  const intFormData = {
    date: '2026-10-15',
    timeRange: '14:00-17:00',
    location: '北京·海淀区·清华科技园 H 座 5 层报告厅',
    scale: 80,
    planUrl: 'https://datawhaler.feishu.cn/docx/sample-plan-link',
  };
  const intFormJson = JSON.stringify(intFormData);
  let intCompleted = 0;
  for (const taskName of intTaskNames) {
    const target = tasks.find((t) => t.fields.subTaskName === taskName);
    if (!target) continue;
    const isFormTask = taskName.includes('双方最终确认');
    const completedAt = Date.now() - 3 * 24 * 3600 * 1000;  // 3 天前完成
    await feishuClient.updateRecord(TABLES.stageTasks, target.record_id, {
      status: 'COMPLETED',
      organizerSubmittedAt: completedAt,
      organizerConfirmedAt: completedAt,
      reviewerId: 'NO.024',  // 志愿者 Frank
      reviewStatus: 'APPROVED',
      operatorReviewerId: 'NO.022',  // 运营 Frank
      operatorReviewStatus: 'APPROVED',
      completedAt,
      submittedAt: completedAt,
      // 注：dw_stage_tasks 没有 reviewedAt 字段（用 submittedAt 替代）
      operatorReviewedAt: completedAt,
      remark: isFormTask ? intFormJson : (taskName.includes('阅读') ? '已读完' : '双方已确认'),
      proofFile: isFormTask ? intFormData.planUrl : (taskName.includes('互加飞书') ? 'https://datawhaler.feishu.cn/wiki/sample-friend-link' : 'https://datawhaler.feishu.cn/wiki/sample-doc-link'),
    });
    intCompleted++;
  }
  log.push(`INT 阶段 ${intCompleted}/4 子任务 → COMPLETED`);

  // 3) RECRUIT 1 建活动群聊 → IN_PROGRESS（让 Frank 测上传凭证流程）
  const recruit1 = tasks.find((t) => t.fields.subTaskName === '建活动群聊');
  if (recruit1) {
    await feishuClient.updateRecord(TABLES.stageTasks, recruit1.record_id, {
      status: 'IN_PROGRESS',
      organizerSubmittedAt: Date.now() - 1 * 24 * 3600 * 1000,
    });
    log.push(`RECRUIT 1 "建活动群聊" → IN_PROGRESS`);
  }

  // 4) 同步活动表 location/scale/date（从 INT-3 formData）
  const actRecords = await feishuClient.searchRecords(TABLES.activities, 'activityId', 'NO.001');
  if (actRecords[0]) {
    await feishuClient.updateRecord(TABLES.activities, actRecords[0].record_id, {
      location: intFormData.location,
      maxParticipants: intFormData.scale,
      startDate: new Date(`${intFormData.date}T14:00:00+08:00`).getTime(),
      endDate: new Date(`${intFormData.date}T17:00:00+08:00`).getTime(),
      startTime: intFormData.timeRange,
    });
    log.push(`同步 NO.001 活动 location/scale/date/startTime`);
  }

  // 5) 加 3 个 participants（让"已报名 0 人"变"已报名 3 人"）
  const partSeed = [
    { userId: 'NO.031', name: '张同学', status: 'CONFIRMED' },
    { userId: 'NO.032', name: '李同学', status: 'CONFIRMED' },
    { userId: 'NO.033', name: '王同学', status: 'CONFIRMED' },
  ];
  for (const p of partSeed) {
    await feishuClient.createRecord(TABLES.participants, {
      activityId: 'NO.001',
      userId: p.userId,
      status: p.status,
      registeredAt: Date.now() - 5 * 24 * 3600 * 1000,
    });
  }
  log.push(`加 ${partSeed.length} 个 participants`);

  // 6) 加 2 条 messages（让 Inbox 有内容）
  const msgSeed = [
    { title: '🎉 申请已通过', content: '申请 NO.002（清华站）已通过审批，可开始 5 阶段任务', link: '/activities/NO.001?stage=INTENT' },
    { title: '🔔 新申请分配给你', content: '申请 NO.002（清华站）已分配给你跟进', link: '/volunteer/workbench' },
  ];
  for (const m of msgSeed) {
    await feishuClient.createRecord(TABLES.messages, {
      userId: 'NO.022',
      type: 'SYSTEM',
      title: m.title,
      content: m.content,
      link: m.link,
      read: false,
      createdAt: Date.now() - 2 * 24 * 3600 * 1000,
    });
  }
  log.push(`加 ${msgSeed.length} 条 messages`);

  return ok(res, {
    message: `NO.001 种子数据重建完成 · INT 4 子任务 COMPLETED + RECRUIT 1 IN_PROGRESS + 3 participants + 2 messages`,
    log,
    summary: {
      intCompleted: intCompleted,
      recruit1InProgress: !!recruit1,
      participantsAdded: partSeed.length,
      messagesAdded: msgSeed.length,
    },
  });
});

export default router;
