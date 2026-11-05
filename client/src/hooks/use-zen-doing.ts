import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { InsertTask, Stage, SubStage, Task } from '@shared/schema';
import { cleanLabel } from '@shared/briefing';
import { useUpdateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { tagsAfterStageMove } from '@/lib/stage-move';
import { appendZenDoneLine, zenDoneStage } from '@/lib/zen-doing';

/** Equal as the form would save them; dates compare by instant. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Make `saved` the form's saved state for those fields, and keep every other
 * unsaved edit as an unsaved edit. `resetField` cannot do this: it skips a
 * field that is not mounted, and the tags field unmounts on a column with no
 * lanes, which Done usually is.
 */
function applySavedFields(form: UseFormReturn<InsertTask>, saved: Partial<InsertTask>) {
  const current = form.getValues();
  const defaults = (form.formState.defaultValues ?? {}) as Partial<InsertTask>;
  const unsaved = (Object.keys(current) as (keyof InsertTask)[]).filter(
    (name) => !(name in saved) && !sameValue(current[name], defaults[name]),
  );
  form.reset({ ...defaults, ...saved } as InsertTask);
  for (const name of unsaved) {
    form.setValue(name, current[name], { shouldDirty: true });
  }
}

export interface UseZenDoingOptions {
  task: Task | null;
  /** The Edit Task form. Zen reads its description and, after Mark done, its fields are updated in place. */
  form: UseFormReturn<InsertTask>;
  stages: Stage[];
  subStages: SubStage[];
  /** Whether Edit Task is open; closing it closes Zen too. */
  dialogOpen: boolean;
}

/**
 * Zen doing mode's state and its one write.
 *
 * Mark done saves two things in one PATCH: the description with the Mark done
 * line added, and the move to the board's first Done column (dropping the lane
 * tags of the column it left, as a drop on the Filing menu does). The server
 * writes the history line for the move. On success the form's description,
 * stage and tags become what was saved, so Edit Task shows the result and a
 * later Save cannot put the old stage back; any other unsaved edit in the form
 * stays an unsaved edit. Cancel doing writes nothing.
 */
export function useZenDoing({ task, form, stages, subStages, dialogOpen }: UseZenDoingOptions) {
  const [open, setOpen] = useState(false);
  // The task as Mark done saved it, for the parts of Edit Task that read the
  // saved task (Copy JSON, Share) rather than the form.
  const [savedTask, setSavedTask] = useState<Task | null>(null);
  const updateTask = useUpdateTask();
  const { toast } = useToast();

  const doneStage = zenDoneStage(stages);
  const taskId = task?.id ?? null;

  useEffect(() => {
    if (!dialogOpen) setOpen(false);
    setSavedTask(null);
  }, [dialogOpen, taskId]);

  const markDone = () => {
    if (!task || !doneStage || updateTask.isPending) return;
    const description = appendZenDoneLine(form.getValues('description'), new Date());
    const tags = tagsAfterStageMove(form.getValues('tags'), doneStage.id, subStages);

    updateTask.mutate(
      { id: task.id, description, stageId: doneStage.id, tags },
      {
        onSuccess: (updated) => {
          if ('vibrate' in navigator) navigator.vibrate(10);
          applySavedFields(form, { description, stageId: doneStage.id, tags: tags ?? [] });
          setSavedTask(updated);
          setOpen(false);
          toast({
            title: 'Marked done',
            description: `Moved to ${cleanLabel(doneStage.name)}. Go you!`,
          });
        },
        onError: (error) => {
          toast({
            title: 'Could not mark it done',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return {
    open,
    start: () => {
      setOpen(true);
    },
    cancel: () => {
      if (!updateTask.isPending) setOpen(false);
    },
    markDone,
    isMarkingDone: updateTask.isPending,
    markDoneBlockedReason: doneStage ? null : 'This board has no Done column to move it to.',
    /** The task as last saved here, or null when Mark done has not run on it. */
    savedTask: savedTask?.id === taskId ? savedTask : null,
  };
}
