import { useMemo, useState } from "react";
import { Task } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { TaskColumn } from "./TaskColumn";
import { TaskCard } from "./TaskCard";
import { TaskCardSummary } from "./TaskCardSummary";
import { ArchiveZone } from "./ArchiveZone";
import { useUpdateTask, useArchiveTask } from "@/hooks/use-tasks";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  viewMode?: "detail" | "summary";
  focusMode?: boolean;
}

export function KanbanBoard({ tasks, onTaskClick, viewMode = "detail", focusMode = false }: KanbanBoardProps) {
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeTasks, setActiveTasks] = useState(tasks);
  const [isOverArchive, setIsOverArchive] = useState(false);

  const { data: stages = [] } = useQuery({
    queryKey: [api.stages.list.path],
    queryFn: async () => {
      const res = await fetch(api.stages.list.path);
      return res.json();
    },
  });

  useMemo(() => {
    setActiveTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    setIsOverArchive(over?.id === "archive");
  }

  // Map stage names to status values
  const getStatusFromStageName = (stageName: string): "backlog" | "in_progress" | "done" | "abandoned" => {
    const name = stageName.toLowerCase();
    if (name.includes("progress") || name.includes("doing") || name.includes("active")) {
      return "in_progress";
    }
    if (name.includes("done") || name.includes("complete") || name.includes("finished")) {
      return "done";
    }
    if (name.includes("abandon") || name.includes("cancel")) {
      return "abandoned";
    }
    return "backlog";
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    setIsOverArchive(false);
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = activeTasks.find((t) => t.id === active.id);
    
    // Check if dropped on archive zone
    if (over.id === "archive" && activeTask) {
      setActiveTasks(tasks => tasks.filter(t => t.id !== activeTask.id));
      archiveTask.mutate(activeTask.id);
      setActiveId(null);
      return;
    }

    const overContainerId = over.data.current?.sortable?.containerId || over.id;

    if (activeTask && typeof overContainerId === 'number') {
      const newStageId = overContainerId as number;
      const newStage = sortedStages.find((s: any) => s.id === newStageId);
      
      if (activeTask.stageId !== newStageId && newStage) {
        // Infer status from stage name
        const newStatus = getStatusFromStageName(newStage.name);
        
        setActiveTasks(tasks => 
          tasks.map(t => t.id === activeTask.id ? { 
            ...t, 
            stageId: newStageId,
            status: newStatus 
          } : t)
        );
        
        // Update both stageId and status
        updateTask.mutate({ 
          id: activeTask.id, 
          stageId: newStageId,
          status: newStatus 
        });
      }
    }
    
    setActiveId(null);
  }

  // Color palette for stages - fallback colors if stage doesn't have one
  const defaultStageColors = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#84CC16", // Lime
    "#F97316", // Orange
    "#6366F1", // Indigo
  ];

  const getDefaultStageColor = (index: number): string => {
    return defaultStageColors[index % defaultStageColors.length];
  };

  // Memoize sorted stages and color map to recalculate when stages change
  const sortedStages = useMemo(() => {
    return [...stages].sort((a: any, b: any) => a.order - b.order);
  }, [stages]);

  // Create a map of stage IDs to colors (use stored color or fallback)
  // Recalculate when stages change
  const stageColorMap = useMemo(() => {
    const map = new Map<number, string>();
    sortedStages.forEach((stage: any, index: number) => {
      const color = stage.color || getDefaultStageColor(index);
      map.set(stage.id, color);
    });
    return map;
  }, [sortedStages]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row h-full gap-8 overflow-y-auto lg:overflow-y-visible lg:overflow-x-auto pb-6">
        {sortedStages.map((stage: any, index: number) => {
          const stageColor = stageColorMap.get(stage.id) || defaultStageColors[0];
          return (
            <TaskColumn
              key={stage.id}
              id={stage.id}
              title={stage.name}
              count={activeTasks.filter((t) => t.stageId === stage.id).length}
              stageColor={stageColor}
            >
              <SortableContext
                id={stage.id}
                items={activeTasks.filter((t) => t.stageId === stage.id).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {viewMode === "detail" ? (
                  <div className="flex flex-col gap-3 min-h-[100px]">
                    {activeTasks
                      .filter((task) => task.stageId === stage.id)
                      .map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={onTaskClick}
                          stageColor={stageColor}
                          onInlineEdit={() => {
                            // Trigger refetch if needed
                          }}
                        />
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 min-h-[100px] content-start">
                    {activeTasks
                      .filter((task) => task.stageId === stage.id)
                      .map((task) => (
                        <TaskCardSummary
                          key={task.id}
                          task={task}
                          onClick={onTaskClick}
                          stageColor={stageColor}
                        />
                      ))}
                  </div>
                )}
              </SortableContext>
            </TaskColumn>
          );
        })}
      </div>
      
      <ArchiveZone isOver={isOverArchive} />
      
      <DragOverlay>
        {activeId ? (() => {
          const activeTask = activeTasks.find(t => t.id === activeId);
          if (!activeTask) return null;
          const activeStageColor = stageColorMap.get(activeTask.stageId) || defaultStageColors[0];
          return (
            <div className={viewMode === "detail" ? "opacity-80 rotate-2 cursor-grabbing" : "opacity-80 cursor-grabbing"}>
              {viewMode === "detail" ? (
                <TaskCard 
                  task={activeTask} 
                  onClick={() => {}}
                  stageColor={activeStageColor}
                />
              ) : (
                <TaskCardSummary
                  task={activeTask}
                  onClick={() => {}}
                  stageColor={activeStageColor}
                />
              )}
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
}
