import { useState } from 'react';
import { ChevronDown, FolderKanban } from 'lucide-react';
import { DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { PROJECT_SCOPE_ALL, PROJECT_SCOPE_NONE, type ProjectScope } from '@shared/project-scope';
import { useProjectScope } from '@/hooks/use-project-scope';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Header control that scopes the board to one project. It stays hidden until a
 * project exists — no new UI before there is something to choose — and "All
 * projects" is always one row away, so a scope can never hide work for good.
 * Each project row shows its live task count: the volume a scoped view hides.
 */
export function ProjectSelector({ className }: { className?: string }) {
  const { scope, setScope, projects, activeProjects, currentProject } = useProjectScope();
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  // An archived project that is still the scope stays listed so the header can
  // name it and the user can leave it; other archived projects are not offered.
  const options =
    currentProject && currentProject.archived
      ? [...activeProjects, currentProject]
      : activeProjects;

  const label = currentProject
    ? currentProject.name
    : scope === PROJECT_SCOPE_NONE
      ? 'No project'
      : 'All projects';

  const choose = (next: ProjectScope) => () => {
    setScope(next);
    setOpen(false);
  };

  const row = (active: boolean) =>
    cn(
      'w-full flex items-center gap-3 p-3 rounded-lg text-sm text-left transition-colors',
      active ? 'bg-primary/10 font-semibold text-primary' : 'active:bg-muted/50',
    );

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Project: ${label}`}
        className="flex h-10 max-w-[12rem] items-center gap-2 rounded-xl px-3 text-sm font-medium neo-raised transition-all active:scale-95"
        onClick={() => {
          setOpen(!open);
        }}
        data-testid="project-selector-trigger"
      >
        {currentProject ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: currentProject.color ?? DEFAULT_PROJECT_COLOR }}
            aria-hidden
          />
        ) : (
          <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => {
              setOpen(false);
            }}
          />

          <div
            role="menu"
            aria-label="Project"
            // The trigger sits at the left of a phone header and the right of a
            // wide one, so the menu hangs from whichever edge keeps it on screen.
            className="absolute left-0 top-full z-50 mt-2 max-h-[calc(100dvh-5rem)] w-60 overflow-y-auto animate-slide-up neo-raised rounded-xl p-2 lg:left-auto lg:right-0"
          >
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Project
            </p>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={scope === PROJECT_SCOPE_ALL}
              className={row(scope === PROJECT_SCOPE_ALL)}
              onClick={choose(PROJECT_SCOPE_ALL)}
              data-testid="project-selector-item-all"
            >
              <FolderKanban className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">All projects</span>
            </button>
            {options.map((project) => {
              const active = scope === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className={row(active)}
                  onClick={choose(project.id)}
                  data-testid={`project-selector-item-${project.id}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color ?? DEFAULT_PROJECT_COLOR }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">
                    {project.name}
                    {project.archived && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(archived)</span>
                    )}
                  </span>
                  <Badge
                    variant="secondary"
                    className="h-5 min-h-0 min-w-0 rounded-md px-1.5 py-0 font-mono text-[10px] neo-pressed"
                    aria-label={`${project.taskCount} tasks`}
                  >
                    {project.taskCount}
                  </Badge>
                </button>
              );
            })}

            <div className="my-1 border-t border-border-subtle" />

            <button
              type="button"
              role="menuitemradio"
              aria-checked={scope === PROJECT_SCOPE_NONE}
              className={row(scope === PROJECT_SCOPE_NONE)}
              onClick={choose(PROJECT_SCOPE_NONE)}
              data-testid="project-selector-item-none"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground"
                aria-hidden
              />
              <span className="flex-1 truncate">No project</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
