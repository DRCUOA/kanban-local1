/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Task } from '@shared/schema';
import { EFFORT_MAX } from '@shared/constants';
import { getTaskWarningHighlight } from '@shared/task-warning-highlight';
import { TASK_WARNING_BORDER_COLOR } from '@/lib/task-warning-border';
import { useStages } from '@/hooks/use-stages';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { GripVertical } from 'lucide-react';

interface TaskCardSummaryProps {
  task: Task;
  onClick: (task: Task) => void;
  stageColor?: string;
  isInProgress?: boolean;
}

export function TaskCardSummary({
  task,
  onClick,
  stageColor,
  isInProgress = false,
}: TaskCardSummaryProps) {
  const { data: stages = [] } = useStages();
  const warningHighlight = getTaskWarningHighlight(task, stages);
  const panelBorderColor =
    warningHighlight != null
      ? TASK_WARNING_BORDER_COLOR[warningHighlight]
      : stageColor || undefined;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Create beveled gradient background
  const getGradientStyle = (color: string): React.CSSProperties => {
    if (!color?.startsWith('#')) return {};

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

  const effort = task.effort ?? 1;
  const circleSizePx = 48 + effort * 12;
  const circleFontSize = effort <= 2 ? 'text-sm' : effort <= 4 ? 'text-base' : 'text-lg';

  if (isDragging) {
    const dragStyle =
      stageColor?.startsWith('#') && !isInProgress ? getGradientStyle(stageColor) : {};
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          ...(isInProgress ? {} : { ...dragStyle, width: circleSizePx, height: circleSizePx }),
          ...(panelBorderColor
            ? { borderColor: panelBorderColor, borderWidth: '2px', borderStyle: 'dashed' }
            : {}),
          opacity: 0.5,
        }}
        className={cn(
          'border-2 border-dashed',
          !panelBorderColor && 'border-muted-foreground/35',
          isInProgress ? 'w-full min-h-[72px] rounded-xl' : 'rounded-full',
        )}
      />
    );
  }

  const hasHexStageGradient = Boolean(stageColor?.startsWith('#') && !isInProgress);
  const containerStyle = hasHexStageGradient
    ? { ...style, ...getGradientStyle(stageColor!) }
    : style;

  const triggerContent = isInProgress ? (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(panelBorderColor ? { borderColor: panelBorderColor, borderWidth: '2px' } : {}),
      }}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.drag-handle')) return;
        handleClick();
      }}
      onTouchStart={triggerHapticFeedback}
      className={cn(
        'w-full min-h-[72px] rounded-xl flex items-start gap-2 p-3 cursor-pointer transition-transform duration-200 ease-out border-2',
        'active:scale-[0.98] focus-visible:scale-[1.02] task-summary-magnify',
        'neo-raised',
      )}
    >
      <div
        className="drag-handle flex-shrink-0 p-1 cursor-grab active:cursor-grabbing"
        onContextMenu={(e) => e.preventDefault()}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
        <p className="text-base font-semibold leading-tight text-foreground line-clamp-2">
          {task.title}
        </p>
        <span className="text-xs text-muted-foreground mt-0.5">#{task.id}</span>
      </div>
    </div>
  ) : (
    <div
      ref={setNodeRef}
      style={{
        ...containerStyle,
        touchAction: 'none',
        width: circleSizePx,
        height: circleSizePx,
        ...(panelBorderColor
          ? { borderColor: panelBorderColor, borderWidth: '2px', borderStyle: 'solid' }
          : {}),
      }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onTouchStart={triggerHapticFeedback}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ease-out select-none',
        'active:scale-[0.88] focus-visible:scale-[1.03] task-summary-magnify',
        stageColor ? 'neo-beveled-circle-colored' : 'neo-beveled-circle',
      )}
      title={`${task.title} (effort: ${effort}/${EFFORT_MAX})`}
    >
      <span
        className={cn(circleFontSize, 'font-semibold text-foreground text-center relative z-10')}
      >
        {task.id}
      </span>
    </div>
  );

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{triggerContent}</HoverCardTrigger>
      <HoverCardContent>
        <div className="space-y-2">
          <p className="text-base font-semibold leading-tight text-foreground">{task.title}</p>
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
