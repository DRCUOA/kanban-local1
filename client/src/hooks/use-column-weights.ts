import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Per-stage column widths for the horizontal board, stored as *flex weights*
 * rather than pixels so the board keeps filling the viewport at any width:
 * a column's share of the row is `weight / sum(weights)`.
 *
 * Weights are persisted per stage id in localStorage; an absent entry means
 * "equal share" (weight 1).
 */

const STORAGE_KEY = 'kanban-column-weights';

export const DEFAULT_COLUMN_WEIGHT = 1;

/** Guard rails so a stored/edited weight can never collapse or swallow the row. */
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 8;

/** Debounce for persistence — a resize drag updates state on every pointermove. */
const PERSIST_DELAY_MS = 250;

export type ColumnWeights = Record<string, number>;

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
  /** Flex weight for a stage — always a usable number. */
  getWeight: (stageId: number) => number;
  /** Set both sides of a resize handle in one update. */
  setPairWeights: (aId: number, aWeight: number, bId: number, bWeight: number) => void;
  /** Give two neighbouring columns an equal share of their combined space. */
  resetPair: (aId: number, bId: number) => void;
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
    (stageId: number) => weights[String(stageId)] ?? DEFAULT_COLUMN_WEIGHT,
    [weights],
  );

  const setPairWeights = useCallback(
    (aId: number, aWeight: number, bId: number, bWeight: number) => {
      setWeights((prev) => ({
        ...prev,
        [String(aId)]: clampWeight(aWeight),
        [String(bId)]: clampWeight(bWeight),
      }));
    },
    [],
  );

  const resetPair = useCallback((aId: number, bId: number) => {
    setWeights((prev) => {
      const half =
        ((prev[String(aId)] ?? DEFAULT_COLUMN_WEIGHT) +
          (prev[String(bId)] ?? DEFAULT_COLUMN_WEIGHT)) /
        2;
      return { ...prev, [String(aId)]: clampWeight(half), [String(bId)]: clampWeight(half) };
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
