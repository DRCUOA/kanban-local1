// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ColumnResizer, type ColumnResizerProps } from './ColumnResizer';

function setup(overrides: Partial<ColumnResizerProps> = {}) {
  const onResizeStart = vi.fn<ColumnResizerProps['onResizeStart']>();
  const onResize = vi.fn<ColumnResizerProps['onResize']>();
  const onResizeEnd = vi.fn<ColumnResizerProps['onResizeEnd']>();
  const onReset = vi.fn<ColumnResizerProps['onReset']>();
  const props: ColumnResizerProps = {
    onResizeStart,
    onResize,
    onResizeEnd,
    onReset,
    label: 'Resize Backlog and In Progress',
    ...overrides,
  };
  render(<ColumnResizer {...props} />);
  const handle = screen.getByRole('separator');
  // jsdom has no pointer capture API.
  handle.setPointerCapture = vi.fn();
  handle.hasPointerCapture = vi.fn(() => true);
  handle.releasePointerCapture = vi.fn();
  return { onResizeStart, onResize, onResizeEnd, onReset, handle };
}

describe('ColumnResizer', () => {
  it('exposes an accessible vertical separator', () => {
    const { handle } = setup();
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Resize Backlog and In Progress');
  });

  it('reports the drag offset relative to where the drag started', () => {
    const { handle, onResizeStart, onResize, onResizeEnd } = setup();

    fireEvent.pointerDown(handle, { button: 0, clientX: 400, pointerId: 1 });
    expect(onResizeStart).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(handle, { clientX: 460, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 350, pointerId: 1 });
    expect(onResize.mock.calls).toEqual([[60], [-50]]);

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores pointer movement when no drag is in progress', () => {
    const { handle, onResize } = setup();
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('nudges by a fixed step with the arrow keys', () => {
    const { handle, onResize, onResizeStart, onResizeEnd } = setup();

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(onResize.mock.calls).toEqual([[32], [-32]]);
    expect(onResizeStart).toHaveBeenCalledTimes(2);
    expect(onResizeEnd).toHaveBeenCalledTimes(2);
  });

  it('evens out the pair on double-click and on Enter', () => {
    const { handle, onReset } = setup();
    fireEvent.doubleClick(handle);
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(onReset).toHaveBeenCalledTimes(2);
  });
});
