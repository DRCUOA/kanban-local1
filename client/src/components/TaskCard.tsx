/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Task } from '@shared/schema';
import { TASK_PRIORITY, EFFORT_MAX } from '@shared/constants';
import { getTaskWarningHighlight } from '@shared/task-warning-highlight';
import { TASK_WARNING_BORDER_COLOR } from '@/lib/task-warning-border';
import { useStages } from '@/hooks/use-stages';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineTaskEditor } from './InlineTaskEditor';
import { format, isPast, isToday } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  stageColor?: string;
  onInlineEdit?: () => void;
}

export function TaskCard({ task, onClick, stageColor, onInlineEdit }: TaskCardProps) {
  const { data: stages = [] } = useStages();
  const warningHighlight = getTaskWarningHighlight(task, stages);
  const borderColor =
    warningHighlight != null ? TASK_WARNING_BORDER_COLOR[warningHighlight] : stageColor;
  const showStageOrWarningBorder = Boolean(warningHighlight != null || stageColor);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Priority styling
  const priorityStyles = {
    [TASK_PRIORITY.LOW]: { borderWidth: '1px', dotOpacity: 0.3 },
    [TASK_PRIORITY.NORMAL]: { borderWidth: '2px', dotOpacity: 0.5 },
    [TASK_PRIORITY.HIGH]: { borderWidth: '3px', dotOpacity: 0.7 },
    [TASK_PRIORITY.CRITICAL]: { borderWidth: '4px', dotOpacity: 1 },
  };
  const priority = (task.priority as keyof typeof priorityStyles) || TASK_PRIORITY.NORMAL;
  const priorityStyle = priorityStyles[priority] || priorityStyles[TASK_PRIORITY.NORMAL];

  // Overdue check
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-primary/10 border-2 border-primary border-dashed rounded-xl h-[100px]"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.inline-editor')) return;
          if ((e.target as HTMLElement).closest('.drag-handle')) return;
          if ('vibrate' in navigator) navigator.vibrate(5);
          onClick(task);
        }}
        {...attributes}
        tabIndex={0}
        className={cn(
          'group relative cursor-pointer transition-transform duration-200 ease-out active:scale-[0.97] focus-visible:scale-[1.03] task-card-magnify',
          showStageOrWarningBorder && 'border-2',
          isOverdue && 'opacity-90 saturate-75',
          isDueToday && 'ring-2 ring-yellow-500/30',
        )}
        style={
          showStageOrWarningBorder && borderColor
            ? {
                borderColor,
                borderWidth: priorityStyle.borderWidth,
              }
            : {
                borderWidth: priorityStyle.borderWidth,
              }
        }
      >
        <div
          className="drag-handle absolute top-0 right-0 p-3 cursor-grab active:cursor-grabbing z-10"
          onContextMenu={(e) => e.preventDefault()}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground/50" />
        </div>

        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-base font-semibold leading-tight pr-8 inline-editor">
            <InlineTaskEditor task={task} field="title" onSave={onInlineEdit} className="w-full" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="inline-editor mb-2">
            <InlineTaskEditor
              task={task}
              field="description"
              onSave={onInlineEdit}
              className="text-sm text-muted-foreground"
            />
          </div>

          {/* Priority and Effort - compact row */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {task.priority && task.priority !== TASK_PRIORITY.NORMAL && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-normal px-1.5 py-0 touch-target-sm min-h-0 min-w-0 h-5',
                  priority === 'high' && 'border-orange-500/50 text-orange-600',
                  priority === 'critical' && 'border-red-500/50 text-red-600',
                )}
              >
                {priority}
              </Badge>
            )}
            {task.effort && (
              <Badge
                variant="secondary"
                className="text-xs font-normal px-1.5 py-0 touch-target-sm min-h-0 min-w-0 h-5"
              >
                {task.effort}/{EFFORT_MAX}
              </Badge>
            )}
          </div>

          {/* Due date */}
          {dueDate && (
            <div
              className={cn(
                'flex items-center gap-1 mb-2 text-xs',
                isOverdue && 'text-red-600 font-medium',
                isDueToday && 'text-yellow-600 font-medium',
                !isOverdue && !isDueToday && 'text-muted-foreground',
              )}
            >
              {isOverdue && <AlertCircle className="h-3 w-3" />}
              {isDueToday && <Clock className="h-3 w-3" />}
              <span>Due: {format(dueDate, 'MMM d')}</span>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {task.tags.slice(0, 3).map((tag: string, idx: number) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs px-1 py-0 touch-target-sm min-h-0 min-w-0 h-4"
                >
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-1">
            <Badge
              variant="secondary"
              className="text-xs font-normal bg-secondary/50 text-secondary-foreground/80 px-1.5 py-0 touch-target-sm min-h-0 min-w-0 h-5"
            >
              #{task.id}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(task.createdAt || new Date()).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
