import { differenceInDays } from 'date-fns';
import { isTaskOverdueOn } from './briefing';
import { STAGE_KIND, TASK_PRIORITY } from './constants';
import { isClosedTaskByStage, taskStageKind } from './stage-state';
import type { Task, Stage } from './schema';

/**
 * The board's four warnings, as one definition.
 *
 * The pills in the header show a count and the board can be filtered to the
 * tasks behind one of them, so the rule has to live in a single place: a pill
 * reading "Overdue 6" over a board showing five is worse than no pill at all.
 */
export const BOARD_WARNING_KINDS = ['in-progress', 'high-priority', 'overdue', 'stale'] as const;

export type BoardWarningKind = (typeof BOARD_WARNING_KINDS)[number];

/** A task untouched for this many days is stale. Shared with the card highlight. */
export const STALE_AFTER_DAYS = 14;

/**
 * "Many in progress" only warns above this many — fewer than this is a working
 * board, not a problem. The other three warn on their first task.
 */
export const MANY_IN_PROGRESS_THRESHOLD = 3;

/**
 * Whether one task is behind `kind`. Only a task the main board shows can be
 * behind anything: archived and binned tasks are off the board, and a closed
 * one (done or abandoned) has stopped accruing warnings — its clock stopped
 * when it closed, so an untouched Done card is finished, not stale.
 */
export function matchesBoardWarning(
  task: Task,
  kind: BoardWarningKind,
  stages: Stage[],
  now: Date,
): boolean {
  if (task.archived || task.deletedAt) return false;

  switch (kind) {
    case 'in-progress':
      return taskStageKind(task, stages) === STAGE_KIND.IN_PROGRESS;
    // A waiting column is its own kind now, so parked high-priority work no
    // longer counts here: it is blocked, not neglected in the backlog.
    case 'high-priority':
      return (
        taskStageKind(task, stages) === STAGE_KIND.BACKLOG &&
        (task.priority === TASK_PRIORITY.HIGH || task.priority === TASK_PRIORITY.CRITICAL)
      );
    // The same helper the card highlight and the export's `overdue` list use,
    // so the three cannot disagree about what overdue means.
    case 'overdue':
      return isTaskOverdueOn(task, stages, now);
    // The same gate `overdue` applies through `isTaskOverdueOn`, so neither
    // pill counts work that is already finished.
    case 'stale':
      if (isClosedTaskByStage(task, stages)) return false;
      return task.updatedAt
        ? differenceInDays(now, new Date(task.updatedAt)) >= STALE_AFTER_DAYS
        : false;
  }
}

/** The tasks behind `kind`, in the order they were given. */
export function tasksMatchingBoardWarning<T extends Task>(
  tasks: T[],
  kind: BoardWarningKind,
  stages: Stage[],
  now: Date,
): T[] {
  return tasks.filter((task) => matchesBoardWarning(task, kind, stages, now));
}

/**
 * How many tasks sit behind each warning. A kind is absent when it has nothing
 * to say — below its threshold, or empty.
 */
export function countBoardWarnings(
  tasks: Task[],
  stages: Stage[],
  now: Date,
): Partial<Record<BoardWarningKind, number>> {
  const counts: Partial<Record<BoardWarningKind, number>> = {};

  for (const kind of BOARD_WARNING_KINDS) {
    const count = tasksMatchingBoardWarning(tasks, kind, stages, now).length;
    const threshold = kind === 'in-progress' ? MANY_IN_PROGRESS_THRESHOLD : 0;
    if (count > threshold) counts[kind] = count;
  }

  return counts;
}
