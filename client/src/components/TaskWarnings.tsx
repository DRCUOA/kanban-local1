/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Task } from '@shared/schema';
import { TASK_STATUS, TASK_PRIORITY, getStatusFromStageName } from '@shared/constants';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Clock } from 'lucide-react';
import { isPast, isToday, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useStages } from '@/hooks/use-stages';

interface TaskWarningsProps {
  tasks: Task[];
}

export function TaskWarnings({ tasks }: TaskWarningsProps) {
  const { data: stages = [] } = useStages();

  const activeTasks = tasks.filter((t) => !t.archived);

  const getTaskStatus = (t: Task): string => {
    if (t.status) return t.status;
    const stage = stages.find((s: any) => s.id === t.stageId);
    if (stage) return getStatusFromStageName(stage.name);
    return TASK_STATUS.BACKLOG;
  };

  const inProgressTasks = activeTasks.filter((t) => getTaskStatus(t) === TASK_STATUS.IN_PROGRESS);
  const highPriorityBacklog = activeTasks.filter(
    (t) =>
      getTaskStatus(t) === TASK_STATUS.BACKLOG &&
      (t.priority === TASK_PRIORITY.HIGH || t.priority === TASK_PRIORITY.CRITICAL),
  );

  const overdueTasks = activeTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return isPast(due) && !isToday(due);
  });

  const staleTasks = activeTasks.filter((t) => {
    if (!t.updatedAt) return false;
    const updated = new Date(t.updatedAt);
    return differenceInDays(new Date(), updated) >= 14;
  });

  const warnings = [];

  if (inProgressTasks.length > 3) {
    warnings.push({
      type: 'info',
      icon: AlertCircle,
      title: 'Many in progress',
      message: `${inProgressTasks.length} tasks in progress. Focus on fewer.`,
    });
  }

  if (highPriorityBacklog.length > 0) {
    warnings.push({
      type: 'warning',
      icon: AlertCircle,
      title: 'High-priority waiting',
      message: `${highPriorityBacklog.length} high-priority in backlog.`,
    });
  }

  if (overdueTasks.length > 0) {
    warnings.push({
      type: 'destructive',
      icon: Clock,
      title: 'Overdue',
      message: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} overdue.`,
    });
  }

  if (staleTasks.length > 0) {
    warnings.push({
      type: 'info',
      icon: AlertCircle,
      title: 'Stale tasks',
      message: `${staleTasks.length} not updated in 14+ days.`,
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-3">
      {warnings.map((warning, idx) => {
        const Icon = warning.icon;
        return (
          <Alert
            key={idx}
            className={cn(
              'border-l-4 py-2 px-3 rounded-lg',
              warning.type === 'destructive' && 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
              warning.type === 'warning' &&
                'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
              warning.type === 'info' && 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <AlertTitle className="text-xs font-semibold">{warning.title}</AlertTitle>
                <AlertDescription className="text-[10px] mt-0.5">
                  {warning.message}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
