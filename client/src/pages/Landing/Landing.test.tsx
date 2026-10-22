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
  task({
    id: 3,
    title: 'Quote for the deck',
    ownerId: 2,
    stageId: 2,
    viewedAt: null,
    createdAt: new Date(),
  }),
  task({ id: 4, projectId: 2, ownerId: null }),
  task({ id: 5, stageId: 3 }),
  // A goal that is done has closed: it is not offered as a filter.
  task({ id: 6, title: 'Old launch', type: 'goal', stageId: 3 }),
];

vi.mock('@/hooks/use-tasks', () => ({
  useTasks: () => ({ data: tasks, isLoading: false, error: null }),
  useArchivedTasks: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-stages', () => ({ useStages: () => ({ data: stages }) }));
// The dialog is the board's own; here it only has to say which task it opened.
vi.mock('@/components/EditTaskDialog', () => ({
  EditTaskDialog: ({ task, open }: { task: Task | null; open: boolean }) =>
    open && task ? <div data-testid="edit-task-dialog">{task.title}</div> : null,
}));
vi.mock('@/components/TaskHistoryModal', () => ({ TaskHistoryModal: () => null }));
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
    expect(option('project-1').textContent).toContain('5');
    expect(option('project-none').textContent).toContain('No project');
    expect(option('goal-1').textContent).toContain('Launch');
    expect(option('goal-1').textContent).toContain('2');
    expect(option('owner-none').textContent).toContain('Unassigned');
    // Every stage is offered, Done included: choosing it puts it on the board.
    expect(option('stage-3').textContent).toContain('Done');
    expect(screen.queryByTestId('filter-option-goal-6')).toBeNull();
    // The rows that were retired are gone: the inbox replaces NEW TASKS.
    expect(screen.queryByTestId('filter-row-due')).toBeNull();
    expect(screen.queryByTestId('filter-row-new')).toBeNull();
  });

  it('says under each row what it is, so Project and Goal read as different things', () => {
    renderLanding();
    const hint = (row: string) => screen.getByTestId(`filter-row-hint-${row}`).textContent;
    expect(hint('project')).toBe('A body of work, like a client or a job');
    expect(hint('goal')).toBe('An outcome, with the tasks that lead to it');
    expect(hint('owner')).toBe('Who the task belongs to');
    expect(hint('stage')).toBe('Which column the task sits in');
    // The row is described by its hint for a screen reader.
    const describedBy = screen.getByTestId('filter-row-goal').getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      'An outcome, with the tasks that lead to it',
    );

    // Once a project is ticked, the Goal row says it only lists goals inside it.
    fireEvent.click(within(option('project-1')).getByRole('checkbox'));
    expect(hint('goal')).toBe(
      'Outcomes in the projects you ticked, with the tasks that lead to them',
    );
  });

  it('puts the inbox first, and a row opens its task here', () => {
    renderLanding();
    const inbox = screen.getByTestId('landing-inbox');
    expect(
      inbox.compareDocumentPosition(screen.getByTestId('filter-row-owner')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId('inbox-count').textContent).toBe('1');

    fireEvent.click(within(inbox).getByTestId('inbox-task-3'));
    expect(screen.getByTestId('edit-task-dialog').textContent).toBe('Quote for the deck');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('counts what the board will show, and narrows as boxes are ticked', () => {
    renderLanding();
    // Tasks 5 and 6 are done, so they are behind Filing rather than on the board.
    expect(showing()).toContain('Showing 4 of 6 tasks');

    fireEvent.click(within(option('owner-2')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 1 of 6');

    fireEvent.click(within(option('owner-1')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 3 of 6');

    fireEvent.click(within(option('stage-3')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 2 of 6');
  });

  it('keeps the choice for the board, and GO opens the board', () => {
    renderLanding();
    fireEvent.click(within(option('owner-2')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 1 of 6');
    expect(
      JSON.parse(window.localStorage.getItem(BOARD_FILTERS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ owners: [2] });

    fireEvent.click(screen.getByTestId('button-go'));
    expect(navigate).toHaveBeenCalledWith('/board');
  });

  it('puts one project in the header scope and keeps several here', () => {
    renderLanding();
    fireEvent.click(within(option('project-1')).getByRole('checkbox'));
    expect(setScopeSpy).toHaveBeenLastCalledWith(1);
    expect(showing()).toContain('Showing 3 of 6');

    fireEvent.click(within(option('project-2')).getByRole('checkbox'));
    expect(setScopeSpy).toHaveBeenLastCalledWith('all');
    expect(within(option('project-1')).getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(within(option('project-2')).getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(showing()).toContain('Showing 4 of 6');

    fireEvent.click(within(option('project-1')).getByRole('checkbox'));
    expect(setScopeSpy).toHaveBeenLastCalledWith(2);
    expect(showing()).toContain('Showing 1 of 6');
  });

  it('lets go of a chosen goal that has since been archived, which nothing could untick', () => {
    window.localStorage.setItem(BOARD_FILTERS_STORAGE_KEY, JSON.stringify({ goals: [1, 99] }));
    renderLanding();
    expect(within(option('goal-1')).getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    expect(
      JSON.parse(window.localStorage.getItem(BOARD_FILTERS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ goals: [1] });
    expect(showing()).toContain('Showing 2 of 6');
  });

  it('clears every row with Clear all', () => {
    renderLanding();
    const clear = screen.getByTestId('button-clear-filters');
    expect(clear.hasAttribute('disabled')).toBe(true);

    fireEvent.click(within(option('goal-1')).getByRole('checkbox'));
    expect(showing()).toContain('Showing 2 of 6');
    expect(clear.hasAttribute('disabled')).toBe(false);

    fireEvent.click(clear);
    expect(showing()).toContain('Showing 4 of 6');
    expect(within(option('goal-1')).getByRole<HTMLInputElement>('checkbox').checked).toBe(false);
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
