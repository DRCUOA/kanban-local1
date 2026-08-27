// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { Task, Stage, SubStage } from '@shared/schema';
import {
  ShiftExemptMouseSensor,
  ShiftExemptPointerSensor,
  useKanbanDragDrop,
} from './use-kanban-drag-drop';

const updateMutate = vi.fn();
const archiveMutate = vi.fn();
const binMutate = vi.fn();

vi.mock('@/hooks/use-tasks', () => ({
  useUpdateTask: () => ({ mutate: updateMutate }),
  useArchiveTask: () => ({ mutate: archiveMutate }),
  useBinTask: () => ({ mutate: binMutate }),
}));

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
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
    owner: null,
    ...overrides,
  }) as Task;

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, color: null, createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 2, color: null, createdAt: new Date() },
] as Stage[];

const subStages: SubStage[] = [
  {
    id: 10,
    stageId: 1,
    name: 'Waiting',
    tag: 'waiting',
    bgClass: 'bg',
    opacity: 20,
    order: 1,
    createdAt: new Date(),
  },
  {
    id: 11,
    stageId: 1,
    name: 'Moi',
    tag: 'moi',
    bgClass: 'bg',
    opacity: 20,
    order: 2,
    createdAt: new Date(),
  },
] as SubStage[];

const dragEnd = (activeId: number, over: DragEndEvent['over']): DragEndEvent =>
  ({ active: { id: activeId }, over }) as unknown as DragEndEvent;

const subStageOver = (stageId: number, tag: string) =>
  ({
    id: `${stageId}-${tag}`,
    data: { current: { type: 'SubStage', subStageTag: tag } },
  }) as unknown as DragEndEvent['over'];

const stageOver = (stageId: number) =>
  ({
    id: `stage-${stageId}`,
    data: { current: { type: 'Stage', stageId } },
  }) as unknown as DragEndEvent['over'];

describe('useKanbanDragDrop handleDragEnd', () => {
  beforeEach(() => {
    updateMutate.mockClear();
    archiveMutate.mockClear();
  });

  it('assigns the sub-stage tag on a same-stage sub-stage drop, replacing other sub-stage tags', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, tags: ['waiting', 'keep-me'] })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: subStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, subStageOver(1, 'moi')));
    });

    expect(updateMutate).toHaveBeenCalledWith({ id: 5, tags: ['keep-me', 'moi'] });
  });

  it('moves the task and assigns the tag on a cross-stage sub-stage drop', () => {
    const tasks = [makeTask({ id: 5, stageId: 2, tags: null })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: subStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, subStageOver(1, 'moi')));
    });

    expect(updateMutate).toHaveBeenCalledWith({
      id: 5,
      stageId: 1,
      status: 'backlog',
      tags: ['moi'],
    });
  });

  it('moves the task on a namespaced stage-column drop', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, tags: ['waiting'] })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: subStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, stageOver(2)));
    });

    expect(updateMutate).toHaveBeenCalledWith({
      id: 5,
      stageId: 2,
      status: 'in_progress',
      tags: null,
    });
  });

  it('clears the sub-stage assignment when dropped on the own stage column body', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, tags: ['moi'] })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: subStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, stageOver(1)));
    });

    expect(updateMutate).toHaveBeenCalledWith({ id: 5, tags: null });
  });

  it('does nothing on an own-stage column drop when the task has no sub-stage tag', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, tags: ['keep-me'] })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: subStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, stageOver(1)));
    });

    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('never appends an empty sub-stage tag', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, tags: ['waiting'] })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: subStages }),
    );

    act(() => {
      // sub-stage typed over-target without a tag (defensive path)
      result.current.handleDragEnd(dragEnd(5, subStageOver(1, '')));
    });

    expect(updateMutate).toHaveBeenCalledWith({ id: 5, tags: [] });
  });
});

describe('shift-exempt drag sensors', () => {
  // Activator contract: return false to refuse activation, true to start a drag.
  const options = { onActivation: undefined } as never;
  const [pointerActivator] = ShiftExemptPointerSensor.activators;
  const [mouseActivator] = ShiftExemptMouseSensor.activators;
  if (!pointerActivator || !mouseActivator) throw new Error('sensor activators missing');

  it('refuses pointer activation while Shift is held', () => {
    const event = { nativeEvent: { shiftKey: true, isPrimary: true, button: 0 } } as never;
    expect(pointerActivator.handler(event, options)).toBe(false);
  });

  it('activates a plain primary pointer press exactly like the stock sensor', () => {
    const event = { nativeEvent: { shiftKey: false, isPrimary: true, button: 0 } } as never;
    expect(pointerActivator.handler(event, options)).toBe(true);
  });

  it('refuses mouse activation while Shift is held', () => {
    const event = { nativeEvent: { shiftKey: true, button: 0 } } as never;
    expect(mouseActivator.handler(event, options)).toBe(false);
  });

  it('still delegates non-primary-button rejection to the stock mouse sensor', () => {
    const plain = { nativeEvent: { shiftKey: false, button: 0 } } as never;
    const rightClick = { nativeEvent: { shiftKey: false, button: 2 } } as never;
    expect(mouseActivator.handler(plain, options)).toBe(true);
    expect(mouseActivator.handler(rightClick, options)).toBe(false);
  });
});
