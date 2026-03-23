// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskCardSummary } from './TaskCardSummary';
import type { Task } from '@shared/schema';

vi.mock('@dnd-kit/sortable', () => ({
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

vi.mock('@/hooks/use-stages', () => ({
  useStages: () => ({ data: [] }),
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  HoverCardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'hover-content' }, children),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 42,
  title: 'Summary task',
  description: 'A description',
  stageId: 1,
  archived: false,
  status: 'backlog',
  priority: 'normal',
  effort: 3,
  dueDate: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  tags: null,
  parentTaskId: null,
  recurrence: 'none',
  history: null,
  ...overrides,
});

describe('TaskCardSummary', () => {
  it('renders the task id in the circle for non-in-progress view', () => {
    render(<TaskCardSummary task={makeTask()} onClick={vi.fn()} stageColor="#3B82F6" />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('calls onClick with the task when clicked', () => {
    const onClick = vi.fn();
    const task = makeTask();
    render(<TaskCardSummary task={task} onClick={onClick} stageColor="#3B82F6" />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(task);
  });

  it('renders in-progress layout with title and id when isInProgress is true', () => {
    render(
      <TaskCardSummary
        task={makeTask()}
        onClick={vi.fn()}
        stageColor="#10B981"
        isInProgress={true}
      />,
    );

    const titles = screen.getAllByText('Summary task');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('#42')).toBeDefined();
  });

  it('shows the task title in the hover card content', () => {
    render(<TaskCardSummary task={makeTask()} onClick={vi.fn()} stageColor="#3B82F6" />);

    const hoverContent = screen.getByTestId('hover-content');
    expect(hoverContent.textContent).toContain('Summary task');
  });

  it('scales circle size based on effort value', () => {
    const { container: container1 } = render(
      <TaskCardSummary task={makeTask({ effort: 1 })} onClick={vi.fn()} />,
    );
    const { container: container2 } = render(
      <TaskCardSummary task={makeTask({ id: 2, effort: 5 })} onClick={vi.fn()} />,
    );

    const circle1 = container1.querySelector('[role="button"]');
    const circle2 = container2.querySelector('[role="button"]');
    expect(circle1).not.toBeNull();
    expect(circle2).not.toBeNull();

    const width1 = parseInt(circle1?.getAttribute('style')?.match(/width:\s*(\d+)/)?.[1] ?? '0');
    const width2 = parseInt(circle2?.getAttribute('style')?.match(/width:\s*(\d+)/)?.[1] ?? '0');
    expect(width2).toBeGreaterThan(width1);
  });
});
