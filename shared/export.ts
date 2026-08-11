import { z } from 'zod';
import type { Task, Stage, SubStage } from './schema';

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
  tasks: Task[];
  /** Reserved for the project layer; empty until projects exist. */
  projects: unknown[];
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
});

/** Query params accepted by GET /api/export. */
export const exportQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export interface BuildExportBundleInput {
  tasks: Task[];
  stages: Stage[];
  subStages: SubStage[];
  includeArchived: boolean;
  exportedAt: string;
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
}: BuildExportBundleInput): TaskExportBundle {
  const projects: unknown[] = [];

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
    stages,
    subStages,
    tasks,
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
