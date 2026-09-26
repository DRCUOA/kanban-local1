import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ProjectSummary } from '@shared/schema';
import {
  PROJECT_SCOPE_ALL,
  parseProjectScope,
  serializeProjectScope,
  type ProjectScope,
} from '@shared/project-scope';
import { useProjects } from './use-projects';

/**
 * The project the board is scoped to, shared by every page.
 *
 * Persisted in localStorage (the same reason as the board layout: Archive and
 * Admin are full navigations that throw React state away) and mirrored into
 * the `?project=` query parameter so a scoped view can be shared by URL. On
 * load a `?project=` in the URL wins over the stored value; otherwise the
 * stored value is used, and a first visit lands on "All projects".
 *
 * There are no accounts yet, so "different users" are served by each browser
 * remembering its own scope — a preference, not a boundary (EPIC-01, R3).
 */
export const PROJECT_SCOPE_STORAGE_KEY = 'kanban-project-scope';
export const PROJECT_SCOPE_URL_PARAM = 'project';

const isBrowser = typeof window !== 'undefined';

export function readStoredProjectScope(): ProjectScope {
  if (!isBrowser) return PROJECT_SCOPE_ALL;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(PROJECT_SCOPE_URL_PARAM);
    const urlScope = fromUrl === null ? null : parseProjectScope(fromUrl);
    if (urlScope !== null) return urlScope;
    const stored = parseProjectScope(window.localStorage.getItem(PROJECT_SCOPE_STORAGE_KEY));
    if (stored !== null) return stored;
  } catch {
    // localStorage may be unavailable (private mode, SSR, etc.)
  }
  return PROJECT_SCOPE_ALL;
}

function persistProjectScope(scope: ProjectScope): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, serializeProjectScope(scope));
  } catch {
    /* ignore quota / private-mode errors */
  }
  try {
    // Keep the address bar shareable without adding history entries. "All" is
    // the default, so it leaves the URL clean.
    const url = new URL(window.location.href);
    if (scope === PROJECT_SCOPE_ALL) url.searchParams.delete(PROJECT_SCOPE_URL_PARAM);
    else url.searchParams.set(PROJECT_SCOPE_URL_PARAM, serializeProjectScope(scope));
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  } catch {
    /* a non-standard location (tests, embedded views) is not worth failing over */
  }
}

export interface ProjectScopeContextValue {
  scope: ProjectScope;
  setScope: (next: ProjectScope) => void;
  /** Every project, archived included, as the server lists them. */
  projects: ProjectSummary[];
  /** Projects offered as scopes and in the task forms. */
  activeProjects: ProjectSummary[];
  /** The scoped project, when the scope is one. */
  currentProject: ProjectSummary | null;
  /** True while a task's project is not already implied by the header. */
  showProjectOnCards: boolean;
  projectById: (id: number | null | undefined) => ProjectSummary | null;
}

const noop = () => {
  /* no provider: the scope is fixed at "All projects" */
};

/**
 * Default for components rendered without the provider (tests, isolated
 * previews): no projects, "All" scope, and a setter that does nothing.
 */
const DEFAULT_CONTEXT: ProjectScopeContextValue = {
  scope: PROJECT_SCOPE_ALL,
  setScope: noop,
  projects: [],
  activeProjects: [],
  currentProject: null,
  showProjectOnCards: false,
  projectById: () => null,
};

/** Exported for tests, which stub the value instead of running the queries. */
export const ProjectScopeContext = createContext<ProjectScopeContextValue>(DEFAULT_CONTEXT);

export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<ProjectScope>(() => readStoredProjectScope());
  const { data: projects = [], isSuccess: projectsLoaded } = useProjects();

  useEffect(() => {
    persistProjectScope(scope);
  }, [scope]);

  // A scope pointing at a project that no longer exists (deleted from another
  // browser, or a stale link) falls back to "All" rather than an empty board.
  useEffect(() => {
    if (typeof scope !== 'number' || !projectsLoaded) return;
    if (!projects.some((p) => p.id === scope)) {
      setScopeState(PROJECT_SCOPE_ALL);
    }
  }, [scope, projects, projectsLoaded]);

  const setScope = useCallback((next: ProjectScope) => {
    setScopeState(next);
  }, []);

  const value = useMemo<ProjectScopeContextValue>(() => {
    const projectById = (id: number | null | undefined) =>
      id == null ? null : (projects.find((p) => p.id === id) ?? null);
    const currentProject = typeof scope === 'number' ? projectById(scope) : null;
    return {
      scope,
      setScope,
      projects,
      activeProjects: projects.filter((p) => !p.archived),
      currentProject,
      showProjectOnCards: scope === PROJECT_SCOPE_ALL,
      projectById,
    };
  }, [scope, setScope, projects]);

  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>;
}

export function useProjectScope(): ProjectScopeContextValue {
  return useContext(ProjectScopeContext);
}
