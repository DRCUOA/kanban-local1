// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { Stage, SubStage, Task } from '@shared/schema';
import { CopyTaskJsonButton } from './CopyTaskJsonButton';

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const copyToClipboardMock = vi.fn();
vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: (payload: unknown) => copyToClipboardMock(payload) as Promise<boolean>,
}));

vi.mock('@/hooks/use-project-scope', () => ({
  useProjectScope: () => ({
    projects: [
      { id: 3, name: 'StageBoard', key: 'S&G-SB', taskCount: 2 },
      { id: 4, name: 'Business Setup', key: 'TK', taskCount: 9 },
    ],
  }),
}));

const stages = [{ id: 1, name: 'Backlog', kind: 'backlog' }] as unknown as Stage[];
const subStages = [{ id: 7, stageId: 1, name: 'Later', tag: 'Later' }] as unknown as SubStage[];

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 392,
    title: 'Set up change management',
    description: '<p>Customer is using the system</p>',
    stageId: 1,
    projectId: 3,
    archived: false,
    priority: 'critical',
    owner: 'TK Workflow IT',
    ownerId: 20,
    ...overrides,
  }) as Task;

const renderButton = (task = makeTask()) => {
  render(<CopyTaskJsonButton task={task} stages={stages} subStages={subStages} />);
  return screen.getByTestId('task-copy-json');
};

describe('CopyTaskJsonButton', () => {
  beforeEach(() => {
    toastMock.mockClear();
    copyToClipboardMock.mockReset();
    copyToClipboardMock.mockResolvedValue(true);
  });

  it('names what it does for hover and for a screen reader', async () => {
    const button = renderButton();
    expect(button.getAttribute('aria-label')).toBe('Copy JSON to clipboard');

    fireEvent.focus(button);
    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toBe('Copy JSON to clipboard');
    });
  });

  it('copies the task in the transfer format as plain text', async () => {
    fireEvent.click(renderButton());

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    });
    const [payload] = copyToClipboardMock.mock.calls[0] as [{ text: string; html?: string }];
    expect(payload.html).toBeUndefined();

    const bundle = JSON.parse(payload.text) as Record<string, unknown>;
    expect(bundle.formatVersion).toBe(2);
    expect(bundle.generator).toBe('kanban-local');
    expect(bundle).not.toHaveProperty('briefing');
    expect(bundle.stages).toEqual(stages);
    expect(bundle.subStages).toEqual(subStages);
    expect(bundle.projects).toEqual([{ id: 3, name: 'StageBoard', key: 'S&G-SB' }]);
    expect(bundle.tasks).toMatchObject([
      { id: 392, title: 'Set up change management', owner: 'TK Workflow IT' },
    ]);
  });

  it('confirms the copy', async () => {
    fireEvent.click(renderButton());

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Copied to clipboard',
        description: 'Copied task #392 as JSON.',
      });
    });
  });

  it('says when the task has files the copy leaves out', async () => {
    const description = '<p><a data-file-chip="" href="/api/attachments/9">plan.pdf</a></p>';
    fireEvent.click(renderButton(makeTask({ description })));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Copied to clipboard',
        description: 'Copied task #392 as JSON. Its attached files are not included.',
      });
    });
  });

  it('reports a blocked clipboard rather than claiming success', async () => {
    copyToClipboardMock.mockResolvedValue(false);
    fireEvent.click(renderButton());

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      });
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});
