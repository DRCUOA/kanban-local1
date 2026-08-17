import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Per-stage column widths for the horizontal board, stored as *flex weights*
 * rather than pixels so the board keeps filling the viewport at any width:
 * a column's share of the row is `weight / sum(weights)`.
 *
 * Weights are persisted per column key in localStorage; an absent entry means
 * "equal share" (weight 1). Keys are stage ids, plus a reserved string for the
 * horizontal layout's task preview pane, which shares the row like a column.
 */

const STORAGE_KEY = 'kanban-column-weights';

export const DEFAULT_COLUMN_WEIGHT = 1;

/** Guard rails so a stored/edited weight can never collapse or swallow the row. */
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 8;

/** Debounce for persistence — a resize drag updates state on every pointermove. */
const PERSIST_DELAY_MS = 250;

export type ColumnWeights = Record<string, number>;

/** A stage id, or a reserved name for a non-stage member of the column row. */
export type ColumnKey = number | string;

/** Column-row key of the horizontal layout's task preview pane. */
export const PREVIEW_PANE_COLUMN_KEY = 'preview';

const isBrowser = typeof window !== 'undefined';

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COLUMN_WEIGHT;
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, value));
}

function readStoredWeights(): ColumnWeights {
  if (!isBrowser) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: ColumnWeights = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[key] = clampWeight(value);
      }
    }
    return result;
  } catch {
    // Unreadable / unparseable storage falls back to equal columns.
    return {};
  }
}

export interface UseColumnWeightsResult {
  /** Flex weight for a column — always a usable number. */
  getWeight: (key: ColumnKey) => number;
  /** Set both sides of a resize handle in one update. */
  setPairWeights: (aKey: ColumnKey, aWeight: number, bKey: ColumnKey, bWeight: number) => void;
  /** Give two neighbouring columns an equal share of their combined space. */
  resetPair: (aKey: ColumnKey, bKey: ColumnKey) => void;
  /** Drop every stored width so all columns go back to equal shares. */
  resetAll: () => void;
  /** True when at least one column has been resized away from the default. */
  hasCustomWidths: boolean;
}

export function useColumnWeights(): UseColumnWeightsResult {
  const [weights, setWeights] = useState<ColumnWeights>(() => readStoredWeights());

  // Persist lazily: a drag produces dozens of updates per second.
  useEffect(() => {
    if (!isBrowser) return;
    const handle = window.setTimeout(() => {
      try {
        if (Object.keys(weights).length === 0) window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
      } catch {
        /* ignore quota / private-mode errors */
      }
    }, PERSIST_DELAY_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [weights]);

  const getWeight = useCallback(
    (key: ColumnKey) => weights[String(key)] ?? DEFAULT_COLUMN_WEIGHT,
    [weights],
  );

  const setPairWeights = useCallback(
    (aKey: ColumnKey, aWeight: number, bKey: ColumnKey, bWeight: number) => {
      setWeights((prev) => ({
        ...prev,
        [String(aKey)]: clampWeight(aWeight),
        [String(bKey)]: clampWeight(bWeight),
      }));
    },
    [],
  );

  const resetPair = useCallback((aKey: ColumnKey, bKey: ColumnKey) => {
    setWeights((prev) => {
      const half =
        ((prev[String(aKey)] ?? DEFAULT_COLUMN_WEIGHT) +
          (prev[String(bKey)] ?? DEFAULT_COLUMN_WEIGHT)) /
        2;
      return { ...prev, [String(aKey)]: clampWeight(half), [String(bKey)]: clampWeight(half) };
    });
  }, []);

  const resetAll = useCallback(() => {
    setWeights({});
  }, []);

  const hasCustomWidths = useMemo(
    () => Object.values(weights).some((w) => w !== DEFAULT_COLUMN_WEIGHT),
    [weights],
  );

  return { getWeight, setPairWeights, resetPair, resetAll, hasCustomWidths };
}
