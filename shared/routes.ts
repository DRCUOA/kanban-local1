import { z } from 'zod';
import {
  insertTaskSchema,
  insertStageSchema,
  insertSubStageSchema,
  type Task,
  type Stage,
  type SubStage,
  type TaskHistoryEntry,
} from './schema';

export const api = {
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks',
      responses: {
        200: z.array(z.custom<Task>()),
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
      responses: {
        200: z.array(z.custom<Task>()),
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
    history: {
      method: 'GET' as const,
      path: '/api/tasks/:id/history',
      responses: {
        200: z.array(z.custom<TaskHistoryEntry>()),
        404: z.object({ message: z.string() }),
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
