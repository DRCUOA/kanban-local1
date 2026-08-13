import { describe, it, expect } from 'vitest';
import type { Task, Stage, SubStage } from './schema';
import {
  BRIEFING_RANK,
  DEFAULT_TIMEZONE,
  DUE_BUCKET,
  annotateTasksWithUrgency,
  buildBriefing,
  computeTaskUrgency,
  resolveTimezone,
  resolveSwimlane,
  briefingDigestSchema,
  zonedDayKey,
} from './briefing';

const NZ = 'Pacific/Auckland';

/**
 * NZ wall-clock instants, pinned with an explicit offset rather than built from
 * host-local constructors: the bug these tests guard is precisely a host zone
 * leaking into the payload, so a test that inherits the host zone cannot see it.
 * Every date below sits in NZST (+12); the hours chosen leave more than an
 * hour's slack either side of midnight, so the +13 NZDT months would land on
 * the same calendar day regardless.
 */
const nzt = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(
    `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}T${`${h}`.padStart(2, '0')}:${`${min}`.padStart(2, '0')}:00+12:00`,
  );

const NOW = nzt(2026, 8, 11, 19, 46); // 11 Aug 2026, NZ evening
const day = (y: number, m: number, d: number) => nzt(y, m, d, 12, 0);

const stages: Stage[] = [
  { id: 1, name: 'Backlog' },
  { id: 2, name: 'In Progress' },
  { id: 4, name: 'Waiting ✋️ ' },
  { id: 3, name: 'Done  ✔' },
] as unknown as Stage[];

const subStages: SubStage[] = [
  { id: 7, stageId: 2, name: 'Rich', tag: 'Rich' },
  { id: 8, stageId: 2, name: 'Moi', tag: 'Moi' },
  { id: 9, stageId: 4, name: 'Scheduled Action | On Track', tag: 'Status' },
] as unknown as SubStage[];

/** Narrows an array's first element without a non-null assertion. */
function first<T>(items: T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('expected at least one item');
  return item;
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'A task',
    stageId: 1,
    archived: false,
    status: 'backlog',
    priority: 'normal',
    dueDate: null,
    tags: null,
    owner: null,
    ...overrides,
  } as unknown as Task;
}

/** The task the briefing agent dropped: overdue, in progress, priority normal. */
const task142 = fakeTask({
  id: 142,
  title: 'Check remaining gas - will it last to Sept 23',
  stageId: 2,
  status: 'in_progress',
  priority: 'normal',
  dueDate: day(2026, 8, 9) as unknown as Task['dueDate'],
  tags: ['Rich'],
  owner: 'Moi',
});

describe('computeTaskUrgency', () => {
  it('flags an overdue task with a whole-day count', () => {
    const urgency = computeTaskUrgency(task142, NOW);

    expect(urgency.isOverdue).toBe(true);
    expect(urgency.daysOverdue).toBe(2);
    expect(urgency.daysUntilDue).toBe(-2);
    expect(urgency.dueBucket).toBe(DUE_BUCKET.OVERDUE);
    expect(urgency.mustSurface).toBe(true);
  });

  it('treats a task due later today as due today, not overdue', () => {
    // Matches the board's own highlight: past instant, same calendar day.
    const task = fakeTask({ dueDate: nzt(2026, 8, 11, 12, 0) as unknown as Task['dueDate'] });
    const urgency = computeTaskUrgency(task, NOW);

    expect(urgency.isOverdue).toBe(false);
    expect(urgency.dueBucket).toBe(DUE_BUCKET.TODAY);
    expect(urgency.mustSurface).toBe(true);
  });

  it('buckets upcoming and undated work', () => {
    const bucket = (dueDate: Task['dueDate']) =>
      computeTaskUrgency(fakeTask({ dueDate }), NOW).dueBucket;

    expect(bucket(day(2026, 8, 12) as unknown as Task['dueDate'])).toBe(DUE_BUCKET.TOMORROW);
    expect(bucket(day(2026, 8, 16) as unknown as Task['dueDate'])).toBe(DUE_BUCKET.THIS_WEEK);
    expect(bucket(day(2026, 9, 22) as unknown as Task['dueDate'])).toBe(DUE_BUCKET.LATER);
    expect(bucket(null)).toBe(DUE_BUCKET.NONE);
  });

  it('does not mark undated or future work as must-surface', () => {
    expect(computeTaskUrgency(fakeTask(), NOW).mustSurface).toBe(false);
    expect(
      computeTaskUrgency(fakeTask({ dueDate: day(2026, 8, 30) as unknown as Task['dueDate'] }), NOW)
        .mustSurface,
    ).toBe(false);
  });

  it('ignores an unparseable due date rather than throwing', () => {
    const urgency = computeTaskUrgency(
      fakeTask({ dueDate: 'not-a-date' as unknown as Task['dueDate'] }),
      NOW,
    );

    expect(urgency.dueBucket).toBe(DUE_BUCKET.NONE);
    expect(urgency.isOverdue).toBe(false);
  });
});

