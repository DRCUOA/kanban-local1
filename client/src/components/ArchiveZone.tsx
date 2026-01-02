import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Archive } from "lucide-react";

interface ArchiveZoneProps {
  isOver: boolean;
}

export function ArchiveZone({ isOver }: ArchiveZoneProps) {
  const { setNodeRef } = useDroppable({
    id: "archive",
    data: {
      type: "archive",
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-full mt-6 p-8 rounded-2xl transition-all duration-300 border-0 relative z-10",
        isOver
          ? "neo-pressed bg-destructive/10 ring-2 ring-destructive/50"
          : "neo-raised"
      )}
    >
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <Archive className={cn(
          "h-8 w-8 transition-colors",
          isOver ? "text-destructive" : "text-muted-foreground"
        )} />
        <p className={cn(
          "text-sm font-medium transition-colors",
          isOver ? "text-destructive" : "text-muted-foreground"
        )}>
          {isOver ? "Drop here to archive" : "Archive"}
        </p>
        <p className="text-xs text-muted-foreground">
          Drag tasks here to archive them
        </p>
      </div>
    </div>
  );
}
