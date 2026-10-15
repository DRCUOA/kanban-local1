import { describe, expect, it } from 'vitest';
import type { Stage, Task } from './schema';
import {
  blocksOfGoal,
  describeOutsideWait,
  outsideWaits,
  goalProgress,
  goalsInProject,
  planGoal,
  taskDurationDays,
  unassignedBlocks,
} from './goal-view';

const stages = [
  { id: 1, name: 'Backlog', order: 0, kind: 'backlog' },
  { id: 2, name: 'Done', order: 1, kind: 'done' },
] as unknown as Stage[];

let seq = 0;
const task = (o: Partial<Task>): Task =>
  ({
    id: ++seq,
    title: 't',
    stageId: 1,
    archived: false,
    deletedAt: null,
    projectId: null,
    type: null,
    goalTaskId: null,
    effort: null,
    dueDate: null,
    ...o,
  }) as Task;

describe('taskDurationDays', () => {
  it('uses effort as days, defaults to one, and is zero once finished', () => {
    expect(taskDurationDays(task({ effort: 3 }), stages)).toBe(3);
    expect(taskDurationDays(task({}), stages)).toBe(1);
    expect(taskDurationDays(task({ effort: 4, stageId: 2 }), stages)).toBe(0);
  });
});

describe('selecting goals and blocks', () => {
  const g1 = task({ id: 100, type: 'goal', projectId: 7 });
  const g2 = task({ id: 101, type: 'goal', projectId: 8 });
  const gBin = task({ id: 102, type: 'goal', projectId: 7, deletedAt: new Date() });
  const b1 = task({ id: 200, type: 'building-block', projectId: 7, goalTaskId: 100 });
  const b2 = task({ id: 201, type: 'building-block', projectId: 7 });
  const bArchived = task({ id: 202, type: 'building-block', goalTaskId: 100, archived: true });
  const all = [g1, g2, gBin, b1, b2, bArchived];

  it('lists a project’s live goals only', () => {
    expect(goalsInProject(all, 7).map((t) => t.id)).toEqual([100]);
    expect(goalsInProject(all, null)).toEqual([]);
  });
  it('finds a goal’s live blocks and a project’s unassigned ones', () => {
    expect(blocksOfGoal(all, 100).map((t) => t.id)).toEqual([200]);
    expect(unassignedBlocks(all, 7).map((t) => t.id)).toEqual([201]);
  });
  it('counts finished blocks', () => {
    const done = task({ type: 'building-block', stageId: 2 });
    expect(goalProgress([done, b1], stages)).toEqual({ done: 1, total: 2 });
  });
});

describe('planGoal', () => {
  it('orders blocks along their dependencies and finds the critical path', () => {
    const a = task({ id: 1, effort: 2 });
    const b = task({ id: 2, effort: 3 });
    const c = task({ id: 3, effort: 1 });
    const plan = planGoal(
      [c, b, a],
      [
        { predecessorId: 1, successorId: 2 },
        { predecessorId: 2, successorId: 3 },
      ],
      stages,
    );
    expect(plan.order.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(plan.length).toBe(6);
    expect(plan.criticalPath.map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe('outsideWaits', () => {
  const goalA = task({ id: 500, type: 'goal' });
  const goalB = task({ id: 600, type: 'goal' });
  const a1 = task({ id: 501, type: 'building-block', goalTaskId: 500 });
  const a2 = task({ id: 502, type: 'building-block', goalTaskId: 500 });
  const b1 = task({ id: 601, type: 'building-block', goalTaskId: 600, stageId: 2 });
  const loose = task({ id: 700 });
  const gone = task({ id: 701, archived: true });
  const all = [goalA, goalB, a1, a2, b1, loose, gone];
  const e = (predecessorId: number, successorId: number) => ({ predecessorId, successorId });

  it('lists only predecessors from outside the goal, with their goal and state', () => {
    const waits = outsideWaits(
      [a1, a2],
      [e(501, 502), e(601, 501), e(700, 502), e(701, 502), e(502, 601)],
      all,
      stages,
    );
    expect(waits.get(501)?.map((w) => [w.task.id, w.goal?.id ?? null, w.done])).toEqual([
      [601, 600, true],
    ]);
    expect(waits.get(502)?.map((w) => [w.task.id, w.goal?.id ?? null, w.done])).toEqual([
      [700, null, false],
    ]);
  });

  it('describes a wait in one line', () => {
    const [w] = outsideWaits([a1], [e(601, 501)], all, stages).get(501) ?? [];
    expect(w && describeOutsideWait(w)).toBe('#601 t (t), done');
  });
});
