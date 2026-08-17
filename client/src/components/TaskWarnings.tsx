import type { Task } from '@shared/schema';
import { TASK_STATUS, TASK_PRIORITY } from '@shared/constants';
import { resolveTaskStatusForWarnings } from '@shared/task-warning-highlight';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock } from 'lucide-react';
import { isOverdueOn } from '@shared/briefing';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useStages } from '@/hooks/use-stages';

interface TaskWarningsProps {
  tasks: Task[];
  className?: string;
}

type WarningTone = 'info' | 'warning' | 'destructive';

interface BoardWarning {
  kind: 'in-progress' | 'high-priority' | 'overdue' | 'stale';
  tone: WarningTone;
  icon: typeof AlertCircle;
  title: string;
  count: number;
  /** Full sentence — the pill shows only title + count, this is its tooltip. */
  message: string;
}

const TONE_CLASS: Record<WarningTone, string> = {
  destructive: 'text-danger',
  warning: 'text-warning',
  info: 'text-primary',
};

/**
 * Board-level warnings as compact pills — icon, title, count — meant to sit in
 * the stage-chip row so they cost no vertical space on a wide viewport. The
 * full sentence is the pill's tooltip and accessible name. Colours match the
 * task-border accents these warnings share (overdue red, high-priority gold,
 * info blue).
 */
export function TaskWarnings({ tasks, className }: TaskWarningsProps) {
  const { data: stages = [] } = useStages();

  const activeTasks = tasks.filter((t) => !t.archived);

  const inProgressTasks = activeTasks.filter(
    (t) => resolveTaskStatusForWarnings(t, stages) === TASK_STATUS.IN_PROGRESS,
  );
  const highPriorityBacklog = activeTasks.filter(
    (t) =>
      resolveTaskStatusForWarnings(t, stages) === TASK_STATUS.BACKLOG &&
      (t.priority === TASK_PRIORITY.HIGH || t.priority === TASK_PRIORITY.CRITICAL),
  );

  // Same helper as the card highlight and the export's `overdue` list.
  const overdueTasks = activeTasks.filter((t) => isOverdueOn(t.dueDate, new Date()));

  const staleTasks = activeTasks.filter((t) => {
    if (!t.updatedAt) return false;
    const updated = new Date(t.updatedAt);
    return differenceInDays(new Date(), updated) >= 14;
  });

  const warnings: BoardWarning[] = [];

  if (inProgressTasks.length > 3) {
    warnings.push({
      kind: 'in-progress',
      tone: 'info',
      icon: AlertCircle,
      title: 'Many in progress',
      count: inProgressTasks.length,
      message: `${inProgressTasks.length} tasks in progress. Focus on fewer.`,
    });
  }

  if (highPriorityBacklog.length > 0) {
    warnings.push({
      kind: 'high-priority',
      tone: 'warning',
      icon: AlertCircle,
      title: 'High-priority waiting',
      count: highPriorityBacklog.length,
      message: `${highPriorityBacklog.length} high-priority in backlog.`,
    });
  }

  if (overdueTasks.length > 0) {
    warnings.push({
      kind: 'overdue',
      tone: 'destructive',
      icon: Clock,
      title: 'Overdue',
      count: overdueTasks.length,
      message: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} overdue.`,
    });
  }

  if (staleTasks.length > 0) {
    warnings.push({
      kind: 'stale',
      tone: 'info',
      icon: AlertCircle,
      title: 'Stale tasks',
      count: staleTasks.length,
      message: `${staleTasks.length} not updated in 14+ days.`,
    });
  }

  if (warnings.length === 0) return null;

  return (
    <ul
      aria-label="Board warnings"
      data-testid="task-warnings"
      // Right-aligned at the end of the chip row; when the pills have wrapped
      // under the chips on a narrow viewport they read better as a left-aligned
      // list than as ragged right-aligned rows.
      className={cn('flex flex-wrap items-center gap-1.5 lg:justify-end', className)}
    >
      {warnings.map((warning) => {
        const Icon = warning.icon;
        return (
          <li
            key={warning.kind}
            title={warning.message}
            aria-label={`${warning.title}: ${warning.message}`}
            data-testid={`task-warning-${warning.kind}`}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 neo-raised',
              TONE_CLASS[warning.tone],
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-wider">
              {warning.title}
            </span>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] neo-pressed rounded-md px-1.5 py-0 min-h-0 min-w-0 h-5"
            >
              {warning.count}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
