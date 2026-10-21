// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilteredTasks } from './use-filtered-tasks';
import type { Task, Stage } from '@shared/schema';
import { EMPTY_BOARD_FILTERS, type BoardFilters } from '@/lib/board-filters';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Default task',
  description: null,
  stageId: 1,
  archived: false,
  deletedAt: null,
  viewedAt: new Date(),
  priority: 'normal',
  type: null,
  goalTaskId: null,
  effort: null,
  dueDate: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  tags: null,
  parentTaskId: null,
  recurrence: 'none',
  history: null,
  owner: null,
  ownerId: null,
  projectId: null,
  ...overrides,
});

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 0, kind: 'backlog', color: '#3B82F6', createdAt: new Date() },
  {
    id: 2,
    name: 'In Progress',
    order: 1,
    kind: 'in_progress',
    color: '#10B981',
    createdAt: new Date(),
  },
  { id: 3, name: 'Done', order: 2, kind: 'done', color: '#F59E0B', createdAt: new Date() },
  {
    id: 4,
    name: 'Cancelled',
    order: 3,
    kind: 'abandoned',
    color: '#6B7280',
    createdAt: new Date(),
  },
];

describe('useFilteredTasks', () => {
  it('returns all tasks when no search query and focus mode is off', () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2, title: 'Another' })];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: false, viewMode: 'detail', stages }),
    );
    expect(result.current).toHaveLength(2);
  });

  it('returns empty array when tasks is undefined', () => {
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks: undefined,
        searchQuery: '',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('filters tasks by title matching the search query', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Fix login bug' }),
      makeTask({ id: 2, title: 'Add dark mode' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks,
        searchQuery: 'login',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current.at(0)?.title).toBe('Fix login bug');
  });

  it('filters tasks by description matching the search query', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Task A', description: 'Related to authentication' }),
      makeTask({ id: 2, title: 'Task B', description: 'UI polish' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks,
        searchQuery: 'authentication',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current.at(0)?.id).toBe(1);
  });

  it('search is case-insensitive', () => {
    const tasks = [makeTask({ id: 1, title: 'Fix Login Bug' })];
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks,
        searchQuery: 'fix login',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current).toHaveLength(1);
  });

  it('treats a numeric query as an exact task ID lookup', () => {
    const tasks = [
      makeTask({ id: 16, title: 'Sixteen' }),
      makeTask({ id: 161, title: 'One sixty one' }),
      makeTask({ id: 1610, title: 'Mentions 161 in the title' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '161', focusMode: false, viewMode: 'detail', stages }),
    );
    expect(result.current.map((t) => t.id)).toEqual([161]);
  });

  it('accepts a #-prefixed and whitespace-padded ID query', () => {
    const tasks = [makeTask({ id: 161 }), makeTask({ id: 2 })];
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks,
        searchQuery: ' #161 ',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current.map((t) => t.id)).toEqual([161]);
  });

  it('returns an empty board when no task has the searched ID', () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2 })];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '999', focusMode: false, viewMode: 'detail', stages }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('finds an archived task by ID', () => {
    const tasks = [makeTask({ id: 1 })];
    const archivedTasks = [makeTask({ id: 161, title: 'Archived', archived: true })];
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks,
        archivedTasks,
        searchQuery: '161',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current.map((t) => t.id)).toEqual([161]);
    expect(result.current.at(0)?.archived).toBe(true);
  });

  it('ID lookup ignores focus mode, stage and progress filters', () => {
    const tasks = [makeTask({ id: 161, title: 'Done low', stageId: 3, priority: 'low' })];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '161', focusMode: true, viewMode: 'detail', stages }),
    );
    expect(result.current.map((t) => t.id)).toEqual([161]);
  });

  it('still does a text search for queries that are not purely numeric', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Ship v161 release' }),
      makeTask({ id: 161, title: 'Unrelated' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({
        tasks,
        searchQuery: 'v161',
        focusMode: false,
        viewMode: 'detail',
        stages,
      }),
    );
    expect(result.current.map((t) => t.id)).toEqual([1]);
  });

  it('in focus mode with summary view, returns only in_progress tasks and the highest-priority backlog task', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Backlog low', stageId: 1, priority: 'low' }),
      makeTask({
        id: 2,
        title: 'Backlog critical',
        stageId: 1,
        priority: 'critical',
      }),
      makeTask({ id: 3, title: 'Active', stageId: 2, priority: 'normal' }),
      makeTask({ id: 4, title: 'Done', stageId: 3, priority: 'normal' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: true, viewMode: 'summary', stages }),
    );

    const ids = result.current.map((t) => t.id);
    expect(ids).toContain(3);
    expect(ids).toContain(2);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(4);
  });

  it("in focus mode with summary view, reads each task's state from its column", () => {
    const tasks = [
      makeTask({ id: 1, title: 'In the backlog column', stageId: 1 }),
      makeTask({ id: 2, title: 'In the in-progress column', stageId: 2 }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: true, viewMode: 'summary', stages }),
    );

    const ids = result.current.map((t) => t.id);
    expect(ids).toContain(2);
    expect(ids).toContain(1);
  });

  it('in focus mode with detail view, returns only high/critical tasks that are not done or abandoned', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Backlog high', stageId: 1, priority: 'high' }),
      makeTask({
        id: 2,
        title: 'Backlog normal',
        stageId: 1,
        priority: 'normal',
      }),
      makeTask({
        id: 3,
        title: 'Active critical',
        stageId: 2,
        priority: 'critical',
      }),
      makeTask({ id: 4, title: 'Done high', stageId: 3, priority: 'high' }),
      makeTask({ id: 5, title: 'Abandoned critical', stageId: 4, priority: 'critical' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: true, viewMode: 'detail', stages }),
    );

    const ids = result.current.map((t) => t.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 3]);
  });

  it('in focus mode with detail view, excludes high-priority work sitting in a closed column', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Done but high', stageId: 3, priority: 'high' }),
      makeTask({ id: 2, title: 'Cancelled but high', stageId: 4, priority: 'high' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: true, viewMode: 'detail', stages }),
    );
    expect(result.current).toHaveLength(0);
  });
});

