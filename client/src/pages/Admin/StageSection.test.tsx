// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { StageSection } from './StageSection';
import type { Stage } from '@shared/schema';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
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
  }) => {
    return React.createElement('input', {
      'data-testid': 'color-picker',
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      'aria-label': label,
    });
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockStages: Stage[] = [
  { id: 1, name: 'Backlog', order: 0, color: '#3B82F6', createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 1, color: '#10B981', createdAt: new Date() },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StageSection', () => {
  it('renders loading state when isLoading is true', () => {
    render(<StageSection stages={[]} isLoading={true} />, { wrapper });
    expect(screen.getByText('Loading stages...')).toBeDefined();
  });

  it('renders empty state when no stages exist', () => {
    render(<StageSection stages={[]} isLoading={false} />, { wrapper });
    expect(screen.getByText('No stages found. Create one to get started.')).toBeDefined();
  });

  it('renders each stage with name, order, and color swatch', () => {
    render(<StageSection stages={mockStages} isLoading={false} />, { wrapper });

    expect(screen.getByText('Backlog')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Order: 0')).toBeDefined();
    expect(screen.getByText('Order: 1')).toBeDefined();
  });

  it('shows the "Add Stage" button', () => {
    render(<StageSection stages={mockStages} isLoading={false} />, { wrapper });
    expect(screen.getByTestId('button-add-stage')).toBeDefined();
  });

  it('renders edit and delete buttons for each stage', () => {
    render(<StageSection stages={mockStages} isLoading={false} />, { wrapper });
    expect(screen.getByTestId('button-edit-stage-1')).toBeDefined();
    expect(screen.getByTestId('button-delete-stage-1')).toBeDefined();
    expect(screen.getByTestId('button-edit-stage-2')).toBeDefined();
    expect(screen.getByTestId('button-delete-stage-2')).toBeDefined();
  });

  it('calls apiDelete when a delete button is clicked', async () => {
    const { apiDelete } = await import('@/lib/api');
    const mockApiDelete = vi.mocked(apiDelete);
    mockApiDelete.mockResolvedValueOnce(undefined);

    render(<StageSection stages={mockStages} isLoading={false} />, { wrapper });

    fireEvent.click(screen.getByTestId('button-delete-stage-1'));

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledOnce();
    });
  });
});
