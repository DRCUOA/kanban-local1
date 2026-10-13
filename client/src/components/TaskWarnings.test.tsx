// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Task } from '@shared/schema';
import { TaskWarnings } from './TaskWarnings';
import { StageHeaders } from './StageHeaders';

vi.mock('@/hooks/use-stages', () => ({
  useStages: () => ({
    data: [
      {
        id: 1,
        name: 'Backlog',
        order: 1,
        kind: 'backlog',
        color: '#3B82F6',
        createdAt: new Date(),
      },
      {
        id: 2,
        name: 'In Progress',
        order: 2,
        kind: 'in_progress',
        color: '#10B981',
        createdAt: new Date(),
      },
      { id: 3, name: 'Done', order: 3, kind: 'done', color: '#84CC16', createdAt: new Date() },
      {
        id: 4,
        name: 'Cancelled',
        order: 4,
        kind: 'abandoned',
        color: '#6B7280',
        createdAt: new Date(),
      },
    ],
  }),
  useSubStages: () => ({ data: [] }),
}));

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 1,
    title: 'Task',
    description: null,
    stageId: 1,
    archived: false,
    priority: 'normal',
    effort: null,
    dueDate: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    tags: null,
    parentTaskId: null,
    recurrence: 'none',
    history: null,
    owner: null,
    projectId: null,
    ...overrides,
  }) as Task;

describe('TaskWarnings (compact pills)', () => {
  it('renders nothing when there is nothing to warn about', () => {
    const { container } = render(<TaskWarnings tasks={[makeTask()]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one pill per warning with the count, and the full sentence as tooltip', () => {
    const longAgo = new Date(2020, 0, 1);
    const tasks = [
      makeTask({ id: 1, priority: 'high' }),
      makeTask({ id: 2, priority: 'critical', dueDate: new Date(2000, 0, 1) }),
      makeTask({ id: 3, updatedAt: longAgo }),
      makeTask({ id: 4, stageId: 2 }),
      makeTask({ id: 5, stageId: 2 }),
      makeTask({ id: 6, stageId: 2 }),
      makeTask({ id: 7, stageId: 2 }),
      makeTask({ id: 8, archived: true, priority: 'critical' }), // archived: ignored
    ];
    render(<TaskWarnings tasks={tasks} />);

    const list = screen.getByTestId('task-warnings');
    expect(list.getAttribute('aria-label')).toBe('Board warnings');
    expect(list.querySelectorAll('li')).toHaveLength(4);

    const inProgress = screen.getByTestId('task-warning-in-progress');
    expect(inProgress.textContent).toContain('Many in progress');
    expect(inProgress.textContent).toContain('4');
    expect(inProgress.getAttribute('title')).toBe('4 tasks in progress. Focus on fewer.');

    const highPriority = screen.getByTestId('task-warning-high-priority');
    expect(highPriority.textContent).toContain('High-priority waiting');
    expect(highPriority.textContent).toContain('2');
    expect(highPriority.getAttribute('title')).toBe('2 high-priority in backlog.');

    const overdue = screen.getByTestId('task-warning-overdue');
    expect(overdue.textContent).toContain('Overdue');
    expect(overdue.textContent).toContain('1');
    expect(overdue.getAttribute('title')).toBe('1 task overdue.');
    expect(overdue.className).toContain('text-danger');

    const stale = screen.getByTestId('task-warning-stale');
    expect(stale.textContent).toContain('Stale tasks');
    expect(stale.getAttribute('title')).toBe('1 not updated in 14+ days.');
  });

  it('does not count closed tasks as overdue, even with a past due date left set', () => {
    const pastDue = new Date(2000, 0, 1);
    render(
      <TaskWarnings
        tasks={[
          makeTask({ id: 1, stageId: 3, dueDate: pastDue }),
          makeTask({ id: 2, stageId: 4, dueDate: pastDue }),
        ]}
      />,
    );

    expect(screen.queryByTestId('task-warning-overdue')).toBeNull();
  });

  describe('as a filter', () => {
    const manyInProgress = [
      makeTask({ id: 4, stageId: 2 }),
      makeTask({ id: 5, stageId: 2 }),
      makeTask({ id: 6, stageId: 2 }),
      makeTask({ id: 7, stageId: 2 }),
    ];

    it('reports the pill pressed', () => {
      const onToggleKind = vi.fn();
      render(<TaskWarnings tasks={manyInProgress} onToggleKind={onToggleKind} />);

      fireEvent.click(screen.getByTestId('task-warning-in-progress'));

      expect(onToggleKind).toHaveBeenCalledWith('in-progress');
    });

    it('reports the active pill too, so pressing it again clears the filter', () => {
      const onToggleKind = vi.fn();
      render(
        <TaskWarnings
          tasks={manyInProgress}
          activeKind="in-progress"
          onToggleKind={onToggleKind}
        />,
      );

      fireEvent.click(screen.getByTestId('task-warning-in-progress'));

      expect(onToggleKind).toHaveBeenCalledWith('in-progress');
    });

    it('shows which pill is filtering, in its own tone and to a screen reader', () => {
      const tasks = [...manyInProgress, makeTask({ id: 1, priority: 'high' })];
      render(<TaskWarnings tasks={tasks} activeKind="high-priority" />);

      const active = screen.getByTestId('task-warning-high-priority');
      expect(active.getAttribute('aria-pressed')).toBe('true');
      expect(active.className).toContain('bg-warning/15');
      expect(active.getAttribute('aria-label')).toContain('Showing only these');

      const inactive = screen.getByTestId('task-warning-in-progress');
      expect(inactive.getAttribute('aria-pressed')).toBe('false');
      expect(inactive.className).toContain('neo-raised');
      expect(inactive.getAttribute('aria-label')).toContain('Press to show only these');
    });

    it('counts the whole board, so a count does not move under its own filter', () => {
      // The caller passes every task whatever the filter is; a pill reading
      // "Overdue 6" over a board showing five would be worse than no pill.
      const tasks = [...manyInProgress, makeTask({ id: 1, priority: 'high' })];
      const { rerender } = render(<TaskWarnings tasks={tasks} />);
      expect(screen.getByTestId('task-warning-in-progress').textContent).toContain('4');

      rerender(<TaskWarnings tasks={tasks} activeKind="high-priority" />);
      expect(screen.getByTestId('task-warning-in-progress').textContent).toContain('4');
    });

    it('is a button, so it is reachable by keyboard', () => {
      render(<TaskWarnings tasks={manyInProgress} />);

      expect(screen.getByTestId('task-warning-in-progress').tagName).toBe('BUTTON');
    });
  });

  it('rides in the stage-chip row, after the chips', () => {
    const tasks = [makeTask({ id: 1, priority: 'high' }), makeTask({ id: 2, stageId: 3 })];
    render(
      <StageHeaders tasks={tasks}>
        <TaskWarnings tasks={tasks} />
      </StageHeaders>,
    );
    const chips = screen.getByTestId('stage-chips');
    const warnings = screen.getByTestId('task-warnings');
    expect(chips.textContent).toContain('Backlog');
    expect(chips.textContent).toContain('Done');
    expect(chips.parentElement).toBe(warnings.parentElement?.parentElement);
    expect(
      Boolean(chips.compareDocumentPosition(warnings) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});
