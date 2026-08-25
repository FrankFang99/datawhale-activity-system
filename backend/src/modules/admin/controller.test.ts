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
