// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Stage, Task } from '@shared/schema';
import { GoalSection } from './GoalSection';

const archive = vi.fn();
const unarchive = vi.fn();

const task = (overrides: Partial<Task>): Task =>
  ({
    id: 1,
    title: 'Task',
    stageId: 1,
    archived: false,
    projectId: 1,
    goalTaskId: null,
    type: null,
    ...overrides,
  }) as Task;

const live: Task[] = [
  task({ id: 1, title: 'Build a shed', type: 'goal' }),
  task({ id: 2, goalTaskId: 1 }),
  task({ id: 3, goalTaskId: 1 }),
  task({ id: 4, title: 'Launch the site', type: 'goal', stageId: 3 }),
  task({ id: 5, title: 'Loose task' }),
];
const archived: Task[] = [task({ id: 6, title: 'Old plan', type: 'goal', archived: true })];

vi.mock('@/hooks/use-tasks', () => ({
  useTasks: () => ({ data: live, isLoading: false }),
  useArchivedTasks: () => ({ data: archived }),
  useArchiveTask: () => ({ mutate: archive, isPending: false }),
  useUnarchiveTask: () => ({ mutate: unarchive, isPending: false }),
}));
vi.mock('@/hooks/use-project-scope', () => ({
  useProjectScope: () => ({
    projects: [{ id: 1, name: 'Home', color: null, archived: false }],
    projectById: (id: number) =>
      id === 1 ? { id: 1, name: 'Home', color: null, archived: false } : null,
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const stages = [
  { id: 1, name: 'Backlog', order: 1, kind: 'backlog' },
  { id: 3, name: 'Done ', order: 3, kind: 'done' },
] as Stage[];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoalSection', () => {
  it('lists every goal, open ones first, with what state each is in', () => {
    render(<GoalSection stages={stages} />);
    const rows = screen.getAllByTestId(/^goal-row-/).map((r) => r.dataset.testid);
    expect(rows).toEqual(['goal-row-1', 'goal-row-4', 'goal-row-6']);
    expect(screen.queryByTestId('goal-state-1')).toBeNull();
    expect(screen.getByTestId('goal-state-4').textContent).toBe('Done');
    expect(screen.getByTestId('goal-state-6').textContent).toBe('Archived');
    expect(screen.getByTestId('goal-row-1').textContent).toContain('Home · 2 building-blocks');
    expect(screen.queryByText('Loose task')).toBeNull();
  });

  it('archives an open goal and reopens an archived one', () => {
    render(<GoalSection stages={stages} />);
    fireEvent.click(screen.getByLabelText('Archive Build a shed'));
    expect(archive).toHaveBeenCalledWith(1, expect.anything());

    fireEvent.click(screen.getByLabelText('Reopen Old plan'));
    expect(unarchive).toHaveBeenCalledWith(6, expect.anything());
  });
});
