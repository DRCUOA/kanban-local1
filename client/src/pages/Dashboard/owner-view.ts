/**
 * The board's owner view: whose work it shows, and whether cards are ordered by
 * owner (EPIC-06 OWN-R32, OWN-R33).
 *
 * The filter is an owner id, or one of two tokens — the same `all` / `none`
 * shape the project scope uses in `shared/project-scope.ts`, so "everyone" and
 * "nobody's" are states rather than the absence of one.
 */
export const OWNER_FILTER_ALL = 'all';
export const OWNER_FILTER_NONE = 'none';

export type OwnerFilter = typeof OWNER_FILTER_ALL | typeof OWNER_FILTER_NONE | number;

/** True when `task`'s owner passes the filter. */
export function ownerFilterMatches(
  ownerId: number | null | undefined,
  filter: OwnerFilter,
): boolean {
  if (filter === OWNER_FILTER_ALL) return true;
  if (filter === OWNER_FILTER_NONE) return ownerId == null;
  return ownerId === filter;
}
