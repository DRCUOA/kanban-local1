import { describe, expect, it } from 'vitest';
import { computeSchedule } from './schedule';
import { listInWords, summarisePlan } from './plan-summary';
import type { Task } from './schema';

const t = (id: number, title: string, dueDate: Date | null = null) =>
  ({ id, title, dueDate }) as unknown as Task;
const anchor = new Date(2026, 9, 16); // Fri 16 Oct 2026
const e = (predecessorId: number, successorId: number) => ({ predecessorId, successorId });

describe('listInWords', () => {
  it('joins with commas and "and"', () => {
    expect(listInWords(['A'])).toBe('A');
    expect(listInWords(['A', 'B'])).toBe('A and B');
    expect(listInWords(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('summarisePlan', () => {
  // Measure (1d) -> Buy (2d) -> Build (3d); Clear ground (1d) -> Build
  const tasks = [
    t(1, 'Measure'),
    t(2, 'Buy'),
    t(3, 'Build', new Date(2026, 9, 20)),
    t(4, 'Clear ground'),
  ];
  const schedule = computeSchedule(
    [
      { id: 1, duration: 1 },
      { id: 2, duration: 2 },
      { id: 3, duration: 3 },
      { id: 4, duration: 1 },
    ],
    [e(1, 2), e(2, 3), e(4, 3)],
  );

  it('writes the headline, the chain, the slack, side-by-side work and a missed due date', () => {
    const { paragraphs } = summarisePlan({ schedule, tasks, anchor, order: 'critical' });
    expect(paragraphs[0]).toBe(
      'This goal has 4 building-blocks. The work still to do takes 6 days end to end if it starts today, which finishes around Thursday 22 October.',
    );
    expect(paragraphs[1]).toContain('Measure, Buy and Build');
    expect(paragraphs.join(' ')).toContain('Clear ground (2 days)');
    expect(paragraphs.join(' ')).toContain('Measure and Clear ground can all start today');
    expect(paragraphs.join(' ')).toContain('Build is scheduled to finish after its due date');
  });

  it('lists the critical path first for the critical view and by date for the Gantt view', () => {
    const critical = summarisePlan({ schedule, tasks, anchor, order: 'critical' }).steps;
    expect(critical.map((s) => s.title)).toEqual(['Measure', 'Buy', 'Build', 'Clear ground']);
    const gantt = summarisePlan({ schedule, tasks, anchor, order: 'gantt' }).steps;
    expect(gantt.map((s) => s.title)).toEqual(['Measure', 'Clear ground', 'Buy', 'Build']);
    expect(gantt[3]).toMatchObject({
      when: 'Starts Mon 19 Oct, takes 3 days, finishes Thu 22 Oct.',
      slack: 'On the critical path.',
    });
    expect(gantt[3]?.notes).toEqual([
      'Waits for Buy and Clear ground.',
      'Due Tue 20 Oct, which this plan misses.',
    ]);
    expect(gantt[1]?.slack).toBe('Can slip 2 days.');
  });

  it('mentions an unfinished wait outside the goal', () => {
    const waits = new Map([
      [1, [{ task: t(9, 'Get permit'), goal: t(8, 'Council'), done: false }]],
    ]);
    const out = summarisePlan({ schedule, tasks, anchor, order: 'gantt', waits });
    expect(out.paragraphs.join(' ')).toContain('Measure also waits for work outside this goal');
    expect(out.steps[0]?.notes).toContain(
      'Starts after Get permit in “Council”, outside this goal (not done yet).',
    );
  });

  it('handles an empty and an all-done goal', () => {
    expect(
      summarisePlan({ schedule: computeSchedule([], []), tasks: [], anchor, order: 'gantt' })
        .paragraphs,
    ).toEqual(['This goal has no building-blocks yet.']);
    const doneOnly = computeSchedule([{ id: 1, duration: 0 }], []);
    const out = summarisePlan({
      schedule: doneOnly,
      tasks: [t(1, 'Measure')],
      anchor,
      order: 'gantt',
    });
    expect(out.paragraphs[0]).toContain('Its one building-block is done');
    expect(out.steps[0]).toMatchObject({ when: 'Done.', done: true });
  });
});
