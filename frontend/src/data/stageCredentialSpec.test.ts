/**
 * 凭证规范 v3.0（v1.2 Frank 27 简化版 + v1.3 Frank 27 23:50 TDD 迭代）
 * - v1.2 删 proofType（v16.6 引入的 confirm/form/image/mixed/volunteer-first）
 * - v1.3 恢复 proofCategories（凭证分类）— 8 个子任务加分类
 * - v1.3 加 getButtonType(subTaskName) — 不引 proofType 字段，按 subTaskName 字符串匹配
 * - 标签按原来设置（v9 Frank 23:35 之前）：只显示 ownerType（志愿者/组织者/运营）
 * - 保留 whatToDo（操作步骤）+ passCriteria（通过标准）
 */
import { describe, it, expect } from 'vitest';
import { CREDENTIAL_SPECS, findCredentialSpec, getButtonType } from './stageCredentialSpec';

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

describe('v1.3 凭证分类 proofCategories（Frank 27 23:50 TDD 迭代）', () => {
  it('建活动群聊有 3 类凭证（微信群二维码/飞书群/QQ 群）', () => {
    const spec = findCredentialSpec('建活动群聊');
    expect(spec?.proofCategories?.length).toBe(3);
    expect(spec?.proofCategories?.[0]).toContain('微信群');
    expect(spec?.proofCategories?.[1]).toContain('飞书群');
    expect(spec?.proofCategories?.[2]).toContain('QQ 群');
  });

  it('视觉物料有 4 类凭证（旗帜/海报/横幅/手举牌 PNG）', () => {
    const spec = findCredentialSpec('定制视觉物料（海报/横幅/手举牌）');
    expect(spec?.proofCategories?.length).toBe(4);
    expect(spec?.proofCategories?.[0]).toContain('旗帜');
    expect(spec?.proofCategories?.[3]).toContain('手举牌');
  });

  it('启动本地招募宣传有 2 类凭证（截图类 + 链接类）', () => {
    const spec = findCredentialSpec('启动本地招募宣传（公众号/朋友圈/群转发）');
    expect(spec?.proofCategories?.length).toBe(2);
    expect(spec?.proofCategories?.[0]).toContain('截图类');
    expect(spec?.proofCategories?.[1]).toContain('链接类');
  });

  it('确认场地有 3 类凭证（精确地址/使用时段/现场图片）', () => {
    const spec = findCredentialSpec('确认场地并上传场地信息');
    expect(spec?.proofCategories?.length).toBe(3);
    expect(spec?.proofCategories?.[0]).toContain('精确地址');
    expect(spec?.proofCategories?.[2]).toContain('现场图片');
  });

  it('准备现场物料有 4 类凭证（接收/打印/任务卡/PPT）', () => {
    const spec = findCredentialSpec('准备现场物料（接收/打印/任务卡PPT）');
    expect(spec?.proofCategories?.length).toBe(4);
    expect(spec?.proofCategories?.[0]).toContain('接收');
    expect(spec?.proofCategories?.[3]).toContain('PPT');
  });

  it('提交宣传推文有 2 类凭证（截图类 + 链接类）', () => {
    const spec = findCredentialSpec('提交宣传推文');
    expect(spec?.proofCategories?.length).toBe(2);
  });

  it('参与者上传作品有 2 类凭证（作品墙截图 + 徽章认证截图）', () => {
    const spec = findCredentialSpec('参与者上传作品/申请的认证');
    expect(spec?.proofCategories?.length).toBe(2);
    expect(spec?.proofCategories?.[0]).toContain('作品墙');
    expect(spec?.proofCategories?.[1]).toContain('徽章');
  });

  it('采集现场素材有 2 类凭证（横版高清/社媒）· v1.9.27 删视频分类', () => {
    const spec = findCredentialSpec('采集现场素材（横版高清）');
    expect(spec?.proofCategories?.length).toBe(2);
  });

  it('总共有 8 个子任务有 proofCategories（v1.9.27 删视频只影响 EXECUTE-3 proofCategories 数量，不影响 subTask 总数）', () => {
    const withCategories = CREDENTIAL_SPECS.filter((s) => s.proofCategories && s.proofCategories.length > 0);
    expect(withCategories.length).toBe(8);
  });
});

