import type { Owner } from '@shared/schema';
import { PROJECT_SCOPE_NONE, type ProjectScope } from '@shared/project-scope';
import type { BoardWarningKind } from '@shared/board-warnings';
import { OWNER_FILTER_ALL, OWNER_FILTER_NONE, type OwnerFilter } from './owner-view';

export interface ActiveFilter {
  /** Stable key, also the test id suffix. */
  key: 'project' | 'goal' | 'owner' | 'warning' | 'search' | 'focus';
  label: string;
  value: string;
  /** True when it narrows the board; false for the "everything" default. */
  narrowing: boolean;
}

const WARNING_TITLE: Record<BoardWarningKind, string> = {
  'in-progress': 'Many in progress',
  'high-priority': 'High-priority waiting',
  overdue: 'Overdue',
  stale: 'Stale tasks',
};

export interface ActiveFilterInput {
  scope: ProjectScope;
  projectName: string | null;
  /** Hide the project row when the board has no projects at all. */
  hasProjects: boolean;
  owners: Pick<Owner, 'id' | 'name'>[];
  ownerFilter: OwnerFilter;
  warningFilter: BoardWarningKind | null;
  searchQuery: string;
  focusMode: boolean;
  /** The goal the board is narrowed to, by name. */
  goalName?: string | null;
}

/**
 * What is currently narrowing the board, as read-only feedback. Project and
 * owner are always listed — "Everyone" is a state worth stating, since the
 * selector that set it lives in a menu or off screen. Warning, search and
 * focus appear only while they are on.
 */
export function describeActiveFilters(input: ActiveFilterInput): ActiveFilter[] {
  const out: ActiveFilter[] = [];

  if (input.hasProjects) {
    const value =
      input.projectName ?? (input.scope === PROJECT_SCOPE_NONE ? 'No project' : 'All projects');
    out.push({
      key: 'project',
      label: 'Project',
      value,
      narrowing: input.projectName !== null || input.scope === PROJECT_SCOPE_NONE,
    });
  }

  if (input.goalName) {
    out.push({ key: 'goal', label: 'Goal', value: input.goalName, narrowing: true });
  }

  const ownerValue =
    input.ownerFilter === OWNER_FILTER_ALL
      ? 'Everyone'
      : input.ownerFilter === OWNER_FILTER_NONE
        ? 'Unassigned'
        : (input.owners.find((o) => o.id === input.ownerFilter)?.name ?? 'Unknown owner');
  out.push({
    key: 'owner',
    label: 'Owner',
    value: ownerValue,
    narrowing: input.ownerFilter !== OWNER_FILTER_ALL,
  });

  if (input.warningFilter) {
    out.push({
      key: 'warning',
      label: 'Showing',
      value: WARNING_TITLE[input.warningFilter],
      narrowing: true,
    });
  }
  const query = input.searchQuery.trim();
  if (query) out.push({ key: 'search', label: 'Search', value: `“${query}”`, narrowing: true });
  if (input.focusMode) out.push({ key: 'focus', label: 'Focus', value: 'On', narrowing: true });

  return out;
}
