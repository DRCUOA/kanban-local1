import { describe, it, expect } from 'vitest';
import type { Task, Stage, SubStage } from './schema';
import {
  BRIEFING_RANK,
  DEFAULT_TIMEZONE,
  DUE_BUCKET,
  annotateTasksWithUrgency,
  buildBriefing,
  computeTaskUrgency,
  dueDayFor,
  formatDueDayLabel,
  isDueTodayOn,
  isOverdueOn,
  isTaskOverdueOn,
  overdueRuleFor,
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

/**
 * A due date exactly as production stores it. The picker (react-day-picker,
 * `mode="single"`) hands back the chosen day at NZ *local midnight*, which is
 * serialized to UTC — so a card labeled "13 Aug" is stored as
 * 2026-08-12T12:00:00.000Z, an instant whose own UTC date part is the day
 * before the label. Tests that build due dates as NZ noon instants (as the
 * BUG-003 tests did) cannot see a defect in that offset.
 *
 * `offset` is the NZ offset in the month concerned: +12 NZST, +13 NZDT.
 */
const duePicked = (y: number, m: number, d: number, offset = '+12:00') =>
  new Date(
    `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}T00:00:00${offset}`,
  ) as unknown as Task['dueDate'];

const day = (y: number, m: number, d: number) => duePicked(y, m, d) as unknown as Date;

// The kinds, not the names, are what the briefing reads. The decorative names
// stay as they are in production so `stageLabel` is still exercised.
const stages: Stage[] = [
  { id: 1, name: 'Backlog', kind: 'backlog' },
  { id: 2, name: 'In Progress', kind: 'in_progress' },
  { id: 4, name: 'Waiting ✋️ ', kind: 'waiting' },
  { id: 3, name: 'Done  ✔', kind: 'done' },
  { id: 5, name: 'Cancelled', kind: 'abandoned' },
] as unknown as Stage[];

const IN_BACKLOG = 1;
const IN_PROGRESS = 2;
const IN_DONE = 3;
const IN_WAITING = 4;
const IN_ABANDONED = 5;

const subStages: SubStage[] = [
  { id: 7, stageId: 2, name: 'Rich', tag: 'Rich' },
  { id: 8, stageId: 2, name: 'Moi', tag: 'Moi' },
  { id: 9, stageId: 4, name: 'Scheduled Action | On Track', tag: 'Status' },
] as unknown as SubStage[];

/**
 * The same stage, with the person lanes bound to owner rows as EPIC-06's
 * migration binds them: lane 7 is owner 1's, lane 8 is owner 2's, and the
 * status lane belongs to nobody and keeps matching its tag.
 */
const boundSubStages: SubStage[] = [
  { id: 7, stageId: 2, name: 'Rich', tag: 'Rich', ownerId: 1 },
  { id: 8, stageId: 2, name: 'Moi', tag: 'Moi', ownerId: 2 },
  { id: 9, stageId: 4, name: 'Scheduled Action | On Track', tag: 'Status', ownerId: null },
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
    stageId: IN_BACKLOG,
    archived: false,
    priority: 'normal',
    dueDate: null,
    tags: null,
    owner: null,
    projectId: null,
    ...overrides,
  } as unknown as Task;
}

