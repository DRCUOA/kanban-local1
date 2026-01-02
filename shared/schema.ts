import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const stages = pgTable("stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subStages = pgTable("sub_stages", {
  id: serial("id").primaryKey(),
  stageId: integer("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tag: text("tag").notNull(), // Unique identifier like "day-plan-am"
  bgClass: text("bg_class").notNull(), // Tailwind class like "bg-background/20"
  opacity: integer("opacity").notNull(), // 0-100 (stored as integer, e.g., 20 for 0.2)
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Task status enum
export const taskStatusEnum = z.enum(["backlog", "in_progress", "done", "abandoned"]);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

// Task priority enum
export const taskPriorityEnum = z.enum(["low", "normal", "high", "critical"]);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

// Task recurrence enum
export const taskRecurrenceEnum = z.enum(["none", "daily", "weekly", "monthly"]);
export type TaskRecurrence = z.infer<typeof taskRecurrenceEnum>;

// History log entry type
export type TaskHistoryEntry = {
  status: TaskStatus;
  timestamp: string;
  note?: string;
};

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  stageId: integer("stage_id").notNull().references(() => stages.id),
  archived: boolean("archived").notNull().default(false),
  // Enhanced fields
  status: text("status").default("backlog"), // backlog | in_progress | done | abandoned
  priority: text("priority").default("normal"), // low | normal | high | critical
  effort: integer("effort"), // 1-5
  dueDate: timestamp("due_date"), // Optional due date
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  tags: jsonb("tags").$type<string[]>(), // Array of strings
  parentTaskId: integer("parent_task_id").references(() => tasks.id), // Self-reference for sub-tasks
  recurrence: text("recurrence").default("none"), // none | daily | weekly | monthly
  history: jsonb("history").$type<TaskHistoryEntry[]>(), // Status change history
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  stage: one(stages, {
    fields: [tasks.stageId],
    references: [stages.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, {
    relationName: "subtasks",
  }),
}));

export const stagesRelations = relations(stages, ({ many }) => ({
  tasks: many(tasks),
  subStages: many(subStages),
}));

export const subStagesRelations = relations(subStages, ({ one }) => ({
  stage: one(stages, {
    fields: [subStages.stageId],
    references: [stages.id],
  }),
}));

export const insertStageSchema = createInsertSchema(stages).omit({
  id: true,
  createdAt: true,
}).extend({
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional().nullable(),
});

export const insertSubStageSchema = createInsertSchema(subStages).omit({
  id: true,
  createdAt: true,
}).extend({
  opacity: z.number().min(0).max(100), // Store as 0-100 integer
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  effort: z.number().min(1).max(5).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  parentTaskId: z.number().optional().nullable(),
  recurrence: taskRecurrenceEnum.optional(),
  history: z.array(z.object({
    status: taskStatusEnum,
    timestamp: z.string(),
    note: z.string().optional(),
  })).optional().nullable(),
});

export type Stage = typeof stages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type SubStage = typeof subStages.$inferSelect;
export type InsertStage = z.infer<typeof insertStageSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertSubStage = z.infer<typeof insertSubStageSchema>;