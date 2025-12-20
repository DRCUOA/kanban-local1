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
import { useUpdateTask } from "@/hooks/use-tasks";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const updateTask = useUpdateTask();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeTasks, setActiveTasks] = useState(tasks);

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = activeTasks.find((t) => t.id === active.id);
    const overContainerId = over.data.current?.sortable?.containerId || over.id;

    if (activeTask && typeof overContainerId === 'number') {
      const newStageId = overContainerId as number;
      
      if (activeTask.stageId !== newStageId) {
        setActiveTasks(tasks => 
          tasks.map(t => t.id === activeTask.id ? { ...t, stageId: newStageId } : t)
        );
        updateTask.mutate({ id: activeTask.id, stageId: newStageId });
      }
    }
    
    setActiveId(null);
  }

  const sortedStages = [...stages].sort((a: any, b: any) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row h-full gap-6 overflow-y-auto lg:overflow-y-visible lg:overflow-x-auto pb-4">
        {sortedStages.map((stage: any) => (
          <TaskColumn
            key={stage.id}
            id={stage.id}
            title={stage.name}
            count={activeTasks.filter((t) => t.stageId === stage.id).length}
          >
            <SortableContext
              id={stage.id}
              items={activeTasks.filter((t) => t.stageId === stage.id).map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3 min-h-[100px]">
                {activeTasks
                  .filter((task) => task.stageId === stage.id)
                  .map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={onTaskClick}
                    />
                  ))}
              </div>
            </SortableContext>
          </TaskColumn>
        ))}
      </div>
      
      <DragOverlay>
        {activeId ? (
          <div className="opacity-80 rotate-2 cursor-grabbing">
             <TaskCard 
               task={activeTasks.find(t => t.id === activeId)!} 
               onClick={() => {}} 
             />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
