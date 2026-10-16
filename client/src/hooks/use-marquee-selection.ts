import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@shared/schema';

/**
 * Shift+drag marquee selection over the board's task cards.
 *
 * Two ways to start one, neither of which competes with dnd-kit's card drag:
 *  - a plain press on empty board space (not a card, not a control), which
 *    becomes a marquee once the pointer moves a few pixels, so a click there
 *    still just clears the selection; it starts a fresh selection;
 *  - Shift+press anywhere, including on a card (dnd-kit's sensors ignore
 *    Shift-modified presses), which adds to the current selection.
 * Cards are found by their `data-task-id` attribute inside the container;
 * selection updates live while the marquee is dragged.
 *
 * Clearing: Escape, or a plain click on board space that is not a task card.
 */

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UseMarqueeSelectionOptions {
  /** Board root; marquee card lookup and empty-area clicks are scoped to it. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Live tasks — selection is pruned when tasks disappear from the board. */
  tasks: Task[];
}

/** Pixels a plain press on empty space must travel before it becomes a marquee. */
const ARM_DISTANCE = 5;
/** Controls on the board that keep their own press behaviour. */
const NOT_MARQUEE =
  'button, a, input, textarea, select, label, [role="button"], [role="separator"], [contenteditable="true"], [data-no-marquee]';

function intersects(card: DOMRect, rect: MarqueeRect): boolean {
  return (
    card.left < rect.left + rect.width &&
    card.right > rect.left &&
    card.top < rect.top + rect.height &&
    card.bottom > rect.top
  );
}

export function useMarqueeSelection({ containerRef, tasks }: UseMarqueeSelectionOptions) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<number>>(new Set());
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    baseSelection: ReadonlySet<number>;
  } | null>(null);
  // A plain press on empty space, waiting to see whether it becomes a drag.
  const [isArmed, setIsArmed] = useState(false);

  const isMarqueeActive = marqueeRect !== null;
  const marqueeRectRef = useRef<MarqueeRect | null>(null);
  marqueeRectRef.current = marqueeRect;

  const clearSelection = useCallback(() => {
    setSelectedTaskIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const selectOnly = useCallback((taskId: number) => {
    setSelectedTaskIds(new Set([taskId]));
  }, []);

  // Selected ids must always refer to tasks still on the board.
  useEffect(() => {
    setSelectedTaskIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(tasks.map((task) => task.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  const updateMarquee = useCallback(
    (clientX: number, clientY: number) => {
      const state = dragState.current;
      if (!state) return;
      const rect: MarqueeRect = {
        left: Math.min(state.startX, clientX),
        top: Math.min(state.startY, clientY),
        width: Math.abs(clientX - state.startX),
        height: Math.abs(clientY - state.startY),
      };
      setMarqueeRect(rect);

      const container = containerRef.current;
      if (!container) return;
      const ids = new Set(state.baseSelection);
      container.querySelectorAll<HTMLElement>('[data-task-id]').forEach((element) => {
        if (!intersects(element.getBoundingClientRect(), rect)) return;
        const id = Number(element.dataset.taskId);
        if (!Number.isNaN(id)) ids.add(id);
      });
      setSelectedTaskIds(ids);
    },
    [containerRef],
  );

  /** Attach to the board container's onPointerDown. */
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;

      if (!event.shiftKey) {
        const target = event.target as HTMLElement;
        // A card belongs to dnd-kit; a control does its own thing.
        if (target.closest('[data-task-id]')) return;
        clearSelection();
        if (target.closest(NOT_MARQUEE)) return;
        // Empty space: becomes a marquee if the pointer moves (see below).
        dragState.current = {
          startX: event.clientX,
          startY: event.clientY,
          baseSelection: new Set(),
        };
        setIsArmed(true);
        return;
      }

      // Shift+drag: begin the marquee. preventDefault stops the browser from
      // starting a text selection along the drag path.
      event.preventDefault();
      dragState.current = {
        startX: event.clientX,
        startY: event.clientY,
        baseSelection: selectedTaskIds,
      };
      updateMarquee(event.clientX, event.clientY);
    },
    [clearSelection, selectedTaskIds, updateMarquee],
  );

  // An armed press turns into a marquee after a few pixels of movement.
  useEffect(() => {
    if (!isArmed) return;
    const handleMove = (event: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < ARM_DISTANCE) {
        return;
      }
      window.getSelection()?.removeAllRanges();
      setIsArmed(false);
      updateMarquee(event.clientX, event.clientY);
    };
    const disarm = () => {
      if (dragState.current && marqueeRectRef.current === null) dragState.current = null;
      setIsArmed(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', disarm);
    window.addEventListener('pointercancel', disarm);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', disarm);
      window.removeEventListener('pointercancel', disarm);
    };
  }, [isArmed, updateMarquee]);

  // Window-level listeners only while a marquee is being dragged.
  useEffect(() => {
    if (!isMarqueeActive) return;
    const handleMove = (event: PointerEvent) => {
      updateMarquee(event.clientX, event.clientY);
    };
    const endMarquee = () => {
      dragState.current = null;
      setMarqueeRect(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', endMarquee);
    window.addEventListener('pointercancel', endMarquee);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', endMarquee);
      window.removeEventListener('pointercancel', endMarquee);
    };
  }, [isMarqueeActive, updateMarquee]);

  // Escape cancels an in-flight marquee and clears the selection. Listening
  // only while there is something to clear keeps the handler out of the way
  // of dialogs the rest of the time.
  const hasSelection = selectedTaskIds.size > 0;
  useEffect(() => {
    if (!hasSelection && !isMarqueeActive) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      dragState.current = null;
      setMarqueeRect(null);
      clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasSelection, isMarqueeActive, clearSelection]);

  return {
    selectedTaskIds,
    marqueeRect,
    isMarqueeActive,
    onPointerDown,
    clearSelection,
    selectOnly,
  };
}
