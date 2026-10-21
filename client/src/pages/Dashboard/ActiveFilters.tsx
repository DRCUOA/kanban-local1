import { cn } from '@/lib/utils';
import type { ActiveFilter } from './active-filters';

/**
 * Read-only summary of the filters applied to the board. Not a control: the
 * chips cannot be pressed, so it can sit beside the warning icons without
 * competing with them. Its job is to make the choice made on the landing page
 * visible on the board; the Change button beside it leads back there.
 */
export function ActiveFilters({
  filters,
  className,
}: {
  filters: ActiveFilter[];
  className?: string;
}) {
  if (filters.length === 0) return null;
  return (
    <ul
      aria-label="Filters applied to the board"
      className={cn('flex min-w-0 flex-wrap items-center justify-center gap-1.5', className)}
      data-testid="active-filters"
    >
      {filters.map((f) => (
        <li
          key={f.key}
          data-testid={`active-filter-${f.key}`}
          data-narrowing={f.narrowing}
          className={cn(
            'inline-flex max-w-[16rem] select-none items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-none',
            f.narrowing
              ? 'border-primary/40 bg-primary/10 text-foreground'
              : 'border-border text-muted-foreground',
          )}
        >
          <span className="uppercase tracking-wider opacity-70">{f.label}</span>
          <span className="truncate font-semibold">{f.value}</span>
        </li>
      ))}
    </ul>
  );
}
