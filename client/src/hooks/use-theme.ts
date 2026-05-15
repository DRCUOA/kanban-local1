import { useCallback, useEffect, useState } from 'react';

/**
 * Theme preference stored in localStorage. `system` defers to the OS-level
 * `prefers-color-scheme` query, while `light`/`dark` are explicit user overrides.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Effective theme actually applied to the document (always concrete). */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'kanban-theme';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

function readStoredPreference(): ThemePreference {
  if (!isBrowser) return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // localStorage may be unavailable (private mode, SSR, etc.)
  }
  return 'system';
}

function prefersDark(): boolean {
  if (!isBrowser || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    /* Some jsdom configurations throw on matchMedia. Fall through to light. */
    return false;
  }
}

function resolvePreference(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return prefersDark() ? 'dark' : 'light';
  return pref;
}

function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (!isBrowser) return;
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = resolved;
}

/**
 * Sync the document class once during module import so the very first paint
 * matches the user's stored preference. The FOUC-prevention script in
 * `client/index.html` covers the time before this module loads.
 */
if (isBrowser) {
  applyResolvedTheme(resolvePreference(readStoredPreference()));
}

/**
 * Hook returning the current theme preference, the resolved theme (after
 * applying system fallback), and helpers to update / toggle it.
 *
 * The hook keeps document/class state in sync and listens for OS-level theme
 * changes when the user has selected `system`.
 */
export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolvePreference(readStoredPreference()),
  );

  // Apply + persist whenever preference changes.
  useEffect(() => {
    const next = resolvePreference(preference);
    setResolved(next);
    applyResolvedTheme(next);
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [preference]);

  // When `system` is selected, follow OS-level changes live.
  useEffect(() => {
    if (!isBrowser || preference !== 'system') return;
    if (typeof window.matchMedia !== 'function') return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = (): void => {
      const next: ResolvedTheme = mql.matches ? 'dark' : 'light';
      setResolved(next);
      applyResolvedTheme(next);
    };
    mql.addEventListener('change', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggle = useCallback(() => {
    // From any current resolved theme, jump straight to its inverse and stop
    // following the OS (most users who toggle want an explicit choice).
    setPreferenceState((prev) => {
      const current = resolvePreference(prev);
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return { preference, resolved, setPreference, toggle };
}
