/* eslint-disable @typescript-eslint/no-unsafe-return -- generic T propagation through apiGet is type-safe at call sites */
import { QueryClient, type QueryFunction } from '@tanstack/react-query';
import { apiGet, ApiError } from './api';

export { apiRequest, apiGet, apiPost, apiPatch, apiDelete, ApiError } from './api';

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      return await apiGet<T>(queryKey.join('/'));
    } catch (error) {
      if (
        unauthorizedBehavior === 'returnNull' &&
        error instanceof ApiError &&
        error.status === 401
      ) {
        return null as T;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
