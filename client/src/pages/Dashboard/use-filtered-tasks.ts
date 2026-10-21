/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/prefer-optional-chain, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMemo } from 'react';
import { type Task, type Stage } from '@shared/schema';
import { matchesBoardWarning, type BoardWarningKind } from '@shared/board-warnings';
import { richTextToPlainText } from '@/lib/rich-text';
import {
  DUE_MODE,
  EMPTY_BOARD_FILTERS,
  dueFilterActive,
  matchesBoardFilters,
  type BoardFilters,
} from '@/lib/board-filters';
import {
  STAGE_KIND,
  TASK_PRIORITY,
  PRIORITY_SORT_ORDER,
  isClosedStageKind,
  type TaskPriorityValue,
} from '@shared/constants';
import { taskStageKind } from '@shared/stage-state';

export interface UseFilteredTasksOptions {
  tasks: Task[] | undefined;
  /** Archived tasks, so an ID lookup can find a task that has left the active board. */
  archivedTasks?: Task[] | undefined;
  searchQuery: string;
  focusMode: boolean;
  /** In focus mode, detail view shows only high/critical incomplete tasks; summary keeps the in-progress + next-backlog slice. */
  viewMode: 'detail' | 'summary';
  stages: Stage[];
  /** Restrict the board to the tasks behind one header warning pill. */
  warningFilter?: BoardWarningKind | null;
  /**
   * What the landing page chose: projects, goals, owners (EPIC-06), stages,
   * due by and new tasks. Under "Archived before" the board is drawn from
   * `archivedTasks` instead of the live list.
   */
  boardFilters?: BoardFilters;
  /** New tasks opened since the board opened, kept on an "only new" board. */
  keepAsNew?: ReadonlySet<number>;
}

/**
 * A search of digits only (optionally prefixed with `#`) is an ID lookup, not a
 * text search: `161` means "show me task 161", not "every task mentioning 161".
 */
function parseTaskIdQuery(searchQuery: string): number | null {
  const match = /^#?(\d+)$/.exec(searchQuery.trim());
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

export function useFilteredTasks({
  tasks,
  archivedTasks,
  searchQuery,
  focusMode,
  viewMode,
  stages,
  warningFilter = null,
  boardFilters = EMPTY_BOARD_FILTERS,
  keepAsNew,
}: UseFilteredTasksOptions): Task[] {
  return useMemo(() => {
    const taskId = parseTaskIdQuery(searchQuery);
    if (taskId !== null) {
      // ID lookup wins over every other filter: any stage, any progress,
      // archived or not, and focus mode does not get to hide the result.
      const match =
        tasks?.find((t) => t.id === taskId) ?? archivedTasks?.find((t) => t.id === taskId);
      return match ? [match] : [];
    }

    // The warning pills, the landing page's rows and the search box narrow
    // the board together: each one is a condition, not a mode that replaces
    // the others.
    const now = new Date();
    const source =
      boardFilters.due === DUE_MODE.ARCHIVED && dueFilterActive(boardFilters)
        ? archivedTasks
        : tasks;
    let filtered =
      source?.filter(
        (t) =>
          matchesBoardFilters(t, boardFilters, { stages, keepAsNew }) &&
          (warningFilter === null || matchesBoardWarning(t, warningFilter, stages, now)) &&
          (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description &&
              richTextToPlainText(t.description)
                .toLowerCase()
                .includes(searchQuery.toLowerCase()))),
      ) || [];

    if (focusMode) {
      // The column a card sits in is its state (EPIC-03 story 2).
      const kindOf = (t: Task) => taskStageKind(t, stages);

      if (viewMode === 'detail') {
        filtered = filtered.filter((t) => {
          const p = (t.priority as TaskPriorityValue) || TASK_PRIORITY.NORMAL;
          if (p !== TASK_PRIORITY.HIGH && p !== TASK_PRIORITY.CRITICAL) return false;
          return !isClosedStageKind(kindOf(t));
        });
      } else {
        const inProgress = filtered.filter((t) => kindOf(t) === STAGE_KIND.IN_PROGRESS);
        const backlog = filtered.filter((t) => kindOf(t) === STAGE_KIND.BACKLOG);
        const nextTask = backlog.sort((a, b) => {
          const aPriority =
            PRIORITY_SORT_ORDER[(a.priority as TaskPriorityValue) || TASK_PRIORITY.NORMAL];
          const bPriority =
            PRIORITY_SORT_ORDER[(b.priority as TaskPriorityValue) || TASK_PRIORITY.NORMAL];
          return bPriority - aPriority;
        })[0];

        filtered = [...inProgress];
        if (nextTask) filtered.push(nextTask);
      }
    }

    return filtered;
  }, [
    tasks,
    archivedTasks,
    searchQuery,
    focusMode,
    viewMode,
    stages,
    warningFilter,
    boardFilters,
    keepAsNew,
  ]);
}
