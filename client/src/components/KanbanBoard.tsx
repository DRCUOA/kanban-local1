import { useMemo, useState } from "react";
import { Task } from "@shared/schema";
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

const COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const updateTask = useUpdateTask();
  const [activeId, setActiveId] = useState<number | null>(null);

  // Local optimization for smooth drag, will sync with server via mutation
  const [activeTasks, setActiveTasks] = useState(tasks);

  // Update local state when prop changes
  useMemo(() => {
    setActiveTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as number);
  }

  function handleDragOver(event: DragOverEvent) {
    // Only handling simple status changes on drop, detailed reordering requires more complex schema (position field)
    // For MVP, we just rely on filtering by status
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = activeTasks.find((t) => t.id === active.id);
    const overContainerId = over.data.current?.sortable?.containerId || over.id;

    if (activeTask && overContainerId) {
      // Check if dropped in a different column (containerId is the status)
      // Or if dropped on a task in a different column
      let newStatus = overContainerId as string;
      
      // If dropped over a task, find that task's status
      if (typeof overContainerId === 'number') {
        const overTask = activeTasks.find(t => t.id === overContainerId);
        if (overTask) {
          newStatus = overTask.status;
        }
      }

      // Valid status check
      if (["backlog", "in-progress", "done"].includes(newStatus) && activeTask.status !== newStatus) {
        // Optimistic update
        setActiveTasks(tasks => 
          tasks.map(t => t.id === activeTask.id ? { ...t, status: newStatus } : t)
        );
        
        // Server update
        updateTask.mutate({ id: activeTask.id, status: newStatus });
      }
    }
    
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row h-full gap-6 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <TaskColumn
            key={col.id}
            id={col.id}
            title={col.title}
            count={activeTasks.filter((t) => t.status === col.id).length}
          >
            <SortableContext
              id={col.id}
              items={activeTasks.filter((t) => t.status === col.id).map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3 min-h-[100px]">
                {activeTasks
                  .filter((task) => task.status === col.id)
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
