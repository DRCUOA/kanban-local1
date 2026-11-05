// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { InsertTask, Stage, SubStage, Task } from '@shared/schema';
import { useZenDoing } from './use-zen-doing';

interface MutateOptions {
  onSuccess?: (task: Task) => void;
  onError?: (error: Error) => void;
}
const mutate = vi.fn<(payload: Record<string, unknown>, options: MutateOptions) => void>();
let isPending = false;
vi.mock('@/hooks/use-tasks', () => ({
  useUpdateTask: () => ({ mutate, isPending }),
}));

/** The one save Mark done made: its payload and its callbacks. */
const firstSave = () => {
  const call = mutate.mock.calls[0];
  if (!call) throw new Error('Mark done saved nothing');
  return call;
};

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

const stages = [
  { id: 1, name: 'Backlog', kind: 'backlog', order: 1 },
  { id: 2, name: 'In Progress', kind: 'in_progress', order: 2 },
  { id: 3, name: 'Done  ✔', kind: 'done', order: 3 },
] as unknown as Stage[];
const subStages = [{ id: 7, stageId: 2, tag: 'Doing - Rich' }] as unknown as SubStage[];

const task = {
  id: 42,
  title: 'Empty the dishwasher',
  description: '<p>Unload it.</p>',
  stageId: 2,
  tags: ['Doing - Rich', 'kitchen'],
  projectId: 5,
} as unknown as Task;

const setup = (stageList: Stage[] = stages) =>
  renderHook(() => {
    const form = useForm<InsertTask>({
      defaultValues: {
        title: task.title,
        description: task.description,
        stageId: task.stageId,
        tags: ['Doing - Rich', 'kitchen'],
      },
    });
    const zen = useZenDoing({ task, form, stages: stageList, subStages, dialogOpen: true });
    return { form, zen };
  });

describe('useZenDoing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 15, 42));
    mutate.mockReset();
    toast.mockReset();
    isPending = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Cancel doing closes Zen and saves nothing', () => {
    const { result } = setup();
    act(() => {
      result.current.zen.start();
    });
    expect(result.current.zen.open).toBe(true);

    act(() => {
      result.current.zen.cancel();
    });
    expect(result.current.zen.open).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('Mark done saves the stamped description and the move to Done in one write', () => {
    const { result } = setup();
    act(() => {
      result.current.zen.start();
    });
    act(() => {
      result.current.zen.markDone();
    });

    expect(mutate).toHaveBeenCalledOnce();
    expect(firstSave()[0]).toEqual({
      id: 42,
      description:
        '<p>Unload it.</p><p><strong>Nov 6, 2026 3:42 PM</strong>: marked done via Zen doing mode on Friday the 11-26, go you!</p>',
      stageId: 3,
      tags: ['kitchen'],
    });
    // Still open until the save lands.
    expect(result.current.zen.open).toBe(true);
  });

  it('after the save, closes Zen and leaves Edit Task showing what was saved', () => {
    const { result } = setup();
    act(() => {
      result.current.form.setValue('title', 'Empty the dishwasher, both racks', {
        shouldDirty: true,
      });
      result.current.zen.start();
    });
    act(() => {
      result.current.zen.markDone();
    });
    const sent = firstSave()[0];
    const saved = { ...task, ...sent } as Task;
    act(() => {
      firstSave()[1].onSuccess?.(saved);
    });

    const { form, zen } = result.current;
    expect(zen.open).toBe(false);
    expect(form.getValues('stageId')).toBe(3);
    expect(form.getValues('description')).toBe(sent.description);
    expect(form.getValues('tags')).toEqual(['kitchen']);
    // What Mark done wrote is clean; an edit it did not touch is still unsaved.
    expect(form.getFieldState('stageId').isDirty).toBe(false);
    expect(form.getFieldState('description').isDirty).toBe(false);
    expect(form.getValues('title')).toBe('Empty the dishwasher, both racks');
    expect(form.getFieldState('title').isDirty).toBe(true);
    expect(zen.savedTask).toBe(saved);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Marked done', description: 'Moved to Done. Go you!' }),
    );
  });

  it('stays in Zen and says why when the save fails', () => {
    const { result } = setup();
    act(() => {
      result.current.zen.start();
    });
    act(() => {
      result.current.zen.markDone();
    });
    act(() => {
      firstSave()[1].onError?.(new Error('Network down'));
    });

    expect(result.current.zen.open).toBe(true);
    expect(result.current.form.getValues('stageId')).toBe(2);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Could not mark it done', variant: 'destructive' }),
    );
  });

  it('does nothing on a board with no Done column, and says why', () => {
    const { result } = setup(stages.filter((s) => s.id !== 3));
    expect(result.current.zen.markDoneBlockedReason).toBe(
      'This board has no Done column to move it to.',
    );
    act(() => {
      result.current.zen.markDone();
    });
    expect(mutate).not.toHaveBeenCalled();
  });
});
