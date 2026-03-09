/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  insertTaskSchema,
  type InsertTask,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskRecurrence,
} from '@shared/schema';
import { TASK_STATUS, TASK_PRIORITY, TASK_RECURRENCE } from '@shared/constants';
import { useUpdateTask, useDeleteTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@shared/logger';

export interface UseEditTaskFormOptions {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useEditTaskForm({ task, open, onOpenChange }: UseEditTaskFormOptions) {
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      stageId: 1,
    },
  });

  useEffect(() => {
    if (task && open) {
      try {
        let parsedDueDate: Date | undefined = undefined;
        if (task.dueDate) {
          if (task.dueDate instanceof Date) parsedDueDate = task.dueDate;
          else {
            const date = new Date(task.dueDate);
            if (!isNaN(date.getTime())) parsedDueDate = date;
          }
        }

        form.reset({
          title: task.title,
          description: task.description || '',
          stageId: task.stageId,
          status: (task.status as TaskStatus) || TASK_STATUS.BACKLOG,
          priority: (task.priority as TaskPriority) || TASK_PRIORITY.NORMAL,
          effort: task.effort || undefined,
          dueDate: parsedDueDate,
          tags: Array.isArray(task.tags) ? task.tags : [],
          recurrence: (task.recurrence as TaskRecurrence) || TASK_RECURRENCE.NONE,
        });
      } catch (error) {
        logger.error('Error resetting form:', error);
        form.reset({
          title: task.title || '',
          description: task.description || '',
          stageId: task.stageId || 1,
          status: (task.status as TaskStatus) || TASK_STATUS.BACKLOG,
          priority: (task.priority as TaskPriority) || TASK_PRIORITY.NORMAL,
          effort: task.effort || undefined,
          dueDate: undefined,
          tags: [],
          recurrence: (task.recurrence as TaskRecurrence) || TASK_RECURRENCE.NONE,
        });
      }
    }
  }, [task?.id, open]);

  const onSubmit = (data: InsertTask) => {
    if (!task) return;

    updateTask.mutate(
      { id: task.id, ...data },
      {
        onSuccess: () => {
          if ('vibrate' in navigator) navigator.vibrate(10);
          toast({ title: 'Task updated', description: 'Changes saved.' });
          onOpenChange(false);
        },
        onError: (error) => {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
      },
    );
  };

  const handleDelete = () => {
    if (!task) return;

    deleteTask.mutate(task.id, {
      onSuccess: () => {
        if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
        toast({ title: 'Task deleted', description: 'The task has been permanently removed.' });
        onOpenChange(false);
      },
    });
  };

  return { form, onSubmit, handleDelete, isSaving: updateTask.isPending };
}
