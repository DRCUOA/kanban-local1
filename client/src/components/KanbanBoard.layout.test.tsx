// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import type { Task } from '@shared/schema';
import { KanbanBoard, HOVER_PREVIEW_DELAY_MS } from './KanbanBoard';

vi.mock('@/hooks/use-tasks', () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useArchiveTask: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/use-stages', () => ({
  useStages: () => ({
    data: [
      { id: 1, name: 'To Do', order: 1, color: '#3B82F6', createdAt: new Date() },
      { id: 2, name: 'Doing', order: 2, color: '#10B981', createdAt: new Date() },
      { id: 3, name: 'Done  ✔', order: 3, color: '#84CC16', createdAt: new Date() },
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

vi.mock('./ShareDialog', () => ({
  ShareDialog: () => null,
}));

const makeTask = (id: number, stageId: number, title = `Task ${id}`): Task =>
  ({
    id,
    title,
    description: null,
    stageId,
    archived: false,
    status: 'backlog',
    priority: 'normal',
    effort: 1,
    dueDate: new Date(2030, 0, 1 + id),
    updatedAt: new Date(),
    createdAt: new Date(),
    tags: null,
    parentTaskId: null,
    recurrence: 'none',
    history: null,
    owner: null,
  }) as Task;

const tasks = [makeTask(1, 1), makeTask(2, 2), makeTask(3, 3), makeTask(4, 3)];

function getCard(container: HTMLElement, id: number): HTMLElement {
  const card = container.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
  if (!card) throw new Error(`card ${id} not rendered`);
  return card;
}

function pointerOver(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
  });
}

function pointerDown(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  });
}

function previewedId(): string | null {
  return screen.getByTestId('task-preview-pane').getAttribute('data-preview-task-id');
}

