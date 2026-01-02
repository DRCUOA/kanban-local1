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
    <div className="flex-1 w-full lg:min-w-[300px] flex flex-col h-auto lg:h-full neo-container rounded-[3rem]">
      <div className="p-5 flex items-center justify-between sticky top-0 z-10 rounded-t-[3rem] border-0">
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: stageColor }}
          />
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-foreground">
            {title}
          </h2>
        </div>
        <Badge variant="secondary" className="font-mono text-xs neo-pressed rounded-lg px-2 py-1">
          {count}
        </Badge>
      </div>
      
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-4 transition-all duration-300 rounded-b-[3rem] min-h-[200px]",
          isOver && "bg-primary/5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
