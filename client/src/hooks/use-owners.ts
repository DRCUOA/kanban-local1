import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type { InsertOwner, Owner, OwnerSummary } from '@shared/schema';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

/**
 * Every owner, active ones first, each with its live task count. One query
 * shared by the owner picker, the task forms, the cards and Admin.
 *
 * Before EPIC-06 this list was `SELECT DISTINCT owner FROM tasks`, so an owner
 * existed only while a task mentioned them. It is now a table: an owner with
 * no work is still an owner.
 */
export function useOwners() {
  return useQuery({
    queryKey: [api.owners.list.path],
    queryFn: () => apiGet<OwnerSummary[]>(api.owners.list.path),
  });
}

/**
 * Lookup from a task's `ownerId` to the owner row, for the chips. Falls back to
 * null while the query is still in flight; callers show the mirrored
 * `task.owner` name in that case so a card is never blank.
 */
export function useOwnerById() {
  const { data: owners = [] } = useOwners();
  return (id: number | null | undefined) =>
    id == null ? null : (owners.find((owner) => owner.id === id) ?? null);
}

function useInvalidateOwners() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [api.owners.list.path] });
    // Deprecated name-only list, still served for consumers that read it.
    void queryClient.invalidateQueries({ queryKey: [api.tasks.owners.path] });
    // An owner change can move tasks (delete releases them) and can change
    // which lane a card sits in, so the task lists and lanes refresh too.
    void queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    void queryClient.invalidateQueries({ queryKey: [api.tasks.archived.path] });
    void queryClient.invalidateQueries({ queryKey: [api.subStages.list.path] });
  };
}

export function useCreateOwner() {
  const invalidate = useInvalidateOwners();
  return useMutation({
    mutationFn: (owner: InsertOwner) => apiPost<Owner>(api.owners.create.path, owner),
    onSuccess: invalidate,
  });
}

/** Renaming here is the only write a rename needs: the name lives in one row. */
export function useUpdateOwner() {
  const invalidate = useInvalidateOwners();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: number } & Partial<InsertOwner>) =>
      apiPatch<Owner>(api.owners.update.path.replace(':id', String(id)), updates),
    onSuccess: invalidate,
  });
}

/** Deleting an owner releases their tasks and unbinds their lanes. */
export function useDeleteOwner() {
  const invalidate = useInvalidateOwners();
  return useMutation({
    mutationFn: (id: number) => apiDelete(api.owners.delete.path.replace(':id', String(id))),
    onSuccess: invalidate,
  });
}
