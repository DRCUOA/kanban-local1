// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import type { Project, Stage, Task } from '@shared/schema';
import { DaySheet } from './DaySheet';
import { formatDaySheetDate, formatDaySheetPrinted, usePrintDaySheet } from './use-print-day-sheet';

const project: Project = {
  id: 4,
  name: 'Business Setup',
  key: 'TK',
  color: null,
  archived: false,
  order: 0,
  createdAt: null,
};
const projectById = (id: number | null | undefined) => (id === 4 ? project : null);

const task = (overrides: Partial<Task> & Pick<Task, 'id'>): Task =>
  ({
    title: `Task ${overrides.id}`,
    stageId: 1,
    archived: false,
    deletedAt: null,
    priority: 'normal',
    dueDate: null,
    tags: null,
    ownerId: null,
    projectId: null,
    ...overrides,
  }) as Task;

const STAGES: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, kind: 'backlog', color: null, createdAt: null },
  { id: 2, name: 'In Progress', order: 2, kind: 'in_progress', color: null, createdAt: null },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DaySheet', () => {
  it('prints a tick line with the priority mark, task number and project key', () => {
    render(
      <DaySheet
        groups={[
          {
            section: 'now',
            label: 'Do now',
            tasks: [task({ id: 412, title: 'Send the quote', priority: 'critical', projectId: 4 })],
          },
          { section: 'next', label: 'Next', tasks: [task({ id: 7, title: 'Plain one' })] },
          { section: 'later', label: 'Later', tasks: [] },
        ]}
        dateLabel="Friday 6 November 2026"
        scopeLabel="owner Rich"
        printedLabel="6 Nov 2026 at 9:14 am"
        projectById={projectById}
        sizePt={12}
      />,
    );

    const line = screen.getByTestId('day-sheet-line-412');
    expect(line.textContent).toBe('Send the quoteCritical#412TK');
    // Normal priority has no mark, as on the cards.
    expect(screen.getByTestId('day-sheet-line-7').textContent).toBe('Plain one#7');
    expect(screen.getByTestId('day-sheet-section-later').textContent).toContain('Nothing here.');
    expect(screen.getByTestId('day-sheet-scope').textContent).toBe('Showing owner Rich.');
    expect(screen.getByText('Printed 6 Nov 2026 at 9:14 am. 2 tasks.')).toBeDefined();
  });

  it('says how many more are on the board when a section is cut', () => {
    render(
      <DaySheet
        groups={[
          {
            section: 'now',
            label: 'Do now',
            tasks: [task({ id: 1 }), task({ id: 2 }), task({ id: 3 })],
          },
          { section: 'next', label: 'Next', tasks: [] },
          { section: 'later', label: 'Later', tasks: [] },
        ]}
        shown={[1, 0, 0]}
        dateLabel=""
        scopeLabel={null}
        printedLabel=""
        projectById={projectById}
        sizePt={10}
      />,
    );
    expect(screen.queryByTestId('day-sheet-line-2')).toBeNull();
    expect(screen.getByTestId('day-sheet-more-now').textContent).toBe('+ 2 more on the board');
    // The heading still counts every task in the section.
    expect(
      screen.getByTestId('day-sheet-section-now').querySelector('.ds-count')?.textContent,
    ).toBe('3');
    expect(screen.getByTestId('day-sheet-scope').textContent).toBe(
      'Showing everything on the board.',
    );
  });
});

function PrintButton({ tasks }: { tasks: Task[] }) {
  const { printDaySheet, daySheetPortal } = usePrintDaySheet({
    tasks,
    columnStages: STAGES,
    stages: STAGES,
    subStages: [],
    scopeLabel: null,
    projectById,
  });
  return (
    <>
      <button onClick={printDaySheet}>Print day sheet</button>
      {daySheetPortal}
    </>
  );
}

describe('usePrintDaySheet', () => {
  it('opens the print dialog once per click, then takes the sheet away', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    render(<PrintButton tasks={[task({ id: 1, stageId: 2 }), task({ id: 2 })]} />);
    act(() => {
      fireEvent.click(screen.getByText('Print day sheet'));
    });

    expect(print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('day-sheet-printing')).toBe(true);
    const host = screen.getByTestId('day-sheet-host');
    expect(host.parentElement).toBe(document.body);
    expect(host.querySelector('style')?.textContent).toContain('size: A4 portrait');
    expect(screen.getByTestId('day-sheet-section-now').textContent).toContain('Task 1');
    expect(screen.getByTestId('day-sheet-section-next').textContent).toContain('Task 2');

    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(screen.queryByTestId('day-sheet-host')).toBeNull();
    expect(document.documentElement.classList.contains('day-sheet-printing')).toBe(false);
  });
});

describe('day sheet dates', () => {
  // 9:14 am on Friday 6 Nov 2026 in Auckland (NZDT).
  const now = new Date('2026-11-05T20:14:00.000Z');

  it('dates the sheet by the board’s day, not the host’s', () => {
    expect(formatDaySheetDate(now)).toBe('Friday 6 November 2026');
  });

  it('stamps the time it was printed', () => {
    expect(formatDaySheetPrinted(now)).toBe('6 Nov 2026 at 9:14 am');
  });
});