describe('v1.3 关键超链接恢复（Frank 27 23:50 TDD 迭代）', () => {
  it('视觉物料有 Canva 旗帜/海报模板超链接', () => {
    const spec = findCredentialSpec('定制视觉物料（海报/横幅/手举牌）');
    const text = spec?.whatToDo.join(' ') ?? '';
    expect(text).toContain('Canva');
    expect(text).toContain('canva.cn');
  });

  it('准备现场物料有任务卡 wiki 链接（6 个任务卡）', () => {
    const spec = findCredentialSpec('准备现场物料（接收/打印/任务卡PPT）');
    const text = spec?.whatToDo.join(' ') ?? '';
    expect(text).toContain('简历优化');
    expect(text).toContain('活动策划案');
    expect(text).toContain('学习计划');
    expect(text).toContain('公众号推文');
    expect(text).toContain('社团招新');
    expect(text).toContain('数据分析');
    // wiki 锚点
    expect(text).toContain('datawhaler.feishu.cn/wiki');
  });

  it('准备现场物料有 5m×0.7m 横幅 Canva 模板链接', () => {
    const spec = findCredentialSpec('准备现场物料（接收/打印/任务卡PPT）');
    const text = spec?.whatToDo.join(' ') ?? '';
    expect(text).toContain('5m × 0.7m');
    expect(text).toContain('Canva');
  });
});

describe('v1.3 getButtonType（Frank 27 23:50 TDD 迭代：ownerType + subTaskName 双重判断）', () => {
  it('INT-2 行动指南 → confirm 按钮（"我已确认"）', () => {
    expect(getButtonType('阅读并确认行动指南', 'ORGANIZER')).toBe('confirm');
  });

  it('INT-3 双方最终确认 → form 按钮（"填写活动方案"）', () => {
    expect(getButtonType('双方最终确认活动方案/时间/地点/规模', 'ORGANIZER')).toBe('form');
  });

  it('INT-1 互加飞书好友 (ownerType=VOLUNTEER) → volunteer-first 按钮', () => {
    expect(getButtonType('志愿者和组织者互加飞书好友', 'VOLUNTEER')).toBe('volunteer-first');
  });

  it('INT-1 互加飞书好友 但没传 ownerType → image 按钮（防御性 fallback）', () => {
    expect(getButtonType('志愿者和组织者互加飞书好友')).toBe('image');
  });

  it('INT-4 飞书日历 (ownerType=VOLUNTEER) → volunteer-first 按钮', () => {
    expect(getButtonType('飞书日历登记活动', 'VOLUNTEER')).toBe('volunteer-first');
  });

  it('EXECUTE 2 主题分享 (ownerType=ORGANIZER) → image 按钮（不是 volunteer-first）', () => {
    // v1 时代 stageCredentialSpec 写错了 volunteer-first，但后端 SUBTASK_TEMPLATES ownerType=ORGANIZER
    // 修复：v1.3 用 ownerType 双重判断，EXECUTE 2 走 3 步进度
    expect(getButtonType('主题分享+带教演示+实操+闪电分享', 'ORGANIZER')).toBe('image');
  });

  it('REVIEW-3 志愿者审核 (ownerType=VOLUNTEER) → volunteer-first 按钮', () => {
    expect(getButtonType('志愿者审核作品+反馈+可推荐优秀', 'VOLUNTEER')).toBe('volunteer-first');
  });

  it('RECRUIT 启动本地招募 → mixed 按钮（截图+链接分类）', () => {
    expect(getButtonType('启动本地招募宣传（公众号/朋友圈/群转发）', 'ORGANIZER')).toBe('mixed');
  });

  it('RECRUIT 复制专题 → confirm 按钮（"我已确认"）', () => {
    expect(getButtonType('复制专题并发布报名表单', 'ORGANIZER')).toBe('confirm');
  });

  it('其余子任务 → image 按钮（"上传凭证 + 自核"）', () => {
    expect(getButtonType('建活动群聊', 'ORGANIZER')).toBe('image');
    expect(getButtonType('定制视觉物料（海报/横幅/手举牌）', 'ORGANIZER')).toBe('image');
    expect(getButtonType('确认场地并上传场地信息', 'ORGANIZER')).toBe('image');
    expect(getButtonType('组织者+助教完成实操教程培训', 'ORGANIZER')).toBe('image');
    expect(getButtonType('准备现场物料（接收/打印/任务卡PPT）', 'ORGANIZER')).toBe('image');
    expect(getButtonType('提交宣传推文', 'ORGANIZER')).toBe('mixed');
    expect(getButtonType('现场签到与引导', 'ORGANIZER')).toBe('image');
    expect(getButtonType('采集现场素材（横版高清）', 'ORGANIZER')).toBe('image');
    expect(getButtonType('提交活动复盘（含现场素材到飞书文档）', 'ORGANIZER')).toBe('image');
    expect(getButtonType('推动作品上墙（参与 OPC 能力认证）', 'ORGANIZER')).toBe('image');
  });

  it('未传 subTaskName 返回默认值 image', () => {
    expect(getButtonType(undefined)).toBe('image');
    expect(getButtonType('')).toBe('image');
  });
});
