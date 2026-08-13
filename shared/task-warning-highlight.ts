import { differenceInDays } from 'date-fns';
import { isOverdueOn } from './briefing';
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

  // Same helper the export uses, so the board's highlight and the briefing's
  // `overdue` list cannot disagree — the export's stated contract. Cutting the
  // day in the board's zone rather than the viewer's also keeps a card's
  // highlight stable when the board is opened from another timezone.
  if (isOverdueOn(task.dueDate, new Date())) return 'overdue';

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
