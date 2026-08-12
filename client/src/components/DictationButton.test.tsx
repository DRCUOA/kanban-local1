// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DictationButton } from './DictationButton';

describe('DictationButton', () => {
  const defaults = {
    listening: false,
    supported: true,
    onClick: vi.fn(),
    fieldLabel: 'title',
  };

  it('labels itself for the field it dictates', () => {
    render(<DictationButton {...defaults} />);

    const button = screen.getByLabelText('Dictate title');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to a stop label while listening', () => {
    render(<DictationButton {...defaults} listening={true} />);

    const button = screen.getByLabelText('Stop dictating title');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<DictationButton {...defaults} onClick={onClick} />);

    fireEvent.click(screen.getByLabelText('Dictate title'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('mentions the macOS fallback when the browser has no speech API', () => {
    render(<DictationButton {...defaults} supported={false} />);

    expect(screen.getByLabelText('Dictate title').getAttribute('title')).toContain(
      'macOS Dictation',
    );
  });
});
