/**
 * 5 阶段任务模板单测（v7 · TDD · PRD §5.4.3）
 * 验证 v13 后 19 个子任务分布：INTENT 4 / RECRUIT 4 / PREPARE 5 / EXECUTE 3 / REVIEW 3
 *   （v12 删 4 凑数 → 18；v13 +1 阅读指南 / -1 运营兜底 → 19）
 * 验证每阶段 order 1-N 连续
 * 验证 v13 已删"运营兜底确认"子任务
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('5 阶段任务模板（PRD §5.4.3 · v12 19 子任务）', () => {
  // 直接读 controller.ts 源码解析 SUBTASK_TEMPLATES 数组
  const controllerSrc = readFileSync(join(__dirname, 'controller.ts'), 'utf-8');
  const subtaskMatch = controllerSrc.match(/const SUBTASK_TEMPLATES[^\[]*\[([\s\S]*?)\];/);

  it('SUBTASK_TEMPLATES 数组存在', () => {
    expect(subtaskMatch).not.toBeNull();
  });

  // 解析出所有子任务对象（粗略正则匹配）
  const extractSubtasks = (): Array<{ stage: string; order: number; subTaskName: string; ownerType: string; proofHint: string }> => {
    if (!subtaskMatch) return [];
    const block = subtaskMatch[1];
    const items: any[] = [];
    // 简化的按行匹配（v13 加 proofHint 可能含 {} 字符，regex 复杂，改按行）
    const lines = block.split('\n');
    let cur: any = null;
    for (const line of lines) {
      const stageM = line.match(/stage:\s*'(\w+)'/);
      const orderM = line.match(/order:\s*(\d+)/);
      const nameM = line.match(/subTaskName:\s*'([^']+)'/);
      const ownerM = line.match(/ownerType:\s*'(\w+)'/);
      const hintM = line.match(/proofHint:\s*'([^']+)'/);
      if (stageM || orderM || nameM || ownerM || hintM) {
        if (stageM) cur = { stage: stageM[1] };
        if (cur) {
          if (orderM) cur.order = parseInt(orderM[1], 10);
          if (nameM) cur.subTaskName = nameM[1];
          if (ownerM) cur.ownerType = ownerM[1];
          if (hintM) cur.proofHint = hintM[1];
          // 一行内可能多个
          if (cur.stage && cur.order != null && cur.subTaskName && cur.ownerType) {
            items.push(cur);
            cur = null;
          }
        }
      }
    }
    return items;
  };

  it('总子任务数 = 19（v13 · 4+4+5+3+3=19）', () => {
    const tasks = extractSubtasks();
    expect(tasks.length).toBe(19);
  });

  it('INTENT 阶段 4 个子任务（v13 +1 阅读并确认行动指南）', () => {
    const intent = extractSubtasks().filter((t) => t.stage === 'INTENT');
    expect(intent.length).toBe(4);
  });

  it('RECRUIT 阶段 4 个子任务', () => {
    const recruit = extractSubtasks().filter((t) => t.stage === 'RECRUIT');
    expect(recruit.length).toBe(4);
  });

  it('PREPARE 阶段 5 个子任务', () => {
    const prepare = extractSubtasks().filter((t) => t.stage === 'PREPARE');
    expect(prepare.length).toBe(5);
  });

  it('EXECUTE 阶段 3 个子任务', () => {
    const execute = extractSubtasks().filter((t) => t.stage === 'EXECUTE');
    expect(execute.length).toBe(3);
  });

  it('REVIEW 阶段 3 个子任务（v13 -1 运营兜底确认）', () => {
    const review = extractSubtasks().filter((t) => t.stage === 'REVIEW');
    expect(review.length).toBe(3);
  });

  it('每个阶段 order 1-N 连续无重复', () => {
    const tasks = extractSubtasks();
    const stages = ['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW'];
    for (const stage of stages) {
      const stageTasks = tasks.filter((t) => t.stage === stage).sort((a, b) => a.order - b.order);
      const orders = stageTasks.map((t) => t.order);
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
  });

  it('v12 已删 4 条"志愿者审核 X 前 N 项"凑数子任务', () => {
    const tasks = extractSubtasks();
    const filler = tasks.filter((t) => t.subTaskName.includes('志愿者审核') && t.subTaskName.includes('前'));
    expect(filler.length).toBe(0);
  });

  it('v13 已删"运营兜底确认（v4 默认不介入）"子任务', () => {
    const tasks = extractSubtasks();
    const operator = tasks.filter((t) => t.subTaskName.includes('运营兜底'));
    expect(operator.length).toBe(0);
  });

  it('v13 INTENT 阶段包含"阅读并确认行动指南"（带飞书文档链接）', () => {
    const intent = extractSubtasks().filter((t) => t.stage === 'INTENT');
    const guide = intent.find((t) => t.subTaskName === '阅读并确认行动指南');
    expect(guide).toBeTruthy();
    // Frank 27 21:07 反馈：志愿者先确认 → 组织者后确认
    expect(guide!.ownerType).toBe('VOLUNTEER');
    expect(guide!.proofHint).toContain('feishu.cn/docx');
  });

  it('v13 INTENT 阶段"双方最终确认活动方案" ownerType=ORGANIZER', () => {
    const intent = extractSubtasks().filter((t) => t.stage === 'INTENT');
    const confirm = intent.find((t) => t.subTaskName === '双方最终确认活动方案/时间/地点/规模');
    expect(confirm).toBeTruthy();
    expect(confirm!.ownerType).toBe('ORGANIZER');
  });

  it('v13 INTENT 阶段"飞书日历登记活动" ownerType=ORGANIZER（Frank Comment 5 改）', () => {
    const intent = extractSubtasks().filter((t) => t.stage === 'INTENT');
    const cal = intent.find((t) => t.subTaskName === '飞书日历登记活动');
    expect(cal).toBeTruthy();
    expect(cal!.ownerType).toBe('ORGANIZER');
  });

  it('ownerType 只包含 ORGANIZER / VOLUNTEER / OPERATOR', () => {
    const tasks = extractSubtasks();
    const valid = new Set(['ORGANIZER', 'VOLUNTEER', 'OPERATOR']);
    for (const t of tasks) {
      expect(valid.has(t.ownerType)).toBe(true);
    }
  });
});
