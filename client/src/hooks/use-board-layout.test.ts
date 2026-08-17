// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useBoardLayout,
  readStoredBoardLayout,
  DEFAULT_BOARD_LAYOUT,
  BOARD_LAYOUT_STORAGE_KEY,
} from './use-board-layout';

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

describe('useBoardLayout', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  it('defaults to vertical when nothing is stored', () => {
    const { result } = renderHook(() => useBoardLayout());
    expect(result.current.boardLayout).toBe(DEFAULT_BOARD_LAYOUT);
    expect(result.current.boardLayout).toBe('vertical');
  });

  it('starts from the stored layout', () => {
    storage.setItem(BOARD_LAYOUT_STORAGE_KEY, 'horizontal');
    const { result } = renderHook(() => useBoardLayout());
    expect(result.current.boardLayout).toBe('horizontal');
  });

  it('persists a toggle so a remount (page navigation) keeps the last layout', () => {
    const first = renderHook(() => useBoardLayout());
    act(() => {
      first.result.current.toggleBoardLayout();
    });
    expect(first.result.current.boardLayout).toBe('horizontal');
    expect(storage.getItem(BOARD_LAYOUT_STORAGE_KEY)).toBe('horizontal');
    first.unmount();

    const second = renderHook(() => useBoardLayout());
    expect(second.result.current.boardLayout).toBe('horizontal');

    act(() => {
      second.result.current.toggleBoardLayout();
    });
    expect(second.result.current.boardLayout).toBe('vertical');
    expect(storage.getItem(BOARD_LAYOUT_STORAGE_KEY)).toBe('vertical');
  });

  it('setBoardLayout stores an explicit value', () => {
    const { result } = renderHook(() => useBoardLayout());
    act(() => {
      result.current.setBoardLayout('horizontal');
    });
    expect(result.current.boardLayout).toBe('horizontal');
    expect(storage.getItem(BOARD_LAYOUT_STORAGE_KEY)).toBe('horizontal');
  });

  it('ignores garbage in storage', () => {
    storage.setItem(BOARD_LAYOUT_STORAGE_KEY, 'diagonal');
    expect(readStoredBoardLayout()).toBe('vertical');
    const { result } = renderHook(() => useBoardLayout());
    expect(result.current.boardLayout).toBe('vertical');
  });

  it('survives an unreadable localStorage', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    expect(readStoredBoardLayout()).toBe('vertical');
    const { result } = renderHook(() => useBoardLayout());
    expect(result.current.boardLayout).toBe('vertical');
    act(() => {
      result.current.toggleBoardLayout();
    });
    expect(result.current.boardLayout).toBe('horizontal');
  });
});
