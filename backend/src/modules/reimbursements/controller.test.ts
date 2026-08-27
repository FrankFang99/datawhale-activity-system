/**
 * reimbursements controller 单测（v1.2 Frank 27 21:40 反馈：资源所有权检查）
 *
 * Frank 21:40 反馈：org-thu 能改 NO.018 报销。修复：
 * POST /reimbursements/:id/review 加 stakeholder check
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'controller.ts'), 'utf-8');

describe('reimbursements controller · v1.2 Frank 27 21:40 资源所有权检查', () => {
  it('import isAppVolunteerOrAdmin from utils/ownership', () => {
    expect(SRC()).toMatch(/import\s*\{\s*isAppVolunteerOrAdmin\s*\}\s*from\s*['"]\.\.\/\.\.\/utils\/ownership['"]/);
  });

  it('POST /reimbursements/:id/review 路由加 volunteer check（仅 app.volunteerId + admin/operator）', () => {
    const s = SRC();
    const reviewIdx = s.search(/router\.post\(['"]\/reimbursements\/:id\/review['"]/);
    const after = s.slice(reviewIdx, reviewIdx + 3000);
    expect(after).toMatch(/isAppVolunteerOrAdmin/);
    expect(after).toMatch(/ErrorCode\.FORBIDDEN/);
    expect(after).toMatch(/仅该申请的运营、对接志愿者或管理员/);
  });

  it('review 检查先查 application（用 reimbursement 的 applicationId）', () => {
    const s = SRC();
    const reviewIdx = s.search(/router\.post\(['"]\/reimbursements\/:id\/review['"]/);
    const after = s.slice(reviewIdx, reviewIdx + 3000);
    expect(after).toMatch(/r\.fields\.applicationId/);
    expect(after).toMatch(/config\.feishu\.tables\.applications/);
  });
});
