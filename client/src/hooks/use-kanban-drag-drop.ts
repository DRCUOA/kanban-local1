/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useEffect, useRef, useState } from 'react';
import type { Task, Stage, SubStage } from '@shared/schema';
import {
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { useUpdateTask, useArchiveTask, useBinTask } from '@/hooks/use-tasks';
import { overflowAncestors, withClippedDroppableRects } from '@/lib/clip-droppable-rects';
import { getStatusFromStageName } from '@shared/constants';
import { BIN_DROPPABLE_ID, FILING_DROPPABLE_ID, isFilingId } from '@/lib/filing-targets';

/** How long a drag must rest on the Filing button before its submenu appears. */
export const FILING_HOVER_OPEN_MS = 350;
/**
 * Grace period before the submenu closes again. The rows sit above the button
 * with a gap between them, so a drag crossing that gap briefly reports no
 * filing target — closing instantly would make the menu flicker shut mid-travel.
 */
export const FILING_HOVER_CLOSE_MS = 260;

/**
 * Shift-modified presses belong to the board's marquee selection, so these
 * sensor variants refuse to activate a drag for them. Plain presses delegate
 * to the stock activators — normal drag-and-drop is untouched. TouchSensor
 * needs no variant: touch events carry no Shift modifier.
 */
export class ShiftExemptPointerSensor extends PointerSensor {
  static activators = PointerSensor.activators.map(
    ({ eventName, handler }): (typeof PointerSensor.activators)[number] => ({
      eventName,
      handler: (event, options) => !event.nativeEvent.shiftKey && handler(event, options),
    }),
  );
}

export class ShiftExemptMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map(
    ({ eventName, handler }): (typeof MouseSensor.activators)[number] => ({
      eventName,
      handler: (event, options) => !event.nativeEvent.shiftKey && handler(event, options),
    }),
  );
}

export interface UseKanbanDragDropParams {
  tasks: Task[];
  sortedStages: Stage[];
  allSubStages: SubStage[];
}

