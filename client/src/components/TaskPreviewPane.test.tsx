// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Stage, SubStage, Task } from '@shared/schema';
import { TaskPreviewPane } from './TaskPreviewPane';

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, color: '#3B82F6', createdAt: new Date() },
  { id: 2, name: 'Waiting ✋️ ', order: 2, color: '#F59E0B', createdAt: new Date() },
];

const subStages: SubStage[] = [
  {
    id: 10,
    stageId: 2,
    name: 'Waiting on others',
    tag: 'waiting-others',
    bgClass: 'bg-background/20',
    opacity: 20,
    order: 1,
    createdAt: new Date(),
  },
  {
    id: 11,
    stageId: 2,
    name: 'Scheduled action',
    tag: 'scheduled',
    bgClass: 'bg-background/20',
    opacity: 20,
    order: 2,
    createdAt: new Date(),
  },
];

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 42,
    title: 'Call back Solar Guy',
    description: '<p>Quote for the <strong>north roof</strong></p>',
    stageId: 2,
    archived: false,
    status: 'backlog',
    priority: 'high',
    effort: 3,
    dueDate: new Date(2030, 0, 15),
    updatedAt: new Date(2026, 7, 14, 9, 30),
    createdAt: new Date(2026, 7, 1, 8, 0),
    tags: ['waiting-others', 'scheduled', 'solar'],
    parentTaskId: 7,
    recurrence: 'weekly',
    history: [
      { status: 'backlog', timestamp: '2026-08-01T08:00:00.000Z' },
      { status: 'in_progress', timestamp: '2026-08-10T08:00:00.000Z', note: 'kicked off' },
    ],
    owner: 'Rich',
    ...overrides,
  }) as Task;

describe('TaskPreviewPane', () => {
  it('prompts when nothing is previewed', () => {
    render(<TaskPreviewPane task={null} stages={stages} subStages={subStages} onOpen={vi.fn()} />);
    expect(screen.getByTestId('task-preview-empty')).toBeDefined();
    expect(screen.getByTestId('task-preview-pane').getAttribute('data-preview-task-id')).toBeNull();
    expect(screen.queryByTestId('task-preview-open')).toBeNull();
  });

  it('shows the full task: stage, lane, title, badges, due date, description, tags, details, history', () => {
    render(
      <TaskPreviewPane
        task={makeTask()}
        stages={stages}
        subStages={subStages}
        stageColor="#F59E0B"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByTestId('task-preview-pane').getAttribute('data-preview-task-id')).toBe('42');
    expect(screen.getByText('#42')).toBeDefined();
    // Stage label is cleaned of emoji/padding; the lane is the *last* matching
    // sub-stage tag, mirroring how the board files the card.
    expect(screen.getByTestId('task-preview-stage').textContent).toBe('Waiting');
    expect(screen.getByTestId('task-preview-substage').textContent).toBe('Scheduled action');
    expect(screen.getByTestId('task-preview-title').textContent).toBe('Call back Solar Guy');

    expect(screen.getByText('Backlog')).toBeDefined(); // status label
    expect(screen.getByTestId('task-preview-priority').textContent).toBe('High');
    expect(screen.getByText('Effort 3/5')).toBeDefined();
    expect(screen.getByTestId('task-preview-owner').textContent).toContain('Rich');
    expect(screen.getByText('weekly')).toBeDefined();

    expect(screen.getByTestId('task-preview-due').textContent).toContain('Due: Jan 15');

    // Full description, rendered as rich text (not clamped, not plain text).
    const description = screen.getByTestId('task-preview-description');
    expect(description.querySelector('strong')?.textContent).toBe('north roof');
    expect(description.className).not.toContain('line-clamp');

    // Sub-stage tags are shown as the lane, not repeated as tags.
    expect(screen.getByTestId('task-preview-tags').textContent).toBe('solar');

    expect(screen.getByText('Parent')).toBeDefined();
    expect(screen.getByText('#7')).toBeDefined();
    expect(screen.getByText('Created')).toBeDefined();
    expect(screen.getByText('Updated')).toBeDefined();

    // History newest first.
    const history = screen.getByTestId('task-preview-history');
    const entries = [...history.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(entries[0]).toContain('Moved to In Progress');
    expect(entries[0]).toContain('kicked off');
    expect(entries[1]).toContain('Moved to Backlog');
  });

  it('degrades gracefully for a sparse task', () => {
    render(
      <TaskPreviewPane
        task={makeTask({
          description: null,
          priority: 'normal',
          effort: null,
          dueDate: null,
          tags: null,
          parentTaskId: null,
          recurrence: 'none',
          history: null,
          owner: null,
          stageId: 999,
        })}
        stages={stages}
        subStages={subStages}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('No description')).toBeDefined();
    expect(screen.getByTestId('task-preview-stage').textContent).toBe('Unknown stage');
    expect(screen.queryByTestId('task-preview-substage')).toBeNull();
    expect(screen.queryByTestId('task-preview-priority')).toBeNull();
    expect(screen.queryByTestId('task-preview-due')).toBeNull();
    expect(screen.queryByTestId('task-preview-tags')).toBeNull();
    expect(screen.queryByTestId('task-preview-history')).toBeNull();
    expect(screen.queryByText('Parent')).toBeNull();
  });

  it('flags an overdue due date', () => {
    render(
      <TaskPreviewPane
        task={makeTask({ dueDate: new Date(2000, 0, 1) })}
        stages={stages}
        subStages={subStages}
        onOpen={vi.fn()}
      />,
    );
    const due = screen.getByTestId('task-preview-due');
    expect(due.textContent).toContain('(overdue)');
    expect(due.className).toContain('text-danger');
  });

  it('caps the history list and says how many earlier entries there are', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
      status: 'backlog' as const,
      timestamp: new Date(2026, 0, 1 + i).toISOString(),
    }));
    render(
      <TaskPreviewPane
        task={makeTask({ history })}
        stages={stages}
        subStages={subStages}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTestId('task-preview-history').querySelectorAll('li')).toHaveLength(6);
    expect(screen.getByText(/3 earlier entries/)).toBeDefined();
  });

  it('"Open task" hands the task back to the board', () => {
    const onOpen = vi.fn();
    const task = makeTask();
    render(<TaskPreviewPane task={task} stages={stages} subStages={subStages} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('task-preview-open'));
    expect(onOpen).toHaveBeenCalledWith(task);
  });
});
