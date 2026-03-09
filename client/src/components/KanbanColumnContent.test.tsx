// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { KanbanColumnContent } from './KanbanColumnContent';
import type { Task, SubStage } from '@shared/schema';

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'sortable-context' }, children),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock('./TaskCard', () => ({
  TaskCard: ({ task }: { task: Task }) =>
    React.createElement('div', { 'data-testid': `task-card-${task.id}` }, task.title),
}));

vi.mock('./TaskCardSummary', () => ({
  TaskCardSummary: ({ task }: { task: Task }) =>
    React.createElement('div', { 'data-testid': `task-summary-${task.id}` }, task.title),
}));

vi.mock('./DayPlanSubStage', () => ({
  DayPlanSubStage: ({ subStage, tasks }: { subStage: { name: string }; tasks: Task[] }) =>
    React.createElement(
      'div',
      { 'data-testid': `substage-${subStage.name}` },
      `${tasks.length} tasks`,
    ),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Task',
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

describe('KanbanColumnContent', () => {
  const baseProps = {
    stageId: 1,
    stageName: 'Backlog',
    stageColor: '#3B82F6',
    viewMode: 'detail' as const,
    onTaskClick: vi.fn(),
  };

  it('renders TaskCard for each task in detail view (no sub-stages)', () => {
    const tasks = [makeTask({ id: 1, title: 'First' }), makeTask({ id: 2, title: 'Second' })];
    render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={[]} />);

    expect(screen.getByTestId('task-card-1')).toBeDefined();
    expect(screen.getByTestId('task-card-2')).toBeDefined();
  });

  it('renders TaskCardSummary for each task in summary view (no sub-stages)', () => {
    const tasks = [makeTask({ id: 1, title: 'First' })];
    render(
      <KanbanColumnContent
        {...baseProps}
        viewMode="summary"
        stageTasks={tasks}
        allSubStages={[]}
      />,
    );

    expect(screen.getByTestId('task-summary-1')).toBeDefined();
  });

  it('renders DayPlanSubStage components when sub-stages exist for the stage', () => {
    const subStages: SubStage[] = [
      {
        id: 10,
        stageId: 1,
        name: 'AM',
        tag: 'am',
        bgClass: 'bg-bg/20',
        opacity: 20,
        order: 0,
        createdAt: new Date(),
      },
      {
        id: 11,
        stageId: 1,
        name: 'PM',
        tag: 'pm',
        bgClass: 'bg-bg/40',
        opacity: 40,
        order: 1,
        createdAt: new Date(),
      },
    ];
    const tasks = [
      makeTask({ id: 1, title: 'Morning', tags: ['am'] }),
      makeTask({ id: 2, title: 'Afternoon', tags: ['pm'] }),
    ];

    render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={subStages} />);

    expect(screen.getByTestId('substage-AM')).toBeDefined();
    expect(screen.getByTestId('substage-PM')).toBeDefined();
  });

  it('ignores sub-stages that belong to a different stage', () => {
    const subStages: SubStage[] = [
      {
        id: 10,
        stageId: 99,
        name: 'Other',
        tag: 'other',
        bgClass: 'bg-bg/20',
        opacity: 20,
        order: 0,
        createdAt: new Date(),
      },
    ];
    const tasks = [makeTask({ id: 1, title: 'Only' })];

    render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={subStages} />);

    expect(screen.queryByTestId('substage-Other')).toBeNull();
    expect(screen.getByTestId('task-card-1')).toBeDefined();
  });
});
