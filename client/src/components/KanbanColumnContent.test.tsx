// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { KanbanColumnContent } from './KanbanColumnContent';
import type { Task, SubStage } from '@shared/schema';

vi.mock('@/hooks/use-owners', () => ({
  // A bound lane is labelled by its owner, so the lane rendering needs the row.
  useOwnerById: () => (id: number | null) =>
    id === 1
      ? {
          id: 1,
          name: 'Rich',
          key: null,
          color: null,
          archived: false,
          order: 0,
          createdAt: new Date(),
          taskCount: 1,
        }
      : null,
}));

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
      {
        'data-testid': `substage-${subStage.name}`,
        'data-task-ids': tasks.map((t) => t.id).join(','),
      },
      `${tasks.length} tasks`,
    ),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Task',
  description: null,
  stageId: 1,
  archived: false,
  deletedAt: null,
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
  ownerId: null,
  projectId: null,
  ...overrides,
});

describe('KanbanColumnContent', () => {
  const baseProps = {
    stageId: 1,
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
        ownerId: null,
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
        ownerId: null,
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

  describe('a person’s lane (EPIC-06)', () => {
    const lane = (overrides: Partial<SubStage>): SubStage =>
      ({
        id: 20,
        stageId: 1,
        name: 'Lane',
        tag: 'lane',
        bgClass: '',
        ownerId: null,
        opacity: 20,
        order: 0,
        createdAt: new Date(),
        ...overrides,
      }) as SubStage;

    it('holds exactly the tasks its owner owns, whatever the tags say', () => {
      const subStages = [
        lane({ id: 20, name: 'Unallocated', tag: 'unallocated', order: 0 }),
        lane({ id: 21, name: 'Rich', tag: 'rich', order: 1, ownerId: 1 }),
      ];
      const tasks = [
        makeTask({ id: 1, ownerId: 1, tags: ['unallocated'] }),
        makeTask({ id: 2, ownerId: null, tags: ['rich'] }),
      ];

      render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={subStages} />);

      // Task 1 is Rich's despite carrying the other lane's tag; task 2 is
      // nobody's despite carrying Rich's old tag, so it is not in Rich's lane.
      expect(screen.getByTestId('substage-Rich').getAttribute('data-task-ids')).toBe('1');
      expect(screen.getByTestId('substage-Unallocated').getAttribute('data-task-ids')).toBe('2');
    });

    it('labels the lane with the owner’s name, not the stored lane name', () => {
      // The owners query is mocked to name owner 1 "Rich"; the row here is
      // still called "Rico", the name it had before the owner was renamed.
      const subStages = [lane({ id: 21, name: 'Rico', tag: 'rich', ownerId: 1 })];

      render(
        <KanbanColumnContent
          {...baseProps}
          stageTasks={[makeTask({ id: 1, ownerId: 1 })]}
          allSubStages={subStages}
        />,
      );

      expect(screen.getByTestId('substage-Rich')).toBeDefined();
      expect(screen.queryByTestId('substage-Rico')).toBeNull();
    });

    it('never drops an unlaned task into a person’s lane', () => {
      // Every lane in this stage belongs to someone, so an unassigned task
      // renders outside the lanes rather than being claimed by the first one.
      const subStages = [lane({ id: 21, name: 'Rich', tag: 'rich', ownerId: 1 })];
      const tasks = [makeTask({ id: 1, ownerId: 1 }), makeTask({ id: 2, ownerId: null })];

      render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={subStages} />);

      expect(screen.getByTestId('substage-Rich').getAttribute('data-task-ids')).toBe('1');
      expect(screen.getByTestId('task-card-2')).toBeDefined();
    });

    it('puts an unlaned task in the first lane that is nobody’s', () => {
      const subStages = [
        lane({ id: 21, name: 'Rich', tag: 'rich', order: 0, ownerId: 1 }),
        lane({ id: 20, name: 'Unallocated', tag: 'unallocated', order: 1 }),
      ];
      const tasks = [makeTask({ id: 1, ownerId: null, tags: null })];

      render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={subStages} />);

      expect(screen.getByTestId('substage-Unallocated').getAttribute('data-task-ids')).toBe('1');
      expect(screen.getByTestId('substage-Rich').getAttribute('data-task-ids')).toBe('');
    });
  });

  it('renders a task in exactly one sub-stage even when its tags match several', () => {
    const makeSubStage = (id: number, name: string, tag: string, order: number): SubStage => ({
      id,
      stageId: 1,
      name,
      tag,
      bgClass: 'bg-bg/20',
      ownerId: null,
      opacity: 20,
      order,
      createdAt: new Date(),
    });
    const subStages = [
      makeSubStage(10, 'Waiting', 'waiting', 0),
      makeSubStage(11, 'Rich', 'rich', 1),
      makeSubStage(12, 'Moi', 'moi', 2),
    ];
    // Task carries all three sub-stage tags; the last one wins (most recent move)
    const tasks = [
      makeTask({ id: 1, title: 'Multi', tags: ['waiting', 'rich', 'moi'] }),
      makeTask({ id: 2, title: 'Untagged' }),
    ];

    render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={subStages} />);

    // Untagged task falls into the first sub-stage; the multi-tagged task only
    // appears in the sub-stage of its most recently assigned tag.
    expect(screen.getByTestId('substage-Waiting').textContent).toBe('1 tasks');
    expect(screen.getByTestId('substage-Rich').textContent).toBe('0 tasks');
    expect(screen.getByTestId('substage-Moi').textContent).toBe('1 tasks');
  });

  it('renders tasks once when sub-stages share the same tag', () => {
    const shared: SubStage[] = [
      {
        id: 10,
        stageId: 1,
        name: 'A',
        tag: 'same',
        bgClass: 'bg-bg/20',
        ownerId: null,
        opacity: 20,
        order: 0,
        createdAt: new Date(),
      },
      {
        id: 11,
        stageId: 1,
        name: 'B',
        tag: 'same',
        bgClass: 'bg-bg/40',
        ownerId: null,
        opacity: 40,
        order: 1,
        createdAt: new Date(),
      },
    ];
    const tasks = [makeTask({ id: 1, title: 'Tagged', tags: ['same'] })];

    render(<KanbanColumnContent {...baseProps} stageTasks={tasks} allSubStages={shared} />);

    expect(screen.getByTestId('substage-A').textContent).toBe('1 tasks');
    expect(screen.getByTestId('substage-B').textContent).toBe('0 tasks');
  });

  it('ignores sub-stages that belong to a different stage', () => {
    const subStages: SubStage[] = [
      {
        id: 10,
        stageId: 99,
        name: 'Other',
        tag: 'other',
        bgClass: 'bg-bg/20',
        ownerId: null,
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
