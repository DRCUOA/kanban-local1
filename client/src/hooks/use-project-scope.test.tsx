// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import type { ProjectSummary } from '@shared/schema';

let mockProjects: ProjectSummary[] = [];
let mockLoaded = true;
vi.mock('./use-projects', () => ({
  useProjects: () => ({ data: mockProjects, isSuccess: mockLoaded }),
}));

import {
  ProjectScopeProvider,
  PROJECT_SCOPE_STORAGE_KEY,
  readStoredProjectScope,
  useProjectScope,
} from './use-project-scope';

/**
 * This environment exposes Node's half-implemented global `localStorage`
 * rather than jsdom's, so the tests bring their own in-memory Storage.
 */
function installMemoryStorage(): Storage {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

const project = (overrides: Partial<ProjectSummary>): ProjectSummary => ({
  id: 1,
  name: 'Alpha',
  key: 'ALP',
  color: '#6366F1',
  archived: false,
  order: 0,
  createdAt: new Date(),
  taskCount: 0,
  ...overrides,
});

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ProjectScopeProvider, null, children);
}

describe('readStoredProjectScope', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installMemoryStorage();
    window.history.replaceState(null, '', '/');
  });

  it('defaults to All projects on a first visit', () => {
    expect(readStoredProjectScope()).toBe('all');
  });

  it('starts from the stored scope', () => {
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, '4');
    expect(readStoredProjectScope()).toBe(4);
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, 'none');
    expect(readStoredProjectScope()).toBe('none');
  });

  it('ignores a stored value that is not a scope', () => {
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, 'garbage');
    expect(readStoredProjectScope()).toBe('all');
  });

  it('lets a ?project= link win over the stored scope', () => {
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, '4');
    window.history.replaceState(null, '', '/?project=9');
    expect(readStoredProjectScope()).toBe(9);
  });

  it('falls back to storage when the ?project= value is unreadable', () => {
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, '4');
    window.history.replaceState(null, '', '/?project=nope');
    expect(readStoredProjectScope()).toBe(4);
  });
});

describe('ProjectScopeProvider', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installMemoryStorage();
    window.history.replaceState(null, '', '/');
    mockProjects = [
      project({ id: 1, name: 'Alpha', taskCount: 3 }),
      project({ id: 2, name: 'Beta', key: null, color: null }),
      project({ id: 3, name: 'Old', archived: true }),
    ];
    mockLoaded = true;
  });

  it('persists a chosen scope so a full navigation keeps it', () => {
    const { result } = renderHook(() => useProjectScope(), { wrapper });
    expect(result.current.scope).toBe('all');

    act(() => {
      result.current.setScope(2);
    });

    expect(result.current.scope).toBe(2);
    expect(storage.getItem(PROJECT_SCOPE_STORAGE_KEY)).toBe('2');
  });

  it('mirrors the scope into ?project= so the view is shareable, and clears it for All', () => {
    const { result } = renderHook(() => useProjectScope(), { wrapper });

    act(() => {
      result.current.setScope(1);
    });
    expect(new URLSearchParams(window.location.search).get('project')).toBe('1');

    act(() => {
      result.current.setScope('none');
    });
    expect(new URLSearchParams(window.location.search).get('project')).toBe('none');

    act(() => {
      result.current.setScope('all');
    });
    expect(new URLSearchParams(window.location.search).get('project')).toBeNull();
  });

  it('offers only active projects as scopes and resolves the current one', () => {
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, '1');
    const { result } = renderHook(() => useProjectScope(), { wrapper });

    expect(result.current.projects).toHaveLength(3);
    expect(result.current.activeProjects.map((p) => p.id)).toEqual([1, 2]);
    expect(result.current.currentProject?.name).toBe('Alpha');
    expect(result.current.projectById(3)?.name).toBe('Old');
    expect(result.current.projectById(null)).toBeNull();
    expect(result.current.projectById(99)).toBeNull();
  });

  it('shows the project on cards only under All projects', () => {
    const { result } = renderHook(() => useProjectScope(), { wrapper });
    expect(result.current.showProjectOnCards).toBe(true);

    act(() => {
      result.current.setScope(1);
    });
    expect(result.current.showProjectOnCards).toBe(false);

    act(() => {
      result.current.setScope('none');
    });
    expect(result.current.showProjectOnCards).toBe(false);
  });

  it('falls back to All when the scoped project no longer exists', () => {
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, '42');
    const { result } = renderHook(() => useProjectScope(), { wrapper });

    expect(result.current.scope).toBe('all');
    expect(storage.getItem(PROJECT_SCOPE_STORAGE_KEY)).toBe('all');
  });

  it('keeps a project scope while the project list is still loading', () => {
    mockLoaded = false;
    mockProjects = [];
    storage.setItem(PROJECT_SCOPE_STORAGE_KEY, '42');
    const { result } = renderHook(() => useProjectScope(), { wrapper });

    expect(result.current.scope).toBe(42);
  });

  it('gives components outside the provider a fixed All scope', () => {
    const { result } = renderHook(() => useProjectScope());

    expect(result.current.scope).toBe('all');
    expect(result.current.projects).toEqual([]);
    act(() => {
      result.current.setScope(1);
    });
    expect(result.current.scope).toBe('all');
  });
});
