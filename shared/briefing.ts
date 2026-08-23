import { z } from 'zod';
import {
  TASK_STATUS,
  getStatusFromStageName,
  isInProgressStageName,
  isWaitingStageName,
} from './constants';
import type { Task, Stage, SubStage } from './schema';

/**
 * Derived urgency + a pre-built digest for the daily-briefing agent.
 *
 * The raw export makes an LLM do three things it does badly: date arithmetic
 * against `exportedAt`, reconciling `status` with `stageId`, and joining
 * `tags` against `subStages[].tag`. Everything here is computed server-side so
 * the agent reads a field instead of inferring one.
 */

// --- Due buckets ---

export const DUE_BUCKET = {
  OVERDUE: 'overdue',
  TODAY: 'today',
  TOMORROW: 'tomorrow',
  THIS_WEEK: 'this_week',
  LATER: 'later',
  NONE: 'none',
} as const;

export type DueBucketValue = (typeof DUE_BUCKET)[keyof typeof DUE_BUCKET];

/**
 * Deterministic sort key. Lower ranks are more urgent; ranks 1–3 are the ones
 * a briefing must never drop.
 *
 * Rank 1 exists because authored `priority` is decoupled from time: an overdue
 * task can sit at `priority: "normal"` while everything around it is `"high"`,
 * which is exactly how an overdue in-progress task gets sorted off the bottom
 * of a "top N by priority" list.
 */
export const BRIEFING_RANK = {
  OVERDUE_IN_PROGRESS: 1,
  OVERDUE: 2,
  DUE_TODAY: 3,
  DUE_TOMORROW: 4,
  DUE_THIS_WEEK: 5,
  HIGH_PRIORITY: 6,
  ROUTINE: 7,
} as const;

/** Ranks at or below this are hard includes for the briefing. */
export const MUST_SURFACE_RANK = BRIEFING_RANK.DUE_TODAY;

/**
 * Prose form of the rule below, emitted with the payload so a consumer can see
 * which calendar day boundary was used without reading this file. Names the
 * zone actually used, because "evaluated in `timezone`" told a reader nothing
 * about whether the boundary matched their own day.
 *
 * Points at `dueDay` rather than `dueDate`: an agent that took the date part of
 * the `dueDate` instant read every card a day early, since the stored instant is
 * the labeled day at local midnight. See `dueDayFor`.
 */
export function overdueRuleFor(timeZone: string): string {
  return `A task’s due day is \`dueDay\`, its labeled calendar date — do not derive a date from the \`dueDate\` instant, whose UTC date part is a day earlier. A task is overdue when \`dueDay\` falls before the day of \`now\`, evaluated in ${timeZone}, and the task is still open. A task due today is never overdue. A closed task — status done or abandoned, or sitting in a Done column — is never overdue, however old its due date. Matches the board’s own overdue highlight.`;
}

export interface TaskUrgency {
  /**
   * The calendar date this card is labeled with (YYYY-MM-DD in the digest's
   * `timezone`), or null when undated. Read this rather than parsing a date out
   * of the `dueDate` instant: the stored instant's UTC date part is a day
   * earlier than the label. See `dueDayFor`.
   */
  dueDay: string | null;
  isOverdue: boolean;
  /** Whole calendar days past due; 0 when not overdue. */
  daysOverdue: number;
  /** Calendar days until due; negative once the due day has passed (even for a closed task), null when undated. */
  daysUntilDue: number | null;
  dueBucket: DueBucketValue;
  briefingRank: number;
  /** Hard include-in-briefing flag. True for overdue and due-today tasks. */
  mustSurface: boolean;
}

/** A `Task` as exported: unchanged, plus the derived urgency block. */
export type ExportTask = Task & { urgency: TaskUrgency };

export interface BriefingEntry {
  id: number;
  title: string;
  /** Status resolved from the task's stage — what the board actually shows. */
  stage: string;
  stageLabel: string;
  /** The stored `status` column, which can disagree with `stage`. */
  storedStatus: string | null;
  /** True when `storedStatus` and `stage` disagree; the board renders `stage`. */
  statusConflict: boolean;
  priority: string | null;
  owner: string | null;
  /** Sub-stage lane the card sits in, resolved from `tags`. Null if none. */
  swimlane: string | null;
  /** True when `owner` and `swimlane` name different people. */
  ownerConflict: boolean;
  /** The reference instant. Its UTC date part is NOT the labeled day. */
  dueDate: string | null;
  /** The labeled calendar date (YYYY-MM-DD) — what the card face shows. */
  dueDay: string | null;
  daysOverdue: number;
  dueBucket: DueBucketValue;
  briefingRank: number;
}

