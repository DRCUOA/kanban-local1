import { useCallback, useEffect, useState } from 'react';

/**
 * Board layout preference — stage columns side by side (`horizontal`) or
 * stacked as full-width bands (`vertical`).
 *
 * Persisted in localStorage because the Archive and Admin pages are reached
 * by full navigation, which throws React state away: without this the board
 * came back in the default layout after every trip away from it.
 */
export type BoardLayout = 'vertical' | 'horizontal';

export const DEFAULT_BOARD_LAYOUT: BoardLayout = 'vertical';

export const BOARD_LAYOUT_STORAGE_KEY = 'kanban-board-layout';

const isBrowser = typeof window !== 'undefined';

function isBoardLayout(value: unknown): value is BoardLayout {
  return value === 'vertical' || value === 'horizontal';
}

export function readStoredBoardLayout(): BoardLayout {
  if (!isBrowser) return DEFAULT_BOARD_LAYOUT;
  try {
    const raw = window.localStorage.getItem(BOARD_LAYOUT_STORAGE_KEY);
    if (isBoardLayout(raw)) return raw;
  } catch {
    // localStorage may be unavailable (private mode, SSR, etc.)
  }
  return DEFAULT_BOARD_LAYOUT;
}

export interface UseBoardLayoutResult {
  boardLayout: BoardLayout;
  setBoardLayout: (next: BoardLayout) => void;
  toggleBoardLayout: () => void;
}

export function useBoardLayout(): UseBoardLayoutResult {
  const [boardLayout, setBoardLayoutState] = useState<BoardLayout>(() => readStoredBoardLayout());

  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(BOARD_LAYOUT_STORAGE_KEY, boardLayout);
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [boardLayout]);

  const setBoardLayout = useCallback((next: BoardLayout) => {
    setBoardLayoutState(next);
  }, []);

  const toggleBoardLayout = useCallback(() => {
    setBoardLayoutState((prev) => (prev === 'vertical' ? 'horizontal' : 'vertical'));
  }, []);

  return { boardLayout, setBoardLayout, toggleBoardLayout };
}
