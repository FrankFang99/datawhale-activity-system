/**
 * stageSubtasks 数据 + canViewSubTasks 角色权限覆盖
 * Frank 2026-08-21 23:35 #2 5 阶段子任务描述
 */
import { describe, it, expect } from 'vitest';
import { STAGE_TEMPLATES_FRANK, canViewSubTasks } from './stageSubtasks';

describe('Frank 23:35 #2 5 阶段子任务描述（来自 comment 2-6）', () => {
  it('含 5 阶段（INTENT/RECRUIT/PREPARE/EXECUTE/REVIEW）', () => {
    expect(STAGE_TEMPLATES_FRANK.length).toBe(5);
    const stages = STAGE_TEMPLATES_FRANK.map((s) => s.stage);
    expect(stages).toEqual(['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW']);
  });

  it('INTENT 阶段含"双方最终确认活动方案"子任务（v13 Frank 14:12 改 ownerType 为组织者）', () => {
    const intent = STAGE_TEMPLATES_FRANK.find((s) => s.stage === 'INTENT');
    expect(intent).toBeDefined();
    const names = intent!.subTasks.map((s) => s.name);
    expect(names.some((n) => n.includes('双方最终确认'))).toBe(true);
    // v13 改 ownerType=ORGANIZER
    const confirm = intent!.subTasks.find((t) => t.name.includes('双方最终确认'));
    expect(confirm?.ownerType).toBe('ORGANIZER');
  });

  it('RECRUIT 阶段含"建群+定制视觉物料+启动招募+联系嘉宾"子任务（comment 3）', () => {
    const recruit = STAGE_TEMPLATES_FRANK.find((s) => s.stage === 'RECRUIT');
    const names = recruit!.subTasks.map((s) => s.name);
    expect(names.some((n) => n.includes('群聊'))).toBe(true);
    expect(names.some((n) => n.includes('视觉物料'))).toBe(true);
    expect(names.some((n) => n.includes('招募宣传'))).toBe(true);
    expect(names.some((n) => n.includes('嘉宾'))).toBe(true);
  });

  it('PREPARE 阶段含"确认场地+实操教程+物料"子任务（comment 4）', () => {
    const prepare = STAGE_TEMPLATES_FRANK.find((s) => s.stage === 'PREPARE');
    const names = prepare!.subTasks.map((s) => s.name);
    expect(names.some((n) => n.includes('场地'))).toBe(true);
    expect(names.some((n) => n.includes('实操教程'))).toBe(true);
    expect(names.some((n) => n.includes('物料'))).toBe(true);
  });

  // v1.2 Frank 27：跟 8-25 后端 SUBTASK_TEMPLATES 对齐（3 个子任务）
  // v13 Frank 23:35 comment 5 写的 4 个 EXECUTE（嘉宾分享/作品墙上墙）8-25 已删
  it('EXECUTE 阶段含"签到+主题分享+采集素材"3 子任务（8-25 后端 SUBTASK_TEMPLATES）', () => {
    const exec = STAGE_TEMPLATES_FRANK.find((s) => s.stage === 'EXECUTE');
    const names = exec!.subTasks.map((s) => s.name);
    expect(exec!.subTasks.length).toBe(3);
    expect(names.some((n) => n.includes('签到'))).toBe(true);
    expect(names.some((n) => n.includes('主题分享+带教演示'))).toBe(true);
    // 8-25 subTaskName 实际是「采集现场素材」中间有「现场」两字，substring 要匹配完整词
    expect(names.some((n) => n.includes('采集现场素材'))).toBe(true);
  });

  it('REVIEW 阶段含"复盘+整理素材"子任务（comment 6）', () => {
    const review = STAGE_TEMPLATES_FRANK.find((s) => s.stage === 'REVIEW');
    const names = review!.subTasks.map((s) => s.name);
    expect(names.some((n) => n.includes('复盘'))).toBe(true);
    expect(names.some((n) => n.includes('素材'))).toBe(true);
  });
});

describe('canViewSubTasks 角色权限（Frank 23:35 #2：参与者保持现有 5 阶段时间轴即可）', () => {
  it('ORGANIZER 可看', () => {
    expect(canViewSubTasks('ORGANIZER')).toBe(true);
  });
  it('ASSISTANT 可看', () => {
    expect(canViewSubTasks('ASSISTANT')).toBe(true);
  });
  it('VOLUNTEER 可看', () => {
    expect(canViewSubTasks('VOLUNTEER')).toBe(true);
  });
  it('OPERATOR 可看', () => {
    expect(canViewSubTasks('OPERATOR')).toBe(true);
  });
  it('ADMIN 可看', () => {
    expect(canViewSubTasks('ADMIN')).toBe(true);
  });
  it('PARTICIPANT 不可看（保持现有时间轴）', () => {
    expect(canViewSubTasks('PARTICIPANT')).toBe(false);
  });
  it('USER 不可看', () => {
    expect(canViewSubTasks('USER')).toBe(false);
  });
  it('undefined 不可看', () => {
    expect(canViewSubTasks(undefined)).toBe(false);
  });
});
