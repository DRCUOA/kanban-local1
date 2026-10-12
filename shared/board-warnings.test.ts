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

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, color: null, createdAt: null },
  { id: 2, name: 'In Progress', order: 2, color: null, createdAt: null },
  { id: 3, name: 'Done', order: 3, color: null, createdAt: null },
];

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 1,
    title: 'A task',
    stageId: 1,
    archived: false,
    status: 'backlog',
    priority: 'normal',
    dueDate: null,
    updatedAt: NOW,
    tags: null,
    owner: null,
    ownerId: null,
    ...overrides,
  }) as Task;

describe('matchesBoardWarning', () => {
  it('matches in-progress work by the status the board renders', () => {
    expect(
      matchesBoardWarning(task({ stageId: 2, status: 'in_progress' }), 'in-progress', stages, NOW),
    ).toBe(true);
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
        task({ priority: 'high', stageId: 2, status: 'in_progress' }),
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
      matchesBoardWarning(task({ dueDate: pastDue, status: 'done' }), 'overdue', stages, NOW),
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

  it('never matches an archived task', () => {
    const archived = task({ archived: true, priority: 'critical', dueDate: new Date(2026, 0, 1) });

    expect(matchesBoardWarning(archived, 'high-priority', stages, NOW)).toBe(false);
    expect(matchesBoardWarning(archived, 'overdue', stages, NOW)).toBe(false);
  });
});

describe('countBoardWarnings', () => {
  const inProgress = (id: number) => task({ id, stageId: 2, status: 'in_progress' });

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
        task({ id: 3, updatedAt: new Date(2026, 0, 1) }),
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
