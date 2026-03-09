// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditTaskDialogActions } from './EditTaskDialogActions';

describe('EditTaskDialogActions', () => {
  const defaults = {
    onDelete: vi.fn(),
    onCancel: vi.fn(),
    isSaving: false,
  };

  it('renders Cancel and Save buttons', () => {
    render(<EditTaskDialogActions {...defaults} />);

    expect(screen.getByText('Cancel')).toBeDefined();
    expect(screen.getByTestId('button-save-task')).toBeDefined();
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('renders Delete button that opens a confirmation dialog', () => {
    render(<EditTaskDialogActions {...defaults} />);
    expect(screen.getByTestId('button-delete-task')).toBeDefined();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<EditTaskDialogActions {...defaults} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows "Saving..." and disables the save button when isSaving is true', () => {
    render(<EditTaskDialogActions {...defaults} isSaving={true} />);

    const saveBtn = screen.getByTestId('button-save-task');
    expect(saveBtn.textContent).toBe('Saving...');
    expect(saveBtn).toHaveProperty('disabled', true);
  });

  it('renders the History button when onViewHistory is provided', () => {
    const onViewHistory = vi.fn();
    render(<EditTaskDialogActions {...defaults} onViewHistory={onViewHistory} />);

    expect(screen.getByText('History')).toBeDefined();
    fireEvent.click(screen.getByText('History'));
    expect(onViewHistory).toHaveBeenCalledOnce();
  });

  it('does not render the History button when onViewHistory is omitted', () => {
    render(<EditTaskDialogActions {...defaults} />);
    expect(screen.queryByText('History')).toBeNull();
  });

  it('shows confirmation dialog content when Delete is clicked', () => {
    render(<EditTaskDialogActions {...defaults} />);

    fireEvent.click(screen.getByTestId('button-delete-task'));
    expect(screen.getByText('Delete task?')).toBeDefined();
    expect(screen.getByText('This action cannot be undone.')).toBeDefined();
  });
});
