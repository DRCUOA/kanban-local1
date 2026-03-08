/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/prefer-optional-chain, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMemo } from 'react';
import { type Task, type Stage } from '@shared/schema';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  PRIORITY_SORT_ORDER,
  getStatusFromStageName,
  type TaskPriorityValue,
} from '@shared/constants';

export interface UseFilteredTasksOptions {
  tasks: Task[] | undefined;
  searchQuery: string;
  focusMode: boolean;
  stages: Stage[];
}

export function useFilteredTasks({
  tasks,
  searchQuery,
  focusMode,
  stages,
}: UseFilteredTasksOptions): Task[] {
  return useMemo(() => {
    let filtered =
      tasks?.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())),
      ) || [];

    if (focusMode) {
      const getTaskStatus = (t: Task): string => {
        if (t.status) return t.status;
        const stage = stages.find((s: any) => s.id === t.stageId);
        if (stage) return getStatusFromStageName(stage.name);
        return TASK_STATUS.BACKLOG;
      };

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

    return filtered;
  }, [tasks, searchQuery, focusMode, stages]);
}
