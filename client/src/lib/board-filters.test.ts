import { describe, expect, it } from 'vitest';
import type { Stage, Task } from '@shared/schema';
import {
  EMPTY_BOARD_FILTERS,
  boardColumnStages,
  boardFiltersActive,
  endOfDueDay,
  parseBoardFilters,
  tasksOnBoard,
  toggleInList,
  type BoardFilters,
} from './board-filters';

const stage = (id: number, kind: string, order: number): Stage =>
  ({ id, name: `S${id}`, order, kind, color: null, createdAt: new Date() }) as Stage;
const stages = [stage(1, 'backlog', 1), stage(2, 'in_progress', 2), stage(3, 'done', 3)];

const task = (overrides: Partial<Task>): Task =>
  ({
    id: 1,
    title: 'Task',
    stageId: 1,
    archived: false,
    projectId: null,
    ownerId: null,
    goalTaskId: null,
    dueDate: null,
    viewedAt: new Date(),
    ...overrides,
  }) as Task;

const filters = (patch: Partial<BoardFilters>): BoardFilters => ({
  ...EMPTY_BOARD_FILTERS,
  ...patch,
});

describe('board columns', () => {
  it('draws the open columns by default and the chosen ones when there are some', () => {
    expect(boardColumnStages(stages, EMPTY_BOARD_FILTERS).map((s) => s.id)).toEqual([1, 2]);
    expect(boardColumnStages(stages, filters({ stages: [3, 1] })).map((s) => s.id)).toEqual([1, 3]);
  });

  it('draws every column for "Archived before", whose tasks are mostly done', () => {
    const archived = filters({ due: 'archived', dueDate: '2026-10-31' });
    expect(boardColumnStages(stages, archived).map((s) => s.id)).toEqual([1, 2, 3]);
  });
});

describe('tasksOnBoard', () => {
  const live = [
    task({ id: 1, stageId: 1 }),
    task({ id: 2, stageId: 2 }),
    // Done and live: behind Filing, so not on the board unless Done is chosen.
    task({ id: 3, stageId: 3 }),
  ];
  const archived = [task({ id: 4, stageId: 3, archived: true, dueDate: new Date(2026, 9, 2) })];

  it('counts what the board shows: open columns only, unless a closed one is chosen', () => {
    const ids = (f: BoardFilters) => tasksOnBoard(live, archived, f, { stages }).map((t) => t.id);
    expect(ids(EMPTY_BOARD_FILTERS)).toEqual([1, 2]);
    expect(ids(filters({ stages: [3] }))).toEqual([3]);
    expect(ids(filters({ due: 'archived', dueDate: '2026-10-31' }))).toEqual([4]);
  });
});

describe('the helpers', () => {
  it('reads a due day to its last millisecond, and refuses a bad one', () => {
    expect(endOfDueDay('2026-10-31')?.getHours()).toBe(23);
    expect(endOfDueDay('31/10/2026')).toBeNull();
    expect(endOfDueDay('')).toBeNull();
  });

  it('is active only while a row narrows', () => {
    expect(boardFiltersActive(EMPTY_BOARD_FILTERS)).toBe(false);
    expect(boardFiltersActive(filters({ due: 'open', dueDate: '' }))).toBe(false);
    expect(boardFiltersActive(filters({ due: 'open', dueDate: '2026-10-31' }))).toBe(true);
    expect(boardFiltersActive(filters({ owners: ['none'] }))).toBe(true);
  });

  it('toggles an id in and out of a list', () => {
    expect(toggleInList([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleInList([1, 2], 1)).toEqual([2]);
  });

  it('keeps only the well-formed parts of a stored value', () => {
    expect(parseBoardFilters(null)).toEqual(EMPTY_BOARD_FILTERS);
    expect(
      parseBoardFilters({
        projects: [1, 'none', 'x', -2, 1],
        goals: ['3'],
        owners: [4],
        stages: [5, 0],
        due: 'sometime',
        dueDate: 'tomorrow',
        onlyNew: 'yes',
      }),
    ).toEqual({
      ...EMPTY_BOARD_FILTERS,
      projects: [1, 'none'],
      owners: [4],
      stages: [5],
    });
    expect(parseBoardFilters({ due: 'open', dueDate: '2026-10-31', onlyNew: true })).toMatchObject({
      due: 'open',
      dueDate: '2026-10-31',
      onlyNew: true,
    });
  });
});
