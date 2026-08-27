// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MoreActionsMenu } from './MoreActionsMenu';

describe('MoreActionsMenu', () => {
  const defaults = {
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

  const openMenu = () => {
    fireEvent.click(screen.getByLabelText('More options'));
  };

  it('renders the "More" toggle button', () => {
    render(<MoreActionsMenu {...defaults} />);
    expect(screen.getByLabelText('More options')).toBeDefined();
  });

  it('does not show menu items initially', () => {
    render(<MoreActionsMenu {...defaults} />);
    expect(screen.queryByText('Archive')).toBeNull();
    expect(screen.queryByText('Admin')).toBeNull();
  });

  it('shows menu items after clicking the toggle', () => {
    render(<MoreActionsMenu {...defaults} />);

    openMenu();

    expect(screen.getByText('Archive')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Share Board')).toBeDefined();
    expect(screen.getByText('Export Tasks')).toBeDefined();
    expect(screen.getByText('Import Tasks')).toBeDefined();
  });

  it('carries the view toggles the bottom bar gave up', () => {
    render(<MoreActionsMenu {...defaults} />);

    openMenu();

    expect(screen.getByText('Detail')).toBeDefined();
    expect(screen.getByText('Summary')).toBeDefined();
    expect(screen.getByText('Focus')).toBeDefined();
    // Vertical board: the toggle offers the other layout.
    expect(screen.getByText('Horiz')).toBeDefined();
    // The active view mode reads as pressed.
    expect(screen.getByText('Summary').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Detail').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the menu open while view toggles are used', () => {
    const onSetViewMode = vi.fn();
    const onToggleFocusMode = vi.fn();
    const onToggleBoardLayout = vi.fn();
    render(
      <MoreActionsMenu
        {...defaults}
        onSetViewMode={onSetViewMode}
        onToggleFocusMode={onToggleFocusMode}
        onToggleBoardLayout={onToggleBoardLayout}
      />,
    );

    openMenu();
    fireEvent.click(screen.getByText('Detail'));
    fireEvent.click(screen.getByText('Focus'));
    fireEvent.click(screen.getByText('Horiz'));

    expect(onSetViewMode).toHaveBeenCalledWith('detail');
    expect(onToggleFocusMode).toHaveBeenCalledOnce();
    expect(onToggleBoardLayout).toHaveBeenCalledOnce();
    expect(screen.getByText('Archive')).toBeDefined();
  });

  it('calls onShareBoard and closes the menu', () => {
    const onShareBoard = vi.fn();
    render(<MoreActionsMenu {...defaults} onShareBoard={onShareBoard} />);

    openMenu();
    fireEvent.click(screen.getByText('Share Board'));

    expect(onShareBoard).toHaveBeenCalledOnce();
    expect(screen.queryByText('Share Board')).toBeNull();
  });

  it('calls onArchive and closes the menu', () => {
    const onArchive = vi.fn();
    render(<MoreActionsMenu {...defaults} onArchive={onArchive} />);

    openMenu();
    fireEvent.click(screen.getByText('Archive'));

    expect(onArchive).toHaveBeenCalledOnce();
    expect(screen.queryByText('Export Tasks')).toBeNull();
  });

  it('calls onAdmin and closes the menu', () => {
    const onAdmin = vi.fn();
    render(<MoreActionsMenu {...defaults} onAdmin={onAdmin} />);

    openMenu();
    fireEvent.click(screen.getByText('Admin'));

    expect(onAdmin).toHaveBeenCalledOnce();
  });

  it('calls onExport and closes the menu', () => {
    const onExport = vi.fn();
    render(<MoreActionsMenu {...defaults} onExport={onExport} />);

    openMenu();
    fireEvent.click(screen.getByText('Export Tasks'));

    expect(onExport).toHaveBeenCalledOnce();
  });

  it('calls onImport and closes the menu', () => {
    const onImport = vi.fn();
    render(<MoreActionsMenu {...defaults} onImport={onImport} />);

    openMenu();
    fireEvent.click(screen.getByText('Import Tasks'));

    expect(onImport).toHaveBeenCalledOnce();
  });

  it('closes the menu when the backdrop overlay is clicked', () => {
    render(<MoreActionsMenu {...defaults} />);

    openMenu();
    expect(screen.getByText('Archive')).toBeDefined();

    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    if (overlay) fireEvent.click(overlay);

    expect(screen.queryByText('Archive')).toBeNull();
  });
});
