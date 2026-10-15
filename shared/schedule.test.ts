import { describe, expect, it } from 'vitest';
import { computeSchedule } from './schedule';

const n = (id: number, duration: number) => ({ id, duration });
const e = (predecessorId: number, successorId: number) => ({ predecessorId, successorId });

describe('computeSchedule', () => {
  it('schedules a chain end to end', () => {
    const s = computeSchedule([n(1, 2), n(2, 3), n(3, 1)], [e(1, 2), e(2, 3)]);
    expect(s.length).toBe(6);
    expect(s.order.map((i) => [i.id, i.start, i.finish])).toEqual([
      [1, 0, 2],
      [2, 2, 5],
      [3, 5, 6],
    ]);
    expect(s.criticalPath.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('finds the longest branch of a diamond and gives the short one slack', () => {
    // 1 -> 2 (5d) -> 4 ; 1 -> 3 (1d) -> 4
    const s = computeSchedule(
      [n(1, 1), n(2, 5), n(3, 1), n(4, 1)],
      [e(1, 2), e(1, 3), e(2, 4), e(3, 4)],
    );
    expect(s.length).toBe(7);
    expect(s.criticalPath.map((i) => i.id)).toEqual([1, 2, 4]);
    expect(s.byId.get(3)).toMatchObject({ slack: 4, critical: false, start: 1, lateStart: 5 });
    expect(s.byId.get(2)?.critical).toBe(true);
  });

  it('runs independent tasks in parallel from day 0', () => {
    const s = computeSchedule([n(1, 2), n(2, 4)], []);
    expect(s.length).toBe(4);
    expect(s.byId.get(1)).toMatchObject({ start: 0, slack: 2 });
    expect(s.criticalPath.map((i) => i.id)).toEqual([2]);
  });

  it('puts a task after its predecessors in the order', () => {
    const s = computeSchedule([n(3, 1), n(1, 1), n(2, 1)], [e(1, 2), e(2, 3)]);
    expect(s.order.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('ignores edges to tasks outside the set and duplicate edges', () => {
    const s = computeSchedule([n(1, 1), n(2, 1)], [e(1, 2), e(1, 2), e(9, 2), e(2, 8)]);
    expect(s.length).toBe(2);
    expect(s.byId.get(2)?.predecessors).toEqual([1]);
  });

  it('treats zero-length (finished) tasks as no delay', () => {
    const s = computeSchedule([n(1, 0), n(2, 3)], [e(1, 2)]);
    expect(s.length).toBe(3);
    expect(s.byId.get(2)?.start).toBe(0);
  });

  it('keeps a finished task out of the critical path but chains through it', () => {
    const s = computeSchedule([n(1, 2), n(2, 0), n(3, 3)], [e(1, 2), e(2, 3)]);
    expect(s.criticalPath.map((i) => i.id)).toEqual([1, 3]);
    expect(s.length).toBe(5);
  });

  it('reports a loop instead of looping', () => {
    const s = computeSchedule([n(1, 1), n(2, 1)], [e(1, 2), e(2, 1)]);
    expect(s.cyclic).toBe(true);
    expect(s.order).toEqual([]);
  });

  it('handles an empty set', () => {
    const s = computeSchedule([], []);
    expect(s).toMatchObject({ length: 0, cyclic: false });
  });
});
