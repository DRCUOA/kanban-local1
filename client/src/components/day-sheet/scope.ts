import { cleanLabel } from '@shared/briefing';
import type { ActiveFilter } from '@/pages/Dashboard/active-filters';

/**
 * The day sheet's "Showing …" line: what narrows the board, worded for paper,
 * so a sheet picked up later says which slice of the board it is. Null when
 * nothing narrows it. Semicolons separate the filters because a filter's own
 * value can already hold a comma ("owners Rich, Moi"). Decorative emoji in
 * stage names ("Waiting ✋️") are dropped: they print in colour, or not at all.
 */
export function describeDaySheetScope(filters: readonly ActiveFilter[]): string | null {
  const parts = filters
    .filter((filter) => filter.narrowing)
    .map((filter) =>
      filter.key === 'focus'
        ? 'focus mode on'
        : `${filter.label.toLowerCase()} ${cleanLabel(filter.value)}`,
    );
  return parts.length > 0 ? parts.join('; ') : null;
}
