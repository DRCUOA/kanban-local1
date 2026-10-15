import { describe, expect, it } from 'vitest';
import {
  applyDependencySet,
  dependencySetError,
  hasCycle,
  reachable,
  type TaskDependencyEdge,
} from './task-dependencies';

const e = (predecessorId: number, successorId: number): TaskDependencyEdge => ({
  predecessorId,
  successorId,
});
const ids = new Set([1, 2, 3, 4]);

describe('reachable', () => {
  const edges = [e(1, 2), e(2, 3)];
  it('walks successors and predecessors transitively', () => {
    expect([...reachable(edges, 1, 'successors')].sort()).toEqual([2, 3]);
    expect([...reachable(edges, 3, 'predecessors')].sort()).toEqual([1, 2]);
  });
});

describe('hasCycle', () => {
  it('is false for a diamond and true for a loop', () => {
    expect(hasCycle([e(1, 2), e(1, 3), e(2, 4), e(3, 4)])).toBe(false);
    expect(hasCycle([e(1, 2), e(2, 3), e(3, 1)])).toBe(true);
  });
});

describe('applyDependencySet', () => {
  it('replaces only the side given', () => {
    const out = applyDependencySet([e(1, 2), e(2, 3)], 2, { predecessorIds: [4] });
    expect(out).toEqual(expect.arrayContaining([e(4, 2), e(2, 3)]));
    expect(out).not.toContainEqual(e(1, 2));
  });
  it('deduplicates ids', () => {
    expect(applyDependencySet([], 1, { successorIds: [2, 2] })).toEqual([e(1, 2)]);
  });
});

describe('dependencySetError', () => {
  const edges = [e(1, 2), e(2, 3)];
  it('accepts a valid many-to-many set', () => {
    expect(
      dependencySetError(edges, 4, { predecessorIds: [1, 2], successorIds: [3] }, ids),
    ).toBeNull();
  });
  it('rejects self, unknown, both-sides and loops', () => {
    expect(dependencySetError(edges, 1, { predecessorIds: [1] }, ids)).toMatch(/itself/);
    expect(dependencySetError(edges, 1, { predecessorIds: [99] }, ids)).toMatch(/Unknown/);
    expect(dependencySetError(edges, 4, { predecessorIds: [1], successorIds: [1] }, ids)).toMatch(
      /both/,
    );
    expect(dependencySetError(edges, 1, { predecessorIds: [3] }, ids)).toMatch(/loop/);
  });
});
