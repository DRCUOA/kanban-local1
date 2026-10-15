import { z } from 'zod';

/** One stored edge: `predecessorId` must finish before `successorId`. */
export interface TaskDependencyEdge {
  predecessorId: number;
  successorId: number;
}

/** Replaces a task's predecessor and/or successor sets. A side left undefined is untouched. */
export const taskDependencySetSchema = z.object({
  predecessorIds: z.array(z.number().int().positive()).optional(),
  successorIds: z.array(z.number().int().positive()).optional(),
});
export type TaskDependencySet = z.infer<typeof taskDependencySetSchema>;

export const unique = (ids: number[]): number[] => Array.from(new Set(ids));

/** Task ids reachable from `start` by following edges forwards (successors) or backwards. */
export function reachable(
  edges: TaskDependencyEdge[],
  start: number,
  direction: 'successors' | 'predecessors',
): Set<number> {
  const next = new Map<number, number[]>();
  for (const e of edges) {
    const [from, to] =
      direction === 'successors'
        ? [e.predecessorId, e.successorId]
        : [e.successorId, e.predecessorId];
    const list = next.get(from);
    if (list) list.push(to);
    else next.set(from, [to]);
  }
  const seen = new Set<number>();
  const stack = [start];
  for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) {
    for (const n of next.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen;
}

/** The edge list after replacing `taskId`'s predecessors and/or successors. */
export function applyDependencySet(
  edges: TaskDependencyEdge[],
  taskId: number,
  set: TaskDependencySet,
): TaskDependencyEdge[] {
  let out = edges;
  if (set.predecessorIds) {
    out = out.filter((e) => e.successorId !== taskId);
    for (const p of unique(set.predecessorIds)) out.push({ predecessorId: p, successorId: taskId });
  }
  if (set.successorIds) {
    out = out.filter((e) => e.predecessorId !== taskId);
    for (const s of unique(set.successorIds)) out.push({ predecessorId: taskId, successorId: s });
  }
  return out;
}

/** True when the edge list contains a loop. Kahn's algorithm. */
export function hasCycle(edges: TaskDependencyEdge[]): boolean {
  const indegree = new Map<number, number>();
  const out = new Map<number, number[]>();
  for (const e of edges) {
    indegree.set(e.successorId, (indegree.get(e.successorId) ?? 0) + 1);
    if (!indegree.has(e.predecessorId)) indegree.set(e.predecessorId, 0);
    const list = out.get(e.predecessorId);
    if (list) list.push(e.successorId);
    else out.set(e.predecessorId, [e.successorId]);
  }
  const queue = [...indegree].filter(([, d]) => d === 0).map(([id]) => id);
  let visited = 0;
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    visited += 1;
    for (const n of out.get(id) ?? []) {
      const d = (indegree.get(n) ?? 0) - 1;
      indegree.set(n, d);
      if (d === 0) queue.push(n);
    }
  }
  return visited < indegree.size;
}

/**
 * Returns a user-facing message when applying `set` to `taskId` is invalid,
 * or null. Mirrors the database rules (migration 0018) so the API answers 400
 * with words. `existingIds` is every task id that exists.
 */
export function dependencySetError(
  edges: TaskDependencyEdge[],
  taskId: number,
  set: TaskDependencySet,
  existingIds: Set<number>,
): string | null {
  const mentioned = [...(set.predecessorIds ?? []), ...(set.successorIds ?? [])];
  if (mentioned.includes(taskId)) return 'A task cannot depend on itself';
  const unknown = mentioned.find((id) => !existingIds.has(id));
  if (unknown !== undefined) return `Unknown task ${unknown}`;
  const preds = new Set(set.predecessorIds ?? []);
  const clash = (set.successorIds ?? []).find((id) => preds.has(id));
  if (clash !== undefined) return `Task ${clash} cannot be both a predecessor and a successor`;
  if (hasCycle(applyDependencySet([...edges], taskId, set))) {
    return 'These dependencies would create a loop';
  }
  return null;
}
