import { format } from 'date-fns';
import type { Owner } from '@shared/schema';
import { PROJECT_SCOPE_NONE, type ProjectScope } from '@shared/project-scope';
import type { BoardWarningKind } from '@shared/board-warnings';
import {
  DUE_MODE,
  FILTER_NONE,
  endOfDueDay,
  type DueMode,
  type FilterId,
} from '@/lib/board-filters';

export interface ActiveFilter {
  /** Stable key, also the test id suffix. */
  key: 'project' | 'goal' | 'owner' | 'stage' | 'due' | 'new' | 'warning' | 'search' | 'focus';
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
  /** The projects chosen, by name, when the landing page chose two or more. */
  projectNames?: string[];
  owners: Pick<Owner, 'id' | 'name'>[];
  /** The owners chosen; empty is everyone. */
  ownerSelection: FilterId[];
  warningFilter: BoardWarningKind | null;
  searchQuery: string;
  focusMode: boolean;
  /** The goals the board is narrowed to, by name. */
  goalNames?: string[];
  /** The stages chosen, by name. */
  stageNames?: string[];
  /** The DUE BY row; the date is `yyyy-MM-dd`. */
  due?: { mode: DueMode; date: string };
  onlyNew?: boolean;
}

/** One or two names in full; past that the first and how many more. */
function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(', ');
  return `${names[0]} +${names.length - 1}`;
}

/**
 * What is currently narrowing the board, as read-only feedback. Project and
 * owner are always listed — "Everyone" is a state worth stating, since the
 * selector that set it lives in a menu or off screen. The other landing page
 * rows, warning, search and focus appear only while they are on.
 */
export function describeActiveFilters(input: ActiveFilterInput): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const projectNames = input.projectNames ?? [];

  if (input.hasProjects) {
    const value =
      projectNames.length > 1
        ? nameList(projectNames)
        : (input.projectName ??
          (input.scope === PROJECT_SCOPE_NONE ? 'No project' : 'All projects'));
    out.push({
      key: 'project',
      label: projectNames.length > 1 ? 'Projects' : 'Project',
      value,
      narrowing:
        projectNames.length > 1 || input.projectName !== null || input.scope === PROJECT_SCOPE_NONE,
    });
  }

  const goalNames = input.goalNames ?? [];
  if (goalNames.length > 0) {
    out.push({
      key: 'goal',
      label: goalNames.length > 1 ? 'Goals' : 'Goal',
      value: nameList(goalNames),
      narrowing: true,
    });
  }

  const ownerNames = input.ownerSelection.map((id) =>
    id === FILTER_NONE
      ? 'Unassigned'
      : (input.owners.find((o) => o.id === id)?.name ?? 'Unknown owner'),
  );
  out.push({
    key: 'owner',
    label: ownerNames.length > 1 ? 'Owners' : 'Owner',
    value: ownerNames.length === 0 ? 'Everyone' : nameList(ownerNames),
    narrowing: ownerNames.length > 0,
  });

  const stageNames = input.stageNames ?? [];
  if (stageNames.length > 0) {
    out.push({
      key: 'stage',
      label: stageNames.length > 1 ? 'Stages' : 'Stage',
      value: nameList(stageNames),
      narrowing: true,
    });
  }

  const dueEnd = input.due ? endOfDueDay(input.due.date) : null;
  if (input.due && input.due.mode !== DUE_MODE.ANY && dueEnd) {
    const day = format(dueEnd, 'MMM d');
    out.push({
      key: 'due',
      label: 'Due by',
      value: input.due.mode === DUE_MODE.ARCHIVED ? `${day}, archived` : `${day}, not done`,
      narrowing: true,
    });
  }

  if (input.onlyNew) out.push({ key: 'new', label: 'Showing', value: 'New only', narrowing: true });

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
