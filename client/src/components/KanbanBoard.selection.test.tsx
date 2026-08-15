// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, createEvent } from '@testing-library/react';
import React from 'react';
import type { Task } from '@shared/schema';
import { KanbanBoard } from './KanbanBoard';
import type { ShareDialogSource } from './ShareDialog';

vi.mock('@/hooks/use-tasks', () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useArchiveTask: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/use-stages', () => ({
  useStages: () => ({
    data: [
      { id: 1, name: 'To Do', order: 1, color: '#3B82F6', createdAt: new Date() },
      { id: 2, name: 'Later', order: 2, color: '#10B981', createdAt: new Date() },
    ],
  }),
  useSubStages: () => ({ data: [] }),
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  HoverCardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

// The dialog itself is covered by ShareDialog.test.tsx; here it is a stub that
// surfaces which tasks the board asked it to share.
vi.mock('./ShareDialog', () => ({
  ShareDialog: ({ source, open }: { source: ShareDialogSource | null; open: boolean }) =>
    open && source?.type === 'tasks'
      ? React.createElement(
          'div',
          { 'data-testid': 'share-dialog-stub' },
          source.tasks.map((t) => t.id).join(','),
        )
      : null,
}));

const makeTask = (id: number, stageId: number, dueOffsetDays: number): Task =>
  ({
    id,
    title: `Task ${id}`,
    description: null,
    stageId,
    archived: false,
    status: 'backlog',
    priority: 'normal',
    effort: 1,
    dueDate: new Date(2030, 0, 1 + dueOffsetDays),
    updatedAt: new Date(),
    createdAt: new Date(),
    tags: null,
    parentTaskId: null,
    recurrence: 'none',
    history: null,
    owner: null,
  }) as Task;

/** Cards get deterministic client rects, stacked vertically 100px apart. */
function layOutCards(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('[data-task-id]').forEach((card) => {
    const id = Number(card.dataset.taskId);
    card.getBoundingClientRect = () => new DOMRect(0, (id - 1) * 100, 80, 50); // task N occupies y = (N-1)*100 … +50
  });
}

function shiftMarquee(board: HTMLElement, from: [number, number], to: [number, number]) {
  act(() => {
    board.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        shiftKey: true,
        clientX: from[0],
        clientY: from[1],
      }),
    );
  });
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: to[0], clientY: to[1] }));
  });
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup'));
  });
}

function selectedIds(container: HTMLElement): number[] {
  return [...container.querySelectorAll<HTMLElement>('[data-selected="true"]')]
    .map((el) => Number(el.dataset.taskId))
    .sort((a, b) => a - b);
}

function getCard(container: HTMLElement, id: number): HTMLElement {
  const card = container.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
  if (!card) throw new Error(`card ${id} not rendered`);
  return card;
}

describe('KanbanBoard multi-select and share', () => {
  const tasks = [makeTask(1, 1, 0), makeTask(2, 1, 1), makeTask(3, 2, 2)];

  function renderBoard() {
    const utils = render(<KanbanBoard tasks={tasks} onTaskClick={vi.fn()} viewMode="summary" />);
    layOutCards(utils.container);
    return utils;
  }

  it('selects every card the Shift+drag marquee intersects and shows the marquee', () => {
    const { container } = renderBoard();
    const board = screen.getByTestId('kanban-board-root');

    act(() => {
      board.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          shiftKey: true,
          clientX: 5,
          clientY: 5,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, clientY: 160 }));
    });

    expect(screen.getByTestId('selection-marquee')).toBeDefined();

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    // y 5…160 covers task 1 (0–50) and task 2 (100–150), not task 3 (200–250).
    expect(screen.queryByTestId('selection-marquee')).toBeNull();
    expect(selectedIds(container)).toEqual([1, 2]);
  });

  it('right-click on a selected task shares the whole selection', () => {
    const { container } = renderBoard();
    const board = screen.getByTestId('kanban-board-root');

    shiftMarquee(board, [5, 5], [70, 160]);
    expect(selectedIds(container)).toEqual([1, 2]);

    const card1 = getCard(container, 1);
    fireEvent.contextMenu(card1);

    expect(screen.getByTestId('share-dialog-stub').textContent).toBe('1,2');
  });

  it('right-click on an unselected task selects and shares only that task', () => {
    const { container } = renderBoard();
    const board = screen.getByTestId('kanban-board-root');

    shiftMarquee(board, [5, 5], [70, 160]);
    expect(selectedIds(container)).toEqual([1, 2]);

    const card3 = getCard(container, 3);
    const contextMenuEvent = createEvent.contextMenu(card3);
    fireEvent(card3, contextMenuEvent);

    expect(contextMenuEvent.defaultPrevented).toBe(true);
    expect(screen.getByTestId('share-dialog-stub').textContent).toBe('3');
    expect(selectedIds(container)).toEqual([3]);
  });

  it('clears the selection on Escape', () => {
    const { container } = renderBoard();
    const board = screen.getByTestId('kanban-board-root');

    shiftMarquee(board, [5, 5], [70, 160]);
    expect(selectedIds(container)).toEqual([1, 2]);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(selectedIds(container)).toEqual([]);
  });

  it('clears the selection when empty board space is clicked without Shift', () => {
    const { container } = renderBoard();
    const board = screen.getByTestId('kanban-board-root');

    shiftMarquee(board, [5, 5], [70, 160]);
    expect(selectedIds(container)).toEqual([1, 2]);

    act(() => {
      board.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 500, clientY: 500 }),
      );
    });

    expect(selectedIds(container)).toEqual([]);
  });

  it('keeps the selection when a card itself is pressed without Shift', () => {
    const { container } = renderBoard();
    const board = screen.getByTestId('kanban-board-root');

    shiftMarquee(board, [5, 5], [70, 160]);
    const card1 = getCard(container, 1);

    act(() => {
      card1.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }),
      );
    });

    expect(selectedIds(container)).toEqual([1, 2]);
  });
});
