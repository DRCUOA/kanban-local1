/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Task } from '@shared/schema';
import { EFFORT_MAX } from '@shared/constants';
import { getTaskWarningHighlight } from '@shared/task-warning-highlight';
import { TASK_WARNING_BORDER_COLOR } from '@/lib/task-warning-border';
import { useStages } from '@/hooks/use-stages';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { richTextToPlainText } from '@/lib/rich-text';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useTaskSelection } from './task-selection-context';

interface TaskCardSummaryProps {
  task: Task;
  onClick: (task: Task) => void;
  stageColor?: string;
}

/**
 * Summary-view card: an effort-sized, stage-tinted circle carrying the task id,
 * with title/owner/description in a hover card. Every stage renders the same
 * circle — in-progress stages used to get a title row instead, which read as
 * a stray detail view in the middle of a summary board.
 */
export function TaskCardSummary({ task, onClick, stageColor }: TaskCardSummaryProps) {
  const { data: stages = [] } = useStages();
  const { selectedTaskIds, onTaskContextMenu } = useTaskSelection();
  const isSelected = selectedTaskIds.has(task.id);
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
    const dragStyle = stageColor?.startsWith('#') ? getGradientStyle(stageColor) : {};
    return (
      <div
        ref={setNodeRef}
        data-task-id={task.id}
        style={{
          ...style,
          ...dragStyle,
          width: circleSizePx,
          height: circleSizePx,
          ...(panelBorderColor
            ? { borderColor: panelBorderColor, borderWidth: '2px', borderStyle: 'dashed' }
            : {}),
          opacity: 0.5,
        }}
        className={cn(
          'rounded-full border-2 border-dashed',
          !panelBorderColor && 'border-muted-foreground/35',
        )}
      />
    );
  }

  const hasHexStageGradient = Boolean(stageColor?.startsWith('#'));
  const containerStyle = hasHexStageGradient
    ? { ...style, ...getGradientStyle(stageColor!) }
    : style;

  const triggerContent = (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
      data-selected={isSelected || undefined}
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
      onClick={(e) => {
        // Shift+click belongs to marquee selection, never opens the task.
        if (e.shiftKey) return;
        handleClick();
      }}
      onTouchStart={triggerHapticFeedback}
      onContextMenu={(e) => onTaskContextMenu(task, e)}
      className={cn(
        'rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ease-out select-none',
        'active:scale-[0.88] focus-visible:scale-[1.03] task-summary-magnify',
        stageColor ? 'neo-beveled-circle-colored' : 'neo-beveled-circle',
        // Outline, not ring: the beveled circles set box-shadow inline, which
        // would swallow a ring-based highlight.
        isSelected && 'outline outline-2 outline-offset-2 outline-primary',
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
          {task.owner && (
            <p className="text-xs text-muted-foreground" data-testid="task-summary-owner">
              Owner: <span className="font-medium text-foreground">{task.owner}</span>
            </p>
          )}
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {richTextToPlainText(task.description)}
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
