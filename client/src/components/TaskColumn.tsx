import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TaskColumnProps {
  id: string;
  title: string;
  count: number;
  stageColor: string;
  children: React.ReactNode;
}

export function TaskColumn({ id, title, count, stageColor, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-4 transition-all duration-300 rounded-[3rem] min-h-0 overflow-y-auto overflow-x-hidden neo-container",
          isOver && "bg-primary/5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
