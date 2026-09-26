// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProjectChip } from './ProjectChip';

describe('ProjectChip', () => {
  it('shows the short key when the project has one, with the name as tooltip', () => {
    render(<ProjectChip project={{ name: 'Solar install', key: 'SOLAR', color: '#F59E0B' }} />);
    const chip = screen.getByTestId('project-chip');
    expect(chip.textContent).toBe('SOLAR');
    expect(chip.getAttribute('title')).toBe('Solar install');
  });

  it('falls back to the name without a key, and to the default colour', () => {
    const { container } = render(
      <ProjectChip project={{ name: 'Garden', key: null, color: null }} testId="chip" />,
    );
    expect(screen.getByTestId('chip').textContent).toBe('Garden');
    const dot = container.querySelector('span[aria-hidden]');
    expect(dot?.getAttribute('style')).toContain('background-color');
  });

  it('can be asked for the full name even when a key exists', () => {
    render(<ProjectChip project={{ name: 'Solar install', key: 'SOLAR', color: null }} full />);
    expect(screen.getByTestId('project-chip').textContent).toBe('Solar install');
  });
});
