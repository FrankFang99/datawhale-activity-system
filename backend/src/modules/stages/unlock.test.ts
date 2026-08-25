/**
 * 5 阶段任务解锁单测（v7 · TDD · PRD §5.4.3）
 */
import { describe, it, expect } from 'vitest';
import {
  STAGE_ORDER,
  SUBTASK_COUNT_BY_STAGE,
  isStageFullyCompleted,
  getNextStage,
  getStageProgress,
  getOverallProgress,
  isValidStage,
} from './unlock';

describe('5 阶段顺序', () => {
  it('5 阶段连续 INTENT → RECRUIT → PREPARE → EXECUTE → REVIEW', () => {
    expect(STAGE_ORDER.length).toBe(5);
    expect(STAGE_ORDER).toEqual(['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW']);
  });

  it('19 子任务分布正确（v13 Frank 14:12 改：+1 阅读指南 INTENT=4，-1 运营兜底 REVIEW=3）', () => {
    const total = Object.values(SUBTASK_COUNT_BY_STAGE).reduce((a, b) => a + b, 0);
    expect(total).toBe(19);  // v13：4+4+5+3+3=19
    expect(SUBTASK_COUNT_BY_STAGE.INTENT).toBe(4);   // +1 阅读并确认行动指南
    expect(SUBTASK_COUNT_BY_STAGE.RECRUIT).toBe(4);
    expect(SUBTASK_COUNT_BY_STAGE.PREPARE).toBe(5);
    expect(SUBTASK_COUNT_BY_STAGE.EXECUTE).toBe(3);
    expect(SUBTASK_COUNT_BY_STAGE.REVIEW).toBe(3);   // -1 运营兜底确认
  });
});

describe('isStageFullyCompleted 阶段完成判定', () => {
  it('所有子任务 COMPLETED → true', () => {
    const tasks = [
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
    ];
    expect(isStageFullyCompleted(tasks, 'INTENT')).toBe(true);
  });

  it('任一子任务未 COMPLETED → false', () => {
    const tasks = [
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'IN_PROGRESS' },  // 没完成
      { stage: 'INTENT', status: 'COMPLETED' },
    ];
    expect(isStageFullyCompleted(tasks, 'INTENT')).toBe(false);
  });

  it('其他阶段 COMPLETED 不影响本阶段', () => {
    const tasks = [
      { stage: 'INTENT', status: 'IN_PROGRESS' },  // INTENT 没完成
      { stage: 'RECRUIT', status: 'COMPLETED' },
    ];
    expect(isStageFullyCompleted(tasks, 'INTENT')).toBe(false);
    expect(isStageFullyCompleted(tasks, 'RECRUIT')).toBe(true);
  });

  it('空数组 → false', () => {
    expect(isStageFullyCompleted([], 'INTENT')).toBe(false);
  });

  it('OVERDUE 任务不算 COMPLETED', () => {
    const tasks = [
      { stage: 'INTENT', status: 'OVERDUE' },
      { stage: 'INTENT', status: 'COMPLETED' },
    ];
    expect(isStageFullyCompleted(tasks, 'INTENT')).toBe(false);
  });
});

describe('getNextStage 下一阶段', () => {
  it('5 阶段正常流转', () => {
    expect(getNextStage('INTENT')).toBe('RECRUIT');
    expect(getNextStage('RECRUIT')).toBe('PREPARE');
    expect(getNextStage('PREPARE')).toBe('EXECUTE');
    expect(getNextStage('EXECUTE')).toBe('REVIEW');
  });

  it('最后阶段返回 null', () => {
    expect(getNextStage('REVIEW')).toBeNull();
  });

  it('未知阶段返回 null', () => {
    expect(getNextStage('UNKNOWN')).toBeNull();
  });
});

