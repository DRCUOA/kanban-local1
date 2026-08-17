// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardHeader } from './DashboardHeader';

describe('DashboardHeader', () => {
  const defaults = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    onClearSearch: vi.fn(),
  };

  it('renders the app title area', () => {
    render(<DashboardHeader {...defaults} />);
    expect(screen.getByRole('banner')).toBeDefined();
  });

  it('always shows the search input, inside a search landmark', () => {
    render(<DashboardHeader {...defaults} />);
    const input = screen.getByTestId('input-search');
    expect(input).toBeDefined();
    expect(screen.getByRole('search').contains(input)).toBe(true);
    // No search-toggle button any more: the only button is the theme toggle.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('calls onSearchChange when typing in the search input', () => {
    const onSearchChange = vi.fn();
    render(<DashboardHeader {...defaults} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByTestId('input-search'), { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows a clear button only while there is a query, and it clears', () => {
    const onClearSearch = vi.fn();
    const { rerender } = render(<DashboardHeader {...defaults} onClearSearch={onClearSearch} />);
    expect(screen.queryByTestId('button-clear-search')).toBeNull();

    rerender(<DashboardHeader {...defaults} searchQuery="solar" onClearSearch={onClearSearch} />);
    fireEvent.click(screen.getByTestId('button-clear-search'));
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it('Escape in the field clears a query', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} searchQuery="solar" onClearSearch={onClearSearch} />);
    fireEvent.keyDown(screen.getByTestId('input-search'), { key: 'Escape' });
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it('Escape does nothing when the field is already empty', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} onClearSearch={onClearSearch} />);
    fireEvent.keyDown(screen.getByTestId('input-search'), { key: 'Escape' });
    expect(onClearSearch).not.toHaveBeenCalled();
  });
});
