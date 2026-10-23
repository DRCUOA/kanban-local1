import type { Stage, Task } from '@shared/schema';
import { TASK_TYPE, isClosedStageKind } from '@shared/constants';
import { isClosedTaskByStage, stageKind } from '@shared/stage-state';

/**
 * What the landing page chooses for the board: projects, then goals inside
 * them, then tasks inside those, picked a stage at a time by its wizard. The
 * landing page is the only place they are set; the board reads them and names
 * them in its chips. Owners and stages are rows the wizard retired: the board
 * still honours them, and the landing page lets go of any left in storage.
 *
 * A list that is empty does not filter — "nothing picked at a stage means the
 * stage shows everything". The lists narrow together: a task is on the board
 * only when it passes every list that has a selection.
 *
 * `none` stands for "no project" and "unassigned", the same token the project
 * scope uses, so it can sit in a list beside real ids.
 */
export const FILTER_NONE = 'none';
export type FilterId = number | typeof FILTER_NONE;

export interface BoardFilters {
  projects: FilterId[];
  goals: number[];
  /** Single tasks, the wizard's last stage. */
  tasks: number[];
  owners: FilterId[];
  stages: number[];
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  projects: [],
  goals: [],
  tasks: [],
  owners: [],
  stages: [],
};

/** True when any row of the landing page is narrowing the board. */
export function boardFiltersActive(filters: BoardFilters): boolean {
  return (
    filters.projects.length > 0 ||
    filters.goals.length > 0 ||
    filters.tasks.length > 0 ||
    filters.owners.length > 0 ||
    filters.stages.length > 0
  );
}

/** Whether a row with these selections lets `id` through. */
function listAllows<T>(list: readonly T[], test: (entry: T) => boolean): boolean {
  return list.length === 0 || list.some(test);
}

/** True when a live `task` passes every row. Archived work is never on the board. */
export function matchesBoardFilters(task: Task, filters: BoardFilters): boolean {
  if (task.archived) return false;
  if (
    !listAllows(filters.projects, (p) =>
      p === FILTER_NONE ? task.projectId == null : task.projectId === p,
    )
  )
    return false;
  if (!listAllows(filters.goals, (g) => task.id === g || task.goalTaskId === g)) return false;
  if (!listAllows(filters.tasks, (id) => task.id === id)) return false;
  if (
    !listAllows(filters.owners, (o) =>
      o === FILTER_NONE ? task.ownerId == null : task.ownerId === o,
    )
  )
    return false;
  return listAllows(filters.stages, (s) => task.stageId === s);
}

/**
 * The columns the board draws. Chosen stages are drawn, closed ones included,
 * since choosing Done is asking to see it. With none chosen it is the board
 * as it always is: the open columns, with finished work behind Filing.
 */
export function boardColumnStages(sortedStages: Stage[], filters: BoardFilters): Stage[] {
  if (filters.stages.length > 0) return sortedStages.filter((s) => filters.stages.includes(s.id));
  return sortedStages.filter((s) => !isClosedStageKind(stageKind(s)));
}

/**
 * The tasks the board would show for these filters: the ones that pass every
 * row and sit in a column it draws. The landing page counts this, so its
 * "Showing N" is the board's N.
 */
export function tasksOnBoard(liveTasks: Task[], filters: BoardFilters, stages: Stage[]): Task[] {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const columns = new Set(boardColumnStages(sorted, filters).map((s) => s.id));
  return liveTasks.filter((t) => columns.has(t.stageId) && matchesBoardFilters(t, filters));
}

/**
 * The goals the Goal row offers, by title: live goals inside the chosen
 * projects (every project when none is chosen) that are still open. A goal
 * that is done, abandoned or archived is closed and drops out, the way an
 * archived project or owner does, unless it is still chosen: then it stays so
 * it can be unticked.
 */
export function goalsOnOffer(
  tasks: Task[],
  stages: Stage[],
  projectSelection: FilterId[],
  chosen: readonly number[] = [],
): Task[] {
  return tasks
    .filter(
      (t) =>
        t.type === TASK_TYPE.GOAL &&
        !t.archived &&
        (projectSelection.length === 0 || projectSelection.includes(t.projectId ?? FILTER_NONE)) &&
        (!isClosedTaskByStage(t, stages) || chosen.includes(t.id)),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The tasks the wizard's last stage offers, by title: live tasks that are not
 * goals, inside the chosen projects and under the chosen goals (every one
 * when none is chosen) and still open. As with goals, a closed task stays on
 * offer while it is chosen, so it can be unticked.
 */
export function tasksOnOffer(
  tasks: Task[],
  stages: Stage[],
  projectSelection: FilterId[],
  goalSelection: readonly number[],
  chosen: readonly number[] = [],
): Task[] {
  return tasks
    .filter(
      (t) =>
        t.type !== TASK_TYPE.GOAL &&
        !t.archived &&
        (projectSelection.length === 0 || projectSelection.includes(t.projectId ?? FILTER_NONE)) &&
        (goalSelection.length === 0 ||
          (t.goalTaskId != null && goalSelection.includes(t.goalTaskId))) &&
        (!isClosedTaskByStage(t, stages) || chosen.includes(t.id)),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
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
 * older build (its due-by and new-task rows included) or edited by hand falls
 * back to "no filter" for that row rather than breaking the board.
 */
export function parseBoardFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== 'object') return EMPTY_BOARD_FILTERS;
  const value = raw as Record<string, unknown>;
  const list = <T>(key: string, guard: (v: unknown) => v is T): T[] =>
    Array.isArray(value[key]) ? [...new Set((value[key] as unknown[]).filter(guard))] : [];
  return {
    projects: list('projects', isFilterId),
    goals: list('goals', isId),
    tasks: list('tasks', isId),
    owners: list('owners', isFilterId),
    stages: list('stages', isId),
  };
}
