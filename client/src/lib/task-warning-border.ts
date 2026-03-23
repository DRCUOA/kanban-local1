import type { TaskWarningHighlightKind } from '@shared/task-warning-highlight';

/** Inline border colors — must match TaskWarnings left accents (see index.css variables). */
export const TASK_WARNING_BORDER_COLOR: Record<TaskWarningHighlightKind, string> = {
  overdue: 'hsl(var(--toast-overdue-accent))',
  high_priority_backlog: 'hsl(var(--warning-accent))',
  stale: 'hsl(var(--toast-info-accent))',
};
