import { TASK_TYPE } from './constants';
import { computeSchedule, type Schedule } from './schedule';
import { isClosedTaskByStage } from './stage-state';
import type { Stage, Task } from './schema';
import type { TaskDependencyEdge } from './task-dependencies';

/** A task still on the board: not archived, not in the Bin. */
const isLive = (t: Task): boolean => !t.archived && t.deletedAt == null;

/**
 * How long a task is taken to need, in days, for scheduling. A task has no
 * duration of its own, so its effort (1–5) stands in for it: one effort point
 * is one day, and a task with no effort counts as one day. Finished work
 * (done or abandoned) needs none, so it never lengthens what is left.
 */
export function taskDurationDays(task: Task, stages: Stage[]): number {
  if (isClosedTaskByStage(task, stages)) return 0;
  return task.effort != null && task.effort > 0 ? task.effort : 1;
}

/** Live goals in one project (`null` = tasks with no project), oldest first. */
export function goalsInProject(tasks: Task[], projectId: number | null): Task[] {
  return tasks
    .filter((t) => isLive(t) && t.type === TASK_TYPE.GOAL && (t.projectId ?? null) === projectId)
    .sort((a, b) => a.id - b.id);
}

/** Live building-blocks that contribute to a goal. */
export function blocksOfGoal(tasks: Task[], goalId: number): Task[] {
  return tasks.filter(
    (t) => isLive(t) && t.type === TASK_TYPE.BUILDING_BLOCK && t.goalTaskId === goalId,
  );
}

/** Live building-blocks in a project that have no goal yet. */
export function unassignedBlocks(tasks: Task[], projectId: number | null): Task[] {
  return tasks.filter(
    (t) =>
      isLive(t) &&
      t.type === TASK_TYPE.BUILDING_BLOCK &&
      t.goalTaskId == null &&
      (t.projectId ?? null) === projectId,
  );
}

export interface GoalProgress {
  done: number;
  total: number;
}

/** Finished building-blocks out of all of them. A goal with none has no progress to speak of. */
export function goalProgress(blocks: Task[], stages: Stage[]): GoalProgress {
  return {
    done: blocks.filter((b) => isClosedTaskByStage(b, stages)).length,
    total: blocks.length,
  };
}

/**
 * The goal's blocks scheduled along their dependencies. Ties between tasks that
 * could start together fall to the earlier due date, so the order reads as the
 * order the work is due; tasks with no due date go last.
 */
export function planGoal(blocks: Task[], edges: TaskDependencyEdge[], stages: Stage[]): Schedule {
  return computeSchedule(
    blocks.map((b) => ({
      id: b.id,
      duration: taskDurationDays(b, stages),
      tiebreak: b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER,
    })),
    edges,
  );
}
