import { z } from 'zod';
import type { Task, Stage, SubStage } from './schema';
import {
  annotateTasksWithUrgency,
  buildBriefing,
  briefingDigestSchema,
  isValidTimezone,
  resolveTimezone,
  DEFAULT_TIMEZONE,
  type BriefingDigest,
  type ExportTask,
} from './briefing';

/**
 * Bump when the envelope shape changes in a way importers must react to.
 * Adding an optional key is not a breaking change and does not need a bump.
 */
export const EXPORT_FORMAT_VERSION = 1;

export const EXPORT_GENERATOR = 'kanban-local';

/**
 * Message returned when a caller asks for a project-scoped export before the
 * project layer exists (see docs/epics/EPIC-01-project-layer.md).
 */
export const PROJECT_SCOPE_UNSUPPORTED =
  'Project-scoped export is not available yet: tasks have no project. Omit projectId to export everything.';

/**
 * Self-contained export envelope. Deliberately an object rather than a bare
 * array so new sections (projects, boards, settings) can be added without
 * changing the top-level type.
 *
 * `projects` is reserved for the project layer and is always `[]` today;
 * `scope.projectIds` is `null` meaning "everything / no project dimension".
 *
 * `tasks[].urgency` and `briefing` are derived, read-only views of the same
 * data — added for the daily-briefing agent, which cannot be trusted to do
 * date arithmetic or reconcile `status` against `stageId` on its own. Importers
 * ignore both; every stored task field is still present and unmodified.
 */
export interface TaskExportBundle {
  formatVersion: number;
  generator: string;
  exportedAt: string;
  scope: {
    includeArchived: boolean;
    /** null = unscoped. Populated once tasks carry a project. */
    projectIds: number[] | null;
  };
  counts: {
    tasks: number;
    stages: number;
    subStages: number;
    projects: number;
  };
  stages: Stage[];
  subStages: SubStage[];
  tasks: ExportTask[];
  /** Reserved for the project layer; empty until projects exist. */
  projects: unknown[];
  /** Pre-bucketed briefing sections. Derived from `tasks`; never a new source. */
  briefing: BriefingDigest;
}

export const taskExportBundleSchema = z.object({
  formatVersion: z.number(),
  generator: z.string(),
  exportedAt: z.string(),
  scope: z.object({
    includeArchived: z.boolean(),
    projectIds: z.array(z.number()).nullable(),
  }),
  counts: z.object({
    tasks: z.number(),
    stages: z.number(),
    subStages: z.number(),
    projects: z.number(),
  }),
  stages: z.array(z.custom<Stage>()),
  subStages: z.array(z.custom<SubStage>()),
  tasks: z.array(z.custom<Task>()),
  projects: z.array(z.unknown()),
  // Optional so export files written before the briefing block still validate.
  briefing: briefingDigestSchema.optional(),
});

/** Query params accepted by GET /api/export. */
export const exportQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /**
   * `briefing` returns only the digest (~4 KB) instead of the full bundle
   * (~540 KB with embedded images). Built for the scheduled briefing agent,
   * whose fetch tool truncates large responses — it must never need to read
   * past the digest to get the overdue list.
   */
  view: z.enum(['full', 'briefing']).optional().default('full'),
  /**
   * IANA zone the calendar day is cut in, defaulting to `DEFAULT_TIMEZONE`.
   * Explicit so a scheduled 7:00 AM NZT briefing can state the zone it means
   * rather than inheriting whatever the host happens to be set to.
   */
  tz: z
    .string()
    .refine(isValidTimezone, { message: 'Invalid tz: expected an IANA zone like Pacific/Auckland' })
    .optional()
    .default(DEFAULT_TIMEZONE),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

/**
 * The `?view=briefing` response: the digest plus just enough envelope to
 * identify what produced it. Deliberately excludes `tasks` — the digest is
 * self-sufficient, and the heavy descriptions are the reason this view exists.
 */
export interface BriefingExport {
  formatVersion: number;
  generator: string;
  exportedAt: string;
  briefing: BriefingDigest;
}

export function toBriefingExport(bundle: TaskExportBundle): BriefingExport {
  return {
    formatVersion: bundle.formatVersion,
    generator: bundle.generator,
    exportedAt: bundle.exportedAt,
    briefing: bundle.briefing,
  };
}

export interface BuildExportBundleInput {
  tasks: Task[];
  stages: Stage[];
  subStages: SubStage[];
  includeArchived: boolean;
  exportedAt: string;
  /** IANA zone the due-date buckets are cut in. Defaults to `DEFAULT_TIMEZONE`. */
  timezone?: string;
}

/**
 * Single source of truth for the envelope, shared by the server route and the
 * client-side fallback so both always emit the same file shape.
 */
export function buildExportBundle({
  tasks,
  stages,
  subStages,
  includeArchived,
  exportedAt,
  timezone,
}: BuildExportBundleInput): TaskExportBundle {
  const projects: unknown[] = [];

  // `exportedAt` is the single reference instant: the per-task urgency and the
  // briefing buckets are cut against it, so the envelope can never disagree
  // with itself about what "overdue" meant at export time.
  const now = new Date(exportedAt);
  const zone = resolveTimezone(timezone);
  const annotatedTasks = annotateTasksWithUrgency(tasks, stages, now, zone);

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    generator: EXPORT_GENERATOR,
    exportedAt,
    scope: {
      includeArchived,
      projectIds: null,
    },
    counts: {
      tasks: tasks.length,
      stages: stages.length,
      subStages: subStages.length,
      projects: projects.length,
    },
    // Serialization order is deliberate: `briefing` before the heavy arrays.
    // Consumers whose fetch tools truncate large responses (LLM agents cap
    // around ~100 KB) must see the digest before the first base64 blob in
    // `tasks[].description`, or a cut-off read looks like a missing digest.
    briefing: buildBriefing({
      tasks: annotatedTasks,
      stages,
      subStages,
      now,
      timezone: zone,
    }),
    stages,
    subStages,
    tasks: annotatedTasks,
    projects,
  };
}

/**
 * Reads the task list out of an import payload, accepting both the current
 * envelope and the legacy bare-array files produced before this route existed.
 * Returns null when the payload is neither.
 */
export function tasksFromExportPayload(payload: unknown): unknown[] | null {
  // Array.isArray widens `unknown` to `any[]`, hence the explicit casts.
  if (Array.isArray(payload)) return payload as unknown[];
  if (payload !== null && typeof payload === 'object') {
    const { tasks } = payload as { tasks?: unknown };
    if (Array.isArray(tasks)) return tasks as unknown[];
  }
  return null;
}

/** Default download filename for an export taken on the given date. */
export function exportFilename(exportedAt: string): string {
  const day = exportedAt.split('T')[0] ?? exportedAt;
  return `taskflow-export-${day}.json`;
}
