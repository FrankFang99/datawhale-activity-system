/**
 * 5 阶段任务（切片 4 · PRD §5.4）
 *
 * 5 阶段：INTENT → RECRUIT → PREPARE → EXECUTE → REVIEW
 * 状态机：PENDING → IN_PROGRESS → COMPLETED / OVERDUE
 * 审核流（v10 三步进度）：
 *   1. 组织者自核（submit）→ 写 organizerSubmittedAt
 *   2. 志愿者审核（review, 限 VOLUNTEER）→ 写 reviewerId/reviewStatus/reviewRemark
 *   3. 运营复核（operator-review, 限 OPERATOR/ADMIN）→ 写 operatorReviewerId/operatorReviewStatus/operatorReviewRemark
 *
 * 接口：
 * - GET  /api/applications/:id/tasks          - 5 阶段任务列表（按 applicationId）
 * - POST /api/applications/:id/tasks/initialize - 初始化 5 阶段（CONFIRMED 触发）
 * - POST /api/stages/:taskId/submit           - 组织者自核（上传文件 + 自核打勾）
 * - POST /api/stages/:taskId/review          - 志愿者审核（APPROVE/REJECT，限 VOLUNTEER）
 * - POST /api/stages/:taskId/operator-review  - 运营复核（APPROVE/REJECT，限 OPERATOR/ADMIN）v10 新增
 * - POST /api/stages/:taskId/overdue         - 标记 OVERDUE（系统/管理员）
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { feishuClient, LarkRecord } from '../../services/feishu/client';
import { ok, fail, ErrorCode } from '../../utils/response';
import { authRequired, requireRole } from '../../middleware/auth';
import { isStageFullyCompleted, getNextStage, SubTaskLite } from './unlock';
import { sendMessage } from '../messages/controller';

const router = Router();

interface StageTaskRecord extends LarkRecord {
  fields: {
    taskId?: string;
    applicationId?: string;
    stage?: string;
    title?: string;
    description?: string;
    status?: string;
    assigneeId?: string;
    dueDate?: number;
    completedAt?: number;
    proofFile?: string;
    remark?: string;
    submittedAt?: number;
    reviewerId?: string;
    reviewStatus?: string;
    reviewRemark?: string;
    subTaskName?: string;  // v6：子任务名（如"建活动群聊"）
    order?: number;        // v6：子任务在阶段内的顺序
    ownerType?: string;    // v6：负责人类型（ORGANIZER/VOLUNTEER/OPERATOR）
    // v10 三步进度（2026-08-22 Frank 14:35 反馈）
    organizerSubmittedAt?: number;   // 组织者自核时间
    operatorReviewerId?: string;     // 运营最终审核人 userId
    operatorReviewedAt?: number;     // 运营最终审核时间
    operatorReviewStatus?: string;   // 运营审核状态 PENDING/APPROVED/REJECTED
    operatorReviewRemark?: string;   // 运营审核意见
  };
}

const normStatus = (s: any): string => (Array.isArray(s) ? String(s[0] ?? '') : String(s ?? ''));

// v1.2 Frank 27 21:40 反馈：权限漏洞修复（org-thu 之前能改 NO.018 子任务）
// 资源所有权检查：仅 application.userId（活动组织者本人） + 运营/管理员可操作
function isAppOrganizerOrAdmin(
  app: { fields: { userId?: string } } | undefined,
  userId: string,
  role: string
): boolean {
  if (role === 'ADMIN' || role === 'OPERATOR') return true;
  if (!app) return false;
  return app.fields.userId === userId;
}

// v1.2 Frank 27 21:40 反馈：权限漏洞修复
// 资源所有权检查：仅 application.volunteerId（对接志愿者本人） + 运营/管理员可操作
function isAppVolunteerOrAdmin(
  app: { fields: { volunteerId?: string } } | undefined,
  userId: string,
  role: string
): boolean {
  if (role === 'ADMIN' || role === 'OPERATOR') return true;
  if (!app) return false;
  return app.fields.volunteerId === userId;
}

// 5 阶段任务模板（PRD §5.4.2）
const STAGE_TEMPLATES: Array<{
  stage: 'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW';
  title: string;
  description: string;
  daysBeforeStart: number; // 负数 = 活动开始前；正数 = 活动后
}> = [
  { stage: 'INTENT',  title: '确认意向',
    description: '志愿者加组织者飞书 IM 好友；双方最终确认活动方案/时间/地点/规模；飞书日历登记。',
    daysBeforeStart: 10 },
  { stage: 'RECRUIT', title: '对外招募',
    description: '建活动群聊；定制视觉物料（海报/横幅）；发布报名表单；启动本地招募宣传。',
    daysBeforeStart: 7 },
  { stage: 'PREPARE', title: '现场筹备',
    description: '确认场地；组织者+助教完成培训；准备现场物料；提交宣传推文；参与者上传作品。',
    daysBeforeStart: 5 },
  { stage: 'EXECUTE', title: '活动执行',
    description: '现场签到；主题分享 20min + 带教演示 30min + 实操 40+min + 闪电分享 20-30min；采集素材。',
    daysBeforeStart: 0 },
  { stage: 'REVIEW',  title: '活动复盘',
    description: '提交复盘文档（含现场素材）；推动作品上墙；志愿者审核+可推荐优秀（v4 运营默认不介入）。',
    daysBeforeStart: -3 },  // T+3
];

// v6：5 阶段子任务模板（PRD §5.4.3）— v12 删除"志愿者审核 X 前 N 项"凑数子任务（Frank 09:17 反馈"不需要凑数"）
const SUBTASK_TEMPLATES: Array<{
  stage: 'INTENT' | 'RECRUIT' | 'PREPARE' | 'EXECUTE' | 'REVIEW';
  order: number;
  subTaskName: string;
  ownerType: 'ORGANIZER' | 'VOLUNTEER' | 'OPERATOR';
  proofHint: string;  // 凭证提示
}> = [
  // INTENT 阶段（v13 Frank 14:12 反馈 Comment 3/4/5）
  { stage: 'INTENT', order: 1, subTaskName: '志愿者和组织者互加飞书好友', ownerType: 'VOLUNTEER', proofHint: '好友关系建立截图' },
  // Comment 3：加"阅读并确认行动指南"（带飞书文档链接，组织者打勾）
  { stage: 'INTENT', order: 2, subTaskName: '阅读并确认行动指南', ownerType: 'ORGANIZER', proofHint: '飞书文档 https://datawhaler.feishu.cn/docx/K5G8dnWOEoxTC8xgxHHcSUMbni1（已读 + 确认）' },
  // Comment 4：改 ownerType 为组织者，填空表单（时间+地点+规模）同步飞书 base
  { stage: 'INTENT', order: 3, subTaskName: '双方最终确认活动方案/时间/地点/规模', ownerType: 'ORGANIZER', proofHint: '组织者填写具体时间（必填到日，几点到几点可选）、具体地点、预计规模 → 同步飞书 base' },
  // Comment 5：志愿者添加日历后，组织者确认打勾（volunteer-first 流程：志愿者 step1 → 组织者 step2）
  { stage: 'INTENT', order: 4, subTaskName: '飞书日历登记活动', ownerType: 'VOLUNTEER', proofHint: '志愿者添加日历后，组织者确认打勾' },
  // RECRUIT 阶段
  { stage: 'RECRUIT', order: 1, subTaskName: '建活动群聊', ownerType: 'ORGANIZER', proofHint: '群二维码' },
  { stage: 'RECRUIT', order: 2, subTaskName: '定制视觉物料（海报/横幅/手举牌）', ownerType: 'ORGANIZER', proofHint: '海报链接' },
  { stage: 'RECRUIT', order: 3, subTaskName: '复制专题并发布报名表单', ownerType: 'ORGANIZER', proofHint: '报名链接' },
  { stage: 'RECRUIT', order: 4, subTaskName: '启动本地招募宣传（公众号/朋友圈/群转发）', ownerType: 'ORGANIZER', proofHint: '推文截图' },
  // PREPARE 阶段
  { stage: 'PREPARE', order: 1, subTaskName: '确认场地并上传场地信息', ownerType: 'ORGANIZER', proofHint: '场地照片' },
  { stage: 'PREPARE', order: 2, subTaskName: '组织者+助教完成实操教程培训', ownerType: 'ORGANIZER', proofHint: '培训完成截图' },
  { stage: 'PREPARE', order: 3, subTaskName: '准备现场物料（接收/打印/任务卡PPT）', ownerType: 'ORGANIZER', proofHint: '物料清单' },
  { stage: 'PREPARE', order: 4, subTaskName: '提交宣传推文', ownerType: 'ORGANIZER', proofHint: '推文截图' },
  { stage: 'PREPARE', order: 5, subTaskName: '参与者上传作品/申请的认证', ownerType: 'ORGANIZER', proofHint: '作品链接 + 认证截图' },
  // EXECUTE 阶段
  { stage: 'EXECUTE', order: 1, subTaskName: '现场签到与引导', ownerType: 'ORGANIZER', proofHint: '签到截图' },
  { stage: 'EXECUTE', order: 2, subTaskName: '主题分享+带教演示+实操+闪电分享', ownerType: 'ORGANIZER', proofHint: '现场照片' },
  { stage: 'EXECUTE', order: 3, subTaskName: '采集现场素材（横版高清）', ownerType: 'ORGANIZER', proofHint: '现场照片≥3 张' },
  // REVIEW 阶段（v13 Frank 14:12 反馈 Comment 2：删"运营兜底确认（v4 默认不介入）"）
  { stage: 'REVIEW', order: 1, subTaskName: '提交活动复盘（含现场素材到飞书文档）', ownerType: 'ORGANIZER', proofHint: '复盘文档' },
  { stage: 'REVIEW', order: 2, subTaskName: '推动作品上墙（参与 OPC 能力认证）', ownerType: 'ORGANIZER', proofHint: '作品链接' },
  { stage: 'REVIEW', order: 3, subTaskName: '志愿者审核作品+反馈+可推荐优秀', ownerType: 'VOLUNTEER', proofHint: 'reviewStatus + excellentOrganizer' },
];

// 把 "T-N" 转成绝对 ms timestamp
function dueDateFor(activityStartDate: number, daysBeforeStart: number): number {
  return activityStartDate + daysBeforeStart * 24 * 3600 * 1000;
}

// ============== 初始化子任务（CONFIRMED 触发）==============
// v6：按 PRD §5.4.3 建 22 个子任务（首阶段 IN_PROGRESS，其余 PENDING）
export async function initializeStageTasks(applicationId: string, assigneeId: string, activityStartDate: number): Promise<string[]> {
  const recordIds: string[] = [];
  // 按 stage 分组
  const byStage: Record<string, typeof SUBTASK_TEMPLATES> = {};
  for (const t of SUBTASK_TEMPLATES) {
    if (!byStage[t.stage]) byStage[t.stage] = [];
    byStage[t.stage].push(t);
  }
  // 按 STAGE_TEMPLATES 顺序创建
  for (const stageTpl of STAGE_TEMPLATES) {
    const stage = stageTpl.stage;
    const subs = byStage[stage] ?? [];
    const stageDue = dueDateFor(activityStartDate, stageTpl.daysBeforeStart);
    // 第一阶段 INTENT 子任务 IN_PROGRESS，其余 PENDING
    const initialStatus = stage === 'INTENT' ? 'IN_PROGRESS' : 'PENDING';
    for (const sub of subs) {
      const id = await feishuClient.createRecord(config.feishu.tables.stageTasks, {
        applicationId,
        stage: sub.stage,
        title: `${STAGE_TEMPLATES.find((s) => s.stage === sub.stage)?.title ?? sub.stage} - ${sub.subTaskName}`,
        description: `${STAGE_TEMPLATES.find((s) => s.stage === sub.stage)?.description ?? ''}\n\n凭证：${sub.proofHint}`,
        subTaskName: sub.subTaskName,
        order: sub.order,
        ownerType: sub.ownerType,
        status: initialStatus,
        assigneeId: sub.ownerType === 'VOLUNTEER' || sub.ownerType === 'OPERATOR' ? assigneeId : '',
        dueDate: stageDue,
      });
      recordIds.push(id);
    }
  }
  return recordIds;
}

// 解锁下一阶段（v7 重构：调 unlock.ts 纯函数消除 hardcode）
async function unlockNextStage(applicationId: string, currentStage: string): Promise<string[]> {
  const { items } = await feishuClient.listRecords(config.feishu.tables.stageTasks, { pageSize: 200 });
  const lite: SubTaskLite[] = (items as StageTaskRecord[]).map((t) => ({
    stage: normStatus(t.fields.stage),
    status: normStatus(t.fields.status),
  }));

  // v7 调纯函数判定
  if (!isStageFullyCompleted(lite, currentStage)) return [];
  const nextStage = getNextStage(currentStage);
  if (!nextStage) return [];

  // 下一阶段 PENDING → IN_PROGRESS
  const nextSubs = (items as StageTaskRecord[]).filter(
    (t) => t.fields.applicationId === applicationId && normStatus(t.fields.stage) === nextStage
  );
  const unlocked: string[] = [];
  for (const sub of nextSubs) {
    if (normStatus(sub.fields.status) === 'PENDING') {
      await feishuClient.updateRecord(config.feishu.tables.stageTasks, sub.record_id, {
        status: 'IN_PROGRESS',
      });
      unlocked.push(sub.fields.taskId ?? sub.record_id);
    }
  }
  return unlocked;
}

function serialize(t: StageTaskRecord) {
  return {
    taskId: t.fields.taskId,
    applicationId: t.fields.applicationId,
    stage: normStatus(t.fields.stage),
    title: t.fields.title,
    description: t.fields.description,
    status: normStatus(t.fields.status),
    assigneeId: t.fields.assigneeId,
    dueDate: t.fields.dueDate,
    completedAt: t.fields.completedAt,
    proofFile: t.fields.proofFile,
    remark: t.fields.remark,
    submittedAt: t.fields.submittedAt,
    reviewerId: t.fields.reviewerId,
    reviewStatus: normStatus(t.fields.reviewStatus),
    reviewRemark: t.fields.reviewRemark,
    // v6：子任务三字段
    subTaskName: t.fields.subTaskName,
    order: t.fields.order,
    ownerType: normStatus(t.fields.ownerType),
    // v10 三步进度（2026-08-22 Frank 14:35 反馈）
    organizerSubmittedAt: t.fields.organizerSubmittedAt,
    operatorReviewerId: t.fields.operatorReviewerId,
    operatorReviewedAt: t.fields.operatorReviewedAt,
    operatorReviewStatus: normStatus(t.fields.operatorReviewStatus),
    operatorReviewRemark: t.fields.operatorReviewRemark,
  };
}

// GET /api/applications/:id/tasks
router.get('/applications/:id/tasks', authRequired, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  // v1.2 Frank 27 21:40 反馈：资源所有权检查（org-thu 改 NO.018 bug）
  // 仅活动组织者 / 对接志愿者 / 运营 / 管理员可看任务列表
  const appRecs = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const app = appRecs[0] as any;
  const isStakeholder =
    isAppOrganizerOrAdmin(app, userId, role) || isAppVolunteerOrAdmin(app, userId, role);
  if (!isStakeholder) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '仅该活动的组织者、对接志愿者、运营或管理员可查看任务');
  }
  const { items } = await feishuClient.listRecords(config.feishu.tables.stageTasks, { pageSize: 200 });
  const tasks = (items as StageTaskRecord[])
    .filter((t) => t.fields.applicationId === id)
    .sort((a, b) => {
      // 按 STAGE_TEMPLATES 顺序排
      const ai = STAGE_TEMPLATES.findIndex((s) => s.stage === normStatus(a.fields.stage));
      const bi = STAGE_TEMPLATES.findIndex((s) => s.stage === normStatus(b.fields.stage));
      return ai - bi;
    })
    .map(serialize);
  return ok(res, { list: tasks, total: tasks.length });
});

// POST /api/applications/:id/tasks/initialize
router.post('/applications/:id/tasks/initialize', authRequired, requireRole('OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params;

  // 找申请
  const records = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    id
  );
  const app = records[0] as any;
  if (!app) return fail(res, 404, ErrorCode.APP_004_NOT_FOUND, '申请不存在');

  const currentStatus = normStatus(app.fields.status);
  if (currentStatus !== 'CONFIRMED' && currentStatus !== 'PREPARING') {
    return fail(res, 400, ErrorCode.BAD_REQUEST, `只有 CONFIRMED/PREPARING 状态可初始化任务，当前 ${currentStatus}`);
  }

  // 检查是否已初始化
  const { items } = await feishuClient.listRecords(config.feishu.tables.stageTasks, { pageSize: 200 });
  const existing = (items as StageTaskRecord[]).filter((t) => t.fields.applicationId === id);
  if (existing.length > 0) {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '已存在任务，请勿重复初始化');
  }

  // 找活动开始时间（v1 简化：从 application 本身读 expectedDate 作为 T）
  // 飞书 datetime 字段返回 ISO 字符串，需要转 ms number
  const expectedDateRaw = app.fields.expectedDate ?? Date.now() + 30 * 24 * 3600 * 1000;
  const expectedDate = typeof expectedDateRaw === 'number'
    ? expectedDateRaw
    : new Date(String(expectedDateRaw)).getTime();
  const assigneeId = app.fields.volunteerId || req.user!.userId;

  const recordIds = await initializeStageTasks(id, assigneeId, expectedDate);

  return ok(res, { applicationId: id, taskIds: recordIds, message: '5 阶段任务已创建' });
});

const submitSchema = z.object({
  // v16.7 Frank 21:19 反馈 Comment 1：上传凭证支持多文件多格式（每行一个 URL，或 JSON 数组）
  // v1 简化：接受任意字符串（前端按 \n 拼成多行）
  proofFile: z.string().max(5000).optional(),  // 单 URL / 多行 URL（\n 分隔） / JSON 数组字符串
  remark: z.string().max(500).optional(),
});

// POST /api/stages/:taskId/submit  - 组织者提交凭证
router.post('/stages/:taskId/submit', authRequired, async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = submitSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.stageTasks,
    'taskId',
    taskId
  );
  const t = records[0] as StageTaskRecord | undefined;
  if (!t) return fail(res, 404, ErrorCode.NOT_FOUND, '任务不存在');

  // v1.2 Frank 27 21:40 反馈：资源所有权检查（org-thu 改 NO.018 bug）
  // v1.3 Frank 27 23:50 TDD 迭代：submit 路由根据 ownerType 选 stakeholder（不是写死组织者）
  //  - ownerType=ORGANIZER → 仅 app.userId（活动组织者本人） + ADMIN/OPERATOR
  //  - ownerType=VOLUNTEER → 仅 app.volunteerId（对接志愿者本人） + ADMIN/OPERATOR
  //  - 这是 volunteer-first 流程的 step1（INT-1/INT-4/REVIEW-3 志愿者先完成）
  const submitAppRecs = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    t.fields.applicationId!
  );
  const submitApp = submitAppRecs[0] as any;
  const submitOwnerType = normStatus(t.fields.ownerType);
  const submitHasStakeholder = submitOwnerType === 'VOLUNTEER'
    ? isAppVolunteerOrAdmin(submitApp, userId, role)
    : isAppOrganizerOrAdmin(submitApp, userId, role);
  if (!submitHasStakeholder) {
    // v1.5: 兼容旧测试 message（保留完整字符串"仅该活动的组织者、运营或管理员"）
    return fail(res, 403, ErrorCode.FORBIDDEN, '仅该活动的组织者、运营或管理员可提交凭证');
  }

  const currentStatus = normStatus(t.fields.status);
  if (currentStatus === 'COMPLETED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '任务已完成');
  }
  if (currentStatus === 'OVERDUE') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '任务已超期，请联系运营');
  }

  // PENDING → IN_PROGRESS；IN_PROGRESS 保持（重复提交）
  const newStatus = currentStatus === 'PENDING' ? 'IN_PROGRESS' : currentStatus;
  const submittedAt = Date.now();
  const organizerSubmittedAt = t.fields.organizerSubmittedAt || submittedAt;  // v10：组织者自核时间

  // v16.8 Frank 11:11 反馈：UNCERTAIN → 运营打回 → 组织者重传 → 旁路志愿者/运营，直接通过
  // 因为志愿者是因为不确定才申请运营介入的，运营打回已经写明理由，组织者都能看见
  // Frank 决定：组织者重传后该子任务直接完成，不再经手志愿者/运营
  const wasUncertainByOperator = normStatus(t.fields.reviewStatus) === 'UNCERTAIN' && normStatus(t.fields.operatorReviewStatus) === 'REJECTED';
  const finalStatus = wasUncertainByOperator ? 'COMPLETED' : newStatus;
  const finalReviewStatus = wasUncertainByOperator ? 'APPROVED' : 'PENDING';
  const finalOperatorReviewStatus = wasUncertainByOperator ? 'APPROVED' : t.fields.operatorReviewStatus;
  const completedAt = wasUncertainByOperator ? Date.now() : undefined;
  const bypassMessage = wasUncertainByOperator
    ? '组织者重传通过（UNCERTAIN 流程 · 运营打回后旁路志愿者/运营）'
    : '组织者自核完成，等待志愿者审核';

  // v16.9 Frank 13:10 + Frank 27 11:20 改：申请时只填模糊，INT-3 双方最终确认时填具体地点 → 写 confirmedAddress
  if (t.fields.subTaskName === '双方最终确认活动方案/时间/地点/规模' && data.remark) {
    try {
      const formData = JSON.parse(data.remark);
      const activityUpdates: Record<string, any> = {};
      if (formData.location) activityUpdates.confirmedAddress = String(formData.location);
      if (formData.scale) activityUpdates.maxParticipants = Number(formData.scale);
      if (formData.date) {
        const startMs = new Date(`${formData.date}T00:00:00+08:00`).getTime();
        const endMs = new Date(`${formData.date}T23:59:59+08:00`).getTime();
        if (!isNaN(startMs)) activityUpdates.startDate = startMs;
        if (!isNaN(endMs)) activityUpdates.endDate = endMs;
      }
      if (formData.timeRange) activityUpdates.startTime = String(formData.timeRange);
      if (Object.keys(activityUpdates).length > 0) {
        // v1.2 Frank 27 21:40：复用前面已查的 submitApp（避免重复 searchRecords）
        const app = submitApp;
        if (app?.fields?.activityId) {
          const actRecords = await feishuClient.searchRecords(
            config.feishu.tables.activities,
            'activityId',
            app.fields.activityId
          );
          const act = actRecords[0] as any;
          if (act) {
            await feishuClient.updateRecord(config.feishu.tables.activities, act.record_id, activityUpdates);
            console.log(`[INT-3] 已同步活动 ${app.fields.activityId} 基本信息：${Object.keys(activityUpdates).join(', ')}`);
          }
        }
      }
    } catch (e) {
      console.warn('[INT-3] formData 解析失败，不更新活动', e);
    }
  }

  await feishuClient.updateRecord(config.feishu.tables.stageTasks, t.record_id, {
    status: finalStatus,
    submittedAt,
    organizerSubmittedAt,  // v10：3 步进度第一步
    proofFile: data.proofFile || t.fields.proofFile,
    remark: data.remark || t.fields.remark,
    // v16.8 Frank 11:11：UNCERTAIN + 运营打回 → 组织者重传直接 APPROVE 旁路
    reviewStatus: finalReviewStatus,
    operatorReviewStatus: finalOperatorReviewStatus,
    ...(completedAt ? { completedAt } : {}),
  });

  // v16.9 Frank 13:54 反馈：组织者提交后通知志愿者审核（之前没打通）
  if (!wasUncertainByOperator) {
    try {
      const appRecords = await feishuClient.searchRecords(
        config.feishu.tables.applications,
        'applicationId',
        t.fields.applicationId!
      );
      const app = appRecords[0] as any;
      if (app) {
        // v16.8 Frank 23:03 反馈：link 跳转到活动详情 + 5 阶段时间轴 + 子任务
        const link = `/activities/${app?.fields?.activityId ?? ''}?stage=${t.fields.stage}&order=${t.fields.order ?? ''}`;
        // 通知对接志愿者（如有）+ 通知所有运营
        if (app.fields.volunteerId) {
          await sendMessage({
            userId: app.fields.volunteerId,
            userName: app.fields.volunteerName ?? '志愿者',
            type: 'STAGE_TASK',
            title: '📥 组织者已提交凭证：' + t.fields.subTaskName,
            content: `活动「${app.fields.activityId}」的组织者已提交子任务「${t.fields.subTaskName}」的凭证，请尽快审核。`,
            link,
          });
        }
      }
    } catch (e) {
      console.error('[notify submit]', e);
    }
  }

  return ok(res, {
    taskId,
    status: finalStatus,
    submittedAt,
    organizerSubmittedAt,
    message: bypassMessage,
  });
});

const reviewSchema = z.object({
  // Frank 2026-08-23 09:17 反馈：加 UNCERTAIN（无法判断），REJECT 时写明原因并消息提醒组织者
  action: z.enum(['APPROVE', 'REJECT', 'UNCERTAIN']),
  reviewRemark: z.string().max(500).optional(),
  excellentOrganizer: z.enum(['Y', 'N']).optional(),  // 仅 REVIEW 阶段用
});

// POST /api/stages/:taskId/review - 志愿者审核（v10：限 VOLUNTEER 角色）
router.post('/stages/:taskId/review', authRequired, requireRole('VOLUNTEER'), async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const reviewerId = req.user!.userId;
  const role = req.user!.role;
  const data = reviewSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.stageTasks,
    'taskId',
    taskId
  );
  const t = records[0] as StageTaskRecord | undefined;
  if (!t) return fail(res, 404, ErrorCode.NOT_FOUND, '任务不存在');

  // v1.2 Frank 27 21:40 反馈：资源所有权检查
  // review 是志愿者操作 → 仅 app.volunteerId（对接志愿者本人） + ADMIN/OPERATOR
  // requireRole(VOLUNTEER) 已挡住 USER/PARTICIPANT；这里再挡"别的活动的志愿者"
  const reviewAppRecs = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    t.fields.applicationId!
  );
  const reviewApp = reviewAppRecs[0] as any;
  if (!isAppVolunteerOrAdmin(reviewApp, reviewerId, role)) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '仅该活动的对接志愿者、运营或管理员可审核');
  }

  const currentStatus = normStatus(t.fields.status);
  if (currentStatus === 'COMPLETED' && data.action === 'APPROVE') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '任务已审核通过');
  }
  if (currentStatus === 'PENDING' && data.action === 'APPROVE') {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '组织者尚未提交凭证');
  }
  if ((data.action === 'REJECT' || data.action === 'UNCERTAIN') && !data.reviewRemark) {
    return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '打回/无法判断需填写原因');
  }
  // v16.8 Frank 22:16 反馈：UNCERTAIN 后志愿者不能再审核（等运营介入）
  const currentReviewStatus = normStatus(t.fields.reviewStatus);
  if (currentReviewStatus === 'UNCERTAIN' && data.action !== 'APPROVE') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '已请求运营介入，请等待运营审核');
  }
  // v16.8 Frank 22:16 反馈：志愿者打回后不能再审核（等组织者重传）
  if (currentReviewStatus === 'REJECTED' && data.action !== 'APPROVE') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '已打回，请等待组织者重新提交');
  }

  const stage = normStatus(t.fields.stage);
  let newStatus = currentStatus;
  let newReviewStatus: string;
  let completedAt: number | undefined;
  let excellentOrganizer: string | undefined;

  if (data.action === 'APPROVE') {
    newStatus = 'COMPLETED';
    newReviewStatus = 'APPROVED';
    completedAt = Date.now();
    // REVIEW 阶段：志愿者可推荐优秀
    if (stage === 'REVIEW' && data.excellentOrganizer) {
      excellentOrganizer = data.excellentOrganizer;
    }
  } else if (data.action === 'REJECT') {
    // v16.7 Frank 21:19 反馈：REJECT 后应回到"组织者上传凭证+自核"状态
    // 重置 organizerSubmittedAt → step1Done=false → 前端按钮重新显示
    newReviewStatus = 'REJECTED';
    newStatus = 'IN_PROGRESS';  // 显式回退到 IN_PROGRESS
  } else {
    // v16.7 Frank 21:19 反馈：UNCERTAIN 持久化显示"已请求运营介入"
    // 不重置 organizerSubmittedAt（组织者无需重传）→ step1Done=true
    newReviewStatus = 'UNCERTAIN';
  }

  // REVIEW 阶段 + 审核通过 → 申请进入 REVIEW_CONFIRMED（v4 修订）
  // 简单实现：写回到 application 状态
  if (stage === 'REVIEW' && data.action === 'APPROVE') {
    const appRecords = await feishuClient.searchRecords(
      config.feishu.tables.applications,
      'applicationId',
      t.fields.applicationId!
    );
    const app = appRecords[0] as any;
    if (app) {
      const newScoreBreakdown = (() => {
        try { return app.fields.scoreBreakdown ? JSON.parse(app.fields.scoreBreakdown) : {}; } catch { return {}; }
      })();
      newScoreBreakdown.auditLog = newScoreBreakdown.auditLog || [];
      newScoreBreakdown.auditLog.push({
        action: 'VOLUNTEER_REVIEW_APPROVED',
        reviewerId,
        stage: 'REVIEW',
        at: Date.now(),
        excellentOrganizer,
      });
      await feishuClient.updateRecord(config.feishu.tables.applications, app.record_id, {
        status: 'REVIEW_CONFIRMED',
        scoreBreakdown: JSON.stringify(newScoreBreakdown),
        ...(excellentOrganizer ? { excellentOrganizer } : {}),
      });
    }
  }

  await feishuClient.updateRecord(config.feishu.tables.stageTasks, t.record_id, {
    status: newStatus,
    reviewStatus: newReviewStatus,
    reviewerId,
    reviewRemark: data.reviewRemark,
    // v16.7 Frank 21:19 反馈：REJECT 时清空 organizerSubmittedAt（让前端按钮重新显示）
    // + 清空 proofFile（让组织者重新上传）
    // UNCERTAIN 时不动（组织者无需重传）
    ...(data.action === 'REJECT' ? { organizerSubmittedAt: null, proofFile: null } : {}),
    ...(completedAt ? { completedAt } : {}),
  });

  // v6：审核通过后尝试解锁下一阶段
  let unlockedTasks: string[] = [];
  if (data.action === 'APPROVE') {
    try {
      unlockedTasks = await unlockNextStage(t.fields.applicationId!, stage);
    } catch (e) {
      console.error('[unlockNextStage]', e);
    }
  }

  // Frank 2026-08-23 09:17 反馈：REJECT 通知组织者重新上传；UNCERTAIN 通知运营介入
  // v16.3 Frank 11:13 反馈：APPROVE 也通知（组织者看到审核通过）
  if (data.action === 'APPROVE' || data.action === 'REJECT' || data.action === 'UNCERTAIN') {
    try {
      // 查该任务所属的申请
      const appRecords = await feishuClient.searchRecords(
        config.feishu.tables.applications,
        'applicationId',
        t.fields.applicationId!
      );
      const app = appRecords[0] as any;
      // v16.8 Frank 23:03 反馈：跳转到活动详情 + 5 阶段时间轴 + 子任务（带 stage + order 参数）
      const link = `/activities/${app?.fields?.activityId ?? ''}?stage=${t.fields.stage}&order=${t.fields.order ?? ''}`;

      if (data.action === 'APPROVE' && app) {
        // v16.3：志愿者审核通过 → 通知组织者
        await sendMessage({
          userId: app.fields.userId,
          userName: app.fields.organizerName,
          type: 'STAGE_TASK',
          title: '✅ 志愿者已审核通过：' + t.fields.subTaskName,
          content: `志愿者已审核通过你的子任务「${t.fields.subTaskName}」，等待运营复核。`,
          link,
        });
        // 通知所有运营可以开始复核
        const userRecords = await feishuClient.listRecords(config.feishu.tables.users, { pageSize: 200 });
        const operators = (userRecords.items as any[]).filter(
          (u) => {
            const r = Array.isArray(u.fields.role) ? u.fields.role[0] : u.fields.role;
            return r === 'OPERATOR' || r === 'ADMIN';
          }
        );
        for (const op of operators) {
          await sendMessage({
            userId: op.fields.userId,
            userName: op.fields.name,
            type: 'STAGE_TASK',
            title: '🔔 等待运营复核：' + t.fields.subTaskName,
            content: `志愿者已审核通过子任务「${t.fields.subTaskName}」，请运营复核。\n\n活动：${app.fields.activityId}\n申请：${app.fields.applicationId}`,
            link,
          });
        }
      } else if (data.action === 'REJECT' && app) {
        // v16.8 Frank 22:55 反馈：组织者 + 志愿者都收到通知
        await sendMessage({
          userId: app.fields.userId,
          userName: app.fields.organizerName,
          type: 'STAGE_TASK',
          title: '⚠️ 志愿者打回：' + t.fields.subTaskName,
          content: `志愿者已将子任务「${t.fields.subTaskName}」打回，请重新上传该阶段子任务的证明材料。\n\n打回原因：${data.reviewRemark}`,
          link,
        });
        // 通知对接志愿者
        if (app.fields.volunteerId) {
          await sendMessage({
            userId: app.fields.volunteerId,
            userName: app.fields.volunteerName ?? '志愿者',
            type: 'STAGE_TASK',
            title: '⚠️ 志愿者打回：' + t.fields.subTaskName,
            content: `你已将子任务「${t.fields.subTaskName}」打回，请等待组织者重新上传。\n\n打回原因：${data.reviewRemark}`,
            link,
          });
        }
      } else if (data.action === 'UNCERTAIN') {
        // 通知所有运营/管理员介入
        const userRecords = await feishuClient.listRecords(config.feishu.tables.users, { pageSize: 200 });
        const operators = (userRecords.items as any[]).filter(
          (u) => {
            const r = Array.isArray(u.fields.role) ? u.fields.role[0] : u.fields.role;
            return r === 'OPERATOR' || r === 'ADMIN';
          }
        );
        for (const op of operators) {
          await sendMessage({
            userId: op.fields.userId,
            userName: op.fields.name,
            type: 'STAGE_TASK',
            title: '🔍 志愿者无法判断：' + t.fields.subTaskName,
            content: `志愿者对子任务「${t.fields.subTaskName}」无法判断，请运营介入审批。\n\n原因：${data.reviewRemark}\n\n审核志愿者：${reviewerId}`,
            link,
          });
        }
        // v16.8 Frank 22:55 反馈：组织者也应该收到"无法判断"通知
        if (app && app.fields.userId) {
          await sendMessage({
            userId: app.fields.userId,
            userName: app.fields.organizerName,
            type: 'STAGE_TASK',
            title: '🔍 志愿者无法判断：' + t.fields.subTaskName,
            content: `志愿者对子任务「${t.fields.subTaskName}」无法判断，已请求运营介入。\n\n原因：${data.reviewRemark}`,
            link,
          });
        }
      }
    } catch (e) {
      console.error('[notify review]', e);
    }
  }

  return ok(res, {
    taskId,
    stage,
    action: data.action,
    newStatus,
    newReviewStatus,
    unlockedTasks,
    ...(excellentOrganizer ? { excellentOrganizer } : {}),
    message: data.action === 'APPROVE' ? '审核通过' : data.action === 'REJECT' ? '已打回' : '已请求运营介入',
  });
});

// v1.5 Frank 28 07:57 反馈：审核流程
//  - 正常 2 步：组织者 submit → 志愿者 APPROVE 完成 / REJECT 回组织者
//  - UNCERTAIN 旁路 3 步：组织者 submit → 志愿 UNCERTAIN（无法判断） → 运营 APPROVE 完成 / REJECT 回组织者
// operator-review **仅在 UNCERTAIN 旁路**才允许调（v1.5 限制）
//  - reviewStatus=APPROVED：志愿已通过，无需复核
//  - reviewStatus=REJECTED：志愿已打回，任务回退到 step1，无需复核
//  - reviewStatus=UNCERTAIN：等运营介入，可以 APPROVE/REJECT
// operator-review APPROVE UNCERTAIN 时把 status 推到 COMPLETED + reviewStatus 推到 APPROVED（让阶段解锁）
// operator-review REJECT UNCERTAIN 时重置 organizerSubmittedAt（让组织者重传）
const operatorReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  operatorReviewRemark: z.string().max(500).optional(),
});

// POST /api/stages/:taskId/operator-review  - 运营最终复核（仅 UNCERTAIN 旁路）
router.post('/stages/:taskId/operator-review', authRequired, requireRole('OPERATOR', 'ADMIN'), async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const operatorReviewerId = req.user!.userId;
  const data = operatorReviewSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.stageTasks,
    'taskId',
    taskId
  );
  const t = records[0] as StageTaskRecord | undefined;
  if (!t) return fail(res, 404, ErrorCode.NOT_FOUND, '任务不存在');

  // 校验：组织者必须先自核
  if (!t.fields.organizerSubmittedAt) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '组织者尚未自核，无法运营复核');
  }
  // v16.8 Frank 22:16 反馈：运营审核完成后不能再复核
  const currentOpStatus = normStatus(t.fields.operatorReviewStatus);
  if (currentOpStatus === 'APPROVED' || currentOpStatus === 'REJECTED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '运营已审核完成，无需重复复核');
  }
  // v1.5 Frank 28 反馈：仅 UNCERTAIN 旁路才允许运营复核
  //  - 正常 2 步：志愿 APPROVE 任务已完成，运营无需复核
  //  - 正常 2 步：志愿 REJECT 任务回退到 step1，运营无需复核
  const currentReviewStatus = normStatus(t.fields.reviewStatus);
  if (currentReviewStatus === 'APPROVED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '志愿已审核通过，任务已完成，无需运营复核');
  }
  if (currentReviewStatus === 'REJECTED') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '志愿已打回，任务已回退到 step1，无需运营复核');
  }
  if (currentReviewStatus !== 'UNCERTAIN' && currentReviewStatus !== 'PENDING') {
    return fail(res, 400, ErrorCode.BAD_REQUEST, `仅 UNCERTAIN 旁路才需要运营复核（当前 reviewStatus=${currentReviewStatus}）`);
  }
  // 校验：REJECT 需填写原因
  if (data.action === 'REJECT' && !data.operatorReviewRemark) {
    return fail(res, 400, ErrorCode.APP_001_MISSING_FIELD, '打回需填写原因');
  }

  const operatorReviewedAt = Date.now();
  const operatorReviewStatus = data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  // v1.5 Frank 28 反馈：UNCERTAIN 旁路时运营 APPROVE → 把 task.status 推到 COMPLETED + reviewStatus 推到 APPROVED
  // （让阶段解锁逻辑 isStageFullyCompleted 能识别 task 完成）
  const isUncertainPath = currentReviewStatus === 'UNCERTAIN';
  const pushTaskComplete = data.action === 'APPROVE' && isUncertainPath;

  await feishuClient.updateRecord(config.feishu.tables.stageTasks, t.record_id, {
    operatorReviewerId,
    operatorReviewedAt,
    operatorReviewStatus,
    operatorReviewRemark: data.operatorReviewRemark,
    // v1.5 UNCERTAIN 旁路：APPROVE 时把 task.status → COMPLETED + reviewStatus → APPROVED
    ...(pushTaskComplete ? { status: 'COMPLETED', reviewStatus: 'APPROVED' } : {}),
    // v16.8 Frank 22:55 反馈：运营打回后组织者重新上传（重置 step1Done）
    // + 清空 proofFile（让组织者重新上传）
    ...(data.action === 'REJECT' ? { organizerSubmittedAt: null, proofFile: null } : {}),
  });

  // v16.3 Frank 11:13 反馈：运营复核通过 → 通知组织者 + 志愿者
  if (data.action === 'APPROVE') {
    try {
      const appRecords = await feishuClient.searchRecords(
        config.feishu.tables.applications,
        'applicationId',
        t.fields.applicationId!
      );
      const app = appRecords[0] as any;
      // v16.8 Frank 23:03 反馈：跳转到活动详情 + 5 阶段时间轴 + 子任务
      const link = `/activities/${app?.fields?.activityId ?? ''}?stage=${t.fields.stage}&order=${t.fields.order ?? ''}`;
      if (app) {
        // 通知组织者
        await sendMessage({
          userId: app.fields.userId,
          userName: app.fields.organizerName,
          type: 'STAGE_TASK',
          title: '✅✓ 运营已复核通过：' + t.fields.subTaskName,
          content: `子任务「${t.fields.subTaskName}」已通过运营复核，本子任务全部完成！\n\n本阶段其他子任务完成后，可解锁下一阶段。`,
          link,
        });
        // 通知对接志愿者
        if (app.fields.volunteerId) {
          await sendMessage({
            userId: app.fields.volunteerId,
            userName: app.fields.volunteerName ?? '志愿者',
            type: 'STAGE_TASK',
            title: '✅ 运营已复核：' + t.fields.subTaskName,
            content: `你审核过的子任务「${t.fields.subTaskName}」已通过运营复核。`,
            link,
          });
        }
      }
    } catch (e) {
      console.error('[notify operator review]', e);
    }
  } else if (data.action === 'REJECT') {
    // 运营打回 → 通知组织者 + 志愿者（v16.8 Frank 22:55 反馈）
    try {
      const appRecords = await feishuClient.searchRecords(
        config.feishu.tables.applications,
        'applicationId',
        t.fields.applicationId!
      );
      const app = appRecords[0] as any;
      // v16.8 Frank 23:03 反馈：跳转到活动详情 + 5 阶段时间轴 + 子任务
      const link = `/activities/${app?.fields?.activityId ?? ''}?stage=${t.fields.stage}&order=${t.fields.order ?? ''}`;
      if (app) {
        await sendMessage({
          userId: app.fields.userId,
          userName: app.fields.organizerName,
          type: 'STAGE_TASK',
          title: '⚠️ 运营打回：' + t.fields.subTaskName,
          content: `运营已将子任务「${t.fields.subTaskName}」打回，请重新上传。\n\n打回原因：${data.operatorReviewRemark ?? '（无）'}`,
          link,
        });
        // 通知对接志愿者（v16.8 Frank 22:55 反馈：志愿者也应该看到）
        if (app.fields.volunteerId) {
          await sendMessage({
            userId: app.fields.volunteerId,
            userName: app.fields.volunteerName ?? '志愿者',
            type: 'STAGE_TASK',
            title: '⚠️ 运营打回：' + t.fields.subTaskName,
            content: `运营已将子任务「${t.fields.subTaskName}」打回，组织者将重新上传。\n\n打回原因：${data.operatorReviewRemark ?? '（无）'}`,
            link,
          });
        }
      }
    } catch (e) {
      console.error('[notify operator reject]', e);
    }
  }

  return ok(res, {
    taskId,
    action: data.action,
    operatorReviewerId,
    operatorReviewedAt,
    operatorReviewStatus,
    message: data.action === 'APPROVE' ? '运营复核通过' : '运营已打回',
  });
});

// v16.7 Frank 16:44 反馈：组织者确认结果（志愿者先完成后，组织者 confirm）
// 适用子任务（3 个）：INT-1 互加飞书好友 / INT-4 飞书日历 / REVIEW 志愿者审核+可推荐优秀
// 端点限 ORGANIZER/ASSISTANT/ADMIN 角色
// 复用 reviewStatus 字段 + reviewerId（存组织者 userId）+ 新增 organizerConfirmedAt
const organizerConfirmSchema = z.object({
  organizerReviewRemark: z.string().max(500).optional(),
  action: z.enum(['APPROVE', 'REJECT']).default('APPROVE'),
});

router.post('/stages/:taskId/organizer-confirm', authRequired, requireRole('ORGANIZER', 'ASSISTANT', 'ADMIN'), async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const organizerReviewerId = req.user!.userId;
  const role = req.user!.role;
  const data = organizerConfirmSchema.parse(req.body);

  const records = await feishuClient.searchRecords(
    config.feishu.tables.stageTasks,
    'taskId',
    taskId
  );
  const t = records[0] as StageTaskRecord | undefined;
  if (!t) return fail(res, 404, ErrorCode.NOT_FOUND, '任务不存在');

  // v1.2 Frank 27 21:40 反馈：资源所有权检查
  // organizer-confirm 是组织者操作 → 仅 app.userId（活动组织者本人） + ADMIN
  // requireRole 已挡住 VOLUNTEER/PARTICIPANT；这里再挡"别的活动的 ORGANIZER"
  const confirmAppRecs = await feishuClient.searchRecords(
    config.feishu.tables.applications,
    'applicationId',
    t.fields.applicationId!
  );
  const confirmApp = confirmAppRecs[0] as any;
  if (!isAppOrganizerOrAdmin(confirmApp, organizerReviewerId, role)) {
    return fail(res, 403, ErrorCode.FORBIDDEN, '仅该活动的组织者或管理员可确认');
  }

  const step1Done = !!t.fields.organizerSubmittedAt;
  if (!step1Done) {
    return fail(res, 400, ErrorCode.BAD_REQUEST, '志愿者尚未完成 step1 自核（organizerSubmittedAt 为空）');
  }

  const currentReviewStatus = normStatus(t.fields.reviewStatus);
  if (currentReviewStatus === 'APPROVED' && data.action === 'APPROVE') {
    return fail(res, 409, ErrorCode.BAD_REQUEST, '组织者已确认通过');
  }

  const newReviewStatus = data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const currentStatus = normStatus(t.fields.status);
  const newStatus = (data.action === 'APPROVE' && currentStatus !== 'COMPLETED') ? 'COMPLETED' : currentStatus;
  const completedAt = data.action === 'APPROVE' ? Date.now() : undefined;

  await feishuClient.updateRecord(config.feishu.tables.stageTasks, t.record_id, {
    status: newStatus,
    reviewStatus: newReviewStatus,
    reviewerId: organizerReviewerId,  // v16.7：组织者作为 reviewer
    organizerReviewRemark: data.organizerReviewRemark,
    organizerConfirmedAt: Date.now(),  // v16.7：组织者确认时间（飞书 base 字段）
    ...(completedAt ? { completedAt } : {}),
  });

  // v16.7：APPROVE 后尝试解锁下一阶段
  let unlockedTasks: string[] = [];
  if (data.action === 'APPROVE') {
    try {
      const stage = normStatus(t.fields.stage);
      unlockedTasks = await unlockNextStage(t.fields.applicationId!, stage);
    } catch (e) {
      console.error('[unlockNextStage]', e);
    }
  }

  return ok(res, {
    taskId,
    action: data.action,
    reviewStatus: newReviewStatus,
    organizerReviewerId,
    unlockedTasks,
    message: data.action === 'APPROVE' ? '组织者已确认通过' : '组织者已打回',
  });
});

export default router;
