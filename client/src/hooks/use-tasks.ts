/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type { Task, InsertTask } from '@shared/schema';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

export function useTasks() {
  return useQuery({
    queryKey: [api.tasks.list.path],
    queryFn: () => apiGet<Task[]>(api.tasks.list.path),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: InsertTask) => apiPost<Task>(api.tasks.create.path, task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number } & Partial<InsertTask>) => {
      const url = api.tasks.update.path.replace(':id', id.toString());
      return apiPatch<Task>(url, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => {
      const url = api.tasks.delete.path.replace(':id', id.toString());
      return apiDelete(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useArchivedTasks() {
  return useQuery({
    queryKey: [api.tasks.archived.path],
    queryFn: () => apiGet<Task[]>(api.tasks.archived.path),
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => {
      const url = api.tasks.archive.path.replace(':id', id.toString());
      return apiPost<Task>(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tasks.archived.path] });
    },
  });
}

export function useUnarchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => {
      const url = api.tasks.unarchive.path.replace(':id', id.toString());
      return apiPost<Task>(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tasks.archived.path] });
    },
  });
}
