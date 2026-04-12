// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardHeader } from './DashboardHeader';

describe('DashboardHeader', () => {
  const defaults = {
    searchQuery: '',
    showSearch: false,
    onSearchChange: vi.fn(),
    onToggleSearch: vi.fn(),
    onClearSearch: vi.fn(),
  };

  it('renders the app title area', () => {
    render(<DashboardHeader {...defaults} />);
    expect(screen.getByRole('banner')).toBeDefined();
  });

  it('does not show the search input when showSearch is false', () => {
    render(<DashboardHeader {...defaults} />);
    expect(screen.queryByTestId('input-search')).toBeNull();
  });

  it('shows the search input when showSearch is true', () => {
    render(<DashboardHeader {...defaults} showSearch={true} />);
    expect(screen.getByTestId('input-search')).toBeDefined();
  });

  it('calls onToggleSearch when the search icon button is clicked', () => {
    const onToggleSearch = vi.fn();
    render(<DashboardHeader {...defaults} onToggleSearch={onToggleSearch} />);

    const firstBtn = screen.getAllByRole('button').at(0);
    if (!firstBtn) throw new Error('Expected at least one button');
    fireEvent.click(firstBtn);
    expect(onToggleSearch).toHaveBeenCalledOnce();
  });

  it('calls onSearchChange when typing in the search input', () => {
    const onSearchChange = vi.fn();
    render(<DashboardHeader {...defaults} showSearch={true} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByTestId('input-search'), { target: { value: 'test' } });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('calls onClearSearch when the clear button is clicked', () => {
    const onClearSearch = vi.fn();
    render(<DashboardHeader {...defaults} showSearch={true} onClearSearch={onClearSearch} />);

    const clearBtn = screen.getAllByRole('button').at(-1);
    if (!clearBtn) throw new Error('Expected at least one button');
    fireEvent.click(clearBtn);
    expect(onClearSearch).toHaveBeenCalledOnce();
  });
});
