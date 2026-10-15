import { addDays, differenceInCalendarDays, format } from 'date-fns';
import type { Task } from '@shared/schema';
import type { Schedule } from '@shared/schedule';

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
export function GanttChart({ schedule, tasks, anchor, onTaskClick }: GanttChartProps) {
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
    <div className="overflow-x-auto rounded-md border" data-testid="gantt-chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Gantt chart of ${rows.length} tasks over ${schedule.length} days`}
        className="block text-foreground"
      >
        <defs>
          <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
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
                    className={r.critical ? 'fill-danger' : 'fill-primary'}
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
                      className="fill-primary/25"
                    />
                  )}
                </>
              )}
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
  );
}
