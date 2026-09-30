// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MenuPanel } from './MenuPanel';

const item = <button role="menuitem">Row</button>;

describe('MenuPanel', () => {
  it('renders nothing while closed', () => {
    render(
      <MenuPanel open={false} onClose={vi.fn()} anchor="below-end">
        {item}
      </MenuPanel>,
    );
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByTestId('menu-panel-backdrop')).toBeNull();
  });

  it('opens as a centred card on a phone and as a dropdown on the trigger edge from lg', () => {
    render(
      <MenuPanel open onClose={vi.fn()} anchor="below-end" label="Options" testId="panel">
        {item}
      </MenuPanel>,
    );
    const menu = screen.getByRole('menu');
    expect(menu.getAttribute('aria-label')).toBe('Options');
    expect(menu.contains(screen.getByRole('menuitem'))).toBe(true);
    expect(menu.className).toContain('max-w-xs');
    expect(menu.className).toContain('lg:w-52');

    const placement = screen.getByTestId('panel-placement');
    for (const cls of ['fixed', 'inset-0', 'items-center', 'justify-center']) {
      expect(placement.className).toContain(cls);
    }
    for (const cls of ['lg:absolute', 'lg:inset-auto', 'lg:right-0', 'lg:top-full']) {
      expect(placement.className).toContain(cls);
    }
  });

  it('can hang above its trigger, at a width of the caller’s choosing', () => {
    render(
      <MenuPanel open onClose={vi.fn()} anchor="above-start" widthClass="lg:w-60" testId="panel">
        {item}
      </MenuPanel>,
    );
    const placement = screen.getByTestId('panel-placement');
    expect(placement.className).toContain('lg:bottom-full');
    expect(placement.className).toContain('lg:left-0');
    expect(placement.className).not.toContain('lg:top-full');
    expect(screen.getByRole('menu').className).toContain('lg:w-60');
  });

  it('closes from a tap on the backdrop and from Escape', () => {
    const onClose = vi.fn();
    render(
      <MenuPanel open onClose={onClose} anchor="below-start">
        {item}
      </MenuPanel>,
    );
    fireEvent.click(screen.getByTestId('menu-panel-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
