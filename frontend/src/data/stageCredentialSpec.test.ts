/**
 * 凭证规范 v2.0 覆盖
 * - v16.6 Frank 16:04：confirm / form / image / mixed 4 种 proofType
 * - v16.7 Frank 16:44：加 volunteer-first（INT-1/INT-4/REVIEW）
 * - v16.9 Frank 13:54：EXECUTE 1 现场签到与引导 从 volunteer-first 回归 image（组织者提交 + 志愿者审核）
 */
import { describe, it, expect } from 'vitest';
import { CREDENTIAL_SPECS, findCredentialSpec } from './stageCredentialSpec';

describe('凭证规范 · 4 种基础 proofType（v16.6 Frank 16:04）', () => {
  it('INT-1 互加飞书好友 → volunteer-first（v16.7）', () => {
    const spec = findCredentialSpec('志愿者和组织者互加飞书好友');
    expect(spec?.proofType).toBe('volunteer-first');
  });
  it('INT-3 双方最终确认活动方案 → form（v16.6 Comment 4）', () => {
    const spec = findCredentialSpec('双方最终确认活动方案/时间/地点/规模');
    expect(spec?.proofType).toBe('form');
  });
  it('RECRUIT 1 建活动群聊 → image（v16.6 Comment 7）', () => {
    const spec = findCredentialSpec('建活动群聊');
    expect(spec?.proofType).toBe('image');
  });
  it('REVIEW 3 志愿者审核作品 → volunteer-first（v16.7）', () => {
    const spec = findCredentialSpec('志愿者审核作品+反馈+可推荐优秀');
    expect(spec?.proofType).toBe('volunteer-first');
  });
});

describe('凭证规范 · v16.9 Frank 13:54 EXECUTE 1 回归 3 步流程', () => {
  it('EXECUTE 1 现场签到与引导 → image（不是 volunteer-first）', () => {
    const spec = findCredentialSpec('现场签到与引导');
    expect(spec?.proofType).toBe('image');
  });
  it('EXECUTE 1 passCriteria 不含"志愿者先确认 + 组织者后确认"（3 步流程，无 volunteer-first 描述）', () => {
    const spec = findCredentialSpec('现场签到与引导');
    expect(spec?.passCriteria?.some((c) => c.includes('志愿者先确认'))).toBeFalsy();
    expect(spec?.passCriteria?.some((c) => c.includes('组织者后确认'))).toBeFalsy();
  });
});

describe('凭证规范 · CREDENTIAL_SPECS 数据完整性', () => {
  it('所有 spec 有 matchName（用于 findCredentialSpec 匹配）', () => {
    expect(CREDENTIAL_SPECS.every((s) => s.matchName && s.matchName.length > 0)).toBe(true);
  });
  it('5 种 proofType 都用上（confirm/form/image/mixed/volunteer-first）', () => {
    const types = new Set(CREDENTIAL_SPECS.map((s) => s.proofType).filter(Boolean));
    expect(types.has('confirm')).toBe(true);
    expect(types.has('form')).toBe(true);
    expect(types.has('image')).toBe(true);
    expect(types.has('mixed')).toBe(true);
    expect(types.has('volunteer-first')).toBe(true);
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
