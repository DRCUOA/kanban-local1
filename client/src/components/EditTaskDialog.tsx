/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useEffect, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Task } from '@shared/schema';
import { useStages, useSubStages } from '@/hooks/use-stages';
import { useMarkTaskViewed } from '@/hooks/use-tasks';
import { useEditTaskForm } from '@/hooks/use-edit-task-form';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useZenDoing } from '@/hooks/use-zen-doing';
import { ZenDoingButton } from '@/components/zen/ZenDoingButton';
import { ZenDoingView } from '@/components/zen/ZenDoingView';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { EditTaskFormFields } from '@/components/EditTaskFormFields';
import { EditTaskDialogActions } from '@/components/EditTaskDialogActions';
import { CopyTaskJsonButton } from '@/components/CopyTaskJsonButton';
import { ShareDialog } from '@/components/ShareDialog';
import { GoalPlanDialog } from '@/components/GoalPlanDialog';
import { useToast } from '@/hooks/use-toast';
import { TASK_TYPE } from '@shared/constants';
import 'react-day-picker/dist/style.css';

export interface EditTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewHistory?: () => void;
}

export function EditTaskDialog({ task, open, onOpenChange, onViewHistory }: EditTaskDialogProps) {
  const { data: stages = [] } = useStages();
  const { data: subStages } = useSubStages();
  const { form, onSubmit, handleDelete, isSaving } = useEditTaskForm({ task, open, onOpenChange });

  // Zen doing mode follows the form, not the saved task: the icon is the
  // project the form names now, and the view shows the description as it
  // stands in the form.
  const { projectById } = useProjectScope();
  const formProjectId = useWatch({ control: form.control, name: 'projectId' });
  const formDescription = useWatch({ control: form.control, name: 'description' });
  const zen = useZenDoing({
    task,
    form,
    stages,
    subStages: subStages ?? [],
    dialogOpen: open,
  });
  // After Mark done the task prop is the task as it was opened; what was saved
  // is newer, and Copy JSON and Share copy the saved task.
  const savedTask = zen.savedTask ?? task;
  // Zen hands focus back to this dialog when it closes.
  const contentRef = useRef<HTMLDivElement>(null);

  // Opening a task is what seeing it means: a task mail made stops being new.
  const { mutate: markViewed } = useMarkTaskViewed();
  const unseenId = open && task && task.viewedAt === null ? task.id : null;
  useEffect(() => {
    if (unseenId !== null) markViewed(unseenId);
  }, [unseenId, markViewed]);

  // Share opens the format/action dialog. It reflects the saved task, so any
  // unsaved edits in this dialog are not included.
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const { toast } = useToast();

  // Checked here, before any request: the plan is built from the saved task,
  // so unsaved edits would be ignored, and only a goal has building-blocks.
  const makeGoal = () => {
    if (!task) return;
    if (form.formState.isDirty) {
      toast({
        title: 'Save your changes first',
        description: 'The AI plans from the saved task. Save, then press Make this a goal.',
        variant: 'destructive',
      });
      return;
    }
    if (task.type !== TASK_TYPE.GOAL) {
      toast({
        title: 'This task is not a goal yet',
        description: 'Set Type to Goal and save, then press Make this a goal.',
        variant: 'destructive',
      });
      return;
    }
    setIsPlanOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col"
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg">Edit Task</DialogTitle>
        </DialogHeader>
        {task && (
          <ZenDoingButton
            project={projectById(formProjectId ?? null)}
            onStart={zen.start}
            className="absolute left-1/2 top-4 h-11 w-11 -translate-x-1/2"
          />
        )}
        {/* Like Share, this copies the saved task, not unsaved edits. It waits
            for the stages so the file always carries them. */}
        {savedTask && stages.length > 0 && subStages && (
          <CopyTaskJsonButton
            task={savedTask}
            stages={stages}
            subStages={subStages}
            className="absolute right-20 top-4 h-11 w-11"
          />
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 flex flex-col gap-4 overflow-y-auto scroll-container"
          >
            <EditTaskFormFields control={form.control} stages={stages} taskId={task?.id} />

            <div className="flex-1" />

            <EditTaskDialogActions
              onViewHistory={onViewHistory}
              onShare={
                task
                  ? () => {
                      setIsShareOpen(true);
                    }
                  : undefined
              }
              onMakeGoal={task ? makeGoal : undefined}
              onDelete={handleDelete}
              onCancel={() => {
                onOpenChange(false);
              }}
              isSaving={isSaving}
            />
          </form>
        </Form>
      </DialogContent>

      {task && <GoalPlanDialog goal={task} open={isPlanOpen} onOpenChange={setIsPlanOpen} />}

      <ShareDialog
        source={savedTask ? { type: 'tasks', tasks: [savedTask], stages } : null}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />

      <ZenDoingView
        open={zen.open}
        description={formDescription}
        onMarkDone={zen.markDone}
        onCancel={zen.cancel}
        isMarkingDone={zen.isMarkingDone}
        markDoneBlockedReason={zen.markDoneBlockedReason}
        returnFocusTo={contentRef}
      />
    </Dialog>
  );
}