function isBefore(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('KanbanBoard layout: done strip', () => {
  it.each(['vertical', 'horizontal'] as const)(
    'in the %s layout the done stage is a strip between the columns and the archive zone',
    (boardLayout) => {
      const { container } = render(
        <KanbanBoard tasks={tasks} onTaskClick={vi.fn()} boardLayout={boardLayout} />,
      );
      const stageArea = screen.getByTestId('kanban-stage-area');
      const columnRow = stageArea.firstElementChild;
      if (!columnRow) throw new Error('column row not rendered');
      const strip = screen.getByTestId('stage-strip-3');
      const archive = screen.getByText('Drag here to archive');

      // Done tasks live in the strip, not in the column row.
      expect(strip.contains(getCard(container, 3))).toBe(true);
      expect(strip.contains(getCard(container, 4))).toBe(true);
      expect(columnRow.contains(getCard(container, 3))).toBe(false);
      expect(columnRow.contains(getCard(container, 1))).toBe(true);
      expect(columnRow.contains(getCard(container, 2))).toBe(true);

      // Order: column row → done strip → archive strip.
      expect(isBefore(columnRow, strip)).toBe(true);
      expect(isBefore(strip, archive)).toBe(true);

      // The strip keeps the stage's header and count.
      expect(strip.textContent).toContain('Done  ✔');
      expect(strip.textContent).toContain('2');
    },
  );

  it('summary view renders in-progress tasks as circles like every other stage', () => {
    const { container } = render(
      <KanbanBoard tasks={tasks} onTaskClick={vi.fn()} viewMode="summary" boardLayout="vertical" />,
    );
    // Stage 2 is "Doing" (an in-progress name); its card is the same circle as
    // the To Do card, not a title row.
    const doing = getCard(container, 2);
    const todo = getCard(container, 1);
    expect(doing.className).toContain('rounded-full');
    expect(doing.className).toBe(todo.className);
    expect(doing.textContent).toBe('2');
    expect(container.querySelector('[data-task-id="2"] p')).toBeNull();
  });

  it('the vertical layout has no preview pane', () => {
    render(<KanbanBoard tasks={tasks} onTaskClick={vi.fn()} boardLayout="vertical" />);
    expect(screen.queryByTestId('task-preview-pane')).toBeNull();
  });
});

describe('KanbanBoard layout: preview pane (horizontal)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderHorizontal(onTaskClick = vi.fn()) {
    return render(
      <KanbanBoard
        tasks={tasks}
        onTaskClick={onTaskClick}
        viewMode="summary"
        boardLayout="horizontal"
      />,
    );
  }

  it('takes the slot the done column gave up: full height beside the stage area, with its own resizer', () => {
    renderHorizontal();
    const board = screen.getByTestId('kanban-board-root');
    const stageArea = screen.getByTestId('kanban-stage-area');
    const pane = screen.getByTestId('task-preview-pane');

    // Beside the whole stage area (columns + done strip + archive strip), not
    // inside the column row, so it runs the full board height. Its slot is a
    // `display: contents` wrapper that hides the pane below the xl breakpoint.
    const slot = screen.getByTestId('task-preview-slot');
    expect(board.lastElementChild).toBe(slot);
    expect(slot.lastElementChild).toBe(pane);
    expect(slot.className).toContain('xl:contents');
    expect(stageArea.contains(pane)).toBe(false);
    expect(stageArea.contains(screen.getByTestId('stage-strip-3'))).toBe(true);
    expect(stageArea.contains(screen.getByText('Drag here to archive'))).toBe(true);
    expect(screen.getByTestId('task-preview-empty')).toBeDefined();
    expect(previewedId()).toBeNull();

    // Two resizers: To Do|Doing and Doing|preview — none for the done strip.
    const resizers = screen.getAllByRole('separator');
    expect(resizers).toHaveLength(2);
    expect(screen.getByLabelText('Resize Doing and the preview pane')).toBeDefined();
  });

  it('follows the pointer once it rests on a card, not while it is passing through', () => {
    const { container } = renderHorizontal();

    pointerOver(getCard(container, 1));
    expect(previewedId()).toBeNull();

    // Moving on before the delay elapses forgets card 1 and restarts on card 2.
    act(() => {
      vi.advanceTimersByTime(HOVER_PREVIEW_DELAY_MS - 50);
    });
    pointerOver(getCard(container, 2));
    act(() => {
      vi.advanceTimersByTime(HOVER_PREVIEW_DELAY_MS - 50);
    });
    expect(previewedId()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(previewedId()).toBe('2');
    expect(screen.getByTestId('task-preview-title').textContent).toBe('Task 2');
  });

  it('keeps the last task when the pointer moves off the cards (so the pane can be reached)', () => {
    const { container } = renderHorizontal();
    pointerOver(getCard(container, 1));
    act(() => {
      vi.advanceTimersByTime(HOVER_PREVIEW_DELAY_MS);
    });
    expect(previewedId()).toBe('1');

    // Over empty board space, then out of the board entirely.
    pointerOver(screen.getByTestId('kanban-board-root'));
    act(() => {
      screen.getByTestId('kanban-board-root').dispatchEvent(new MouseEvent('pointerleave'));
      vi.advanceTimersByTime(HOVER_PREVIEW_DELAY_MS * 2);
    });
    expect(previewedId()).toBe('1');
  });

  it('leaving a card before the delay never previews it', () => {
    const { container } = renderHorizontal();
    pointerOver(getCard(container, 1));
    act(() => {
      vi.advanceTimersByTime(HOVER_PREVIEW_DELAY_MS - 50);
    });
    pointerOver(screen.getByTestId('kanban-board-root'));
    act(() => {
      vi.advanceTimersByTime(HOVER_PREVIEW_DELAY_MS * 2);
    });
    expect(previewedId()).toBeNull();
  });

  it('previews a pressed card immediately, including a done-strip card', () => {
    const { container } = renderHorizontal();
    pointerDown(getCard(container, 3));
    expect(previewedId()).toBe('3');
    expect(screen.getByTestId('task-preview-stage').textContent).toBe('Done');
  });

  it('previews a card that receives keyboard focus', () => {
    const { container } = renderHorizontal();
    const card = getCard(container, 2);
    const focusable = card.matches('[tabindex]')
      ? card
      : card.querySelector<HTMLElement>('[tabindex]');
    if (!focusable) throw new Error('card has no focusable element');
    act(() => {
      fireEvent.focusIn(focusable);
    });
    expect(previewedId()).toBe('2');
  });

  it('"Open task" in the pane opens the previewed task', () => {
    const onTaskClick = vi.fn();
    const { container } = renderHorizontal(onTaskClick);
    pointerDown(getCard(container, 1));
    fireEvent.click(screen.getByTestId('task-preview-open'));
    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick.mock.calls[0]?.[0]).toMatchObject({ id: 1 });
  });

  it('shows the live task, so an edit shows up without re-hovering', () => {
    const onTaskClick = vi.fn();
    const { container, rerender } = renderHorizontal(onTaskClick);
    pointerDown(getCard(container, 1));
    expect(screen.getByTestId('task-preview-title').textContent).toBe('Task 1');

    rerender(
      <KanbanBoard
        tasks={[makeTask(1, 1, 'Task 1 (renamed)'), ...tasks.slice(1)]}
        onTaskClick={onTaskClick}
        viewMode="summary"
        boardLayout="horizontal"
      />,
    );
    expect(screen.getByTestId('task-preview-title').textContent).toBe('Task 1 (renamed)');
  });

  it('falls back to the empty state when the previewed task leaves the board', () => {
    const onTaskClick = vi.fn();
    const { container, rerender } = renderHorizontal(onTaskClick);
    pointerDown(getCard(container, 1));
    expect(previewedId()).toBe('1');

    rerender(
      <KanbanBoard
        tasks={tasks.slice(1)}
        onTaskClick={onTaskClick}
        viewMode="summary"
        boardLayout="horizontal"
      />,
    );
    expect(previewedId()).toBeNull();
    expect(screen.getByTestId('task-preview-empty')).toBeDefined();
  });
});

