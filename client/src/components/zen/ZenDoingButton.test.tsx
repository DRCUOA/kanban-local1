// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { ZenDoingButton } from './ZenDoingButton';

const sunFill = () => screen.getByTestId('zen-icon').querySelector('circle')?.getAttribute('fill');

describe('ZenDoingButton', () => {
  it('shows the Zen icon, with the sun in the project colour', () => {
    render(<ZenDoingButton project={{ name: 'Everyday', color: '#22C55E' }} onStart={vi.fn()} />);

    const button = screen.getByTestId('zen-doing-start');
    expect(button.getAttribute('aria-label')).toBe('Zen doing mode, Everyday');
    expect(sunFill()).toBe('#22C55E');
  });

  it('is there on every project, not only Everyday', () => {
    render(
      <ZenDoingButton project={{ name: ' Business Setup ', color: '#3B82F6' }} onStart={vi.fn()} />,
    );

    const button = screen.getByTestId('zen-doing-start');
    expect(button.getAttribute('aria-label')).toBe('Zen doing mode, Business Setup');
    expect(sunFill()).toBe('#3B82F6');
  });

  it('is there on a task with no project, in the default colour', () => {
    render(<ZenDoingButton project={null} onStart={vi.fn()} />);

    const button = screen.getByTestId('zen-doing-start');
    expect(button.getAttribute('aria-label')).toBe('Zen doing mode');
    expect(sunFill()).toBe(DEFAULT_PROJECT_COLOR);
  });

  it('opens Zen doing mode when pressed', () => {
    const onStart = vi.fn();
    render(<ZenDoingButton project={{ name: 'Everyday', color: null }} onStart={onStart} />);
    fireEvent.click(screen.getByTestId('zen-doing-start'));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