describe('useFilteredTasks and the header warning pills', () => {
  const overdue = makeTask({ id: 1, title: 'Overdue one', dueDate: new Date(2026, 0, 1) });
  const inProgress = makeTask({ id: 2, title: 'Doing', stageId: 2 });
  const waiting = makeTask({ id: 3, title: 'Urgent waiting', priority: 'high' });

  const filtered = (options: Parameters<typeof useFilteredTasks>[0]) =>
    renderHook(() => useFilteredTasks(options)).result.current.map((t) => t.id);

  const base = {
    tasks: [overdue, inProgress, waiting],
    searchQuery: '',
    focusMode: false,
    viewMode: 'detail' as const,
    stages,
  };

  it('shows every task while no pill is pressed', () => {
    expect(filtered(base)).toEqual([1, 2, 3]);
    expect(filtered({ ...base, warningFilter: null })).toEqual([1, 2, 3]);
  });

  it('shows only the tasks behind the pill that is pressed', () => {
    expect(filtered({ ...base, warningFilter: 'overdue' })).toEqual([1]);
    expect(filtered({ ...base, warningFilter: 'in-progress' })).toEqual([2]);
    expect(filtered({ ...base, warningFilter: 'high-priority' })).toEqual([3]);
  });

  it('narrows with the search box rather than replacing it', () => {
    expect(filtered({ ...base, warningFilter: 'high-priority', searchQuery: 'urgent' })).toEqual([
      3,
    ]);
    expect(filtered({ ...base, warningFilter: 'high-priority', searchQuery: 'overdue' })).toEqual(
      [],
    );
  });

  it('narrows with the owner filter rather than replacing it', () => {
    const mine = makeTask({ id: 4, title: 'Mine', priority: 'high', ownerId: 1 });
    const theirs = makeTask({ id: 5, title: 'Theirs', priority: 'high', ownerId: 2 });

    expect(
      filtered({
        ...base,
        tasks: [mine, theirs],
        warningFilter: 'high-priority',
        boardFilters: { ...EMPTY_BOARD_FILTERS, owners: [1] },
      }),
    ).toEqual([4]);
  });

  it('lets an ID search through, as every other filter does', () => {
    // The ID lookup is the one search that outranks the filters: asking for
    // task 2 by number means "show me task 2", wherever it is.
    expect(filtered({ ...base, warningFilter: 'overdue', searchQuery: '2' })).toEqual([2]);
  });
});

