import { TASK_TYPE } from './constants';
import { PROJECT_SCOPE_ALL, PROJECT_SCOPE_NONE, type ProjectScope } from './project-scope';
import { computeSchedule, type Schedule } from './schedule';
import { isClosedTaskByStage } from './stage-state';
import type { Stage, Task } from './schema';
import type { TaskDependencyEdge } from './task-dependencies';

/** A task still on the board: not archived, not in the Bin. */
const isLive = (t: Task): boolean => !t.archived && t.deletedAt == null;

/**
 * Whether a task falls in a scope, read the way the board reads it: every
 * task under `'all'`, the tasks with no project under `'none'`, otherwise the
 * tasks of that one project.
 */
const inScope = (t: Task, scope: ProjectScope): boolean =>
  scope === PROJECT_SCOPE_ALL ||
  (t.projectId ?? null) === (scope === PROJECT_SCOPE_NONE ? null : scope);

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

/**
 * Live goals in a scope — one project, the tasks with no project (`'none'`)
 * or every project (`'all'`) — oldest first.
 */
export function goalsInProject(tasks: Task[], scope: ProjectScope): Task[] {
  return tasks
    .filter((t) => isLive(t) && t.type === TASK_TYPE.GOAL && inScope(t, scope))
    .sort((a, b) => a.id - b.id);
}

/** Live building-blocks that contribute to a goal. */
export function blocksOfGoal(tasks: Task[], goalId: number): Task[] {
  return tasks.filter(
    (t) => isLive(t) && t.type === TASK_TYPE.BUILDING_BLOCK && t.goalTaskId === goalId,
  );
}

/** Live building-blocks in a scope (as for `goalsInProject`) that have no goal yet. */
export function unassignedBlocks(tasks: Task[], scope: ProjectScope): Task[] {
  return tasks.filter(
    (t) =>
      isLive(t) && t.type === TASK_TYPE.BUILDING_BLOCK && t.goalTaskId == null && inScope(t, scope),
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

/** Work outside the goal that one of its blocks waits for. */
export interface OutsideWait {
  task: Task;
  /** The goal that task belongs to, when it is a building-block of another goal. */
  goal: Task | null;
  done: boolean;
}

/**
 * For each of the goal's blocks, the predecessors that are not blocks of this
 * goal: another goal's block, or a task with no goal. The goal's schedule only
 * uses edges between its own blocks, so these are shown as "starts after"
 * markers instead of moving any dates. Archived or binned predecessors are
 * left out, as they are gone from the board.
 */
export function outsideWaits(
  blocks: Task[],
  edges: TaskDependencyEdge[],
  tasks: Task[],
  stages: Stage[],
): Map<number, OutsideWait[]> {
  const own = new Set(blocks.map((b) => b.id));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = new Map<number, OutsideWait[]>();
  for (const e of edges) {
    if (!own.has(e.successorId) || own.has(e.predecessorId)) continue;
    const task = byId.get(e.predecessorId);
    if (!task || !isLive(task)) continue;
    const goal = task.goalTaskId != null ? (byId.get(task.goalTaskId) ?? null) : null;
    const list = out.get(e.successorId) ?? [];
    list.push({ task, goal, done: isClosedTaskByStage(task, stages) });
    out.set(e.successorId, list);
  }
  return out;
}

/** "#12 Order timber (Build a shed), not done" — one outside wait as text. */
export function describeOutsideWait(w: OutsideWait): string {
  const where = w.goal ? ` (${w.goal.title})` : '';
  return `#${w.task.id} ${w.task.title}${where}${w.done ? ', done' : ', not done'}`;
}
