/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import { DragOverlay } from '@dnd-kit/core';
import type { Task } from '@shared/schema';
import { DEFAULT_STAGE_COLORS } from '@shared/constants';
import { TaskCard } from './TaskCard';
import { TaskCardSummary } from './TaskCardSummary';

export interface KanbanDragOverlayProps {
  activeId: number | null;
  activeTasks: Task[];
  stageColorMap: Map<number, string>;
  viewMode: 'detail' | 'summary';
}

export function KanbanDragOverlay({
  activeId,
  activeTasks,
  stageColorMap,
  viewMode,
}: KanbanDragOverlayProps) {
  if (!activeId) return <DragOverlay>{null}</DragOverlay>;

  const activeTask = activeTasks.find((t) => t.id === activeId);
  if (!activeTask) return <DragOverlay>{null}</DragOverlay>;

  const activeStageColor = stageColorMap.get(activeTask.stageId) || DEFAULT_STAGE_COLORS[0];

  return (
    <DragOverlay>
      <div className="opacity-80 rotate-1 cursor-grabbing">
        {viewMode === 'detail' ? (
          <TaskCard task={activeTask} onClick={() => {}} stageColor={activeStageColor} />
        ) : (
          <TaskCardSummary task={activeTask} onClick={() => {}} stageColor={activeStageColor} />
        )}
      </div>
    </DragOverlay>
  );
}
