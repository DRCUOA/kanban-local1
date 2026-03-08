/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useQuery } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type { Stage, SubStage } from '@shared/schema';

export function useStages() {
  return useQuery<Stage[]>({
    queryKey: [api.stages.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.stages.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Failed to fetch stages: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`,
          );
        }
        return res.json();
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error(
            'Network error: Unable to connect to server. Please check if the server is running.',
          );
        }
        throw error;
      }
    },
  });
}

export function useSubStages() {
  return useQuery<SubStage[]>({
    queryKey: [api.subStages.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.subStages.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Failed to fetch sub-stages: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`,
          );
        }
        return res.json();
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error(
            'Network error: Unable to connect to server. Please check if the server is running.',
          );
        }
        throw error;
      }
    },
  });
}
