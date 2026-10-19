// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardBottomNav } from './DashboardBottomNav';

vi.mock('@/components/CreateTaskDialog', () => ({
  CreateTaskDialog: ({ iconOnly }: { iconOnly?: boolean }) =>
    React.createElement('button', { 'data-testid': 'create-task-stub' }, iconOnly ? '+' : 'New'),
}));

const navigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/', navigate],
}));

vi.mock('@/hooks/use-stages', () => ({
  useStages: () => ({
    data: [
      { id: 1, name: 'To Do', order: 1, kind: 'backlog', color: null, createdAt: new Date() },
      { id: 2, name: 'Done  ✔', order: 2, kind: 'done', color: null, createdAt: new Date() },
    ],
  }),
}));

describe('DashboardBottomNav', () => {
  it('renders exactly the three task destinations: Filing, Add, Bin', () => {
    render(<DashboardBottomNav />);

    expect(screen.getByTestId('nav-filing')).toBeDefined();
    expect(screen.getByTestId('create-task-stub')).toBeDefined();
    expect(screen.getByTestId('nav-bin')).toBeDefined();
    // The view toggles moved to the header's More menu.
    expect(screen.queryByText('Detail')).toBeNull();
    expect(screen.queryByText('Summary')).toBeNull();
    expect(screen.queryByText('Focus')).toBeNull();
    expect(screen.queryByText('More')).toBeNull();
  });

  it('opens the filing menu with a row per done stage plus Archive', () => {
    render(<DashboardBottomNav />);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByTestId('nav-filing'));

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Done  ✔', 'Archive']);
  });

  it('navigates to the archive and closes the menu when Archive is tapped', () => {
    navigate.mockClear();
    render(<DashboardBottomNav />);

    fireEvent.click(screen.getByTestId('nav-filing'));
    fireEvent.click(screen.getByText('Archive'));

    expect(navigate).toHaveBeenCalledWith('/archive');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('navigates to the bin', () => {
    navigate.mockClear();
    render(<DashboardBottomNav />);

    fireEvent.click(screen.getByTestId('nav-bin'));

    expect(navigate).toHaveBeenCalledWith('/bin');
  });

  describe('on a phone, Goals and More sit in the bar as well', () => {
    const moreActions = {
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

    it('orders them Filing, Goals, Add, More, Bin, and hides the two from lg', () => {
      render(<DashboardBottomNav goalsHref="/projects/1" moreActions={moreActions} />);

      const goals = screen.getByTestId('nav-goals');
      const more = screen.getByTestId('nav-more');
      expect(goals.className).toContain('lg:hidden');
      expect(more.className).toContain('lg:hidden');

      const follows = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const add = screen.getByTestId('create-task-stub');
      expect(follows(screen.getByTestId('nav-filing'), goals)).toBe(true);
      expect(follows(goals, add)).toBe(true);
      expect(follows(add, more)).toBe(true);
      expect(follows(more, screen.getByTestId('nav-bin'))).toBe(true);
      // Labelled like its neighbours, not a bare icon.
      expect(screen.getByText('More')).toBeDefined();
      expect(screen.getByText('Goals')).toBeDefined();
    });

    it('Goals opens the project goals view', () => {
      navigate.mockClear();
      render(<DashboardBottomNav goalsHref="/projects/1" moreActions={moreActions} />);

      fireEvent.click(screen.getByTestId('nav-goals'));
      expect(navigate).toHaveBeenCalledWith('/projects/1');
    });

    it('More opens the same menu the header has on wide screens', () => {
      render(<DashboardBottomNav moreActions={moreActions} />);
      expect(screen.queryByText('Detail')).toBeNull();

      fireEvent.click(screen.getByLabelText('More options'));
      expect(screen.getByText('Detail')).toBeDefined();
      expect(screen.getByText('Admin')).toBeDefined();
    });

    it('offers no Goals button for "All projects"', () => {
      render(<DashboardBottomNav goalsHref={null} moreActions={moreActions} />);
      expect(screen.queryByTestId('nav-goals')).toBeNull();
    });

    it('keeps one row on the smallest phones, spread evenly about the centre', () => {
      render(<DashboardBottomNav goalsHref="/projects/1" moreActions={moreActions} />);
      const row = screen.getByTestId('nav-filing').parentElement?.parentElement;
      expect(row?.className).toContain('flex-nowrap');
      expect(row?.className).toContain('justify-evenly');
      // Five of these plus Add fit 320px; they widen with the screen.
      for (const id of ['nav-filing', 'nav-goals', 'nav-bin']) {
        expect(screen.getByTestId(id).className).toContain('min-w-[3.5rem]');
        expect(screen.getByTestId(id).className).toContain('lg:min-w-[4.25rem]');
      }
      expect(screen.getByTestId('button-more-options').className).toContain('min-w-[3.5rem]');
    });
  });
});
