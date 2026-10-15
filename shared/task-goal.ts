import { TASK_TYPE } from './constants';

/** The fields of a task the goal-link rules read. */
export interface GoalLinkTask {
  id?: number;
  type: string | null;
  goalTaskId: number | null;
}

/**
 * Normalises a write so the stored row can never claim a goal it has no right
 * to: only a `building-block` carries a `goalTaskId`, so any other type
 * (including unset) clears it.
 */
export function normaliseGoalLink<T extends { type?: string | null; goalTaskId?: number | null }>(
  merged: T,
): T {
  if (merged.type !== TASK_TYPE.BUILDING_BLOCK && merged.goalTaskId != null) {
    return { ...merged, goalTaskId: null };
  }
  return merged;
}

/**
 * Returns a user-facing message when `goalTaskId` is not a valid target for a
 * building-block, or null. Mirrors the database trigger (migration 0017) so
 * the API answers 400 with words rather than surfacing a constraint error.
 *
 * `target` is the row `goalTaskId` points at, or undefined when none exists.
 */
export function goalLinkError(
  goalTaskId: number | null | undefined,
  target: GoalLinkTask | undefined,
  selfId?: number,
): string | null {
  if (goalTaskId == null) return null;
  if (selfId !== undefined && goalTaskId === selfId) return 'A task cannot be its own goal';
  if (!target) return `Unknown goal task ${goalTaskId}`;
  if (target.type !== TASK_TYPE.GOAL) return `Task ${goalTaskId} is not a goal`;
  return null;
}
