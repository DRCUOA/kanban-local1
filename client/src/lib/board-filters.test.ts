import { describe, expect, it } from 'vitest';
import type { Stage, Task } from '@shared/schema';
import {
  EMPTY_BOARD_FILTERS,
  boardColumnStages,
  boardFiltersActive,
  goalsOnOffer,
  matchesBoardFilters,
  parseBoardFilters,
  tasksOnBoard,
  tasksOnOffer,
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
});

describe('tasksOnBoard', () => {
  const live = [
    task({ id: 1, stageId: 1 }),
    task({ id: 2, stageId: 2, ownerId: 7 }),
    // Done and live: behind Filing, so not on the board unless Done is chosen.
    task({ id: 3, stageId: 3 }),
    // Archived work is never on the board.
    task({ id: 4, stageId: 1, archived: true }),
  ];

  it('counts what the board shows: open columns only, unless a closed one is chosen', () => {
    const ids = (f: BoardFilters) => tasksOnBoard(live, f, stages).map((t) => t.id);
    expect(ids(EMPTY_BOARD_FILTERS)).toEqual([1, 2]);
    expect(ids(filters({ stages: [3] }))).toEqual([3]);
    expect(ids(filters({ owners: [7] }))).toEqual([2]);
    expect(ids(filters({ owners: ['none'] }))).toEqual([1]);
  });
});

describe('goalsOnOffer', () => {
  const goal = (id: number, overrides: Partial<Task> = {}) =>
    task({ id, title: `Goal ${id}`, type: 'goal', ...overrides });
  const tasks = [
    goal(1, { projectId: 1 }),
    goal(2, { projectId: 2 }),
    // Done: closed, so it drops out of the Goal row.
    goal(3, { projectId: 1, stageId: 3 }),
    goal(4, { projectId: 1, archived: true }),
    task({ id: 5, projectId: 1 }),
  ];
  const ids = (projects: BoardFilters['projects'], chosen: number[] = []) =>
    goalsOnOffer(tasks, stages, projects, chosen).map((t) => t.id);

  it('offers the open goals inside the chosen projects', () => {
    expect(ids([])).toEqual([1, 2]);
    expect(ids([1])).toEqual([1]);
    expect(ids(['none'])).toEqual([]);
  });

  it('keeps a closed goal while it is chosen, so it can be unticked, but never an archived one', () => {
    expect(ids([1], [3])).toEqual([1, 3]);
    expect(ids([1], [4])).toEqual([1]);
  });
});

describe('the task stage', () => {
  const tasks = [
    task({ id: 1, title: 'Launch', type: 'goal', projectId: 1 }),
    task({ id: 2, title: 'Build', goalTaskId: 1, projectId: 1 }),
    task({ id: 3, title: 'Approve', goalTaskId: 1, projectId: 1, stageId: 3 }),
    task({ id: 4, title: 'Advertise', projectId: 1 }),
    task({ id: 5, title: 'Archived', goalTaskId: 1, projectId: 1, archived: true }),
    task({ id: 6, title: 'Elsewhere', projectId: 2 }),
  ];
  const ids = (projects: BoardFilters['projects'], goals: number[], chosen: number[] = []) =>
    tasksOnOffer(tasks, stages, projects, goals, chosen).map((t) => t.id);

  it('offers the open tasks, never goals, inside the projects and under the goals chosen', () => {
    expect(ids([], [])).toEqual([4, 2, 6]);
    expect(ids([1], [])).toEqual([4, 2]);
    // Under a goal means under it: a task with no goal is not offered.
    expect(ids([1], [1])).toEqual([2]);
    expect(ids([2], [1])).toEqual([]);
  });

  it('keeps a closed task while it is chosen, but never an archived one', () => {
    expect(ids([1], [1], [3])).toEqual([3, 2]);
    expect(ids([1], [1], [5])).toEqual([2]);
  });

  it('narrows the board to the tasks picked', () => {
    const [, build, , advertise] = tasks;
    expect(build && matchesBoardFilters(build, filters({ tasks: [2] }))).toBe(true);
    expect(advertise && matchesBoardFilters(advertise, filters({ tasks: [2] }))).toBe(false);
    expect(
      tasksOnBoard(tasks, filters({ goals: [1], tasks: [2] }), stages).map((t) => t.id),
    ).toEqual([2]);
  });
});

describe('the helpers', () => {
  it('is active only while a row narrows', () => {
    expect(boardFiltersActive(EMPTY_BOARD_FILTERS)).toBe(false);
    expect(boardFiltersActive(filters({ owners: ['none'] }))).toBe(true);
    expect(boardFiltersActive(filters({ stages: [3] }))).toBe(true);
    expect(boardFiltersActive(filters({ tasks: [7] }))).toBe(true);
  });

  it('toggles an id in and out of a list', () => {
    expect(toggleInList([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleInList([1, 2], 1)).toEqual([2]);
  });

  it('keeps only the well-formed parts of a stored value, and lets go of retired rows', () => {
    expect(parseBoardFilters(null)).toEqual(EMPTY_BOARD_FILTERS);
    expect(
      parseBoardFilters({
        projects: [1, 'none', 'x', -2, 1],
        goals: ['3'],
        tasks: [6, 'x', 6],
        owners: [4],
        stages: [5, 0],
        // A value from the build that had DUE BY and NEW TASKS rows.
        due: 'open',
        dueDate: '2026-10-31',
        onlyNew: true,
      }),
    ).toEqual({
      ...EMPTY_BOARD_FILTERS,
      projects: [1, 'none'],
      tasks: [6],
      owners: [4],
      stages: [5],
    });
  });
});
