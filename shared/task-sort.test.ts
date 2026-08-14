import { describe, it, expect } from 'vitest';
import { compareTasksByDueDate, sortTasksByDueDate } from './task-sort';
import type { Task } from './schema';

function task(id: number, dueDate: string | null): Task {
  return { id, dueDate: dueDate ? new Date(dueDate) : null } as Task;
}

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe('task-sort', () => {
  describe('compareTasksByDueDate', () => {
    it('orders the sooner due date first', () => {
      expect(
        compareTasksByDueDate(task(1, '2026-11-13T11:00:00Z'), task(2, '2026-08-20T12:00:00Z')),
      ).toBeGreaterThan(0);
    });

    it('sorts a task with no due date after one with a due date', () => {
      expect(compareTasksByDueDate(task(1, null), task(2, '2026-08-20T12:00:00Z'))).toBe(1);
      expect(compareTasksByDueDate(task(1, '2026-08-20T12:00:00Z'), task(2, null))).toBe(-1);
    });

    it('breaks ties on id so the order is total', () => {
      const due = '2026-08-20T12:00:00Z';
      expect(compareTasksByDueDate(task(5, due), task(9, due))).toBeLessThan(0);
      expect(compareTasksByDueDate(task(9, null), task(5, null))).toBeGreaterThan(0);
    });
  });

  describe('sortTasksByDueDate', () => {
    it('puts the soonest first and the undated last', () => {
      const sorted = sortTasksByDueDate([
        task(1, null),
        task(2, '2026-12-10T11:00:00Z'),
        task(3, '2026-08-20T12:00:00Z'),
        task(4, null),
        task(5, '2026-09-17T12:00:00Z'),
      ]);
      expect(ids(sorted)).toEqual([3, 5, 2, 1, 4]);
    });

    it('orders overdue tasks ahead of upcoming ones', () => {
      const sorted = sortTasksByDueDate([
        task(1, '2026-08-20T12:00:00Z'),
        task(2, '2026-08-05T12:00:00Z'),
      ]);
      expect(ids(sorted)).toEqual([2, 1]);
    });

    it('does not mutate the input array', () => {
      const input = [task(1, '2026-12-10T11:00:00Z'), task(2, '2026-08-20T12:00:00Z')];
      sortTasksByDueDate(input);
      expect(ids(input)).toEqual([1, 2]);
    });

    it('is stable across repeated sorts of an already sorted list', () => {
      const once = sortTasksByDueDate([
        task(3, null),
        task(1, '2026-08-20T12:00:00Z'),
        task(2, null),
      ]);
      expect(ids(sortTasksByDueDate(once))).toEqual(ids(once));
    });
  });
});
