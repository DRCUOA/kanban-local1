// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useStages, useSubStages } from './use-stages';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/api';

const mockApiGet = vi.mocked(apiGet);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useStages', () => {
  it('fetches stages from the correct API path', async () => {
    const stages = [
      { id: 1, name: 'Backlog', sortOrder: 0, color: '#3B82F6' },
      { id: 2, name: 'In Progress', sortOrder: 1, color: '#10B981' },
    ];
    mockApiGet.mockResolvedValueOnce(stages);

    const { result } = renderHook(() => useStages(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/stages');
    expect(result.current.data).toEqual(stages);
  });

  it('exposes error state on fetch failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useStages(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useSubStages', () => {
  it('fetches sub-stages from the correct API path', async () => {
    const subStages = [
      { id: 1, name: 'Design', stageId: 2, sortOrder: 0 },
      { id: 2, name: 'Code', stageId: 2, sortOrder: 1 },
    ];
    mockApiGet.mockResolvedValueOnce(subStages);

    const { result } = renderHook(() => useSubStages(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/sub-stages');
    expect(result.current.data).toEqual(subStages);
  });

  it('exposes error state on fetch failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useSubStages(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
