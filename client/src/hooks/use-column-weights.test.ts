// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useColumnWeights, DEFAULT_COLUMN_WEIGHT } from './use-column-weights';

const STORAGE_KEY = 'kanban-column-weights';

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

describe('useColumnWeights', () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.useRealTimers();
  });

  it('defaults every stage to an equal share', () => {
    const { result } = renderHook(() => useColumnWeights());
    expect(result.current.getWeight(1)).toBe(DEFAULT_COLUMN_WEIGHT);
    expect(result.current.getWeight(99)).toBe(DEFAULT_COLUMN_WEIGHT);
    expect(result.current.hasCustomWidths).toBe(false);
  });

  it('stores a resized pair and reports custom widths', () => {
    const { result } = renderHook(() => useColumnWeights());
    act(() => {
      result.current.setPairWeights(1, 1.5, 2, 0.5);
    });
    expect(result.current.getWeight(1)).toBe(1.5);
    expect(result.current.getWeight(2)).toBe(0.5);
    expect(result.current.hasCustomWidths).toBe(true);
  });

  it('clamps weights so a column can neither vanish nor swallow the row', () => {
    const { result } = renderHook(() => useColumnWeights());
    act(() => {
      result.current.setPairWeights(1, 500, 2, -20);
    });
    expect(result.current.getWeight(1)).toBe(8);
    expect(result.current.getWeight(2)).toBe(0.2);
  });

  it('resetPair evens out two neighbours without touching other columns', () => {
    const { result } = renderHook(() => useColumnWeights());
    act(() => {
      result.current.setPairWeights(1, 1.6, 2, 0.4);
      result.current.setPairWeights(3, 2, 4, 0.5);
    });
    act(() => {
      result.current.resetPair(1, 2);
    });
    expect(result.current.getWeight(1)).toBe(1);
    expect(result.current.getWeight(2)).toBe(1);
    expect(result.current.getWeight(3)).toBe(2);
  });

  it('resetAll clears every stored width', () => {
    const { result } = renderHook(() => useColumnWeights());
    act(() => {
      result.current.setPairWeights(1, 1.5, 2, 0.5);
    });
    act(() => {
      result.current.resetAll();
    });
    expect(result.current.getWeight(1)).toBe(DEFAULT_COLUMN_WEIGHT);
    expect(result.current.hasCustomWidths).toBe(false);
  });

  it('persists weights to localStorage after the debounce', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useColumnWeights());
    act(() => {
      result.current.setPairWeights(1, 1.25, 2, 0.75);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      '1': 1.25,
      '2': 0.75,
    });
    vi.useRealTimers();
  });

  it('reads persisted weights on mount and ignores junk entries', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ '1': 1.4, '2': 'wide', '3': null }));
    const { result } = renderHook(() => useColumnWeights());
    expect(result.current.getWeight(1)).toBe(1.4);
    expect(result.current.getWeight(2)).toBe(DEFAULT_COLUMN_WEIGHT);
    expect(result.current.getWeight(3)).toBe(DEFAULT_COLUMN_WEIGHT);
  });

  it('falls back to defaults when stored JSON is unparseable', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json');
    const { result } = renderHook(() => useColumnWeights());
    expect(result.current.getWeight(1)).toBe(DEFAULT_COLUMN_WEIGHT);
    expect(result.current.hasCustomWidths).toBe(false);
  });
});