describe('getStageProgress 阶段进度', () => {
  it('4 子任务全部完成 → 100%', () => {
    const tasks = [
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
    ];
    const r = getStageProgress(tasks, 'INTENT');
    expect({ total: r.total, completed: r.completed, percent: r.percent }).toEqual({ total: 4, completed: 4, percent: 100 });
  });

  it('2/5 完成 → 40%', () => {
    const tasks = [
      { stage: 'RECRUIT', status: 'COMPLETED' },
      { stage: 'RECRUIT', status: 'COMPLETED' },
      { stage: 'RECRUIT', status: 'IN_PROGRESS' },
      { stage: 'RECRUIT', status: 'PENDING' },
      { stage: 'RECRUIT', status: 'PENDING' },
    ];
    const r = getStageProgress(tasks, 'RECRUIT');
    expect({ total: r.total, completed: r.completed, percent: r.percent }).toEqual({ total: 5, completed: 2, percent: 40 });
  });

  it('0 子任务 → 0%', () => {
    const r = getStageProgress([], 'INTENT');
    expect({ total: r.total, completed: r.completed, percent: r.percent }).toEqual({ total: 0, completed: 0, percent: 0 });
  });
});

describe('isValidStage 阶段合法性', () => {
  it('5 合法阶段', () => {
    for (const s of STAGE_ORDER) {
      expect(isValidStage(s)).toBe(true);
    }
  });

  it('非法阶段', () => {
    expect(isValidStage('UNKNOWN')).toBe(false);
    expect(isValidStage('DRAFT')).toBe(false);
    expect(isValidStage('SUBMITTED')).toBe(false);
  });
});

describe('getOverallProgress 整体进度', () => {
  it('未开始 → 0% + currentStage=INTENT', () => {
    const tasks = [
      { stage: 'INTENT', status: 'PENDING' },
      { stage: 'RECRUIT', status: 'PENDING' },
    ];
    const r = getOverallProgress(tasks);
    expect(r.percent).toBe(0);
    expect(r.currentStage).toBe('INTENT');
  });

  it('全部完成 → 100% + currentStage=REVIEW', () => {
    const tasks = STAGE_ORDER.flatMap((s) =>
      Array(SUBTASK_COUNT_BY_STAGE[s]).fill(0).map(() => ({ stage: s, status: 'COMPLETED' }))
    );
    const r = getOverallProgress(tasks);
    // v12 19 子任务（3+4+5+3+4）
    expect({ total: r.total, percent: r.percent, currentStage: r.currentStage }).toEqual({ total: 19, percent: 100, currentStage: 'REVIEW' });
  });

  it('当前阶段：第一个未全完成的阶段', () => {
    const tasks = [
      // INTENT 全完成（v12 3 个）
      ...Array(3).fill(0).map(() => ({ stage: 'INTENT', status: 'COMPLETED' })),
      // RECRUIT 2/4 完成
      ...Array(2).fill(0).map(() => ({ stage: 'RECRUIT', status: 'COMPLETED' })),
      { stage: 'RECRUIT', status: 'IN_PROGRESS' },
      { stage: 'RECRUIT', status: 'PENDING' },
    ];
    const r = getOverallProgress(tasks);
    expect(r.currentStage).toBe('RECRUIT');
    // 3 + 2 = 5 / 19
    expect(r.completed).toBe(5);
    expect(Math.round((5 / 19) * 100)).toBe(26);
  });
});

describe('解锁判定（综合）', () => {
  // 这是 unlockNextStage 的关键判定，模拟"所有子任务 COMPLETED → 下一阶段可解锁"
  function shouldUnlock(tasks: SubTaskLite[], currentStage: string): boolean {
    return isStageFullyCompleted(tasks, currentStage) && getNextStage(currentStage) !== null;
  }

  it('INTENT 全完成 → 可解锁到 RECRUIT', () => {
    const tasks = [
      ...Array(4).fill(0).map(() => ({ stage: 'INTENT', status: 'COMPLETED' })),
    ];
    expect(shouldUnlock(tasks, 'INTENT')).toBe(true);
  });

  it('REVIEW 全完成 → 不可解锁（终态）', () => {
    const tasks = [
      ...Array(4).fill(0).map(() => ({ stage: 'REVIEW', status: 'COMPLETED' })),
    ];
    expect(shouldUnlock(tasks, 'REVIEW')).toBe(false);
  });

  it('INTENT 缺一任务 → 不可解锁', () => {
    const tasks = [
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'COMPLETED' },
      { stage: 'INTENT', status: 'IN_PROGRESS' },  // 1 个没完成
    ];
    expect(shouldUnlock(tasks, 'INTENT')).toBe(false);
  });
});
