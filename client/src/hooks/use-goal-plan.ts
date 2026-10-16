import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type {
  AiSettingsResponse,
  ApplyGoalPlan,
  ApplyGoalPlanResult,
  GoalPlanSuggestion,
  GoalPlanOptions,
  UpdateAiSettings,
} from '@shared/goal-plan';
import { apiGet, apiPost, apiRequest } from '@/lib/api';

export function useAiSettings() {
  return useQuery({
    queryKey: [api.aiSettings.get.path],
    queryFn: () => apiGet<AiSettingsResponse>(api.aiSettings.get.path),
  });
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: UpdateAiSettings) =>
      apiRequest<AiSettingsResponse>(api.aiSettings.update.path, { method: 'PUT', body: update }),
    onSuccess: (data) => {
      queryClient.setQueryData([api.aiSettings.get.path], data);
    },
  });
}

/** Asks the AI for a plan. Nothing is saved. */
export function useSuggestGoalPlan() {
  return useMutation({
    mutationFn: ({ goalId, options }: { goalId: number; options: GoalPlanOptions }) =>
      apiPost<GoalPlanSuggestion>(
        api.goalPlan.suggest.path.replace(':id', String(goalId)),
        options,
      ),
  });
}

/** Saves the kept suggestions (and optionally the goal text) in one transaction. */
export function useApplyGoalPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, plan }: { goalId: number; plan: ApplyGoalPlan }) =>
      apiPost<ApplyGoalPlanResult>(api.goalPlan.apply.path.replace(':id', String(goalId)), plan),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      void queryClient.invalidateQueries({ queryKey: [api.taskDependencies.list.path] });
    },
  });
}
