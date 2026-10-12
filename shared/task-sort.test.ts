import { describe, it, expect } from 'vitest';
import { compareTasksByDueDate, sortTasksByDueDate, sortTasksByOwner } from './task-sort';
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

describe('sortTasksByOwner (EPIC-06)', () => {
  const owned = (id: number, ownerId: number | null, dueDate: string | null = null): Task =>
    ({ ...task(id, dueDate), ownerId }) as Task;

  // The board resolves an id to a name; 'moira' is lower-case on purpose, to
  // show the comparison ignores case rather than sorting by code point.
  const ownerNameOf = (id: number | null) =>
    id === 1 ? 'Rich' : id === 2 ? 'Moi' : id === 3 ? 'moira' : null;

  it('groups by owner name, case-insensitively, with the unassigned last', () => {
    const tasks = [owned(1, null), owned(2, 1), owned(3, 2), owned(4, 3)];

    expect(ids(sortTasksByOwner(tasks, ownerNameOf))).toEqual([3, 4, 2, 1]);
  });

  it("keeps the board's own order inside one owner — soonest due first", () => {
    const tasks = [
      owned(1, 1, '2026-10-20T12:00:00Z'),
      owned(2, 1, null),
      owned(3, 1, '2026-10-13T12:00:00Z'),
    ];

    expect(ids(sortTasksByOwner(tasks, ownerNameOf))).toEqual([3, 1, 2]);
  });

  it('does not mutate the array it is given', () => {
    const tasks = [owned(1, 2), owned(2, 1)];
    sortTasksByOwner(tasks, ownerNameOf);

    expect(ids(tasks)).toEqual([1, 2]);
  });

  it('treats an owner the board has not loaded as unassigned', () => {
    const tasks = [owned(1, 99), owned(2, 1)];

    expect(ids(sortTasksByOwner(tasks, ownerNameOf))).toEqual([2, 1]);
  });
});
