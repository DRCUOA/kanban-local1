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

  // Create beveled gradient background: high at circumference, low at center
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
    
    // Beveled effect: high at circumference (darker/stronger), low at center (lighter)
    // Creates illusion of raised edge with pressed center - like a lift button
    return {
      background: `radial-gradient(circle, ${hexToRgba(color, 0.7)} 0%, ${hexToRgba(color, 0.65)} 8%, ${hexToRgba(color, 0.5)} 20%, ${hexToRgba(color, 0.3)} 45%, ${hexToRgba(color, 0.15)} 75%, ${hexToRgba(color, 0.05)} 100%)`,
      borderColor: color,
      borderWidth: '3px',
      borderStyle: 'solid',
      boxShadow: `
        /* Outer raised edge - high at circumference */
        0 6px 12px rgba(0, 0, 0, 0.2),
        0 -3px 6px rgba(255, 255, 255, 0.3),
        /* Inner pressed center - low at center */
        inset 0 0 25px rgba(0, 0, 0, 0.25),
        inset 0 0 12px rgba(0, 0, 0, 0.15),
        /* Subtle edge highlight */
        0 0 0 1px rgba(0, 0, 0, 0.08)
      `,
    };
  };

  // Haptic feedback function - mimics pressing a lift button
  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      // Pattern: short vibration (10ms) for button press feel
      // Mimics the tactile feedback of pressing a physical button
      navigator.vibrate(10);
    }
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
      onClick={handleClick}
      onTouchStart={triggerHapticFeedback}
      onMouseDown={triggerHapticFeedback}
      className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300",
        "hover:scale-110 active:scale-[0.92]",
        stageColor ? "neo-beveled-circle-colored" : "neo-beveled-circle"
      )}
      title={task.title}
    >
      <span className="text-[10px] font-semibold text-foreground text-center px-1.5 leading-tight break-words relative z-10">
        {shortTitle}
      </span>
    </div>
  );
}
