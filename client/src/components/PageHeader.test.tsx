// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('shows the title and subtitle, and the back button goes back', () => {
    const onBack = vi.fn();
    render(
      <PageHeader
        title="Filing"
        subtitle="3 finished tasks"
        icon={<span />}
        onBack={onBack}
        backTestId="button-back"
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Filing');
    expect(screen.getByText('3 finished tasks')).toBeDefined();
    expect(screen.getByRole('banner')).toBeDefined();

    fireEvent.click(screen.getByTestId('button-back'));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Back to the board')).toBeDefined();
  });

  it('centres the title on a phone; from lg it sits left beside the icon tile', () => {
    render(<PageHeader title="Bin" icon={<span data-testid="tile-icon" />} onBack={vi.fn()} />);
    const titleBlock = screen.getByRole('heading', { level: 1 }).parentElement;
    expect(titleBlock?.className).toContain('text-center');
    expect(titleBlock?.className).toContain('lg:text-left');

    const tile = screen.getByTestId('tile-icon').parentElement;
    expect(tile?.className).toContain('hidden');
    expect(tile?.className).toContain('lg:flex');
  });

  it('puts actions at the trailing end and an extra row under the bar', () => {
    render(
      <PageHeader title="Archive" icon={<span />} onBack={vi.fn()} actions={<button>Act</button>}>
        <div data-testid="extra-row" />
      </PageHeader>,
    );
    const banner = screen.getByRole('banner');
    const action = screen.getByText('Act');
    const extra = screen.getByTestId('extra-row');
    expect(banner.contains(action)).toBe(true);
    expect(banner.contains(extra)).toBe(true);
    // The extra row comes after the bar.
    expect(Boolean(action.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
  });
});
