import { useEffect, useState } from 'react';
import type { Task, Stage } from '@shared/schema';
import { Copy, Download, FileJson, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/clipboard';
import { saveTextFile } from '@/lib/save-file';
import { fetchBoardBundle } from '@/lib/board-bundle';
import {
  buildShareContent,
  describeShareScope,
  type ShareFormat,
  type ShareScope,
} from '@/lib/task-share';
import { cn } from '@/lib/utils';

/**
 * What the dialog is sharing. `tasks` is the Task View's current task or the
 * board's multi-selection; `board` shares the full export bundle (the same
 * scope Export Tasks has always used) and carries the loaded tasks/stages so
 * the bundle can still be built when the server is unreachable.
 */
export type ShareDialogSource =
  | { type: 'tasks'; tasks: Task[]; stages: Stage[] }
  | { type: 'board'; tasks: Task[] | undefined; stages: Stage[] };

export interface ShareDialogProps {
  source: ShareDialogSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAT_LABEL: Record<ShareFormat, string> = { text: 'plain text', json: 'JSON' };

function dialogTitle(source: ShareDialogSource): string {
  if (source.type === 'board') return 'Share board';
  return source.tasks.length === 1 ? 'Share task' : `Share ${source.tasks.length} tasks`;
}

export function ShareDialog({ source, open, onOpenChange }: ShareDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ShareFormat>('text');
  const [busy, setBusy] = useState(false);

  // Each open starts from the same default rather than a stale earlier choice.
  useEffect(() => {
    if (open) setFormat('text');
  }, [open]);

  if (!source) return null;

  /**
   * Board content is resolved lazily on the chosen action, not on open, so
   * merely opening the dialog never hits the export endpoint.
   */
  const resolveScope = async (): Promise<{ scope: ShareScope; degraded: boolean }> => {
    if (source.type === 'tasks') {
      return {
        scope: { type: 'tasks', tasks: source.tasks, stages: source.stages },
        degraded: false,
      };
    }
    const { bundle, degraded } = await fetchBoardBundle({
      tasks: source.tasks,
      stages: source.stages,
    });
    return { scope: { type: 'board', bundle }, degraded };
  };

  const notifyDegraded = (degraded: boolean) => {
    if (!degraded) return;
    toast({
      title: 'Shared from this device',
      description: 'The server export was unavailable, so stages and sub-stages were omitted.',
    });
  };

  const runAction = async (action: (scope: ShareScope) => Promise<void>) => {
    setBusy(true);
    try {
      const { scope, degraded } = await resolveScope();
      await action(scope);
      notifyDegraded(degraded);
    } catch (error: unknown) {
      toast({
        title: 'Share failed',
        description: error instanceof Error ? error.message : 'Could not build the share content.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () =>
    runAction(async (scope) => {
      const content = buildShareContent(scope, format, new Date());
      const copied = await copyToClipboard({ text: content.text, html: content.html });
      if (!copied) {
        toast({
          title: 'Copy failed',
          description: 'Your browser blocked clipboard access.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Copied to clipboard',
        description: `Copied ${describeShareScope(scope)} as ${FORMAT_LABEL[format]}.`,
      });
      onOpenChange(false);
    });

  const handleDownload = () =>
    runAction(async (scope) => {
      const content = buildShareContent(scope, format, new Date());
      const result = await saveTextFile({
        filename: content.filename,
        content: content.text,
        mimeType: content.mimeType,
        description: format === 'json' ? 'JSON export' : 'Plain text export',
      });
      if (result === 'cancelled') return; // user closed the picker — not an error
      toast({
        title: result === 'saved' ? 'File saved' : 'Download started',
        description: content.filename,
      });
      onOpenChange(false);
    });

  const formatOption = (value: ShareFormat, label: string, Icon: typeof FileText) => {
    const selected = format === value;
    return (
      <Button
        type="button"
        variant="outline"
        aria-pressed={selected}
        data-testid={`share-format-${value}`}
        className={cn(
          'h-12 rounded-xl flex-1',
          selected && 'ring-2 ring-primary text-primary bg-primary/10',
        )}
        onClick={() => {
          setFormat(value);
        }}
      >
        <Icon className="h-4 w-4 mr-2" />
        {label}
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">{dialogTitle(source)}</DialogTitle>
          <DialogDescription className="text-sm">
            Choose a format, then copy it to the clipboard or download it as a file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="group" aria-label="Format">
          {formatOption('text', 'Plain text', FileText)}
          {formatOption('json', 'JSON', FileJson)}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            disabled={busy}
            className="h-12 rounded-xl"
            data-testid="share-action-copy"
            onClick={() => void handleCopy()}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to clipboard
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-12 rounded-xl"
            data-testid="share-action-download"
            onClick={() => void handleDownload()}
          >
            <Download className="h-4 w-4 mr-2" />
            Download file
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
