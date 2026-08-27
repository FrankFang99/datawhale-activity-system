/**
 * 凭证规范 v3.0（v1.2 Frank 27 简化版）
 * - 删 proofType（v16.6 引入的 confirm/form/image/mixed/volunteer-first）
 * - 删 proofCategories（凭证分类）
 * - 标签按原来设置（v9 Frank 23:35 之前）：只显示 ownerType（志愿者/组织者/运营）
 * - 保留 whatToDo（操作步骤）+ passCriteria（通过标准）
 */
import { describe, it, expect } from 'vitest';
import { CREDENTIAL_SPECS, findCredentialSpec } from './stageCredentialSpec';

describe('凭证规范 · 19 个 spec 数据完整性（v1.2 Frank 27）', () => {
  it('所有 spec 有 matchName（字符级跟 8-25 后端 SUBTASK_TEMPLATES 一致）', () => {
    expect(CREDENTIAL_SPECS.every((s) => s.matchName && s.matchName.length > 0)).toBe(true);
  });

  it('CREDENTIAL_SPECS 数量 = 19（跟 8-25 后端 SUBTASK_TEMPLATES 一致）', () => {
    expect(CREDENTIAL_SPECS.length).toBe(19);
  });

  it('所有 spec 都有 whatToDo（操作步骤）和 passCriteria（通过标准）', () => {
    CREDENTIAL_SPECS.forEach((s) => {
      expect(s.whatToDo.length).toBeGreaterThan(0);
      expect(s.passCriteria.length).toBeGreaterThan(0);
    });
  });
});

describe('凭证规范 · 关键子任务验证（v1.2 Frank 27）', () => {
  it('INTENT 1 互加飞书好友有 3 步操作 + 3 条通过标准', () => {
    const spec = findCredentialSpec('志愿者和组织者互加飞书好友');
    expect(spec?.whatToDo.length).toBe(3);
    expect(spec?.passCriteria.length).toBe(3);
  });

  it('INTENT 3 双方最终确认活动方案有完整必填/选填区分', () => {
    const spec = findCredentialSpec('双方最终确认活动方案/时间/地点/规模');
    expect(spec?.whatToDo.some((s) => s.includes('必填'))).toBe(true);
  });

  it('RECRUIT 4 启动本地招募宣传有截图类 + 链接类两种凭证类型', () => {
    const spec = findCredentialSpec('启动本地招募宣传（公众号/朋友圈/群转发）');
    expect(spec?.passCriteria.some((c) => c.includes('截图类'))).toBe(true);
    expect(spec?.passCriteria.some((c) => c.includes('链接类'))).toBe(true);
  });

  it('REVIEW 3 志愿者审核作品有"优秀"标记要求', () => {
    const spec = findCredentialSpec('志愿者审核作品+反馈+可推荐优秀');
    expect(spec?.passCriteria.some((c) => c.includes('优秀'))).toBe(true);
  });
});

describe('findCredentialSpec 查找函数', () => {
  it('找不到时返回 undefined（不抛错）', () => {
    expect(findCredentialSpec('不存在的子任务名')).toBeUndefined();
  });
  it('undefined 输入返回 undefined', () => {
    expect(findCredentialSpec(undefined)).toBeUndefined();
  });
  it('空字符串输入返回 undefined', () => {
    expect(findCredentialSpec('')).toBeUndefined();
  });
});
