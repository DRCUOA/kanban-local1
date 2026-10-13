import { describe, it, expect } from 'vitest';
import type { Stage, Task } from './schema';
import { getTaskWarningHighlight } from './task-warning-highlight';
import { STALE_AFTER_DAYS } from './board-warnings';

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, kind: 'backlog', color: null, createdAt: null },
  { id: 2, name: 'In Progress', order: 2, kind: 'in_progress', color: null, createdAt: null },
  { id: 3, name: 'Done', order: 3, kind: 'done', color: null, createdAt: null },
  { id: 4, name: 'Cancelled', order: 4, kind: 'abandoned', color: null, createdAt: null },
];

/** Comfortably past the stale threshold, whenever the suite runs. */
const untouched = () => {
  const d = new Date();
  d.setDate(d.getDate() - (STALE_AFTER_DAYS + 7));
  return d;
};

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 1,
    title: 'A task',
    stageId: 1,
    archived: false,
    deletedAt: null,
    priority: 'normal',
    dueDate: null,
    updatedAt: new Date(),
    tags: null,
    owner: null,
    ownerId: null,
    ...overrides,
  }) as Task;

describe('getTaskWarningHighlight', () => {
  it('flags an open task left untouched past the threshold', () => {
    expect(getTaskWarningHighlight(task({ updatedAt: untouched() }), stages)).toBe('stale');
  });

  it('does not flag a card in a closed column as stale, done or abandoned', () => {
    expect(getTaskWarningHighlight(task({ updatedAt: untouched(), stageId: 3 }), stages)).toBe(
      null,
    );
    expect(getTaskWarningHighlight(task({ updatedAt: untouched(), stageId: 4 }), stages)).toBe(
      null,
    );
  });

  it('does not flag a task the main board does not show', () => {
    expect(getTaskWarningHighlight(task({ updatedAt: untouched(), archived: true }), stages)).toBe(
      null,
    );
    expect(
      getTaskWarningHighlight(task({ updatedAt: untouched(), deletedAt: new Date() }), stages),
    ).toBe(null);
  });

  it('keeps overdue ahead of high-priority backlog, and both ahead of stale', () => {
    const pastDue = new Date(2020, 0, 1);

    expect(
      getTaskWarningHighlight(
        task({ dueDate: pastDue, priority: 'critical', updatedAt: untouched() }),
        stages,
      ),
    ).toBe('overdue');
    expect(
      getTaskWarningHighlight(task({ priority: 'high', updatedAt: untouched() }), stages),
    ).toBe('high_priority_backlog');
  });
});
