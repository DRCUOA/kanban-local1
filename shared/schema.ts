import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { TASK_STATUS, TASK_PRIORITY, TASK_RECURRENCE, EFFORT_MIN, EFFORT_MAX } from './constants';

export const stages = pgTable('stages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subStages = pgTable('sub_stages', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id')
    .notNull()
    .references(() => stages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tag: text('tag').notNull(), // Unique identifier like "day-plan-am"
  bgClass: text('bg_class').notNull(), // Tailwind class like "bg-background/20"
  opacity: integer('opacity').notNull(), // 0-100 (stored as integer, e.g., 20 for 0.2)
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Task status enum — values sourced from shared/constants.ts
export const taskStatusEnum = z.enum([
  TASK_STATUS.BACKLOG,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.DONE,
  TASK_STATUS.ABANDONED,
]);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

// Task priority enum — values sourced from shared/constants.ts
export const taskPriorityEnum = z.enum([
  TASK_PRIORITY.LOW,
  TASK_PRIORITY.NORMAL,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.CRITICAL,
]);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

// Task recurrence enum — values sourced from shared/constants.ts
export const taskRecurrenceEnum = z.enum([
  TASK_RECURRENCE.NONE,
  TASK_RECURRENCE.DAILY,
  TASK_RECURRENCE.WEEKLY,
  TASK_RECURRENCE.MONTHLY,
]);
export type TaskRecurrence = z.infer<typeof taskRecurrenceEnum>;

// History log entry type
export interface TaskHistoryEntry {
  status: TaskStatus;
  timestamp: string;
  note?: string;
}

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  stageId: integer('stage_id')
    .notNull()
    .references(() => stages.id),
  archived: boolean('archived').notNull().default(false),
  // Enhanced fields
  status: text('status').default(TASK_STATUS.BACKLOG),
  priority: text('priority').default(TASK_PRIORITY.NORMAL),
  effort: integer('effort'), // EFFORT_MIN–EFFORT_MAX
  dueDate: timestamp('due_date'), // Optional due date
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  tags: jsonb('tags').$type<string[]>(),
  parentTaskId: integer('parent_task_id'), // FK to tasks(id) enforced at DB level, not via Drizzle .references() to avoid circular type inference
  recurrence: text('recurrence').default(TASK_RECURRENCE.NONE),
  history: jsonb('history').$type<TaskHistoryEntry[]>(), // Status change history
});

/** Gmail watch cursor: one row per monitored mailbox. */
export const gmailWatchCursor = pgTable('gmail_watch_cursor', {
  mailbox: text('mailbox').primaryKey(),
  historyId: text('history_id').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const INBOUND_PROCESSING_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type InboundProcessingStatus =
  (typeof INBOUND_PROCESSING_STATUS)[keyof typeof INBOUND_PROCESSING_STATUS];

/** Inbound email → task pipeline state (provider + gmail_message_id is unique). */
export const inboundEmailProcessing = pgTable(
  'inbound_email_processing',
  {
    id: serial('id').primaryKey(),
    provider: text('provider').notNull().default('gmail'),
    gmailMessageId: text('gmail_message_id').notNull(),
    rfcMessageId: text('rfc_message_id'),
    historyIdSeen: text('history_id_seen'),
    recipient: text('recipient'),
    normalizedSubject: text('normalized_subject'),
    normalizedBodyHash: text('normalized_body_hash'),
    processingStatus: text('processing_status').notNull(),
    createdTaskId: integer('created_task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    createdTaskIds: jsonb('created_task_ids').$type<number[]>(),
    errorReason: text('error_reason'),
    processedAt: timestamp('processed_at'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    leaseExpiresAt: timestamp('lease_expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [unique('inbound_provider_gmail_msg').on(t.provider, t.gmailMessageId)],
);

export type InboundEmailProcessingRow = typeof inboundEmailProcessing.$inferSelect;
export type GmailWatchCursorRow = typeof gmailWatchCursor.$inferSelect;

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- Drizzle relations API uses internal any types */
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  stage: one(stages, {
    fields: [tasks.stageId],
    references: [stages.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
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

export const insertStageSchema = createInsertSchema(stages)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    color: z
      .string()
      .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .optional()
      .nullable(),
  });

export const insertSubStageSchema = createInsertSchema(subStages)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    opacity: z.number().min(0).max(100), // Store as 0-100 integer
  });

// Explicit overrides for every field — `createInsertSchema(tasks)` infers `any`
// because the `tasks` table self-references via `parentTaskId.references(() => tasks.id)`.
export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    stageId: z.number(),
    archived: z.boolean().optional(),
    status: taskStatusEnum.optional(),
    priority: taskPriorityEnum.optional(),
    effort: z.number().min(EFFORT_MIN).max(EFFORT_MAX).optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    tags: z.array(z.string()).optional().nullable(),
    parentTaskId: z.number().optional().nullable(),
    recurrence: taskRecurrenceEnum.optional(),
    history: z
      .array(
        z.object({
          status: taskStatusEnum,
          timestamp: z.string(),
          note: z.string().optional(),
        }),
      )
      .optional()
      .nullable(),
  });

export type Stage = typeof stages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type SubStage = typeof subStages.$inferSelect;
export type InsertStage = z.infer<typeof insertStageSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertSubStage = z.infer<typeof insertSubStageSchema>;
