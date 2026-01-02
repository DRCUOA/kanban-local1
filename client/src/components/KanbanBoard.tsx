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
import { DayPlanSubStage } from "./DayPlanSubStage";
import { useUpdateTask, useArchiveTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

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
      try {
        const res = await fetch(api.stages.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch stages: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
        }
        return res.json();
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
  });

  const { data: allSubStages = [] } = useQuery({
    queryKey: [api.subStages.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.subStages.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch sub-stages: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
        }
        return res.json();
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
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
    // Check if over archive zone - handle both string and number IDs, and check data type
    const isArchive = over?.id === "archive" || 
                      String(over?.id) === "archive" ||
                      over?.data?.current?.type === "archive";
    setIsOverArchive(!!isArchive);
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
    
    // Check if dropped on archive zone - handle both string and number IDs, and check data type
    const isArchive = over.id === "archive" || 
                      String(over.id) === "archive" ||
                      over.data?.current?.type === "archive";
    if (isArchive && activeTask) {
      console.log('[KanbanBoard] Archiving task:', activeTask.id);
      setActiveTasks(tasks => tasks.filter(t => t.id !== activeTask.id));
      archiveTask.mutate(activeTask.id, {
        onSuccess: () => {
          console.log('[KanbanBoard] Task archived successfully');
        },
        onError: (error) => {
          console.error('[KanbanBoard] Failed to archive task:', error);
          // Restore task if archive fails
          setActiveTasks(tasks => [...tasks, activeTask]);
        }
      });
      setActiveId(null);
      return;
    }

    const overContainerId = over.data.current?.sortable?.containerId || over.id;
    const overId = typeof overContainerId === 'string' ? overContainerId : overContainerId;

    // Check if dropped on a Day Plan sub-stage (format: "stageId-day-plan-{section}")
    if (activeTask && typeof overId === 'string' && overId.includes('-day-plan-')) {
      const parts = overId.split('-day-plan-');
      const stageId = parseInt(parts[0]);
      const subStage = parts[1];
      const subStageTag = `day-plan-${subStage}`;
      
      // Get current tags and update with sub-stage tag
      const currentTags = activeTask.tags || [];
      const dayPlanTags = ['day-plan-am', 'day-plan-middle', 'day-plan-darker'];
      const filteredTags = currentTags.filter((tag: string) => !dayPlanTags.includes(tag));
      const newTags = [...filteredTags, subStageTag];
      
      // Ensure task is in the Day Plan stage
      const dayPlanStage = sortedStages.find((s: any) => s.id === stageId);
      if (dayPlanStage && activeTask.stageId !== stageId) {
        const newStatus = getStatusFromStageName(dayPlanStage.name);
        setActiveTasks(tasks => 
          tasks.map(t => t.id === activeTask.id ? { 
            ...t, 
            stageId: stageId,
            status: newStatus,
            tags: newTags
          } : t)
        );
        updateTask.mutate({ 
          id: activeTask.id, 
          stageId: stageId,
          status: newStatus,
          tags: newTags
        });
      } else {
        // Just update tags if already in Day Plan stage
        setActiveTasks(tasks => 
          tasks.map(t => t.id === activeTask.id ? { 
            ...t, 
            tags: newTags
          } : t)
        );
        updateTask.mutate({ 
          id: activeTask.id, 
          tags: newTags
        });
      }
      
      setActiveId(null);
      return;
    }

    if (activeTask && typeof overContainerId === 'number') {
      const newStageId = overContainerId as number;
      const newStage = sortedStages.find((s: any) => s.id === newStageId);
      
      if (activeTask.stageId !== newStageId && newStage) {
        // Infer status from stage name
        const newStatus = getStatusFromStageName(newStage.name);
        
        // If moving to Day Plan, keep tags; if moving away, remove day-plan tags
        let newTags = activeTask.tags || [];
        if (!newStage.name.toLowerCase().includes("day plan")) {
          // Remove day-plan tags when moving away from Day Plan
          const dayPlanTags = ['day-plan-am', 'day-plan-middle', 'day-plan-darker'];
          newTags = newTags.filter((tag: string) => !dayPlanTags.includes(tag));
        }
        
        setActiveTasks(tasks => 
          tasks.map(t => t.id === activeTask.id ? { 
            ...t, 
            stageId: newStageId,
            status: newStatus,
            tags: newTags.length > 0 ? newTags : undefined
          } : t)
        );
        
        // Update stageId, status, and tags
        updateTask.mutate({ 
          id: activeTask.id, 
          stageId: newStageId,
          status: newStatus,
          tags: newTags.length > 0 ? newTags : undefined
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
      <div className="flex flex-col h-full gap-8 overflow-y-auto lg:overflow-y-visible lg:overflow-x-auto pb-6">
        <div className="flex flex-col lg:flex-row gap-8">
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
                {(() => {
                  const stageTasks = activeTasks.filter((task) => task.stageId === stage.id);
                  
                  // Get sub-stages for this stage from database
                  const stageSubStages = allSubStages
                    .filter((ss: any) => ss.stageId === stage.id)
                    .sort((a: any, b: any) => a.order - b.order)
                    .map((ss: any) => ({
                      name: ss.name,
                      tag: ss.tag,
                      bgClass: ss.bgClass,
                      opacity: ss.opacity / 100, // Convert from 0-100 to 0-1
                    }));
                  
                  // If stage has sub-stages, render them
                  if (stageSubStages.length > 0) {
                    return (
                      <div className="flex flex-col gap-3 min-h-[100px]">
                        {stageSubStages.map((subStage, subIndex) => {
                          // Filter tasks by tag, or assign to first sub-stage if no tag
                          const subStageTasks = stageTasks.filter((task) => {
                            const tags = task.tags || [];
                            if (tags.length === 0 && subIndex === 0) return true; // Default to first sub-stage if no tags
                            return tags.includes(subStage.tag);
                          });
                          
                          return (
                            <DayPlanSubStage
                              key={subStage.tag}
                              stageId={stage.id}
                              subStage={subStage}
                              tasks={subStageTasks}
                              stageColor={stageColor}
                              viewMode={viewMode}
                              onTaskClick={onTaskClick}
                            />
                          );
                        })}
                      </div>
                    );
                  }
                  
                  // Default rendering for non-Day Plan stages
                  return viewMode === "detail" ? (
                    <div className="flex flex-col gap-3 min-h-[100px]">
                      {stageTasks.map((task) => (
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
                      {stageTasks.map((task) => (
                        <TaskCardSummary
                          key={task.id}
                          task={task}
                          onClick={onTaskClick}
                          stageColor={stageColor}
                        />
                      ))}
                    </div>
                  );
                })()}
              </SortableContext>
            </TaskColumn>
          );
        })}
        </div>
        
        <ArchiveZone isOver={isOverArchive} />
      </div>
      
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