export interface BriefingDigest {
  /** Calendar date in `timezone` the buckets were computed for (YYYY-MM-DD). */
  generatedFor: string;
  /** The reference instant. Same value as the envelope's `exportedAt`. */
  now: string;
  /** IANA zone the calendar-day boundaries were evaluated in. */
  timezone: string;
  overdueRule: string;
  /** Every overdue task. Non-empty means the briefing must name each entry. */
  overdue: BriefingEntry[];
  dueToday: BriefingEntry[];
  /** Tasks whose stage is an in-progress column. Overlaps `overdue` by design. */
  inProgress: BriefingEntry[];
  /** Tasks parked in a waiting/blocked column. */
  blocked: BriefingEntry[];
  /**
   * Tasks sitting in a Backlog column — not yet started. May overlap
   * `overdue`/`dueToday` by design. Excludes waiting/blocked columns, which
   * the stage-name status inference would otherwise fold into backlog.
   */
  backlog: BriefingEntry[];
}

// --- Resolution helpers ---

/** Stage-first status. The board renders by stage, so a briefing should too. */
export function resolveStageStatus(task: Task, stages: Stage[]): string {
  const stage = stages.find((s) => s.id === task.stageId);
  return stage ? getStatusFromStageName(stage.name) : getStatusFromStageName('');
}

/** Human-facing stage name, with the emoji and padding the board carries stripped. */
export function resolveStageLabel(task: Task, stages: Stage[]): string {
  const stage = stages.find((s) => s.id === task.stageId);
  if (!stage) return 'Unknown';
  return cleanLabel(stage.name);
}

/**
 * Sub-stage lane for a card. Membership is encoded as a tag string rather than
 * a foreign key, so match `tags` against the sub-stages of the task's own stage
 * — tag values like "Rich" are reused across stages and are not unique alone.
 */
export function resolveSwimlane(task: Task, subStages: SubStage[]): string | null {
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const candidates = subStages.filter((s) => s.stageId === task.stageId);
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length === 0) continue;
    const match = candidates.find((s) => s.tag === tag);
    if (match) return cleanLabel(match.name);
  }
  return null;
}

/** Human-facing stage / sub-stage label: decorative emoji and padding stripped. */
export function cleanLabel(name: string): string {
  // Stage names carry decorative emoji and stray whitespace ("Waiting ✋️ ").
  return name
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

// --- Calendar days in a zone ---

/**
 * Zone every calendar-day boundary is cut in unless a caller names another.
 * Deliberately not the host zone: the server runs in UTC, 12–13 hours behind
 * New Zealand, so a host-zone boundary makes every NZ morning (midnight–noon)
 * report the previous day — overdue counts one low, `dueToday` a day stale.
 */
export const DEFAULT_TIMEZONE = 'Pacific/Auckland';

/** True when this runtime knows `timeZone`. Guards caller-supplied `?tz=`. */
export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The zone calendar boundaries are evaluated in. Invalid input falls back. */
export function resolveTimezone(requested?: string | null): string {
  if (typeof requested === 'string' && isValidTimezone(requested)) return requested;
  return DEFAULT_TIMEZONE;
}

// Formatters are expensive to construct and every task hits this path twice.
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dayFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  dayFormatters.set(timeZone, formatter);
  return formatter;
}

/**
 * The YYYY-MM-DD `instant` falls on in `timeZone`. Read back out of Intl rather
 * than computed from a fixed offset so NZDT/NZST transitions are handled by the
 * platform's own zone database instead of an assumed +12.
 */
