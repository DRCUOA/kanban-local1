// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Task } from '@shared/schema';
import { useMarqueeSelection } from './use-marquee-selection';

const makeTask = (id: number): Task => ({ id, title: `Task ${id}`, stageId: 1 }) as Task;

/** Fake board: two cards with known client rects. */
function setUpBoard() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const rects: [string, DOMRect][] = [
    ['1', new DOMRect(0, 0, 100, 50)],
    ['2', new DOMRect(0, 300, 100, 50)],
  ];
  for (const [id, rect] of rects) {
    const card = document.createElement('div');
    card.dataset.taskId = id;
    card.getBoundingClientRect = () => rect;
    container.appendChild(card);
  }
  return { container, containerRef: { current: container } };
}

interface PointerDownInit {
  button?: number;
  shiftKey?: boolean;
  clientX?: number;
  clientY?: number;
  target?: EventTarget;
}

function pointerDownEvent(init: PointerDownInit, fallbackTarget: EventTarget) {
  return {
    button: init.button ?? 0,
    shiftKey: init.shiftKey ?? false,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    target: init.target ?? fallbackTarget,
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent<HTMLElement>;
}

function movePointer(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
  });
}

function releasePointer() {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup'));
  });
}

describe('useMarqueeSelection', () => {
  let board: ReturnType<typeof setUpBoard>;
  const tasks = [makeTask(1), makeTask(2)];

  beforeEach(() => {
    board = setUpBoard();
  });

  afterEach(() => {
    board.container.remove();
  });

  function renderMarquee(initialTasks: Task[] = tasks) {
    return renderHook(
      ({ t }) => useMarqueeSelection({ containerRef: board.containerRef, tasks: t }),
      {
        initialProps: { t: initialTasks },
      },
    );
  }

  it('starts a marquee only on a Shift+primary press', () => {
    const { result } = renderMarquee();

    act(() => {
      result.current.onPointerDown(pointerDownEvent({ shiftKey: false }, board.container));
    });
    expect(result.current.isMarqueeActive).toBe(false);

    act(() => {
      result.current.onPointerDown(
        pointerDownEvent({ shiftKey: true, button: 1 }, board.container),
      );
    });
    expect(result.current.isMarqueeActive).toBe(false);

    act(() => {
      result.current.onPointerDown(
        pointerDownEvent({ shiftKey: true, clientX: 10, clientY: 10 }, board.container),
      );
    });
    expect(result.current.isMarqueeActive).toBe(true);
    expect(result.current.marqueeRect).toEqual({ left: 10, top: 10, width: 0, height: 0 });
  });

  it('selects every card the marquee intersects, live', () => {
    const { result } = renderMarquee();

    act(() => {
      result.current.onPointerDown(
        pointerDownEvent({ shiftKey: true, clientX: 5, clientY: 5 }, board.container),
      );
    });

    movePointer(90, 40); // over card 1 only
    expect([...result.current.selectedTaskIds]).toEqual([1]);

    movePointer(90, 340); // now spans both cards
    expect([...result.current.selectedTaskIds].sort()).toEqual([1, 2]);
    expect(result.current.marqueeRect).toEqual({ left: 5, top: 5, width: 85, height: 335 });

    // Shrinking back releases the card the marquee no longer touches.
    movePointer(90, 40);
    expect([...result.current.selectedTaskIds]).toEqual([1]);
  });

  it('keeps the selection when the pointer is released', () => {
    const { result } = renderMarquee();

    act(() => {
      result.current.onPointerDown(
        pointerDownEvent({ shiftKey: true, clientX: 5, clientY: 5 }, board.container),
      );
    });
    movePointer(90, 40);
    releasePointer();

    expect(result.current.isMarqueeActive).toBe(false);
    expect(result.current.marqueeRect).toBeNull();
    expect([...result.current.selectedTaskIds]).toEqual([1]);
  });

  it('adds to an existing selection (Shift is additive)', () => {
    const { result } = renderMarquee();

    act(() => {
      result.current.selectOnly(2);
    });
    act(() => {
      result.current.onPointerDown(
        pointerDownEvent({ shiftKey: true, clientX: 5, clientY: 5 }, board.container),
      );
    });
    movePointer(90, 40); // marquee only over card 1

    expect([...result.current.selectedTaskIds].sort()).toEqual([1, 2]);
  });

  it('clears the selection on Escape', () => {
    const { result } = renderMarquee();

    act(() => {
      result.current.selectOnly(1);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.selectedTaskIds.size).toBe(0);
  });

  it('clears the selection on a plain press on empty board space', () => {
    const { result } = renderMarquee();

    act(() => {
      result.current.selectOnly(1);
    });
    act(() => {
      result.current.onPointerDown(pointerDownEvent({ target: board.container }, board.container));
    });

    expect(result.current.selectedTaskIds.size).toBe(0);
  });

  it('keeps the selection when a plain press lands on a task card', () => {
    const { result } = renderMarquee();
    const card = board.container.querySelector<HTMLElement>('[data-task-id="1"]');
    if (!card) throw new Error('card 1 not rendered');

    act(() => {
      result.current.selectOnly(1);
    });
    act(() => {
      result.current.onPointerDown(pointerDownEvent({ target: card }, board.container));
    });

    expect([...result.current.selectedTaskIds]).toEqual([1]);
  });

  it('prunes selected ids for tasks that leave the board', () => {
    const { result, rerender } = renderMarquee();

    act(() => {
      result.current.selectOnly(2);
    });
    rerender({ t: [makeTask(1)] });

    expect(result.current.selectedTaskIds.size).toBe(0);
  });
});
