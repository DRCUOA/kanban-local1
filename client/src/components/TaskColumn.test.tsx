// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TaskColumn } from './TaskColumn';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

describe('TaskColumn', () => {
  it('renders the column title and task count', () => {
    render(
      <TaskColumn id={1} title="Backlog" count={5} stageColor="#3B82F6">
        <div>child content</div>
      </TaskColumn>,
    );

    expect(screen.getByText('Backlog')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('child content')).toBeDefined();
  });

  it('renders the color indicator dot', () => {
    const { container } = render(
      <TaskColumn id={2} title="Done" count={0} stageColor="#10B981">
        <span />
      </TaskColumn>,
    );

    const dot = container.querySelector('.rounded-full');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('style')).toContain('background-color');
  });

  it('shows "Drag tasks here" placeholder when count is 0', () => {
    render(
      <TaskColumn id={3} title="Empty" count={0} stageColor="#EEE">
        <span />
      </TaskColumn>,
    );
    expect(screen.getByText('Drag tasks here')).toBeDefined();
  });

  it('does not show the empty placeholder when count is positive', () => {
    render(
      <TaskColumn id={4} title="Filled" count={3} stageColor="#EEE">
        <span />
      </TaskColumn>,
    );
    expect(screen.queryByText('Drag tasks here')).toBeNull();
  });
});
