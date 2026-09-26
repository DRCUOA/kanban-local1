import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type { InsertProject, Project, ProjectSummary } from '@shared/schema';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

/**
 * Every project, active ones first, each with its live task count. One query
 * shared by the header selector, the task forms, the cards and Admin.
 */
export function useProjects() {
  return useQuery({
    queryKey: [api.projects.list.path],
    queryFn: () => apiGet<ProjectSummary[]>(api.projects.list.path),
  });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    // A project change can move tasks (delete releases them) or change what the
    // cards should show, so the task lists refresh too.
    void queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    void queryClient.invalidateQueries({ queryKey: [api.tasks.archived.path] });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (project: InsertProject) => apiPost<Project>(api.projects.create.path, project),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number } & Partial<InsertProject>) =>
      apiPatch<Project>(api.projects.update.path.replace(':id', String(id)), updates),
    onSuccess: invalidate,
  });
}

/** Deleting a project releases its tasks; nothing else is removed. */
export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: number) => apiDelete(api.projects.delete.path.replace(':id', String(id))),
    onSuccess: invalidate,
  });
}
