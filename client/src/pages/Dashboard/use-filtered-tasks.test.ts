// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilteredTasks } from './use-filtered-tasks';
import type { Task, Stage } from '@shared/schema';

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Default task',
  description: null,
  stageId: 1,
  archived: false,
  status: 'backlog',
  priority: 'normal',
  effort: null,
  dueDate: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  tags: null,
  parentTaskId: null,
  recurrence: 'none',
  history: null,
  ...overrides,
});

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 0, color: '#3B82F6', createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 1, color: '#10B981', createdAt: new Date() },
  { id: 3, name: 'Done', order: 2, color: '#F59E0B', createdAt: new Date() },
];

describe('useFilteredTasks', () => {
  it('returns all tasks when no search query and focus mode is off', () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2, title: 'Another' })];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: false, stages }),
    );
    expect(result.current).toHaveLength(2);
  });

  it('returns empty array when tasks is undefined', () => {
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks: undefined, searchQuery: '', focusMode: false, stages }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('filters tasks by title matching the search query', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Fix login bug' }),
      makeTask({ id: 2, title: 'Add dark mode' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: 'login', focusMode: false, stages }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe('Fix login bug');
  });

  it('filters tasks by description matching the search query', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Task A', description: 'Related to authentication' }),
      makeTask({ id: 2, title: 'Task B', description: 'UI polish' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: 'authentication', focusMode: false, stages }),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe(1);
  });

  it('search is case-insensitive', () => {
    const tasks = [makeTask({ id: 1, title: 'Fix Login Bug' })];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: 'fix login', focusMode: false, stages }),
    );
    expect(result.current).toHaveLength(1);
  });

  it('in focus mode, returns only in_progress tasks and the highest-priority backlog task', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Backlog low', stageId: 1, status: 'backlog', priority: 'low' }),
      makeTask({
        id: 2,
        title: 'Backlog critical',
        stageId: 1,
        status: 'backlog',
        priority: 'critical',
      }),
      makeTask({ id: 3, title: 'Active', stageId: 2, status: 'in_progress', priority: 'normal' }),
      makeTask({ id: 4, title: 'Done', stageId: 3, status: 'done', priority: 'normal' }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: true, stages }),
    );

    const ids = result.current.map((t) => t.id);
    expect(ids).toContain(3);
    expect(ids).toContain(2);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(4);
  });

  it('in focus mode, infers status from stage name when task.status is missing', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Inferred backlog', stageId: 1, status: null as unknown as string }),
      makeTask({ id: 2, title: 'Inferred active', stageId: 2, status: null as unknown as string }),
    ];
    const { result } = renderHook(() =>
      useFilteredTasks({ tasks, searchQuery: '', focusMode: true, stages }),
    );

    const ids = result.current.map((t) => t.id);
    expect(ids).toContain(2);
    expect(ids).toContain(1);
  });
});
