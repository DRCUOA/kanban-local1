/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '@shared/schema';
import { TaskCard } from './TaskCard';
import { TaskCardSummary } from './TaskCardSummary';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STRIP_DETAIL_GRID_CLASS, type ColumnContentLayout } from './column-layout';

interface DayPlanSubStageProps {
  stageId: number;
  subStage: {
    name: string;
    tag: string;
    bgClass: string;
    opacity: number;
  };
  tasks: Task[];
  stageColor: string;
  viewMode: 'detail' | 'summary';
  /** `strip`: the well is one of several sharing a full-width band. */
  layout?: ColumnContentLayout;
  onTaskClick: (task: Task) => void;
}

export function DayPlanSubStage({
  stageId,
  subStage,
  tasks,
  stageColor,
  viewMode,
  layout = 'list',
  onTaskClick,
}: DayPlanSubStageProps) {
  const subStageId = `${stageId}-${subStage.tag}`;

  const { setNodeRef, isOver } = useDroppable({
    id: subStageId,
    data: {
      type: 'SubStage',
      subStageTag: subStage.tag,
    },
  });

  const displayStageColor = stageColor || '#3B82F6';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'neo-well relative overflow-hidden rounded-xl transition-colors',
        // Side by side across a strip, wrapping when the band gets narrow.
        layout === 'strip' && 'flex-1 basis-[280px] min-w-0',
        isOver && 'ring-2 ring-primary/50',
      )}
    >
      {/* Admin-configured tint renders over the solid well so it stays a
          visible panel even when the tint is a near-transparent wash. */}
      <div aria-hidden className={cn('absolute inset-0 pointer-events-none', subStage.bgClass)} />
      <div className="relative flex flex-col gap-2 p-2.5 min-h-[60px]">
        <div className="flex items-center justify-between mb-1 px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {subStage.name}
          </h3>
          <Badge
            variant="secondary"
            className="text-sm font-semibold font-mono px-2 py-0.5 min-h-[24px]"
          >
            {tasks.length}
          </Badge>
        </div>

        <SortableContext
          id={subStageId}
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {viewMode === 'detail' ? (
            <div
              className={cn(
                'min-h-[40px]',
                layout === 'strip' ? STRIP_DETAIL_GRID_CLASS : 'flex flex-col gap-2',
              )}
            >
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    stageColor={displayStageColor}
                    onInlineEdit={() => {}}
                  />
                ))
              ) : (
                <div className="text-[10px] text-muted-foreground text-center py-3 opacity-50">
                  No tasks
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[40px] flex-wrap content-start gap-2">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TaskCardSummary
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    stageColor={displayStageColor}
                  />
                ))
              ) : (
                <div className="text-[10px] text-muted-foreground text-center py-3 w-full opacity-50">
                  No tasks
                </div>
              )}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
