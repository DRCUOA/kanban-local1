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
    opacity: number; // Opacity level (0.2, 0.4, 0.6) - not used for color adjustment
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
  // Generate unique ID for this sub-stage using stageId and tag
  const subStageId = `${stageId}-${subStage.tag}`;
  
  const { setNodeRef, isOver } = useDroppable({
    id: subStageId,
    data: {
      type: "SubStage",
      subStageTag: subStage.tag,
    },
  });

  // Use stage color directly without tone adjustment
  const displayStageColor = stageColor || "#3B82F6";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-2xl transition-colors min-h-[80px]",
        subStage.bgClass,
        isOver && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {subStage.name}
        </h3>
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0.5">
          {tasks.length}
        </Badge>
      </div>
      
      <SortableContext
        id={subStageId}
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {viewMode === "detail" ? (
          <div className="flex flex-col gap-2 min-h-[60px]">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  stageColor={displayStageColor}
                  onInlineEdit={() => {
                    // Trigger refetch if needed
                  }}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4 opacity-50">
                No tasks
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 content-start min-h-[60px]">
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
              <div className="text-xs text-muted-foreground text-center py-4 w-full opacity-50">
                No tasks
              </div>
            )}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
