import { addDays, differenceInCalendarDays, format } from 'date-fns';
import type { Task } from '@shared/schema';
import type { Schedule } from '@shared/schedule';
import { describeOutsideWait, type OutsideWait } from '@shared/goal-view';

const LABEL_W = 230;
const ROW_H = 34;
const AXIS_H = 44;
const BAR_H = 18;
const MAX_DAYS = 365;

export interface GanttChartProps {
  schedule: Schedule;
  tasks: Task[];
  /** The date day 0 falls on. */
  anchor: Date;
  onTaskClick: (task: Task) => void;
  /** Per block, work outside the goal it starts after (drawn as a marker; dates do not move for it). */
  waits?: Map<number, OutsideWait[]>;
}

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * The goal's tasks as bars on a day axis, in dependency order. A bar starts as
 * soon as everything it waits on has finished (earliest start). Critical-path
 * bars are red; the rest are blue with their slack shown. Lines join each task
 * to the ones that wait on it, and a diamond marks a due date (red when the
 * scheduled finish lands after it). Finished work is a short hollow marker,
 * since it takes no time.
 */
export function GanttChart({ schedule, tasks, anchor, onTaskClick, waits }: GanttChartProps) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const rows = schedule.order;
  const dueOffset = (t: Task): number | null =>
    t.dueDate ? differenceInCalendarDays(new Date(t.dueDate), anchor) : null;

  const lastDue = Math.max(
    0,
    ...rows.map((r) => {
      const t = byId.get(r.id);
      return (t ? dueOffset(t) : null) ?? 0;
    }),
  );
  const days = Math.min(MAX_DAYS, Math.max(schedule.length, lastDue, 1));
  const dayW = Math.min(44, Math.max(10, Math.floor(760 / days)));
  const width = LABEL_W + days * dayW + 56;
  const height = AXIS_H + rows.length * ROW_H + 8;
  const x = (day: number): number => LABEL_W + day * dayW;
  const rowIndex = new Map(rows.map((r, i) => [r.id, i]));
  const tickEvery = dayW >= 24 ? 1 : 7;

  const ticks: number[] = [];
  for (let d = 0; d <= days; d += tickEvery) ticks.push(d);

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto rounded-md border bg-card" data-testid="gantt-chart">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Gantt chart of ${rows.length} tasks over ${schedule.length} days`}
          className="block text-foreground"
        >
          <defs>
            <marker
              id="gantt-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 z" className="fill-muted-foreground" />
            </marker>
          </defs>

          {/* Day grid and axis labels. */}
          {ticks.map((d) => (
            <g key={d}>
              <line
                x1={x(d)}
                x2={x(d)}
                y1={AXIS_H - 6}
                y2={height}
                className="stroke-border"
                strokeWidth={d === 0 ? 1.5 : 1}
              />
              <text x={x(d) + 3} y={AXIS_H - 12} className="fill-muted-foreground" fontSize="10">
                {format(addDays(anchor, d), tickEvery === 1 ? 'd MMM' : 'd MMM')}
              </text>
            </g>
          ))}
          <text x={x(0) + 3} y={12} className="fill-muted-foreground" fontSize="10">
            Today
          </text>

          {/* Rows: label, bar, due marker. */}
          {rows.map((r, i) => {
            const task = byId.get(r.id);
            if (!task) return null;
            const y = AXIS_H + i * ROW_H;
            const cy = y + ROW_H / 2;
            const due = dueOffset(task);
            const late = due !== null && r.finish > due;
            const finished = r.duration === 0;
            return (
              <g
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={`${task.title}, day ${r.start + 1} to ${r.finish}${r.critical ? ', critical' : `, slack ${r.slack} days`}`}
                className="cursor-pointer outline-none focus-visible:[&>rect:first-child]:stroke-primary"
                onClick={() => {
                  onTaskClick(task);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTaskClick(task);
                  }
                }}
              >
                <rect
                  x={0}
                  y={y}
                  width={width}
                  height={ROW_H}
                  className="fill-transparent hover:fill-muted/40"
                />
                <text x={8} y={cy + 4} fontSize="12" className="fill-foreground">
                  <title>{task.title}</title>#{task.id} {clip(task.title, 26)}
                </text>
                {finished ? (
                  <rect
                    x={x(r.start)}
                    y={cy - BAR_H / 2}
                    width={10}
                    height={BAR_H}
                    rx={3}
                    className="fill-transparent stroke-muted-foreground"
                    strokeDasharray="3 2"
                  >
                    <title>{`${task.title}: finished`}</title>
                  </rect>
                ) : (
                  <>
                    <rect
                      x={x(r.start)}
                      y={cy - BAR_H / 2}
                      width={Math.max(r.duration * dayW - 2, 4)}
                      height={BAR_H}
                      rx={4}
                      className={r.critical ? 'fill-primary' : 'fill-muted-foreground/45'}
                    >
                      <title>{`${task.title}: day ${r.start + 1} to ${r.finish}${r.critical ? ' (critical)' : `, slack ${r.slack}d`}`}</title>
                    </rect>
                    {/* Where it could slip to without delaying the end. */}
                    {!r.critical && r.slack > 0 && (
                      <rect
                        x={x(r.finish) - 2}
                        y={cy - 2}
                        width={r.slack * dayW}
                        height={4}
                        rx={2}
                        className="fill-muted-foreground/20"
                      />
                    )}
                  </>
                )}
                {/* Starts after work outside this goal: a flag just before the bar,
                  amber while any of it is still open. */}
                {(() => {
                  const outside = waits?.get(r.id) ?? [];
                  if (outside.length === 0) return null;
                  const open = outside.some((w) => !w.done);
                  const x0 = x(r.start);
                  return (
                    <g data-testid={`gantt-starts-after-${r.id}`}>
                      <line
                        x1={x0 - 3}
                        x2={x0 - 3}
                        y1={cy - 12}
                        y2={cy + 12}
                        strokeWidth={2}
                        strokeDasharray="3 2"
                        className={open ? 'stroke-warning' : 'stroke-muted-foreground'}
                      />
                      <path
                        d={`M${x0 - 13},${cy - 6} l8,6 l-8,6 z`}
                        className={open ? 'fill-warning' : 'fill-muted-foreground'}
                      >
                        <title>{`Starts after (outside this goal, not in these dates):\n${outside.map(describeOutsideWait).join('\n')}`}</title>
                      </path>
                    </g>
                  );
                })()}
                {due !== null && due >= 0 && due <= days && (
                  <path
                    d={`M${x(due)},${cy - 9} l6,9 l-6,9 l-6,-9 z`}
                    className={
                      late ? 'fill-danger stroke-background' : 'fill-warning stroke-background'
                    }
                  >
                    <title>{`Due ${format(new Date(task.dueDate ?? anchor), 'd MMM yyyy')}${late ? ' — scheduled after this' : ''}`}</title>
                  </path>
                )}
              </g>
            );
          })}

          {/* Dependency lines, drawn last so they sit above the bars. */}
          {rows.flatMap((r) =>
            r.successors.map((sId) => {
              const s = schedule.byId.get(sId);
              const from = rowIndex.get(r.id);
              const to = rowIndex.get(sId);
              if (!s || from === undefined || to === undefined) return null;
              const x1 = x(r.finish) - (r.duration === 0 ? 0 : 2);
              const y1 = AXIS_H + from * ROW_H + ROW_H / 2;
              const x2 = x(s.start);
              const y2 = AXIS_H + to * ROW_H + ROW_H / 2;
              const xm = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
              return (
                <path
                  key={`${r.id}-${sId}`}
                  d={`M${x1},${y1} H${xm} V${y2} H${x2 - 1}`}
                  className="fill-none stroke-muted-foreground"
                  strokeWidth={1}
                  markerEnd="url(#gantt-arrow)"
                />
              );
            }),
          )}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-primary" /> Critical path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-muted-foreground/45" /> Has slack
          <span className="h-1 w-5 rounded-sm bg-muted-foreground/20" /> room to slip
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-warning" /> Due date (red when missed)
        </span>
        {waits && waits.size > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-2 bg-warning [clip-path:polygon(0_0,100%_50%,0_100%)]" /> Starts
            after work outside this goal
          </span>
        )}
      </figcaption>
    </figure>
  );
}
