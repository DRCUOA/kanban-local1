import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@shared/schema";
import { TaskCard } from "./TaskCard";
import { TaskCardSummary } from "./TaskCardSummary";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DayPlanSubStageProps {
  stageId: number;
  subStage: {
    name: string;
    tag: string;
    bgClass: string;
    opacity: number;
  };
  tasks: Task[];
  stageColor: string;
  viewMode: "detail" | "summary";
  onTaskClick: (task: Task) => void;
}

export function DayPlanSubStage({
  stageId,
  subStage,
  tasks,
  stageColor,
  viewMode,
  onTaskClick,
}: DayPlanSubStageProps) {
  const subStageId = `${stageId}-${subStage.tag}`;
  
  const { setNodeRef, isOver } = useDroppable({
    id: subStageId,
    data: {
      type: "SubStage",
      subStageTag: subStage.tag,
    },
  });

  const displayStageColor = stageColor || "#3B82F6";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 p-2.5 rounded-xl transition-colors min-h-[60px]",
        subStage.bgClass,
        isOver && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {subStage.name}
        </h3>
        <Badge variant="secondary" className="text-[9px] font-mono px-1 py-0 touch-target-sm min-h-0 min-w-0 h-4">
          {tasks.length}
        </Badge>
      </div>
      
      <SortableContext
        id={subStageId}
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {viewMode === "detail" ? (
          <div className="flex flex-col gap-2 min-h-[40px]">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  stageColor={displayStageColor}
                  onInlineEdit={() => {}}
                />
              ))
            ) : (
              <div className="text-[10px] text-muted-foreground text-center py-3 opacity-50">
                No tasks
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 content-start min-h-[40px]">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCardSummary
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  stageColor={displayStageColor}
                />
              ))
            ) : (
              <div className="text-[10px] text-muted-foreground text-center py-3 w-full opacity-50">
                No tasks
              </div>
            )}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
