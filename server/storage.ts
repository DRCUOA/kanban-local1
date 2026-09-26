/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-non-null-assertion -- Drizzle ORM column/result inference triggers strict rules; types are validated via schema */
import {
  tasks,
  stages,
  subStages,
  projects,
  inboundEmailProcessing,
  type Task,
  type Stage,
  type SubStage,
  type Project,
  type InsertTask,
  type InsertStage,
  type InsertSubStage,
  type InsertProject,
  type TaskHistoryEntry,
  type TaskStatus,
} from '@shared/schema';
import type { TaskProjectFilter } from '@shared/project-scope';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  getStatusFromStageName,
} from '@shared/constants';
import { db } from './db';
import { eq, and, sql, isNull, isNotNull, desc } from 'drizzle-orm';
import { logger } from '@shared/logger';

type TaskInsertExecutor = Pick<typeof db, 'insert' | 'select'>;

async function insertTaskWithExecutor(
  executor: TaskInsertExecutor,
  insertTask: InsertTask,
): Promise<Task> {
  let initialStatus = insertTask.status || TASK_STATUS.BACKLOG;

  if (!insertTask.status && insertTask.stageId) {
    const [stage] = await executor.select().from(stages).where(eq(stages.id, insertTask.stageId));
    if (stage) {
      initialStatus = getStatusFromStageName(stage.name);
    }
  }

  const history: TaskHistoryEntry[] = [
    {
      status: initialStatus,
      timestamp: new Date().toISOString(),
    },
  ];

  const taskData = {
    ...insertTask,
    status: initialStatus,
    priority: insertTask.priority || TASK_PRIORITY.NORMAL,
    recurrence: insertTask.recurrence || TASK_RECURRENCE.NONE,
    history,
    updatedAt: new Date(),
  };

  const [task] = await executor.insert(tasks).values(taskData).returning();
  return task!;
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

export interface IStorage {
  getTasks(filter?: TaskProjectFilter): Promise<Task[]>;
  getArchivedTasks(filter?: TaskProjectFilter): Promise<Task[]>;
  getTasksByStage(stageId: number): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  archiveTask(id: number): Promise<Task | undefined>;
  unarchiveTask(id: number): Promise<Task | undefined>;
  getDeletedTasks(): Promise<Task[]>;
  binTask(id: number): Promise<Task | undefined>;
  restoreTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  getDistinctOwners(): Promise<string[]>;
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
      status: (currentTask.status as TaskStatus) || TASK_STATUS.BACKLOG,
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
      status: (currentTask.status as TaskStatus) || TASK_STATUS.BACKLOG,
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
      status: (currentTask.status as TaskStatus) || TASK_STATUS.BACKLOG,
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

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    // Get current task to check for status changes
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!currentTask) return undefined;

    // Track status changes in history
    const statusChanged = updates.status && updates.status !== currentTask.status;
    let history = currentTask.history || [];

    if (statusChanged && updates.status) {
      const historyEntry: TaskHistoryEntry = {
        status: updates.status,
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
    // Returns each owner string that has been used on at least one task,
    // sorted alphabetically (case-insensitive). Nulls/empties excluded by the WHERE clause.
    const rows = await db
      .selectDistinct({ owner: tasks.owner })
      .from(tasks)
      .where(sql`${tasks.owner} IS NOT NULL AND length(${tasks.owner}) > 0`);
    return rows
      .map((r) => r.owner!)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
