import {
  STAGE_KIND,
  DEFAULT_STAGE_KIND,
  isStageKind,
  isClosedStageKind,
  legacyStatusToStageKind,
  type StageKindValue,
} from './constants';
import type { Task, Stage } from './schema';

/**
 * A task's state, resolved the one way there is to resolve it: the kind of the
 * column it sits in.
 *
 * Before EPIC-03 this was a negotiation. `tasks.status` carried a state of its
 * own, `getStatusFromStageName` recovered a second one from the column's
 * display name, and five call sites each reconciled the two slightly
 * differently — which is how the board came to render one answer while the
 * briefing agent filtered on another. There is nothing left to reconcile.
 */
export function taskStageKind(task: Task, stages: Stage[]): StageKindValue {
  return stageKind(stages.find((s) => s.id === task.stageId));
}

/**
 * One stage's kind, tolerating rows that predate the column. A stage read from
 * an old export, or hand-inserted, may carry no kind or an unknown one; both
 * fall back to backlog rather than throwing, because a board that will not
 * render is worse than a card in the wrong column.
 */
export function stageKind(stage: Stage | undefined | null): StageKindValue {
  const kind = (stage as { kind?: unknown } | undefined | null)?.kind;
  return isStageKind(kind) ? kind : DEFAULT_STAGE_KIND;
}

/** True when the task's work is over, however it ended. */
export function isClosedTaskByStage(task: Task, stages: Stage[]): boolean {
  return isClosedStageKind(taskStageKind(task, stages));
}

/** The stages of a given kind, in board order. */
export function stagesOfKind(stages: Stage[], ...kinds: StageKindValue[]): Stage[] {
  return [...stages].sort((a, b) => a.order - b.order).filter((s) => kinds.includes(stageKind(s)));
}

/**
 * The stages holding finished work — done and abandoned. The board parks these
 * in a strip above the archive zone instead of giving them a column, and the
 * Filing menu offers them as somewhere to put a card that is over.
 *
 * Both kinds, not just `done`: that is what the old name matching did by
 * accident, since 'abandoned' contains 'done', and it is the right answer on
 * purpose — the strip is for work that has stopped, either way it stopped.
 */
export function closedStages(stages: Stage[]): Stage[] {
  return stagesOfKind(stages, STAGE_KIND.DONE, STAGE_KIND.ABANDONED);
}

/**
 * Where a task from a pre-EPIC-03 export file belongs on this board.
 *
 * Such a file carries a `status` per task and stages with no `kind`. The
 * status is still honoured, but as a way of choosing a column rather than a
 * field to store: map it to a kind, then to the first column of that kind in
 * board order. Returns null when the file says nothing usable, or when this
 * board has no column of that kind — the caller then falls back, rather than
 * inventing a column (EPIC-03 story 2, criterion 4).
 *
 * `waiting` never comes back, because the old status enum could not say it.
 */
export function stageIdForLegacyStatus(stages: Stage[], status: unknown): number | null {
  const kind = legacyStatusToStageKind(status);
  if (kind === null) return null;
  return stagesOfKind(stages, kind)[0]?.id ?? null;
}
