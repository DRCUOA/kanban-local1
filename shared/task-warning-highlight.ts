import { differenceInDays, isPast, isToday } from 'date-fns';
import { TASK_STATUS, TASK_PRIORITY, getStatusFromStageName } from './constants';
import type { Task, Stage } from './schema';

export type TaskWarningHighlightKind = 'overdue' | 'high_priority_backlog' | 'stale';

/** Same status resolution as dashboard warning banners (TaskWarnings). */
export function resolveTaskStatusForWarnings(task: Task, stages: Stage[]): string {
  if (task.status) return task.status;
  const stage = stages.find((s) => s.id === task.stageId);
  if (stage) return getStatusFromStageName(stage.name);
  return TASK_STATUS.BACKLOG;
}

/**
 * Per-task highlight matching TaskWarnings toasts. Archived tasks never match.
 * Precedence: overdue (destructive toast) → high-priority backlog (warning) → stale (info).
 */
export function getTaskWarningHighlight(
  task: Task,
  stages: Stage[],
): TaskWarningHighlightKind | null {
  if (task.archived) return null;

  const due = task.dueDate ? new Date(task.dueDate) : null;
  if (due && isPast(due) && !isToday(due)) return 'overdue';

  const status = resolveTaskStatusForWarnings(task, stages);
  if (
    status === TASK_STATUS.BACKLOG &&
    (task.priority === TASK_PRIORITY.HIGH || task.priority === TASK_PRIORITY.CRITICAL)
  ) {
    return 'high_priority_backlog';
  }

  if (task.updatedAt) {
    const updated = new Date(task.updatedAt);
    if (differenceInDays(new Date(), updated) >= 14) return 'stale';
  }

  return null;
}
