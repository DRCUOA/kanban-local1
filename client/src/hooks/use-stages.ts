/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type { Stage, SubStage } from '@shared/schema';
import { apiGet } from '@/lib/api';

export function useStages() {
  return useQuery<Stage[]>({
    queryKey: [api.stages.list.path],
    queryFn: () => apiGet<Stage[]>(api.stages.list.path),
  });
}

export function useSubStages() {
  return useQuery<SubStage[]>({
    queryKey: [api.subStages.list.path],
    queryFn: () => apiGet<SubStage[]>(api.subStages.list.path),
  });
}
