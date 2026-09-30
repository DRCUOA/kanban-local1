// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { ProjectSummary } from '@shared/schema';
import { ProjectScopeContext, type ProjectScopeContextValue } from '@/hooks/use-project-scope';
import { DashboardHeader } from './DashboardHeader';

const project: ProjectSummary = {
  id: 1,
  name: 'Alpha',
  key: 'ALP',
  color: '#6366F1',
  archived: false,
  order: 0,
  createdAt: new Date(),
  taskCount: 3,
};

function renderWithProjects(ui: React.ReactElement, projects: ProjectSummary[]) {
  const value: ProjectScopeContextValue = {
    scope: 'all',
    setScope: vi.fn(),
    projects,
    activeProjects: projects.filter((p) => !p.archived),
    currentProject: null,
    showProjectOnCards: true,
    projectById: (id) => projects.find((p) => p.id === id) ?? null,
  };
  return render(<ProjectScopeContext.Provider value={value}>{ui}</ProjectScopeContext.Provider>);
}

describe('DashboardHeader', () => {
  const defaults = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    onClearSearch: vi.fn(),
    viewMode: 'summary' as const,
    focusMode: false,
    boardLayout: 'vertical' as const,
    onSetViewMode: vi.fn(),
    onToggleFocusMode: vi.fn(),
    onToggleBoardLayout: vi.fn(),
    onArchive: vi.fn(),
    onAdmin: vi.fn(),
    onShareBoard: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
  };

  it('renders the app title area', () => {
    render(<DashboardHeader {...defaults} />);
    expect(screen.getByRole('banner')).toBeDefined();
  });

  it('renders the search field in a search landmark; the only other buttons are the phone search toggle and More', () => {
    render(<DashboardHeader {...defaults} />);
    const input = screen.getByTestId('input-search');
    expect(screen.getByRole('search').contains(input)).toBe(true);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Search tasks',
      'More options',
    ]);
  });

  it('hosts the More menu, which the bottom bar handed over', () => {
    render(<DashboardHeader {...defaults} />);
    const more = screen.getByLabelText('More options');
    expect(screen.getByRole('banner').contains(more)).toBe(true);

    fireEvent.click(more);
    expect(screen.getByText('Detail')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
  });

  it('is one bar on a phone: logo at the start, the title centred, the icons at the end', () => {
    render(<DashboardHeader {...defaults} />);
    const bar = screen.getByTestId('app-bar');
    // Never wraps on a phone; dissolves into the wide layout from lg.
    expect(bar.className).not.toContain('flex-wrap');
    expect(bar.className).toContain('lg:contents');

    const title = screen.getByRole('heading', { level: 1 });
    expect(title.parentElement?.className).toContain('text-center');
    expect(title.parentElement?.className).toContain('lg:text-left');

    // The leading and trailing groups share the leftover width equally, which
    // is what keeps the title centred between them.
    const actions = screen.getByTestId('app-bar-actions');
    expect(actions.className).toContain('flex-1');
    expect(actions.className).toContain('basis-0');
    expect(actions.className).toContain('justify-end');
    expect(actions.contains(screen.getByTestId('button-search-toggle'))).toBe(true);
    expect(actions.contains(screen.getByLabelText('More options'))).toBe(true);
    expect(bar.firstElementChild?.className).toContain('flex-1');
    expect(bar.firstElementChild?.className).toContain('basis-0');
  });

  it('on a phone the app name gives way to the project selector once a project exists', () => {
    const { unmount } = render(<DashboardHeader {...defaults} />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.parentElement?.className).not.toContain('sr-only');
    // The tagline is a wide-screen extra whatever the project situation.
    expect(title.nextElementSibling?.className).toContain('hidden');
    expect(title.nextElementSibling?.className).toContain('lg:block');
    unmount();

    renderWithProjects(<DashboardHeader {...defaults} />, [project]);
    const scopedTitle = screen.getByRole('heading', { level: 1 });
    // Kept for screen readers, visible again from the tablet breakpoint.
    expect(scopedTitle.parentElement?.className).toContain('sr-only');
    expect(scopedTitle.parentElement?.className).toContain('lg:not-sr-only');
    expect(screen.getByTestId('project-selector-trigger').textContent).toContain('All projects');
  });

  it('on a phone the search field is collapsed until its toggle opens it, which focuses the field', () => {
    render(<DashboardHeader {...defaults} />);
    const field = screen.getByRole('search');
    const toggle = screen.getByTestId('button-search-toggle');
    // Off screen on a phone, in the header row from lg up — where the toggle
    // itself is gone.
    expect(field.className).toContain('hidden');
    expect(field.className).toContain('lg:block');
    expect(toggle.className).toContain('lg:hidden');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(field.id);
    expect(screen.queryByTestId('button-clear-search')).toBeNull();

    fireEvent.click(toggle);
    expect(field.className).not.toContain('hidden');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByTestId('input-search'));
    // An empty open field offers a way out.
    expect(screen.getByLabelText('Close search')).toBeDefined();
  });

  it('the ✕ closes an empty open field', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} onClearSearch={onClearSearch} />);
    fireEvent.click(screen.getByTestId('button-search-toggle'));
    fireEvent.click(screen.getByLabelText('Close search'));

    expect(screen.getByRole('search').className).toContain('hidden');
    expect(screen.queryByTestId('button-clear-search')).toBeNull();
    expect(onClearSearch).not.toHaveBeenCalled();
  });

  it('keeps the field open while a query is active, and closing it from the toggle clears the query', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} searchQuery="solar" onClearSearch={onClearSearch} />);
    const toggle = screen.getByTestId('button-search-toggle');
    expect(screen.getByRole('search').className).not.toContain('hidden');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it('calls onSearchChange when typing in the search input', () => {
    const onSearchChange = vi.fn();
    render(<DashboardHeader {...defaults} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByTestId('input-search'), { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows a clear button only while there is a query, and it clears', () => {
    const onClearSearch = vi.fn();
    const { rerender } = render(<DashboardHeader {...defaults} onClearSearch={onClearSearch} />);
    expect(screen.queryByTestId('button-clear-search')).toBeNull();

    rerender(<DashboardHeader {...defaults} searchQuery="solar" onClearSearch={onClearSearch} />);
    expect(screen.getByLabelText('Clear search')).toBeDefined();
    fireEvent.click(screen.getByTestId('button-clear-search'));
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it('Escape in the field clears a query', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} searchQuery="solar" onClearSearch={onClearSearch} />);
    fireEvent.keyDown(screen.getByTestId('input-search'), { key: 'Escape' });
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it('Escape does nothing when the field is already empty', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} onClearSearch={onClearSearch} />);
    fireEvent.keyDown(screen.getByTestId('input-search'), { key: 'Escape' });
    expect(onClearSearch).not.toHaveBeenCalled();
  });

  it('Escape in an empty open field closes it without a clear', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} onClearSearch={onClearSearch} />);
    fireEvent.click(screen.getByTestId('button-search-toggle'));
    expect(screen.getByRole('search').className).not.toContain('hidden');

    fireEvent.keyDown(screen.getByTestId('input-search'), { key: 'Escape' });
    expect(screen.getByRole('search').className).toContain('hidden');
    expect(onClearSearch).not.toHaveBeenCalled();
  });
});
