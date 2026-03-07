import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface TaskColumnProps {
  id: number;
  title: string;
  count: number;
  stageColor: string;
  children: React.ReactNode;
}

export function TaskColumn({ id, title, count, stageColor, children }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const isEmpty = count === 0;

  return (
    <div className="w-full flex flex-col">
      {/* Column header - integrated into the column */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stageColor }} />
          <h2 className="font-display font-bold text-xs uppercase tracking-wider text-foreground">
            {title}
          </h2>
        </div>
        <Badge
          variant="secondary"
          className="font-mono text-base font-semibold neo-pressed rounded-lg px-3 py-1 min-h-[28px]"
        >
          {count}
        </Badge>
      </div>

      {/* Column content - taller when empty so it's a clear drop target */}
      <div
        ref={setNodeRef}
        className={cn(
          'p-3 transition-all duration-200 rounded-xl neo-container',
          isEmpty ? 'min-h-[120px]' : 'min-h-[80px]',
          isOver && 'bg-primary/5 ring-2 ring-primary/30 scale-[1.01]',
        )}
      >
        {/* Always render children so SortableContext stays mounted */}
        {children}
        {/* Show visual drop indicator when empty */}
        {isEmpty && (
          <div
            className={cn(
              'flex flex-col items-center justify-center min-h-[96px] rounded-lg border-2 border-dashed transition-colors',
              isOver ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20',
            )}
          >
            <Plus
              className={cn(
                'h-5 w-5 mb-1 transition-colors',
                isOver ? 'text-primary' : 'text-muted-foreground/30',
              )}
            />
            <p
              className={cn(
                'text-[10px] font-medium transition-colors',
                isOver ? 'text-primary' : 'text-muted-foreground/30',
              )}
            >
              {isOver ? 'Drop here' : 'Drag tasks here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
