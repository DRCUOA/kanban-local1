import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { apiGet } from '@/lib/api';

/**
 * Fetch the distinct list of owner labels currently in use across tasks.
 * The list powers the owner picker's "existing values" section.
 */
export function useOwners() {
  return useQuery({
    queryKey: [api.tasks.owners.path],
    queryFn: () => apiGet<string[]>(api.tasks.owners.path),
  });
}
