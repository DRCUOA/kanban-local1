import type { Task } from './schema';

/**
 * Default board ordering: soonest due first.
 *
 * Compares the raw `dueDate` instants rather than deriving calendar days.
 * Ordering by instant and ordering by board-local day agree (every stored
 * value is that day's local midnight), and comparing instants avoids the
 * timezone hazard `shared/briefing.ts` warns about when a *date* is needed.
 *
 * Tasks with no due date sort last — an undated task is not urgent, and
 * sorting them first would bury the dated ones the board exists to surface.
 *
 * Falls back to `id` so the order is total and stable: without it, equal due
 * dates would render in whatever order the array arrived in, which changes
 * under drag-and-drop's optimistic updates.
 */
export function compareTasksByDueDate(a: Task, b: Task): number {
  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : null;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : null;

  if (aDue !== bDue) {
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    return aDue - bDue;
  }

  return a.id - b.id;
}

/** Non-mutating sort — callers hold arrays owned by the query cache. */
export function sortTasksByDueDate<T extends Task>(tasks: T[]): T[] {
  return [...tasks].sort(compareTasksByDueDate);
}
