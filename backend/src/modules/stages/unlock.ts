/**
 * 5 阶段任务解锁纯逻辑（v7 · TDD · PRD §5.4.3）
 *
 * 从 controller 抽 unlockNextStage 关键逻辑：
 * - STAGE_ORDER 阶段顺序
 * - isStageFullyCompleted() 某阶段是否所有子任务 COMPLETED
 * - getNextStage()  下一阶段
 * - 哪些子任务需要从 PENDING 变 IN_PROGRESS
 */

export const STAGE_ORDER = ['INTENT', 'RECRUIT', 'PREPARE', 'EXECUTE', 'REVIEW'] as const;
export type StageName = (typeof STAGE_ORDER)[number];

export const ALL_STAGES_STATUS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as const;
export type StageTaskStatus = (typeof ALL_STAGES_STATUS)[number];

// v13 19 个子任务分布（v12 删 4 凑数 → 18；v13 加 1 阅读指南 + 删 1 运营兜底 → 18 → 19）
export const SUBTASK_COUNT_BY_STAGE: Record<StageName, number> = {
  INTENT: 4,   // +1 阅读并确认行动指南
  RECRUIT: 4,
  PREPARE: 5,
  EXECUTE: 3,
  REVIEW: 3,   // -1 运营兜底确认
};

export interface SubTaskLite {
  stage: string;
  status: string;
}

export function isStageFullyCompleted(tasks: SubTaskLite[], stage: string): boolean {
  const stageTasks = tasks.filter((t) => t.stage === stage);
  if (stageTasks.length === 0) return false;
  return stageTasks.every((t) => t.status === 'COMPLETED');
}

export function getNextStage(current: string): StageName | null {
  const idx = STAGE_ORDER.indexOf(current as StageName);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function getStageProgress(tasks: SubTaskLite[], stage: string): {
  total: number;
  completed: number;
  percent: number;
} {
  const stageTasks = tasks.filter((t) => t.stage === stage);
  const completed = stageTasks.filter((t) => t.status === 'COMPLETED').length;
  const total = stageTasks.length;
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function isValidStage(stage: string): stage is StageName {
  return STAGE_ORDER.includes(stage as StageName);
}

// 整体进度（5 阶段平均）
export function getOverallProgress(tasks: SubTaskLite[]): {
  total: number;
  completed: number;
  percent: number;
  currentStage: StageName | null;
} {
  const total = STAGE_ORDER.reduce((sum, s) => sum + SUBTASK_COUNT_BY_STAGE[s], 0);
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  // 当前阶段：第一个非 COMPLETED 的阶段
  let currentStage: StageName | null = null;
  for (const s of STAGE_ORDER) {
    const stageTasks = tasks.filter((t) => t.stage === s);
    if (stageTasks.length === 0) continue;
    const stageCompleted = stageTasks.every((t) => t.status === 'COMPLETED');
    if (!stageCompleted) {
      currentStage = s;
      break;
    }
  }
  if (currentStage === null && completed === total) {
    currentStage = 'REVIEW';  // 全部完成
  }

  return { total, completed, percent, currentStage };
}
