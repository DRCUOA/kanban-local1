// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import type { ProjectSummary, Task } from '@shared/schema';
import { ProjectScopeContext, type ProjectScopeContextValue } from '@/hooks/use-project-scope';
import ProjectView from './ProjectView';

// What the URL says; each test sets it before rendering.
let routeProjectId: string | undefined;
const navigate = vi.fn();
vi.mock('wouter', () => ({
  useRoute: () => [routeProjectId !== undefined, { projectId: routeProjectId }],
  useLocation: () => ['/projects/all', navigate],
}));

// Records the scope the page asks the server for.
const useTasks = vi.fn();
vi.mock('@/hooks/use-tasks', () => ({
  useTasks: (scope: unknown) => useTasks(scope) as unknown,
  useTaskDependencies: () => ({ data: [] }),
}));

vi.mock('@/hooks/use-stages', () => ({
  useStages: () => ({
    data: [
      { id: 1, name: 'Backlog', order: 0, kind: 'backlog', color: null, createdAt: new Date() },
    ],
  }),
}));

const project = (id: number, name: string, key: string | null): ProjectSummary => ({
  id,
  name,
  key,
  color: '#6366F1',
  archived: false,
  order: id,
  createdAt: new Date(),
  taskCount: 1,
});
const projects = [project(7, 'Shed', 'SHED'), project(8, 'Garden', null)];

const task = (o: Partial<Task>): Task =>
  ({
    id: 1,
    title: 't',
    stageId: 1,
    archived: false,
    deletedAt: null,
    projectId: null,
    type: null,
    goalTaskId: null,
    effort: null,
    dueDate: null,
    ...o,
  }) as Task;

const tasks: Task[] = [
  task({ id: 100, title: 'Build a shed', type: 'goal', projectId: 7 }),
  task({ id: 101, title: 'Plant the beds', type: 'goal', projectId: 8 }),
  task({ id: 102, title: 'Tidy the garage', type: 'goal' }),
  task({ id: 200, title: 'Buy timber', type: 'building-block', projectId: 7, goalTaskId: 100 }),
  task({ id: 201, title: 'Find a saw', type: 'building-block', projectId: 7 }),
  task({ id: 202, title: 'Sort the boxes', type: 'building-block' }),
];

function renderAt(projectId: string) {
  routeProjectId = projectId;
  useTasks.mockReturnValue({ data: tasks, isLoading: false, error: null });
  const value: ProjectScopeContextValue = {
    scope: 'all',
    setScope: vi.fn(),
    projects,
    activeProjects: projects,
    currentProject: null,
    showProjectOnCards: true,
    projectById: (id) => projects.find((p) => p.id === id) ?? null,
  };
  return render(
    <ProjectScopeContext.Provider value={value}>
      <ProjectView />
    </ProjectScopeContext.Provider>,
  );
}

describe('ProjectView', () => {
  beforeEach(() => {
    cleanup();
    navigate.mockClear();
    useTasks.mockClear();
  });

  it('at /projects/all lists every project’s goals together, each card naming its project', () => {
    renderAt('all');
    expect(useTasks).toHaveBeenLastCalledWith('all');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('All projects');
    expect(screen.getByText('Goals · 3 goals')).toBeDefined();

    for (const id of [100, 101, 102]) expect(screen.getByTestId(`goal-card-${id}`)).toBeDefined();
    // The key where the project has one, the name otherwise; nothing for a goal with no project.
    expect(screen.getByTestId('goal-project-100').textContent).toBe('SHED');
    expect(screen.getByTestId('goal-project-101').textContent).toBe('Garden');
    expect(screen.queryByTestId('goal-project-102')).toBeNull();
    // Both loose blocks, from different scopes, and no "in this project".
    expect(screen.getByTestId('loose-blocks').textContent).toBe(
      '2 building-blocks have no goal yet.',
    );
  });

  it('under one project the header names it, so the cards do not', () => {
    renderAt('7');
    expect(useTasks).toHaveBeenLastCalledWith(7);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shed');
    expect(screen.getByTestId('goal-card-100')).toBeDefined();
    expect(screen.queryByTestId('goal-card-101')).toBeNull();
    expect(screen.queryByTestId('goal-project-100')).toBeNull();
    expect(screen.getByTestId('loose-blocks').textContent).toBe(
      '1 building-block in this project has no goal yet.',
    );
  });

  it('"none" is the goals with no project', () => {
    renderAt('none');
    expect(useTasks).toHaveBeenLastCalledWith('none');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('No project');
    expect(screen.getByTestId('goal-card-102')).toBeDefined();
    expect(screen.queryByTestId('goal-card-100')).toBeNull();
  });

  it('a goal card opens that goal', () => {
    renderAt('all');
    fireEvent.click(screen.getByTestId('goal-card-101'));
    expect(navigate).toHaveBeenCalledWith('/goals/101');
  });

  it('anything else in the URL is not a project', () => {
    renderAt('shed');
    expect(screen.getByText('Project not found')).toBeDefined();
  });
});
