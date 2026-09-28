import { z } from 'zod';
import type { Task, Stage, SubStage, Project, TaskAttachment } from './schema';
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
 * A task's attachment in the export: the metadata always, and the bytes
 * (`data`, base64) only when the export was taken with
 * `?includeAttachments=true` — that makes the file a complete backup an
 * import can restore the files from. `url` is what the task's description
 * chip references.
 */
export type ExportAttachment = TaskAttachment & { url: string; data?: string };

/**
 * Self-contained export envelope. Deliberately an object rather than a bare
 * array so new sections (boards, settings) can be added without changing the
 * top-level type.
 *
 * `projects` always carries every project, even for a scoped export, so a
 * file can resolve each task's `projectId`. `scope.projectIds` is `null` for
 * an unscoped export and the list of project ids the tasks were filtered to
 * otherwise.
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
    /** null = unscoped; otherwise the project ids the tasks were filtered to. */
    projectIds: number[] | null;
    /** True when `attachments[].data` carries each file's bytes. */
    includeAttachments: boolean;
  };
  counts: {
    tasks: number;
    stages: number;
    subStages: number;
    projects: number;
    attachments: number;
  };
  stages: Stage[];
  subStages: SubStage[];
  tasks: ExportTask[];
  /** Every project, so a scoped file still resolves each task's `projectId`. */
  projects: Project[];
  /** The exported tasks' files. Last in the envelope: with bytes it is the heavy part. */
  attachments: ExportAttachment[];
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
    includeAttachments: z.boolean().optional(),
  }),
  counts: z.object({
    tasks: z.number(),
    stages: z.number(),
    subStages: z.number(),
    projects: z.number(),
    attachments: z.number().optional(),
  }),
  stages: z.array(z.custom<Stage>()),
  subStages: z.array(z.custom<SubStage>()),
  tasks: z.array(z.custom<Task>()),
  projects: z.array(z.custom<Project>()),
  // Optional so export files written before attachments had rows still validate.
  attachments: z.array(z.custom<ExportAttachment>()).optional(),
  // Optional so export files written before the briefing block still validate.
  briefing: briefingDigestSchema.optional(),
});

export const INVALID_EXPORT_PROJECT_ID = 'Invalid projectId: expected a numeric project id';

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
  /**
   * Scope the exported tasks to one project. The `projects` section is still
   * complete, so the file remains self-contained.
   */
  projectId: z
    .string()
    .regex(/^\d+$/, INVALID_EXPORT_PROJECT_ID)
    .transform(Number)
    .pipe(z.number().int().positive(INVALID_EXPORT_PROJECT_ID))
    .optional(),
  /**
   * Embed each attachment's bytes (base64) in `attachments[].data`, making
   * the file a complete backup. Off by default: metadata alone keeps the
   * bundle small for the briefing agent.
   */
  includeAttachments: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
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
  /** Every project on the board. Defaults to none (the in-memory fallback). */
  projects?: Project[];
  includeArchived: boolean;
  /** Project ids `tasks` were filtered to; omit (or null) for an unscoped export. */
  projectIds?: number[] | null;
  /** The exported tasks' files. Defaults to none (the in-memory fallback). */
  attachments?: ExportAttachment[];
  /** True when `attachments[].data` is populated. */
  includeAttachments?: boolean;
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
  projects = [],
  includeArchived,
  projectIds = null,
  attachments = [],
  includeAttachments = false,
  exportedAt,
  timezone,
}: BuildExportBundleInput): TaskExportBundle {
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
      projectIds,
      includeAttachments,
    },
    counts: {
      tasks: tasks.length,
      stages: stages.length,
      subStages: subStages.length,
      projects: projects.length,
      attachments: attachments.length,
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
    attachments,
  };
}

/**
 * The attachments an import payload carries, by id. Empty for files written
 * before attachments had rows: those still hold each file inline in the
 * task's description as a `data:` URL, which the server extracts on save.
 */
export function attachmentsFromExportPayload(payload: unknown): Map<number, ExportAttachment> {
  const byId = new Map<number, ExportAttachment>();
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return byId;
  const { attachments } = payload as { attachments?: unknown };
  if (!Array.isArray(attachments)) return byId;
  for (const entry of attachments as unknown[]) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      typeof (entry as { id?: unknown }).id === 'number'
    ) {
      const attachment = entry as ExportAttachment;
      byId.set(attachment.id, attachment);
    }
  }
  return byId;
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
