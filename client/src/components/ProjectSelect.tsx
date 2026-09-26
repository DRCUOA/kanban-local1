import type { ComponentPropsWithoutRef } from 'react';
import { DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { useProjectScope } from '@/hooks/use-project-scope';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const NO_PROJECT = '__none__';

export interface ProjectSelectProps extends Omit<
  ComponentPropsWithoutRef<typeof SelectTrigger>,
  'value' | 'onChange'
> {
  value: number | null | undefined;
  onChange: (next: number | null) => void;
}

/**
 * The project field on the task forms: "No project" plus every active project.
 * A project the task already belongs to stays selectable even when archived,
 * so opening an old task never silently moves it. Trigger props (id, aria-*)
 * are forwarded so the field works inside `FormControl`.
 */
export function ProjectSelect({ value, onChange, className, ...triggerProps }: ProjectSelectProps) {
  const { activeProjects, projectById } = useProjectScope();
  const current = projectById(value);
  const options =
    current && !activeProjects.some((p) => p.id === current.id)
      ? [...activeProjects, current]
      : activeProjects;

  return (
    <Select
      value={value == null ? NO_PROJECT : String(value)}
      onValueChange={(next) => {
        onChange(next === NO_PROJECT ? null : Number(next));
      }}
    >
      <SelectTrigger className={cn('h-12 rounded-xl', className)} {...triggerProps}>
        <SelectValue placeholder="No project" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_PROJECT} className="py-3">
          No project
        </SelectItem>
        {options.map((project) => (
          <SelectItem key={project.id} value={String(project.id)} className="py-3">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color ?? DEFAULT_PROJECT_COLOR }}
                aria-hidden
              />
              <span>{project.name}</span>
              {project.archived && (
                <span className="text-[10px] text-muted-foreground">(archived)</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