describe('calendar day boundaries', () => {
  // 7:00 AM NZT on 13 Aug is still 12 Aug in UTC — the window the scheduled
  // briefing runs in, and the window every one of these bugs lived in.
  const NZ_MORNING = nzt(2026, 8, 13, 7, 0);

  it('defaults to New Zealand rather than the host zone', () => {
    expect(DEFAULT_TIMEZONE).toBe(NZ);
    expect(resolveTimezone()).toBe(NZ);
    expect(resolveTimezone(undefined)).toBe(NZ);
  });

  it('honours a caller-supplied zone and falls back on a bogus one', () => {
    expect(resolveTimezone('America/New_York')).toBe('America/New_York');
    expect(resolveTimezone('Middle/Earth')).toBe(NZ);
    expect(resolveTimezone('')).toBe(NZ);
  });

  it('reads the NZ calendar day off an instant that is still yesterday in UTC', () => {
    expect(zonedDayKey(NZ_MORNING, NZ)).toBe('2026-08-13');
    expect(zonedDayKey(NZ_MORNING, 'UTC')).toBe('2026-08-12');
  });

  it('tracks NZDT, not a hardcoded +12', () => {
    // 1 Jan 2027 00:30 NZDT (+13) is still 31 Dec 2026 in UTC.
    const nzdtMidnight = new Date('2027-01-01T00:30:00+13:00');

    expect(zonedDayKey(nzdtMidnight, NZ)).toBe('2027-01-01');
    expect(zonedDayKey(nzdtMidnight, 'UTC')).toBe('2026-12-31');
  });

  it('counts a card due yesterday NZ time as one day overdue at 7:00 AM NZT', () => {
    // Due late on 12 Aug NZ = 11:00 UTC on 12 Aug, the same UTC day as `now`.
    // Cut in UTC this reads "due today"; cut in NZ it is yesterday's work.
    const dueYesterdayEvening = fakeTask({
      dueDate: nzt(2026, 8, 12, 23, 0) as unknown as Task['dueDate'],
    });

    const nz = computeTaskUrgency(dueYesterdayEvening, NZ_MORNING, NZ);
    expect(nz.dueBucket).toBe(DUE_BUCKET.OVERDUE);
    expect(nz.daysOverdue).toBe(1);
    expect(nz.mustSurface).toBe(true);

    const utc = computeTaskUrgency(dueYesterdayEvening, NZ_MORNING, 'UTC');
    expect(utc.dueBucket).toBe(DUE_BUCKET.TODAY);
    expect(utc.daysOverdue).toBe(0);
  });

  it('generates the digest for today’s NZ date, not yesterday’s UTC date', () => {
    const digestIn = (timezone: string) =>
      buildBriefing({
        tasks: annotateTasksWithUrgency([], stages, NZ_MORNING, timezone),
        stages,
        subStages,
        now: NZ_MORNING,
        timezone,
      });

    expect(digestIn(NZ).generatedFor).toBe('2026-08-13');
    expect(digestIn(NZ).timezone).toBe(NZ);
    // The zone is a knob, not a constant — a caller asking for UTC still gets it.
    expect(digestIn('UTC').generatedFor).toBe('2026-08-12');
  });

  it('names the zone actually used in overdueRule', () => {
    const ruleIn = (timezone: string) =>
      buildBriefing({ tasks: [], stages, subStages, now: NZ_MORNING, timezone }).overdueRule;

    expect(ruleIn(NZ)).toContain(NZ);
    expect(ruleIn('UTC')).toContain('UTC');
  });
});

