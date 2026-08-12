/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Fragment, useCallback, useMemo, useRef } from 'react';
import type { Task } from '@shared/schema';
import { useStages, useSubStages } from '@/hooks/use-stages';
import { useKanbanDragDrop } from '@/hooks/use-kanban-drag-drop';
import { useColumnWeights } from '@/hooks/use-column-weights';
import { DndContext, MeasuringStrategy } from '@dnd-kit/core';
import { TaskColumn } from './TaskColumn';
import { KanbanColumnContent } from './KanbanColumnContent';
import { KanbanDragOverlay } from './KanbanDragOverlay';
import { ColumnResizer } from './ColumnResizer';
import { ArchiveZone } from './ArchiveZone';
import { DEFAULT_STAGE_COLORS } from '@shared/constants';
import { cn } from '@/lib/utils';

/** Narrowest a column may be dragged before it stops giving up space. */
const MIN_COLUMN_PX = 260;

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

  const isHorizontal = boardLayout === 'horizontal';
  const { getWeight, setPairWeights, resetPair, resetAll, hasCustomWidths } = useColumnWeights();

  // Live element refs so a resize can start from the columns' real pixel widths.
  // The callbacks are cached per stage, otherwise every render would detach and
  // re-attach each column ref.
  const columnElements = useRef(new Map<number, HTMLDivElement>());
  const columnRefCallbacks = useRef(new Map<number, (element: HTMLDivElement | null) => void>());
  const registerColumn = useCallback((stageId: number) => {
    const cached = columnRefCallbacks.current.get(stageId);
    if (cached) return cached;
    const callback = (element: HTMLDivElement | null): void => {
      if (element) columnElements.current.set(stageId, element);
      else columnElements.current.delete(stageId);
    };
    columnRefCallbacks.current.set(stageId, callback);
    return callback;
  }, []);

  // Snapshot taken on pointer-down: the pair's combined pixels and combined
  // weight are invariant during the drag, so the new weights follow directly
  // from the new pixel split — no container measurement needed.
  const resizeStart = useRef<{
    aId: number;
    bId: number;
    aPx: number;
    totalPx: number;
    totalWeight: number;
  } | null>(null);

  const beginResize = useCallback(
    (aId: number, bId: number) => () => {
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
      <div
        className={cn(
          'flex flex-col pb-4',
          // Horizontal fills the viewport height so columns scroll internally;
          // vertical keeps its natural height and lets the page scroll.
          isHorizontal && 'min-h-0 flex-1',
        )}
      >
        {/* Columns own the full width of the board; the archive strip sits
            underneath rather than eating the right-hand half of the viewport. */}
        <div
          className={cn(
            isHorizontal ? 'flex min-h-0 flex-1 flex-row overflow-x-auto' : 'flex flex-col gap-3',
          )}
        >
          {sortedStages.map((stage, index) => {
            const stageColor = stageColorMap.get(stage.id) || DEFAULT_STAGE_COLORS[0];
            const stageTasks = activeTasks.filter((t) => t.stageId === stage.id);
            const previous = index > 0 ? sortedStages[index - 1] : undefined;
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
                    onTaskClick={onTaskClick}
                  />
                </TaskColumn>
              </Fragment>
            );
          })}
        </div>

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

      <KanbanDragOverlay
        activeId={activeId}
        activeTasks={activeTasks}
        stageColorMap={stageColorMap}
        sortedStages={sortedStages}
        viewMode={viewMode}
      />
    </DndContext>
  );
}
