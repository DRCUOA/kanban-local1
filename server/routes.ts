/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import { storage } from './storage';
import { asyncHandler } from './errors';
import { parseIdParam } from './utils';
import { api } from '@shared/routes';

const healthPath = api.health.path;
import { z } from 'zod';
import type {
  Task,
  InsertTask,
  Stage,
  InsertStage,
  SubStage,
  InsertSubStage,
  TaskHistoryEntry,
} from '@shared/schema';
import type { ApiErrorResponse, IdParams, StageIdParams } from '@shared/api-types';
import {
  buildExportBundle,
  toBriefingExport,
  PROJECT_SCOPE_UNSUPPORTED,
  type BriefingExport,
  type ExportQuery,
  type TaskExportBundle,
} from '@shared/export';
import { logger } from '@shared/logger';
import { registerGmailPubSubWebhook } from './webhooks/gmail-pubsub';

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerGmailPubSubWebhook(app);

  app.get(healthPath, (_req: Request, res: Response<{ ok: true }>) => {
    res.status(200).json({ ok: true });
  });

  // Task endpoints
  app.get(api.tasks.list.path, async (_req: Request, res: Response<Task[]>) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
  });

  // Distinct owners — registered before any /api/tasks/:id routes so the
  // literal "owners" segment never gets captured as an id.
  app.get(api.tasks.owners.path, async (_req: Request, res: Response<string[]>) => {
    const owners = await storage.getDistinctOwners();
    res.json(owners);
  });

  app.post(
    api.tasks.create.path,
    async (
      req: Request<Record<string, string>, Task | ApiErrorResponse, InsertTask>,
      res: Response<Task | ApiErrorResponse>,
    ) => {
      try {
        const taskData = api.tasks.create.input.parse(req.body);
        const task = await storage.createTask(taskData);
        res.status(201).json(task);
      } catch (error) {
        if (res.headersSent) {
          logger.error('Error after response already sent (task create):', error);
          return;
        }
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: error.errors[0]?.message ?? 'Validation error', status: 400 });
        } else {
          res.status(500).json({ error: 'Internal Server Error', status: 500 });
        }
      }
    },
  );

  app.patch(
    api.tasks.update.path,
    async (
      req: Request<IdParams, Task | ApiErrorResponse, Partial<InsertTask>>,
      res: Response<Task | ApiErrorResponse>,
    ) => {
      try {
        const id = parseIdParam(req.params.id, res);
        if (id === null) return;
        const updates = api.tasks.update.input.parse(req.body);
        const updatedTask = await storage.updateTask(id, updates);
        if (!updatedTask) {
          return res.status(404).json({ error: 'Task not found', status: 404 });
        }
        res.json(updatedTask);
      } catch (error) {
        if (res.headersSent) {
          logger.error('Error after response already sent (task update):', error);
          return;
        }
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: error.errors[0]?.message ?? 'Validation error', status: 400 });
        } else {
          res.status(500).json({ error: 'Internal Server Error', status: 500 });
        }
      }
    },
  );

  app.delete(
    api.tasks.delete.path,
    async (req: Request<IdParams>, res: Response<ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      await storage.deleteTask(id);
      res.status(204).send();
    },
  );

  app.get(api.tasks.archived.path, async (_req: Request, res: Response<Task[]>) => {
    const archivedTasks = await storage.getArchivedTasks();
    res.json(archivedTasks);
  });

  app.post(
    api.tasks.archive.path,
    async (req: Request<IdParams>, res: Response<Task | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const task = await storage.archiveTask(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found', status: 404 });
      }
      res.json(task);
    },
  );

  app.post(
    api.tasks.unarchive.path,
    async (req: Request<IdParams>, res: Response<Task | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const task = await storage.unarchiveTask(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found', status: 404 });
      }
      res.json(task);
    },
  );

  // Export endpoint — returns the whole board as a single JSON envelope.
  // Shape is defined once in shared/export.ts so the client download and this
  // route can never drift apart.
  // asyncHandler: Express 4 does not catch rejections from async handlers, so
  // without it a failing query escapes as an unhandled rejection (hung request,
  // errors only on the server console) instead of a JSON 500.
  app.get(
    api.export.get.path,
    asyncHandler(
      async (req: Request, res: Response<TaskExportBundle | BriefingExport | ApiErrorResponse>) => {
        // Every response is a fresh snapshot of a board that changes all day, so
        // nothing between here and the caller may keep one. Set before any
        // branch below: an error response must not be cached either.
        //
        // A briefing agent polling the identical URL was served a 12-hour-old
        // body (same `exportedAt`) until a junk query param forced a rebuild —
        // proof something keyed on the exact URL was pinning it.
        // `CDN-Cache-Control` covers a CDN edge that ignores `Cache-Control`;
        // `Pragma`/`Expires` cover HTTP/1.0 proxies that ignore both.
        res.set({
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'CDN-Cache-Control': 'no-store',
          Pragma: 'no-cache',
          Expires: '0',
        });

        // The project layer does not exist yet, so a project-scoped request can
        // only be answered with a lie. Fail loudly instead of silently returning
        // everything. See docs/epics/EPIC-01-project-layer.md.
        if (req.query.projectId !== undefined) {
          return res.status(400).json({ error: PROJECT_SCOPE_UNSUPPORTED, status: 400 });
        }

        let query: ExportQuery;
        try {
          query = api.export.get.query.parse(req.query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return res.status(400).json({
              error: error.errors[0]?.message ?? 'Invalid export query',
              status: 400,
            });
          }
          throw error;
        }

        const [activeTasks, archivedTasks, allStages, allSubStages] = await Promise.all([
          storage.getTasks(),
          query.includeArchived ? storage.getArchivedTasks() : Promise.resolve([]),
          storage.getStages(),
          storage.getSubStages(),
        ]);

        const bundle = buildExportBundle({
          tasks: [...activeTasks, ...archivedTasks],
          stages: allStages,
          subStages: allSubStages,
          includeArchived: query.includeArchived,
          exportedAt: new Date().toISOString(),
          // Day boundaries are cut in the caller's zone, defaulting to New
          // Zealand — not the host's, which is UTC and a day behind all NZ
          // morning.
          timezone: query.tz,
        });

        // The briefing view exists for consumers whose fetch tools truncate
        // large responses: ~4 KB of digest instead of ~540 KB of bundle.
        res.json(query.view === 'briefing' ? toBriefingExport(bundle) : bundle);
      },
    ),
  );

  // Stage endpoints
  app.get(api.stages.list.path, async (_req: Request, res: Response<Stage[]>) => {
    const allStages = await storage.getStages();
    res.json(allStages);
  });

  app.post(
    api.stages.create.path,
    async (
      req: Request<Record<string, string>, Stage | ApiErrorResponse, InsertStage>,
      res: Response<Stage | ApiErrorResponse>,
    ) => {
      try {
        const stageData = api.stages.create.input.parse(req.body);
        const stage = await storage.createStage(stageData);
        res.status(201).json(stage);
      } catch (error) {
        if (res.headersSent) {
          logger.error('Error after response already sent (stage create):', error);
          return;
        }
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: error.errors[0]?.message ?? 'Validation error', status: 400 });
        } else {
          res.status(500).json({ error: 'Internal Server Error', status: 500 });
        }
      }
    },
  );

  app.patch(
    api.stages.update.path,
    async (
      req: Request<IdParams, Stage | ApiErrorResponse, Partial<InsertStage>>,
      res: Response<Stage | ApiErrorResponse>,
    ) => {
      try {
        const id = parseIdParam(req.params.id, res);
        if (id === null) return;
        const updates = api.stages.update.input.parse(req.body);
        const updatedStage = await storage.updateStage(id, updates);
        if (!updatedStage) {
          return res.status(404).json({ error: 'Stage not found', status: 404 });
        }
        res.json(updatedStage);
      } catch (error) {
        if (res.headersSent) {
          logger.error('Error after response already sent (stage update):', error);
          return;
        }
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: error.errors[0]?.message ?? 'Validation error', status: 400 });
        } else {
          res.status(500).json({ error: 'Internal Server Error', status: 500 });
        }
      }
    },
  );

  app.delete(
    api.stages.delete.path,
    async (req: Request<IdParams>, res: Response<ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      await storage.deleteStage(id);
      res.status(204).send();
    },
  );

  // Task history endpoint
  app.get(
    api.tasks.history.path,
    async (req: Request<IdParams>, res: Response<TaskHistoryEntry[] | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const task = await storage.getTaskById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found', status: 404 });
      }
      res.json(task.history ?? []);
    },
  );

  // Sub-stage endpoints
  app.get(api.subStages.list.path, async (_req: Request, res: Response<SubStage[]>) => {
    const allSubStages = await storage.getSubStages();
    res.json(allSubStages);
  });

  app.get(
    api.subStages.listByStage.path,
    async (req: Request<StageIdParams>, res: Response<SubStage[] | ApiErrorResponse>) => {
      const stageId = parseIdParam(req.params.stageId, res, 'stage ID');
      if (stageId === null) return;
      const subStageList = await storage.getSubStagesByStage(stageId);
      res.json(subStageList);
    },
  );

  app.post(
    api.subStages.create.path,
    async (
      req: Request<Record<string, string>, SubStage | ApiErrorResponse, InsertSubStage>,
      res: Response<SubStage | ApiErrorResponse>,
    ) => {
      try {
        const validated = api.subStages.create.input.parse(req.body);
        const subStage = await storage.createSubStage(validated);
        res.status(201).json(subStage);
      } catch (error) {
        if (res.headersSent) {
          logger.error('Error after response already sent (sub-stage create):', error);
          return;
        }
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: error.errors[0]?.message ?? 'Validation error', status: 400 });
        } else {
          res.status(500).json({ error: 'Internal Server Error', status: 500 });
        }
      }
    },
  );

  app.patch(
    api.subStages.update.path,
    async (
      req: Request<IdParams, SubStage | ApiErrorResponse, Partial<InsertSubStage>>,
      res: Response<SubStage | ApiErrorResponse>,
    ) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      try {
        const validated = api.subStages.update.input.parse(req.body);
        const subStage = await storage.updateSubStage(id, validated);
        if (!subStage) {
          return res.status(404).json({ error: 'Sub-stage not found', status: 404 });
        }
        res.json(subStage);
      } catch (error) {
        if (res.headersSent) {
          logger.error('Error after response already sent (sub-stage update):', error);
          return;
        }
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ error: error.errors[0]?.message ?? 'Validation error', status: 400 });
        } else {
          res.status(500).json({ error: 'Internal Server Error', status: 500 });
        }
      }
    },
  );

  app.delete(
    api.subStages.delete.path,
    async (req: Request<IdParams>, res: Response<ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      await storage.deleteSubStage(id);
      res.status(204).send();
    },
  );

  return httpServer;
}
