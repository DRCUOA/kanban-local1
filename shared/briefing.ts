import { differenceInCalendarDays, startOfDay } from 'date-fns';
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
 * which calendar day boundary was used without reading this file.
 */
export const OVERDUE_RULE =
  'A task is overdue when its dueDate falls on a calendar day before the day of `now`, evaluated in `timezone`. A task due today is never overdue. Matches the board’s own overdue highlight.';

export interface TaskUrgency {
  isOverdue: boolean;
  /** Whole calendar days past due; 0 when not overdue. */
  daysOverdue: number;
  /** Calendar days until due; negative when overdue, null when undated. */
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
  dueDate: string | null;
  daysOverdue: number;
  dueBucket: DueBucketValue;
  briefingRank: number;
}

export interface BriefingDigest {
  /** Local calendar date the buckets were computed for (YYYY-MM-DD). */
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

function cleanLabel(name: string): string {
  // Stage names carry decorative emoji and stray whitespace ("Waiting ✋️ ").
  return name
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

// --- Urgency ---

/**
 * Per-task urgency relative to `now`. Calendar-day based, so a task due at any
 * time today is "today" rather than "overdue by a few hours".
 */
export function computeTaskUrgency(task: Task, now: Date): TaskUrgency {
  const bucketAndDays = dueBucketFor(task, now);
  const { dueBucket, daysUntilDue } = bucketAndDays;
  const isOverdue = dueBucket === DUE_BUCKET.OVERDUE;
  const daysOverdue = isOverdue && daysUntilDue !== null ? -daysUntilDue : 0;

  const briefingRank = rankFor(task, dueBucket);

  return {
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
): { dueBucket: DueBucketValue; daysUntilDue: number | null } {
  if (!task.dueDate) return { dueBucket: DUE_BUCKET.NONE, daysUntilDue: null };

  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return { dueBucket: DUE_BUCKET.NONE, daysUntilDue: null };

  const daysUntilDue = differenceInCalendarDays(startOfDay(due), startOfDay(now));

  if (daysUntilDue < 0) return { dueBucket: DUE_BUCKET.OVERDUE, daysUntilDue };
  if (daysUntilDue === 0) return { dueBucket: DUE_BUCKET.TODAY, daysUntilDue };
  if (daysUntilDue === 1) return { dueBucket: DUE_BUCKET.TOMORROW, daysUntilDue };
  if (daysUntilDue <= 7) return { dueBucket: DUE_BUCKET.THIS_WEEK, daysUntilDue };
  return { dueBucket: DUE_BUCKET.LATER, daysUntilDue };
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
export function annotateTasksWithUrgency(tasks: Task[], stages: Stage[], now: Date): ExportTask[] {
  return tasks.map((task) => {
    const urgency = computeTaskUrgency(task, now);
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
    generatedFor: localDateKey(now),
    now: now.toISOString(),
    timezone,
    overdueRule: OVERDUE_RULE,
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

/** Local-time YYYY-MM-DD, matching the calendar day the buckets were cut on. */
function localDateKey(now: Date): string {
  const day = startOfDay(now);
  const month = `${day.getMonth() + 1}`.padStart(2, '0');
  const date = `${day.getDate()}`.padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}

/** The zone calendar boundaries are evaluated in — the host's zone. */
export function resolveTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// --- Validation ---

export const taskUrgencySchema = z.object({
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
