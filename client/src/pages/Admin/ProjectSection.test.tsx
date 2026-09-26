// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ProjectSection } from './ProjectSection';
import type { ProjectSummary } from '@shared/schema';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/ColorPicker', () => ({
  ColorPicker: ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (c: string) => void;
    label: string;
  }) =>
    React.createElement('input', {
      'data-testid': 'color-picker',
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      'aria-label': label,
    }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const project = (overrides: Partial<ProjectSummary>): ProjectSummary => ({
  id: 1,
  name: 'Alpha',
  key: 'ALP',
  color: '#6366F1',
  archived: false,
  order: 0,
  createdAt: new Date(),
  taskCount: 0,
  ...overrides,
});

const projects = [
  project({ id: 1, name: 'Alpha', key: 'ALP', taskCount: 3 }),
  project({ id: 2, name: 'Old work', key: null, archived: true, taskCount: 1 }),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectSection', () => {
  it('renders the loading state', () => {
    render(<ProjectSection projects={[]} isLoading={true} />, { wrapper });
    expect(screen.getByText('Loading projects...')).toBeDefined();
  });

  it('explains what a project does when there are none yet', () => {
    render(<ProjectSection projects={[]} isLoading={false} />, { wrapper });
    expect(screen.getByText(/No projects yet/)).toBeDefined();
    expect(screen.getByTestId('button-add-project')).toBeDefined();
  });

  it('lists each project with its key, task count and archived state', () => {
    render(<ProjectSection projects={projects} isLoading={false} />, { wrapper });

    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('ALP')).toBeDefined();
    expect(screen.getByText('3 tasks')).toBeDefined();
    expect(screen.getByText('Old work')).toBeDefined();
    expect(screen.getByText('1 task')).toBeDefined();
    expect(screen.getByText('Archived')).toBeDefined();
  });

  it('offers edit, archive and delete for every project', () => {
    render(<ProjectSection projects={projects} isLoading={false} />, { wrapper });

    expect(screen.getByTestId('button-edit-project-1')).toBeDefined();
    expect(screen.getByTestId('button-archive-project-1')).toBeDefined();
    expect(screen.getByTestId('button-delete-project-1')).toBeDefined();
    expect(screen.getByLabelText('Archive Alpha')).toBeDefined();
    expect(screen.getByLabelText('Unarchive Old work')).toBeDefined();
  });

  it('archives a project with a single patch', async () => {
    const { apiPatch } = await import('@/lib/api');
    vi.mocked(apiPatch).mockResolvedValueOnce(project({ archived: true }));

    render(<ProjectSection projects={projects} isLoading={false} />, { wrapper });
    fireEvent.click(screen.getByTestId('button-archive-project-1'));

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith('/api/projects/1', { archived: true });
    });
  });

  it('asks before deleting and says the tasks stay, then deletes', async () => {
    const { apiDelete } = await import('@/lib/api');
    vi.mocked(apiDelete).mockResolvedValueOnce(undefined);

    render(<ProjectSection projects={projects} isLoading={false} />, { wrapper });
    fireEvent.click(screen.getByTestId('button-delete-project-1'));

    expect(screen.getByText('Delete this project?')).toBeDefined();
    expect(screen.getByText(/3 tasks stay on the board/)).toBeDefined();
    expect(apiDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('button-confirm-delete-project'));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/api/projects/1');
    });
  });

  it('creates a project from the dialog, upper-casing the key', async () => {
    const { apiPost } = await import('@/lib/api');
    vi.mocked(apiPost).mockResolvedValueOnce(project({ id: 9, name: 'Garden', key: 'GDN' }));

    render(<ProjectSection projects={[]} isLoading={false} />, { wrapper });
    fireEvent.click(screen.getByTestId('button-add-project'));
    fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'Garden' } });
    fireEvent.change(screen.getByTestId('input-project-key'), { target: { value: 'gdn' } });
    fireEvent.click(screen.getByTestId('button-submit-project'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({ name: 'Garden', key: 'GDN' }),
      );
    });
  });
});
