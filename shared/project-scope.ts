import { z } from 'zod';

/**
 * Which tasks the board is looking at.
 *
 *  - `'all'`  — every task, whatever its project (the first-run default)
 *  - `'none'` — only tasks that have no project
 *  - a number — only tasks in that project
 *
 * Shared by the client (the header selector, persisted per browser and
 * mirrored into `?project=`) and the server (`?projectId=` on the task-list
 * routes), so both sides read and write the same tokens. Scope is a viewing
 * preference, not a permission boundary: anyone can switch it and see
 * everything (EPIC-01, risk R3).
 */
export type ProjectScope = 'all' | 'none' | number;

export const PROJECT_SCOPE_ALL = 'all';
export const PROJECT_SCOPE_NONE = 'none';

/** The query-string / storage token for a scope. */
export function serializeProjectScope(scope: ProjectScope): string {
  return typeof scope === 'number' ? String(scope) : scope;
}

/** Reads a token back into a scope; `null` when it is not one. */
export function parseProjectScope(raw: unknown): ProjectScope | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const token = raw.trim().toLowerCase();
  if (token === PROJECT_SCOPE_ALL) return PROJECT_SCOPE_ALL;
  if (token === PROJECT_SCOPE_NONE) return PROJECT_SCOPE_NONE;
  if (!/^\d+$/.test(token)) return null;
  const id = Number(token);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * The storage-level reading of a scope: `projectId` absent = no filter,
 * `null` = unassigned tasks only, a number = that project only.
 */
export interface TaskProjectFilter {
  projectId?: number | null;
}

export function projectScopeToFilter(scope: ProjectScope): TaskProjectFilter {
  if (scope === PROJECT_SCOPE_ALL) return {};
  if (scope === PROJECT_SCOPE_NONE) return { projectId: null };
  return { projectId: scope };
}

/** Appends the scope to a task-list URL; `'all'` leaves the URL untouched. */
export function withProjectScopeParam(path: string, scope: ProjectScope): string {
  if (scope === PROJECT_SCOPE_ALL) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}projectId=${encodeURIComponent(serializeProjectScope(scope))}`;
}

export const INVALID_PROJECT_SCOPE_MESSAGE = 'Invalid projectId: expected a project id or "none"';

/** `?projectId=` on the task-list routes. Absent means every task. */
export const projectScopeQuerySchema = z
  .string()
  .optional()
  .transform((raw, ctx): ProjectScope => {
    if (raw === undefined) return PROJECT_SCOPE_ALL;
    const scope = parseProjectScope(raw);
    if (scope === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID_PROJECT_SCOPE_MESSAGE });
      return z.NEVER;
    }
    return scope;
  });

export const taskListQuerySchema = z.object({ projectId: projectScopeQuerySchema });
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
