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

  // Truncate title to fit in circle
  const words = task.title.split(" ");
  const shortTitle = words.length > 2 
    ? words.slice(0, 2).join(" ") + "..."
    : task.title.length > 12
    ? task.title.substring(0, 12) + "..."
    : task.title;

  // Create beveled gradient background
  const getGradientStyle = (color: string): React.CSSProperties => {
    if (!color || !color.startsWith("#")) return {};
    
    const hexToRgba = (hex: string, alpha: number) => {
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
      background: `radial-gradient(circle, ${hexToRgba(color, 0.7)} 0%, ${hexToRgba(color, 0.65)} 8%, ${hexToRgba(color, 0.5)} 20%, ${hexToRgba(color, 0.3)} 45%, ${hexToRgba(color, 0.15)} 75%, ${hexToRgba(color, 0.05)} 100%)`,
      borderColor: color,
      borderWidth: '2px',
      borderStyle: 'solid',
      boxShadow: `
        0 3px 6px rgba(0, 0, 0, 0.15),
        0 -2px 4px rgba(255, 255, 255, 0.2),
        inset 0 0 15px rgba(0, 0, 0, 0.18),
        inset 0 0 8px rgba(0, 0, 0, 0.1)
      `,
    };
  };

  // Haptic feedback
  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  const handleClick = () => {
    triggerHapticFeedback();
    onClick(task);
  };

  if (isDragging) {
    const dragStyle = stageColor ? getGradientStyle(stageColor) : {};
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, ...dragStyle, opacity: 0.5 }}
        className="w-[72px] h-[72px] rounded-full border-2 border-dashed"
      />
    );
  }

  const containerStyle = stageColor 
    ? { ...style, ...getGradientStyle(stageColor) }
    : style;

  return (
    <div 
      ref={setNodeRef} 
      style={{ ...containerStyle, touchAction: 'none' }} 
      {...attributes} 
      {...listeners}
      onClick={handleClick}
      onTouchStart={triggerHapticFeedback}
      className={cn(
        "w-[72px] h-[72px] rounded-full flex items-center justify-center cursor-pointer transition-all duration-200",
        "active:scale-[0.88]",
        stageColor ? "neo-beveled-circle-colored" : "neo-beveled-circle"
      )}
      title={task.title}
    >
      <span className="text-[9px] font-semibold text-foreground text-center px-1 leading-tight break-words relative z-10">
        {shortTitle}
      </span>
    </div>
  );
}
