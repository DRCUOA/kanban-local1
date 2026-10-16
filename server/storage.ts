/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-non-null-assertion -- Drizzle ORM column/result inference triggers strict rules; types are validated via schema */
import {
  tasks,
  stages,
  subStages,
  projects,
  owners,
  taskAttachments,
  inboundEmailProcessing,
  type Task,
  type Stage,
  type SubStage,
  type Project,
  type Owner,
  type TaskAttachment,
  type TaskAttachmentRow,
  type InsertAttachment,
  type InsertTask,
  type InsertStage,
  type InsertSubStage,
  type InsertProject,
  type InsertOwner,
  type TaskHistoryEntry,
  type StageKind,
  type TaskDependency,
  taskDependencies,
} from '@shared/schema';
import type { ApplyGoalPlan, ApplyGoalPlanResult } from '@shared/goal-plan';
import {
  applyDependencySet,
  dependencySetError,
  type TaskDependencySet,
} from '@shared/task-dependencies';
import type { TaskProjectFilter } from '@shared/project-scope';
import {
  TASK_PRIORITY,
  TASK_RECURRENCE,
  TASK_TYPE,
  STAGE_KIND,
  DEFAULT_STAGE_KIND,
} from '@shared/constants';
import { stageKind } from '@shared/stage-state';
import { db } from './db';
import {
  eq,
  and,
  or,
  sql,
  isNull,
  isNotNull,
  desc,
  inArray,
  notInArray,
  lt,
  like,
} from 'drizzle-orm';
import { logger } from '@shared/logger';

/** Every attachment column but the bytes: what lists and exports read. */
const attachmentMeta = {
  id: taskAttachments.id,
  taskId: taskAttachments.taskId,
  filename: taskAttachments.filename,
  mimeType: taskAttachments.mimeType,
  byteSize: taskAttachments.byteSize,
  createdAt: taskAttachments.createdAt,
};

type TaskInsertExecutor = Pick<typeof db, 'insert' | 'select'>;

async function insertTaskWithExecutor(
  executor: TaskInsertExecutor,
  insertTask: InsertTask,
): Promise<Task> {
  // The task's state is the kind of the column it is created in — there is no
  // `status` to set alongside it, and no chance of the two disagreeing. Read
  // here only to open the history with the right first line.
  let initialKind: StageKind = DEFAULT_STAGE_KIND;
  if (insertTask.stageId) {
    const [stage] = await executor.select().from(stages).where(eq(stages.id, insertTask.stageId));
    initialKind = stageKind(stage);
  }

  const history: TaskHistoryEntry[] = [
    {
      status: initialKind,
      timestamp: new Date().toISOString(),
    },
  ];

  const taskData = {
    ...insertTask,
    priority: insertTask.priority || TASK_PRIORITY.NORMAL,
    recurrence: insertTask.recurrence || TASK_RECURRENCE.NONE,
    history,
    updatedAt: new Date(),
  };

  const [task] = await executor.insert(tasks).values(taskData).returning();
  return task!;
}

/**
 * The kind of the column a task sits in — the task's state. Used to stamp a
 * history line with where the task actually was at the time.
 */
async function kindOfStage(stageId: number): Promise<StageKind> {
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId));
  return stageKind(stage);
}

/**
 * Live-board task reads honour an optional project filter: `projectId` absent
 * returns every task, `null` only unassigned tasks, a number only that
 * project's. See `projectScopeToFilter` in shared/project-scope.ts.
 */
function projectCondition(filter: TaskProjectFilter | undefined) {
  if (filter?.projectId === undefined) return undefined;
  return filter.projectId === null
    ? isNull(tasks.projectId)
    : eq(tasks.projectId, filter.projectId);
}

/** A dependency write that breaks a rule the user can fix; the route answers 400. */
export class DependencyRuleError extends Error {}

