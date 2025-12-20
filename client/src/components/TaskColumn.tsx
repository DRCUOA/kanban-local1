import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TaskColumnProps {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}

export function TaskColumn({ id, title, count, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const getColumnColor = (id: string) => {
    switch (id) {
      case "backlog": return "bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800";
      case "in-progress": return "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30";
      case "done": return "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30";
      default: return "bg-secondary/30";
    }
  };

  const getHeaderColor = (id: string) => {
    switch (id) {
      case "backlog": return "text-gray-700 dark:text-gray-300";
      case "in-progress": return "text-blue-700 dark:text-blue-400";
      case "done": return "text-green-700 dark:text-green-400";
      default: return "";
    }
  };

  return (
    <div className="flex-1 w-full lg:min-w-[300px] flex flex-col h-auto lg:h-full rounded-2xl bg-card/50 backdrop-blur-sm">
      <div className="p-4 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 rounded-t-2xl border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", 
            id === 'backlog' ? "bg-gray-400" : 
            id === 'in-progress' ? "bg-blue-500" : "bg-green-500"
          )} />
          <h2 className={cn("font-display font-bold text-sm uppercase tracking-wider", getHeaderColor(id))}>
            {title}
          </h2>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {count}
        </Badge>
      </div>
      
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-4 transition-colors duration-200 rounded-b-2xl border-x border-b border-border/0",
          getColumnColor(id),
          isOver && "ring-2 ring-primary/20 bg-primary/5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
