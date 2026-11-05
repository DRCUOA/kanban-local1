// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ZenDoingButton } from './ZenDoingButton';

describe('ZenDoingButton', () => {
  it('shows the Everyday icon, with the sun in the project colour', () => {
    render(<ZenDoingButton project={{ name: 'Everyday', color: '#22C55E' }} onStart={vi.fn()} />);

    const button = screen.getByTestId('zen-doing-start');
    expect(button.getAttribute('aria-label')).toBe('Zen doing mode, Everyday');
    const icon = screen.getByTestId('everyday-icon');
    expect(icon.querySelector('circle')?.getAttribute('fill')).toBe('#22C55E');
  });

  it('opens Zen doing mode when pressed', () => {
    const onStart = vi.fn();
    render(<ZenDoingButton project={{ name: 'Everyday', color: null }} onStart={onStart} />);
    fireEvent.click(screen.getByTestId('zen-doing-start'));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('is not there for any other project, or for a task with none', () => {
    const { rerender } = render(
      <ZenDoingButton project={{ name: 'Business Setup', color: null }} onStart={vi.fn()} />,
    );
    expect(screen.queryByTestId('zen-doing-start')).toBeNull();

    rerender(<ZenDoingButton project={null} onStart={vi.fn()} />);
    expect(screen.queryByTestId('zen-doing-start')).toBeNull();
  });
});
