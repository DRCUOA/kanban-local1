import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
  customType,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  EFFORT_MIN,
  EFFORT_MAX,
  TASK_OWNER_MAX_LEN,
  PROJECT_NAME_MAX_LEN,
  PROJECT_KEY_MAX_LEN,
} from './constants';

export const stages = pgTable('stages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * A project is a set of tasks related to a common goal. Projects scope which
 * tasks the board shows; stages and sub-stages stay global (filter, don't fork —
 * see docs/epics/EPIC-01-project-layer.md). A task with no project is
 * "unassigned" and shows under the "All projects" and "No project" scopes.
 */
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // Optional short code (e.g. "ALPHA") for chips where the name would not fit.
  key: text('key'),
  color: text('color'),
  // Archived projects keep their tasks but leave the pickers.
  archived: boolean('archived').notNull().default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subStages = pgTable('sub_stages', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id')
    .notNull()
    .references(() => stages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tag: text('tag').notNull(), // Unique identifier like "day-plan-am"
  // Legacy: once a Tailwind class for the lane tint. The board no longer reads
  // it (the lane's look is `opacity`); new rows leave it blank. Drop in a
  // later migration.
  bgClass: text('bg_class').notNull(),
  opacity: integer('opacity').notNull(), // The lane's shade, 0-100 (Admin "Shade" slider)
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
  // Null = no project. Deleting a project releases its tasks rather than
  // taking them with it.
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
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
  // Free-form owner label (max TASK_OWNER_MAX_LEN chars) — DB-level length enforced via VARCHAR
  owner: text('owner'),
  // Bin (soft delete). Null = live. Set when a task is dropped on the Bin;
  // cleared by Restore. Only "Delete forever" removes the row.
  deletedAt: timestamp('deleted_at'),
});

// Drizzle has no built-in bytea column; the driver already speaks Buffer.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * A file attached to a task description (see shared/attachments.ts). The
 * description references a row by `/api/attachments/:id`; the bytes live
 * here rather than as base64 inside the description text.
 */
export const taskAttachments = pgTable('task_attachments', {
  id: serial('id').primaryKey(),
  // Null until the description that references the upload is saved, and
  // again once a save drops the reference; the sweeper deletes those rows
  // after ATTACHMENT_ORPHAN_TTL_MS. Deleting a task forever cascades.
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
  }),
  attachments: many(taskAttachments),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
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

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
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

const hexColorSchema = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

export const insertProjectSchema = createInsertSchema(projects)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z
      .string()
      .trim()
      .min(1, 'Project name is required')
      .max(PROJECT_NAME_MAX_LEN, `Project name must be ${PROJECT_NAME_MAX_LEN} characters or less`),
    key: z
      .string()
      .trim()
      .max(PROJECT_KEY_MAX_LEN, `Project key must be ${PROJECT_KEY_MAX_LEN} characters or less`)
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return v;
        const upper = v.toUpperCase();
        return upper.length === 0 ? null : upper;
      }),
    color: hexColorSchema.optional().nullable(),
    archived: z.boolean().optional(),
    order: z.number().int().optional(),
  });

export const insertSubStageSchema = createInsertSchema(subStages)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    // Blank tags would make every tagged task match every sub-stage of a stage
    tag: z.string().trim().min(1),
    opacity: z.number().min(0).max(100), // Store as 0-100 integer
  });

// Explicit overrides for every field — `createInsertSchema(tasks)` infers `any`
// because the `tasks` table self-references via `parentTaskId.references(() => tasks.id)`.
export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    // Bin state is owned by the bin/restore endpoints, never by a task write.
    deletedAt: true,
  })
  .extend({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    stageId: z.number(),
    projectId: z.number().int().positive().optional().nullable(),
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
    owner: z
      .string()
      .max(TASK_OWNER_MAX_LEN, `Owner must be ${TASK_OWNER_MAX_LEN} characters or less`)
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return v;
        const trimmed = v.trim();
        return trimmed.length === 0 ? null : trimmed;
      }),
  });

export type Stage = typeof stages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type SubStage = typeof subStages.$inferSelect;
export type Project = typeof projects.$inferSelect;
/** An attachment row including its bytes — what the file route serves. */
export type TaskAttachmentRow = typeof taskAttachments.$inferSelect;
/** An attachment without its bytes: what lists, exports and the API return. */
export type TaskAttachment = Omit<TaskAttachmentRow, 'data'>;
/** What an upload stores. `byteSize` is derived from `data`. */
export interface InsertAttachment {
  taskId: number | null;
  filename: string;
  mimeType: string;
  data: Buffer;
}
/** A project plus how many live (unarchived, unbinned) tasks it holds. */
export type ProjectSummary = Project & { taskCount: number };
export type InsertStage = z.infer<typeof insertStageSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertSubStage = z.infer<typeof insertSubStageSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
