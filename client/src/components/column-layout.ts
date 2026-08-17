/**
 * How a stage's lanes and cards flow inside its container.
 *
 * `list` stacks sub-stage wells and detail cards top-to-bottom (a column);
 * `strip` lets them flow across a full-width band — wells sit side by side and
 * detail cards tile in a responsive grid. Summary circles already wrap in
 * both. Used by done stages, which render as a band above the archive zone.
 */
export type ColumnContentLayout = 'list' | 'strip';

/** Detail cards tile across a strip; a narrow strip collapses to one column. */
export const STRIP_DETAIL_GRID_CLASS = 'grid gap-2 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]';
