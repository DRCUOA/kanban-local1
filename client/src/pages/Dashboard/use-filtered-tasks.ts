/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/prefer-optional-chain, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMemo } from 'react';
import { type Task, type Stage } from '@shared/schema';
import { richTextToPlainText } from '@/lib/rich-text';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  PRIORITY_SORT_ORDER,
  getStatusFromStageName,
  type TaskPriorityValue,
} from '@shared/constants';

export interface UseFilteredTasksOptions {
  tasks: Task[] | undefined;
  /** Archived tasks, so an ID lookup can find a task that has left the active board. */
  archivedTasks?: Task[] | undefined;
  searchQuery: string;
  focusMode: boolean;
  /** In focus mode, detail view shows only high/critical incomplete tasks; summary keeps the in-progress + next-backlog slice. */
  viewMode: 'detail' | 'summary';
  stages: Stage[];
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

function getTaskStatusFromStages(t: Task, stages: Stage[]): string {
  if (t.status) return t.status;
  const stage = stages.find((s: any) => s.id === t.stageId);
  if (stage) return getStatusFromStageName(stage.name);
  return TASK_STATUS.BACKLOG;
}

export function useFilteredTasks({
  tasks,
  archivedTasks,
  searchQuery,
  focusMode,
  viewMode,
  stages,
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

    let filtered =
      tasks?.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description &&
            richTextToPlainText(t.description).toLowerCase().includes(searchQuery.toLowerCase())),
      ) || [];

    if (focusMode) {
      const getTaskStatus = (t: Task) => getTaskStatusFromStages(t, stages);

      if (viewMode === 'detail') {
        filtered = filtered.filter((t) => {
          const p = (t.priority as TaskPriorityValue) || TASK_PRIORITY.NORMAL;
          if (p !== TASK_PRIORITY.HIGH && p !== TASK_PRIORITY.CRITICAL) return false;
          const status = getTaskStatus(t);
          return status !== TASK_STATUS.DONE && status !== TASK_STATUS.ABANDONED;
        });
      } else {
        const inProgress = filtered.filter((t) => getTaskStatus(t) === TASK_STATUS.IN_PROGRESS);
        const backlog = filtered.filter((t) => getTaskStatus(t) === TASK_STATUS.BACKLOG);
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
  }, [tasks, archivedTasks, searchQuery, focusMode, viewMode, stages]);
}
