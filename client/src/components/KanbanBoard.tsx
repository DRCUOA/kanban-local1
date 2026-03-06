import { useEffect, useMemo, useState } from "react";
import { Task } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { 
  DndContext, 
  DragOverlay, 
  closestCenter, 
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  MouseSensor,
  TouchSensor,
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { 
  SortableContext, 
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

  useEffect(() => {
    setActiveTasks(tasks);
  }, [tasks]);

  // Custom collision detection: prioritize archive zone (rectIntersection),
  // then pointerWithin for columns, fall back to closestCenter for reordering
  const collisionDetection: CollisionDetection = (args) => {
    const { droppableContainers } = args;
    const archiveContainers = droppableContainers.filter(
      (c) => c.id === "archive" || String(c.id) === "archive"
    );
    if (archiveContainers.length > 0) {
      const archiveCollisions = rectIntersection({
        ...args,
        droppableContainers: archiveContainers,
      });
      if (archiveCollisions.length > 0) {
        return archiveCollisions;
      }
    }
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCenter(args);
  };

  // Separate sensors for mouse and touch to avoid conflicts
  // TouchSensor uses delay so scrolling still works (long-press to drag)
  // MouseSensor uses distance for desktop testing
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
    // Haptic feedback on drag start
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    const isArchive = over?.id === "archive" || 
                      String(over?.id) === "archive" ||
                      over?.data?.current?.type === "archive";
    setIsOverArchive(!!isArchive);
  }

  const getStatusFromStageName = (stageName: string): "backlog" | "in_progress" | "done" | "abandoned" => {
    const name = stageName.toLowerCase();
    if (name.includes("progress") || name.includes("doing") || name.includes("active")) return "in_progress";
    if (name.includes("done") || name.includes("complete") || name.includes("finished")) return "done";
    if (name.includes("abandon") || name.includes("cancel")) return "abandoned";
    return "backlog";
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setIsOverArchive(false);
    
    if (!over) { setActiveId(null); return; }

    const activeTask = activeTasks.find((t) => t.id === active.id);
    
    const isArchive = over.id === "archive" || String(over.id) === "archive" || over.data?.current?.type === "archive";
    if (isArchive && activeTask) {
      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
      setActiveTasks(tasks => tasks.filter(t => t.id !== activeTask.id));
      archiveTask.mutate(activeTask.id, {
        onError: () => setActiveTasks(tasks => [...tasks, activeTask])
      });
      setActiveId(null);
      return;
    }

    const overContainerId = over.data.current?.sortable?.containerId || over.id;
    const overId = typeof overContainerId === 'string' ? overContainerId : overContainerId;

    const isSubStage = over.data?.current?.type === "SubStage" || 
                       (typeof overId === 'string' && /^\d+-\w+/.test(overId));
    
    if (activeTask && isSubStage) {
      let stageId: number;
      let subStageTag: string;
      
      if (over.data?.current?.type === "SubStage") {
        subStageTag = over.data.current.subStageTag;
        const match = String(over.id).match(/^(\d+)-(.+)$/);
        stageId = match ? parseInt(match[1]) : activeTask.stageId;
      } else if (typeof overId === 'string') {
        const match = overId.match(/^(\d+)-(.+)$/);
        if (match) { stageId = parseInt(match[1]); subStageTag = match[2]; }
        else { stageId = activeTask.stageId; subStageTag = ""; }
      } else {
        stageId = activeTask.stageId;
        subStageTag = "";
      }
      
      const stageSubStages = allSubStages.filter((ss: any) => ss.stageId === stageId);
      const stageSubStageTags = stageSubStages.map((ss: any) => ss.tag);
      const currentTags = activeTask.tags || [];
      const filteredTags = currentTags.filter((tag: string) => !stageSubStageTags.includes(tag));
      const newTags = [...filteredTags, subStageTag];
      
      const targetStage = sortedStages.find((s: any) => s.id === stageId);
      if (targetStage && activeTask.stageId !== stageId) {
        const newStatus = getStatusFromStageName(targetStage.name);
        setActiveTasks(tasks => tasks.map(t => t.id === activeTask.id ? { ...t, stageId, status: newStatus, tags: newTags } : t));
        updateTask.mutate({ id: activeTask.id, stageId, status: newStatus, tags: newTags });
      } else {
        setActiveTasks(tasks => tasks.map(t => t.id === activeTask.id ? { ...t, tags: newTags } : t));
        updateTask.mutate({ id: activeTask.id, tags: newTags });
      }
      
      setActiveId(null);
      return;
    }

    // overContainerId may be a number (from useDroppable) or string (from SortableContext)
    const parsedStageId = typeof overContainerId === 'number' 
      ? overContainerId 
      : typeof overContainerId === 'string' && /^\d+$/.test(overContainerId)
        ? parseInt(overContainerId, 10)
        : null;

    if (activeTask && parsedStageId !== null) {
      const newStageId = parsedStageId;
      const newStage = sortedStages.find((s: any) => s.id === newStageId);
      
      if (activeTask.stageId !== newStageId && newStage) {
        const newStatus = getStatusFromStageName(newStage.name);
        let newTags = activeTask.tags || [];
        const newStageSubStages = allSubStages.filter((ss: any) => ss.stageId === newStageId);
        if (newStageSubStages.length === 0) {
          const allSubStageTags = allSubStages.map((ss: any) => ss.tag);
          newTags = newTags.filter((tag: string) => !allSubStageTags.includes(tag));
        } else {
          const otherStageSubStageTags = allSubStages.filter((ss: any) => ss.stageId !== newStageId).map((ss: any) => ss.tag);
          const newStageSubStageTags = newStageSubStages.map((ss: any) => ss.tag);
          newTags = newTags.filter((tag: string) => !otherStageSubStageTags.includes(tag) || newStageSubStageTags.includes(tag));
        }
        
        setActiveTasks(tasks => tasks.map(t => t.id === activeTask.id ? { ...t, stageId: newStageId, status: newStatus, tags: newTags.length > 0 ? newTags : null } : t));
        updateTask.mutate({ id: activeTask.id, stageId: newStageId, status: newStatus, tags: newTags.length > 0 ? newTags : null });
      }
    }
    
    setActiveId(null);
  }

  const defaultStageColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"];
  const getDefaultStageColor = (index: number): string => defaultStageColors[index % defaultStageColors.length];

  const sortedStages = useMemo(() => [...stages].sort((a: any, b: any) => a.order - b.order), [stages]);

  const stageColorMap = useMemo(() => {
    const map = new Map<number, string>();
    sortedStages.forEach((stage: any, index: number) => map.set(stage.id, stage.color || getDefaultStageColor(index)));
    return map;
  }, [sortedStages]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Mobile: vertical stack of full-width columns */}
      <div className="flex flex-col h-full gap-3 pb-4">
        {sortedStages.map((stage: any) => {
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
                id={String(stage.id)}
                items={activeTasks.filter((t) => t.stageId === stage.id).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {(() => {
                  const stageTasks = activeTasks.filter((task) => task.stageId === stage.id);
                  
                  const stageSubStages = allSubStages
                    .filter((ss: any) => ss.stageId === stage.id)
                    .sort((a: any, b: any) => a.order - b.order)
                    .map((ss: any) => ({
                      name: ss.name,
                      tag: ss.tag,
                      bgClass: ss.bgClass,
                      opacity: ss.opacity / 100,
                    }));
                  
                  if (stageSubStages.length > 0) {
                    const stageSubStageTags = stageSubStages.map((ss: { tag: string }) => ss.tag);
                    const tasksWithMatchingTags: Task[] = [];
                    const tasksWithoutMatchingTags: Task[] = [];
                    
                    stageTasks.forEach((task) => {
                      const tags = task.tags || [];
                      if (tags.some((tag: string) => stageSubStageTags.includes(tag))) tasksWithMatchingTags.push(task);
                      else tasksWithoutMatchingTags.push(task);
                    });
                    
                    return (
                      <div className="flex flex-col gap-2 min-h-[60px]">
                        {stageSubStages.map((subStage: { name: string; tag: string; bgClass: string; opacity: number }, subIndex: number) => {
                          const subStageTasks = tasksWithMatchingTags.filter((task) => (task.tags || []).includes(subStage.tag));
                          const finalTasks = subIndex === 0 ? [...subStageTasks, ...tasksWithoutMatchingTags] : subStageTasks;
                          
                          return (
                            <DayPlanSubStage
                              key={subStage.tag}
                              stageId={stage.id}
                              stageName={stage.name}
                              subStage={subStage}
                              tasks={finalTasks}
                              stageColor={stageColor}
                              viewMode={viewMode}
                              onTaskClick={onTaskClick}
                            />
                          );
                        })}
                      </div>
                    );
                  }
                  
                  const isInProgressStage = (name: string) => {
                    const n = name.toLowerCase();
                    return n.includes("progress") || n.includes("doing") || n.includes("active");
                  };
                  const inProgress = isInProgressStage(stage.name);
                  return viewMode === "detail" ? (
                    <div className="flex flex-col gap-2 min-h-[60px]">
                      {stageTasks.map((task) => (
                        <TaskCard key={task.id} task={task} onClick={onTaskClick} stageColor={stageColor} onInlineEdit={() => {}} />
                      ))}
                    </div>
                  ) : (
                    <div className={cn(
                      "min-h-[60px] gap-2",
                      inProgress ? "flex flex-col" : "flex flex-wrap content-start"
                    )}>
                      {stageTasks.map((task) => (
                        <TaskCardSummary key={task.id} task={task} onClick={onTaskClick} stageColor={stageColor} isInProgress={inProgress} />
                      ))}
                    </div>
                  );
                })()}
              </SortableContext>
            </TaskColumn>
          );
        })}
        
        <ArchiveZone isOver={isOverArchive} />
      </div>
      
      <DragOverlay>
        {activeId ? (() => {
          const activeTask = activeTasks.find(t => t.id === activeId);
          if (!activeTask) return null;
          const activeStageColor = stageColorMap.get(activeTask.stageId) || defaultStageColors[0];
          const activeStage = sortedStages.find((s: any) => s.id === activeTask.stageId);
          const activeStageName = activeStage?.name ?? "";
          const isInProgressStage = (name: string) => {
            const n = name.toLowerCase();
            return n.includes("progress") || n.includes("doing") || n.includes("active");
          };
          return (
            <div className="opacity-80 rotate-1 cursor-grabbing">
              {viewMode === "detail" ? (
                <TaskCard task={activeTask} onClick={() => {}} stageColor={activeStageColor} />
              ) : (
                <TaskCardSummary task={activeTask} onClick={() => {}} stageColor={activeStageColor} isInProgress={isInProgressStage(activeStageName)} />
              )}
            </div>
          );
        })() : null}
      </DragOverlay>
    </DndContext>
  );
}
