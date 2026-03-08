/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMemo } from 'react';
import { Task } from '@shared/schema';
import { useStages } from '@/hooks/use-stages';
import { Badge } from '@/components/ui/badge';

interface StageHeadersProps {
  tasks: Task[];
}

const defaultStageColors = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

const getDefaultStageColor = (index: number): string => {
  return defaultStageColors[index % defaultStageColors.length];
};

export function StageHeaders({ tasks }: StageHeadersProps) {
  const { data: stages = [] } = useStages();

  const sortedStages = useMemo(() => {
    return [...stages].sort((a: any, b: any) => a.order - b.order);
  }, [stages]);

  const stageColorMap = useMemo(() => {
    const map = new Map<number, string>();
    sortedStages.forEach((stage: any, index: number) => {
      const color = stage.color || getDefaultStageColor(index);
      map.set(stage.id, color);
    });
    return map;
  }, [sortedStages]);

  const activeTasks = tasks.filter((t) => !t.archived);

  return (
    <div className="sticky top-[64px] z-40 flex-shrink-0 bg-background/95 backdrop-blur-sm pb-2">
      {/* Horizontal scrollable stage tabs */}
      <div className="scroll-tabs px-1 py-1">
        {sortedStages.map((stage: any) => {
          const stageColor = stageColorMap.get(stage.id) || defaultStageColors[0];
          const stageCount = activeTasks.filter((t) => t.stageId === stage.id).length;
          return (
            <div
              key={`header-${stage.id}`}
              className="flex-shrink-0 neo-raised rounded-full px-4 py-2 flex items-center gap-2"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: stageColor }}
              />
              <span className="font-display font-bold text-[11px] uppercase tracking-wider text-foreground whitespace-nowrap">
                {stage.name}
              </span>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] neo-pressed rounded-md px-1.5 py-0 touch-target-sm min-h-0 min-w-0 h-5"
              >
                {stageCount}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
