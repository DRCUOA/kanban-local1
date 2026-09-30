// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { ProjectSummary } from '@shared/schema';
import { ProjectScopeContext, type ProjectScopeContextValue } from '@/hooks/use-project-scope';
import { ProjectSelector } from './ProjectSelector';

const project = (overrides: Partial<ProjectSummary>): ProjectSummary => ({
  id: 1,
  name: 'Alpha',
  key: 'ALP',
  color: '#6366F1',
  archived: false,
  order: 0,
  createdAt: new Date(),
  taskCount: 0,
  ...overrides,
});

const projects = [
  project({ id: 1, name: 'Alpha', taskCount: 3 }),
  project({ id: 2, name: 'Beta', taskCount: 0 }),
  project({ id: 3, name: 'Old', archived: true, taskCount: 5 }),
];

function renderSelector(overrides: Partial<ProjectScopeContextValue> = {}) {
  const value: ProjectScopeContextValue = {
    scope: 'all',
    setScope: vi.fn(),
    projects,
    activeProjects: projects.filter((p) => !p.archived),
    currentProject: null,
    showProjectOnCards: true,
    projectById: (id) => projects.find((p) => p.id === id) ?? null,
    ...overrides,
  };
  render(
    <ProjectScopeContext.Provider value={value}>
      <ProjectSelector />
    </ProjectScopeContext.Provider>,
  );
  return value;
}

describe('ProjectSelector', () => {
  it('renders nothing until a project exists', () => {
    renderSelector({ projects: [], activeProjects: [] });
    expect(screen.queryByTestId('project-selector-trigger')).toBeNull();
  });

  it('names the current scope on the trigger', () => {
    renderSelector();
    expect(screen.getByTestId('project-selector-trigger').textContent).toContain('All projects');
  });

  it('names the scoped project, and "No project" for the unassigned scope', () => {
    renderSelector({ scope: 1, currentProject: projects[0] ?? null });
    expect(screen.getByTestId('project-selector-trigger').textContent).toContain('Alpha');
  });

  it('lists All, every active project with its task count, and No project', () => {
    renderSelector();
    fireEvent.click(screen.getByTestId('project-selector-trigger'));

    const menu = screen.getByRole('menu');
    expect(menu.textContent).toContain('All projects');
    expect(menu.textContent).toContain('Alpha');
    expect(menu.textContent).toContain('Beta');
    expect(menu.textContent).toContain('No project');
    expect(screen.getByLabelText('3 tasks')).toBeDefined();
    // Archived projects are not offered as scopes.
    expect(screen.queryByTestId('project-selector-item-3')).toBeNull();
    expect(screen.getByTestId('project-selector-item-all').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('hangs its menu from the left edge on a phone and the right edge from the tablet breakpoint', () => {
    renderSelector();
    fireEvent.click(screen.getByTestId('project-selector-trigger'));

    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('left-0');
    expect(menu.className).toContain('lg:left-auto');
    expect(menu.className).toContain('lg:right-0');
  });

  it('keeps an archived project listed while it is the current scope', () => {
    renderSelector({ scope: 3, currentProject: projects[2] ?? null });
    fireEvent.click(screen.getByTestId('project-selector-trigger'));

    expect(screen.getByTestId('project-selector-item-3').textContent).toContain('Old');
    expect(screen.getByTestId('project-selector-item-3').getAttribute('aria-checked')).toBe('true');
  });

  it('changes the scope and closes when a row is chosen', () => {
    const value = renderSelector();
    fireEvent.click(screen.getByTestId('project-selector-trigger'));
    fireEvent.click(screen.getByTestId('project-selector-item-2'));

    expect(value.setScope).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByTestId('project-selector-trigger'));
    fireEvent.click(screen.getByTestId('project-selector-item-none'));
    expect(value.setScope).toHaveBeenCalledWith('none');

    fireEvent.click(screen.getByTestId('project-selector-trigger'));
    fireEvent.click(screen.getByTestId('project-selector-item-all'));
    expect(value.setScope).toHaveBeenCalledWith('all');
  });
});
