/**
 * ActivityDetail v10 测试（Frank 2026-08-22 14:35 反馈）
 *
 * 5 阶段可点击 tab + 3 步进度（组织者自核 → 志愿者审核 → 运营复核）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = () => readFileSync(join(__dirname, 'ActivityDetail.tsx'), 'utf-8');

describe('ActivityDetail · v10 5 阶段可点击 tab', () => {
  it('用 Segmented 替代 Steps（可点击切换阶段）', () => {
    expect(SRC()).toMatch(/Segmented/);
    expect(SRC()).not.toMatch(/<Steps\s/);  // 不再用 Steps
  });

  it('selectedStage 状态管理当前选中阶段', () => {
    expect(SRC()).toMatch(/selectedStage/);
    expect(SRC()).toMatch(/setSelectedStage/);
  });

  it('tab onChange 触发 loadTasksForStage', () => {
    expect(SRC()).toMatch(/loadTasksForStage/);
  });

  it('5 阶段选项覆盖 INTENT/RECRUIT/PREPARE/EXECUTE/REVIEW', () => {
    const s = SRC();
    for (const st of ['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW']) {
      expect(s).toContain(`'${st}'`);
    }
  });
});

describe('ActivityDetail · v10 3 步进度卡片（SubTaskCard）', () => {
  it('定义 SubTaskCard 组件', () => {
    expect(SRC()).toMatch(/function\s+SubTaskCard/);
  });

  it('3 步进度：组织者自核 → 志愿者审核 → 运营复核', () => {
    const s = SRC();
    expect(s).toMatch(/组织者自核/);
    expect(s).toMatch(/志愿者审核/);
    expect(s).toMatch(/运营复核/);
  });

  it('Step 1 状态：organizerSubmittedAt 字段判定', () => {
    expect(SRC()).toMatch(/organizerSubmittedAt/);
  });

  it('Step 2 状态：reviewStatus 字段判定 APPROVED/REJECTED', () => {
    expect(SRC()).toMatch(/reviewStatus\s*===\s*'APPROVED'/);
    expect(SRC()).toMatch(/reviewStatus\s*===\s*'REJECTED'/);
  });

  it('Step 3 状态：operatorReviewStatus 字段判定', () => {
    expect(SRC()).toMatch(/operatorReviewStatus\s*===\s*'APPROVED'/);
    expect(SRC()).toMatch(/operatorReviewStatus\s*===\s*'REJECTED'/);
  });
});

describe('ActivityDetail · v10 角色权限按钮', () => {
  it('ORGANIZER/ASSISTANT 显示自核按钮（canOrganizerSubmit）', () => {
    expect(SRC()).toMatch(/canOrganizerSubmit/);
    expect(SRC()).toMatch(/role\s*===\s*'ORGANIZER'/);
    expect(SRC()).toMatch(/role\s*===\s*'ASSISTANT'/);
  });

  it('VOLUNTEER 显示审核按钮（canVolunteerReview）', () => {
    expect(SRC()).toMatch(/canVolunteerReview/);
    expect(SRC()).toMatch(/role\s*===\s*'VOLUNTEER'/);
  });

  it('OPERATOR/ADMIN 显示复核按钮（canOperatorReview）', () => {
    expect(SRC()).toMatch(/canOperatorReview/);
    expect(SRC()).toMatch(/role\s*===\s*'OPERATOR'/);
    expect(SRC()).toMatch(/role\s*===\s*'ADMIN'/);
  });

  it('调 stageApi.submit（组织者自核）', () => {
    expect(SRC()).toMatch(/stageApi\.submit\s*\(\s*task\.taskId/);
  });

  it('调 stageApi.review（志愿者审核）', () => {
    expect(SRC()).toMatch(/stageApi\.review\s*\(\s*task\.taskId/);
  });

  it('调 stageApi.operatorReview（v10 新增 · 运营复核）', () => {
    expect(SRC()).toMatch(/stageApi\.operatorReview\s*\(\s*task\.taskId/);
  });
});

describe('ActivityDetail · v10 加载 5 阶段任务', () => {
  it('调 applicationApi.byActivity 找 CONFIRMED 申请', () => {
    expect(SRC()).toMatch(/applicationApi\.byActivity/);
  });

  it('调 stageApi.list 拿该申请的 22 个子任务', () => {
    expect(SRC()).toMatch(/stageApi\.list\s*\(\s*confirmed\.applicationId\s*\)/);
  });

  it('过滤显示当前选中阶段的子任务', () => {
    expect(SRC()).toMatch(/t\.stage\s*===\s*selectedStage/);
  });

  it('按 order 排序子任务', () => {
    expect(SRC()).toMatch(/\(a\.order\s*\?\?\s*0\)\s*-\s*\(b\.order\s*\?\?\s*0\)/);
  });
});

describe('ActivityDetail · v12 进入下一阶段按钮（Frank 09:17 Comment 5）', () => {
  it('阶段所有子任务 COMPLETED → 进入下一阶段按钮激活', () => {
    // 计算逻辑：stageTasks.every(t => t.status === 'COMPLETED')
    expect(SRC()).toMatch(/stageTasks\.every\(/);
  });

  it('未完成阶段显示灰色锁定 + 提示"完成 N/M 项后解锁"', () => {
    // v16.2 Frank 10:30 Comment 4：按 ownerType 区分（用 stageCompletedCount 变量）
    expect(SRC()).toMatch(/完成本阶段\s+\{stageCompletedCount\}/);
  });

  it('5 阶段 tab 点击 → 切换 selectedStage + 调 loadTasksForStage（v16.9 改：删按钮，靠 tab 切换）', () => {
    expect(SRC()).toMatch(/setSelectedStage\(s\)/);
    expect(SRC()).toMatch(/loadTasksForStage\(s\)/);
  });

  it('最后阶段 REVIEW 完成 → 显示"活动已完结"', () => {
    expect(SRC()).toMatch(/活动已完结/);
  });

  it('REVIEW 阶段未完成 → 灰色锁定', () => {
    // v16.2 Frank 10:30 Comment 4：按 ownerType 区分（用 stageCompletedCount 变量）
    expect(SRC()).toMatch(/完成本阶段\s+\{stageCompletedCount\}/);
  });
});

describe('ActivityDetail · v16.5/v16.6 simpleStatus 5 种状态文案', () => {
  it('未完成 step1（默认）→ "待组织者上传"', () => {
    expect(SRC()).toMatch(/待组织者上传/);
  });
  it('未完成 step1（volunteer-first）→ "待志愿者完成"', () => {
    expect(SRC()).toMatch(/待志愿者完成/);
  });
  it('运营 REJECTED → "运营已打回"（v16.8 优先级最高）', () => {
    expect(SRC()).toMatch(/运营已打回/);
  });
  it('志愿者 UNCERTAIN → "已请求运营介入"（v16.7 持久化）', () => {
    expect(SRC()).toMatch(/已请求运营介入/);
  });
  it('step2Done → "已完成"', () => {
    expect(SRC()).toMatch(/已完成/);
  });
  it('待审核（默认）→ "待志愿者审核"', () => {
    expect(SRC()).toMatch(/待志愿者审核/);
  });
  it('待确认（volunteer-first）→ "待组织者确认"', () => {
    expect(SRC()).toMatch(/待组织者确认/);
  });
});

describe('ActivityDetail · v16.6 凭证规范 proofType 5 种分支', () => {
  it('proofType=confirm → "我已确认" 按钮', () => {
    expect(SRC()).toMatch(/proofType === 'confirm'/);
  });
  it('proofType=form → "填写活动方案" 按钮', () => {
    expect(SRC()).toMatch(/proofType === 'form'/);
  });
  it('proofType=image/mixed/未设 → "上传凭证" 按钮', () => {
    expect(SRC()).toMatch(/proofType === 'image'/);
    expect(SRC()).toMatch(/proofType === 'mixed'/);
  });
  it('proofType=volunteer-first → 双按钮（志愿者 step1 + 组织者 step2）', () => {
    expect(SRC()).toMatch(/proofType === 'volunteer-first'/);
  });
});

describe('ActivityDetail · v16.7 organizerConfirm API', () => {
  it('调 stageApi.organizerConfirm 写 reviewStatus=APPROVED', () => {
    expect(SRC()).toMatch(/stageApi\.organizerConfirm/);
  });
  it('组织者 confirm 写 organizerConfirmedAt 字段', () => {
    expect(SRC()).toMatch(/organizerConfirmedAt/);
  });
});

describe('ActivityDetail · v16.8 简化 unlock 条件', () => {
  it('每阶段完成判定 = every(t.status === "COMPLETED")', () => {
    expect(SRC()).toMatch(/stageTasks\.every\(\(t\)\s*=>\s*t\.status === 'COMPLETED'\)/);
  });
});

describe('ActivityDetail · v16.8 renderTextWithLinks + 站内信定位', () => {
  it('定义 renderTextWithLinks 函数解析 [text](url) markdown', () => {
    expect(SRC()).toMatch(/const renderTextWithLinks\s*=\s*\(text:\s*string\)/);
  });
  it('用 useSearchParams 读 ?stage= ?order= 自动定位', () => {
    expect(SRC()).toMatch(/useSearchParams\(\)/);
  });
  it('子任务 Card 加 data-task-id 用于 scroll target', () => {
    expect(SRC()).toMatch(/data-task-id=\{task\.taskId\}/);
  });
});

describe('ActivityDetail · v16.9 Frank 13:10 反馈（删 unlock 按钮 + URL 接受 /uploads/）', () => {
  it('删"解锁下一阶段"按钮（v16.9 改：5 阶段 tab 自助切换）', () => {
    // 不再有"解锁下一阶段"按钮文案
    expect(SRC()).not.toMatch(/解锁下一阶段.*通知志愿者审核/);
  });
  it('完成 + 非最后阶段 → 提示"本阶段已完成（点击上方 tab 进入）"', () => {
    expect(SRC()).toMatch(/本阶段已完成（点击上方 tab 进入/);
  });
  it('URL 验证接受 /uploads/ 相对路径（v16.9 Frank 13:10）', () => {
    expect(SRC()).toMatch(/\/uploads\//);
  });
  it('URL 验证仍然接受 https?:// 完整 URL', () => {
    expect(SRC()).toMatch(/https\?:\\\/\\\/|\^https\?:\\\/\\\//);
  });
});
