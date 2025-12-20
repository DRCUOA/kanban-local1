import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const stages = pgTable("stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  stageId: integer("stage_id").notNull().references(() => stages.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  stage: one(stages, {
    fields: [tasks.stageId],
    references: [stages.id],
  }),
}));

export const stagesRelations = relations(stages, ({ many }) => ({
  tasks: many(tasks),
}));

export const insertStageSchema = createInsertSchema(stages).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type Stage = typeof stages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type InsertStage = z.infer<typeof insertStageSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
