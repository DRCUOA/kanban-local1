import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Task } from '@shared/schema';
import { PROJECT_SCOPE_ALL, PROJECT_SCOPE_NONE, type ProjectScope } from '@shared/project-scope';
import {
  EMPTY_BOARD_FILTERS,
  FILTER_NONE,
  parseBoardFilters,
  type BoardFilters,
  type FilterId,
} from '@/lib/board-filters';
import { useProjectScope } from './use-project-scope';

/**
 * What the landing page chose for the board, shared by every page.
 *
 * Persisted in localStorage for the same reason as the project scope: Archive
 * and Admin are full navigations that throw React state away, and a board
 * that forgot its filters on the way back would be no use as a landing step.
 *
 * Projects are the one row that has two homes. One project (or "No project")
 * is the header's project scope, so the board's fetch, the Add dialog's
 * default and Archive/Filing all keep reading it as before; only a choice of
 * two or more is kept here, with the scope left at "All projects" underneath.
 * `filters.projects` is always the whole choice, whichever home it is in.
 */
export const BOARD_FILTERS_STORAGE_KEY = 'kanban-board-filters';

const isBrowser = typeof window !== 'undefined';

export function readStoredBoardFilters(): BoardFilters {
  if (!isBrowser) return EMPTY_BOARD_FILTERS;
  try {
    const raw = window.localStorage.getItem(BOARD_FILTERS_STORAGE_KEY);
    return raw ? parseBoardFilters(JSON.parse(raw)) : EMPTY_BOARD_FILTERS;
  } catch {
    // localStorage may be unavailable (private mode), or the value unreadable.
    return EMPTY_BOARD_FILTERS;
  }
}

function persistBoardFilters(filters: BoardFilters): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(BOARD_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function scopeToSelection(scope: ProjectScope): FilterId[] {
  if (scope === PROJECT_SCOPE_ALL) return [];
  return [scope === PROJECT_SCOPE_NONE ? FILTER_NONE : scope];
}

function selectionToScope(id: FilterId): ProjectScope {
  return id === FILTER_NONE ? PROJECT_SCOPE_NONE : id;
}

export interface BoardFiltersContextValue {
  filters: BoardFilters;
  /** Replaces the project row; one project becomes the scope, more stay here. */
  setProjects: (next: FilterId[]) => void;
  /** Changes any other row. */
  update: (patch: Partial<Omit<BoardFilters, 'projects'>>) => void;
  /** Every row back to "doesn't filter", the project scope included. */
  clear: () => void;
}

const DEFAULT_CONTEXT: BoardFiltersContextValue = {
  filters: EMPTY_BOARD_FILTERS,
  setProjects: () => {
    /* no provider: nothing to filter */
  },
  update: () => {
    /* no provider: nothing to filter */
  },
  clear: () => {
    /* no provider: nothing to filter */
  },
};

/** Exported for tests, which stub the value instead of running the provider. */
export const BoardFiltersContext = createContext<BoardFiltersContextValue>(DEFAULT_CONTEXT);

export function BoardFiltersProvider({ children }: { children: ReactNode }) {
  const { scope, setScope } = useProjectScope();
  const [stored, setStored] = useState<BoardFilters>(() => readStoredBoardFilters());

  useEffect(() => {
    persistBoardFilters(stored);
  }, [stored]);

  // A single project picked somewhere else (a shared ?project= link, say)
  // replaces a choice of several: the scope is the more recent word.
  useEffect(() => {
    if (scope !== PROJECT_SCOPE_ALL && stored.projects.length > 0) {
      setStored((current) => ({ ...current, projects: [] }));
    }
  }, [scope, stored.projects.length]);

  const setProjects = useCallback(
    (next: FilterId[]) => {
      const unique = [...new Set(next)];
      const [only] = unique;
      if (unique.length === 1 && only !== undefined) {
        setScope(selectionToScope(only));
        setStored((current) => ({ ...current, projects: [] }));
      } else {
        setScope(PROJECT_SCOPE_ALL);
        setStored((current) => ({ ...current, projects: unique }));
      }
    },
    [setScope],
  );

  const update = useCallback((patch: Partial<Omit<BoardFilters, 'projects'>>) => {
    setStored((current) => ({ ...current, ...patch }));
  }, []);

  const clear = useCallback(() => {
    setScope(PROJECT_SCOPE_ALL);
    setStored(EMPTY_BOARD_FILTERS);
  }, [setScope]);

  const value = useMemo<BoardFiltersContextValue>(
    () => ({
      filters: {
        ...stored,
        projects: stored.projects.length > 1 ? stored.projects : scopeToSelection(scope),
      },
      setProjects,
      update,
      clear,
    }),
    [stored, scope, setProjects, update, clear],
  );

  return <BoardFiltersContext.Provider value={value}>{children}</BoardFiltersContext.Provider>;
}

export function useBoardFilters(): BoardFiltersContextValue {
  return useContext(BoardFiltersContext);
}

/**
 * Lets go of chosen goals or tasks that are no longer on offer (archived,
 * binned, or outside what the earlier stages chose), so a choice nobody can
 * see or untick never narrows the board. One that is merely done stays on
 * offer while chosen. `offered` is undefined while the tasks are loading,
 * when nothing is let go.
 */
function usePruneChosen(key: 'goals' | 'tasks', offered: readonly Task[] | undefined): void {
  const { filters, update } = useBoardFilters();
  const chosen = filters[key];
  useEffect(() => {
    if (!offered || chosen.length === 0) return;
    const kept = chosen.filter((id) => offered.some((t) => t.id === id));
    if (kept.length !== chosen.length) update({ [key]: kept });
  }, [key, offered, chosen, update]);
}

export function usePruneChosenGoals(offered: readonly Task[] | undefined): void {
  usePruneChosen('goals', offered);
}

export function usePruneChosenTasks(offered: readonly Task[] | undefined): void {
  usePruneChosen('tasks', offered);
}