describe('useFilteredTasks goal filter', () => {
  it('shows the goal and its building-blocks only, together with other filters', () => {
    const goal = makeTask({ id: 10, title: 'Build a shed', type: 'goal' });
    const block = makeTask({ id: 11, title: 'Buy timber', type: 'building-block', goalTaskId: 10 });
    const other = makeTask({
      id: 12,
      title: 'Other block',
      type: 'building-block',
      goalTaskId: 99,
    });
    const loose = makeTask({ id: 13, title: 'Loose task' });
    const run = (goals: number[], searchQuery = '') =>
      renderHook(() =>
        useFilteredTasks({
          tasks: [goal, block, other, loose],
          searchQuery,
          focusMode: false,
          viewMode: 'detail',
          stages,
          boardFilters: { ...EMPTY_BOARD_FILTERS, goals },
        }),
      ).result.current.map((t) => t.id);
    expect(run([10]).sort()).toEqual([10, 11]);
    expect(run([10], 'timber')).toEqual([11]);
    expect(run([]).length).toBe(4);
  });
});

describe('useFilteredTasks and the landing page rows', () => {
  const run = (
    boardFilters: Partial<BoardFilters>,
    tasks: Task[],
    archivedTasks: Task[] = [],
    keepAsNew?: ReadonlySet<number>,
  ) =>
    renderHook(() =>
      useFilteredTasks({
        tasks,
        archivedTasks,
        searchQuery: '',
        focusMode: false,
        viewMode: 'detail',
        stages,
        boardFilters: { ...EMPTY_BOARD_FILTERS, ...boardFilters },
        keepAsNew,
      }),
    )
      .result.current.map((t) => t.id)
      .sort((a, b) => a - b);

  it('lets any of the chosen owners through, the unassigned included', () => {
    const tasks = [
      makeTask({ id: 1, ownerId: 1 }),
      makeTask({ id: 2, ownerId: 2 }),
      makeTask({ id: 3, ownerId: 3 }),
      makeTask({ id: 4, ownerId: null }),
    ];
    expect(run({ owners: [1, 3] }, tasks)).toEqual([1, 3]);
    expect(run({ owners: [2, 'none'] }, tasks)).toEqual([2, 4]);
  });

  it('narrows by several projects and by stage, each row with the others', () => {
    const tasks = [
      makeTask({ id: 1, projectId: 7, stageId: 1 }),
      makeTask({ id: 2, projectId: 8, stageId: 2 }),
      makeTask({ id: 3, projectId: 9, stageId: 1 }),
      makeTask({ id: 4, projectId: null, stageId: 1 }),
    ];
    expect(run({ projects: [7, 8] }, tasks)).toEqual([1, 2]);
    expect(run({ projects: [7, 'none'], stages: [1] }, tasks)).toEqual([1, 4]);
    expect(run({ projects: [7, 8], stages: [2] }, tasks)).toEqual([2]);
  });

  it('"Not done before" keeps open work due on or before the day, and nothing undated', () => {
    const tasks = [
      makeTask({ id: 1, dueDate: new Date(2026, 9, 31, 17, 0) }),
      makeTask({ id: 2, dueDate: new Date(2026, 10, 1, 9, 0) }),
      makeTask({ id: 3, dueDate: new Date(2026, 9, 1), stageId: 3 }),
      makeTask({ id: 4, dueDate: null }),
    ];
    expect(run({ due: 'open', dueDate: '2026-10-31' }, tasks)).toEqual([1]);
    // A mode with no date yet does not filter.
    expect(run({ due: 'open', dueDate: '' }, tasks)).toEqual([1, 2, 3, 4]);
  });

  it('"Archived before" draws the board from the archived tasks instead', () => {
    const live = [makeTask({ id: 1, dueDate: new Date(2026, 9, 1) })];
    const archived = [
      makeTask({ id: 2, archived: true, dueDate: new Date(2026, 9, 1), stageId: 3 }),
      makeTask({ id: 3, archived: true, dueDate: new Date(2026, 11, 1), stageId: 3 }),
    ];
    expect(run({ due: 'archived', dueDate: '2026-10-31' }, live, archived)).toEqual([2]);
  });

  it('"Only new" keeps the unopened tasks, and those opened since the board opened', () => {
    const tasks = [makeTask({ id: 1, viewedAt: null }), makeTask({ id: 2 }), makeTask({ id: 3 })];
    expect(run({ onlyNew: true }, tasks)).toEqual([1]);
    expect(run({ onlyNew: true }, tasks, [], new Set([3]))).toEqual([1, 3]);
  });
});
