import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface TaskColumnProps {
  id: number;
  title: string;
  count: number;
  stageColor: string;
  boardLayout?: 'vertical' | 'horizontal';
  /**
   * `column` (default) sits in the stage row; `strip` is a full-width band
   * laid out like the archive zone — used for done stages, which live above
   * the archive zone in both layouts. In the horizontal layout a strip caps
   * its height and scrolls internally so it cannot starve the columns.
   */
  variant?: 'column' | 'strip';
  /** Outer element ref — the board measures column widths while resizing. */
  outerRef?: (element: HTMLDivElement | null) => void;
  /** Flex sizing supplied by the board (horizontal layout only). */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function TaskColumn({
  id,
  title,
  count,
  stageColor,
  boardLayout = 'vertical',
  variant = 'column',
  outerRef,
  style,
  children,
}: TaskColumnProps) {
  // Namespaced id: a bare numeric id would collide with task-card sortable ids
  // in dnd-kit's droppable registry (e.g. task 3 hijacking stage 3's column).
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${id}`,
    data: { type: 'Stage', stageId: id },
  });

  const isEmpty = count === 0;

  const isStrip = variant === 'strip';
  // Row-member sizing only applies to real columns; a strip is always a band.
  const isHorizontal = boardLayout === 'horizontal' && !isStrip;
  const isBoundedStrip = isStrip && boardLayout === 'horizontal';

  return (
    <div
      ref={outerRef}
      style={isHorizontal ? style : undefined}
      data-testid={isStrip ? `stage-strip-${id}` : undefined}
      className={cn(
        // The whole stage (header + lanes) is one raised card so stages read
        // as separate surfaces on the page rather than a continuous sheet.
        'flex flex-col neo-raised',
        // Horizontal: share the row proportionally (weight comes from `style`)
        // so wide/ultrawide viewports are filled instead of left blank, while
        // the min-width keeps columns readable and lets the row scroll when
        // there are more stages than fit.
        isHorizontal ? 'min-w-[260px] min-h-0' : 'w-full',
        // Bounded strip: at most ~a third of the viewport, and it gives way
        // (scrolling inside) before the columns above it drop below a usable
        // height; the floor keeps its header and one row of cards visible.
        isBoundedStrip && 'max-h-[30vh] min-h-[7rem]',
      )}
    >
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-between px-4 border-b border-border/60',
          // A strip sits under the columns, so it stays as short as it can.
          isStrip ? 'py-2' : 'py-3',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stageColor }} />
          <h2 className="font-display font-bold text-xs uppercase tracking-wider text-foreground">
            {title}
          </h2>
        </div>
        <Badge
          variant="secondary"
          className="font-mono text-base font-semibold neo-pressed rounded-lg px-3 py-1 min-h-[28px]"
        >
          {count}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          // Lives inside the stage card — no raised surface of its own, the
          // sub-stage wells (or task cards) provide the next layer.
          'transition-all duration-200 rounded-b-2xl',
          isStrip ? 'p-2' : 'p-3',
          isEmpty ? 'min-h-[120px]' : isStrip ? 'min-h-[56px]' : 'min-h-[80px]',
          (isHorizontal || isBoundedStrip) && 'flex-1 overflow-y-auto',
          isOver && 'bg-primary/5 ring-2 ring-primary/30',
        )}
      >
        {/* Always render children so SortableContext stays mounted */}
        {children}
        {/* Show visual drop indicator when empty */}
        {isEmpty && (
          <div
            className={cn(
              'flex flex-col items-center justify-center min-h-[96px] rounded-lg border-2 border-dashed transition-colors',
              isOver ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20',
            )}
          >
            <Plus
              className={cn(
                'h-5 w-5 mb-1 transition-colors',
                isOver ? 'text-primary' : 'text-muted-foreground/30',
              )}
            />
            <p
              className={cn(
                'text-[10px] font-medium transition-colors',
                isOver ? 'text-primary' : 'text-muted-foreground/30',
              )}
            >
              {isOver ? 'Drop here' : 'Drag tasks here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
