/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useState } from 'react';
import type { Task } from '@shared/schema';
import { useStages } from '@/hooks/use-stages';
import { useEditTaskForm } from '@/hooks/use-edit-task-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { EditTaskFormFields } from '@/components/EditTaskFormFields';
import { EditTaskDialogActions } from '@/components/EditTaskDialogActions';
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
  const { form, onSubmit, handleDelete, isSaving } = useEditTaskForm({ task, open, onOpenChange });

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
      <DialogContent className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg">Edit Task</DialogTitle>
        </DialogHeader>
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
        source={task ? { type: 'tasks', tasks: [task], stages } : null}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />
    </Dialog>
  );
}
