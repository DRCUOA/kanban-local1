// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { EditTaskFormFields } from './EditTaskFormFields';
import type { InsertTask, Stage } from '@shared/schema';

const stages: Stage[] = [
  { id: 1, name: 'Backlog', order: 0, color: '#3B82F6', createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 1, color: '#10B981', createdAt: new Date() },
];

function Harness({ stagesOverride }: { stagesOverride?: Stage[] }) {
  const form = useForm<InsertTask>({
    defaultValues: {
      title: 'Test title',
      description: 'Test desc',
      stageId: 1,
      status: 'backlog',
      priority: 'normal',
      effort: 3,
    },
  });

  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FormProvider {...form}>
        <form>
          <EditTaskFormFields control={form.control} stages={stagesOverride ?? stages} />
        </form>
      </FormProvider>
    </QueryClientProvider>
  );
}

describe('EditTaskFormFields', () => {
  it('renders the title input with the default value', () => {
    render(<Harness />);
    const titleInput: HTMLInputElement = screen.getByTestId('input-edit-title');
    expect(titleInput.value).toBe('Test title');
  });

  it('shows the description in read-only view mode by default', () => {
    render(<Harness />);
    const descView: HTMLElement = screen.getByTestId('text-edit-description');
    expect(descView.textContent).toContain('Test desc');
    expect(screen.queryByTestId('input-edit-description')).toBeNull();
  });

  it('switches to the rich text editor when Edit is tapped', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('button-toggle-description-edit'));
    const descEditor: HTMLElement = screen.getByTestId('input-edit-description');
    expect(descEditor.textContent).toContain('Test desc');
    fireEvent.click(screen.getByTestId('button-toggle-description-edit'));
    expect(screen.queryByTestId('input-edit-description')).toBeNull();
    expect(screen.getByTestId('text-edit-description').textContent).toContain('Test desc');
  });

  it('renders all form field labels', () => {
    render(<Harness />);

    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Stage')).toBeDefined();
    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Priority')).toBeDefined();
    expect(screen.getByText(/Effort/)).toBeDefined();
    expect(screen.getByText('Due Date')).toBeDefined();
  });

  it('renders the "Pick date" placeholder for due date', () => {
    render(<Harness />);
    expect(screen.getByText('Pick date')).toBeDefined();
  });
});
