// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Task } from '@shared/schema';
import { TaskWarnings } from './TaskWarnings';

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

describe('TaskWarnings (icons)', () => {
  it('renders nothing when there is nothing to warn about', () => {
    const { container } = render(<TaskWarnings tasks={[makeTask()]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one icon per warning, named with its count for a screen reader; no text shows until pressed', () => {
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

    const expected: [string, string][] = [
      ['in-progress', 'Many in progress: 4 tasks in progress. Focus on fewer.'],
      ['high-priority', 'High-priority waiting: 2 high-priority in backlog.'],
      ['overdue', 'Overdue: 1 task overdue.'],
      ['stale', 'Stale tasks: 1 not updated in 14+ days.'],
    ];
    for (const [kind, label] of expected) {
      const pill = screen.getByTestId(`task-warning-${kind}`);
      expect(pill.getAttribute('aria-label')).toContain(label);
      // An icon alone: no visible text, no native title doubling the tooltip.
      expect(pill.textContent).toBe('');
      expect(pill.getAttribute('title')).toBeNull();
      expect(pill.querySelector('svg')).not.toBeNull();
    }
    expect(screen.getByTestId('task-warning-overdue').className).toContain('text-danger');
  });

  it('tells each kind apart by its glyph, not only its colour', () => {
    const tasks = [
      makeTask({ id: 3, updatedAt: new Date(2020, 0, 1) }), // stale: info tone
      makeTask({ id: 4, stageId: 2 }),
      makeTask({ id: 5, stageId: 2 }),
      makeTask({ id: 6, stageId: 2 }),
      makeTask({ id: 7, stageId: 2 }), // many in progress: info tone too
    ];
    render(<TaskWarnings tasks={tasks} />);
    const stale = screen.getByTestId('task-warning-stale').querySelector('svg');
    const inProgress = screen.getByTestId('task-warning-in-progress').querySelector('svg');
    expect(stale?.innerHTML).not.toBe(inProgress?.innerHTML);
  });

  it('says its name and count on hover or focus', async () => {
    render(<TaskWarnings tasks={[makeTask({ id: 2, dueDate: new Date(2000, 0, 1) })]} />);

    fireEvent.focus(screen.getByTestId('task-warning-overdue'));

    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toContain('Overdue: 1 task overdue.');
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

    it('reports the icon pressed', () => {
      const onToggleKind = vi.fn();
      render(<TaskWarnings tasks={manyInProgress} onToggleKind={onToggleKind} />);

      fireEvent.click(screen.getByTestId('task-warning-in-progress'));

      expect(onToggleKind).toHaveBeenCalledWith('in-progress');
    });

    it('reports the active icon too, so pressing it again clears the filter', () => {
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

    it('opens the pressed icon to show its name and count — how a phone, with no hover, reads it', () => {
      const tasks = [...manyInProgress, makeTask({ id: 1, priority: 'high' })];
      render(<TaskWarnings tasks={tasks} activeKind="high-priority" />);

      const active = screen.getByTestId('task-warning-high-priority');
      expect(active.getAttribute('aria-pressed')).toBe('true');
      expect(active.className).toContain('bg-warning/15');
      expect(active.getAttribute('aria-label')).toContain('Showing only these');
      const label = screen.getByTestId('task-warning-high-priority-label');
      expect(label.textContent).toContain('High-priority waiting');
      expect(label.textContent).toContain('1');

      const inactive = screen.getByTestId('task-warning-in-progress');
      expect(inactive.getAttribute('aria-pressed')).toBe('false');
      expect(inactive.className).toContain('neo-raised');
      expect(inactive.getAttribute('aria-label')).toContain('Press to show only these');
      expect(screen.queryByTestId('task-warning-in-progress-label')).toBeNull();
    });

    it('counts the whole board, so a count does not move under its own filter', () => {
      // The caller passes every task whatever the filter is; an icon saying
      // "4 in progress" over a board showing five would be worse than none.
      const tasks = [...manyInProgress, makeTask({ id: 1, priority: 'high' })];
      const { rerender } = render(<TaskWarnings tasks={tasks} />);
      expect(screen.getByTestId('task-warning-in-progress').getAttribute('aria-label')).toContain(
        '4 tasks in progress',
      );

      rerender(<TaskWarnings tasks={tasks} activeKind="high-priority" />);
      expect(screen.getByTestId('task-warning-in-progress').getAttribute('aria-label')).toContain(
        '4 tasks in progress',
      );
    });

    it('is a button, so it is reachable by keyboard', () => {
      render(<TaskWarnings tasks={manyInProgress} />);

      expect(screen.getByTestId('task-warning-in-progress').tagName).toBe('BUTTON');
    });
  });
});
