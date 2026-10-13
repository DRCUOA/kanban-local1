import { describe, it, expect } from 'vitest';
import type { Stage, Task } from './schema';
import {
  countBoardWarnings,
  matchesBoardWarning,
  tasksMatchingBoardWarning,
  MANY_IN_PROGRESS_THRESHOLD,
  STALE_AFTER_DAYS,
} from './board-warnings';

const NOW = new Date(2026, 9, 12, 12, 0, 0);

// A task's state is the kind of the column it sits in, so these fixtures say
// it by `stageId` rather than by a status of their own (EPIC-03 story 2).
const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, kind: 'backlog', color: null, createdAt: null },
  { id: 2, name: 'In Progress', order: 2, kind: 'in_progress', color: null, createdAt: null },
  { id: 3, name: 'Done', order: 3, kind: 'done', color: null, createdAt: null },
  { id: 4, name: 'Waiting', order: 4, kind: 'waiting', color: null, createdAt: null },
  { id: 5, name: 'Cancelled', order: 5, kind: 'abandoned', color: null, createdAt: null },
];

const IN_BACKLOG = 1;
const IN_PROGRESS = 2;
const IN_DONE = 3;
const IN_WAITING = 4;
const IN_ABANDONED = 5;

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 1,
    title: 'A task',
    stageId: IN_BACKLOG,
    archived: false,
    deletedAt: null,
    priority: 'normal',
    dueDate: null,
    updatedAt: NOW,
    tags: null,
    owner: null,
    ownerId: null,
    ...overrides,
  }) as Task;

describe('matchesBoardWarning', () => {
  it('matches in-progress work by the column the board renders it in', () => {
    expect(matchesBoardWarning(task({ stageId: IN_PROGRESS }), 'in-progress', stages, NOW)).toBe(
      true,
    );
    expect(matchesBoardWarning(task(), 'in-progress', stages, NOW)).toBe(false);
  });

  it('matches high-priority work only while it is still waiting', () => {
    expect(matchesBoardWarning(task({ priority: 'high' }), 'high-priority', stages, NOW)).toBe(
      true,
    );
    expect(matchesBoardWarning(task({ priority: 'critical' }), 'high-priority', stages, NOW)).toBe(
      true,
    );
    expect(
      matchesBoardWarning(
        task({ priority: 'high', stageId: IN_PROGRESS }),
        'high-priority',
        stages,
        NOW,
      ),
    ).toBe(false);
    // A waiting column is its own kind, so parked work is not backlog work.
    expect(
      matchesBoardWarning(
        task({ priority: 'high', stageId: IN_WAITING }),
        'high-priority',
        stages,
        NOW,
      ),
    ).toBe(false);
  });

  it('does not call a closed task overdue, whatever due date it was left with', () => {
    const pastDue = new Date(2026, 0, 1);
    expect(matchesBoardWarning(task({ dueDate: pastDue }), 'overdue', stages, NOW)).toBe(true);
    expect(
      matchesBoardWarning(task({ dueDate: pastDue, stageId: IN_DONE }), 'overdue', stages, NOW),
    ).toBe(false);
  });

  it('calls a task stale on the day it reaches the threshold, not before', () => {
    const justUnder = new Date(NOW);
    justUnder.setDate(justUnder.getDate() - (STALE_AFTER_DAYS - 1));
    const exactly = new Date(NOW);
    exactly.setDate(exactly.getDate() - STALE_AFTER_DAYS);

    expect(matchesBoardWarning(task({ updatedAt: justUnder }), 'stale', stages, NOW)).toBe(false);
    expect(matchesBoardWarning(task({ updatedAt: exactly }), 'stale', stages, NOW)).toBe(true);
  });

  it('does not call a closed task stale, however long it has sat untouched', () => {
    const longAgo = new Date(2026, 0, 1);

    expect(matchesBoardWarning(task({ updatedAt: longAgo }), 'stale', stages, NOW)).toBe(true);
    // A finished card is finished, not neglected — either way it finished.
    expect(
      matchesBoardWarning(task({ updatedAt: longAgo, stageId: IN_DONE }), 'stale', stages, NOW),
    ).toBe(false);
    expect(
      matchesBoardWarning(
        task({ updatedAt: longAgo, stageId: IN_ABANDONED }),
        'stale',
        stages,
        NOW,
      ),
    ).toBe(false);
    // Still open, just parked: a waiting card can go stale.
    expect(
      matchesBoardWarning(task({ updatedAt: longAgo, stageId: IN_WAITING }), 'stale', stages, NOW),
    ).toBe(true);
  });

  it('never matches a task the main board does not show', () => {
    const longAgo = new Date(2026, 0, 1);
    const offBoard = (overrides: Partial<Task>) =>
      task({ ...overrides, priority: 'critical', dueDate: longAgo, updatedAt: longAgo });

    for (const gone of [offBoard({ archived: true }), offBoard({ deletedAt: longAgo })]) {
      expect(matchesBoardWarning(gone, 'high-priority', stages, NOW)).toBe(false);
      expect(matchesBoardWarning(gone, 'overdue', stages, NOW)).toBe(false);
      expect(matchesBoardWarning(gone, 'stale', stages, NOW)).toBe(false);
    }
  });

  it('never matches an archived task', () => {
    const archived = task({ archived: true, priority: 'critical', dueDate: new Date(2026, 0, 1) });

    expect(matchesBoardWarning(archived, 'high-priority', stages, NOW)).toBe(false);
    expect(matchesBoardWarning(archived, 'overdue', stages, NOW)).toBe(false);
  });
});

describe('countBoardWarnings', () => {
  const inProgress = (id: number) => task({ id, stageId: IN_PROGRESS });

  it('stays quiet about a working number of tasks in progress', () => {
    const tasks = Array.from({ length: MANY_IN_PROGRESS_THRESHOLD }, (_, i) => inProgress(i + 1));

    expect(countBoardWarnings(tasks, stages, NOW)['in-progress']).toBeUndefined();
  });

  it('counts in-progress work once it is above the threshold', () => {
    const tasks = Array.from({ length: MANY_IN_PROGRESS_THRESHOLD + 1 }, (_, i) =>
      inProgress(i + 1),
    );

    expect(countBoardWarnings(tasks, stages, NOW)['in-progress']).toBe(
      MANY_IN_PROGRESS_THRESHOLD + 1,
    );
  });

  it('warns about the other three on their first task', () => {
    const counts = countBoardWarnings(
      [
        task({ id: 1, priority: 'high' }),
        task({ id: 2, dueDate: new Date(2026, 0, 1) }),
        task({ id: 3, updatedAt: new Date(2026, 0, 1) }), // open and untouched: stale
      ],
      stages,
      NOW,
    );

    expect(counts['high-priority']).toBe(1);
    expect(counts.overdue).toBe(1);
    expect(counts.stale).toBe(1);
  });

  it('agrees with the tasks the same warning selects', () => {
    // The pill's number and the filtered board are the same rule, read twice.
    const tasks = [
      task({ id: 1, priority: 'high' }),
      task({ id: 2, priority: 'critical' }),
      task({ id: 3 }),
    ];

    expect(countBoardWarnings(tasks, stages, NOW)['high-priority']).toBe(
      tasksMatchingBoardWarning(tasks, 'high-priority', stages, NOW).length,
    );
  });
});
