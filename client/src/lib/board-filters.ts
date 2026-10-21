import type { Stage, Task } from '@shared/schema';
import { isClosedStageKind } from '@shared/constants';
import { stageKind } from '@shared/stage-state';

/**
 * What the landing page chooses for the board: any mix of projects, goals,
 * owners and stages, a due-by date, and whether to show only new tasks.
 *
 * A list that is empty does not filter — "nothing selected in a row means the
 * row doesn't filter". The rows narrow together: a task is on the board only
 * when it passes every row that has a selection.
 *
 * `none` stands for "no project" and "unassigned", the same token the project
 * scope and the owner view use, so it can sit in a list beside real ids.
 */
export const FILTER_NONE = 'none';
export type FilterId = number | typeof FILTER_NONE;

/**
 * DUE BY. `open`: work not yet done, due on or before the date. `archived`:
 * archived tasks due on or before the date, brought back onto the board in
 * their columns. The date is a due date either way, since the row is DUE BY.
 */
export const DUE_MODE = { ANY: 'any', OPEN: 'open', ARCHIVED: 'archived' } as const;
export type DueMode = (typeof DUE_MODE)[keyof typeof DUE_MODE];

export interface BoardFilters {
  projects: FilterId[];
  goals: number[];
  owners: FilterId[];
  stages: number[];
  due: DueMode;
  /** `yyyy-MM-dd`, the last day that counts as "by". Empty until a mode needs one. */
  dueDate: string;
  onlyNew: boolean;
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  projects: [],
  goals: [],
  owners: [],
  stages: [],
  due: DUE_MODE.ANY,
  dueDate: '',
  onlyNew: false,
};

/** A task no one has opened since mail made it. */
export function isNewTask(task: Pick<Task, 'viewedAt'>): boolean {
  return task.viewedAt === null;
}

/** The end of a `yyyy-MM-dd` day in local time, or null for a blank or bad date. */
export function endOfDueDay(dueDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;
  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return Number.isNaN(end.getTime()) ? null : end;
}

/** True when the due row is narrowing: a mode other than "any date", with a usable date. */
export function dueFilterActive(filters: Pick<BoardFilters, 'due' | 'dueDate'>): boolean {
  return filters.due !== DUE_MODE.ANY && endOfDueDay(filters.dueDate) !== null;
}

/** True when any row of the landing page is narrowing the board. */
export function boardFiltersActive(filters: BoardFilters): boolean {
  return (
    filters.projects.length > 0 ||
    filters.goals.length > 0 ||
    filters.owners.length > 0 ||
    filters.stages.length > 0 ||
    dueFilterActive(filters) ||
    filters.onlyNew
  );
}

/** Whether a row with these selections lets `id` through. */
function listAllows<T>(list: readonly T[], test: (entry: T) => boolean): boolean {
  return list.length === 0 || list.some(test);
}

export interface BoardFilterContext {
  stages: Stage[];
  /**
   * Tasks that were new when the board opened and have been opened since. They
   * stay on an "only new" board until it is left, so opening a card does not
   * make it vanish from under the pointer.
   */
  keepAsNew?: ReadonlySet<number>;
}

/**
 * True when `task` passes every row. The task list it is applied to decides
 * live versus archived: the board hands it the archived list while DUE BY is
 * on "Archived before", and the live list otherwise.
 */
export function matchesBoardFilters(
  task: Task,
  filters: BoardFilters,
  { stages, keepAsNew }: BoardFilterContext,
): boolean {
  if (
    !listAllows(filters.projects, (p) =>
      p === FILTER_NONE ? task.projectId == null : task.projectId === p,
    )
  )
    return false;
  if (!listAllows(filters.goals, (g) => task.id === g || task.goalTaskId === g)) return false;
  if (
    !listAllows(filters.owners, (o) =>
      o === FILTER_NONE ? task.ownerId == null : task.ownerId === o,
    )
  )
    return false;
  if (!listAllows(filters.stages, (s) => task.stageId === s)) return false;
  if (filters.onlyNew && !isNewTask(task) && !keepAsNew?.has(task.id)) return false;

  if (filters.due === DUE_MODE.ANY) return !task.archived;
  const end = endOfDueDay(filters.dueDate);
  // A mode without a date yet is not a filter; the live board is what shows.
  if (end === null) return !task.archived;
  if (filters.due === DUE_MODE.ARCHIVED && !task.archived) return false;
  if (filters.due === DUE_MODE.OPEN) {
    if (task.archived) return false;
    const stage = stages.find((s) => s.id === task.stageId);
    if (isClosedStageKind(stageKind(stage))) return false;
  }
  if (!task.dueDate) return false;
  return new Date(task.dueDate).getTime() <= end.getTime();
}

/**
 * The columns the board draws. Chosen stages are drawn, closed ones included,
 * since choosing Done is asking to see it. With none chosen it is the board
 * as it always is — the open columns, with finished work behind Filing —
 * except under "Archived before", whose tasks are mostly finished: then every
 * column is open to them, and the board draws the ones they fill.
 */
export function boardColumnStages(sortedStages: Stage[], filters: BoardFilters): Stage[] {
  if (filters.stages.length > 0) return sortedStages.filter((s) => filters.stages.includes(s.id));
  if (filters.due === DUE_MODE.ARCHIVED && dueFilterActive(filters)) return sortedStages;
  return sortedStages.filter((s) => !isClosedStageKind(stageKind(s)));
}

/**
 * The tasks the board would show for these filters: the ones that pass every
 * row and sit in a column it draws. The landing page counts this, so its
 * "Showing N" is the board's N.
 */
export function tasksOnBoard(
  liveTasks: Task[],
  archivedTasks: Task[],
  filters: BoardFilters,
  context: BoardFilterContext,
): Task[] {
  const source =
    filters.due === DUE_MODE.ARCHIVED && dueFilterActive(filters) ? archivedTasks : liveTasks;
  const sorted = [...context.stages].sort((a, b) => a.order - b.order);
  const columns = new Set(boardColumnStages(sorted, filters).map((s) => s.id));
  return source.filter((t) => columns.has(t.stageId) && matchesBoardFilters(t, filters, context));
}

/** Adds `id` to the list, or takes it out if it is there. */
export function toggleInList<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

// --- Persistence -------------------------------------------------------------

function isFilterId(value: unknown): value is FilterId {
  return value === FILTER_NONE || (Number.isSafeInteger(value) && (value as number) > 0);
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/**
 * Reads stored filters back, keeping only what is well-formed: a value from an
 * older build or edited by hand falls back to "no filter" for that row rather
 * than breaking the board.
 */
export function parseBoardFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== 'object') return EMPTY_BOARD_FILTERS;
  const value = raw as Record<string, unknown>;
  const list = <T>(key: string, guard: (v: unknown) => v is T): T[] =>
    Array.isArray(value[key]) ? [...new Set((value[key] as unknown[]).filter(guard))] : [];
  const due = Object.values(DUE_MODE).find((mode) => mode === value.due) ?? DUE_MODE.ANY;
  const dueDate =
    typeof value.dueDate === 'string' && endOfDueDay(value.dueDate) ? value.dueDate : '';
  return {
    projects: list('projects', isFilterId),
    goals: list('goals', isId),
    owners: list('owners', isFilterId),
    stages: list('stages', isId),
    due,
    dueDate,
    onlyNew: value.onlyNew === true,
  };
}