export function zonedDayKey(instant: Date, timeZone: string): string {
  const parts = dayFormatter(timeZone).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Whole days between the two instants' calendar days in `timeZone`. */
export function differenceInZonedCalendarDays(
  later: Date,
  earlier: Date,
  timeZone: string,
): number {
  return dayIndex(later, timeZone) - dayIndex(earlier, timeZone);
}

/** Calendar day as a day count, so subtracting two of them is DST-proof. */
function dayIndex(instant: Date, timeZone: string): number {
  const [year = 0, month = 1, day = 1] = zonedDayKey(instant, timeZone).split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

// --- Due days ---

/**
 * The calendar date a card is labeled with (YYYY-MM-DD), or null when undated.
 *
 * A due date is a date wearing a timestamp's clothes. The picker
 * (react-day-picker, `mode="single"`) hands back the chosen day at *local
 * midnight*, which is stored as the corresponding instant — so for a board zone
 * ahead of UTC the instant's own UTC date part is the day *before* the label:
 * "13 Aug" picked in NZ is stored as 2026-08-12T12:00:00.000Z. Reading the day
 * back in the board's zone recovers the day the user actually picked, which is
 * the day the card face shows.
 *
 * Every due-day question — the label, the bucket, the overdue count, the board's
 * highlight — goes through here, so the export and the board cannot disagree.
 */
export function dueDayFor(
  dueDate: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return zonedDayKey(due, timeZone);
}

/**
 * The raw date test: the labeled day is before the day of `now`. A task due
 * today is never overdue, whatever the hour. This is the date half only —
 * whole-task callers want `isTaskOverdueOn`, which also requires the task to
 * still be open.
 */
export function isOverdueOn(
  dueDate: Date | string | null | undefined,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  const dueDay = dueDayFor(dueDate, timeZone);
  return dueDay !== null && dueDay < zonedDayKey(now, timeZone);
}

/** Statuses under which a task's clock has stopped. */
const CLOSED_STATUSES: readonly string[] = [TASK_STATUS.DONE, TASK_STATUS.ABANDONED];

/**
 * True when the task's life is over: its stored `status` is done/abandoned, or
 * the stage the board shows it in resolves to done/abandoned. Either signal
 * closes it — the two can disagree (see `statusConflict`), and a card sitting
 * in a Done column must not stay flagged whatever its stale status says, nor
 * the other way round.
 */
export function isClosedTask(task: Task, stages: Stage[] = []): boolean {
  if (typeof task.status === 'string' && CLOSED_STATUSES.includes(task.status)) return true;
  const stageName = stages.find((s) => s.id === task.stageId)?.name;
  return stageName !== undefined && CLOSED_STATUSES.includes(getStatusFromStageName(stageName));
}

/**
 * The overdue flag for a whole task: the date test gated on the task still
 * being open. Done beats the due date — marking a task done (or abandoning it)
 * ends the overdue flagging on its own; the user never has to clear the due
 * date as well.
 */
export function isTaskOverdueOn(
  task: Task,
  stages: Stage[],
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  return !isClosedTask(task, stages) && isOverdueOn(task.dueDate, now, timeZone);
}

/** True when the labeled day is the day of `now`. */
export function isDueTodayOn(
  dueDate: Date | string | null | undefined,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  return dueDayFor(dueDate, timeZone) === zonedDayKey(now, timeZone);
}

/** The card-face label ("Aug 14") for a due date, rendered in `timeZone`. */
export function formatDueDayLabel(
  dueDate: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(due);
}

// --- Urgency ---

/**
 * Per-task urgency relative to `now`. Calendar-day based, so a task due at any
 * time today is "today" rather than "overdue by a few hours".
 *
 * `stages` sharpens the closed-task check with the stage the board shows;
 * callers without stages in hand still get the stored-status half.
 */
export function computeTaskUrgency(
  task: Task,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
  stages: Stage[] = [],
): TaskUrgency {
  const bucketAndDays = dueBucketFor(task, now, timeZone);
  const { daysUntilDue, dueDay } = bucketAndDays;
  // Done beats the due date: a closed task keeps its date facts (`dueDay`,
  // `daysUntilDue`) but carries no due pressure, so it can never be flagged —
  // or briefed — as overdue while only its due date is left uncleared.
  const dueBucket =
    bucketAndDays.dueBucket === DUE_BUCKET.OVERDUE && isClosedTask(task, stages)
      ? DUE_BUCKET.NONE
      : bucketAndDays.dueBucket;
  const isOverdue = dueBucket === DUE_BUCKET.OVERDUE;
  const daysOverdue = isOverdue && daysUntilDue !== null ? -daysUntilDue : 0;

  const briefingRank = rankFor(task, dueBucket);

  return {
    dueDay,
    isOverdue,
    daysOverdue,
    daysUntilDue,
    dueBucket,
    briefingRank,
    mustSurface: briefingRank <= MUST_SURFACE_RANK,
  };
}

function dueBucketFor(
  task: Task,
  now: Date,
  timeZone: string,
): { dueBucket: DueBucketValue; daysUntilDue: number | null; dueDay: string | null } {
  const dueDay = dueDayFor(task.dueDate, timeZone);
  if (dueDay === null) return { dueBucket: DUE_BUCKET.NONE, daysUntilDue: null, dueDay: null };

  const due = new Date(task.dueDate as Date | string);
  const daysUntilDue = differenceInZonedCalendarDays(due, now, timeZone);

  if (daysUntilDue < 0) return { dueBucket: DUE_BUCKET.OVERDUE, daysUntilDue, dueDay };
  if (daysUntilDue === 0) return { dueBucket: DUE_BUCKET.TODAY, daysUntilDue, dueDay };
  if (daysUntilDue === 1) return { dueBucket: DUE_BUCKET.TOMORROW, daysUntilDue, dueDay };
  if (daysUntilDue <= 7) return { dueBucket: DUE_BUCKET.THIS_WEEK, daysUntilDue, dueDay };
  return { dueBucket: DUE_BUCKET.LATER, daysUntilDue, dueDay };
}

function rankFor(task: Task, dueBucket: DueBucketValue): number {
  // Archived work is never briefing material regardless of its due date.
  if (task.archived) return BRIEFING_RANK.ROUTINE;

  if (dueBucket === DUE_BUCKET.OVERDUE) {
    // Stage is the signal here, not `status`: an overdue card the human can see
    // sitting in an In Progress column is the single most surfaceable item.
    return isInProgressStatus(task) ? BRIEFING_RANK.OVERDUE_IN_PROGRESS : BRIEFING_RANK.OVERDUE;
  }
  if (dueBucket === DUE_BUCKET.TODAY) return BRIEFING_RANK.DUE_TODAY;
  if (dueBucket === DUE_BUCKET.TOMORROW) return BRIEFING_RANK.DUE_TOMORROW;
  if (dueBucket === DUE_BUCKET.THIS_WEEK) return BRIEFING_RANK.DUE_THIS_WEEK;
  if (task.priority === 'high' || task.priority === 'critical') return BRIEFING_RANK.HIGH_PRIORITY;
  return BRIEFING_RANK.ROUTINE;
}

/**
 * Rank-time in-progress check. Stages are not in scope here, so fall back to
 * the stored status; `buildBriefing` re-ranks with stage context.
 */
function isInProgressStatus(task: Task): boolean {
  return task.status === 'in_progress';
}

/** Attaches `urgency` to every task without otherwise altering it. */
export function annotateTasksWithUrgency(
  tasks: Task[],
  stages: Stage[],
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): ExportTask[] {
  return tasks.map((task) => {
    const urgency = computeTaskUrgency(task, now, timeZone, stages);
    // Re-rank with stage context so the board's own view of "in progress" wins.
    if (urgency.dueBucket === DUE_BUCKET.OVERDUE && !task.archived) {
      const inProgress = isInProgressStageName(stageNameFor(task, stages));
      urgency.briefingRank = inProgress ? BRIEFING_RANK.OVERDUE_IN_PROGRESS : BRIEFING_RANK.OVERDUE;
      urgency.mustSurface = urgency.briefingRank <= MUST_SURFACE_RANK;
    }
    return { ...task, urgency };
  });
}

function stageNameFor(task: Task, stages: Stage[]): string {
  return stages.find((s) => s.id === task.stageId)?.name ?? '';
}

// --- Digest ---

function toEntry(
  task: ExportTask,
  stages: Stage[],
  subStages: SubStage[],
  ownerLabels: Set<string>,
): BriefingEntry {
  const stage = resolveStageStatus(task, stages);
  const swimlane = resolveSwimlane(task, subStages);
  const owner = task.owner ?? null;
  // Only a lane that names a person can contradict `owner`. Status lanes like
  // "Scheduled Action | On Track" sit in the same tag namespace and must not
  // read as a conflicting assignee.
  const swimlaneNamesPerson = swimlane !== null && ownerLabels.has(swimlane);

  return {
    id: task.id,
    title: task.title,
    stage,
    stageLabel: resolveStageLabel(task, stages),
    storedStatus: task.status ?? null,
    statusConflict: !isBlank(task.status) && task.status !== stage,
    priority: task.priority ?? null,
    owner,
    swimlane,
    ownerConflict: !isBlank(owner) && swimlaneNamesPerson && owner !== swimlane,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    dueDay: task.urgency.dueDay,
    daysOverdue: task.urgency.daysOverdue,
    dueBucket: task.urgency.dueBucket,
    briefingRank: task.urgency.briefingRank,
  };
}

/** Most urgent first, then soonest due, then id — stable across runs. */
function byUrgency(a: BriefingEntry, b: BriefingEntry): number {
  if (a.briefingRank !== b.briefingRank) return a.briefingRank - b.briefingRank;
  if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.id - b.id;
}

export interface BuildBriefingInput {
  tasks: ExportTask[];
  stages: Stage[];
  subStages: SubStage[];
  now: Date;
  /** IANA zone the day boundaries are cut in. See `DEFAULT_TIMEZONE`. */
  timezone: string;
}

/**
 * Pre-built briefing sections. A consumer that reads nothing but `overdue` and
 * `dueToday` still produces a correct report, so no inference step can drop an
 * item that the board is flagging.
 */
export function buildBriefing({
  tasks,
  stages,
  subStages,
  now,
  timezone,
}: BuildBriefingInput): BriefingDigest {
  // Owner labels are free-form, so the set of real people is whatever the board
  // actually uses — the only way to tell a person lane from a status lane.
  const ownerLabels = new Set(
    tasks.map((task) => task.owner).filter((owner): owner is string => !isBlank(owner)),
  );

  const live = tasks
    .filter((task) => !task.archived)
    .map((task) => ({ task, entry: toEntry(task, stages, subStages, ownerLabels) }));

  const pick = (predicate: (entry: BriefingEntry, task: ExportTask) => boolean) =>
    live
      .filter(({ task, entry }) => predicate(entry, task))
      .map(({ entry }) => entry)
      .sort(byUrgency);

  return {
    generatedFor: zonedDayKey(now, timezone),
    now: now.toISOString(),
    timezone,
    overdueRule: overdueRuleFor(timezone),
    overdue: pick((_, task) => task.urgency.isOverdue),
    dueToday: pick((_, task) => task.urgency.dueBucket === DUE_BUCKET.TODAY),
    inProgress: pick((entry) => isInProgressStageName(entry.stageLabel)),
    blocked: pick((entry) => isWaitingStageName(entry.stageLabel)),
    // `stage` folds waiting columns into 'backlog' (the status enum has no
    // waiting value), so a true backlog is backlog-by-stage minus the columns
    // already reported as blocked.
    backlog: pick(
      (entry) => entry.stage === TASK_STATUS.BACKLOG && !isWaitingStageName(entry.stageLabel),
    ),
  };
}

// --- Validation ---

export const taskUrgencySchema = z.object({
  dueDay: z.string().nullable(),
  isOverdue: z.boolean(),
  daysOverdue: z.number(),
  daysUntilDue: z.number().nullable(),
  dueBucket: z.enum([
    DUE_BUCKET.OVERDUE,
    DUE_BUCKET.TODAY,
    DUE_BUCKET.TOMORROW,
    DUE_BUCKET.THIS_WEEK,
    DUE_BUCKET.LATER,
    DUE_BUCKET.NONE,
  ]),
  briefingRank: z.number(),
  mustSurface: z.boolean(),
});

export const briefingEntrySchema = z.object({
  id: z.number(),
  title: z.string(),
  stage: z.string(),
  stageLabel: z.string(),
  storedStatus: z.string().nullable(),
  statusConflict: z.boolean(),
  priority: z.string().nullable(),
  owner: z.string().nullable(),
  swimlane: z.string().nullable(),
  ownerConflict: z.boolean(),
  dueDate: z.string().nullable(),
  dueDay: z.string().nullable(),
  daysOverdue: z.number(),
  dueBucket: taskUrgencySchema.shape.dueBucket,
  briefingRank: z.number(),
});

export const briefingDigestSchema = z.object({
  generatedFor: z.string(),
  now: z.string(),
  timezone: z.string(),
  overdueRule: z.string(),
  overdue: z.array(briefingEntrySchema),
  dueToday: z.array(briefingEntrySchema),
  inProgress: z.array(briefingEntrySchema),
  blocked: z.array(briefingEntrySchema),
  backlog: z.array(briefingEntrySchema),
});
