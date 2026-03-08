/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import { storage } from './storage';
import { parseIdParam } from './utils';
import { api } from '@shared/routes';
import { SEED_STAGE_NAMES } from '@shared/constants';
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Seed data
  const existingStages = await storage.getStages();
  if (existingStages.length === 0) {
    const backlogStage = await storage.createStage({
      name: SEED_STAGE_NAMES.BACKLOG,
      order: 1,
    });
    const inProgressStage = await storage.createStage({
      name: SEED_STAGE_NAMES.IN_PROGRESS,
      order: 2,
    });
    const doneStage = await storage.createStage({
      name: SEED_STAGE_NAMES.DONE,
      order: 3,
    });

    await storage.createTask({
      title: 'Research competitors',
      description: 'Look at Trello, Jira, Asana',
      stageId: backlogStage.id,
    });
    await storage.createTask({
      title: 'Set up project repo',
      description: 'Initialize Git and basic structure',
      stageId: inProgressStage.id,
    });
    await storage.createTask({
      title: 'Ideation phase',
      description: 'Brainstorm core features',
      stageId: doneStage.id,
    });
    console.log('Seeded database with initial stages and tasks');
  }

  // Task endpoints
  app.get(api.tasks.list.path, async (_req: Request, res: Response<Task[]>) => {
    const allTasks = await storage.getTasks();
    res.json(allTasks);
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
        if (error instanceof z.ZodError) {
          res.status(400).json({ message: error.errors[0]?.message ?? 'Validation error' });
        } else {
          res.status(500).json({ message: 'Internal Server Error' });
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
          return res.status(404).json({ message: 'Task not found' });
        }
        res.json(updatedTask);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ message: error.errors[0]?.message ?? 'Validation error' });
        } else {
          res.status(500).json({ message: 'Internal Server Error' });
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
        return res.status(404).json({ message: 'Task not found' });
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
        return res.status(404).json({ message: 'Task not found' });
      }
      res.json(task);
    },
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
        if (error instanceof z.ZodError) {
          res.status(400).json({ message: error.errors[0]?.message ?? 'Validation error' });
        } else {
          res.status(500).json({ message: 'Internal Server Error' });
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
          return res.status(404).json({ message: 'Stage not found' });
        }
        res.json(updatedStage);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ message: error.errors[0]?.message ?? 'Validation error' });
        } else {
          res.status(500).json({ message: 'Internal Server Error' });
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
        return res.status(404).json({ message: 'Task not found' });
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
        if (error instanceof z.ZodError) {
          res.status(400).json({ message: error.errors[0]?.message ?? 'Validation error' });
        } else {
          res.status(500).json({ message: 'Internal Server Error' });
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
          return res.status(404).json({ message: 'Sub-stage not found' });
        }
        res.json(subStage);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ message: error.errors[0]?.message ?? 'Validation error' });
        } else {
          res.status(500).json({ message: 'Internal Server Error' });
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
