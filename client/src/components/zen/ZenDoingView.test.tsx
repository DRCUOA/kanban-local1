// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ZenDoingView, type ZenDoingViewProps } from './ZenDoingView';

const renderView = (overrides: Partial<ZenDoingViewProps> = {}) => {
  const props: ZenDoingViewProps = {
    open: true,
    description:
      '<ol><li>Empty the dishwasher</li></ol><p><strong>Done when:</strong> it is empty.</p>',
    onMarkDone: vi.fn(),
    onCancel: vi.fn(),
    isMarkingDone: false,
    markDoneBlockedReason: null,
    ...overrides,
  };
  render(<ZenDoingView {...props} />);
  return props;
};

describe('ZenDoingView', () => {
  it('shows the description and the two ways out, and nothing else', () => {
    renderView();
    const view = screen.getByTestId('zen-doing-view');

    expect(within(view).getByTestId('zen-doing-description').textContent).toContain(
      'Empty the dishwasher',
    );
    expect(
      within(view)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cancel doing', 'Mark done']);
  });

  it('is read-only: no field, editor or editable text anywhere in it', () => {
    renderView();
    const view = screen.getByTestId('zen-doing-view');

    expect(within(view).queryAllByRole('textbox')).toHaveLength(0);
    expect(view.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0);
  });

  it('says so when there is no description', () => {
    renderView({ description: '' });
    expect(screen.getByText('No description')).toBeDefined();
  });

  it('Cancel doing only cancels', () => {
    const props = renderView();
    fireEvent.click(screen.getByTestId('zen-doing-cancel'));
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onMarkDone).not.toHaveBeenCalled();
  });

  it('Mark done only marks done', () => {
    const props = renderView();
    fireEvent.click(screen.getByTestId('zen-doing-mark-done'));
    expect(props.onMarkDone).toHaveBeenCalledOnce();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('Escape is Cancel doing', () => {
    const props = renderView();
    fireEvent.keyDown(screen.getByTestId('zen-doing-view'), { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('keeps its Escape from the board’s own Esc shortcut, which would close Edit Task', () => {
    const boardShortcut = vi.fn();
    window.addEventListener('keydown', boardShortcut);
    try {
      renderView();
      fireEvent.keyDown(screen.getByTestId('zen-doing-view'), { key: 'Escape' });
      expect(boardShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', boardShortcut);
    }
  });

  it('starts focus on the reading area, not on a button', () => {
    renderView();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Task description');
  });

  it('holds both ways out while Mark done is saving', () => {
    const props = renderView({ isMarkingDone: true });
    expect(screen.getByTestId('zen-doing-mark-done').textContent).toBe('Marking done…');
    expect(screen.getByTestId('zen-doing-mark-done')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('zen-doing-cancel')).toHaveProperty('disabled', true);

    fireEvent.keyDown(screen.getByTestId('zen-doing-view'), { key: 'Escape' });
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('disables Mark done, with the reason, on a board with no Done column', () => {
    renderView({ markDoneBlockedReason: 'This board has no Done column to move it to.' });
    const markDone = screen.getByTestId('zen-doing-mark-done');
    expect(markDone).toHaveProperty('disabled', true);
    expect(markDone.getAttribute('title')).toBe('This board has no Done column to move it to.');
    expect(screen.getByTestId('zen-doing-cancel')).toHaveProperty('disabled', false);
  });

  it('renders nothing while closed', () => {
    renderView({ open: false });
    expect(screen.queryByTestId('zen-doing-view')).toBeNull();
  });
});
