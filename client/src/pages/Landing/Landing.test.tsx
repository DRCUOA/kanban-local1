// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import type { ProjectSummary, Stage, Task } from '@shared/schema';
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
    effort: null,
    dueDate: null,
    viewedAt: new Date(),
    ...overrides,
  }) as Task;

const tasks: Task[] = [
  task({ id: 1, title: 'Launch', type: 'goal' }),
  task({ id: 2, title: 'Print flyers', goalTaskId: 1, effort: 3 }),
  task({
    id: 3,
    title: 'Quote for the deck',
    ownerId: 2,
    stageId: 2,
    viewedAt: null,
    createdAt: new Date(),
  }),
  task({ id: 4, title: 'Pack the kitchen', projectId: 2, ownerId: null }),
  task({ id: 5, stageId: 3 }),
  // A goal that is done has closed: it is not offered.
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

const projects = [
  { id: 1, name: 'WasteCo', key: null, color: '#2F5D3A', archived: false },
  { id: 2, name: 'Moving House', key: 'MOVE', color: null, archived: false },
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
const stone = (id: string) => screen.getByTestId(`stone-${id}`);
const pick = (id: string) => {
  fireEvent.click(stone(id));
};
const go = () => {
  fireEvent.click(screen.getByTestId('button-go'));
};
const stage = () => screen.getByTestId('stage-route').getAttribute('data-stage');
const stored = (): unknown =>
  JSON.parse(window.localStorage.getItem(BOARD_FILTERS_STORAGE_KEY) ?? '{}');

describe('Landing: the filter wizard', () => {
  beforeEach(() => {
    window.localStorage.removeItem(BOARD_FILTERS_STORAGE_KEY);
    navigate.mockClear();
    setScopeSpy.mockClear();
  });

  it('starts on Projects, a stone each, counting their open goals and tasks apart', () => {
    renderLanding();
    expect(stage()).toBe('projects');
    expect(stone('project-1').textContent).toContain('WasteCo');
    expect(stone('project-1').textContent).toContain('1 open goal, 2 open tasks');
    expect(stone('project-2').textContent).toContain('0 open goals, 1 open task');
    // Nothing open sits outside a project, so "No project" is not offered.
    expect(screen.queryByTestId('stone-project-none')).toBeNull();
    // Nothing picked is "All".
    expect(screen.getByTestId('wizard-all-projects').getAttribute('aria-pressed')).toBe('true');
  });

  it('GO walks the stages, each offering only what the stage before it left', () => {
    renderLanding();
    pick('project-1');
    expect(stone('project-1').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('wizard-all-projects').getAttribute('aria-pressed')).toBe('false');

    go();
    expect(stage()).toBe('goals');
    expect(stone('goal-1').textContent).toContain('Launch');
    // Closed goals are not offered.
    expect(screen.queryByTestId('stone-goal-6')).toBeNull();

    pick('goal-1');
    go();
    expect(stage()).toBe('tasks');
    // Under the goal only: the task in another column of WasteCo is not.
    expect(within(screen.getByTestId('stone-strip')).getAllByRole('button')).toHaveLength(1);
    expect(stone('task-2').textContent).toContain('Print flyers');

    pick('task-2');
    expect(screen.getByTestId('next-board').textContent).toContain('1 task');
    go();
    expect(navigate).toHaveBeenCalledWith('/board');
  });

  it('flanks GO with the stages not on screen, the earlier on the left, and jumps straight there', () => {
    renderLanding();
    const jumps = () =>
      within(screen.getByRole('navigation', { name: 'Wizard stages' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('data-testid'));
    expect(jumps()).toEqual(['wizard-jump-goals', 'button-go', 'wizard-jump-tasks']);

    // Past Goals with none picked: Tasks offers every open task.
    fireEvent.click(screen.getByTestId('wizard-jump-tasks'));
    expect(stage()).toBe('tasks');
    expect(jumps()).toEqual(['wizard-jump-projects', 'button-go', 'wizard-jump-goals']);
    expect(within(screen.getByTestId('stone-strip')).getAllByRole('button')).toHaveLength(3);

    fireEvent.click(screen.getByTestId('wizard-jump-goals'));
    expect(stage()).toBe('goals');
    expect(jumps()).toEqual(['wizard-jump-projects', 'button-go', 'wizard-jump-tasks']);
  });

  it('counts what the board will show, and narrows as stones are picked', () => {
    renderLanding();
    // Tasks 5 and 6 are done, so they are behind Filing rather than on the board.
    expect(showing()).toContain('Showing 4 of 6 tasks');
    pick('project-1');
    expect(showing()).toContain('Showing 3 of 6');
    go();
    pick('goal-1');
    expect(showing()).toContain('Showing 2 of 6');
    go();
    pick('task-2');
    expect(showing()).toContain('Showing 1 of 6');
    expect(stored()).toMatchObject({ goals: [1], tasks: [2] });
  });

  it('puts one project in the header scope and keeps several here', () => {
    renderLanding();
    pick('project-1');
    expect(setScopeSpy).toHaveBeenLastCalledWith(1);
    pick('project-2');
    expect(setScopeSpy).toHaveBeenLastCalledWith('all');
    expect(stored()).toMatchObject({ projects: [1, 2] });
    pick('project-1');
    expect(setScopeSpy).toHaveBeenLastCalledWith(2);
  });

  it('lets go of the goals and tasks inside a project when it is unpicked', () => {
    renderLanding();
    pick('project-1');
    go();
    pick('goal-1');
    go();
    pick('task-2');
    fireEvent.click(screen.getByTestId('wizard-jump-projects'));
    pick('project-1');
    pick('project-2');
    expect(stored()).toMatchObject({ goals: [], tasks: [] });
    expect(showing()).toContain('Showing 1 of 6');
  });

  it('All lets go of what a stage picked', () => {
    renderLanding();
    fireEvent.click(screen.getByTestId('wizard-jump-goals'));
    pick('goal-1');
    expect(showing()).toContain('Showing 2 of 6');
    fireEvent.click(screen.getByTestId('wizard-all-goals'));
    expect(stone('goal-1').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('wizard-all-goals').getAttribute('aria-pressed')).toBe('true');
    expect(showing()).toContain('Showing 4 of 6');
  });

  it('lets go of picks nothing could untick: an archived goal and the retired owner and stage rows', () => {
    window.localStorage.setItem(
      BOARD_FILTERS_STORAGE_KEY,
      JSON.stringify({ goals: [1, 99], tasks: [2, 98], owners: [2], stages: [3] }),
    );
    renderLanding();
    expect(stored()).toMatchObject({ goals: [1], tasks: [2], owners: [], stages: [] });
    expect(showing()).toContain('Showing 1 of 6');
  });

  it('says under each stage what its things are, so a project and a goal never read alike', () => {
    renderLanding();
    const hint = () => screen.getByTestId(`wizard-hint-${stage() ?? ''}`).textContent;
    expect(hint()).toBe('A body of work, like a client or a job');
    // The strip is described by the same line for a screen reader.
    const strip = screen.getByTestId('stone-strip');
    const describedBy = strip.getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      'A body of work, like a client or a job',
    );

    go();
    expect(hint()).toBe('An outcome, with the tasks that lead to it');
    // With a project picked, Goals only lists goals inside it, and says so.
    fireEvent.click(screen.getByTestId('wizard-jump-projects'));
    pick('project-1');
    go();
    expect(hint()).toBe('Outcomes in the projects you picked, with the tasks that lead to them');
    go();
    expect(hint()).toBe('The work itself, each one a card on the board');
  });

  it('keeps the inbox behind the header button, and a row opens its task here', () => {
    renderLanding();
    expect(screen.getByTestId('inbox-badge').textContent).toBe('1');
    expect(screen.queryByTestId('landing-inbox')).toBeNull();

    fireEvent.click(screen.getByTestId('button-inbox'));
    fireEvent.click(within(screen.getByTestId('landing-inbox')).getByTestId('inbox-task-3'));
    expect(screen.getByTestId('edit-task-dialog').textContent).toBe('Quote for the deck');
    expect(navigate).not.toHaveBeenCalled();
  });
});
