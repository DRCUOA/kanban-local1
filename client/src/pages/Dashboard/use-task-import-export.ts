/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-non-null-assertion, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { type Task, type InsertTask, type Stage } from '@shared/schema';
import { TASK_STATUS, TASK_PRIORITY, TASK_RECURRENCE } from '@shared/constants';
import { apiGet } from '@/lib/api';
import { api } from '@shared/routes';
import { logger } from '@shared/logger';
import { useToast } from '@/hooks/use-toast';
import { useCreateTask } from '@/hooks/use-tasks';

export interface UseTaskImportExportOptions {
  tasks: Task[] | undefined;
  stages: Stage[];
}

export function useTaskImportExport({ tasks, stages }: UseTaskImportExportOptions) {
  const { toast } = useToast();
  const createTask = useCreateTask();

  const handleExport = () => {
    if (!tasks) return;
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);

          if (!Array.isArray(imported)) {
            toast({
              title: 'Invalid format',
              description: 'Import file must contain an array of tasks.',
              variant: 'destructive',
            });
            return;
          }

          localStorage.setItem('taskflow-backup', JSON.stringify(imported));

          let stagesData = stages;
          try {
            const fetchedStages = await apiGet<Stage[]>(api.stages.list.path);
            if (Array.isArray(fetchedStages) && fetchedStages.length > 0)
              stagesData = fetchedStages;
          } catch (error: unknown) {
            logger.error('Error fetching stages:', error);
            if (!stagesData || stagesData.length === 0) {
              toast({
                title: 'Error fetching stages',
                description: error instanceof Error ? error.message : 'Could not load stages.',
                variant: 'destructive',
              });
              return;
            }
          }

          if (!Array.isArray(stagesData) || stagesData.length === 0) {
            toast({
              title: 'No stages found',
              description: 'Please create stages before importing tasks.',
              variant: 'destructive',
            });
            return;
          }

          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          for (const taskData of imported) {
            try {
              const taskToCreate = {
                title: taskData.title || 'Untitled Task',
                description: taskData.description || '',
                stageId: taskData.stageId || stagesData[0]!.id,
                status: taskData.status || TASK_STATUS.BACKLOG,
                priority: taskData.priority || TASK_PRIORITY.NORMAL,
                effort: taskData.effort || undefined,
                dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
                tags: Array.isArray(taskData.tags) ? taskData.tags : [],
                recurrence: taskData.recurrence || TASK_RECURRENCE.NONE,
              } as InsertTask;

              if (!stagesData.find((s: any) => s.id === taskToCreate.stageId)) {
                taskToCreate.stageId = stagesData[0]!.id;
              }

              await createTask.mutateAsync(taskToCreate);
              successCount++;
            } catch (error: any) {
              errorCount++;
              errors.push(
                `Task "${taskData.title || 'Untitled'}": ${error.message || 'Unknown error'}`,
              );
            }
          }

          if (successCount > 0) {
            toast({
              title: 'Import completed',
              description: `Successfully imported ${successCount} task${successCount > 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
            });
          }
          if (errorCount > 0 && successCount === 0) {
            toast({
              title: 'Import failed',
              description: `Failed to import ${errorCount} task${errorCount > 1 ? 's' : ''}.`,
              variant: 'destructive',
            });
            logger.error('Import errors:', errors);
          }
        } catch (error: any) {
          toast({
            title: 'Import error',
            description: error.message || 'Failed to parse import file.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return { handleExport, handleImport };
}
