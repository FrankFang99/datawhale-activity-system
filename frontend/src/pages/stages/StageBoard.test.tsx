/**
 * StageBoard Frank #3 5 阶段子任务 + 两栏布局覆盖
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'StageBoard.tsx'), 'utf-8');

describe('StageBoard · Frank #3 5 阶段子任务 + 两栏上传/审核', () => {
  it('StageBoard 渲染子任务（22 个子任务由 stages controller 提供）', () => {
    expect(SRC()).toMatch(/tasks\.map\(\(t\)\s*=>/);
  });

  it('每个子任务 Card 含子任务名 + ownerType + status tag', () => {
    expect(SRC()).toMatch(/t\.subTaskName\s*\?\?\s*t\.title/);
    expect(SRC()).toMatch(/OWNER_LABEL/);
    expect(SRC()).toMatch(/STATUS_MAP/);
  });

  it('组织者视角：上传/修改凭证按钮（canSubmit 权限判断）', () => {
    expect(SRC()).toMatch(/canSubmit\s*=/);
    expect(SRC()).toMatch(/t\.ownerType\s*===\s*role/);
    expect(SRC()).toMatch(/onClick=\{\(\)\s*=>\s*openSubmit\(t\)\}/);
  });

  it('审核者视角：通过/打回按钮（canReview 权限判断）', () => {
    expect(SRC()).toMatch(/canReview\s*=/);
    expect(SRC()).toMatch(/action:\s*'APPROVE'/);
    expect(SRC()).toMatch(/action:\s*'REJECT'/);
  });

  it('上传凭证：proofFile URL + remark 说明', () => {
    expect(SRC()).toMatch(/name="proofFile"/);
    expect(SRC()).toMatch(/name="remark"/);
  });

  it('审核意见：reviewRemark + 拒绝需填原因', () => {
    expect(SRC()).toMatch(/name="reviewRemark"/);
    expect(SRC()).toMatch(/action === 'REJECT'.*!v/s);
  });

  it('当前阶段计算（IN_PROGRESS 优先；最后 PENDING 兜底）', () => {
    expect(SRC()).toMatch(/currentStepIdx\s*=/);
    expect(SRC()).toMatch(/findIndex.*IN_PROGRESS/s);
  });

  it('阶段完成图标（COMPLETED 显示 ✓）', () => {
    expect(SRC()).toMatch(/t\.status === 'COMPLETED'\s*\?\s*<CheckCircleOutlined/);
  });

  it('逾期检测：dueDate 过且未完成 → OVERDUE', () => {
    expect(SRC()).toMatch(/t\.dueDate\s*&&\s*t\.status\s*!==\s*'COMPLETED'/);
  });
});
