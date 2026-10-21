import { describe, expect, it } from 'vitest';
import type { Task } from '@shared/schema';
import { inboxTasks, isNewTask } from './inbox';

const task = (overrides: Partial<Task>): Task =>
  ({
    id: 1,
    title: 'Task',
    archived: false,
    viewedAt: new Date(),
    createdAt: new Date(2026, 9, 1),
    ...overrides,
  }) as Task;

describe('the inbox', () => {
  it('holds the tasks nobody has opened, newest first', () => {
    const tasks = [
      task({ id: 1, viewedAt: null, createdAt: new Date(2026, 9, 1) }),
      task({ id: 2 }),
      task({ id: 3, viewedAt: null, createdAt: new Date(2026, 9, 3) }),
      // Archived before anyone opened it: it is not waiting for anyone.
      task({ id: 4, viewedAt: null, archived: true }),
    ];
    expect(inboxTasks(tasks).map((t) => t.id)).toEqual([3, 1]);
  });

  it('counts a task as new until it is opened', () => {
    expect(isNewTask({ viewedAt: null })).toBe(true);
    expect(isNewTask({ viewedAt: new Date() })).toBe(false);
  });
});
