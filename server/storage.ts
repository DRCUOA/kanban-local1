import { tasks, stages, type Task, type Stage, type InsertTask, type InsertStage } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getTasks(): Promise<Task[]>;
  getTasksByStage(stageId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  getStages(): Promise<Stage[]>;
  createStage(stage: InsertStage): Promise<Stage>;
  updateStage(id: number, stage: Partial<InsertStage>): Promise<Stage | undefined>;
  deleteStage(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(tasks.id);
  }

  async getTasksByStage(stageId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.stageId, stageId));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db
      .update(tasks)
      .set(updates)
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
    const [stage] = await db.insert(stages).values(insertStage).returning();
    return stage;
  }

  async updateStage(id: number, updates: Partial<InsertStage>): Promise<Stage | undefined> {
    const [updated] = await db
      .update(stages)
      .set(updates)
      .where(eq(stages.id, id))
      .returning();
    return updated;
  }

  async deleteStage(id: number): Promise<void> {
    await db.delete(stages).where(eq(stages.id, id));
  }
}

export const storage = new DatabaseStorage();
