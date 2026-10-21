import { useId, useState } from 'react';
import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';
import { ChevronRight, Inbox, Mail } from 'lucide-react';
import type { Task } from '@shared/schema';
import { DEFAULT_PROJECT_COLOR } from '@shared/constants';
import { useProjectScope } from '@/hooks/use-project-scope';
import { cn } from '@/lib/utils';

/** Rows shown before "Show all": enough to triage from without pushing the filters off screen. */
export const INBOX_PREVIEW = 5;

function arrivedLabel(createdAt: Date | string | null): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return differenceInCalendarDays(new Date(), date) < 7
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : format(date, 'd MMM');
}

/**
 * The inbox: tasks mail made that nobody has opened, newest first, at the top
 * of the landing page. It is not a filter: a row opens its task here, and the
 * task leaves the inbox once it has been opened. The board shows it like any
 * other task, wherever the filters below put it.
 */
export function LandingInbox({
  tasks,
  onOpen,
}: {
  /** The inbox, already newest first (`inboxTasks`). */
  tasks: Task[];
  onOpen: (task: Task) => void;
}) {
  const headingId = useId();
  const [showAll, setShowAll] = useState(false);
  const { projectById, projects } = useProjectScope();
  const shown = showAll ? tasks : tasks.slice(0, INBOX_PREVIEW);
  const hidden = tasks.length - shown.length;

  return (
    <section
      aria-labelledby={headingId}
      className="neo-raised overflow-hidden"
      data-testid="landing-inbox"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Inbox className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <h2 id={headingId} className="label-caps text-[11px] text-foreground">
          Inbox
        </h2>
        <span
          className={cn(
            'inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
            tasks.length > 0
              ? 'bg-warning text-warning-foreground'
              : 'bg-secondary text-muted-foreground',
          )}
          aria-label={`${tasks.length} new`}
          data-testid="inbox-count"
        >
          {tasks.length}
        </span>
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Emailed in and not yet opened
        </p>
      </div>

      {tasks.length === 0 ? (
        <p
          className="border-t border-border-subtle px-4 py-4 text-sm text-muted-foreground"
          data-testid="inbox-empty"
        >
          Nothing new. Mail sent to the board lands here until you open it.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {shown.map((task) => {
            const project = task.projectId == null ? null : projectById(task.projectId);
            const arrived = arrivedLabel(task.createdAt);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:bg-muted/60"
                  onClick={() => {
                    onOpen(task);
                  }}
                  aria-label={`Open ${task.title}${arrived ? `, arrived ${arrived}` : ''}`}
                  data-testid={`inbox-task-${task.id}`}
                >
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {task.title}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {projects.length > 0 && (
                        <>
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              !project && 'border border-dashed border-muted-foreground',
                            )}
                            style={
                              project
                                ? { backgroundColor: project.color ?? DEFAULT_PROJECT_COLOR }
                                : undefined
                            }
                            aria-hidden
                          />
                          <span className="truncate">{project?.name ?? 'No project'}</span>
                          {arrived && <span aria-hidden>·</span>}
                        </>
                      )}
                      {arrived && <span className="shrink-0 tabular-nums">{arrived}</span>}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(hidden > 0 || showAll) && tasks.length > INBOX_PREVIEW && (
        <button
          type="button"
          className="flex min-h-[2.75rem] w-full items-center justify-center border-t border-border-subtle px-4 text-xs font-medium text-primary transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          aria-expanded={showAll}
          onClick={() => {
            setShowAll(!showAll);
          }}
          data-testid="inbox-show-all"
        >
          {showAll ? 'Show fewer' : `Show all ${tasks.length}`}
        </button>
      )}
    </section>
  );
}
