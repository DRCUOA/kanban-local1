import { differenceInDays } from 'date-fns';
import { isTaskOverdueOn } from './briefing';
import { STAGE_KIND, TASK_PRIORITY } from './constants';
import { isClosedTaskByStage, taskStageKind } from './stage-state';
import { STALE_AFTER_DAYS } from './board-warnings';
import type { Task, Stage } from './schema';

export type TaskWarningHighlightKind = 'overdue' | 'high_priority_backlog' | 'stale';

/**
 * Per-task highlight matching TaskWarnings toasts. A task the main board does
 * not show never matches — archived or binned — and nor does a closed one.
 * Precedence: overdue (destructive toast) → high-priority backlog (warning) → stale (info).
 */
export function getTaskWarningHighlight(
  task: Task,
  stages: Stage[],
): TaskWarningHighlightKind | null {
  if (task.archived || task.deletedAt) return null;

  // Same helper the export uses, so the board's highlight and the briefing's
  // `overdue` list cannot disagree — the export's stated contract. Cutting the
  // day in the board's zone rather than the viewer's also keeps a card's
  // highlight stable when the board is opened from another timezone.
  if (isTaskOverdueOn(task, stages, new Date())) return 'overdue';

  if (
    taskStageKind(task, stages) === STAGE_KIND.BACKLOG &&
    (task.priority === TASK_PRIORITY.HIGH || task.priority === TASK_PRIORITY.CRITICAL)
  ) {
    return 'high_priority_backlog';
  }

  // Same gate `matchesBoardWarning` applies to the stale pill: a finished card
  // sitting untouched in Done has nothing left to go stale.
  if (task.updatedAt && !isClosedTaskByStage(task, stages)) {
    const updated = new Date(task.updatedAt);
    if (differenceInDays(new Date(), updated) >= STALE_AFTER_DAYS) return 'stale';
  }

  return null;
}
