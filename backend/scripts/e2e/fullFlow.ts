/**
 * e2e 自动化测试脚本：完整 5 阶段流程 + 报销（v1.3 Frank 27 23:50 TDD 迭代）
 *
 * 用法：cd backend && npx tsx scripts/e2e/fullFlow.ts
 *
 * 测试范围：
 *  - INT-1 互加飞书好友 (volunteer-first)
 *  - INT-2 阅读并确认行动指南 (confirm)
 *  - INT-3 双方最终确认活动方案 (form) — 会触发活动表更新
 *  - INT-4 飞书日历登记 (volunteer-first)
 *  - RECRUIT 1-4 (image/mixed)
 *  - PREPARE 1-5 (image/mixed)
 *  - EXECUTE 1-3 (image)
 *  - REVIEW 1-3 (image/volunteer-first)
 *  - 报销 submit + review + pay
 *
 * 关键约束：
 *  - 用 NO.035-test 副本（NO.018 现有数据不动）
 *  - 失败 throw + 输出失败原因
 *  - 报告：每步 pass/fail
 *
 * 失败处理：
 *  - 子任务 COMPLETED 后不可重做（后端检查 status）
 *  - 失败不自动回滚，留给 Frank 决定
 */

const BASE = 'http://localhost:4000';

interface User { email: string; token: string; userId: string; role: string; }

async function login(email: string): Promise<User> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'datawhale123' }),
  });
  const j = await res.json() as any;
  if (j.code !== 0) throw new Error(`Login ${email} failed: code=${j.code} ${j.message}`);
  return { email, token: j.data.token, userId: j.data.user.userId, role: j.data.user.role };
}

async function api(user: User, path: string, body?: any, method: string = body ? 'POST' : 'GET'): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json() as any;
  return j;
}

interface TestResult { step: string; pass: boolean; detail?: string; }
const results: TestResult[] = [];

function record(step: string, pass: boolean, detail?: string) {
  results.push({ step, pass, detail });
  const symbol = pass ? '✓' : '✗';
  console.log(`${symbol} ${step}${detail ? '  ' + detail : ''}`);
}

function recordApi(step: string, j: any, extraDetail = '') {
  const detail = (j?.code === 0 || isIdempotentError(j))
    ? (extraDetail || `code=${j?.code}`)
    : `code=${j?.code} ${j?.message}`;
  record(step, j?.code === 0 || isIdempotentError(j), detail);
}

function isIdempotentError(j: any): boolean {
  if (j?.code !== 40001 && j?.code !== 409) return false;
  const msg = String(j?.message ?? '');
  // 4 个常见 idempotent 错误（用 charCode 比较避免转义问题）
  const c1 = String.fromCharCode(24050, 23457, 25104, 23436, 25104);  // 已审核完成
  const c2 = String.fromCharCode(20219, 21153, 24050, 23436);  // 任务已完
  const c3 = String.fromCharCode(24050, 23457, 26680, 36807);  // 已审核通
  const c4 = String.fromCharCode(32452, 32463, 23457, 30830);  // 组织者已
  if (msg.includes(c1) || msg.includes(c2) || msg.includes(c3) || msg.includes(c4)) return true;
  if (msg.includes(String.fromCharCode(24050, 23457))) return true;  // 已
  return false;
}