describe('briefingRank', () => {
  it('ranks an overdue in-progress task above every high-priority task', () => {
    const [overdueNormal, futureHigh] = annotateTasksWithUrgency(
      [
        task142,
        fakeTask({
          id: 107,
          stageId: 2,
          priority: 'high',
          dueDate: day(2026, 8, 13) as unknown as Task['dueDate'],
        }),
      ],
      stages,
      NOW,
    ).map((task) => task.urgency.briefingRank);

    expect(overdueNormal).toBe(BRIEFING_RANK.OVERDUE_IN_PROGRESS);
    expect(overdueNormal).toBeLessThan(Number(futureHigh));
  });

  it('ranks by the stage the board shows, not the stored status', () => {
    // Stored status says in_progress; the card actually sits in Backlog.
    const task = first(
      annotateTasksWithUrgency(
        [
          fakeTask({
            stageId: 1,
            status: 'in_progress',
            dueDate: day(2026, 8, 9) as unknown as Task['dueDate'],
          }),
        ],
        stages,
        NOW,
      ),
    );

    expect(task.urgency.briefingRank).toBe(BRIEFING_RANK.OVERDUE);
  });

  it('never surfaces archived work', () => {
    const task = first(
      annotateTasksWithUrgency(
        [
          fakeTask({
            archived: true,
            stageId: 2,
            dueDate: day(2026, 8, 9) as unknown as Task['dueDate'],
          }),
        ],
        stages,
        NOW,
      ),
    );

    expect(task.urgency.briefingRank).toBe(BRIEFING_RANK.ROUTINE);
    expect(task.urgency.mustSurface).toBe(false);
  });

  it('leaves every stored task field untouched', () => {
    const task = first(annotateTasksWithUrgency([task142], stages, NOW));

    expect(task).toMatchObject({
      id: 142,
      stageId: 2,
      status: 'in_progress',
      priority: 'normal',
      owner: 'Moi',
      tags: ['Rich'],
    });
  });
});

describe('resolveSwimlane', () => {
  it('resolves a lane from a tag scoped to the task’s own stage', () => {
    expect(resolveSwimlane(task142, subStages)).toBe('Rich');
  });

  it('resolves the sub-stage name, not the opaque tag token', () => {
    const task = fakeTask({ stageId: 4, tags: ['Status'] });

    expect(resolveSwimlane(task, subStages)).toBe('Scheduled Action | On Track');
  });

  it('ignores a tag belonging to a different stage', () => {
    // Tag values like "Rich" are reused across stages and are not unique alone.
    expect(resolveSwimlane(fakeTask({ stageId: 1, tags: ['Rich'] }), subStages)).toBeNull();
  });

  it('survives the three shapes tags actually take', () => {
    expect(resolveSwimlane(fakeTask({ tags: null }), subStages)).toBeNull();
    expect(resolveSwimlane(fakeTask({ tags: [] }), subStages)).toBeNull();
    expect(
      resolveSwimlane(
        fakeTask({ stageId: 2, tags: [null, 'Rich'] as unknown as string[] }),
        subStages,
      ),
    ).toBe('Rich');
  });
});

