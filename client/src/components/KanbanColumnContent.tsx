/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Task, SubStage } from '@shared/schema';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { isInProgressStageName } from '@shared/constants';
import { TaskCard } from './TaskCard';
import { TaskCardSummary } from './TaskCardSummary';
import { DayPlanSubStage } from './DayPlanSubStage';
import { cn } from '@/lib/utils';

export interface KanbanColumnContentProps {
  stageId: number;
  stageName: string;
  stageTasks: Task[];
  allSubStages: SubStage[];
  stageColor: string;
  viewMode: 'detail' | 'summary';
  onTaskClick: (task: Task) => void;
}

export function KanbanColumnContent({
  stageId,
  stageName,
  stageTasks,
  allSubStages,
  stageColor,
  viewMode,
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
            onTaskClick,
          )
        : renderFlat(stageTasks, stageName, stageColor, viewMode, onTaskClick)}
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
  onTaskClick: (task: Task) => void,
) {
  const stageSubStageTags = stageSubStages.map((ss) => ss.tag);
  const tasksWithMatchingTags: Task[] = [];
  const tasksWithoutMatchingTags: Task[] = [];

  stageTasks.forEach((task) => {
    const tags = task.tags || [];
    if (tags.some((tag) => stageSubStageTags.includes(tag))) tasksWithMatchingTags.push(task);
    else tasksWithoutMatchingTags.push(task);
  });

  return (
    <div className="flex flex-col gap-2 min-h-[60px]">
      {stageSubStages.map((subStage, subIndex) => {
        const subStageTasks = tasksWithMatchingTags.filter((task) =>
          (task.tags || []).includes(subStage.tag),
        );
        const finalTasks =
          subIndex === 0 ? [...subStageTasks, ...tasksWithoutMatchingTags] : subStageTasks;

        return (
          <DayPlanSubStage
            key={subStage.tag}
            stageId={stageId}
            stageName={stageName}
            subStage={subStage}
            tasks={finalTasks}
            stageColor={stageColor}
            viewMode={viewMode}
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
  onTaskClick: (task: Task) => void,
) {
  const inProgress = isInProgressStageName(stageName);

  return viewMode === 'detail' ? (
    <div className="flex flex-col gap-2 min-h-[60px]">
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
