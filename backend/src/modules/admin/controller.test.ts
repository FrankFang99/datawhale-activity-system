/**
 * admin controller 关键逻辑覆盖（v9 续 Frank #6 + #11 · TDD）
 * 飞书相关（searchRecords/updateRecord/import stages）通过 e2e 验证
 * 本测试只覆盖 source 层关键调用 + 路由
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('admin controller · Frank #6 APPROVE 时自动升级 user role', () => {
  it('approve 路由调 feishuClient.searchRecords 查 user 表', () => {
    const s = SRC();
    expect(s).toMatch(/feishuClient\.searchRecords\([\s\S]*?config\.feishu\.tables\.users/);
  });

  it('APPROVE 后如果 user role = USER 或 PARTICIPANT → updateRecord role: ORGANIZER', () => {
    const s = SRC();
    // Frank 2026-08-21 升级：检查 USER 或 PARTICIPANT
    expect(s).toMatch(/\[['"\s,]*USER['"]\s*,\s*['"]PARTICIPANT['"]\s*,\s*['"]['"]\]\.includes\(currentRole\)/);
    expect(s).toMatch(/role:\s*['"]ORGANIZER['"]/);
  });

  it('自动升级日志加 [AUTO-PROMOTE] tag', () => {
    const s = SRC();
    expect(s).toMatch(/\[AUTO-PROMOTE\]/);
  });
});

describe('admin controller · Frank #11 APPROVE 时自动初始化 5 阶段任务', () => {
  it('APPROVE 调 import stages controller.initializeStageTasks', () => {
    const s = SRC();
    expect(s).toMatch(/import\(['"]\.\.\/stages\/controller['"]\)/);
    expect(s).toMatch(/initializeStageTasks\(/);
  });

  it('自动初始化前先查 activity 拿 startDate', () => {
    const s = SRC();
    expect(s).toMatch(/config\.feishu\.tables\.activities/);
    expect(s).toMatch(/startDate/);
  });

  it('兜底：活动 startDate 拿不到 → now + 30 天', () => {
    const s = SRC();
    expect(s).toMatch(/Date\.now\(\)\s*\+\s*30\s*\*\s*24\s*\*\s*3600\s*\*\s*1000/);
  });

  it('自动初始化日志加 [STAGE-INIT] tag', () => {
    const s = SRC();
    expect(s).toMatch(/\[STAGE-INIT\]/);
  });
});

describe('admin controller · 关键路由', () => {
  it('POST /:id/approve', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/:id\/approve['"]/);
  });
  it('POST /:id/review-confirm', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/:id\/review-confirm['"]/);
  });
  it('POST /:id/draft-review', () => {
    expect(SRC()).toMatch(/router\.post\(['"]\/:id\/draft-review['"]/);
  });
  it('GET /:id/audit-log', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/:id\/audit-log['"]/);
  });
  it('GET /:id', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/:id['"]/);
  });
  it('GET /volunteers', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/volunteers['"]/);
  });
});

describe('admin controller · Frank #3 23:35 申请者收件人消息 link', () => {
  it('APPROVE 消息 link = /my-applications（申请者收件人，修复 #3 跳转报错）', () => {
    const s = SRC();
    expect(s).toMatch(/link:\s*['"]\/my-applications['"]/);
  });

  it('REVIEW_CONFIRM 消息 link 也是 /my-applications', () => {
    const s = SRC();
    expect(s).toMatch(/link:\s*['"]\/my-applications['"]/);
  });
});

// Frank 27 19:27 反馈：活动管理页加"志愿者配置"按钮（v3）
describe('admin controller · 活动管理页志愿者配置', () => {
  it('GET /by-activity/:activityId 路由存在', () => {
    expect(SRC()).toMatch(/router\.get\(['"]\/by-activity\/:activityId['"]/);
  });
  it('GET /by-activity/:activityId 限 ADMIN/OPERATOR', () => {
    const s = SRC();
    // 直接字符串查找路由声明行（避免 regex 把注释里的路径当路由）
    const routeIdx = s.indexOf("router.get('/by-activity/:activityId'");
    expect(routeIdx).toBeGreaterThan(0);
    // requireRole 在路由声明的同一行（authRequired, requireRole, async）
    const slice = s.slice(routeIdx, routeIdx + 200);
    expect(slice).toMatch(/requireRole\(['"]ADMIN['"]\s*,\s*['"]OPERATOR['"]\)/);
  });
});

describe('admin controller · v1.2 Frank 27 21:40 资源所有权检查（权限漏洞修复）', () => {
  it('import isAppStakeholderOrAdmin from utils/ownership', () => {
    expect(SRC()).toMatch(/import\s*\{\s*isAppStakeholderOrAdmin\s*\}\s*from\s*['"]\.\.\/\.\.\/utils\/ownership['"]/);
  });

  it('GET /:id 路由加 stakeholder check（stakeholder + admin/operator 通过）', () => {
    const s = SRC();
    const getIdx = s.search(/router\.get\(['"]\/:id['"]/);
    const after = s.slice(getIdx, getIdx + 3000);
    expect(after).toMatch(/isAppStakeholderOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
  });

  it('GET /:id/audit-log 路由加 stakeholder check', () => {
    const s = SRC();
    const getIdx = s.search(/router\.get\(['"]\/:id\/audit-log['"]/);
    const after = s.slice(getIdx, getIdx + 2000);
    expect(after).toMatch(/isAppStakeholderOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
  });

  it('POST /:id/draft-review 路由加 stakeholder check', () => {
    const s = SRC();
    const draftIdx = s.search(/router\.post\(['"]\/:id\/draft-review['"]/);
    const after = s.slice(draftIdx, draftIdx + 2000);
    expect(after).toMatch(/isAppStakeholderOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
  });

  it('POST /:id/approve 路由 CONFIRMED 时自动写 organizerId 到活动表（兜底兼容：仅当为空时写）', () => {
    const s = SRC();
    const approveIdx = s.search(/router\.post\(['"]\/:id\/approve['"]/);
    const after = s.slice(approveIdx, approveIdx + 4000);
    expect(after).toMatch(/newStatus === ['"]CONFIRMED['"]/);
    expect(after).toMatch(/organizerId:\s*a\.fields\.userId/);
    // 兼容：仅当 organizerId 为空时才写，避免覆盖已分配的组织者
    expect(after).toMatch(/!currentOrgId/);
  });
});
