/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Task } from '@shared/schema';
import { useStages } from '@/hooks/use-stages';
import { useEditTaskForm } from '@/hooks/use-edit-task-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { EditTaskFormFields } from '@/components/EditTaskFormFields';
import { EditTaskDialogActions } from '@/components/EditTaskDialogActions';
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
            <EditTaskFormFields control={form.control} stages={stages} />

            <div className="flex-1" />

            <EditTaskDialogActions
              onViewHistory={onViewHistory}
              onDelete={handleDelete}
              onCancel={() => {
                onOpenChange(false);
              }}
              isSaving={isSaving}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
