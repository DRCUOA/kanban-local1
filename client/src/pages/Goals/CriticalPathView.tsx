import { addDays, format } from 'date-fns';
import { ArrowDown } from 'lucide-react';
import type { Task } from '@shared/schema';
import type { Schedule } from '@shared/schedule';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The longest chain of dependent work in the goal: the tasks that decide when
 * it can finish. Anything off it has slack and can slip that many days without
 * moving the end. Dates run from `anchor`, which is today.
 */
export function CriticalPathView({
  schedule,
  tasks,
  anchor,
  onTaskClick,
}: {
  schedule: Schedule;
  tasks: Task[];
  anchor: Date;
  onTaskClick: (task: Task) => void;
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const onPath = new Set(schedule.criticalPath.map((i) => i.id));
  const parallel = schedule.order.filter((i) => i.critical && !onPath.has(i.id) && i.duration > 0);
  const others = schedule.order.filter((i) => !i.critical);

  if (schedule.criticalPath.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="critical-path-empty">
        Nothing left to schedule: every task in this goal is finished.
      </p>
    );
  }

  const row = (id: number, line: string, onClick: () => void) => {
    const t = byId.get(id);
    if (!t) return null;
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
      >
        <span className="text-muted-foreground">#{t.id}</span>{' '}
        <span className="font-medium">{t.title}</span>
        <span className="block text-xs text-muted-foreground">{line}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6" data-testid="critical-path">
      <p className="text-sm">
        <span className="font-semibold">{plural(schedule.length, 'day')}</span> of work on the
        critical path, finishing around{' '}
        <span className="font-semibold">
          {format(addDays(anchor, schedule.length), 'd MMM yyyy')}
        </span>{' '}
        if it starts today.
      </p>

      <ol className="space-y-1">
        {schedule.criticalPath.map((item, i) => (
          <li key={item.id}>
            {i > 0 && (
              <ArrowDown className="mx-auto my-1 h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            {row(
              item.id,
              `${plural(item.duration, 'day')} · ${format(addDays(anchor, item.start), 'd MMM')} → ${format(addDays(anchor, item.finish), 'd MMM')}`,
              () => {
                const t = byId.get(item.id);
                if (t) onTaskClick(t);
              },
            )}
          </li>
        ))}
      </ol>

      {parallel.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Also critical (a parallel chain of the same length)
          </h3>
          <ul className="space-y-1">
            {parallel.map((item) => (
              <li key={item.id}>
                {row(item.id, plural(item.duration, 'day'), () => {
                  const t = byId.get(item.id);
                  if (t) onTaskClick(t);
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Has slack
          </h3>
          <ul className="space-y-1">
            {others.map((item) => (
              <li key={item.id}>
                {row(
                  item.id,
                  item.duration === 0
                    ? 'Finished'
                    : `${plural(item.duration, 'day')} · can slip ${plural(item.slack, 'day')}`,
                  () => {
                    const t = byId.get(item.id);
                    if (t) onTaskClick(t);
                  },
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
