/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '@shared/schema';
import { useStages, useSubStages } from '@/hooks/use-stages';
import { useKanbanDragDrop } from '@/hooks/use-kanban-drag-drop';
import {
  useColumnWeights,
  PREVIEW_PANE_COLUMN_KEY,
  type ColumnKey,
} from '@/hooks/use-column-weights';
import { useMarqueeSelection } from '@/hooks/use-marquee-selection';
import { DndContext, MeasuringStrategy } from '@dnd-kit/core';
import { TaskColumn } from './TaskColumn';
import { KanbanColumnContent } from './KanbanColumnContent';
import { KanbanDragOverlay } from './KanbanDragOverlay';
import { ColumnResizer } from './ColumnResizer';
import { ArchiveZone } from './ArchiveZone';
import { ShareDialog } from './ShareDialog';
import { TaskPreviewPane } from './TaskPreviewPane';
import { TaskSelectionContext } from './task-selection-context';
import { DEFAULT_STAGE_COLORS, isDoneStageName } from '@shared/constants';
import { sortTasksByDueDate } from '@shared/task-sort';
import { cn } from '@/lib/utils';

/** Narrowest a column may be dragged before it stops giving up space. */
const MIN_COLUMN_PX = 260;

/**
 * How long the pointer must rest on a card before the preview pane follows
 * it. Long enough that crossing cards on the way to the pane leaves it alone,
 * short enough to feel immediate once you stop.
 */
export const HOVER_PREVIEW_DELAY_MS = 250;

/** Task id of the card containing `target`, if any. */
function taskIdFromEventTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const card = target.closest<HTMLElement>('[data-task-id]');
  if (!card) return null;
  const id = Number(card.dataset.taskId);
  return Number.isNaN(id) ? null : id;
}

export interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  viewMode?: 'detail' | 'summary';
  focusMode?: boolean;
  boardLayout?: 'vertical' | 'horizontal';
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  viewMode = 'detail',
  focusMode = false,
  boardLayout = 'vertical',
}: KanbanBoardProps) {
  const { data: stages = [] } = useStages();
  const { data: allSubStages = [] } = useSubStages();

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  // Done stages leave the column row and become full-width strips above the
  // archive zone — in both layouts, so "done" always reads as a band the way
  // the archive strip does, and the horizontal row keeps its width for the
  // working columns and the preview pane.
  const columnStages = useMemo(
    () => sortedStages.filter((stage) => !isDoneStageName(stage.name)),
    [sortedStages],
  );
  const doneStages = useMemo(
    () => sortedStages.filter((stage) => isDoneStageName(stage.name)),
    [sortedStages],
  );
  const lastColumnStage =
    columnStages.length > 0 ? columnStages[columnStages.length - 1] : undefined;

  const stageColorMap = useMemo(() => {
    const map = new Map<number, string>();
    sortedStages.forEach((stage, index) =>
      map.set(
        stage.id,
        stage.color ?? DEFAULT_STAGE_COLORS[index % DEFAULT_STAGE_COLORS.length] ?? '#6B7280',
      ),
    );
    return map;
  }, [sortedStages]);

  const {
    activeId,
    activeTasks,
    isOverArchive,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useKanbanDragDrop({ tasks, sortedStages, allSubStages });

  // Default board order is soonest-due-first. Sorted once here rather than per
  // column so every stage and sub-stage lane inherits the same order — the
  // sub-stage grouping downstream preserves the order it receives.
  const dueSortedTasks = useMemo(() => sortTasksByDueDate(activeTasks), [activeTasks]);

  // Shift+drag marquee multi-select; right-click shares the selection.
  const boardRef = useRef<HTMLDivElement>(null);
  const {
    selectedTaskIds,
    marqueeRect,
    isMarqueeActive,
    onPointerDown: handleMarqueePointerDown,
    selectOnly,
  } = useMarqueeSelection({ containerRef: boardRef, tasks: activeTasks });

  const [shareTasks, setShareTasks] = useState<Task[]>([]);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleTaskContextMenu = useCallback(
    (task: Task, event: React.MouseEvent) => {
      event.preventDefault();
      // A long-press on touch devices fires contextmenu while dnd-kit is mid
      // drag; sharing there would fight the drag. Marquee likewise.
      if (activeId !== null || isMarqueeActive) return;

      if (selectedTaskIds.has(task.id)) {
        // Share the whole selection in reading order: stage by stage, then
        // the board's soonest-due-first order within each stage.
        const ordered = sortedStages.flatMap((stage) =>
          dueSortedTasks.filter((t) => t.stageId === stage.id && selectedTaskIds.has(t.id)),
        );
        setShareTasks(ordered);
      } else {
        selectOnly(task.id);
        setShareTasks([task]);
      }
      setIsShareOpen(true);
    },
    [activeId, isMarqueeActive, selectedTaskIds, sortedStages, dueSortedTasks, selectOnly],
  );

  const selectionContext = useMemo(
    () => ({ selectedTaskIds, onTaskContextMenu: handleTaskContextMenu }),
    [selectedTaskIds, handleTaskContextMenu],
  );

  const isHorizontal = boardLayout === 'horizontal';
  const { getWeight, setPairWeights, resetPair, resetAll, hasCustomWidths } = useColumnWeights();
  // The stage area's share of the row against the preview pane's weight.
  const columnWeightTotal = useMemo(
    () => columnStages.reduce((sum, stage) => sum + getWeight(stage.id), 0),
    [columnStages, getWeight],
  );

  // Preview pane (horizontal layout): shows the task the pointer rests on, or
  // the last one pressed / clicked / focused. Sticky — it keeps the last task
  // when the pointer moves off the cards, so the pane itself can be reached
  // and scrolled. Only the id is kept; the task is resolved from the live list
  // so edits and optimistic moves show up in the pane.
  const [previewTaskId, setPreviewTaskId] = useState<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const pendingHoverId = useRef<number | null>(null);

  const cancelPendingHover = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    pendingHoverId.current = null;
  }, []);

  useEffect(() => cancelPendingHover, [cancelPendingHover]);

  const previewTask = useMemo(
    () =>
      isHorizontal && previewTaskId !== null
        ? (dueSortedTasks.find((t) => t.id === previewTaskId) ?? null)
        : null,
    [isHorizontal, previewTaskId, dueSortedTasks],
  );

  // Hover follows a short rest on a card (hover intent), never during a drag
  // or marquee: dnd-kit's overlay and the marquee both sweep the pointer
  // across cards that are not being "looked at".
  const handleBoardPointerOver = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isHorizontal || activeId !== null || isMarqueeActive) return;
      const id = taskIdFromEventTarget(event.target);
      if (id === null || id === previewTaskId) {
        cancelPendingHover();
        return;
      }
      if (pendingHoverId.current === id) return;
      cancelPendingHover();
      pendingHoverId.current = id;
      hoverTimer.current = window.setTimeout(() => {
        hoverTimer.current = null;
        pendingHoverId.current = null;
        setPreviewTaskId(id);
      }, HOVER_PREVIEW_DELAY_MS);
    },
    [isHorizontal, activeId, isMarqueeActive, previewTaskId, cancelPendingHover],
  );

  // Pressing or focusing a card is an explicit choice: preview it at once.
  const previewCardAt = useCallback(
    (target: EventTarget | null) => {
      if (!isHorizontal) return;
      const id = taskIdFromEventTarget(target);
      if (id === null) return;
      cancelPendingHover();
      setPreviewTaskId(id);
    },
    [isHorizontal, cancelPendingHover],
  );

  const handleBoardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handleMarqueePointerDown(event);
      previewCardAt(event.target);
    },
    [handleMarqueePointerDown, previewCardAt],
  );

  const handleBoardFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      previewCardAt(event.target);
    },
    [previewCardAt],
  );

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (isHorizontal) {
        cancelPendingHover();
        setPreviewTaskId(task.id);
      }
      onTaskClick(task);
    },
    [isHorizontal, cancelPendingHover, onTaskClick],
  );

  // Live element refs so a resize can start from the columns' real pixel widths.
  // The callbacks are cached per column, otherwise every render would detach and
  // re-attach each column ref. Keys are stage ids plus the preview pane's.
  const columnElements = useRef(new Map<ColumnKey, HTMLDivElement>());
  const columnRefCallbacks = useRef(new Map<ColumnKey, (element: HTMLDivElement | null) => void>());
  const registerColumn = useCallback((key: ColumnKey) => {
    const cached = columnRefCallbacks.current.get(key);
    if (cached) return cached;
    const callback = (element: HTMLDivElement | null): void => {
      if (element) columnElements.current.set(key, element);
      else columnElements.current.delete(key);
    };
    columnRefCallbacks.current.set(key, callback);
    return callback;
  }, []);

  // Snapshot taken on pointer-down: the pair's combined pixels and combined
  // weight are invariant during the drag, so the new weights follow directly
  // from the new pixel split — no container measurement needed.
  const resizeStart = useRef<{
    aId: ColumnKey;
    bId: ColumnKey;
    aPx: number;
    totalPx: number;
    totalWeight: number;
  } | null>(null);

  const beginResize = useCallback(
    (aId: ColumnKey, bId: ColumnKey) => () => {
      const a = columnElements.current.get(aId);
      const b = columnElements.current.get(bId);
      if (!a || !b) return;
      resizeStart.current = {
        aId,
        bId,
        aPx: a.offsetWidth,
        totalPx: a.offsetWidth + b.offsetWidth,
        totalWeight: getWeight(aId) + getWeight(bId),
      };
    },
    [getWeight],
  );

  const applyResize = useCallback(
    (deltaX: number) => {
      const start = resizeStart.current;
      if (!start) return;
      const maxA = Math.max(MIN_COLUMN_PX, start.totalPx - MIN_COLUMN_PX);
      const nextAPx = Math.min(maxA, Math.max(MIN_COLUMN_PX, start.aPx + deltaX));
      const share = nextAPx / start.totalPx;
      setPairWeights(
        start.aId,
        start.totalWeight * share,
        start.bId,
        start.totalWeight * (1 - share),
      );
    },
    [setPairWeights],
  );

  const endResize = useCallback(() => {
    resizeStart.current = null;
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <TaskSelectionContext.Provider value={selectionContext}>
        <div
          ref={boardRef}
          onPointerDown={handleBoardPointerDown}
          onPointerOver={handleBoardPointerOver}
          onPointerLeave={cancelPendingHover}
          onFocus={handleBoardFocus}
          data-testid="kanban-board-root"
          className={cn(
            'flex pb-4',
            // Horizontal fills the viewport height so columns scroll internally
            // and lays the stage area and the preview pane side by side;
            // vertical keeps its natural height and lets the page scroll.
            isHorizontal ? 'min-h-0 flex-1 flex-row' : 'flex-col',
          )}
        >
          {/* Stage area: the working columns, then the done strip(s), then the
            archive strip underneath rather than eating the right-hand half of
            the viewport. In the horizontal layout its width is the sum of the
            column weights, so the columns and the pane split the row exactly
            as if they shared it. */}
          <div
            data-testid="kanban-stage-area"
            className={cn('flex flex-col', isHorizontal && 'min-h-0 min-w-0')}
            style={
              isHorizontal
                ? { flexGrow: columnWeightTotal, flexShrink: 1, flexBasis: 0 }
                : undefined
            }
          >
            <div
              className={cn(
                isHorizontal
                  ? 'flex min-h-[220px] flex-1 flex-row overflow-x-auto'
                  : 'flex flex-col gap-4',
              )}
            >
              {columnStages.map((stage, index) => {
                const stageColor = stageColorMap.get(stage.id) || DEFAULT_STAGE_COLORS[0];
                const stageTasks = dueSortedTasks.filter((t) => t.stageId === stage.id);
                const previous = index > 0 ? columnStages[index - 1] : undefined;
                return (
                  <Fragment key={stage.id}>
                    {isHorizontal && previous && (
                      <ColumnResizer
                        label={`Resize ${previous.name} and ${stage.name}`}
                        onResizeStart={beginResize(previous.id, stage.id)}
                        onResize={applyResize}
                        onResizeEnd={endResize}
                        onReset={() => {
                          resetPair(previous.id, stage.id);
                        }}
                      />
                    )}
                    <TaskColumn
                      id={stage.id}
                      title={stage.name}
                      count={stageTasks.length}
                      stageColor={stageColor}
                      boardLayout={boardLayout}
                      outerRef={registerColumn(stage.id)}
                      style={{ flexGrow: getWeight(stage.id), flexShrink: 1, flexBasis: 0 }}
                    >
                      <KanbanColumnContent
                        stageId={stage.id}
                        stageName={stage.name}
                        stageTasks={stageTasks}
                        allSubStages={allSubStages}
                        stageColor={stageColor}
                        viewMode={viewMode}
                        onTaskClick={handleTaskClick}
                      />
                    </TaskColumn>
                  </Fragment>
                );
              })}
            </div>

            {/* Done stages: full-width strips, parallel to the archive strip. */}
            {doneStages.map((stage) => {
              const stageColor = stageColorMap.get(stage.id) || DEFAULT_STAGE_COLORS[0];
              const stageTasks = dueSortedTasks.filter((t) => t.stageId === stage.id);
              return (
                <div
                  key={stage.id}
                  className={cn(
                    'flex flex-col',
                    // Horizontal: shrinkable (the strip scrolls inside) so the
                    // columns keep their minimum height on short viewports.
                    isHorizontal ? 'mt-3 min-h-0' : 'mt-4 flex-shrink-0',
                  )}
                >
                  <TaskColumn
                    id={stage.id}
                    title={stage.name}
                    count={stageTasks.length}
                    stageColor={stageColor}
                    boardLayout={boardLayout}
                    variant="strip"
                  >
                    <KanbanColumnContent
                      stageId={stage.id}
                      stageName={stage.name}
                      stageTasks={stageTasks}
                      allSubStages={allSubStages}
                      stageColor={stageColor}
                      viewMode={viewMode}
                      layout="strip"
                      onTaskClick={handleTaskClick}
                    />
                  </TaskColumn>
                </div>
              );
            })}

            <div className="mt-3 flex flex-shrink-0 items-center gap-3">
              <ArchiveZone isOver={isOverArchive} />
              {isHorizontal && hasCustomWidths && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors neo-raised hover:text-foreground active:scale-95"
                >
                  Reset widths
                </button>
              )}
            </div>
          </div>

          {/* The preview pane takes the slot the done column gave up: full
            board height, at the end of the row. It is resized against the
            last column and keeps its own persisted weight, like a column. */}
          {isHorizontal && (
            <>
              {lastColumnStage && (
                <ColumnResizer
                  label={`Resize ${lastColumnStage.name} and the preview pane`}
                  onResizeStart={beginResize(lastColumnStage.id, PREVIEW_PANE_COLUMN_KEY)}
                  onResize={applyResize}
                  onResizeEnd={endResize}
                  onReset={() => {
                    resetPair(lastColumnStage.id, PREVIEW_PANE_COLUMN_KEY);
                  }}
                />
              )}
              <TaskPreviewPane
                task={previewTask}
                stages={sortedStages}
                subStages={allSubStages}
                stageColor={previewTask ? stageColorMap.get(previewTask.stageId) : undefined}
                onOpen={handleTaskClick}
                outerRef={registerColumn(PREVIEW_PANE_COLUMN_KEY)}
                style={{
                  flexGrow: getWeight(PREVIEW_PANE_COLUMN_KEY),
                  flexShrink: 1,
                  flexBasis: 0,
                }}
              />
            </>
          )}
        </div>

        {marqueeRect && (
          <div
            aria-hidden
            data-testid="selection-marquee"
            className="pointer-events-none fixed z-50 rounded-sm border-2 border-primary bg-primary/10"
            style={{
              left: marqueeRect.left,
              top: marqueeRect.top,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
          />
        )}

        <ShareDialog
          source={{ type: 'tasks', tasks: shareTasks, stages: sortedStages }}
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
        />

        <KanbanDragOverlay
          activeId={activeId}
          activeTasks={activeTasks}
          stageColorMap={stageColorMap}
          sortedStages={sortedStages}
          viewMode={viewMode}
        />
      </TaskSelectionContext.Provider>
    </DndContext>
  );
}
