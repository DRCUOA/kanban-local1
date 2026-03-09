// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardBottomNav } from './DashboardBottomNav';

vi.mock('@/components/CreateTaskDialog', () => ({
  CreateTaskDialog: ({ iconOnly }: { iconOnly?: boolean }) =>
    React.createElement('button', { 'data-testid': 'create-task-stub' }, iconOnly ? '+' : 'New'),
}));

vi.mock('./MoreActionsMenu', () => ({
  MoreActionsMenu: (props: Record<string, () => void>) =>
    React.createElement(
      'button',
      {
        'data-testid': 'more-actions-stub',
        onClick: props.onAdmin,
      },
      'More',
    ),
}));

describe('DashboardBottomNav', () => {
  const defaults = {
    viewMode: 'detail' as const,
    focusMode: false,
    onSetViewMode: vi.fn(),
    onToggleFocusMode: vi.fn(),
    onArchive: vi.fn(),
    onAdmin: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
  };

  it('renders Detail, Summary, Focus buttons and sub-components', () => {
    render(<DashboardBottomNav {...defaults} />);

    expect(screen.getByText('Detail')).toBeDefined();
    expect(screen.getByText('Summary')).toBeDefined();
    expect(screen.getByText('Focus')).toBeDefined();
    expect(screen.getByTestId('create-task-stub')).toBeDefined();
    expect(screen.getByTestId('more-actions-stub')).toBeDefined();
  });

  it('calls onSetViewMode("detail") when Detail is clicked', () => {
    const onSetViewMode = vi.fn();
    render(<DashboardBottomNav {...defaults} onSetViewMode={onSetViewMode} />);

    fireEvent.click(screen.getByText('Detail'));
    expect(onSetViewMode).toHaveBeenCalledWith('detail');
  });

  it('calls onSetViewMode("summary") when Summary is clicked', () => {
    const onSetViewMode = vi.fn();
    render(<DashboardBottomNav {...defaults} onSetViewMode={onSetViewMode} />);

    fireEvent.click(screen.getByText('Summary'));
    expect(onSetViewMode).toHaveBeenCalledWith('summary');
  });

  it('calls onToggleFocusMode when Focus is clicked', () => {
    const onToggleFocusMode = vi.fn();
    render(<DashboardBottomNav {...defaults} onToggleFocusMode={onToggleFocusMode} />);

    fireEvent.click(screen.getByText('Focus'));
    expect(onToggleFocusMode).toHaveBeenCalledOnce();
  });
});
