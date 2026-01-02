import { Task } from "@shared/schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineTaskEditor } from "./InlineTaskEditor";
import { format, isPast, isToday } from "date-fns";

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  stageColor?: string;
  onInlineEdit?: () => void;
}

export function TaskCard({ task, onClick, stageColor, onInlineEdit }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Priority styling
  const priorityStyles = {
    low: { borderWidth: "1px", dotOpacity: 0.3 },
    normal: { borderWidth: "2px", dotOpacity: 0.5 },
    high: { borderWidth: "3px", dotOpacity: 0.7 },
    critical: { borderWidth: "4px", dotOpacity: 1 },
  };
  const priority = (task.priority as keyof typeof priorityStyles) || "normal";
  const priorityStyle = priorityStyles[priority] || priorityStyles.normal;

  // Overdue check
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-primary/10 border-2 border-primary border-dashed rounded-xl h-[120px]"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        onClick={(e) => {
          // Don't trigger onClick when clicking on inline editor
          if ((e.target as HTMLElement).closest('.inline-editor')) {
            return;
          }
          onClick(task);
        }}
        {...attributes}
        {...listeners}
        className={cn(
          "group relative cursor-pointer transition-all duration-300 active:scale-[0.97]",
          stageColor && "border-2",
          isOverdue && "opacity-90 saturate-75",
          isDueToday && "ring-2 ring-yellow-500/30"
        )}
        style={stageColor ? { 
          borderColor: stageColor,
          borderWidth: priorityStyle.borderWidth,
        } : {
          borderWidth: priorityStyle.borderWidth,
        }}
      >
        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-base font-semibold leading-tight pr-6 inline-editor">
            <InlineTaskEditor
              task={task}
              field="title"
              onSave={onInlineEdit}
              className="w-full"
            />
          </CardTitle>
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 absolute top-4 right-3 transition-opacity" />
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="inline-editor mb-3">
            <InlineTaskEditor
              task={task}
              field="description"
              onSave={onInlineEdit}
              className="text-sm text-muted-foreground"
            />
          </div>
          
          {/* Priority and Effort indicators */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {task.priority && task.priority !== "normal" && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-normal",
                  priority === "high" && "border-orange-500/50 text-orange-600 dark:text-orange-400",
                  priority === "critical" && "border-red-500/50 text-red-600 dark:text-red-400"
                )}
              >
                {priority}
              </Badge>
            )}
            {task.effort && (
              <Badge variant="secondary" className="text-xs font-normal">
                {task.effort}/5 effort
              </Badge>
            )}
          </div>

          {/* Due date and overdue indicator */}
          {dueDate && (
            <div className={cn(
              "flex items-center gap-1.5 mb-3 text-xs",
              isOverdue && "text-red-600 dark:text-red-400 font-medium",
              isDueToday && "text-yellow-600 dark:text-yellow-400 font-medium",
              !isOverdue && !isDueToday && "text-muted-foreground"
            )}>
              {isOverdue && <AlertCircle className="h-3 w-3" />}
              {isDueToday && <Clock className="h-3 w-3" />}
              <span>Due: {format(dueDate, "MMM d")}</span>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1 mb-3 flex-wrap">
              {task.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{task.tags.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-auto">
            <Badge 
              variant="secondary" 
              className="text-xs font-normal bg-secondary/50 text-secondary-foreground/80"
            >
              #{task.id}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(task.createdAt || new Date()).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
