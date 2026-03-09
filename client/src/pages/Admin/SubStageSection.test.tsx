// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { SubStageSection } from './SubStageSection';
import type { Stage, SubStage } from '@shared/schema';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockStages: Stage[] = [
  { id: 1, name: 'Backlog', order: 0, color: '#3B82F6', createdAt: new Date() },
  { id: 2, name: 'In Progress', order: 1, color: '#10B981', createdAt: new Date() },
];

const mockSubStages: SubStage[] = [
  {
    id: 10,
    stageId: 2,
    name: 'AM',
    tag: 'day-plan-am',
    bgClass: 'bg-background/20',
    opacity: 20,
    order: 0,
    createdAt: new Date(),
  },
  {
    id: 11,
    stageId: 2,
    name: 'PM',
    tag: 'day-plan-pm',
    bgClass: 'bg-background/40',
    opacity: 40,
    order: 1,
    createdAt: new Date(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubStageSection', () => {
  it('renders empty state when no sub-stages exist', () => {
    render(<SubStageSection stages={mockStages} subStages={[]} />, { wrapper });
    expect(screen.getByText('No sub-stages found.')).toBeDefined();
  });

  it('renders sub-stages grouped by parent stage', () => {
    render(<SubStageSection stages={mockStages} subStages={mockSubStages} />, { wrapper });

    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('AM')).toBeDefined();
    expect(screen.getByText('PM')).toBeDefined();
  });

  it('displays sub-stage metadata (tag and opacity)', () => {
    render(<SubStageSection stages={mockStages} subStages={mockSubStages} />, { wrapper });

    expect(screen.getByText('day-plan-am | 20%')).toBeDefined();
    expect(screen.getByText('day-plan-pm | 40%')).toBeDefined();
  });

  it('shows the "Add Sub-Stage" button', () => {
    render(<SubStageSection stages={mockStages} subStages={mockSubStages} />, { wrapper });
    expect(screen.getByText('Add Sub-Stage')).toBeDefined();
  });

  it('does not render a stage heading if the stage has no sub-stages', () => {
    render(<SubStageSection stages={mockStages} subStages={mockSubStages} />, { wrapper });
    const headings = screen.getAllByRole('heading', { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).not.toContain('Backlog');
  });
});
