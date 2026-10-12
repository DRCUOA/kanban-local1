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
    projectId: null,
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

/**
 * The same lanes with the person lanes bound to owners, as EPIC-06 binds them:
 * lane 11 ("Moi") is owner 2's in Backlog, lane 12 is owner 2's in In Progress.
 */
const boundSubStages: SubStage[] = [
  ...subStages.map((lane) => ({ ...lane, ownerId: lane.tag === 'moi' ? 2 : null })),
  {
    id: 12,
    stageId: 2,
    name: 'Moi',
    tag: 'moi-doing',
    bgClass: 'bg',
    opacity: 20,
    order: 1,
    ownerId: 2,
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

describe('useKanbanDragDrop and a person’s lane (EPIC-06)', () => {
  beforeEach(() => {
    updateMutate.mockClear();
  });

  it('assigns the owner, and writes no tag, on a drop into a person’s lane', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, ownerId: null, tags: ['keep-me'] })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: boundSubStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, subStageOver(1, 'moi')));
    });

    // The lane is the owner, so the owner is the whole write — the lane's tag
    // is not part of how that lane is matched any more.
    expect(updateMutate).toHaveBeenCalledWith({ id: 5, tags: ['keep-me'], ownerId: 2 });
  });

  it('carries the owner across stages when the lane dropped on is a person’s', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, ownerId: null })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: boundSubStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, subStageOver(2, 'moi-doing')));
    });

    expect(updateMutate).toHaveBeenCalledWith({
      id: 5,
      stageId: 2,
      status: 'in_progress',
      tags: [],
      ownerId: 2,
    });
  });

  it('leaves the owner alone on a drop into a lane that is nobody’s', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, ownerId: 2, tags: null })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: boundSubStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, subStageOver(1, 'waiting')));
    });

    expect(updateMutate).toHaveBeenCalledWith({ id: 5, tags: ['waiting'] });
  });

  it('clears the owner when a card is dragged out of its own lane onto the column', () => {
    // Without this the drop would be invisible: the lane is defined by the
    // owner, so the card would snap straight back into it (OWN-R13).
    const tasks = [makeTask({ id: 5, stageId: 1, ownerId: 2, tags: null })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: boundSubStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, stageOver(1)));
    });

    expect(updateMutate).toHaveBeenCalledWith({ id: 5, tags: null, ownerId: null });
  });

  it('does nothing on a column drop when the stage holds no lane for the owner', () => {
    const tasks = [makeTask({ id: 5, stageId: 1, ownerId: 7, tags: null })];
    const { result } = renderHook(() =>
      useKanbanDragDrop({ tasks, sortedStages: stages, allSubStages: boundSubStages }),
    );

    act(() => {
      result.current.handleDragEnd(dragEnd(5, stageOver(1)));
    });

    expect(updateMutate).not.toHaveBeenCalled();
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
