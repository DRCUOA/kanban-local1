import type { Owner } from '@shared/schema';
import { PROJECT_SCOPE_NONE, type ProjectScope } from '@shared/project-scope';
import { FILTER_NONE, type FilterId } from '@/lib/board-filters';

export interface ActiveFilter {
  /** Stable key, also the test id suffix. */
  key: 'project' | 'goal' | 'task' | 'owner' | 'stage' | 'search' | 'focus';
  label: string;
  value: string;
  /** True when it narrows the board; false for the "everything" default. */
  narrowing: boolean;
}

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
  searchQuery: string;
  focusMode: boolean;
  /** The goals the board is narrowed to, by name. */
  goalNames?: string[];
  /** The single tasks the board is narrowed to, by title. */
  taskNames?: string[];
  /** The stages chosen, by name. */
  stageNames?: string[];
}

/** One or two names in full; past that the first and how many more. */
function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(', ');
  return `${names[0]} +${names.length - 1}`;
}

/**
 * What is currently narrowing the board, as read-only feedback. Project and
 * owner are always listed — "Everyone" is a state worth stating, since the
 * landing page that set it is off screen. Goals, tasks, stages, search and
 * focus appear only while they are on.
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

  const taskNames = input.taskNames ?? [];
  if (taskNames.length > 0) {
    out.push({
      key: 'task',
      label: taskNames.length > 1 ? 'Tasks' : 'Task',
      value: nameList(taskNames),
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

  const query = input.searchQuery.trim();
  if (query) out.push({ key: 'search', label: 'Search', value: `“${query}”`, narrowing: true });
  if (input.focusMode) out.push({ key: 'focus', label: 'Focus', value: 'On', narrowing: true });

  return out;
}
