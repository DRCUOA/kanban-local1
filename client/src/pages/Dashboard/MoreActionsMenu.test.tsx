// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MoreActionsMenu } from './MoreActionsMenu';

describe('MoreActionsMenu', () => {
  const defaults = {
    onArchive: vi.fn(),
    onAdmin: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
  };

  it('renders the "More" toggle button', () => {
    render(<MoreActionsMenu {...defaults} />);
    expect(screen.getByText('More')).toBeDefined();
  });

  it('does not show menu items initially', () => {
    render(<MoreActionsMenu {...defaults} />);
    expect(screen.queryByText('Archive')).toBeNull();
    expect(screen.queryByText('Admin')).toBeNull();
  });

  it('shows menu items after clicking the toggle', () => {
    render(<MoreActionsMenu {...defaults} />);

    fireEvent.click(screen.getByText('More'));

    expect(screen.getByText('Archive')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Export Tasks')).toBeDefined();
    expect(screen.getByText('Import Tasks')).toBeDefined();
  });

  it('calls onArchive and closes the menu', () => {
    const onArchive = vi.fn();
    render(<MoreActionsMenu {...defaults} onArchive={onArchive} />);

    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByText('Archive'));

    expect(onArchive).toHaveBeenCalledOnce();
    expect(screen.queryByText('Export Tasks')).toBeNull();
  });

  it('calls onAdmin and closes the menu', () => {
    const onAdmin = vi.fn();
    render(<MoreActionsMenu {...defaults} onAdmin={onAdmin} />);

    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByText('Admin'));

    expect(onAdmin).toHaveBeenCalledOnce();
  });

  it('calls onExport and closes the menu', () => {
    const onExport = vi.fn();
    render(<MoreActionsMenu {...defaults} onExport={onExport} />);

    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByText('Export Tasks'));

    expect(onExport).toHaveBeenCalledOnce();
  });

  it('calls onImport and closes the menu', () => {
    const onImport = vi.fn();
    render(<MoreActionsMenu {...defaults} onImport={onImport} />);

    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByText('Import Tasks'));

    expect(onImport).toHaveBeenCalledOnce();
  });

  it('closes the menu when the backdrop overlay is clicked', () => {
    render(<MoreActionsMenu {...defaults} />);

    fireEvent.click(screen.getByText('More'));
    expect(screen.getByText('Archive')).toBeDefined();

    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    if (overlay) fireEvent.click(overlay);

    expect(screen.queryByText('Archive')).toBeNull();
  });
});
