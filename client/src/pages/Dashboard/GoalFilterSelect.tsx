import { Target } from 'lucide-react';
import type { Task } from '@shared/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ALL = 'all';

/**
 * Narrows the board to one goal: the goal itself and its building-blocks.
 * Offers the goals in the current project scope; hidden when there are none.
 * The landing page can choose several; the picker then names how many, and
 * choosing one here narrows to just that one.
 */
export function GoalFilterSelect({
  goals,
  value,
  onChange,
  className,
}: {
  goals: Task[];
  value: number[];
  onChange: (next: number[]) => void;
  className?: string;
}) {
  if (goals.length === 0 && value.length === 0) return null;
  const [only] = value;
  return (
    <Select
      // Several goals match no single item; an empty value shows the placeholder.
      value={value.length === 0 ? ALL : value.length === 1 ? String(only) : ''}
      onValueChange={(v) => {
        onChange(v === ALL ? [] : [Number(v)]);
      }}
    >
      <SelectTrigger
        aria-label="Goal filter"
        className={cn(
          'h-10 w-auto max-w-[14rem] gap-2 rounded-md px-3 text-sm font-medium',
          value.length > 0 && 'border-primary bg-primary/10 text-primary',
          className,
        )}
        data-testid="goal-filter-trigger"
      >
        <Target className="h-4 w-4 shrink-0" aria-hidden />
        <SelectValue placeholder={`${value.length} goals`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL} className="py-3">
          All goals
        </SelectItem>
        {goals.map((g) => (
          <SelectItem key={g.id} value={String(g.id)} className="py-3">
            {g.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
