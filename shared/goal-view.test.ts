import { describe, expect, it } from 'vitest';
import type { Stage, Task } from './schema';
import {
  blocksOfGoal,
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
