import { addDays, format } from 'date-fns';
import type { Task } from '@shared/schema';
import type { Schedule, ScheduledItem } from '@shared/schedule';
import { describeOutsideWait, type OutsideWait } from '@shared/goal-view';

const NODE_W = 176;
const NODE_H = 56;
const GAP_X = 48;
const GAP_Y = 18;
const PAD = 20;
const PILL_W = 76;
const PILL_H = 32;

interface Edge {
  key: string;
  d: string;
  critical: boolean;
}

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * The goal as a network: each building-block a card, placed in a column by how
 * many steps of dependent work come before it, with arrows from what it waits
 * for. The critical path is drawn solid in the accent with a slow flowing dash
 * (still when the viewer prefers reduced motion); cards with room to move are
 * outlined, finished ones dashed. Start and Finish bracket the chain, and the
 * total length sits on the Finish pill.
 */
export function CriticalPathDiagram({
  schedule,
  tasks,
  anchor,
  onTaskClick,
  waits,
}: {
  schedule: Schedule;
  tasks: Task[];
  anchor: Date;
  onTaskClick: (task: Task) => void;
  waits?: Map<number, OutsideWait[]>;
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const onPath = new Set(schedule.criticalPath.map((i) => i.id));
  const pathEdge = new Set(
    schedule.criticalPath.slice(1).map((i, k) => `${schedule.criticalPath[k]?.id ?? 0}>${i.id}`),
  );

  // Column = longest run of predecessors before it (schedule.order is topological).
  const level = new Map<number, number>();
  for (const item of schedule.order) {
    level.set(item.id, Math.max(-1, ...item.predecessors.map((p) => level.get(p) ?? 0)) + 1);
  }
  const columns: ScheduledItem[][] = [];
  for (const item of schedule.order) {
    const l = level.get(item.id) ?? 0;
    (columns[l] ??= []).push(item);
  }
  // Critical cards first in each column so the path reads as a straight line along the top.
  for (const col of columns) {
    col.sort((a, b) => Number(onPath.has(b.id)) - Number(onPath.has(a.id)) || a.start - b.start);
  }
  const rows = Math.max(1, ...columns.map((c) => c.length));
  const height = PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y;
  const colX = (l: number) => PAD + PILL_W + GAP_X + l * (NODE_W + GAP_X);
  const width = colX(columns.length) + PILL_W + PAD;
  const pos = new Map<number, { x: number; y: number }>();
  columns.forEach((col, l) => {
    col.forEach((item, r) => {
      pos.set(item.id, { x: colX(l), y: PAD + r * (NODE_H + GAP_Y) });
    });
  });
  const midY = PAD + NODE_H / 2;
  const start = { x: PAD, y: midY - PILL_H / 2 };
  const finish = { x: colX(columns.length), y: midY - PILL_H / 2 };

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(24, (x2 - x1) / 2);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  const edges: Edge[] = [];
  for (const item of schedule.order) {
    const to = pos.get(item.id);
    if (!to) continue;
    if (item.predecessors.length === 0) {
      edges.push({
        key: `start>${item.id}`,
        d: curve(start.x + PILL_W, midY, to.x - 6, to.y + NODE_H / 2),
        critical: schedule.criticalPath[0]?.id === item.id,
      });
    }
    for (const p of item.predecessors) {
      const from = pos.get(p);
      if (!from) continue;
      edges.push({
        key: `${p}>${item.id}`,
        d: curve(from.x + NODE_W, from.y + NODE_H / 2, to.x - 6, to.y + NODE_H / 2),
        critical: pathEdge.has(`${p}>${item.id}`),
      });
    }
    if (item.successors.length === 0) {
      edges.push({
        key: `${item.id}>finish`,
        d: curve(to.x + NODE_W, to.y + NODE_H / 2, finish.x - 6, midY),
        critical: schedule.criticalPath[schedule.criticalPath.length - 1]?.id === item.id,
      });
    }
  }
  // Critical edges last so they sit on top.
  edges.sort((a, b) => Number(a.critical) - Number(b.critical));

  const finishDate = format(addDays(anchor, schedule.length), 'd MMM');

  return (
    <figure className="space-y-2" data-testid="critical-path-diagram">
      <div className="overflow-x-auto rounded-md border bg-card">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Network of ${schedule.order.length} tasks; the critical path runs through ${schedule.criticalPath.length} of them over ${schedule.length} days`}
          className="block"
        >
          <style>{`
            .cp-flow { stroke-dasharray: 7 5; animation: cp-flow 1.4s linear infinite; }
            @keyframes cp-flow { to { stroke-dashoffset: -24; } }
            @media (prefers-reduced-motion: reduce) { .cp-flow { animation: none; stroke-dasharray: none; } }
            .cp-node:focus-visible > rect:first-of-type { stroke: hsl(var(--ring)); stroke-width: 3; }
          `}</style>
          <defs>
            <marker id="cp-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground" />
            </marker>
            <marker
              id="cp-arrow-hot"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 z" className="fill-primary" />
            </marker>
          </defs>

          {edges.map((e) =>
            e.critical ? (
              <g key={e.key}>
                <path d={e.d} className="fill-none stroke-primary/20" strokeWidth={8} />
                <path
                  d={e.d}
                  className="cp-flow fill-none stroke-primary"
                  strokeWidth={2.5}
                  markerEnd="url(#cp-arrow-hot)"
                />
              </g>
            ) : (
              <path
                key={e.key}
                d={e.d}
                className="fill-none stroke-muted-foreground/60"
                strokeWidth={1.25}
                markerEnd="url(#cp-arrow)"
              />
            ),
          )}

          {/* Start and Finish. */}
          <g>
            <rect
              x={start.x}
              y={start.y}
              width={PILL_W}
              height={PILL_H}
              rx={PILL_H / 2}
              className="fill-foreground"
            />
            <text
              x={start.x + PILL_W / 2}
              y={start.y + 21}
              textAnchor="middle"
              fontSize="12"
              fontWeight={600}
              className="fill-background"
            >
              Today
            </text>
          </g>
          <g>
            <rect
              x={finish.x}
              y={finish.y - 8}
              width={PILL_W}
              height={PILL_H + 16}
              rx={10}
              className="fill-foreground"
            />
            <text
              x={finish.x + PILL_W / 2}
              y={finish.y + 12}
              textAnchor="middle"
              fontSize="11"
              className="fill-background"
            >
              Finish
            </text>
            <text
              x={finish.x + PILL_W / 2}
              y={finish.y + 28}
              textAnchor="middle"
              fontSize="13"
              fontWeight={700}
              className="fill-background"
            >
              {finishDate}
            </text>
          </g>

          {schedule.order.map((item) => {
            const task = byId.get(item.id);
            const p = pos.get(item.id);
            if (!task || !p) return null;
            const critical = onPath.has(item.id);
            const done = item.duration === 0;
            const outside = waits?.get(item.id) ?? [];
            const openOutside = outside.some((w) => !w.done);
            const sub = done
              ? '✓ Done'
              : `${item.duration}d · ${critical ? 'critical' : `slack ${item.slack}d`}`;
            return (
              <g
                key={item.id}
                className="cp-node cursor-pointer outline-none"
                role="button"
                tabIndex={0}
                aria-label={`${task.title}: ${done ? 'done' : `${item.duration} days, ${critical ? 'on the critical path' : `${item.slack} days of slack`}`}`}
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
                  x={p.x}
                  y={p.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  strokeWidth={critical ? 0 : 1.25}
                  strokeDasharray={done ? '4 3' : undefined}
                  className={
                    critical
                      ? 'fill-primary'
                      : done
                        ? 'fill-muted/50 stroke-muted-foreground'
                        : 'fill-card stroke-border hover:stroke-primary'
                  }
                />
                {critical && (
                  <rect
                    x={p.x}
                    y={p.y}
                    width={4}
                    height={NODE_H}
                    rx={2}
                    className="fill-primary-foreground/40"
                  />
                )}
                <text
                  x={p.x + 12}
                  y={p.y + 23}
                  fontSize="13"
                  fontWeight={600}
                  className={
                    critical
                      ? 'fill-primary-foreground'
                      : done
                        ? 'fill-muted-foreground'
                        : 'fill-foreground'
                  }
                >
                  <title>{task.title}</title>
                  {clip(task.title, 21)}
                </text>
                <text
                  x={p.x + 12}
                  y={p.y + 42}
                  fontSize="11"
                  className={critical ? 'fill-primary-foreground/85' : 'fill-muted-foreground'}
                >
                  #{task.id} · {sub}
                </text>
                {outside.length > 0 && (
                  <path
                    d={`M${p.x + NODE_W - 18},${p.y} h12 v12 l-6,-4 l-6,4 z`}
                    className={openOutside ? 'fill-warning' : 'fill-muted-foreground'}
                  >
                    <title>{`Starts after (outside this goal, not in these dates):\n${outside.map(describeOutsideWait).join('\n')}`}</title>
                  </path>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-primary" /> Critical path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm border bg-card" /> Has slack
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm border border-dashed border-muted-foreground" /> Done
        </span>
        {waits && waits.size > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 bg-warning [clip-path:polygon(0_0,100%_0,100%_100%,50%_70%,0_100%)]" />{' '}
            Starts after work outside this goal
          </span>
        )}
      </figcaption>
    </figure>
  );
}
