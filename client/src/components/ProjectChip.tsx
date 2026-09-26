import type { Project } from '@shared/schema';
import { DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProjectChipProps {
  project: Pick<Project, 'name' | 'key' | 'color'>;
  /** Show the full name even when the project has a short key. */
  full?: boolean;
  className?: string;
  testId?: string;
}

/**
 * The colour dot and short label that says which project a task belongs to.
 * One line of ink: the key when the project has one, the name otherwise, and
 * the full name as the tooltip either way.
 */
export function ProjectChip({
  project,
  full = false,
  className,
  testId = 'project-chip',
}: ProjectChipProps) {
  const label = !full && project.key ? project.key : project.name;
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 min-h-0 min-w-0 max-w-[140px] gap-1 px-1.5 py-0 text-xs font-normal touch-target-sm',
        className,
      )}
      title={project.name}
      data-testid={testId}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: project.color ?? DEFAULT_PROJECT_COLOR }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
