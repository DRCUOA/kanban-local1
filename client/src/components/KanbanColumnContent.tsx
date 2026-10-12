/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/prefer-nullish-coalescing -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Task, SubStage } from '@shared/schema';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { TaskCardSummary } from './TaskCardSummary';
import { DayPlanSubStage } from './DayPlanSubStage';
import { STRIP_DETAIL_GRID_CLASS, type ColumnContentLayout } from './column-layout';
import { useOwnerById } from '@/hooks/use-owners';
import { cn } from '@/lib/utils';

export interface KanbanColumnContentProps {
  stageId: number;
  stageTasks: Task[];
  allSubStages: SubStage[];
  stageColor: string;
  viewMode: 'detail' | 'summary';
  layout?: ColumnContentLayout;
  onTaskClick: (task: Task) => void;
}

export function KanbanColumnContent({
  stageId,
  stageTasks,
  allSubStages,
  stageColor,
  viewMode,
  layout = 'list',
  onTaskClick,
}: KanbanColumnContentProps) {
  // `opacity` is the lane's shade, 0–100, passed through as stored; the
  // legacy `bgClass` column is not read. `ownerId` says which kind of lane it
  // is: a person's lane holds whatever they own here, a tag lane matches tags.
  const ownerById = useOwnerById();
  const stageSubStages = allSubStages
    .filter((ss) => ss.stageId === stageId)
    .sort((a, b) => a.order - b.order)
    .map((ss) => ({
      // A person's lane is labelled by its owner: renaming the owner renames
      // the lane, because the lane is that owner. Its stored `name` is the
      // fallback while the owners query is still in flight.
      name: (ss.ownerId == null ? null : ownerById(ss.ownerId)?.name) ?? ss.name,
      tag: ss.tag,
      opacity: ss.opacity,
      ownerId: ss.ownerId,
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
            stageColor,
            viewMode,
            layout,
            onTaskClick,
          )
        : renderFlat(stageTasks, stageColor, viewMode, layout, onTaskClick)}
    </SortableContext>
  );
}

interface LaneView {
  name: string;
  tag: string;
  opacity: number;
  ownerId: number | null;
}

function renderWithSubStages(
  stageSubStages: LaneView[],
  stageTasks: Task[],
  stageId: number,
  stageColor: string,
  viewMode: 'detail' | 'summary',
  layout: ColumnContentLayout,
  onTaskClick: (task: Task) => void,
) {
  // A person's lane contains exactly the tasks in this stage that owner owns,
  // by foreign key — its tag is not read (EPIC-06 OWN-R11, OWN-R16). Every
  // other lane still matches tags: a task may carry more than one (stale tags
  // from earlier moves, shared tag strings), and the last matching one wins
  // because drag/drop appends the newest assignment at the end.
  const tagLaneTags = stageSubStages.filter((ss) => ss.ownerId == null).map((ss) => ss.tag);
  const subStageTaskLists: Task[][] = stageSubStages.map(() => []);
  const unlanedTasks: Task[] = [];

  stageTasks.forEach((task) => {
    const ownLaneIndex =
      task.ownerId == null ? -1 : stageSubStages.findIndex((ss) => ss.ownerId === task.ownerId);
    if (ownLaneIndex !== -1) {
      subStageTaskLists[ownLaneIndex]?.push(task);
      return;
    }

    const tags = task.tags || [];
    const assignedTag = [...tags].reverse().find((tag) => tagLaneTags.includes(tag));
    if (assignedTag === undefined) {
      unlanedTasks.push(task);
      return;
    }
    const subStageIndex = stageSubStages.findIndex(
      (ss) => ss.ownerId == null && ss.tag === assignedTag,
    );
    subStageTaskLists[subStageIndex]?.push(task);
  });

  // Tasks in no lane fall into the first lane that is not somebody's — putting
  // them in a person's lane would claim they belong to that person. Where every
  // lane in the stage belongs to someone, they render above the lanes instead.
  const catchAllIndex = stageSubStages.findIndex((ss) => ss.ownerId == null);

  return (
    <div
      className={cn(
        'gap-2 min-h-[60px]',
        // Wells stack in a column; across a strip they sit side by side.
        layout === 'strip' ? 'flex flex-row flex-wrap' : 'flex flex-col',
      )}
    >
      {catchAllIndex === -1 && unlanedTasks.length > 0 && (
        <div className={cn(layout === 'strip' ? STRIP_DETAIL_GRID_CLASS : 'flex flex-col gap-2')}>
          {unlanedTasks.map((task) =>
            viewMode === 'detail' ? (
              <TaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                stageColor={stageColor}
                onInlineEdit={() => {}}
              />
            ) : (
              <TaskCardSummary
                key={task.id}
                task={task}
                onClick={onTaskClick}
                stageColor={stageColor}
              />
            ),
          )}
        </div>
      )}
      {stageSubStages.map((subStage, subIndex) => {
        const subStageTasks = subStageTaskLists[subIndex] ?? [];
        const finalTasks =
          subIndex === catchAllIndex ? [...subStageTasks, ...unlanedTasks] : subStageTasks;

        return (
          <DayPlanSubStage
            key={`${subIndex}-${subStage.tag}`}
            stageId={stageId}
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
  stageColor: string,
  viewMode: 'detail' | 'summary',
  layout: ColumnContentLayout,
  onTaskClick: (task: Task) => void,
) {
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
    <div className="flex min-h-[60px] flex-wrap content-start gap-2">
      {stageTasks.map((task) => (
        <TaskCardSummary key={task.id} task={task} onClick={onTaskClick} stageColor={stageColor} />
      ))}
    </div>
  );
}
