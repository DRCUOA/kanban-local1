// --- Task Status ---

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

export const TASK_STATUS_LABEL: Record<TaskStatusValue, string> = {
  [TASK_STATUS.BACKLOG]: 'Backlog',
  [TASK_STATUS.IN_PROGRESS]: 'In Progress',
  [TASK_STATUS.DONE]: 'Done',
  [TASK_STATUS.ABANDONED]: 'Abandoned',
} as const;

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

// --- Client Routes ---

export const ROUTES = {
  DASHBOARD: '/',
  ADMIN: '/admin',
  ARCHIVE: '/archive',
} as const;

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

// --- Keyboard Shortcut Status Map ---

export const KEYBOARD_STATUS_MAP: Record<string, TaskStatusValue> = {
  '1': TASK_STATUS.BACKLOG,
  '2': TASK_STATUS.IN_PROGRESS,
  '3': TASK_STATUS.DONE,
  '4': TASK_STATUS.ABANDONED,
} as const;

// --- Seed Stage Names ---

export const SEED_STAGE_NAMES = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
} as const;

// --- Stage Name → Status Inference ---

export function getStatusFromStageName(stageName: string): TaskStatusValue {
  const name = stageName.toLowerCase();
  if (name.includes('progress') || name.includes('doing') || name.includes('active'))
    return TASK_STATUS.IN_PROGRESS;
  if (name.includes('done') || name.includes('complete') || name.includes('finished'))
    return TASK_STATUS.DONE;
  if (name.includes('abandon') || name.includes('cancel')) return TASK_STATUS.ABANDONED;
  return TASK_STATUS.BACKLOG;
}

export function isInProgressStageName(stageName: string): boolean {
  const name = stageName.toLowerCase();
  return name.includes('progress') || name.includes('doing') || name.includes('active');
}
