/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import { storage, DependencyRuleError } from './storage';
import { AppError, asyncHandler } from './errors';
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
  Project,
  ProjectSummary,
  InsertProject,
  Owner,
  OwnerSummary,
  InsertOwner,
  TaskHistoryEntry,
  TaskDependency,
} from '@shared/schema';
import type {
  ApiErrorResponse,
  IdParams,
  StageIdParams,
  UploadedAttachmentResponse,
} from '@shared/api-types';
import {
  buildExportBundle,
  toBriefingExport,
  type BriefingExport,
  type ExportQuery,
  type TaskExportBundle,
} from '@shared/export';
import { projectScopeToFilter } from '@shared/project-scope';
import { logger } from '@shared/logger';
import { goalLinkError, normaliseGoalLink } from '@shared/task-goal';
import { bulkChange } from '@shared/bulk-edit';
import { TASK_TYPE } from '@shared/constants';
import { suggestGoalPlan, GoalPlanRequestError } from './goal-plan';
import { goalPlanOptionsSchema } from '@shared/goal-plan';
import { getAiSettings, updateAiSettings, SettingsRequestError } from './settings';
import { registerGmailPubSubWebhook, GMAIL_PUBSUB_WEBHOOK_PATH } from './webhooks/gmail-pubsub';
import { registerInboxRoute } from './inbox/route';
import { installAccess } from './access';
import express from 'express';
import type { ExportAttachment } from '@shared/export';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_NAME_HEADER,
  ATTACHMENT_TYPE_HEADER,
  attachmentServesInline,
  attachmentUrl,
  resolveAttachmentType,
  sanitizeAttachmentFilename,
} from '@shared/attachments';
import {
  contentDispositionHeader,
  prepareDescriptionAttachments,
  syncTaskAttachments,
} from './attachments';

/**
 * Validates with a Zod schema inside an `asyncHandler` route: a failure becomes
 * a 400 through `errorHandler` instead of the 500 a bare ZodError would be.
 */
function parseOrThrow<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, result.error.errors[0]?.message ?? 'Validation error');
  }
  return result.data;
}

/**
 * Two projects with the same name would make the header selector ambiguous,
 * so a create or rename that collides (case-insensitively) is a 409.
 */
async function assertProjectNameFree(name: string, exceptId?: number): Promise<void> {
  const wanted = name.trim().toLowerCase();
  const existing = await storage.getProjects();
  const clash = existing.find((p) => p.id !== exceptId && p.name.trim().toLowerCase() === wanted);
  if (clash) {
    throw new AppError(409, `A project named “${clash.name}” already exists`);
  }
}

/**
 * Owner names are unique case-insensitively (the database enforces it too), so
 * a create or rename that collides is a 409 — EPIC-06 OWN-R4.
 */
async function assertOwnerNameFree(name: string, exceptId?: number): Promise<void> {
  const wanted = name.trim().toLowerCase();
  const existing = await storage.getOwners();
  const clash = existing.find((o) => o.id !== exceptId && o.name.trim().toLowerCase() === wanted);
  if (clash) {
    throw new AppError(409, `An owner named “${clash.name}” already exists`);
  }
}

/**
 * A task may only be assigned to an owner that exists. Free text can no longer
 * invent a person, so an unknown id is a 400 that names it — EPIC-06 OWN-R3.
 * Returns an error message, or null when the write is fine.
 */
/**
 * Applies the goal-link rules to a task write (migration 0017): only a
 * building-block keeps a goal, and the goal must exist and be a goal. `current`
 * is the stored row for a PATCH, so a write that only changes `type` still
 * clears a goal it no longer qualifies for. Returns the write to store and an
 * error message (null when fine).
 */
async function checkGoalLink<
  T extends { type?: string | null; goalTaskId?: number | null; projectId?: number | null },
