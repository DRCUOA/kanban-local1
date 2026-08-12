import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ColumnResizerProps {
  /** Called once when a drag/keyboard adjustment begins, before any `onResize`. */
  onResizeStart: () => void;
  /** Horizontal offset in px from where the gesture started (can be negative). */
  onResize: (deltaX: number) => void;
  onResizeEnd: () => void;
  /** Double-click / Enter: give both neighbours an equal share again. */
  onReset: () => void;
  /** Accessible name, e.g. "Resize Backlog and In Progress". */
  label: string;
}

/** Pixels moved per arrow-key press. */
const KEYBOARD_STEP = 32;

/**
 * Thin grab strip sitting between two board columns. It doubles as the visual
 * gutter, so the column row itself needs no gap.
 */
export function ColumnResizer({
  onResizeStart,
  onResize,
  onResizeEnd,
  onReset,
  label,
}: ColumnResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startXRef.current = event.clientX;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      onResizeStart();
    },
    [onResizeStart],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      onResize(event.clientX - startXRef.current);
    },
    [isDragging, onResize],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);
      onResizeEnd();
    },
    [isDragging, onResizeEnd],
  );

  const nudge = useCallback(
    (deltaX: number) => {
      onResizeStart();
      onResize(deltaX);
      onResizeEnd();
    },
    [onResize, onResizeEnd, onResizeStart],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudge(-KEYBOARD_STEP);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudge(KEYBOARD_STEP);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onReset();
      }
    },
    [nudge, onReset],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      data-testid="column-resizer"
      className={cn(
        'group relative w-3 flex-shrink-0 cursor-col-resize touch-none select-none',
        'flex items-center justify-center rounded-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      title={`${label} (double-click to even out)`}
    >
      <div
        className={cn(
          'h-full max-h-full w-0.5 rounded-full transition-colors',
          isDragging ? 'bg-primary' : 'bg-muted-foreground/20 group-hover:bg-primary/50',
        )}
      />
    </div>
  );
}
