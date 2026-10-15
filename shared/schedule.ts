import type { TaskDependencyEdge } from './task-dependencies';

/** A unit of work to schedule. `duration` is in days and may be 0 (already finished). */
export interface ScheduleNode {
  id: number;
  duration: number;
  /** Tie-break when two tasks are otherwise equal; earlier sorts first. Optional. */
  tiebreak?: number;
}

export interface ScheduledItem {
  id: number;
  duration: number;
  /** Earliest start / finish, in days from day 0. */
  start: number;
  finish: number;
  /** Latest start / finish that does not delay the whole set. */
  lateStart: number;
  lateFinish: number;
  /** How far it can slip without delaying the end. 0 = critical. */
  slack: number;
  critical: boolean;
  predecessors: number[];
  successors: number[];
}

export interface Schedule {
  /** Every task, in a dependency-respecting order (a task never precedes its predecessors). */
  order: ScheduledItem[];
  byId: Map<number, ScheduledItem>;
  /** Total length in days: the longest chain of dependent work. */
  length: number;
  /** One longest chain, first task to last. Other critical tasks may run in parallel. */
  criticalPath: ScheduledItem[];
  /** True when the edges contain a loop, so no schedule exists. `order` is then empty. */
  cyclic: boolean;
}

/**
 * Critical path method over a dependency graph: a forward pass for earliest
 * start/finish, a backward pass for latest start/finish, slack as the
 * difference. Edges that mention a task outside `nodes` are ignored, so a goal
 * can be scheduled on its own even when a block also waits on work elsewhere.
 *
 * Pure and day-granular: it knows nothing about calendars. The caller anchors
 * day 0 to a date and decides what a task's duration is.
 */
export function computeSchedule(nodes: ScheduleNode[], edges: TaskDependencyEdge[]): Schedule {
  const ids = new Set(nodes.map((n) => n.id));
  const preds = new Map<number, number[]>();
  const succs = new Map<number, number[]>();
  for (const n of nodes) {
    preds.set(n.id, []);
    succs.set(n.id, []);
  }
  const seen = new Set<string>();
  for (const e of edges) {
    if (!ids.has(e.predecessorId) || !ids.has(e.successorId)) continue;
    const key = `${e.predecessorId}>${e.successorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    preds.get(e.successorId)?.push(e.predecessorId);
    succs.get(e.predecessorId)?.push(e.successorId);
  }

  const node = new Map(nodes.map((n) => [n.id, n]));
  const rank = (id: number): number => node.get(id)?.tiebreak ?? 0;

  // Forward pass in topological order (Kahn). Ties break by tiebreak, then id,
  // so the order is stable between renders.
  const indegree = new Map(nodes.map((n) => [n.id, preds.get(n.id)?.length ?? 0]));
  const start = new Map<number, number>();
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const sorted: number[] = [];
  const byReady = (a: number, b: number) => {
    const sa = start.get(a) ?? 0;
    const sb = start.get(b) ?? 0;
    return sa - sb || rank(a) - rank(b) || a - b;
  };
  while (ready.length > 0) {
    ready.sort(byReady);
    const id = ready.shift();
    if (id === undefined) break;
    sorted.push(id);
    const finish = (start.get(id) ?? 0) + (node.get(id)?.duration ?? 0);
    for (const s of succs.get(id) ?? []) {
      start.set(s, Math.max(start.get(s) ?? 0, finish));
      const d = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, d);
      if (d === 0) ready.push(s);
    }
  }
  if (sorted.length < nodes.length) {
    return { order: [], byId: new Map(), length: 0, criticalPath: [], cyclic: true };
  }

  const dur = (id: number) => node.get(id)?.duration ?? 0;
  const length = Math.max(0, ...sorted.map((id) => (start.get(id) ?? 0) + dur(id)));

  // Backward pass.
  const lateFinish = new Map<number, number>();
  for (const id of [...sorted].reverse()) {
    const next = succs.get(id) ?? [];
    lateFinish.set(
      id,
      next.length === 0
        ? length
        : Math.min(...next.map((s) => (lateFinish.get(s) ?? length) - dur(s))),
    );
  }

  const byId = new Map<number, ScheduledItem>();
  const order = sorted.map((id) => {
    const s = start.get(id) ?? 0;
    const lf = lateFinish.get(id) ?? length;
    const slack = lf - dur(id) - s;
    const item: ScheduledItem = {
      id,
      duration: dur(id),
      start: s,
      finish: s + dur(id),
      lateStart: lf - dur(id),
      lateFinish: lf,
      slack,
      critical: slack === 0,
      predecessors: preds.get(id) ?? [],
      successors: succs.get(id) ?? [],
    };
    byId.set(id, item);
    return item;
  });

  // One longest chain: begin at a critical task that starts at day 0, then keep
  // stepping to a critical successor that starts exactly when this one finishes.
  const criticalPath: ScheduledItem[] = [];
  let cur = order.find((i) => i.critical && i.start === 0 && i.finish > 0);
  while (cur) {
    criticalPath.push(cur);
    const here: ScheduledItem = cur;
    cur = here.successors
      .map((s) => byId.get(s))
      .find((s): s is ScheduledItem => !!s && s.critical && s.start === here.finish);
  }
  // Finished (zero-length) tasks keep the chain connected but are not work left to do.
  return {
    order,
    byId,
    length,
    criticalPath: criticalPath.filter((i) => i.duration > 0),
    cyclic: false,
  };
}