/** The task the briefing agent dropped: overdue, in progress, priority normal. */
const task142 = fakeTask({
  id: 142,
  title: 'Check remaining gas - will it last to Sept 23',
  stageId: IN_PROGRESS,
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
    const task = fakeTask({ dueDate: duePicked(2026, 8, 11) });
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

describe('done beats the due date', () => {
  // The bug: a task marked done kept flagging as overdue until its due date
  // was cleared by hand. Closing a task must end the flagging on its own.
  const pastDue = duePicked(2026, 8, 9);

  it('never flags a done task as overdue, without the due date being cleared', () => {
    const urgency = computeTaskUrgency(
      fakeTask({ stageId: IN_DONE, dueDate: pastDue }),
      NOW,
      DEFAULT_TIMEZONE,
      stages,
    );

    expect(urgency.isOverdue).toBe(false);
    expect(urgency.daysOverdue).toBe(0);
    expect(urgency.dueBucket).toBe(DUE_BUCKET.NONE);
    expect(urgency.mustSurface).toBe(false);
    // The date facts survive; only the due pressure is gone.
    expect(urgency.dueDay).toBe('2026-08-09');
    expect(urgency.daysUntilDue).toBe(-2);
  });

  it('treats abandoned work as closed the same way', () => {
    const urgency = computeTaskUrgency(
      fakeTask({ stageId: IN_ABANDONED, dueDate: pastDue }),
      NOW,
      DEFAULT_TIMEZONE,
      stages,
    );

    expect(urgency.isOverdue).toBe(false);
    expect(urgency.dueBucket).toBe(DUE_BUCKET.NONE);
  });

  it('unflags a card by the column it sits in, whatever it is called', () => {
    // "Done  ✔" carries a tick and double space; the kind is what is read.
    const task = fakeTask({ stageId: IN_DONE, dueDate: pastDue });

    expect(isTaskOverdueOn(task, stages, NOW)).toBe(false);
    expect(first(annotateTasksWithUrgency([task], stages, NOW)).urgency.isOverdue).toBe(false);
  });

  it('keeps flagging a card parked in a waiting column', () => {
    // Parked is not closed. The old status enum had no waiting value and folded
    // these into backlog; the kind says it outright.
    const task = fakeTask({ stageId: IN_WAITING, dueDate: pastDue });

    expect(isTaskOverdueOn(task, stages, NOW)).toBe(true);
  });

  it('keeps flagging open past-due tasks', () => {
    expect(isTaskOverdueOn(task142, stages, NOW)).toBe(true);
    expect(computeTaskUrgency(task142, NOW, DEFAULT_TIMEZONE, stages).isOverdue).toBe(true);
  });

  it('leaves a done task due today in the today bucket', () => {
    // Scope guard: closing gates only the overdue flag, not the calendar.
    const urgency = computeTaskUrgency(
      fakeTask({ stageId: IN_DONE, dueDate: duePicked(2026, 8, 11) }),
      NOW,
      DEFAULT_TIMEZONE,
      stages,
    );

    expect(urgency.dueBucket).toBe(DUE_BUCKET.TODAY);
  });

  it('keeps done tasks out of the briefing overdue section', () => {
    const digest = buildBriefing({
      tasks: annotateTasksWithUrgency(
        [task142, fakeTask({ id: 200, stageId: IN_DONE, dueDate: pastDue })],
        stages,
        NOW,
      ),
      stages,
      subStages,
      now: NOW,
      timezone: NZ,
    });

    expect(digest.overdue.map((e) => e.id)).toEqual([142]);
  });

  it('states the closed-task rule for the briefing agent', () => {
    expect(overdueRuleFor(NZ)).toContain('done or abandoned');
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

describe('due day (the labeled calendar date)', () => {
  it('is the day the picker stored, not the UTC date part of the instant', () => {
    // The convention this whole block rests on, asserted rather than assumed.
    const stored = duePicked(2026, 8, 13) as unknown as Date;
    expect(stored.toISOString()).toBe('2026-08-12T12:00:00.000Z');

    expect(dueDayFor(stored, NZ)).toBe('2026-08-13');
    // Taking the date part of the instant is the mistake being guarded against.
    expect(stored.toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('holds all day, from first light to last', () => {
    const card = fakeTask({ dueDate: duePicked(2026, 8, 13) });

    for (const hour of [0, 7, 12, 23]) {
      const urgency = computeTaskUrgency(card, nzt(2026, 8, 13, hour, 0), NZ);
      expect(urgency.dueDay).toBe('2026-08-13');
      expect(urgency.dueBucket).toBe(DUE_BUCKET.TODAY);
      expect(urgency.daysOverdue).toBe(0);
    }
  });

  it('reads one day overdue at 7:00 AM the next morning', () => {
    const card = fakeTask({ dueDate: duePicked(2026, 8, 13) });

    const urgency = computeTaskUrgency(card, nzt(2026, 8, 14, 7, 0), NZ);

    expect(urgency.dueBucket).toBe(DUE_BUCKET.OVERDUE);
    expect(urgency.daysOverdue).toBe(1);
    expect(urgency.dueDay).toBe('2026-08-13');
  });

  it('maps a card anchored in the NZDT season to its labeled date', () => {
    // January is +13, so the picker stores 11:00Z on the previous date.
    const card = fakeTask({ dueDate: duePicked(2027, 1, 15, '+13:00') });
    expect((card.dueDate as unknown as Date).toISOString()).toBe('2027-01-14T11:00:00.000Z');

    expect(dueDayFor(card.dueDate, NZ)).toBe('2027-01-15');
    expect(computeTaskUrgency(card, nzt(2027, 1, 15, 7, 0), NZ).dueBucket).toBe(DUE_BUCKET.TODAY);
  });

  it('agrees with the label the card face shows', () => {
    // BUG-004 was reported against cards storing 2026-08-13T12:00:00.000Z and
    // read as "due 13 August". Under the picker convention that instant is
    // 14 Aug in NZ — which is what the board prints — so "tomorrow" on 13 Aug
    // is correct. Deriving the day from the UTC date part would have moved
    // every picker-written card a day early.
    const reported = new Date('2026-08-13T12:00:00.000Z');

    expect(dueDayFor(reported, NZ)).toBe('2026-08-14');
    expect(formatDueDayLabel(reported, NZ)).toBe('Aug 14');
    expect(
      computeTaskUrgency(
        fakeTask({ dueDate: reported as unknown as Task['dueDate'] }),
        nzt(2026, 8, 13, 7, 0),
        NZ,
      ).dueBucket,
    ).toBe(DUE_BUCKET.TOMORROW);
  });

  it('is null for undated and unparseable work', () => {
    expect(dueDayFor(null, NZ)).toBeNull();
    expect(dueDayFor('not-a-date', NZ)).toBeNull();
    expect(computeTaskUrgency(fakeTask(), NOW, NZ).dueDay).toBeNull();
  });

  it('flags overdue for the board exactly as it does for the export', () => {
    // The export's stated contract: it matches the board's own highlight.
    const card = fakeTask({ dueDate: duePicked(2026, 8, 13) });

    expect(isOverdueOn(card.dueDate, nzt(2026, 8, 13, 23, 59), NZ)).toBe(false);
    expect(isDueTodayOn(card.dueDate, nzt(2026, 8, 13, 23, 59), NZ)).toBe(true);
    expect(isOverdueOn(card.dueDate, nzt(2026, 8, 14, 0, 1), NZ)).toBe(true);
    expect(isDueTodayOn(card.dueDate, nzt(2026, 8, 14, 0, 1), NZ)).toBe(false);
  });

  it('buckets the digest by the labeled day', () => {
    const dueToday = fakeTask({ id: 1, dueDate: duePicked(2026, 8, 13) });
    const dueTomorrow = fakeTask({ id: 2, dueDate: duePicked(2026, 8, 14) });
    const dueYesterday = fakeTask({ id: 3, dueDate: duePicked(2026, 8, 12) });
    const morning = nzt(2026, 8, 13, 7, 0);

    const digest = buildBriefing({
      tasks: annotateTasksWithUrgency([dueToday, dueTomorrow, dueYesterday], stages, morning, NZ),
      stages,
      subStages,
      now: morning,
      timezone: NZ,
    });

    expect(digest.dueToday.map((e) => e.id)).toEqual([1]);
    expect(digest.overdue.map((e) => e.id)).toEqual([3]);
    expect(first(digest.dueToday).dueDay).toBe('2026-08-13');
    expect(digest.overdueRule).toContain('dueDay');
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

  it('ranks an overdue backlog card below an overdue in-progress one', () => {
    // The promotion is the in-progress column's, so a card in Backlog does not
    // get it however urgent it looks. This used to be the place a stored
    // `status: in_progress` could lie and claim the higher rank.
    const task = first(
      annotateTasksWithUrgency(
        [
          fakeTask({
            stageId: IN_BACKLOG,
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
      stageId: IN_PROGRESS,
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

  it('resolves a person’s lane from the owner, and ignores that lane’s tag', () => {
    // EPIC-06: a bound lane holds exactly the tasks in its stage that owner
    // owns, so no tag is needed — and a stale tag cannot move the card.
    const task = fakeTask({ stageId: 2, ownerId: 2, tags: ['Rich'] });

    expect(resolveSwimlane(task, boundSubStages)).toBe('Moi');
  });

  it('leaves a task unlaned when its stage holds no lane for its owner', () => {
    const task = fakeTask({ stageId: 4, ownerId: 1 });

    expect(resolveSwimlane(task, boundSubStages)).toBeNull();
  });

  it('still matches a tag lane by tag for an owned task', () => {
    const task = fakeTask({ stageId: 4, ownerId: 1, tags: ['Status'] });

    expect(resolveSwimlane(task, boundSubStages)).toBe('Scheduled Action | On Track');
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
      stageId: IN_PROGRESS,
      priority: 'high',
      owner: 'Rich',
      tags: ['Rich'],
      dueDate: day(2026, 8, 13) as unknown as Task['dueDate'],
    }),
    fakeTask({
      id: 150,
      stageId: IN_PROGRESS,
      priority: 'high',
      tags: ['Rich'],
      dueDate: duePicked(2026, 8, 11),
    }),
    fakeTask({
      id: 128,
      stageId: IN_WAITING,
      owner: 'Rich',
      tags: ['Status'],
      dueDate: day(2026, 9, 10) as unknown as Task['dueDate'],
    }),
    fakeTask({ id: 146, stageId: IN_BACKLOG }),
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

  it('collects backlog-column work, and waiting work is not backlog work', () => {
    // #146 sits in Backlog. #128 sits in a Waiting column, whose kind is
    // `waiting` — so it is reported as blocked and nothing has to subtract it
    // from the backlog, as it did while the status enum folded the two.
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

  it('reports no owner conflict, because one can no longer exist', () => {
    // #142 is the row that named the defect: owner "Moi" sitting in the "Rich"
    // lane. Since EPIC-06 a person's lane holds exactly the tasks that owner
    // owns, so the lane and the owner cannot disagree and `ownerConflict` is
    // false for every entry. The field is kept only so the payload's shape
    // does not change under consumers; OWN-10 removes it.
    const entry = first(digest().overdue.filter((e) => e.id === 142));

    expect(entry.ownerConflict).toBe(false);
  });

  it('names the owner’s own lane as the swimlane once the lanes are bound', () => {
    const digestWithBoundLanes = buildBriefing({
      tasks: annotateTasksWithUrgency(
        [fakeTask({ ...task142, ownerId: 2, owner: 'Moi', tags: [] })],
        stages,
        NOW,
      ),
      stages,
      subStages: boundSubStages,
      now: NOW,
      timezone: DEFAULT_TIMEZONE,
    });
    const entry = first(digestWithBoundLanes.overdue);

    expect(entry.owner).toBe('Moi');
    expect(entry.swimlane).toBe('Moi');
    expect(entry.ownerConflict).toBe(false);
  });

  it('does not read a status lane as a conflicting assignee', () => {
    // "Scheduled Action | On Track" shares the tag namespace with person lanes
    // but names no one, so an owner sitting in it is not a conflict.
    const entry = first(digest().blocked.filter((e) => e.id === 128));

    expect(entry.swimlane).toBe('Scheduled Action | On Track');
    expect(entry.owner).toBe('Rich');
    expect(entry.ownerConflict).toBe(false);
  });

  it('reports no status conflict, because one can no longer exist', () => {
    // Task #126 named this defect: `status: in_progress` while sitting in
    // Backlog. EPIC-03 story 2 dropped the stored status, so there is no
    // second state to disagree with the column. Both fields are kept at their
    // settled values purely so the payload's shape does not move.
    const d = digest();
    const everyEntry = [...d.overdue, ...d.dueToday, ...d.inProgress, ...d.blocked, ...d.backlog];
    expect(everyEntry.length).toBeGreaterThan(0);

    for (const entry of everyEntry) {
      expect(entry.storedStatus).toBe(null);
      expect(entry.statusConflict).toBe(false);
    }
  });

  it("states each task's stage as the kind of its column", () => {
    const { overdue, blocked, backlog } = digest();

    expect(first(overdue.filter((e) => e.id === 142)).stage).toBe('in_progress');
    // `waiting` is a state the old status enum could not express at all.
    expect(first(blocked).stage).toBe('waiting');
    expect(first(backlog).stage).toBe('backlog');
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
