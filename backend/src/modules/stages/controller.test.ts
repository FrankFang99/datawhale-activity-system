/**
 * stages controller 单测（v10 · TDD · PRD §5.4.4 三步进度 · 2026-08-22）
 *
 * Frank 14:35 反馈"5 阶段可点击 + 3 步进度（组织者自核 → 志愿者审核 → 运营复核）"
 * 覆盖：三步进度字段、运营复核新接口、权限分离
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('stages controller · 3 步进度字段（v10）', () => {
  it('submit 路由写 organizerSubmittedAt（组织者自核）', () => {
    const s = SRC();
    // submit POST /stages/:taskId/submit 路由的 updateRecord 调用里包含 organizerSubmittedAt
    expect(s).toMatch(/organizerSubmittedAt/);
  });

  it('serialize 输出 organizerSubmittedAt 字段', () => {
    const s = SRC();
    expect(s).toMatch(/organizerSubmittedAt:\s*t\.fields\.organizerSubmittedAt/);
  });

  it('serialize 输出 4 个新字段（组织者自核 + 运营复核）', () => {
    const s = SRC();
    const expected = [
      'organizerSubmittedAt',
      'operatorReviewerId',
      'operatorReviewedAt',
      'operatorReviewStatus',
      'operatorReviewRemark',
    ];
    for (const f of expected) {
      expect({ field: f, found: s.includes(f) }).toEqual({ field: f, found: true });
    }
  });
});

describe('stages controller · 运营复核新接口（v10）', () => {
  it('POST /stages/:taskId/operator-review 路由存在', () => {
    const s = SRC();
    expect(s).toMatch(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
  });

  it('operator-review 路由限 OPERATOR/ADMIN 角色', () => {
    const s = SRC();
    // 找 router.post 包含 /operator-review 的行
    const lines = s.split('\n');
    const routeLine = lines.find((l) => /router\.post/.test(l) && l.includes('/operator-review'));
    expect(routeLine).toBeTruthy();
    expect(routeLine).toMatch(/['"]OPERATOR['"]/);
    expect(routeLine).toMatch(/['"]ADMIN['"]/);
  });

  it('operator-review action schema 接受 APPROVE/REJECT', () => {
    const s = SRC();
    // 找 operatorReviewSchema 定义位置（schema 在 route 之前定义）
    const schemaIdx = s.search(/operatorReviewSchema\s*=\s*z\.object/);
    expect(schemaIdx).toBeGreaterThan(0);
    const slice = s.slice(schemaIdx, schemaIdx + 500);
    expect(slice).toMatch(/z\.enum\(\[\s*['"]APPROVE['"]\s*,\s*['"]REJECT['"]\s*\]\)/);
  });

  it('v12 review action schema 加 UNCERTAIN（Frank 09:17 反馈"无法判断"）', () => {
    const s = SRC();
    // reviewSchema 包含 UNCERTAIN
    expect(s).toMatch(/z\.enum\(\[\s*['"]APPROVE['"]\s*,\s*['"]REJECT['"]\s*,\s*['"]UNCERTAIN['"]\s*\]\)/);
  });

  it('v12 review UNCERTAIN 触发消息通知（消息类型 STAGE_TASK）', () => {
    const s = SRC();
    // UNCERTAIN 路由块内调 sendMessage
    const reviewIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    const slice = s.slice(reviewIdx, reviewIdx + 6000);
    expect(slice).toMatch(/sendMessage\s*\(/);
    // UNCERTAIN 分支包含 OPERATOR|ADMIN 过滤
    expect(slice).toMatch(/['"]OPERATOR['"]\s*\|\|\s*r\s*===\s*['"]ADMIN['"]/);
  });

  it('v12 REJECT 触发消息通知给组织者（userId 来自 app.fields.userId）', () => {
    const s = SRC();
    const reviewIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    const slice = s.slice(reviewIdx, reviewIdx + 6000);
    expect(slice).toMatch(/app\.fields\.userId/);
    expect(slice).toMatch(/志愿者打回/);
  });

  it('operator-review 写 4 个字段（reviewer/At/Status/Remark）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 2500);
    expect(slice).toMatch(/operatorReviewerId/);
    expect(slice).toMatch(/operatorReviewedAt/);
    expect(slice).toMatch(/operatorReviewStatus/);
    expect(slice).toMatch(/operatorReviewRemark/);
  });

  it('operator-review REJECT 需填写原因', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 2500);
    expect(slice).toMatch(/打回需填写原因/);
  });
});

describe('stages controller · v16.7 organizer-confirm 端点（Frank 16:44 反馈）', () => {
  it('POST /stages/:taskId/organizer-confirm 路由存在', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/stages\/:taskId\/organizer-confirm['"]/);
  });

  it('organizer-confirm 路由限 ORGANIZER/ASSISTANT/ADMIN 角色', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/organizer-confirm['"]/);
    const line = s.split('\n')[s.slice(0, routeIdx).split('\n').length - 1];
    expect(line).toMatch(/requireRole/);
    expect(line).toMatch(/ORGANIZER/);
    expect(line).toMatch(/ASSISTANT/);
    expect(line).toMatch(/ADMIN/);
  });

  it('organizer-confirm 写 reviewStatus=APPROVED + reviewerId + organizerConfirmedAt', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/organizer-confirm['"]/);
    const slice = s.slice(routeIdx, routeIdx + 2500);
    expect(slice).toMatch(/reviewStatus/);
    expect(slice).toMatch(/APPROVED/);
    expect(slice).toMatch(/reviewerId/);
    expect(slice).toMatch(/organizerConfirmedAt/);
  });

  it('organizer-confirm 校验 step1Done（志愿者未完成不能 confirm）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/organizer-confirm['"]/);
    const slice = s.slice(routeIdx, routeIdx + 2500);
    expect(slice).toMatch(/step1Done/);
    expect(slice).toMatch(/志愿者尚未完成/);
  });

  it('organizer-confirm APPROVE 触发 unlockNextStage', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/organizer-confirm['"]/);
    const slice = s.slice(routeIdx, routeIdx + 3500);
    expect(slice).toMatch(/unlockNextStage/);
  });
});

describe('stages controller · v16.7 REJECT/UNCERTAIN 持久化（Frank 21:19 反馈）', () => {
  it('REJECT 时重置 organizerSubmittedAt + proofFile（让组织者重新上传）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    // v1.2 Frank 27 21:40 加资源所有权检查后路由变长，slice 范围 4000 → 7000
    const slice = s.slice(routeIdx, routeIdx + 7000);
    expect(slice).toMatch(/organizerSubmittedAt: null/);
    expect(slice).toMatch(/proofFile: null/);
  });

  it('REJECT 时回退 status 到 IN_PROGRESS', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    // 扩大 slice 范围 + 用更精确的 } else if 匹配（避免命中前置校验的 `|| data.action === 'REJECT'`）
    const slice = s.slice(routeIdx, routeIdx + 4000);
    const rejectIdx = slice.search(/\}\s*else\s*if\s*\(data\.action === ['"]REJECT['"]\)/);
    expect(rejectIdx).toBeGreaterThan(-1);
    const after = slice.slice(rejectIdx, rejectIdx + 800);
    expect(after).toMatch(/IN_PROGRESS/);
  });

  it('UNCERTAIN 时不重置 organizerSubmittedAt（组织者无需重传）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 4000);
    // 找 UNCERTAIN 分支的 updateRecord 块
    const uncertainIdx = slice.search(/newReviewStatus = ['"]UNCERTAIN['"]/);
    const after = slice.slice(uncertainIdx, uncertainIdx + 1200);
    // UNCERTAIN 不应清空 organizerSubmittedAt
    expect(after).not.toMatch(/organizerSubmittedAt: null/);
  });

  it('submit schema 升级：proofFile 接受 max 5000 字符（多行 URL）', () => {
    expect(SRC()).toMatch(/proofFile: z\.string\(\)\.max\(5000\)\.optional\(\)/);
  });
});

describe('stages controller · v16.8 Frank 11:11 UNCERTAIN 旁路逻辑', () => {
  it('submit 端点：UNCERTAIN + 运营 REJECTED → 组织者重传直接 APPROVE 完成', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    const slice = s.slice(routeIdx, routeIdx + 4000);
    // 找 UNCERTAIN + operatorReviewStatus REJECTED 的判断
    expect(slice).toMatch(/wasUncertainByOperator/);
    expect(slice).toMatch(/UNCERTAIN/);
    expect(slice).toMatch(/APPROVED/);
    expect(slice).toMatch(/COMPLETED/);
  });

  it('submit 端点：非 UNCERTAIN 流程走原 PENDING 路径', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    const slice = s.slice(routeIdx, routeIdx + 4000);
    // 非 UNCERTAIN 流程 → finalReviewStatus='PENDING'
    expect(slice).toMatch(/finalReviewStatus\s*=\s*wasUncertainByOperator\s*\?\s*['"]APPROVED['"]\s*:\s*['"]PENDING['"]/);
  });

  it('submit 端点：UNCERTAIN 旁路时 operatorReviewStatus 也清成 APPROVED', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    // v1.2 Frank 27 21:40 加资源所有权检查 + INT-3 复用 submitApp 后路由变长，slice 4000 → 6000
    const slice = s.slice(routeIdx, routeIdx + 6000);
    expect(slice).toMatch(/operatorReviewStatus: finalOperatorReviewStatus/);
  });
});

describe('stages controller · v16.8 状态保护（Frank 22:16 反馈）', () => {
  it('review 端点：UNCERTAIN 后志愿者不能再调（除了 APPROVE）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 2000);
    // 找 UNCERTAIN 校验
    expect(slice).toMatch(/currentReviewStatus === ['"]UNCERTAIN['"]/);
    expect(slice).toMatch(/已请求运营介入，请等待运营审核/);
  });

  it('review 端点：REJECTED 后志愿者不能再调（等组织者重传）', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 2000);
    expect(slice).toMatch(/currentReviewStatus === ['"]REJECTED['"]/);
    expect(slice).toMatch(/已打回，请等待组织者重新提交/);
  });

  it('operator-review 端点：APPROVED/REJECTED 后运营不能再复核', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 1500);
    expect(slice).toMatch(/currentOpStatus === ['"]APPROVED['"]/);
    expect(slice).toMatch(/currentOpStatus === ['"]REJECTED['"]/);
    expect(slice).toMatch(/运营已审核完成/);
  });
});

describe('stages controller · v16.8 运营打回重传 + 通知志愿者（Frank 22:55 反馈）', () => {
  it('operator-review REJECT 时重置 organizerSubmittedAt + proofFile', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 4000);
    expect(slice).toMatch(/organizerSubmittedAt: null/);
    expect(slice).toMatch(/proofFile: null/);
  });

  it('operator-review REJECT 通知组织者 + 志愿者', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
    const slice = s.slice(routeIdx, routeIdx + 4000);
    // 找 REJECT 通知块
    const rejectIdx = slice.search(/data\.action === ['"]REJECT['"]/);
    const after = slice.slice(rejectIdx, rejectIdx + 2500);
    expect(after).toMatch(/app\.fields\.volunteerId/);
    expect(after).toMatch(/app\.fields\.userId/);
  });

  it('所有 review/operator-review link 跳转到 /activities/{id}（活动详情 5 阶段）', () => {
    const s = SRC();
    // 不应再有 /applications/...tasks 链接
    expect(s).not.toMatch(/link\s*=\s*`\/applications\/\$\{t\.fields\.applicationId\}\/tasks`/);
    // 应该有 /activities/{activityId} 链接
    expect(s).toMatch(/link\s*=\s*`\/activities\/\$\{app\?\.fields\?\.activityId/);
  });

  it('review UNCERTAIN 通知运营 + 组织者', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    // 找 UNCERTAIN 分支的 } else if (用更精确的正则)
    const uncertainIdx = s.indexOf("} else if (data.action === 'UNCERTAIN')", routeIdx);
    expect(uncertainIdx).toBeGreaterThan(-1);
    const after = s.slice(uncertainIdx, uncertainIdx + 2500);
    expect(after).toMatch(/app\.fields\.userId/);
  });

  it('review REJECT 通知组织者 + 志愿者', () => {
    const s = SRC();
    const routeIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    // 找 REJECT 分支的 } else if (用更精确的正则)
    const rejectIdx = s.indexOf("} else if (data.action === 'REJECT' && app)", routeIdx);
    expect(rejectIdx).toBeGreaterThan(-1);
    const after = s.slice(rejectIdx, rejectIdx + 2500);
    expect(after).toMatch(/app\.fields\.volunteerId/);
  });
});

describe('stages controller · 权限分离（v10）', () => {
  it('review 路由仅限 VOLUNTEER 角色（不再 OPERATOR/ADMIN）', () => {
    const s = SRC();
    // 找到 /review 路由所在的行
    const lines = s.split('\n');
    let inReviewRoute = false;
    let reviewLine = '';
    for (const line of lines) {
      if (line.includes("/stages/:taskId/review'") || line.includes('/stages/:taskId/review"')) {
        inReviewRoute = true;
        reviewLine = line;
      }
    }
    expect(inReviewRoute).toBe(true);
    expect(reviewLine).toMatch(/['"]VOLUNTEER['"]/);
    // 不应包含 OPERATOR/ADMIN
    expect(reviewLine).not.toMatch(/['"]OPERATOR['"]/);
    expect(reviewLine).not.toMatch(/['"]ADMIN['"]/);
  });

  it('submit 路由不要求特定角色（任意已登录用户可自核）', () => {
    const s = SRC();
    const lines = s.split('\n');
    let submitLine = '';
    for (const line of lines) {
      if (line.includes("/stages/:taskId/submit'") || line.includes('/stages/:taskId/submit"')) {
        submitLine = line;
      }
    }
    // submit 只需要 authRequired，不强制角色
    expect(submitLine).toMatch(/authRequired/);
    expect(submitLine).not.toMatch(/requireRole/);
  });
});

describe('stages controller · v16.9 Frank 13:10 反馈 INT-3 自动同步活动', () => {
  it('submit 端点检测 subTaskName="双方最终确认活动方案/时间/地点/规模" 触发活动同步', () => {
    expect(SRC()).toMatch(/双方最终确认活动方案\/时间\/地点\/规模/);
  });
  it('解析 remark 字段的 JSON formData（date/timeRange/location/scale）', () => {
    expect(SRC()).toMatch(/JSON\.parse\(data\.remark\)/);
  });
  it('同步 4 个活动字段：confirmedAddress + maxParticipants + startDate + endDate（Frank 27 11:20：精确地址写到 confirmedAddress）', () => {
    expect(SRC()).toMatch(/activityUpdates\.confirmedAddress\s*=\s*String\(formData\.location\)/);
    expect(SRC()).toMatch(/activityUpdates\.maxParticipants\s*=\s*Number\(formData\.scale\)/);
    expect(SRC()).toMatch(/activityUpdates\.startDate\s*=\s*startMs/);
    expect(SRC()).toMatch(/activityUpdates\.endDate\s*=\s*endMs/);
  });
  it('通过 applicationId 找 application，再通过 activityId 找 activity（2 步 searchRecords）', () => {
    // 简化检测：searchRecords 调用 ≥ 2 次（application + activity）
    const submitFn = SRC().match(/router\.post\(['"]\/stages\/:taskId\/submit['"][\s\S]*?\n\}\);/);
    expect(submitFn).not.toBeNull();
    const matches = (submitFn![0].match(/feishuClient\.searchRecords/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });
});

describe('stages controller · 路由清单（v10）', () => {
  it('包含 submit 路由', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
  });
  it('包含 review 路由', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
  });
  it('包含 operator-review 路由（v10 新增）', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/stages\/:taskId\/operator-review['"]/);
  });
});

describe('stages controller · v16.9 Frank 13:54 反馈 submit 端点通知志愿者', () => {
  it('submit 端点写完 stage_task 后给对接志愿者发消息（组织者提交 → 志愿者知道要审核）', () => {
    const s = SRC();
    const submitIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    // 截取 submit 路由完整函数体（到下一个 router.post/put 结束）
    const after = s.slice(submitIdx, submitIdx + 8000);
    expect(after).toMatch(/sendMessage\s*\(/);
    expect(after).toMatch(/app\.fields\.volunteerId/);
    expect(after).toMatch(/组织者已提交凭证/);
  });
  it('UNCERTAIN 旁路流程不重复发消息（已 APPROVED 不需要再通知）', () => {
    const s = SRC();
    const submitIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    const after = s.slice(submitIdx, submitIdx + 8000);
    // wasUncertainByOperator 分支包裹 sendMessage
    expect(after).toMatch(/if\s*\(!wasUncertainByOperator\)/);
  });
  it('submit 通知 link 跳活动详情（与 review/operator-review 一致）', () => {
    const s = SRC();
    const submitIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    const after = s.slice(submitIdx, submitIdx + 8000);
    expect(after).toMatch(/link\s*=\s*`\/activities\/\$\{app\?\.fields\?\.activityId/);
  });
});

describe('stages controller · v1.2 Frank 27 21:40 资源所有权检查（权限漏洞修复）', () => {
  it('顶部定义 isAppOrganizerOrAdmin + isAppVolunteerOrAdmin helper 函数', () => {
    const s = SRC();
    expect(s).toMatch(/function\s+isAppOrganizerOrAdmin\s*\(/);
    expect(s).toMatch(/function\s+isAppVolunteerOrAdmin\s*\(/);
  });

  it('GET /applications/:id/tasks 路由加 stakeholder check（org + volunteer + admin）', () => {
    const s = SRC();
    const getIdx = s.search(/router\.get\(['"]\/applications\/:id\/tasks['"]/);
    const after = s.slice(getIdx, getIdx + 3000);
    expect(after).toMatch(/isAppOrganizerOrAdmin/);
    expect(after).toMatch(/isAppVolunteerOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
    expect(after).toMatch(/仅该活动的组织者、对接志愿者、运营或管理员/);
  });

  it('POST /stages/:taskId/submit 路由加 organizer check（仅 app.userId + admin/operator）', () => {
    const s = SRC();
    const submitIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/submit['"]/);
    const after = s.slice(submitIdx, submitIdx + 3000);
    expect(after).toMatch(/isAppOrganizerOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
    expect(after).toMatch(/仅该活动的组织者、运营或管理员/);
  });

  it('POST /stages/:taskId/review 路由加 volunteer check（仅 app.volunteerId + admin/operator）', () => {
    const s = SRC();
    const reviewIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/review['"]/);
    const after = s.slice(reviewIdx, reviewIdx + 3000);
    expect(after).toMatch(/isAppVolunteerOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
    expect(after).toMatch(/仅该活动的对接志愿者、运营或管理员/);
  });

  it('POST /stages/:taskId/organizer-confirm 路由加 organizer check（仅 app.userId + admin）', () => {
    const s = SRC();
    const confirmIdx = s.search(/router\.post\(['"]\/stages\/:taskId\/organizer-confirm['"]/);
    const after = s.slice(confirmIdx, confirmIdx + 3000);
    expect(after).toMatch(/isAppOrganizerOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
    expect(after).toMatch(/仅该活动的组织者或管理员/);
  });
});
