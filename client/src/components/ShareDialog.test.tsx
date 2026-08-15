// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { Task, Stage } from '@shared/schema';
import { buildExportBundle } from '@shared/export';
import { ShareDialog, type ShareDialogSource } from './ShareDialog';

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const copyToClipboardMock = vi.fn();
vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: (payload: unknown) => copyToClipboardMock(payload) as Promise<boolean>,
}));

const saveTextFileMock = vi.fn();
vi.mock('@/lib/save-file', () => ({
  saveTextFile: (options: unknown) => saveTextFileMock(options) as Promise<string>,
}));

const fetchBoardBundleMock = vi.fn();
vi.mock('@/lib/board-bundle', () => ({
  fetchBoardBundle: (options: unknown) => fetchBoardBundleMock(options) as Promise<unknown>,
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 42,
    title: 'Design homepage',
    description: null,
    stageId: 1,
    archived: false,
    status: 'backlog',
    priority: 'normal',
    effort: null,
    dueDate: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    tags: null,
    parentTaskId: null,
    recurrence: 'none',
    history: null,
    owner: null,
    ...overrides,
  } as Task;
}

const stages: Stage[] = [
  { id: 1, name: 'To Do', order: 1, color: null, createdAt: new Date() },
] as Stage[];

function renderDialog(source: ShareDialogSource, onOpenChange = vi.fn()) {
  render(<ShareDialog source={source} open={true} onOpenChange={onOpenChange} />);
  return onOpenChange;
}

const taskSource = (tasks: Task[]): ShareDialogSource => ({ type: 'tasks', tasks, stages });

describe('ShareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(true);
    saveTextFileMock.mockResolvedValue('saved');
  });

  it('titles itself by scope', () => {
    const { unmount } = render(
      <ShareDialog source={taskSource([makeTask()])} open={true} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText('Share task')).toBeDefined();
    unmount();

    const { unmount: unmount2 } = render(
      <ShareDialog
        source={taskSource([makeTask({ id: 1 }), makeTask({ id: 2 }), makeTask({ id: 3 })])}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Share 3 tasks')).toBeDefined();
    unmount2();

    render(
      <ShareDialog
        source={{ type: 'board', tasks: [], stages }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Share board')).toBeDefined();
  });

  it('renders nothing without a source', () => {
    render(<ShareDialog source={null} open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Copy to clipboard')).toBeNull();
  });

  it('copies plain text (with rich flavour) by default and closes', async () => {
    const onOpenChange = renderDialog(taskSource([makeTask()]));

    fireEvent.click(screen.getByTestId('share-action-copy'));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledOnce();
    });
    const payload = copyToClipboardMock.mock.calls[0]?.[0] as { text: string; html?: string };
    expect(payload.text).toContain('Subject: Task: Design homepage');
    expect(payload.html).toContain('Design homepage');
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Copied to clipboard' }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('copies a JSON array when JSON is selected', async () => {
    renderDialog(taskSource([makeTask({ id: 1 }), makeTask({ id: 2 })]));

    fireEvent.click(screen.getByTestId('share-format-json'));
    fireEvent.click(screen.getByTestId('share-action-copy'));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledOnce();
    });
    const payload = copyToClipboardMock.mock.calls[0]?.[0] as { text: string; html?: string };
    expect(payload.html).toBeUndefined();
    expect((JSON.parse(payload.text) as { id: number }[]).map((t) => t.id)).toEqual([1, 2]);
  });

  it('marks the selected format button as pressed', () => {
    renderDialog(taskSource([makeTask()]));

    expect(screen.getByTestId('share-format-text').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('share-format-json'));
    expect(screen.getByTestId('share-format-json').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('share-format-text').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows a destructive toast and stays open when the copy fails', async () => {
    copyToClipboardMock.mockResolvedValue(false);
    const onOpenChange = renderDialog(taskSource([makeTask()]));

    fireEvent.click(screen.getByTestId('share-action-copy'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Copy failed', variant: 'destructive' }),
      );
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('downloads a .txt file with a task-derived filename', async () => {
    renderDialog(taskSource([makeTask()]));

    fireEvent.click(screen.getByTestId('share-action-download'));

    await waitFor(() => {
      expect(saveTextFileMock).toHaveBeenCalledOnce();
    });
    expect(saveTextFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'taskflow-task-42-design-homepage.txt',
        mimeType: 'text/plain',
      }),
    );
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'File saved' }));
    });
  });

  it('downloads a .json file and reports the fallback download distinctly', async () => {
    saveTextFileMock.mockResolvedValue('downloaded');
    renderDialog(taskSource([makeTask()]));

    fireEvent.click(screen.getByTestId('share-format-json'));
    fireEvent.click(screen.getByTestId('share-action-download'));

    await waitFor(() => {
      expect(saveTextFileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'taskflow-task-42-design-homepage.json',
          mimeType: 'application/json',
        }),
      );
    });
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Download started' }),
      );
    });
  });

  it('stays open and quiet when the user cancels the save picker', async () => {
    saveTextFileMock.mockResolvedValue('cancelled');
    const onOpenChange = renderDialog(taskSource([makeTask()]));

    fireEvent.click(screen.getByTestId('share-action-download'));

    await waitFor(() => {
      expect(saveTextFileMock).toHaveBeenCalledOnce();
    });
    expect(toastMock).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  describe('board scope', () => {
    const bundle = buildExportBundle({
      tasks: [makeTask({ id: 7, title: 'Board task' })],
      stages,
      subStages: [],
      includeArchived: false,
      exportedAt: '2026-08-15T00:00:00.000Z',
    });

    it('shares the export bundle as JSON', async () => {
      fetchBoardBundleMock.mockResolvedValue({ bundle, degraded: false });
      renderDialog({ type: 'board', tasks: [makeTask()], stages });

      fireEvent.click(screen.getByTestId('share-format-json'));
      fireEvent.click(screen.getByTestId('share-action-copy'));

      await waitFor(() => {
        expect(copyToClipboardMock).toHaveBeenCalledOnce();
      });
      const payload = copyToClipboardMock.mock.calls[0]?.[0] as { text: string };
      expect(payload.text).toBe(JSON.stringify(bundle, null, 2));
    });

    it('notes when the bundle was built without the server', async () => {
      fetchBoardBundleMock.mockResolvedValue({ bundle, degraded: true });
      renderDialog({ type: 'board', tasks: [makeTask()], stages });

      fireEvent.click(screen.getByTestId('share-action-copy'));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Shared from this device' }),
        );
      });
    });

    it('surfaces a share failure when no bundle can be built', async () => {
      fetchBoardBundleMock.mockRejectedValue(new Error('server down'));
      const onOpenChange = renderDialog({ type: 'board', tasks: undefined, stages });

      fireEvent.click(screen.getByTestId('share-action-download'));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Share failed', variant: 'destructive' }),
        );
      });
      expect(saveTextFileMock).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
