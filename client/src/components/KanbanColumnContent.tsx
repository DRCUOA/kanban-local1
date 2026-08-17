/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Task, SubStage } from '@shared/schema';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { isInProgressStageName } from '@shared/constants';
import { TaskCard } from './TaskCard';
import { TaskCardSummary } from './TaskCardSummary';
import { DayPlanSubStage } from './DayPlanSubStage';
import { STRIP_DETAIL_GRID_CLASS, type ColumnContentLayout } from './column-layout';
import { cn } from '@/lib/utils';

export interface KanbanColumnContentProps {
  stageId: number;
  stageName: string;
  stageTasks: Task[];
  allSubStages: SubStage[];
  stageColor: string;
  viewMode: 'detail' | 'summary';
  layout?: ColumnContentLayout;
  onTaskClick: (task: Task) => void;
}

export function KanbanColumnContent({
  stageId,
  stageName,
  stageTasks,
  allSubStages,
  stageColor,
  viewMode,
  layout = 'list',
  onTaskClick,
}: KanbanColumnContentProps) {
  const stageSubStages = allSubStages
    .filter((ss) => ss.stageId === stageId)
    .sort((a, b) => a.order - b.order)
    .map((ss) => ({
      name: ss.name,
      tag: ss.tag,
      bgClass: ss.bgClass,
      opacity: ss.opacity / 100,
    }));

  return (
    <SortableContext
      id={String(stageId)}
      items={stageTasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      {stageSubStages.length > 0
        ? renderWithSubStages(
            stageSubStages,
            stageTasks,
            stageId,
            stageName,
            stageColor,
            viewMode,
            layout,
            onTaskClick,
          )
        : renderFlat(stageTasks, stageName, stageColor, viewMode, layout, onTaskClick)}
    </SortableContext>
  );
}

function renderWithSubStages(
  stageSubStages: { name: string; tag: string; bgClass: string; opacity: number }[],
  stageTasks: Task[],
  stageId: number,
  stageName: string,
  stageColor: string,
  viewMode: 'detail' | 'summary',
  layout: ColumnContentLayout,
  onTaskClick: (task: Task) => void,
) {
  const stageSubStageTags = stageSubStages.map((ss) => ss.tag);
  // Each task belongs to exactly one sub-stage. A task may carry more than one
  // sub-stage tag (stale tags from earlier moves, shared tag strings); the last
  // matching tag wins because drag/drop appends the newest assignment at the end.
  const subStageTaskLists: Task[][] = stageSubStages.map(() => []);
  const tasksWithoutMatchingTags: Task[] = [];

  stageTasks.forEach((task) => {
    const tags = task.tags || [];
    const assignedTag = [...tags].reverse().find((tag) => stageSubStageTags.includes(tag));
    if (assignedTag === undefined) {
      tasksWithoutMatchingTags.push(task);
      return;
    }
    const subStageIndex = stageSubStages.findIndex((ss) => ss.tag === assignedTag);
    subStageTaskLists[subStageIndex]?.push(task);
  });

  return (
    <div
      className={cn(
        'gap-2 min-h-[60px]',
        // Wells stack in a column; across a strip they sit side by side.
        layout === 'strip' ? 'flex flex-row flex-wrap' : 'flex flex-col',
      )}
    >
      {stageSubStages.map((subStage, subIndex) => {
        const subStageTasks = subStageTaskLists[subIndex] ?? [];
        const finalTasks =
          subIndex === 0 ? [...subStageTasks, ...tasksWithoutMatchingTags] : subStageTasks;

        return (
          <DayPlanSubStage
            key={`${subIndex}-${subStage.tag}`}
            stageId={stageId}
            stageName={stageName}
            subStage={subStage}
            tasks={finalTasks}
            stageColor={stageColor}
            viewMode={viewMode}
            layout={layout}
            onTaskClick={onTaskClick}
          />
        );
      })}
    </div>
  );
}

function renderFlat(
  stageTasks: Task[],
  stageName: string,
  stageColor: string,
  viewMode: 'detail' | 'summary',
  layout: ColumnContentLayout,
  onTaskClick: (task: Task) => void,
) {
  const inProgress = isInProgressStageName(stageName);

  return viewMode === 'detail' ? (
    <div
      className={cn(
        'min-h-[60px]',
        layout === 'strip' ? STRIP_DETAIL_GRID_CLASS : 'flex flex-col gap-2',
      )}
    >
      {stageTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onClick={onTaskClick}
          stageColor={stageColor}
          onInlineEdit={() => {}}
        />
      ))}
    </div>
  ) : (
    <div
      className={cn(
        'min-h-[60px] gap-2',
        inProgress ? 'flex flex-col' : 'flex flex-wrap content-start',
      )}
    >
      {stageTasks.map((task) => (
        <TaskCardSummary
          key={task.id}
          task={task}
          onClick={onTaskClick}
          stageColor={stageColor}
          isInProgress={inProgress}
        />
      ))}
    </div>
  );
}
