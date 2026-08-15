import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@shared/schema';

/**
 * Shift+drag marquee selection over the board's task cards.
 *
 * The marquee activates only when a primary-button press starts with Shift
 * held, so plain drags stay with dnd-kit (whose sensors ignore Shift-modified
 * presses — the two gestures are mutually exclusive by construction). Cards
 * are found by their `data-task-id` attribute inside the container; selection
 * updates live while the marquee is dragged and is additive to whatever was
 * selected when it started.
 *
 * Clearing: Escape, or a plain (unshifted) press on any part of the board
 * that is not a task card.
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

  const isMarqueeActive = marqueeRect !== null;

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
        // A plain press anywhere that is not a task card clears the selection.
        if (!(event.target as HTMLElement).closest('[data-task-id]')) clearSelection();
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
