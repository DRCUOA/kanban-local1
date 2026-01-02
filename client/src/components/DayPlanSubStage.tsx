import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@shared/schema";
import { TaskCard } from "./TaskCard";
import { TaskCardSummary } from "./TaskCardSummary";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DayPlanSubStageProps {
  stageId: number;
  subStage: {
    name: string;
    tag: string;
    bgClass: string;
    opacity: number; // Opacity level (0.2, 0.4, 0.6)
  };
  tasks: Task[];
  stageColor: string;
  viewMode: "detail" | "summary";
  onTaskClick: (task: Task) => void;
}

// Adjust color tone to match background opacity variation
// Blends the base color with white (lighter) or keeps darker to match background tone
// Background opacity: 0.2 (lighter) -> 0.4 (medium) -> 0.6 (darker)
// Stage color tone: lighter -> medium -> darker (same proportional variation)
function adjustColorTone(color: string, opacity: number): string {
  // Normalize color to hex format
  let hex = color;
  if (!hex || !hex.startsWith("#")) {
    // If it's rgb format, convert to hex
    const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      hex = `#${[r, g, b].map(x => {
        const h = x.toString(16);
        return h.length === 1 ? '0' + h : h;
      }).join('')}`;
    } else {
      // Fallback to default green if invalid
      hex = "#10B981";
    }
  }
  
  // Expand short hex (#RGB to #RRGGBB)
  let fullHex = hex;
  if (hex.length === 4) {
    fullHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  
  const r = parseInt(fullHex.slice(1, 3), 16);
  const g = parseInt(fullHex.slice(3, 5), 16);
  const b = parseInt(fullHex.slice(5, 7), 16);
  
  // Blend with white to create lighter tones
  // Lower opacity (0.2) = blend more with white (lighter tone)
  // Higher opacity (0.6) = less blend (darker tone, closer to original)
  // Map opacity to blend amount for more distinct variation:
  // 0.2 -> 0.7 blend (much lighter), 0.4 -> 0.4 blend (medium), 0.6 -> 0.1 blend (slightly lighter)
  const blendAmount = (1 - opacity) * 0.875; // 0.2->0.7, 0.4->0.525, 0.6->0.35
  
  const rBlended = Math.round(r + (255 - r) * blendAmount);
  const gBlended = Math.round(g + (255 - g) * blendAmount);
  const bBlended = Math.round(b + (255 - b) * blendAmount);
  
  // Convert back to hex format for compatibility with TaskCardSummary
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(rBlended)}${toHex(gBlended)}${toHex(bBlended)}`;
}

export function DayPlanSubStage({
  stageId,
  subStage,
  tasks,
  stageColor,
  viewMode,
  onTaskClick,
}: DayPlanSubStageProps) {
  const subStageId = `${stageId}-day-plan-${subStage.tag.split('-').pop()}`;
  
  const { setNodeRef, isOver } = useDroppable({
    id: subStageId,
  });

  // Adjust stage color tone to match sub-stage background opacity variation
  // Same base color, but lighter/darker tones matching the background
  const adjustedStageColor = adjustColorTone(stageColor, subStage.opacity);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-2xl transition-colors",
        subStage.bgClass,
        isOver && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {subStage.name}
        </h3>
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0.5">
          {tasks.length}
        </Badge>
      </div>
      
      <SortableContext
        id={subStageId}
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {viewMode === "detail" ? (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                stageColor={adjustedStageColor}
                onInlineEdit={() => {
                  // Trigger refetch if needed
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 content-start">
            {tasks.map((task) => (
              <TaskCardSummary
                key={task.id}
                task={task}
                onClick={onTaskClick}
                stageColor={adjustedStageColor}
              />
            ))}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
