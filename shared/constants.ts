// --- Stage kind ---
//
// What a column *means*, held on the column itself (EPIC-03 stories 1 and 2).
//
// This replaces two things that used to disagree: `tasks.status`, a second
// state machine a task carried alongside the column it sat in, and
// `getStatusFromStageName`, which recovered a meaning by substring-matching
// the column's editable display name. A task's state is now exactly the kind
// of the stage it sits in — one fact, one column — so renaming "Done ✔" to
// "Shipped" no longer restates every task in it, and `waiting` is finally a
// state in its own right instead of being folded into backlog.

export const STAGE_KIND = {
  BACKLOG: 'backlog',
  IN_PROGRESS: 'in_progress',
  WAITING: 'waiting',
  DONE: 'done',
  ABANDONED: 'abandoned',
} as const;

export type StageKindValue = (typeof STAGE_KIND)[keyof typeof STAGE_KIND];

export const STAGE_KIND_VALUES = [
  STAGE_KIND.BACKLOG,
  STAGE_KIND.IN_PROGRESS,
  STAGE_KIND.WAITING,
  STAGE_KIND.DONE,
  STAGE_KIND.ABANDONED,
] as const;

export const STAGE_KIND_LABEL: Record<StageKindValue, string> = {
  [STAGE_KIND.BACKLOG]: 'Backlog',
  [STAGE_KIND.IN_PROGRESS]: 'In Progress',
  [STAGE_KIND.WAITING]: 'Waiting',
  [STAGE_KIND.DONE]: 'Done',
  [STAGE_KIND.ABANDONED]: 'Abandoned',
} as const;

/** What each kind means, for the Admin picker that now sets it explicitly. */
export const STAGE_KIND_DESCRIPTION: Record<StageKindValue, string> = {
  [STAGE_KIND.BACKLOG]: 'Not started yet',
  [STAGE_KIND.IN_PROGRESS]: 'Being worked on now',
  [STAGE_KIND.WAITING]: 'Blocked or parked on someone else',
  [STAGE_KIND.DONE]: 'Finished',
  [STAGE_KIND.ABANDONED]: 'Dropped, not finished',
} as const;

/** A column a stage can be created in without a choice being made for it. */
export const DEFAULT_STAGE_KIND: StageKindValue = STAGE_KIND.BACKLOG;

export function isStageKind(value: unknown): value is StageKindValue {
  return typeof value === 'string' && (STAGE_KIND_VALUES as readonly string[]).includes(value);
}

/** Kinds under which a task's clock has stopped: it is off the work queue. */
export const CLOSED_STAGE_KINDS: readonly StageKindValue[] = [
  STAGE_KIND.DONE,
  STAGE_KIND.ABANDONED,
];

/**
 * True for a kind that means the work is over, either way it ended. The board
 * parks these above the archive zone, the Filing menu offers them as somewhere
 * to file finished work, and no warning counts them.
 */
export function isClosedStageKind(kind: StageKindValue): boolean {
  return CLOSED_STAGE_KINDS.includes(kind);
}

// --- Legacy task status ---
//
// `tasks.status` was dropped in EPIC-03 story 2. These values survive only as
// the vocabulary of files written before that: an import carrying a `status`
// key is mapped through `legacyStatusToStageKind` and then forgotten. Nothing
// reads a status off a live task, and nothing should start.

export const TASK_STATUS = {
  BACKLOG: 'backlog',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  ABANDONED: 'abandoned',
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUS_VALUES = [
  TASK_STATUS.BACKLOG,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.DONE,
  TASK_STATUS.ABANDONED,
] as const;

/**
 * A legacy import's `status` as a stage kind. The old enum had no `waiting`,
 * so nothing maps to it — a pre-EPIC-03 file simply cannot say "waiting", and
 * those tasks land in a backlog column exactly as they did before.
 */
export const legacyStatusToStageKind = (status: unknown): StageKindValue | null => {
  switch (status) {
    case TASK_STATUS.IN_PROGRESS:
      return STAGE_KIND.IN_PROGRESS;
    case TASK_STATUS.DONE:
      return STAGE_KIND.DONE;
    case TASK_STATUS.ABANDONED:
      return STAGE_KIND.ABANDONED;
    case TASK_STATUS.BACKLOG:
      return STAGE_KIND.BACKLOG;
    default:
      return null;
  }
};

// --- Task Priority ---

export const TASK_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type TaskPriorityValue = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

export const TASK_PRIORITY_VALUES = [
  TASK_PRIORITY.LOW,
  TASK_PRIORITY.NORMAL,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.CRITICAL,
] as const;

export const TASK_PRIORITY_LABEL: Record<TaskPriorityValue, string> = {
  [TASK_PRIORITY.LOW]: 'Low',
  [TASK_PRIORITY.NORMAL]: 'Normal',
  [TASK_PRIORITY.HIGH]: 'High',
  [TASK_PRIORITY.CRITICAL]: 'Critical',
} as const;

export const PRIORITY_SORT_ORDER: Record<TaskPriorityValue, number> = {
  [TASK_PRIORITY.CRITICAL]: 4,
  [TASK_PRIORITY.HIGH]: 3,
  [TASK_PRIORITY.NORMAL]: 2,
  [TASK_PRIORITY.LOW]: 1,
} as const;

// --- Task Type ---
// A `goal` is the outcome being pursued ("build a shed"); a `building-block`
// is a piece of work towards one ("buy some wood"). Unset (null) is allowed.

export const TASK_TYPE = {
  GOAL: 'goal',
  BUILDING_BLOCK: 'building-block',
} as const;

export type TaskTypeValue = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];

