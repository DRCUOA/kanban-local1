/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMemo } from 'react';
import type { Task } from '@shared/schema';
import { useStages, useSubStages } from '@/hooks/use-stages';
import { useKanbanDragDrop } from '@/hooks/use-kanban-drag-drop';
import { DndContext, MeasuringStrategy } from '@dnd-kit/core';
import { TaskColumn } from './TaskColumn';
import { KanbanColumnContent } from './KanbanColumnContent';
import { KanbanDragOverlay } from './KanbanDragOverlay';
import { ArchiveZone } from './ArchiveZone';
import { DEFAULT_STAGE_COLORS } from '@shared/constants';

export interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  viewMode?: 'detail' | 'summary';
  focusMode?: boolean;
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  viewMode = 'detail',
  focusMode = false,
}: KanbanBoardProps) {
  const { data: stages = [] } = useStages();
  const { data: allSubStages = [] } = useSubStages();

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const stageColorMap = useMemo(() => {
    const map = new Map<number, string>();
    sortedStages.forEach((stage, index) =>
      map.set(stage.id, stage.color || DEFAULT_STAGE_COLORS[index % DEFAULT_STAGE_COLORS.length]),
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
      <div className="flex flex-col h-full gap-3 pb-4">
        {sortedStages.map((stage) => {
          const stageColor = stageColorMap.get(stage.id) || DEFAULT_STAGE_COLORS[0];
          const stageTasks = activeTasks.filter((t) => t.stageId === stage.id);
          return (
            <TaskColumn
              key={stage.id}
              id={stage.id}
              title={stage.name}
              count={stageTasks.length}
              stageColor={stageColor}
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
          );
        })}

        <ArchiveZone isOver={isOverArchive} />
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
