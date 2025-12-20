import { Task } from "@shared/schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        onClick={() => onClick(task)}
        className="group relative cursor-pointer bg-card hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
      >
        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-base font-semibold leading-tight pr-6">
            {task.title}
          </CardTitle>
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 absolute top-4 right-3 transition-opacity" />
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {task.description}
            </p>
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
