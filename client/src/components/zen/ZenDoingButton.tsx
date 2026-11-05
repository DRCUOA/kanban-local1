import type { ComponentType } from 'react';
import type { Project } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { zenProjectName, type ZenProjectName } from '@/lib/zen-doing';
import { cn } from '@/lib/utils';
import { EverydayIcon, type ZenProjectIconProps } from './EverydayIcon';

/** Each Zen project's own mark. Everyday is the only one so far. */
const ZEN_PROJECT_ICONS: Record<ZenProjectName, ComponentType<ZenProjectIconProps>> = {
  everyday: EverydayIcon,
};

const LABEL = 'Zen doing mode';

export interface ZenDoingButtonProps {
  /** The project the task is in, as the form has it now. */
  project: Pick<Project, 'name' | 'color'> | null | undefined;
  onStart: () => void;
  className?: string;
}

/**
 * The project's icon in the Edit Task header, which opens Zen doing mode.
 * Renders nothing for a project that has no Zen icon.
 */
export function ZenDoingButton({ project, onStart, className }: ZenDoingButtonProps) {
  const zenName = zenProjectName(project);
  if (!project || !zenName) return null;
  const Icon = ZEN_PROJECT_ICONS[zenName];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${LABEL}, ${project.name.trim()}`}
            className={cn('text-foreground/80 hover:text-foreground [&_svg]:size-7', className)}
            onClick={onStart}
            data-testid="zen-doing-start"
          >
            <Icon color={project.color} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="px-3 py-1.5 text-xs">
          {LABEL}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