>(write: T, current?: Task): Promise<{ write: T; error: string | null }> {
  const type = write.type !== undefined ? write.type : (current?.type ?? null);
  const goalTaskId =
    write.goalTaskId !== undefined ? write.goalTaskId : (current?.goalTaskId ?? null);
  const normalised = normaliseGoalLink({ ...write, type, goalTaskId });
  // Only touch the goal column when the caller did, or when normalising cleared it.
  const out = { ...write };
  if (write.goalTaskId !== undefined || normalised.goalTaskId !== goalTaskId) {
    out.goalTaskId = normalised.goalTaskId;
  }
  if (normalised.goalTaskId == null) return { write: out, error: null };
  const target = await storage.getTaskById(normalised.goalTaskId);
  const projectId = write.projectId !== undefined ? write.projectId : (current?.projectId ?? null);
  return {
    write: out,
    error: goalLinkError(normalised.goalTaskId, target, current?.id, projectId),
  };
}

async function unknownOwnerMessage(ownerId: number | null | undefined): Promise<string | null> {
  if (ownerId === undefined || ownerId === null) return null;
  const owner = await storage.getOwnerById(ownerId);
  return owner ? null : `Unknown owner ${ownerId}`;
}

/**
 * One stage holds at most one lane per owner, or "this stage's tasks owned by
 * Rich" has two homes — EPIC-06 OWN-R15. Returns an error message, or null.
 */
