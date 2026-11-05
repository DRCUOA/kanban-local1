import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { Stage, SubStage, Task } from '@shared/schema';
import { buildTaskTransferBundle } from '@shared/export';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjectScope } from '@/hooks/use-project-scope';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

const LABEL = 'Copy JSON to clipboard';
/** How long the icon shows its tick after a copy. */
const COPIED_FEEDBACK_MS = 1500;

export interface CopyTaskJsonButtonProps {
  task: Task;
  stages: Stage[];
  subStages: SubStage[];
  className?: string;
}

/**
 * Copies one task in the JSON format the `addtask` skill writes, so it can be
 * pasted into a file for Import Tasks or handed to a session as it stands.
 */
export function CopyTaskJsonButton({
  task,
  stages,
  subStages,
  className,
}: CopyTaskJsonButtonProps) {
  const { projects } = useProjectScope();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_FEEDBACK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const handleCopy = async () => {
    const bundle = buildTaskTransferBundle({
      task,
      stages,
      subStages,
      projects,
      exportedAt: new Date().toISOString(),
    });
    const didCopy = await copyToClipboard({ text: JSON.stringify(bundle, null, 2) });
    if (!didCopy) {
      toast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      });
      return;
    }
    setCopied(true);
    // The format carries no file bytes, and an import drops a link it has no
    // file for, so say so at the moment that can still be acted on.
    const filesNote = task.description?.includes('data-file-chip')
      ? ' Its attached files are not included.'
      : '';
    toast({
      title: 'Copied to clipboard',
      description: `Copied task #${task.id} as JSON.${filesNote}`,
    });
  };

  const Icon = copied ? Check : Copy;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={LABEL}
            className={cn('text-muted-foreground hover:text-foreground', className)}
            onClick={() => {
              void handleCopy();
            }}
            data-testid="task-copy-json"
          >
            <Icon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="px-3 py-1.5 text-xs">
          {LABEL}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