export interface IStorage {
  getTasks(filter?: TaskProjectFilter): Promise<Task[]>;
  getArchivedTasks(filter?: TaskProjectFilter): Promise<Task[]>;
  getTasksByStage(stageId: number): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  getTaskDependencies(): Promise<TaskDependency[]>;
  /** Replaces the given side(s) of a task's dependency edges; rejects with Error(message) on a rule break. */
  /** Saves an edited AI goal plan in one transaction: optional goal text, new blocks, their dependencies. */
  applyGoalPlan(goalId: number, plan: ApplyGoalPlan): Promise<ApplyGoalPlanResult>;
  setTaskDependencies(
    taskId: number,
    set: TaskDependencySet,
    opts?: { projectId?: number | null; dryRun?: boolean },
  ): Promise<void>;
  /** Deletes the given side(s) of a task's edges, ahead of a project move that would orphan them. */
  clearTaskDependencySides(taskId: number, set: TaskDependencySet): Promise<void>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  /** Applies each task's change in one transaction: all of them, or none (a rule break rolls back). */
  bulkUpdateTasks(changes: { id: number; updates: Partial<InsertTask> }[]): Promise<number>;
  archiveTask(id: number): Promise<Task | undefined>;
  unarchiveTask(id: number): Promise<Task | undefined>;
  getDeletedTasks(): Promise<Task[]>;
  binTask(id: number): Promise<Task | undefined>;
  restoreTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  /** Owner names, for the legacy `GET /api/tasks/owners` contract. */
  getDistinctOwners(): Promise<string[]>;
  /** Every owner, active ones first, then by order and name. */
  getOwners(): Promise<Owner[]>;
  getOwnerById(id: number): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(id: number, owner: Partial<InsertOwner>): Promise<Owner | undefined>;
  /** Releases the owner's tasks and unbinds their lanes. False when no such owner. */
  deleteOwner(id: number): Promise<boolean>;
  /** Live (unarchived, unbinned) task count per owner id; owners with none are absent. */
  getOwnerTaskCounts(): Promise<Record<number, number>>;
  getStages(): Promise<Stage[]>;
  createStage(stage: InsertStage): Promise<Stage>;
  updateStage(id: number, stage: Partial<InsertStage>): Promise<Stage | undefined>;
  deleteStage(id: number): Promise<void>;
  getSubStages(): Promise<SubStage[]>;
  getSubStagesByStage(stageId: number): Promise<SubStage[]>;
  createSubStage(subStage: InsertSubStage): Promise<SubStage>;
  updateSubStage(id: number, subStage: Partial<InsertSubStage>): Promise<SubStage | undefined>;
  deleteSubStage(id: number): Promise<void>;
  /** Every project, active ones first, then by order and name. */
  getProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  /** Releases the project's tasks (projectId → null). False when no such project. */
  deleteProject(id: number): Promise<boolean>;
  /** Live (unarchived, unbinned) task count per project id; projects with none are absent. */
  getProjectTaskCounts(): Promise<Record<number, number>>;
  // Attachments (shared/attachments.ts): the bytes live in task_attachments and
  // a description references a row by url. Metadata reads never load the bytes.
  /** Stores an upload. `taskId` null = no saved description references it yet. */
  createAttachment(attachment: InsertAttachment): Promise<TaskAttachment>;
  /** One attachment with its bytes, for serving. */
  getAttachment(id: number): Promise<TaskAttachmentRow | undefined>;
  /** Metadata for the given ids; unknown ids are simply absent. */
  getAttachmentsMeta(ids: number[]): Promise<TaskAttachment[]>;
  /** The given tasks' attachments, oldest first, with their bytes when `withData`. */
  getAttachmentsByTasks(
    taskIds: number[],
    options?: { withData?: boolean },
  ): Promise<(TaskAttachment & { data?: Buffer })[]>;
  /** Binds the attachments to the task. Rows bound to another task are left alone. Returns the ids bound. */
  bindAttachments(taskId: number, ids: number[]): Promise<number[]>;
  /** Duplicates an attachment as a new unbound row (a description copied between tasks). */
  copyAttachment(id: number): Promise<TaskAttachment | undefined>;
  /** Unbinds the task's attachments other than `keepIds`; the sweeper deletes them later. */
  releaseAttachments(taskId: number, keepIds: number[]): Promise<void>;
  /** Deletes unbound attachments created before `olderThan`. Returns how many. */
  deleteOrphanAttachments(olderThan: Date): Promise<number>;
  /** Tasks whose description still carries a file inline as a data: URL. */
  getTaskIdsWithInlineAttachments(): Promise<number[]>;
  /** Rewrites a description without touching updatedAt or history (data migration only). */
  setTaskDescription(id: number, description: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTasks(filter?: TaskProjectFilter): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.archived, false), isNull(tasks.deletedAt), projectCondition(filter)))
      .orderBy(tasks.id);
  }

  async getArchivedTasks(filter?: TaskProjectFilter): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.archived, true), isNull(tasks.deletedAt), projectCondition(filter)))
      .orderBy(tasks.id);
  }

  async getTasksByStage(stageId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.stageId, stageId), eq(tasks.archived, false), isNull(tasks.deletedAt)));
  }

  async getTaskDependencies(): Promise<TaskDependency[]> {
    return await db.select().from(taskDependencies);
  }

  async applyGoalPlan(goalId: number, plan: ApplyGoalPlan): Promise<ApplyGoalPlanResult> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(18)`);
      const [goal] = await tx.select().from(tasks).where(eq(tasks.id, goalId));
      if (!goal || goal.deletedAt) throw new DependencyRuleError('Task not found');
      if (goal.type !== TASK_TYPE.GOAL) {
        throw new DependencyRuleError('Set the task type to Goal and save before planning it');
      }
      if (plan.goal) {
        await tx
          .update(tasks)
          .set({
            title: plan.goal.title,
            description: plan.goal.description,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, goalId));
      }

      // New blocks start in the first backlog column, beside nothing else.
      const allStages = await tx.select().from(stages).orderBy(stages.order);
      const backlog = allStages.find((st) => stageKind(st) === STAGE_KIND.BACKLOG);
      const stageId = backlog?.id ?? goal.stageId;

      const keys = new Set(plan.subtasks.map((st) => st.key));
      if (keys.size !== plan.subtasks.length)
        throw new DependencyRuleError('Duplicate sub-task keys');
      const existingBlocks = new Set(
        (
          await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(and(eq(tasks.goalTaskId, goalId), isNull(tasks.deletedAt)))
        ).map((r) => r.id),
      );

      const created: Record<string, number> = {};
      for (const sub of plan.subtasks) {
        const task = await insertTaskWithExecutor(tx, {
          title: sub.title,
          description: sub.description || null,
          stageId,
          projectId: goal.projectId,
          ownerId: goal.ownerId,
          type: TASK_TYPE.BUILDING_BLOCK,
          goalTaskId: goalId,
          effort: sub.effort,
        });
        created[sub.key] = task.id;
      }

      const edges: { predecessorId: number; successorId: number }[] = [];
      for (const sub of plan.subtasks) {
        const successorId = created[sub.key];
        if (successorId === undefined) continue;
        for (const dep of new Set(sub.dependsOn)) {
          let predecessorId: number | undefined;
          if (dep.startsWith('#')) {
            predecessorId = Number(dep.slice(1));
            if (!existingBlocks.has(predecessorId)) {
              throw new DependencyRuleError(`${dep} is not a building-block of this goal`);
            }
          } else {
            predecessorId = created[dep];
            if (predecessorId === undefined) {
              throw new DependencyRuleError(
                `"${sub.title}" waits for a sub-task that is not being saved`,
              );
            }
          }
          edges.push({ predecessorId, successorId });
        }
      }
      // One row at a time so the acyclic and same-project triggers see each edge.
      for (const edge of edges) {
        await tx.insert(taskDependencies).values(edge).onConflictDoNothing();
      }
      return { created };
    });
  }

  async clearTaskDependencySides(taskId: number, set: TaskDependencySet): Promise<void> {
    if (set.predecessorIds) {
      await db.delete(taskDependencies).where(eq(taskDependencies.successorId, taskId));
    }
    if (set.successorIds) {
      await db.delete(taskDependencies).where(eq(taskDependencies.predecessorId, taskId));
    }
  }

  async setTaskDependencies(
    taskId: number,
    set: TaskDependencySet,
    opts: { projectId?: number | null; dryRun?: boolean } = {},
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Serialise writers so two requests cannot each add half of a loop.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(18)`);
      const edges = await tx.select().from(taskDependencies);
      const projectOf = new Map(
        (await tx.select({ id: tasks.id, projectId: tasks.projectId }).from(tasks)).map((t) => [
          t.id,
          t.projectId,
        ]),
      );
      // The task's project after the write, which a PATCH may be changing.
      const taskProject =
        opts.projectId !== undefined ? opts.projectId : (projectOf.get(taskId) ?? null);
      const error = dependencySetError(edges, taskId, set, projectOf, taskProject);
      if (error) throw new DependencyRuleError(error);
      if (opts.dryRun) return;
      if (set.predecessorIds) {
        await tx.delete(taskDependencies).where(eq(taskDependencies.successorId, taskId));
      }
      if (set.successorIds) {
        await tx.delete(taskDependencies).where(eq(taskDependencies.predecessorId, taskId));
      }
      const next = applyDependencySet(edges, taskId, set).filter(
        (e) => e.predecessorId === taskId || e.successorId === taskId,
      );
      if (next.length > 0) {
        await tx.insert(taskDependencies).values(next).onConflictDoNothing();
      }
    });
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async archiveTask(id: number): Promise<Task | undefined> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!currentTask) return undefined;

    // Add archive entry to history
    const history = currentTask.history || [];
    const historyEntry: TaskHistoryEntry = {
      status: await kindOfStage(currentTask.stageId),
      timestamp: new Date().toISOString(),
      note: 'Archived',
    };

    const [archived] = await db
      .update(tasks)
      .set({
        archived: true,
        updatedAt: new Date(),
        history: [...history, historyEntry],
      })
      .where(eq(tasks.id, id))
      .returning();
    return archived;
  }

  async unarchiveTask(id: number): Promise<Task | undefined> {
    const [unarchived] = await db
      .update(tasks)
      .set({
        archived: false,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();
    return unarchived;
  }

  /** Bin contents, most recently binned first — the order the Bin page reads in. */
  async getDeletedTasks(): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(isNotNull(tasks.deletedAt))
      .orderBy(desc(tasks.deletedAt));
  }

  async binTask(id: number): Promise<Task | undefined> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!currentTask) return undefined;

    const history = currentTask.history || [];
    const historyEntry: TaskHistoryEntry = {
      status: await kindOfStage(currentTask.stageId),
      timestamp: new Date().toISOString(),
      note: 'Moved to Bin',
    };

    const [binned] = await db
      .update(tasks)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        history: [...history, historyEntry],
      })
      .where(eq(tasks.id, id))
      .returning();
    return binned;
  }

  async restoreTask(id: number): Promise<Task | undefined> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!currentTask) return undefined;

    const history = currentTask.history || [];
    const historyEntry: TaskHistoryEntry = {
      status: await kindOfStage(currentTask.stageId),
      timestamp: new Date().toISOString(),
      note: 'Restored from Bin',
    };

    const [restored] = await db
      .update(tasks)
      .set({
        deletedAt: null,
        updatedAt: new Date(),
        history: [...history, historyEntry],
      })
      .where(eq(tasks.id, id))
      .returning();
    return restored;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    return insertTaskWithExecutor(db, insertTask);
  }

  async bulkUpdateTasks(changes: { id: number; updates: Partial<InsertTask> }[]): Promise<number> {
    const stageKinds = new Map(
      (await db.select().from(stages)).map((st) => [st.id, stageKind(st)]),
    );
    return db.transaction(async (tx) => {
      let count = 0;
      for (const { id, updates } of changes) {
        const [current] = await tx.select().from(tasks).where(eq(tasks.id, id));
        if (!current || current.deletedAt) continue;
        let history = current.history ?? [];
        // The same history line a single move writes.
        if (updates.stageId !== undefined && updates.stageId !== current.stageId) {
          history = [
            ...history,
            {
              status: stageKinds.get(updates.stageId) ?? DEFAULT_STAGE_KIND,
              timestamp: new Date().toISOString(),
            },
          ];
        }
        await tx
          .update(tasks)
          .set({
            ...updates,
            updatedAt: new Date(),
            history: history.length > 0 ? history : undefined,
          })
          .where(eq(tasks.id, id));
        count += 1;
      }
      return count;
    });
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!currentTask) return undefined;

    // A move to another column is the state change worth recording. This used
    // to watch `updates.status`, which meant a drag that changed the column
    // logged a line only because the client remembered to send a status with
    // it — and logged nothing when it did not.
    const movedStage = updates.stageId !== undefined && updates.stageId !== currentTask.stageId;
    let history = currentTask.history || [];

    if (movedStage && updates.stageId !== undefined) {
      const historyEntry: TaskHistoryEntry = {
        status: await kindOfStage(updates.stageId),
        timestamp: new Date().toISOString(),
      };
      history = [...history, historyEntry];
    }

    // Always update updatedAt
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      history: history.length > 0 ? history : undefined,
    };

    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async getDistinctOwners(): Promise<string[]> {
    // Owner names now come from the owners table, not from a DISTINCT over
    // whatever has been typed on a task (EPIC-06). Archived owners are
    // included: the field this endpoint feeds can still be holding one.
    const rows = await this.getOwners();
    return rows.map((owner) => owner.name);
  }

  async getOwners(): Promise<Owner[]> {
    return await db
      .select()
      .from(owners)
      .orderBy(owners.archived, owners.order, sql`lower(${owners.name})`);
  }

  async getOwnerById(id: number): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.id, id));
    return owner;
  }

  async createOwner(insertOwner: InsertOwner): Promise<Owner> {
    const [owner] = await db
      .insert(owners)
      .values({
        name: insertOwner.name,
        key: insertOwner.key ?? null,
        color: insertOwner.color ?? null,
        archived: insertOwner.archived ?? false,
        order: insertOwner.order ?? 0,
      })
      .returning();
    return owner!;
  }

  async updateOwner(id: number, updates: Partial<InsertOwner>): Promise<Owner | undefined> {
    // Only the keys the caller sent; Drizzle refuses an empty SET, so a no-op
    // patch just reads the row back. A name change propagates to the mirrored
    // `tasks.owner` through the database trigger, not through a write per task.
    const values: Partial<typeof owners.$inferInsert> = {};
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.key !== undefined) values.key = updates.key;
    if (updates.color !== undefined) values.color = updates.color;
    if (updates.archived !== undefined) values.archived = updates.archived;
    if (updates.order !== undefined) values.order = updates.order;
    if (Object.keys(values).length === 0) return this.getOwnerById(id);

    const [updated] = await db.update(owners).set(values).where(eq(owners.id, id)).returning();
    return updated;
  }

  async deleteOwner(id: number): Promise<boolean> {
    // Both FKs are ON DELETE SET NULL too; doing it here keeps the contract
    // true whatever a given database's constraints say, and routes the task
    // update through the mirror trigger so `tasks.owner` clears with it.
    await db.update(tasks).set({ ownerId: null }).where(eq(tasks.ownerId, id));
    await db.update(subStages).set({ ownerId: null }).where(eq(subStages.ownerId, id));
    const deleted = await db.delete(owners).where(eq(owners.id, id)).returning({ id: owners.id });
    return deleted.length > 0;
  }

  async getOwnerTaskCounts(): Promise<Record<number, number>> {
    const rows = await db
      .select({ ownerId: tasks.ownerId, count: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(and(isNotNull(tasks.ownerId), eq(tasks.archived, false), isNull(tasks.deletedAt)))
      .groupBy(tasks.ownerId);

    const counts: Record<number, number> = {};
    for (const row of rows) {
      if (row.ownerId != null) counts[row.ownerId] = row.count;
    }
    return counts;
  }

  async deleteTask(id: number): Promise<void> {
    await db
      .update(inboundEmailProcessing)
      .set({ createdTaskId: null })
      .where(eq(inboundEmailProcessing.createdTaskId, id));

    await db.execute(sql`
      UPDATE inbound_email_processing
      SET created_task_ids = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(created_task_ids) AS elem
        WHERE elem::int != ${id}
      ),
      updated_at = NOW()
      WHERE created_task_ids @> ${JSON.stringify([id])}::jsonb
    `);

    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getStages(): Promise<Stage[]> {
    return await db.select().from(stages).orderBy(stages.order);
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    logger.debug('[DAO] [CREATE_STAGE] createStage called with data:', JSON.stringify(insertStage));
    logger.debug('[DAO] [CREATE_STAGE] Color value:', insertStage.color);
    logger.debug('[DAO] [CREATE_STAGE] Color type:', typeof insertStage.color);

    const stageData = {
      name: insertStage.name,
      order: insertStage.order,
      color: insertStage.color || null,
    };

    logger.debug('[DAO] [CREATE_STAGE] Stage data to insert:', JSON.stringify(stageData));
    logger.debug('[DAO] [CREATE_STAGE] Preparing database insert');
    const [stage] = await db.insert(stages).values(stageData).returning();

    logger.debug('[DAO] [CREATE_STAGE] Database insert successful');
    logger.debug('[DAO] [CREATE_STAGE] Created stage:', JSON.stringify(stage));
    logger.debug('[DAO] [CREATE_STAGE] Created stage color:', stage?.color);

    return stage!;
  }

  async updateStage(id: number, updates: Partial<InsertStage>): Promise<Stage | undefined> {
    logger.debug(
      '[DAO] [UPDATE_STAGE] updateStage called with id:',
      id,
      'updates:',
      JSON.stringify(updates),
    );
    logger.debug('[DAO] [UPDATE_STAGE] Color in updates:', updates.color);
    logger.debug('[DAO] [UPDATE_STAGE] Color type:', typeof updates.color);

    const updateData: Partial<InsertStage> = { ...updates };
    if ('color' in updates) {
      updateData.color = updates.color ?? null;
    }

    logger.debug('[DAO] [UPDATE_STAGE] Update data to apply:', JSON.stringify(updateData));
    logger.debug('[DAO] [UPDATE_STAGE] Preparing database update');
    const [updated] = await db.update(stages).set(updateData).where(eq(stages.id, id)).returning();

    if (updated) {
      logger.debug('[DAO] [UPDATE_STAGE] Database update successful');
      logger.debug('[DAO] [UPDATE_STAGE] Updated stage:', JSON.stringify(updated));
      logger.debug('[DAO] [UPDATE_STAGE] Updated stage color:', updated.color);
    } else {
      logger.debug('[DAO] [UPDATE_STAGE] No stage found with id:', id);
    }

    return updated;
  }

  async deleteStage(id: number): Promise<void> {
    logger.debug('[DAO] [DELETE_STAGE] deleteStage called with id:', id);

    logger.debug('[DAO] [DELETE_STAGE] Preparing database delete');
    await db.delete(stages).where(eq(stages.id, id));

    logger.debug('[DAO] [DELETE_STAGE] Database delete completed');
  }

  async getSubStages(): Promise<SubStage[]> {
    return await db.select().from(subStages).orderBy(subStages.order);
  }

  async getSubStagesByStage(stageId: number): Promise<SubStage[]> {
    return await db
      .select()
      .from(subStages)
      .where(eq(subStages.stageId, stageId))
      .orderBy(subStages.order);
  }

  async createSubStage(insertSubStage: InsertSubStage): Promise<SubStage> {
    const [subStage] = await db.insert(subStages).values(insertSubStage).returning();
    return subStage!;
  }

  async updateSubStage(
    id: number,
    updates: Partial<InsertSubStage>,
  ): Promise<SubStage | undefined> {
    const [updated] = await db
      .update(subStages)
      .set(updates)
      .where(eq(subStages.id, id))
      .returning();
    return updated;
  }

  async deleteSubStage(id: number): Promise<void> {
    await db.delete(subStages).where(eq(subStages.id, id));
  }

  async getProjects(): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .orderBy(projects.archived, projects.order, sql`lower(${projects.name})`);
  }

  async getProjectById(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({
        name: insertProject.name,
        key: insertProject.key ?? null,
        color: insertProject.color ?? null,
        archived: insertProject.archived ?? false,
        order: insertProject.order ?? 0,
      })
      .returning();
    return project!;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    // Only the keys the caller sent; Drizzle refuses an empty SET, so a no-op
    // patch just reads the row back.
    const values: Partial<typeof projects.$inferInsert> = {};
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.key !== undefined) values.key = updates.key;
    if (updates.color !== undefined) values.color = updates.color;
    if (updates.archived !== undefined) values.archived = updates.archived;
    if (updates.order !== undefined) values.order = updates.order;
    if (Object.keys(values).length === 0) return this.getProjectById(id);

    const [updated] = await db.update(projects).set(values).where(eq(projects.id, id)).returning();
    return updated;
  }

  async deleteProject(id: number): Promise<boolean> {
    // The FK is ON DELETE SET NULL too; doing it here keeps the contract true
    // whatever a given database's constraint says.
    await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id));
    const deleted = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    return deleted.length > 0;
  }

  async getProjectTaskCounts(): Promise<Record<number, number>> {
    const rows = await db
      .select({ projectId: tasks.projectId, count: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(and(isNotNull(tasks.projectId), eq(tasks.archived, false), isNull(tasks.deletedAt)))
      .groupBy(tasks.projectId);

    const counts: Record<number, number> = {};
    for (const row of rows) {
      if (row.projectId != null) counts[row.projectId] = row.count;
    }
    return counts;
  }

  async createAttachment(attachment: InsertAttachment): Promise<TaskAttachment> {
    const [row] = await db
      .insert(taskAttachments)
      .values({
        taskId: attachment.taskId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        byteSize: attachment.data.length,
        data: attachment.data,
      })
      .returning(attachmentMeta);
    return row!;
  }

  async getAttachment(id: number): Promise<TaskAttachmentRow | undefined> {
    const [row] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id));
    return row;
  }

  async getAttachmentsMeta(ids: number[]): Promise<TaskAttachment[]> {
    if (ids.length === 0) return [];
    return await db
      .select(attachmentMeta)
      .from(taskAttachments)
      .where(inArray(taskAttachments.id, ids));
  }

  async getAttachmentsByTasks(
    taskIds: number[],
    { withData = false }: { withData?: boolean } = {},
  ): Promise<(TaskAttachment & { data?: Buffer })[]> {
    if (taskIds.length === 0) return [];
    const ofTasks = inArray(taskAttachments.taskId, taskIds);
    if (withData) {
      return await db
        .select({ ...attachmentMeta, data: taskAttachments.data })
        .from(taskAttachments)
        .where(ofTasks)
        .orderBy(taskAttachments.id);
    }
    return await db
      .select(attachmentMeta)
      .from(taskAttachments)
      .where(ofTasks)
      .orderBy(taskAttachments.id);
  }

  async bindAttachments(taskId: number, ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const bound = await db
      .update(taskAttachments)
      .set({ taskId })
      .where(
        and(
          inArray(taskAttachments.id, ids),
          or(isNull(taskAttachments.taskId), eq(taskAttachments.taskId, taskId)),
        ),
      )
      .returning({ id: taskAttachments.id });
    return bound.map((row) => row.id);
  }

  async copyAttachment(id: number): Promise<TaskAttachment | undefined> {
    // Copied inside the database so the bytes never round-trip through Node.
    const result = await db.execute(sql`
      INSERT INTO task_attachments (task_id, filename, mime_type, byte_size, data)
      SELECT NULL, filename, mime_type, byte_size, data
      FROM task_attachments
      WHERE id = ${id}
      RETURNING id, filename, mime_type, byte_size, created_at
    `);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      id: Number(row.id),
      taskId: null,
      filename: String(row.filename),
      mimeType: String(row.mime_type),
      byteSize: Number(row.byte_size),
      createdAt: new Date(row.created_at as string | Date),
    };
  }

  async releaseAttachments(taskId: number, keepIds: number[]): Promise<void> {
    const ofTask = eq(taskAttachments.taskId, taskId);
    await db
      .update(taskAttachments)
      .set({ taskId: null })
      .where(keepIds.length === 0 ? ofTask : and(ofTask, notInArray(taskAttachments.id, keepIds)));
  }

  async deleteOrphanAttachments(olderThan: Date): Promise<number> {
    const deleted = await db
      .delete(taskAttachments)
      .where(and(isNull(taskAttachments.taskId), lt(taskAttachments.createdAt, olderThan)))
      .returning({ id: taskAttachments.id });
    return deleted.length;
  }

  async getTaskIdsWithInlineAttachments(): Promise<number[]> {
    // A coarse match; prepareDescriptionAttachments re-checks each chip.
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(like(tasks.description, '%data-file-chip%'), like(tasks.description, '%data:%')))
      .orderBy(tasks.id);
    return rows.map((row) => row.id);
  }

  async setTaskDescription(id: number, description: string): Promise<void> {
    await db.update(tasks).set({ description }).where(eq(tasks.id, id));
  }
}

export async function createEmailTasks(params: {
  parent: InsertTask;
  children: InsertTask[];
}): Promise<{ parent: Task; children: Task[] }> {
  return db.transaction(async (tx) => {
    const parent = await insertTaskWithExecutor(tx, params.parent);
    const children: Task[] = [];

    for (const child of params.children) {
      children.push(
        await insertTaskWithExecutor(tx, {
          ...child,
          parentTaskId: parent.id,
        }),
      );
    }

    return { parent, children };
  });
}

export const storage = new DatabaseStorage();
