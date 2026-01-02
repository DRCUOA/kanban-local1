import { tasks, stages, subStages, type Task, type Stage, type SubStage, type InsertTask, type InsertStage, type InsertSubStage, type TaskHistoryEntry, type TaskStatus } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getTasks(): Promise<Task[]>;
  getArchivedTasks(): Promise<Task[]>;
  getTasksByStage(stageId: number): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  archiveTask(id: number): Promise<Task | undefined>;
  unarchiveTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  getStages(): Promise<Stage[]>;
  createStage(stage: InsertStage): Promise<Stage>;
  updateStage(id: number, stage: Partial<InsertStage>): Promise<Stage | undefined>;
  deleteStage(id: number): Promise<void>;
  getSubStages(): Promise<SubStage[]>;
  getSubStagesByStage(stageId: number): Promise<SubStage[]>;
  createSubStage(subStage: InsertSubStage): Promise<SubStage>;
  updateSubStage(id: number, subStage: Partial<InsertSubStage>): Promise<SubStage | undefined>;
  deleteSubStage(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.archived, false)).orderBy(tasks.id);
  }

  async getArchivedTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.archived, true)).orderBy(tasks.id);
  }

  async getTasksByStage(stageId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(and(eq(tasks.stageId, stageId), eq(tasks.archived, false)));
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
      status: currentTask.status as TaskStatus || "backlog",
      timestamp: new Date().toISOString(),
      note: "Archived",
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

  async createTask(insertTask: InsertTask): Promise<Task> {
    // Initialize history with initial status
    // If status not provided, infer from stage name
    let initialStatus = insertTask.status || "backlog";
    
    // If no status provided, try to infer from stage
    if (!insertTask.status && insertTask.stageId) {
      const [stage] = await db.select().from(stages).where(eq(stages.id, insertTask.stageId));
      if (stage) {
        const name = stage.name.toLowerCase();
        if (name.includes("progress") || name.includes("doing") || name.includes("active")) {
          initialStatus = "in_progress";
        } else if (name.includes("done") || name.includes("complete") || name.includes("finished")) {
          initialStatus = "done";
        } else if (name.includes("abandon") || name.includes("cancel")) {
          initialStatus = "abandoned";
        }
      }
    }
    
    const history: TaskHistoryEntry[] = [{
      status: initialStatus as TaskStatus,
      timestamp: new Date().toISOString(),
    }];

    const taskData = {
      ...insertTask,
      status: initialStatus,
      priority: insertTask.priority || "normal",
      recurrence: insertTask.recurrence || "none",
      history,
      updatedAt: new Date(),
    };

    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
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
        status: updates.status as TaskStatus,
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

    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getStages(): Promise<Stage[]> {
    return await db.select().from(stages).orderBy(stages.order);
  }

  async createStage(insertStage: InsertStage): Promise<Stage> {
    console.log('[DAO] [CREATE_STAGE] createStage called with data:', JSON.stringify(insertStage));
    console.log('[DAO] [CREATE_STAGE] Color value:', insertStage.color);
    console.log('[DAO] [CREATE_STAGE] Color type:', typeof insertStage.color);
    
    // Ensure color is included even if undefined (Drizzle will handle null)
    const stageData = {
      name: insertStage.name,
      order: insertStage.order,
      color: insertStage.color || null,
    };
    
    console.log('[DAO] [CREATE_STAGE] Stage data to insert:', JSON.stringify(stageData));
    console.log('[DAO] [CREATE_STAGE] Preparing database insert');
    const [stage] = await db.insert(stages).values(stageData).returning();
    
    console.log('[DAO] [CREATE_STAGE] Database insert successful');
    console.log('[DAO] [CREATE_STAGE] Created stage:', JSON.stringify(stage));
    console.log('[DAO] [CREATE_STAGE] Created stage color:', stage.color);
    
    return stage;
  }

  async updateStage(id: number, updates: Partial<InsertStage>): Promise<Stage | undefined> {
    console.log('[DAO] [UPDATE_STAGE] updateStage called with id:', id, 'updates:', JSON.stringify(updates));
    console.log('[DAO] [UPDATE_STAGE] Color in updates:', updates.color);
    console.log('[DAO] [UPDATE_STAGE] Color type:', typeof updates.color);
    
    // Ensure color is explicitly set (even if null) if it's in the updates
    const updateData: any = { ...updates };
    if ('color' in updates) {
      updateData.color = updates.color || null;
    }
    
    console.log('[DAO] [UPDATE_STAGE] Update data to apply:', JSON.stringify(updateData));
    console.log('[DAO] [UPDATE_STAGE] Preparing database update');
    const [updated] = await db
      .update(stages)
      .set(updateData)
      .where(eq(stages.id, id))
      .returning();
    
    if (updated) {
      console.log('[DAO] [UPDATE_STAGE] Database update successful');
      console.log('[DAO] [UPDATE_STAGE] Updated stage:', JSON.stringify(updated));
      console.log('[DAO] [UPDATE_STAGE] Updated stage color:', updated.color);
    } else {
      console.log('[DAO] [UPDATE_STAGE] No stage found with id:', id);
    }
    
    return updated;
  }

  async deleteStage(id: number): Promise<void> {
    console.log('[DAO] [DELETE_STAGE] deleteStage called with id:', id);
    
    console.log('[DAO] [DELETE_STAGE] Preparing database delete');
    await db.delete(stages).where(eq(stages.id, id));
    
    console.log('[DAO] [DELETE_STAGE] Database delete completed');
  }

  async getSubStages(): Promise<SubStage[]> {
    return await db.select().from(subStages).orderBy(subStages.order);
  }

  async getSubStagesByStage(stageId: number): Promise<SubStage[]> {
    return await db.select().from(subStages).where(eq(subStages.stageId, stageId)).orderBy(subStages.order);
  }

  async createSubStage(insertSubStage: InsertSubStage): Promise<SubStage> {
    const [subStage] = await db.insert(subStages).values(insertSubStage).returning();
    return subStage;
  }

  async updateSubStage(id: number, updates: Partial<InsertSubStage>): Promise<SubStage | undefined> {
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
}

export const storage = new DatabaseStorage();