describe('KanbanBoard search reveal', () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockClear();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
  });

  it('scrolls the first match into view once per query and result, in either layout', () => {
    const matches = [makeTask(2, 2), makeTask(3, 3)];
    const { rerender } = render(
      <KanbanBoard tasks={matches} onTaskClick={vi.fn()} boardLayout="vertical" searchQuery="" />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <KanbanBoard tasks={matches} onTaskClick={vi.fn()} boardLayout="vertical" searchQuery="ta" />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const revealed = scrollIntoView.mock.instances[0] as HTMLElement;
    expect(revealed.dataset.taskId).toBe('2');
    expect(scrollIntoView.mock.calls[0]?.[0]).toMatchObject({
      block: 'nearest',
      inline: 'nearest',
    });

    // Same query, unrelated re-render: no second scroll.
    rerender(
      <KanbanBoard
        tasks={[...matches]}
        onTaskClick={vi.fn()}
        boardLayout="vertical"
        searchQuery="ta"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // Narrower query, different first match: scrolls again.
    rerender(
      <KanbanBoard
        tasks={[makeTask(3, 3)]}
        onTaskClick={vi.fn()}
        boardLayout="vertical"
        searchQuery="task 3"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect((scrollIntoView.mock.instances[1] as HTMLElement).dataset.taskId).toBe('3');
  });

  it('in the horizontal layout the match is also previewed', () => {
    render(
      <KanbanBoard
        tasks={[makeTask(4, 3, 'Pay the power bill')]}
        onTaskClick={vi.fn()}
        boardLayout="horizontal"
        searchQuery="#4"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(previewedId()).toBe('4');
    expect(screen.getByTestId('task-preview-title').textContent).toBe('Pay the power bill');
  });

  it('does nothing without a query or without a match', () => {
    const { rerender } = render(
      <KanbanBoard
        tasks={tasks}
        onTaskClick={vi.fn()}
        boardLayout="horizontal"
        searchQuery="   "
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(previewedId()).toBeNull();
    rerender(
      <KanbanBoard tasks={[]} onTaskClick={vi.fn()} boardLayout="horizontal" searchQuery="zzz" />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
