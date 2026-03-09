// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AdminHeader } from './AdminHeader';

describe('AdminHeader', () => {
  it('renders the Admin heading and subtitle', () => {
    render(<AdminHeader onBack={vi.fn()} />);

    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Manage Stages')).toBeDefined();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<AdminHeader onBack={onBack} />);

    fireEvent.click(screen.getByTestId('button-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
