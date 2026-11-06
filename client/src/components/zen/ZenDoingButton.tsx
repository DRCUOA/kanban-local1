import type { Project } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ZenIcon } from './ZenIcon';

const LABEL = 'Zen doing mode';

export interface ZenDoingButtonProps {
  /** The project the task is in, as the form has it now; null for a task with none. */
  project: Pick<Project, 'name' | 'color'> | null | undefined;
  onStart: () => void;
  className?: string;
}

/**
 * The Zen icon in the Edit Task header, which opens Zen doing mode. It is on
 * every task, whatever its project: the sun takes the project's colour, and a
 * task with no project gets the default one.
 */
export function ZenDoingButton({ project, onStart, className }: ZenDoingButtonProps) {
  const projectName = project?.name.trim();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={projectName ? `${LABEL}, ${projectName}` : LABEL}
            className={cn('text-foreground/80 hover:text-foreground [&_svg]:size-7', className)}
            onClick={onStart}
            data-testid="zen-doing-start"
          >
            <ZenIcon color={project?.color} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="px-3 py-1.5 text-xs">
          {LABEL}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
