import { Task } from "@shared/schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface TaskCardSummaryProps {
  task: Task;
  onClick: (task: Task) => void;
  stageColor?: string;
}

export function TaskCardSummary({ task, onClick, stageColor }: TaskCardSummaryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Truncate title to fit in circle - show first few words
  const words = task.title.split(" ");
  const shortTitle = words.length > 2 
    ? words.slice(0, 2).join(" ") + "..."
    : task.title.length > 12
    ? task.title.substring(0, 12) + "..."
    : task.title;

  // Create gradient background: solid at border, transparent at center
  const getGradientStyle = (color: string): React.CSSProperties => {
    if (!color || !color.startsWith("#")) return {};
    
    // Convert hex to rgba for transparency (handles both #RGB and #RRGGBB)
    const hexToRgba = (hex: string, alpha: number) => {
      // Expand short hex (#RGB to #RRGGBB)
      let fullHex = hex;
      if (hex.length === 4) {
        fullHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      }
      
      const r = parseInt(fullHex.slice(1, 3), 16);
      const g = parseInt(fullHex.slice(3, 5), 16);
      const b = parseInt(fullHex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    return {
      background: `radial-gradient(circle, ${hexToRgba(color, 0.4)} 0%, ${hexToRgba(color, 0.25)} 40%, ${hexToRgba(color, 0.15)} 70%, ${hexToRgba(color, 0.05)} 100%)`,
      borderColor: color,
      borderWidth: '3px',
      borderStyle: 'solid',
    };
  };

  if (isDragging) {
    const dragStyle = stageColor ? getGradientStyle(stageColor) : {};
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, ...dragStyle, opacity: 0.5 }}
        className="w-20 h-20 rounded-full border-2 border-dashed"
      />
    );
  }

  const containerStyle = stageColor 
    ? { ...style, ...getGradientStyle(stageColor) }
    : style;

  return (
    <div 
      ref={setNodeRef} 
      style={containerStyle} 
      {...attributes} 
      {...listeners}
      onClick={() => onClick(task)}
      className={cn(
        "w-20 h-20 rounded-full neo-card flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-[0.95]",
        "hover:scale-110"
      )}
      title={task.title}
    >
      <span className="text-[10px] font-semibold text-foreground text-center px-1.5 leading-tight break-words">
        {shortTitle}
      </span>
    </div>
  );
}