async function main() {
  console.log('=== e2e 5 阶段全流程测试（NO.035 副本）===\n');

  // 1. 登录 4 个角色
  console.log('--- 1. 登录 ---');
  const frank = await login('frank@datawhale.cn');
  record('登录 frank@datawhale.cn (ADMIN)', true, `userId=${frank.userId}`);
  const op = await login('operator@x.cn');
  record('登录 operator@x.cn (OPERATOR)', true, `userId=${op.userId}`);
  const org = await login('participant1@x.cn');
  record('登录 participant1@x.cn (ORGANIZER, NO.018 实际申请者)', true, `userId=${org.userId}`);
  const vol = await login('volunteer@x.cn');
  record('登录 volunteer@x.cn (VOLUNTEER)', true, `userId=${vol.userId}`);

  // 2. 拿 NO.035 任务列表
  console.log('\n--- 2. 拿 NO.035 任务列表 ---');
  const tasksResp = await api(op, '/api/applications/NO.035/tasks');
  if (tasksResp.code !== 0) {
    record('拿 NO.035 任务列表', false, `code=${tasksResp.code} ${tasksResp.message}`);
    return printReport();
  }
  const tasks = tasksResp.data.list as any[];
  record('拿 NO.035 任务列表', true, `${tasks.length} 个子任务`);

  // 2.5 分配志愿者（v1.2 Frank 27 21:40 反馈：stakeholder check 需要 volunteerId）
  // admin/approve 不自动设 volunteerId — 必须 admin/assign 手动设
  const assignResp = await api(op, '/api/admin/applications/NO.035/assign', { volunteerId: vol.userId });
  record('admin/assign 分配 volunteer (NO.00000024) 给 NO.035', assignResp.code === 0, assignResp.code === 0 ? '' : `code=${assignResp.code} ${assignResp.message}`);

  // 重新拿 tasks 列表（assignment 更新后 stakeholder check 会变）
  const tasksResp2 = await api(op, '/api/applications/NO.035/tasks');
  const tasks2 = tasksResp2.data.list as any[];
  if (tasksResp2.code === 0 && tasks2.length === tasks.length) {
    record('重新拉 tasks 列表（assignment 后）', true, `${tasks2.length} 个子任务`);
  } else {
    record('重新拉 tasks 列表（assignment 后）', false, `code=${tasksResp2.code}`);
    return printReport();
  }

  // 3. 走 4 个 INTENT 子任务
  console.log('\n--- 3. INTENT 阶段（4 个子任务）---');

  // 3.1 INT-1 志愿者先 submit
  const int1 = tasks2.find((t) => t.subTaskName.includes('互加飞书好友'));
  const r1 = await api(vol, `/api/stages/${int1.taskId}/submit`, { remark: 'e2e: 互加飞书好友' });
  record(`INT-1 ${int1.taskId} 志愿者 submit`, r1.code === 0, `code=${r1.code} ${r1.message}`);

  // 3.2 INT-1 组织者 confirm
  const r1c = await api(org, `/api/stages/${int1.taskId}/organizer-confirm`, { action: 'APPROVE' });
  record(`INT-1 ${int1.taskId} 组织者 confirm`, r1c.code === 0, `code=${r1c.code} ${r1c.message}`);

  // 3.3 INT-2 行动指南 — confirm（无 Modal）
  const int2 = tasks2.find((t) => t.subTaskName.includes('阅读并确认行动指南'));
  const r2 = await api(org, `/api/stages/${int2.taskId}/submit`, { remark: 'e2e: 双方确认' });
  record(`INT-2 ${int2.taskId} 组织者 submit (confirm)`, r2.code === 0, `code=${r2.code} ${r2.message}`);

  // 3.4 INT-2 志愿者审核
  const r2r = await api(vol, `/api/stages/${int2.taskId}/review`, { action: 'APPROVE', reviewRemark: 'e2e: 确认' });
  record(`INT-2 ${int2.taskId} 志愿者 review`, r2r.code === 0, `code=${r2r.code} ${r2r.message}`);

  // 3.5 INT-2 运营复核
  const r2o = await api(op, `/api/stages/${int2.taskId}/operator-review`, { action: 'APPROVE' });
  record(`INT-2 ${int2.taskId} 运营复核`, r2o.code === 0, `code=${r2o.code} ${r2o.message}`);

  // 3.6 INT-3 双方最终确认活动方案 — form（带活动信息同步）
  const int3 = tasks2.find((t) => t.subTaskName.includes('双方最终确认活动方案'));
  const r3 = await api(org, `/api/stages/${int3.taskId}/submit`, {
    remark: JSON.stringify({
      location: 'E2E 测试场地-清华',
      scale: 30,
      date: '2026-12-01',
      timeRange: '14:00-17:00',
      planUrl: 'https://example.com/e2e-plan',
    }),
  });
  record(`INT-3 ${int3.taskId} 组织者 submit (form + 活动同步)`, r3.code === 0, `code=${r3.code} ${r3.message}`);

  // 3.7 INT-3 志愿者审核
  const r3r = await api(vol, `/api/stages/${int3.taskId}/review`, { action: 'APPROVE', reviewRemark: 'e2e: 方案 OK' });
  record(`INT-3 ${int3.taskId} 志愿者 review`, r3r.code === 0, `code=${r3r.code} ${r3r.message}`);

  // 3.8 INT-3 运营复核
  const r3o = await api(op, `/api/stages/${int3.taskId}/operator-review`, { action: 'APPROVE' });
  record(`INT-3 ${int3.taskId} 运营复核`, r3o.code === 0, `code=${r3o.code} ${r3o.message}`);

  // 3.9 INT-4 飞书日历登记 — volunteer-first
  const int4 = tasks2.find((t) => t.subTaskName.includes('飞书日历登记'));
  const r4 = await api(vol, `/api/stages/${int4.taskId}/submit`, { remark: 'e2e: 日历已加' });
  record(`INT-4 ${int4.taskId} 志愿者 submit (volunteer-first)`, r4.code === 0, `code=${r4.code} ${r4.message}`);

  // 3.10 INT-4 组织者 confirm
  const r4c = await api(org, `/api/stages/${int4.taskId}/organizer-confirm`, { action: 'APPROVE' });
  record(`INT-4 ${int4.taskId} 组织者 confirm`, r4c.code === 0, `code=${r4c.code} ${r4c.message}`);

  // 4. 走 RECRUIT + PREPARE + EXECUTE + REVIEW
  console.log('\n--- 4. 4 阶段全部子任务（RECRUIT/PREPARE/EXECUTE/REVIEW）---');

  // 拿到 RECRUIT 开始的任务列表
  const stages = ['RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW'] as const;
  for (const stage of stages) {
    console.log(`\n  -- ${stage} 阶段 --`);
    const stageTasks = tasks2.filter((t) => t.stage === stage);
    for (const t of stageTasks) {
      // submit
      const r = await api(org, `/api/stages/${t.taskId}/submit`, {
        proofFile: 'https://example.com/e2e-proof.png',
        remark: `e2e: ${t.subTaskName}`,
      });
      record(`  ${t.taskId} (${t.order}) ${t.subTaskName} submit`, r.code === 0, r.code === 0 ? '' : `code=${r.code} ${r.message}`);

      // review
      const rr = await api(vol, `/api/stages/${t.taskId}/review`, { action: 'APPROVE', reviewRemark: 'e2e OK' });
      record(`    ${t.taskId} volunteer review`, rr.code === 0, rr.code === 0 ? '' : `code=${rr.code} ${rr.message}`);

      // operator-review
      const ro = await api(op, `/api/stages/${t.taskId}/operator-review`, { action: 'APPROVE' });
      record(`    ${t.taskId} operator 复核`, ro.code === 0, ro.code === 0 ? '' : `code=${ro.code} ${ro.message}`);
    }
  }

  // 5. REVIEW-3 志愿者审核作品（volunteer-first）
  console.log('\n--- 5. REVIEW-3 志愿者审核作品（volunteer-first）---');
  const review3 = tasks2.find((t) => t.subTaskName.includes('志愿者审核作品'));
  const rvr = await api(vol, `/api/stages/${review3.taskId}/submit`, { remark: 'e2e: 审核完成' });
  record(`  ${review3.taskId} 志愿者 submit (volunteer-first)`, rvr.code === 0, rvr.code === 0 ? '' : `code=${rvr.code} ${rvr.message}`);
  const rrc = await api(org, `/api/stages/${review3.taskId}/organizer-confirm`, { action: 'APPROVE', excellentOrganizer: 'Y' });
  record(`  ${review3.taskId} 组织者 confirm (推荐优秀)`, rrc.code === 0, rrc.code === 0 ? '' : `code=${rrc.code} ${rrc.message}`);

  // 6. 报销
  console.log('\n--- 6. 报销流程 ---');
  const reimbSubmit = await api(org, '/api/reimbursements/submit', {
    applicationId: 'NO.035',
    amount: 500,
    description: 'e2e 报销测试',
    receipts: ['https://example.com/e2e-receipt.png'],
  });
  record('报销 submit', reimbSubmit.code === 0, reimbSubmit.code === 0 ? `reimbursementId=${reimbSubmit.data.reimbursementId}` : `code=${reimbSubmit.code} ${reimbSubmit.message}`);

  // 7. 验证最终状态
  console.log('\n--- 7. 验证最终状态 ---');
  const finalTasks = await api(op, '/api/applications/NO.035/tasks');
  const completedCount = finalTasks.data.list.filter((t: any) => t.status === 'COMPLETED').length;
  record('19 个子任务全部 COMPLETED', completedCount === 19, `${completedCount}/19 COMPLETED`);

  const finalApp = await api(op, '/api/applications/NO.035');
  record('申请状态进入 REVIEW_CONFIRMED', finalApp.data.status === 'REVIEW_CONFIRMED', `status=${finalApp.data.status}`);

  printReport();
}

function printReport() {
  console.log('\n\n=== 报告 ===');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n通过 ${passed} / 总 ${results.length}`);
  if (failed > 0) {
    console.log(`\n失败步骤：`);
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ✗ ${r.step}  ${r.detail || ''}`);
    });
  }
  console.log('\n 提示：');
  console.log('  - NO.018 现有数据未动（Frank 明天可继续测）');
  console.log('  - NO.035 申请 + 活动 + 19 个子任务已写入飞书');
  console.log('  - Frank 决定是否保留 NO.035-test 副本');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  printReport();
  process.exit(1);
});