export const TASK_TYPE_VALUES = [TASK_TYPE.GOAL, TASK_TYPE.BUILDING_BLOCK] as const;

export const TASK_TYPE_LABEL: Record<TaskTypeValue, string> = {
  [TASK_TYPE.GOAL]: 'Goal',
  [TASK_TYPE.BUILDING_BLOCK]: 'Building block',
} as const;

// --- Task Recurrence ---

export const TASK_RECURRENCE = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;

export type TaskRecurrenceValue = (typeof TASK_RECURRENCE)[keyof typeof TASK_RECURRENCE];

export const TASK_RECURRENCE_VALUES = [
  TASK_RECURRENCE.NONE,
  TASK_RECURRENCE.DAILY,
  TASK_RECURRENCE.WEEKLY,
  TASK_RECURRENCE.MONTHLY,
] as const;

// --- Effort ---

export const EFFORT_MIN = 1;
export const EFFORT_MAX = 5;

// --- Task Owner ---
// An owner is a row in `owners` (EPIC-06); a task points at one by `ownerId`.
// This is no longer a storage limit — it is the card's display budget. Above
// it, the owner chip shows `key` instead of the full name (EPIC-06 OWN-R30).
export const TASK_OWNER_MAX_LEN = 15;
export const OWNER_NAME_MAX_LEN = 40;
// Optional short code shown on chips where the full name would not fit.
export const OWNER_KEY_MAX_LEN = 4;
export const DEFAULT_OWNER_COLOR = '#0EA5E9';

// --- Projects ---
// A project is a body of work, like a client or a job. It scopes which tasks
// the board shows; it never changes the stages the board is made of.
export const PROJECT_NAME_MAX_LEN = 60;
// Optional short code shown on task chips where the full name would not fit.
export const PROJECT_KEY_MAX_LEN = 6;
export const DEFAULT_PROJECT_COLOR = '#6366F1';

// --- Client Routes ---

export const ROUTES = {
  /** The landing page: choose what the board shows, then GO. */
  HOME: '/',
  /** The board. */
  DASHBOARD: '/board',
  ADMIN: '/admin',
  ARCHIVE: '/archive',
  FILING: '/filing',
  BIN: '/bin',
  /** `/projects/:projectId`, with `none` for tasks that have no project. */
  PROJECT_VIEW: '/projects/:projectId',
  /** `/goals/:goalId`. */
  GOAL_VIEW: '/goals/:goalId',
  /** The developer console: issue and revoke access codes. Answers only with the developer secret. */
  CONSOLE: '/console',
} as const;

/** The goals view of one project, of the tasks with no project (`'none'`), or of every project (`'all'`). */
export const projectViewPath = (projectId: number | 'none' | 'all'): string =>
  ROUTES.PROJECT_VIEW.replace(':projectId', String(projectId));

export const goalViewPath = (goalId: number): string =>
  ROUTES.GOAL_VIEW.replace(':goalId', String(goalId));

// --- Default Stage Colors ---

export const DEFAULT_STAGE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
] as const;

// --- Keyboard Shortcut Stage-Kind Map ---

/** Number keys 1-4 pick a kind of column to move a task into. */
export const KEYBOARD_STAGE_KIND_MAP: Record<string, StageKindValue> = {
  '1': STAGE_KIND.BACKLOG,
  '2': STAGE_KIND.IN_PROGRESS,
  '3': STAGE_KIND.DONE,
  '4': STAGE_KIND.ABANDONED,
} as const;

// --- Seed Stage Names ---

export const SEED_STAGE_NAMES = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
} as const;

// --- Stage Name → Kind Inference (migration only) ---
//
// Deliberately absent. Classifying a column by substring-matching its editable
// display name is EPIC-03 finding #5, and it was wrong in a way nobody could
// see: "Abandoned" contains "done", so `getStatusFromStageName('Abandoned')`
// returned `done`. The inference ran exactly once, in SQL, in migration
// 0014_stage_kind.sql, to seed `stages.kind`. Read `stage.kind` instead; a
// column whose kind is wrong is fixed in Admin, not by renaming it.
