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
      { id: 1, name: 'To Do', order: 1, color: null, createdAt: new Date() },
      { id: 2, name: 'Done  ✔', order: 2, color: null, createdAt: new Date() },
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
});
