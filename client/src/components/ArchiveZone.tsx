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
        "w-full mt-3 p-4 rounded-xl transition-all duration-200 border-0 relative z-10",
        isOver
          ? "neo-pressed bg-destructive/10 ring-2 ring-destructive/50 scale-[1.02]"
          : "neo-raised"
      )}
    >
      <div className="flex items-center justify-center gap-3">
        <Archive className={cn(
          "h-5 w-5 transition-colors",
          isOver ? "text-destructive" : "text-muted-foreground"
        )} />
        <p className={cn(
          "text-xs font-medium transition-colors",
          isOver ? "text-destructive" : "text-muted-foreground"
        )}>
          {isOver ? "Drop to archive" : "Drag here to archive"}
        </p>
      </div>
    </div>
  );
}