describe('buildBriefing', () => {
  const board = [
    task142,
    fakeTask({
      id: 107,
      stageId: 2,
      status: 'in_progress',
      priority: 'high',
      owner: 'Rich',
      tags: ['Rich'],
      dueDate: day(2026, 8, 13) as unknown as Task['dueDate'],
    }),
    fakeTask({
      id: 150,
      stageId: 2,
      status: 'in_progress',
      priority: 'high',
      tags: ['Rich'],
      dueDate: nzt(2026, 8, 11, 12, 0) as unknown as Task['dueDate'],
    }),
    fakeTask({
      id: 128,
      stageId: 4,
      status: 'backlog',
      owner: 'Rich',
      tags: ['Status'],
      dueDate: day(2026, 9, 10) as unknown as Task['dueDate'],
    }),
    fakeTask({ id: 146, stageId: 1, status: 'backlog' }),
    fakeTask({
      id: 99,
      stageId: 2,
      archived: true,
      dueDate: day(2026, 8, 1) as unknown as Task['dueDate'],
    }),
  ];

  const digest = () =>
    buildBriefing({
      tasks: annotateTasksWithUrgency(board, stages, NOW),
      stages,
      subStages,
      now: NOW,
      timezone: 'Pacific/Auckland',
    });

  it('puts the overdue task in the overdue section', () => {
    expect(digest().overdue.map((e) => e.id)).toEqual([142]);
  });

  it('lists an overdue in-progress task in both overdue and inProgress', () => {
    const { overdue, inProgress } = digest();

    expect(overdue.map((e) => e.id)).toContain(142);
    expect(inProgress.map((e) => e.id)).toContain(142);
  });

  it('sorts each section most urgent first', () => {
    expect(digest().inProgress.map((e) => e.id)).toEqual([142, 150, 107]);
  });

  it('separates due-today from overdue', () => {
    expect(digest().dueToday.map((e) => e.id)).toEqual([150]);
  });

  it('collects waiting-column work as blocked', () => {
    expect(digest().blocked.map((e) => e.id)).toEqual([128]);
  });

  it('collects backlog-column work, excluding waiting columns', () => {
    // #146 sits in Backlog; #128 resolves to stage 'backlog' too (the status
    // enum has no waiting value) but sits in a Waiting column and is already
    // reported as blocked — it must not appear as backlog.
    const { backlog } = digest();

    expect(backlog.map((e) => e.id)).toEqual([146]);
  });

  it('keeps in-progress and done work out of the backlog', () => {
    const ids = digest().backlog.map((e) => e.id);

    expect(ids).not.toContain(142);
    expect(ids).not.toContain(107);
    expect(ids).not.toContain(99);
  });

  it('excludes archived tasks from every section', () => {
    const { overdue, inProgress, blocked, dueToday } = digest();
    const ids = [...overdue, ...inProgress, ...blocked, ...dueToday].map((e) => e.id);

    expect(ids).not.toContain(99);
  });

  it('surfaces the owner/swimlane conflict instead of silently picking one', () => {
    const entry = first(digest().overdue.filter((e) => e.id === 142));

    expect(entry.owner).toBe('Moi');
    expect(entry.swimlane).toBe('Rich');
    expect(entry.ownerConflict).toBe(true);
  });

  it('does not read a status lane as a conflicting assignee', () => {
    // "Scheduled Action | On Track" shares the tag namespace with person lanes
    // but names no one, so an owner sitting in it is not a conflict.
    const entry = first(digest().blocked.filter((e) => e.id === 128));

    expect(entry.swimlane).toBe('Scheduled Action | On Track');
    expect(entry.owner).toBe('Rich');
    expect(entry.ownerConflict).toBe(false);
  });

  it('flags a stored status that disagrees with the board', () => {
    const conflicted = buildBriefing({
      tasks: annotateTasksWithUrgency(
        [
          fakeTask({
            id: 126,
            stageId: 1,
            status: 'in_progress',
            dueDate: day(2026, 8, 9) as unknown as Task['dueDate'],
          }),
        ],
        stages,
        NOW,
      ),
      stages,
      subStages,
      now: NOW,
      timezone: 'Pacific/Auckland',
    });
    const entry = first(conflicted.overdue);

    expect(entry.stage).toBe('backlog');
    expect(entry.storedStatus).toBe('in_progress');
    expect(entry.statusConflict).toBe(true);
  });

  it('strips emoji and padding from stage labels', () => {
    expect(first(digest().blocked).stageLabel).toBe('Waiting');
  });

  it('declares the reference clock the buckets were cut against', () => {
    const { generatedFor, now, timezone, overdueRule } = digest();

    expect(generatedFor).toBe('2026-08-11');
    expect(now).toBe(NOW.toISOString());
    expect(timezone).toBe('Pacific/Auckland');
    expect(overdueRule).toContain('overdue');
  });

  it('produces a digest that validates', () => {
    expect(briefingDigestSchema.safeParse(digest()).success).toBe(true);
  });
});
