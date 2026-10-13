import { describe, it, expect } from 'vitest';
import type { Stage, Task } from './schema';
import {
  stageKind,
  taskStageKind,
  isClosedTaskByStage,
  closedStages,
  stageIdForLegacyStatus,
} from './stage-state';

const stage = (id: number, name: string, kind: string, order: number): Stage =>
  ({ id, name, order, kind, color: null, createdAt: null }) as Stage;

// Deliberately out of board order, and with two columns of one kind, so the
// "first in board order" rules below are actually exercised.
const stages: Stage[] = [
  stage(3, 'Done  ✔', 'done', 4),
  stage(1, 'Inbox', 'backlog', 1),
  stage(2, 'Doing', 'in_progress', 2),
  stage(5, 'Cancelled', 'abandoned', 5),
  stage(4, 'Waiting ✋️ ', 'waiting', 3),
  stage(6, 'Someday', 'backlog', 6),
];

const task = (stageId: number): Task => ({ id: 1, stageId }) as Task;

describe('stageKind', () => {
  it('reads the column’s own kind, not its name', () => {
    // "Done  ✔" is a done column because it says so, and "Inbox" is a backlog
    // column though nothing in the word says it.
    expect(stageKind(stages[0])).toBe('done');
    expect(stageKind(stages[1])).toBe('backlog');
  });

  it('falls back to backlog for a stage with no kind, or an unknown one', () => {
    // A stage from an older export, or hand-inserted: a card in the wrong
    // column beats a board that will not render.
    expect(stageKind({ id: 9, name: 'Legacy' } as Stage)).toBe('backlog');
    expect(stageKind({ id: 9, name: 'Odd', kind: 'archived' } as unknown as Stage)).toBe('backlog');
    expect(stageKind(undefined)).toBe('backlog');
  });
});

describe('taskStageKind', () => {
  it('gives a task the kind of the column it sits in', () => {
    expect(taskStageKind(task(2), stages)).toBe('in_progress');
    expect(taskStageKind(task(4), stages)).toBe('waiting');
  });

  it('falls back to backlog when the task’s stage is not on this board', () => {
    expect(taskStageKind(task(999), stages)).toBe('backlog');
  });
});

describe('isClosedTaskByStage', () => {
  it('closes done and abandoned work, and nothing else', () => {
    expect(isClosedTaskByStage(task(3), stages)).toBe(true);
    expect(isClosedTaskByStage(task(5), stages)).toBe(true);
    expect(isClosedTaskByStage(task(1), stages)).toBe(false);
    expect(isClosedTaskByStage(task(2), stages)).toBe(false);
    // Parked is not finished.
    expect(isClosedTaskByStage(task(4), stages)).toBe(false);
  });
});

describe('closedStages', () => {
  it('returns done and abandoned columns in board order', () => {
    expect(closedStages(stages).map((s) => s.id)).toEqual([3, 5]);
  });
});

describe('stageIdForLegacyStatus', () => {
  it('maps a pre-EPIC-03 status to the first column of that kind', () => {
    expect(stageIdForLegacyStatus(stages, 'in_progress')).toBe(2);
    expect(stageIdForLegacyStatus(stages, 'done')).toBe(3);
    expect(stageIdForLegacyStatus(stages, 'abandoned')).toBe(5);
    // Two backlog columns: the earlier one in board order wins.
    expect(stageIdForLegacyStatus(stages, 'backlog')).toBe(1);
  });

  it('returns null for a status it cannot use, so the caller falls back', () => {
    expect(stageIdForLegacyStatus(stages, 'waiting')).toBe(null);
    expect(stageIdForLegacyStatus(stages, undefined)).toBe(null);
    expect(stageIdForLegacyStatus(stages, '')).toBe(null);
  });

  it('returns null rather than inventing a column this board does not have', () => {
    const noDone = stages.filter((s) => s.kind !== 'done');
    expect(stageIdForLegacyStatus(noDone, 'done')).toBe(null);
  });
});
