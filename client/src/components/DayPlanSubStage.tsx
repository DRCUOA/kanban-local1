import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@shared/schema";
import { TaskCard } from "./TaskCard";
import { TaskCardSummary } from "./TaskCardSummary";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DayPlanSubStageProps {
  stageId: number;
  stageName?: string;
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
  stageName = "",
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
  const isInProgressStage = (name: string) => {
    const n = name.toLowerCase();
    return n.includes("progress") || n.includes("doing") || n.includes("active");
  };
  const isInProgress = isInProgressStage(stageName);

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
        <Badge variant="secondary" className="text-sm font-semibold font-mono px-2 py-0.5 min-h-[24px]">
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
          <div className={cn(
            "gap-2 min-h-[40px]",
            isInProgress ? "flex flex-col" : "flex flex-wrap content-start"
          )}>
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCardSummary
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  stageColor={displayStageColor}
                  isInProgress={isInProgress}
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