export function useKanbanDragDrop({ tasks, sortedStages, allSubStages }: UseKanbanDragDropParams) {
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const binTask = useBinTask();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeTasks, setActiveTasks] = useState(tasks);
  // Which nav droppable the pointer is over (`filing`, a `filing:` row, or
  // `bin`), and whether Filing's submenu has been revealed by resting on it.
  const [activeNavId, setActiveNavId] = useState<string | null>(null);
  const [filingMenuOpen, setFilingMenuOpen] = useState(false);
  const filingOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filingCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFilingTimers = () => {
    if (filingOpenTimer.current) clearTimeout(filingOpenTimer.current);
    if (filingCloseTimer.current) clearTimeout(filingCloseTimer.current);
    filingOpenTimer.current = null;
    filingCloseTimer.current = null;
  };

  const resetNavHover = () => {
    clearFilingTimers();
    setActiveNavId(null);
    setFilingMenuOpen(false);
  };

  useEffect(() => clearFilingTimers, []);

  useEffect(() => {
    setActiveTasks(tasks);
  }, [tasks]);

  // Overflow ancestors per droppable node, memoised for the life of one drag
  // (the tree is stable while dragging; only rects move). Reset on drag start
  // so a layout switch between drags is picked up.
  const overflowAncestorCache = useRef(new WeakMap<Element, readonly Element[]>());
  const ancestorsOf = (element: Element): readonly Element[] => {
    const cached = overflowAncestorCache.current.get(element);
    if (cached) return cached;
    const found = overflowAncestors(element);
    overflowAncestorCache.current.set(element, found);
    return found;
  };

  // Custom collision detection: the nav drop targets (Filing, its submenu rows,
  // Bin) win outright, then pointerWithin for columns, then closestCenter. They
  // float over the board, so without the override a column underneath could
  // out-rank the row the pointer is actually on. Submenu rows out-rank the
  // Filing button itself: resting on the button means "no action chosen yet".
  // Rects are clipped to their scroll containers first: a lane scrolled out of
  // view inside a column must not shadow anything beneath it.
  const collisionDetection: CollisionDetection = (rawArgs) => {
    const args = withClippedDroppableRects(rawArgs, ancestorsOf);
    const { droppableContainers } = args;
    const navContainers = droppableContainers.filter((c) => {
      const id = String(c.id);
      return isFilingId(id) || id === BIN_DROPPABLE_ID;
    });
    if (navContainers.length > 0) {
      const navPointerCollisions = pointerWithin({
        ...args,
        droppableContainers: navContainers,
      });
      if (navPointerCollisions.length > 0) {
        return [...navPointerCollisions].sort(
          (a, b) =>
            (String(a.id) === FILING_DROPPABLE_ID ? 1 : 0) -
            (String(b.id) === FILING_DROPPABLE_ID ? 1 : 0),
        );
      }
    }
    // Sub-stage zones are nested inside stage columns, and task cards are
    // sortable droppables nested inside both — pointerWithin can rank any of
    // them first. Prefer the most specific target under the pointer:
    // task card (sortable) > sub-stage zone > stage column.
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const rank = (collision: (typeof pointerCollisions)[number]) => {
        const container = droppableContainers.find((c) => c.id === collision.id);
        if (container?.data.current?.sortable) return 0;
        if (container?.data.current?.type === 'SubStage') return 1;
        return 2;
      };
      return [...pointerCollisions].sort((a, b) => rank(a) - rank(b));
    }
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }
    return closestCenter(args);
  };

  // PointerSensor (unified touch/mouse via Pointer Events API) is tried first for
  // broad mobile-browser compatibility. TouchSensor is the fallback for devices
  // where PointerEvents are incomplete, and MouseSensor covers legacy desktop.
  // delay = long-press to differentiate from scroll; tolerance is generous to
  // accommodate natural finger tremor on phones/tablets.
  const sensors = useSensors(
    useSensor(ShiftExemptPointerSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(ShiftExemptMouseSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    overflowAncestorCache.current = new WeakMap();
    resetNavHover();
    setActiveId(event.active.id as number);
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    const overId = over ? String(over.id) : null;
    const overFiling = isFilingId(overId);
    const overNav = overFiling || overId === BIN_DROPPABLE_ID;
    setActiveNavId(overNav ? overId : null);

    if (overFiling) {
      // Back in Filing's orbit: cancel any pending close, and start the reveal
      // timer the first time the drag settles here.
      if (filingCloseTimer.current) {
        clearTimeout(filingCloseTimer.current);
        filingCloseTimer.current = null;
      }
      if (!filingMenuOpen && !filingOpenTimer.current) {
        filingOpenTimer.current = setTimeout(() => {
          filingOpenTimer.current = null;
          setFilingMenuOpen(true);
        }, FILING_HOVER_OPEN_MS);
      }
      return;
    }

    if (filingOpenTimer.current) {
      clearTimeout(filingOpenTimer.current);
      filingOpenTimer.current = null;
    }
    if (filingMenuOpen && !filingCloseTimer.current) {
      filingCloseTimer.current = setTimeout(() => {
        filingCloseTimer.current = null;
        setFilingMenuOpen(false);
      }, FILING_HOVER_CLOSE_MS);
    }
  }

  /** Optimistically drop `task` off the board, restoring it if the write fails. */
  function removeFromBoard(task: Task, mutate: (id: number, onError: () => void) => void) {
    if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
    setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
    mutate(task.id, () => {
      setActiveTasks((prev) => [...prev, task]);
    });
  }

  /**
   * Move `task` into `stageId`, applying the same status and sub-stage tag
   * rules a drop on the stage's own column would. Used by the Filing submenu,
   * which files to a stage without that column being on the board any more.
   */
  function moveTaskToStage(task: Task, stageId: number) {
    const targetStage = sortedStages.find((s) => s.id === stageId);
    if (!targetStage || task.stageId === stageId) return;

    const newStatus = getStatusFromStageName(targetStage.name);
    const targetSubStages = allSubStages.filter((ss) => ss.stageId === stageId);
    const targetTags = targetSubStages.map((ss) => ss.tag);
    const otherTags = allSubStages.filter((ss) => ss.stageId !== stageId).map((ss) => ss.tag);
    const newTags = (task.tags || []).filter(
      (tag) => !otherTags.includes(tag) || targetTags.includes(tag),
    );

    setActiveTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, stageId, status: newStatus, tags: newTags.length > 0 ? newTags : null }
          : t,
      ),
    );
    updateTask.mutate({
      id: task.id,
      stageId,
      status: newStatus,
      tags: newTags.length > 0 ? newTags : null,
    });
  }

  function handleDragCancel() {
    resetNavHover();
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const wasFilingMenuOpen = filingMenuOpen;
    resetNavHover();

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = activeTasks.find((t) => t.id === active.id);
    const overDroppableId = String(over.id);

    if (overDroppableId === BIN_DROPPABLE_ID && activeTask) {
      removeFromBoard(activeTask, (id, onError) => {
        binTask.mutate(id, { onError });
      });
      setActiveId(null);
      return;
    }

    // A submenu row: this is the focused action, so apply it.
    if (over.data?.current?.type === 'filing-target' && activeTask) {
      const { action, stageId } = over.data.current as {
        action: 'stage' | 'archive';
        stageId: number | null;
      };
      if (action === 'archive') {
        removeFromBoard(activeTask, (id, onError) => {
          archiveTask.mutate(id, { onError });
        });
      } else if (stageId !== null) {
        moveTaskToStage(activeTask, stageId);
      }
      setActiveId(null);
      return;
    }

    // Let go on the Filing button itself with no row focused — including before
    // the submenu ever opened. Nothing is filed; the card returns to where the
    // drag began.
    if (
      overDroppableId === FILING_DROPPABLE_ID ||
      (wasFilingMenuOpen && isFilingId(overDroppableId))
    ) {
      setActiveId(null);
      return;
    }

    const overContainerId = over.data.current?.sortable?.containerId || over.id;
    const overId = typeof overContainerId === 'string' ? overContainerId : overContainerId;

    const isSubStage =
      over.data?.current?.type === 'SubStage' ||
      (typeof overId === 'string' && /^\d+-\w+/.test(overId));

    if (activeTask && isSubStage) {
      let stageId: number;
      let subStageTag: string;

      if (over.data?.current?.type === 'SubStage') {
        subStageTag = over.data.current.subStageTag;
        const match = /^(\d+)-(.+)$/.exec(String(over.id));
        stageId = match ? parseInt(match[1]!) : activeTask.stageId;
      } else if (typeof overId === 'string') {
        const match = /^(\d+)-(.+)$/.exec(overId);
        if (match) {
          stageId = parseInt(match[1]!);
          subStageTag = match[2]!;
        } else {
          stageId = activeTask.stageId;
          subStageTag = '';
        }
      } else {
        stageId = activeTask.stageId;
        subStageTag = '';
      }

      // A task holds at most one sub-stage tag: strip every sub-stage tag
      // (including ones from other stages left over by cross-stage moves)
      // before adding the drop target's tag. Never add an empty tag.
      const allSubStageTags = allSubStages.map((ss) => ss.tag);
      const currentTags = activeTask.tags || [];
      const filteredTags = currentTags.filter((tag) => !allSubStageTags.includes(tag));
      const newTags = subStageTag ? [...filteredTags, subStageTag] : filteredTags;

      const targetStage = sortedStages.find((s) => s.id === stageId);
      if (targetStage && activeTask.stageId !== stageId) {
        const newStatus = getStatusFromStageName(targetStage.name);
        setActiveTasks((prev) =>
          prev.map((t) =>
            t.id === activeTask.id ? { ...t, stageId, status: newStatus, tags: newTags } : t,
          ),
        );
        updateTask.mutate({ id: activeTask.id, stageId, status: newStatus, tags: newTags });
      } else {
        setActiveTasks((prev) =>
          prev.map((t) => (t.id === activeTask.id ? { ...t, tags: newTags } : t)),
        );
        updateTask.mutate({ id: activeTask.id, tags: newTags });
      }

      setActiveId(null);
      return;
    }

    // Stage columns register as `stage-<id>` (with data.stageId); flat-stage
    // SortableContexts still use the bare numeric string, and legacy numeric
    // ids are kept for safety.
    const stageIdFromData =
      over.data?.current?.type === 'Stage' ? (over.data.current.stageId as number) : null;
    const parsedStageId =
      stageIdFromData !== null
        ? stageIdFromData
        : typeof overContainerId === 'number'
          ? overContainerId
          : typeof overContainerId === 'string' && /^(?:stage-)?\d+$/.test(overContainerId)
            ? parseInt(overContainerId.replace('stage-', ''), 10)
            : null;

    if (activeTask && parsedStageId !== null) {
      const newStageId = parsedStageId;
      const newStage = sortedStages.find((s) => s.id === newStageId);

      if (activeTask.stageId === newStageId) {
        // Dropping on the column body of the task's own stage un-assigns its
        // sub-stage: the task falls back into the first (catch-all) sub-stage.
        const stageSubStageTags = allSubStages
          .filter((ss) => ss.stageId === newStageId)
          .map((ss) => ss.tag);
        const currentTags = activeTask.tags || [];
        const newTags = currentTags.filter((tag) => !stageSubStageTags.includes(tag));
        if (newTags.length !== currentTags.length) {
          setActiveTasks((prev) =>
            prev.map((t) =>
              t.id === activeTask.id ? { ...t, tags: newTags.length > 0 ? newTags : null } : t,
            ),
          );
          updateTask.mutate({ id: activeTask.id, tags: newTags.length > 0 ? newTags : null });
        }
      } else if (newStage) {
        const newStatus = getStatusFromStageName(newStage.name);
        let newTags = activeTask.tags || [];
        const newStageSubStages = allSubStages.filter((ss) => ss.stageId === newStageId);
        if (newStageSubStages.length === 0) {
          const allSubStageTags = allSubStages.map((ss) => ss.tag);
          newTags = newTags.filter((tag) => !allSubStageTags.includes(tag));
        } else {
          const otherStageSubStageTags = allSubStages
            .filter((ss) => ss.stageId !== newStageId)
            .map((ss) => ss.tag);
          const newStageSubStageTags = newStageSubStages.map((ss) => ss.tag);
          newTags = newTags.filter(
            (tag) => !otherStageSubStageTags.includes(tag) || newStageSubStageTags.includes(tag),
          );
        }

        setActiveTasks((prev) =>
          prev.map((t) =>
            t.id === activeTask.id
              ? {
                  ...t,
                  stageId: newStageId,
                  status: newStatus,
                  tags: newTags.length > 0 ? newTags : null,
                }
              : t,
          ),
        );
        updateTask.mutate({
          id: activeTask.id,
          stageId: newStageId,
          status: newStatus,
          tags: newTags.length > 0 ? newTags : null,
        });
      }
    }

    setActiveId(null);
  }

  return {
    activeId,
    activeTasks,
    activeNavId,
    filingMenuOpen,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
