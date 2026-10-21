// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import type { OwnerSummary, ProjectSummary, Stage, Task } from '@shared/schema';
import { ProjectScopeContext, type ProjectScopeContextValue } from '@/hooks/use-project-scope';
import { BoardFiltersProvider, BOARD_FILTERS_STORAGE_KEY } from '@/hooks/use-board-filters';
import Landing from './index';

const navigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/', navigate],
}));

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 1, kind: 'backlog', color: null, createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 2, kind: 'in_progress', color: null, createdAt: new Date() },
  { id: 3, name: 'Done', order: 3, kind: 'done', color: null, createdAt: new Date() },
] as Stage[];

const task = (overrides: Partial<Task>): Task =>
  ({
    id: 1,
    title: 'Task',
    stageId: 1,
    archived: false,
    projectId: 1,
    ownerId: 1,
    goalTaskId: null,
    type: null,
    dueDate: null,
    viewedAt: new Date(),
    ...overrides,
  }) as Task;

const tasks: Task[] = [
  task({ id: 1, title: 'Launch', type: 'goal' }),
  task({ id: 2, goalTaskId: 1 }),
  task({ id: 3, ownerId: 2, stageId: 2, viewedAt: null }),
  task({ id: 4, projectId: 2, ownerId: null }),
  task({ id: 5, stageId: 3 }),
];

vi.mock('@/hooks/use-tasks', () => ({
  useTasks: () => ({ data: tasks, isLoading: false, error: null }),
  useArchivedTasks: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-stages', () => ({ useStages: () => ({ data: stages }) }));
vi.mock('@/hooks/use-owners', () => ({
  useOwners: () => ({
    data: [
      { id: 1, name: 'Rich', color: null, archived: false },
      { id: 2, name: 'Moi', color: null, archived: false },
    ] as OwnerSummary[],
  }),
}));

const projects = [
  { id: 1, name: 'WasteCo', color: null, archived: false },
  { id: 2, name: 'Moving House', color: null, archived: false },
] as ProjectSummary[];

const setScopeSpy = vi.fn();

/** A project scope that holds its value, as the real provider does. */
function ScopeStub({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = React.useState<ProjectScopeContextValue['scope']>('all');
  const value: ProjectScopeContextValue = {
    scope,
    setScope: (next) => {
      setScopeSpy(next);
      setScope(next);
    },
    projects,
    activeProjects: projects,
    currentProject:
      typeof scope === 'number' ? (projects.find((p) => p.id === scope) ?? null) : null,
    showProjectOnCards: scope === 'all',
    projectById: (id) => projects.find((p) => p.id === id) ?? null,
  };
  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>;
}

function renderLanding() {
  render(
    <ScopeStub>
      <BoardFiltersProvider>
        <Landing />
      </BoardFiltersProvider>
    </ScopeStub>,
  );
}

const showing = () => screen.getByTestId('landing-showing').textContent;
const option = (id: string) => screen.getByTestId(`filter-option-${id}`);

describe('Landing', () => {
  beforeEach(() => {
    window.localStorage.removeItem(BOARD_FILTERS_STORAGE_KEY);
    navigate.mockClear();
    setScopeSpy.mockClear();
  });

  it('offers each row from the board, counted across the whole board', () => {
    renderLanding();
    expect(option('project-1').textContent).toContain('WasteCo');
    expect(option('project-1').textContent).toContain('4');
    expect(option('project-none').textContent).toContain('No project');
    expect(option('goal-1').textContent).toContain('Launch');
    expect(option('goal-1').textContent).toContain('2');
    expect(option('owner-none').textContent).toContain('Unassigned');
    // Every stage is offered, Done included: choosing it puts it on the board.
    expect(option('stage-3').textContent).toContain('Done');
    expect(screen.getByTestId('new-count').textContent).toBe('1');
  });

  it('counts what the board will show, and narrows as boxes are ticked', () => {
    renderLanding();
    // Task 5 is done, so it is behind Filing rather than on the board.
    expect(showing()).toContain('Showing 4 of 5 tasks');

    fireEvent.click(within(option('owner-2')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 1 of 5');

    fireEvent.click(within(option('owner-1')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 3 of 5');

    fireEvent.click(within(option('stage-3')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 1 of 5');
  });

  it('keeps the choice for the board, and GO opens the board', () => {
    renderLanding();
    fireEvent.click(within(option('new')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 1 of 5');
    expect(
      JSON.parse(window.localStorage.getItem(BOARD_FILTERS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ onlyNew: true });

    fireEvent.click(screen.getByTestId('button-go'));
    expect(navigate).toHaveBeenCalledWith('/board');
  });

  it('puts one project in the header scope and keeps several here', () => {
    renderLanding();
    fireEvent.click(within(option('project-1')).getByRole('checkbox'));
    expect(setScopeSpy).toHaveBeenLastCalledWith(1);
    expect(showing()).toContain('Showing 3 of 5');

    fireEvent.click(within(option('project-2')).getByRole('checkbox'));
    expect(setScopeSpy).toHaveBeenLastCalledWith('all');
    expect(within(option('project-1')).getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(within(option('project-2')).getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(showing()).toContain('Showing 4 of 5');

    fireEvent.click(within(option('project-1')).getByRole('checkbox'));
    expect(setScopeSpy).toHaveBeenLastCalledWith(2);
    expect(showing()).toContain('Showing 1 of 5');
  });

  it('defaults a due-by mode to today and clears everything with Clear all', () => {
    renderLanding();
    const clear = screen.getByTestId('button-clear-filters');
    expect(clear.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('button-due-date').hasAttribute('disabled')).toBe(true);

    fireEvent.click(within(option('due-open')).getByRole('radio'));
    expect(screen.getByTestId('button-due-date').hasAttribute('disabled')).toBe(false);
    // Nothing undated is due by today.
    expect(showing()).toContain('Showing 0 of 5');

    fireEvent.click(clear);
    expect(showing()).toContain('Showing 4 of 5');
    expect(within(option('due-any')).getByRole<HTMLInputElement>('radio').checked).toBe(true);
  });

  it('on a phone, a row opens and closes and names what it has chosen', () => {
    renderLanding();
    const toggle = screen.getByTestId('filter-row-toggle-owner');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(option('owner-1')).getByRole('checkbox'));
    expect(toggle.textContent).toContain('Rich');
  });
});
