import { z } from 'zod';
import {
  insertTaskSchema,
  insertStageSchema,
  insertSubStageSchema,
  insertProjectSchema,
  type Task,
  type Stage,
  type SubStage,
  type Project,
  type ProjectSummary,
  type TaskHistoryEntry,
} from './schema';
import { exportQuerySchema, taskExportBundleSchema } from './export';
import { taskListQuerySchema } from './project-scope';

export const api = {
  health: {
    method: 'GET' as const,
    path: '/api/health',
    responses: {
      200: z.object({ ok: z.literal(true) }),
    },
  },
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks',
      /** `?projectId=<id>|none` scopes the list; absent returns every task. */
      query: taskListQuerySchema,
      responses: {
        200: z.array(z.custom<Task>()),
        400: z.object({ error: z.string(), status: z.number() }),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tasks',
      input: insertTaskSchema,
      responses: {
        201: z.custom<Task>(),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/tasks/:id',
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<Task>(),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/tasks/:id',
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
    archived: {
      method: 'GET' as const,
      path: '/api/tasks/archived',
      query: taskListQuerySchema,
      responses: {
        200: z.array(z.custom<Task>()),
        400: z.object({ error: z.string(), status: z.number() }),
      },
    },
    archive: {
      method: 'POST' as const,
      path: '/api/tasks/:id/archive',
      responses: {
        200: z.custom<Task>(),
        404: z.object({ message: z.string() }),
      },
    },
    unarchive: {
      method: 'POST' as const,
      path: '/api/tasks/:id/unarchive',
      responses: {
        200: z.custom<Task>(),
        404: z.object({ message: z.string() }),
      },
    },
    deleted: {
      method: 'GET' as const,
      path: '/api/tasks/deleted',
      responses: {
        200: z.array(z.custom<Task>()),
      },
    },
    bin: {
      method: 'POST' as const,
      path: '/api/tasks/:id/bin',
      responses: {
        200: z.custom<Task>(),
        404: z.object({ message: z.string() }),
      },
    },
    restore: {
      method: 'POST' as const,
      path: '/api/tasks/:id/restore',
      responses: {
        200: z.custom<Task>(),
        404: z.object({ message: z.string() }),
      },
    },
    history: {
      method: 'GET' as const,
      path: '/api/tasks/:id/history',
      responses: {
        200: z.array(z.custom<TaskHistoryEntry>()),
        404: z.object({ message: z.string() }),
      },
    },
    owners: {
      method: 'GET' as const,
      path: '/api/tasks/owners',
      responses: {
        200: z.array(z.string()),
      },
    },
  },
  projects: {
    /** Every project, archived ones last, each with its live task count. */
    list: {
      method: 'GET' as const,
      path: '/api/projects',
      responses: {
        200: z.array(z.custom<ProjectSummary>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects',
      input: insertProjectSchema,
      responses: {
        201: z.custom<Project>(),
        400: z.object({ error: z.string(), status: z.number() }),
        409: z.object({ error: z.string(), status: z.number() }),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/projects/:id',
      input: insertProjectSchema.partial(),
      responses: {
        200: z.custom<Project>(),
        404: z.object({ error: z.string(), status: z.number() }),
        409: z.object({ error: z.string(), status: z.number() }),
      },
    },
    /** Deleting a project releases its tasks (their `projectId` becomes null). */
    delete: {
      method: 'DELETE' as const,
      path: '/api/projects/:id',
      responses: {
        204: z.void(),
        404: z.object({ error: z.string(), status: z.number() }),
      },
    },
  },
  export: {
    get: {
      method: 'GET' as const,
      path: '/api/export',
      query: exportQuerySchema,
      responses: {
        200: taskExportBundleSchema,
        400: z.object({ error: z.string(), status: z.number() }),
      },
    },
  },
  stages: {
    list: {
      method: 'GET' as const,
      path: '/api/stages',
      responses: {
        200: z.array(z.custom<Stage>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/stages',
      input: insertStageSchema,
      responses: {
        201: z.custom<Stage>(),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/stages/:id',
      input: insertStageSchema.partial(),
      responses: {
        200: z.custom<Stage>(),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/stages/:id',
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  subStages: {
    list: {
      method: 'GET' as const,
      path: '/api/sub-stages',
      responses: {
        200: z.array(z.custom<SubStage>()),
      },
    },
    listByStage: {
      method: 'GET' as const,
      path: '/api/stages/:stageId/sub-stages',
      responses: {
        200: z.array(z.custom<SubStage>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sub-stages',
      input: insertSubStageSchema,
      responses: {
        201: z.custom<SubStage>(),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/sub-stages/:id',
      input: insertSubStageSchema.partial(),
      responses: {
        200: z.custom<SubStage>(),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sub-stages/:id',
      responses: {
        204: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
  },
};