async function laneOwnerClashMessage(
  ownerId: number | null | undefined,
  stageId: number | undefined,
  exceptId?: number,
): Promise<string | null> {
  if (ownerId === undefined || ownerId === null) return null;
  const owner = await storage.getOwnerById(ownerId);
  if (!owner) return `Unknown owner ${ownerId}`;
  const lanes = await storage.getSubStages();
  const self = exceptId === undefined ? undefined : lanes.find((l) => l.id === exceptId);
  const inStage = stageId ?? self?.stageId;
  if (inStage === undefined) return null;
  const clash = lanes.find(
    (lane) => lane.id !== exceptId && lane.stageId === inStage && lane.ownerId === ownerId,
  );
  return clash ? `The lane “${clash.name}” in this stage is already ${owner.name}'s` : null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // First: every /api request below needs an admitted device (server/access).
  // The Gmail webhook keeps its own guard, Google's signed token; the inbox is
  // opened by an inbox token, which the gate itself checks.
  installAccess(app, [GMAIL_PUBSUB_WEBHOOK_PATH]);
  registerGmailPubSubWebhook(app);
  registerInboxRoute(app);

  app.get(healthPath, (_req: Request, res: Response<{ ok: true }>) => {
    res.status(200).json({ ok: true });
  });

  // Task endpoints. `?projectId=<id>|none` scopes the list server-side — the
  // board never fetches everything and hides the rest client-side.
  app.get(
    api.tasks.list.path,
    asyncHandler(async (req: Request, res: Response<Task[] | ApiErrorResponse>) => {
      const query = parseOrThrow(api.tasks.list.query, req.query);
      const allTasks = await storage.getTasks(projectScopeToFilter(query.projectId));
      res.json(allTasks);
    }),
  );

  // Distinct owners — registered before any /api/tasks/:id routes so the
  // literal "owners" segment never gets captured as an id.
  // --- Bulk edit ----------------------------------------------------------

  app.post(
    api.bulkUpdate.run.path,
    asyncHandler(async (req: Request, res: Response) => {
      const { ids, field, value } = parseOrThrow(api.bulkUpdate.run.input, req.body);
      let change: Record<string, unknown>;
      try {
        change = bulkChange(field, value);
      } catch (error) {
        const message = error instanceof z.ZodError ? error.errors[0]?.message : undefined;
        throw new AppError(400, message ?? 'That value is not valid for this field');
      }
      const fail = (error: string) => res.status(400).json({ error, status: 400 });
      if (field === 'ownerId') {
        const unknown = await unknownOwnerMessage(change.ownerId as number | null);
        if (unknown) return fail(unknown);
      }
      // The same goal-link rules a single save applies, task by task, so a
      // type change clears goals it no longer allows and a goal must fit.
      const changes: { id: number; updates: Partial<InsertTask> }[] = [];
      for (const id of new Set(ids)) {
        const current = await storage.getTaskById(id);
        if (!current || current.deletedAt) return fail(`Task ${id} not found`);
        let updates = change as Partial<InsertTask>;
        if (field === 'goalTaskId' && change.goalTaskId != null) {
          // Giving tasks a goal makes them its building-blocks; a goal cannot have one.
          if (current.type === TASK_TYPE.GOAL) {
            return fail(`#${id} ${current.title} is a goal, so it cannot belong to another goal`);
          }
          if (current.type !== TASK_TYPE.BUILDING_BLOCK) {
            updates = { ...updates, type: TASK_TYPE.BUILDING_BLOCK };
          }
        }
        const checked = await checkGoalLink(updates, current);
        if (checked.error) return fail(`#${id} ${current.title}: ${checked.error}`);
        changes.push({ id, updates: checked.write });
      }
      try {
        res.json({ updated: await storage.bulkUpdateTasks(changes) });
      } catch (error) {
        // A database rule (goal link, project consistency, dependencies) refused
        // one of them: nothing was changed.
        if ((error as { code?: string }).code === '23514') {
          return fail(`Nothing was changed: ${(error as Error).message}`);
        }
        throw error;
      }
    }),
  );

  // --- AI assistant ("Make this a goal") ---------------------------------

  app.get(
    api.aiSettings.get.path,
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await getAiSettings());
    }),
  );

  app.put(
    api.aiSettings.update.path,
    asyncHandler(async (req: Request, res: Response) => {
      const input = parseOrThrow(api.aiSettings.update.input, req.body);
      try {
        res.json(await updateAiSettings(input));
      } catch (error) {
        if (error instanceof SettingsRequestError) {
          res.status(400).json({ error: error.message, status: 400 });
          return;
        }
        logger.error('AI settings update failed:', error);
        res.status(502).json({
          error: 'Could not reach OpenAI to check the key. Nothing was saved; try again.',
          status: 502,
        });
      }
    }),
  );

  app.post(
    api.goalPlan.suggest.path,
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const options = parseOrThrow(goalPlanOptionsSchema, req.body ?? {});
      try {
        res.json(await suggestGoalPlan(id, options));
      } catch (error) {
        if (error instanceof GoalPlanRequestError) {
          res.status(400).json({ error: error.message, status: 400 });
          return;
        }
        // The provider's own message (bad key, unknown model, quota) is what
        // the user needs to fix it; nothing secret is in it.
        logger.error('goal-plan suggestion failed:', error);
        const message = error instanceof Error ? error.message : 'AI request failed';
        res.status(502).json({ error: `The AI request failed: ${message}`, status: 502 });
      }
    }),
  );

  app.post(
    api.goalPlan.apply.path,
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const plan = parseOrThrow(api.goalPlan.apply.input, req.body);
      try {
        res.status(201).json(await storage.applyGoalPlan(id, plan));
      } catch (error) {
        if (error instanceof DependencyRuleError) {
          res.status(400).json({ error: error.message, status: 400 });
          return;
        }
        if ((error as { code?: string }).code === '23514') {
          res.status(400).json({ error: (error as Error).message, status: 400 });
          return;
        }
        throw error;
      }
    }),
  );

  app.get(
    api.taskDependencies.list.path,
    async (_req: Request, res: Response<TaskDependency[]>) => {
      res.json(await storage.getTaskDependencies());
    },
  );

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
        const parsed = api.tasks.create.input.parse(req.body);
        const goalCheck = await checkGoalLink(parsed);
        if (goalCheck.error) {
          return res.status(400).json({ error: goalCheck.error, status: 400 });
        }
        const { predecessorIds, successorIds, ...taskData } = goalCheck.write;
        const unknownOwner = await unknownOwnerMessage(taskData.ownerId);
        if (unknownOwner) {
          return res.status(400).json({ error: unknownOwner, status: 400 });
        }
        // Files the description references become the task's once it exists.
        const prepared = taskData.description
          ? await prepareDescriptionAttachments(storage, taskData.description, null)
          : null;
        const task = await storage.createTask(
          prepared ? { ...taskData, description: prepared.description } : taskData,
        );
        if (predecessorIds || successorIds) {
          try {
            await storage.setTaskDependencies(task.id, { predecessorIds, successorIds });
          } catch (depError) {
            // The task did not get the links the caller asked for; do not leave it half made.
            await storage.deleteTask(task.id);
            throw depError;
          }
        }
        if (prepared) {
          await syncTaskAttachments(storage, task.id, prepared.attachmentIds, { release: false });
        }
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
        } else if (error instanceof DependencyRuleError) {
          res.status(400).json({ error: error.message, status: 400 });
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
        const parsedUpdates = api.tasks.update.input.parse(req.body);
        const currentTask = await storage.getTaskById(id);
        const goalCheck = await checkGoalLink(parsedUpdates, currentTask);
        if (goalCheck.error) {
          return res.status(400).json({ error: goalCheck.error, status: 400 });
        }
        const { predecessorIds, successorIds, ...updates } = goalCheck.write;
        // Check the links first, so a bad set is refused before anything changes.
        const hasLinks = predecessorIds !== undefined || successorIds !== undefined;
        const nextProject = updates.projectId;
        const movesProject = nextProject !== undefined && nextProject !== currentTask?.projectId;
        if (hasLinks) {
          await storage.setTaskDependencies(
            id,
            { predecessorIds, successorIds },
            { projectId: nextProject, dryRun: true },
          );
          // A move would be refused while the old links still span the two
          // projects, so the sides being replaced are released first.
          if (movesProject) {
            await storage.clearTaskDependencySides(id, { predecessorIds, successorIds });
          }
        }
        const unknownOwner = await unknownOwnerMessage(updates.ownerId);
        if (unknownOwner) {
          return res.status(400).json({ error: unknownOwner, status: 400 });
        }
        // A description write re-syncs the task's files: newly referenced
        // rows bind, dropped ones release (and are swept later).
        const prepared =
          typeof updates.description === 'string'
            ? await prepareDescriptionAttachments(storage, updates.description, id)
            : null;
        const updatedTask = await storage.updateTask(
          id,
          prepared ? { ...updates, description: prepared.description } : updates,
        );
        if (!updatedTask) {
          return res.status(404).json({ error: 'Task not found', status: 404 });
        }
        if (hasLinks) {
          await storage.setTaskDependencies(id, { predecessorIds, successorIds });
        }
        if (prepared || updates.description === null) {
          await syncTaskAttachments(storage, id, prepared?.attachmentIds ?? [], { release: true });
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
        } else if (error instanceof DependencyRuleError) {
          res.status(400).json({ error: error.message, status: 400 });
        } else if ((error as { code?: string }).code === '23514') {
          // The goal-link guard (migration 0017), e.g. a goal that still has
          // building-blocks being retyped.
          res.status(400).json({ error: (error as Error).message, status: 400 });
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

  app.get(
    api.tasks.archived.path,
    asyncHandler(async (req: Request, res: Response<Task[] | ApiErrorResponse>) => {
      const query = parseOrThrow(api.tasks.archived.query, req.query);
      const archivedTasks = await storage.getArchivedTasks(projectScopeToFilter(query.projectId));
      res.json(archivedTasks);
    }),
  );

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

  app.post(
    api.tasks.viewed.path,
    async (req: Request<IdParams>, res: Response<Task | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const task = await storage.markTaskViewed(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found', status: 404 });
      }
      res.json(task);
    },
  );

  app.get(api.tasks.deleted.path, async (_req: Request, res: Response<Task[]>) => {
    const deletedTasks = await storage.getDeletedTasks();
    res.json(deletedTasks);
  });

  // Soft delete: the task leaves every board read but the row survives, so
  // Restore is always possible. Only DELETE /api/tasks/:id destroys it.
  app.post(
    api.tasks.bin.path,
    async (req: Request<IdParams>, res: Response<Task | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const task = await storage.binTask(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found', status: 404 });
      }
      res.json(task);
    },
  );

  app.post(
    api.tasks.restore.path,
    async (req: Request<IdParams>, res: Response<Task | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const task = await storage.restoreTask(id);
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

        // A scoped export filters the tasks only; projects are always listed in
        // full so the file still resolves every task's projectId.
        const taskFilter = query.projectId === undefined ? {} : { projectId: query.projectId };
        const [activeTasks, archivedTasks, allStages, allSubStages, allProjects] =
          await Promise.all([
            storage.getTasks(taskFilter),
            query.includeArchived ? storage.getArchivedTasks(taskFilter) : Promise.resolve([]),
            storage.getStages(),
            storage.getSubStages(),
            storage.getProjects(),
          ]);

        const exportedTasks = [...activeTasks, ...archivedTasks];
        // Metadata always; the bytes only on request, so the default bundle
        // stays small for the briefing agent while a backup can be complete.
        const attachmentRows = await storage.getAttachmentsByTasks(
          exportedTasks.map((task) => task.id),
          { withData: query.includeAttachments },
        );
        const attachments: ExportAttachment[] = attachmentRows.map(({ data, ...meta }) => ({
          ...meta,
          url: attachmentUrl(meta.id),
          ...(data ? { data: data.toString('base64') } : {}),
        }));

        const bundle = buildExportBundle({
          tasks: exportedTasks,
          stages: allStages,
          subStages: allSubStages,
          projects: allProjects,
          dependencies: await storage.getTaskDependencies(),
          attachments,
          includeAttachments: query.includeAttachments,
          includeArchived: query.includeArchived,
          projectIds: query.projectId === undefined ? null : [query.projectId],
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

  // Attachments (shared/attachments.ts). An upload is the raw file; its row is
  // unbound until a saved description references its url, and a row no saved
  // description references is swept after a day.
  app.post(
    api.attachments.upload.path,
    express.raw({ type: 'application/octet-stream', limit: ATTACHMENT_MAX_BYTES }),
    asyncHandler(
      async (req: Request, res: Response<UploadedAttachmentResponse | ApiErrorResponse>) => {
        const body: unknown = req.body;
        if (!Buffer.isBuffer(body) || body.length === 0) {
          throw new AppError(400, 'Send the file as the request body (application/octet-stream)');
        }
        const rawName = req.get(ATTACHMENT_NAME_HEADER) ?? '';
        let decodedName = rawName;
        try {
          decodedName = decodeURIComponent(rawName);
        } catch {
          // A name that is not URL-encoded is used as sent.
        }
        const filename = sanitizeAttachmentFilename(decodedName);
        const mimeType = resolveAttachmentType(filename, req.get(ATTACHMENT_TYPE_HEADER) ?? '');
        if (!mimeType) {
          throw new AppError(415, 'Unsupported file type');
        }
        const stored = await storage.createAttachment({
          taskId: null,
          filename,
          mimeType,
          data: body,
        });
        res.status(201).json({ ...stored, url: attachmentUrl(stored.id) });
      },
    ),
  );

  app.get(
    api.attachments.get.path,
    asyncHandler(async (req: Request, res: Response<Buffer | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const file = await storage.getAttachment(id);
      if (!file) {
        throw new AppError(404, 'Attachment not found');
      }
      // Types a browser can't show safely, and SVG (scriptable when opened
      // directly), always download; anything else only when asked to.
      const download = req.query.download === '1' || !attachmentServesInline(file.mimeType);
      res.set({
        'Content-Type': file.mimeType,
        'Content-Length': String(file.byteSize),
        'Content-Disposition': contentDispositionHeader(
          download ? 'attachment' : 'inline',
          file.filename,
        ),
        // A row never changes once written, so its url can be cached for good.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      // Nothing inside an attachment (a crafted SVG or text file) may run
      // script or load anything. Not set for PDFs: browsers' built-in viewers
      // refuse a PDF whose response restricts them.
      if (file.mimeType !== 'application/pdf') {
        res.set('Content-Security-Policy', "default-src 'none'");
      }
      res.send(file.data);
    }),
  );

  // Project endpoints. A project is a body of work, like a client or a job;
  // it scopes the board and never changes the stages.
  app.get(
    api.projects.list.path,
    asyncHandler(async (_req: Request, res: Response<ProjectSummary[]>) => {
      const [projectList, counts] = await Promise.all([
        storage.getProjects(),
        storage.getProjectTaskCounts(),
      ]);
      res.json(projectList.map((project) => ({ ...project, taskCount: counts[project.id] ?? 0 })));
    }),
  );

  app.post(
    api.projects.create.path,
    asyncHandler(
      async (
        req: Request<Record<string, string>, Project | ApiErrorResponse, InsertProject>,
        res: Response<Project | ApiErrorResponse>,
      ) => {
        const projectData = parseOrThrow(api.projects.create.input, req.body);
        await assertProjectNameFree(projectData.name);
        const project = await storage.createProject(projectData);
        res.status(201).json(project);
      },
    ),
  );

  // `asyncHandler` takes the untyped Express request, so the id is read from
  // `req.params` as a plain string and validated by `parseIdParam` as usual.
  app.patch(
    api.projects.update.path,
    asyncHandler(async (req: Request, res: Response<Project | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const updates: Partial<InsertProject> = parseOrThrow(api.projects.update.input, req.body);
      if (updates.name !== undefined) await assertProjectNameFree(updates.name, id);
      const updated = await storage.updateProject(id, updates);
      if (!updated) {
        throw new AppError(404, 'Project not found');
      }
      res.json(updated);
    }),
  );

  app.delete(
    api.projects.delete.path,
    asyncHandler(async (req: Request, res: Response<ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        throw new AppError(404, 'Project not found');
      }
      res.status(204).send();
    }),
  );

  // Owner endpoints (EPIC-06). An owner is a row with a name, colour and short
  // code — a label with an identity, not an account.
  app.get(
    api.owners.list.path,
    asyncHandler(async (_req: Request, res: Response<OwnerSummary[]>) => {
      const [ownerList, counts] = await Promise.all([
        storage.getOwners(),
        storage.getOwnerTaskCounts(),
      ]);
      res.json(ownerList.map((owner) => ({ ...owner, taskCount: counts[owner.id] ?? 0 })));
    }),
  );

  app.post(
    api.owners.create.path,
    asyncHandler(
      async (
        req: Request<Record<string, string>, Owner | ApiErrorResponse, InsertOwner>,
        res: Response<Owner | ApiErrorResponse>,
      ) => {
        const ownerData = parseOrThrow(api.owners.create.input, req.body);
        await assertOwnerNameFree(ownerData.name);
        const owner = await storage.createOwner(ownerData);
        res.status(201).json(owner);
      },
    ),
  );

  app.patch(
    api.owners.update.path,
    asyncHandler(async (req: Request, res: Response<Owner | ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const updates: Partial<InsertOwner> = parseOrThrow(api.owners.update.input, req.body);
      if (updates.name !== undefined) await assertOwnerNameFree(updates.name, id);
      const updated = await storage.updateOwner(id, updates);
      if (!updated) {
        throw new AppError(404, 'Owner not found');
      }
      res.json(updated);
    }),
  );

  app.delete(
    api.owners.delete.path,
    asyncHandler(async (req: Request, res: Response<ApiErrorResponse>) => {
      const id = parseIdParam(req.params.id, res);
      if (id === null) return;
      const deleted = await storage.deleteOwner(id);
      if (!deleted) {
        throw new AppError(404, 'Owner not found');
      }
      res.status(204).send();
    }),
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
        const laneClash = await laneOwnerClashMessage(validated.ownerId, validated.stageId);
        if (laneClash) {
          return res.status(409).json({ error: laneClash, status: 409 });
        }
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
        const laneClash = await laneOwnerClashMessage(validated.ownerId, validated.stageId, id);
        if (laneClash) {
          return res.status(409).json({ error: laneClash, status: 409 });
        }
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
