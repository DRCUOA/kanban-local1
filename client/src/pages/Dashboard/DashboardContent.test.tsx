// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardContent } from './DashboardContent';
import type { Task } from '@shared/schema';

vi.mock('@/components/KanbanBoard', () => ({
  KanbanBoard: (props: { tasks: Task[]; viewMode: string }) =>
    React.createElement('div', { 'data-testid': 'kanban-board' }, `${props.tasks.length} tasks`),
}));

vi.mock('@/components/CreateTaskDialog', () => ({
  CreateTaskDialog: () =>
    React.createElement('button', { 'data-testid': 'create-task-stub' }, 'New Task'),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Test task',
  description: null,
  stageId: 1,
  archived: false,
  deletedAt: null,
  viewedAt: null,
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

describe('DashboardContent', () => {
  const defaults = {
    filteredTasks: [] as Task[],
    focusMode: false,
    viewMode: 'detail' as const,
    boardLayout: 'vertical' as const,
    searchQuery: '',
    onTaskClick: vi.fn(),
  };

  it('renders the empty state when filteredTasks is empty', () => {
    render(<DashboardContent {...defaults} />);
    expect(screen.getByText('No tasks found')).toBeDefined();
  });

  it('shows "Create your first task" button when there is no search query', () => {
    render(<DashboardContent {...defaults} />);
    expect(screen.getByTestId('create-task-stub')).toBeDefined();
  });

  it('shows "No tasks match your search" when searchQuery is set', () => {
    render(<DashboardContent {...defaults} searchQuery="xyz" />);
    expect(screen.getByText('No tasks match your search.')).toBeDefined();
  });

  it('renders KanbanBoard when filteredTasks has items', () => {
    const task = makeTask();
    render(<DashboardContent {...defaults} filteredTasks={[task]} />);
    expect(screen.getByTestId('kanban-board')).toBeDefined();
    expect(screen.getByText('1 tasks')).toBeDefined();
  });

  it('renders the Focus Mode banner when focusMode is true', () => {
    render(<DashboardContent {...defaults} focusMode={true} />);
    expect(screen.getByText('Focus Mode Active')).toBeDefined();
  });

  it('does not render the Focus Mode banner when focusMode is false', () => {
    render(<DashboardContent {...defaults} focusMode={false} />);
    expect(screen.queryByText('Focus Mode Active')).toBeNull();
  });

  it('gives the scrolling vertical layout a long run-off, and the horizontal one only a gutter', () => {
    const task = makeTask();
    const { unmount } = render(<DashboardContent {...defaults} filteredTasks={[task]} />);
    // Room for the last card to scroll clear of the toolbar and toasts that
    // float above the nav.
    expect(screen.getByTestId('board-main').className).toContain('pb-28');
    unmount();

    render(<DashboardContent {...defaults} filteredTasks={[task]} boardLayout="horizontal" />);
    // The columns scroll inside themselves, so they run down to the nav.
    const main = screen.getByTestId('board-main');
    expect(main.className).toContain('pb-3');
    expect(main.className).not.toContain('pb-28');
    expect(main.className).toContain('overflow-y-auto');
  });
});
