import type { Task } from '@shared/schema';
import type { Schedule } from '@shared/schedule';
import type { OutsideWait } from '@shared/goal-view';
import { summarisePlan } from '@shared/plan-summary';
import { cn } from '@/lib/utils';

/**
 * The plan in words, under each diagram: a short write-up, then every step
 * with when it runs, how much room it has, and what it waits for. Built from
 * the same schedule the diagram draws (shared/plan-summary.ts).
 */
export function PlanWriteUp({
  schedule,
  tasks,
  anchor,
  waits,
  order,
  onTaskClick,
}: {
  schedule: Schedule;
  tasks: Task[];
  anchor: Date;
  waits?: Map<number, OutsideWait[]>;
  order: 'critical' | 'gantt';
  onTaskClick: (task: Task) => void;
}) {
  const { paragraphs, steps } = summarisePlan({ schedule, tasks, anchor, waits, order });
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <section className="space-y-5" data-testid={`plan-write-up-${order}`}>
      <div className="max-w-[68ch] space-y-2">
        <h3 className="text-sm font-semibold">In short</h3>
        {paragraphs.map((p) => (
          <p key={p} className="text-sm leading-relaxed">
            {p}
          </p>
        ))}
      </div>

      {steps.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            {order === 'critical' ? 'The steps, critical path first' : 'The steps, in date order'}
          </h3>
          <ol className="divide-y rounded-md border">
            {steps.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    const t = byId.get(s.id);
                    if (t) onTaskClick(t);
                  }}
                  className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                      s.critical
                        ? 'bg-primary text-primary-foreground'
                        : s.done
                          ? 'border border-dashed text-muted-foreground'
                          : 'border',
                    )}
                    aria-hidden
                  >
                    {s.done ? '✓' : s.n}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{s.title}</span>{' '}
                    <span className="text-muted-foreground">#{s.id}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.when} {s.slack}
                    </span>
                    {s.notes.map((n) => (
                      <span
                        key={n}
                        className={cn(
                          'block text-xs',
                          n.includes('misses') || n.includes('not done yet')
                            ? 'text-warning'
                            : 'text-muted-foreground',
                        )}
                      >
                        {n}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
