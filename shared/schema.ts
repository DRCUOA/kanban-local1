import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import {
  STAGE_KIND_VALUES,
  DEFAULT_STAGE_KIND,
  TASK_PRIORITY,
  TASK_TYPE_VALUES,
  TASK_RECURRENCE,
  EFFORT_MIN,
  EFFORT_MAX,
  OWNER_NAME_MAX_LEN,
  OWNER_KEY_MAX_LEN,
  PROJECT_NAME_MAX_LEN,
  PROJECT_KEY_MAX_LEN,
} from './constants';

export const stages = pgTable('stages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  // What the column means, independent of what it is called (EPIC-03 story 1).
  // This is the task state: a task is in progress because it sits in an
  // in-progress column, not because a second field on the task says so. The
  // display name is decoration and can be renamed freely.
  kind: text('kind').notNull().default(DEFAULT_STAGE_KIND),
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

/**
 * A person the board can assign work to (docs/epics/EPIC-06-owner-as-entity.md).
 * An owner is a label with an identity — a row that can be renamed once and
 * referenced by many tasks — not an account: no email, no credentials, no
 * membership. Authentication stays EPIC-02's.
 */
export const owners = pgTable('owners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  // Optional short code (e.g. "RC") for chips where the name would not fit.
  key: text('key'),
  color: text('color'),
  // Archived owners keep their assignments but leave the pickers.
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
  // Set = this lane is a person's lane, and it holds exactly the tasks in its
  // stage owned by them (`tag` is not read for it). Null = a tag lane, matched
  // against `tasks.tags` as before. See EPIC-06 §5.
  ownerId: integer('owner_id').references(() => owners.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Stage kind enum — values sourced from shared/constants.ts
export const stageKindEnum = z.enum(STAGE_KIND_VALUES);
export type StageKind = z.infer<typeof stageKindEnum>;

// Task priority enum — values sourced from shared/constants.ts
export const taskPriorityEnum = z.enum([
  TASK_PRIORITY.LOW,
  TASK_PRIORITY.NORMAL,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.CRITICAL,
]);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

// Task type enum — values sourced from shared/constants.ts
export const taskTypeEnum = z.enum(TASK_TYPE_VALUES);
export type TaskType = z.infer<typeof taskTypeEnum>;

// Task recurrence enum — values sourced from shared/constants.ts
export const taskRecurrenceEnum = z.enum([
  TASK_RECURRENCE.NONE,
  TASK_RECURRENCE.DAILY,
  TASK_RECURRENCE.WEEKLY,
  TASK_RECURRENCE.MONTHLY,
]);
export type TaskRecurrence = z.infer<typeof taskRecurrenceEnum>;

/**
 * One line of a task's history.
 *
 * `status` is the key name rows written before EPIC-03 already use, so it
 * stays; its value is now a stage kind, which is a superset of the old status
 * enum (it adds `waiting`). Entries are appended when a task changes column,
 * is archived, or moves to and from the Bin.
 */
export interface TaskHistoryEntry {
  status: StageKind;
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
  //
  // There is no `status` here. It was a second state machine that could, and
  // did, contradict `stageId` — the board rendered one answer while an agent
  // filtering on the other got a different set. Dropped in EPIC-03 story 2;
  // a task's state is the `kind` of the stage it sits in.
  priority: text('priority').default(TASK_PRIORITY.NORMAL),
  // Null = unset. 'goal' or 'building-block' (see TASK_TYPE).
  type: text('type'),
  // Building-block → the goal it contributes to. Null for goals and for unassigned
  // blocks. FK to tasks(id) ON DELETE SET NULL and the goal-only rules are enforced
  // at DB level (migration 0017); not via .references() to avoid circular inference.
  goalTaskId: integer('goal_task_id'),
  effort: integer('effort'), // EFFORT_MIN–EFFORT_MAX
  dueDate: timestamp('due_date'), // Optional due date
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  tags: jsonb('tags').$type<string[]>(),
  parentTaskId: integer('parent_task_id'), // FK to tasks(id) enforced at DB level, not via Drizzle .references() to avoid circular type inference
  recurrence: text('recurrence').default(TASK_RECURRENCE.NONE),
  history: jsonb('history').$type<TaskHistoryEntry[]>(), // Stage-change history
  // Null = Unassigned. Deleting an owner releases their tasks rather than
  // taking them with it (EPIC-06).
  ownerId: integer('owner_id').references(() => owners.id, { onDelete: 'set null' }),
  // Legacy mirror of `owners.name`, kept in step by database triggers so
  // `GET /api/export` and the daily-briefing agent keep reading the field they
  // read before EPIC-06. Read-only: writes set `ownerId`. Dropped by OWN-10.
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

/**
 * Predecessor → successor edges (migration 0018). One row per edge, stored in
 * one direction only; a task's successors are the rows where it is the
 * predecessor. Acyclicity is enforced by a database trigger.
 */
export const taskDependencies = pgTable(
  'task_dependencies',
  {
    predecessorId: integer('predecessor_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    successorId: integer('successor_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.predecessorId, t.successorId] })],
);
export type TaskDependency = typeof taskDependencies.$inferSelect;

/** App-wide key/value settings (migration 0021). Secret values are stored encrypted. */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Access codes and export tokens issued by the developer console (migration 0022). Only digests are stored. */
export const accessDevices = pgTable('access_devices', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull().default('device'),
  label: text('label').notNull(),
  codeHash: text('code_hash').notNull().unique(),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  admittedAt: timestamp('admitted_at'),
  browserKeyHash: text('browser_key_hash'),
  firstSeenAt: timestamp('first_seen_at'),
  lastSeenAt: timestamp('last_seen_at'),
  revokedAt: timestamp('revoked_at'),
});
export type AccessDevice = typeof accessDevices.$inferSelect;

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

/**
 * Inbound mail → task pipeline state: one row per message, keyed per provider
 * (`provider` + `message_key` is unique). The key is the Gmail message id for
 * a row the Gmail pipeline found, and the RFC Message-ID or a content digest
 * for one that arrived at POST /api/inbox (server/inbox). An inbox row carries
 * the message itself (`sender`, `subject`, `bodyText`); a Gmail row is fetched
 * again from Gmail when it is worked.
 */
export const inboundEmailProcessing = pgTable(
  'inbound_email_processing',
  {
    id: serial('id').primaryKey(),
    provider: text('provider').notNull().default('gmail'),
    messageKey: text('message_key').notNull(),
    rfcMessageId: text('rfc_message_id'),
    historyIdSeen: text('history_id_seen'),
    recipient: text('recipient'),
    sender: text('sender'),
    subject: text('subject'),
    bodyText: text('body_text'),
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
  // The constraint keeps its original name across the column's rename (0023).
  (t) => [unique('inbound_provider_gmail_msg').on(t.provider, t.messageKey)],
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
  goal: one(tasks, {
    fields: [tasks.goalTaskId],
    references: [tasks.id],
    relationName: 'goalBlocks',
  }),
  buildingBlocks: many(tasks, {
    relationName: 'goalBlocks',
  }),
  attachments: many(taskAttachments),
  owner: one(owners, {
    fields: [tasks.ownerId],
    references: [owners.id],
  }),
}));

export const ownersRelations = relations(owners, ({ many }) => ({
  tasks: many(tasks),
  subStages: many(subStages),
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
  owner: one(owners, {
    fields: [subStages.ownerId],
    references: [owners.id],
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
    // Optional on the wire, defaulted in the database: a caller that does not
    // care gets a backlog column. It is never inferred from `name` — that was
    // the defect EPIC-03 story 1 removed.
    kind: stageKindEnum.optional(),
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

export const insertOwnerSchema = createInsertSchema(owners)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z
      .string()
      .trim()
      .min(1, 'Owner name is required')
      .max(OWNER_NAME_MAX_LEN, `Owner name must be ${OWNER_NAME_MAX_LEN} characters or less`),
    key: z
      .string()
      .trim()
      .max(OWNER_KEY_MAX_LEN, `Owner code must be ${OWNER_KEY_MAX_LEN} characters or less`)
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
    // Set = a person's lane; null = a tag lane (EPIC-06 OWN-R11).
    ownerId: z.number().int().positive().optional().nullable(),
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
    // `owner` is a mirror of the owner's name maintained by the database;
    // a task write sets `ownerId` (EPIC-06 OWN-R1).
    owner: true,
  })
  .extend({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    stageId: z.number(),
    projectId: z.number().int().positive().optional().nullable(),
    archived: z.boolean().optional(),
    priority: taskPriorityEnum.optional(),
    type: taskTypeEnum.optional().nullable(),
    goalTaskId: z.number().int().positive().optional().nullable(),
    // Not columns: the form's way of replacing the task's dependency edges. Absent = untouched.
    predecessorIds: z.array(z.number().int().positive()).optional(),
    successorIds: z.array(z.number().int().positive()).optional(),
    effort: z.number().min(EFFORT_MIN).max(EFFORT_MAX).optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    tags: z.array(z.string()).optional().nullable(),
    parentTaskId: z.number().optional().nullable(),
    recurrence: taskRecurrenceEnum.optional(),
    history: z
      .array(
        z.object({
          status: stageKindEnum,
          timestamp: z.string(),
          note: z.string().optional(),
        }),
      )
      .optional()
      .nullable(),
    ownerId: z.number().int().positive().optional().nullable(),
  });

export type Stage = typeof stages.$inferSelect;
export type Owner = typeof owners.$inferSelect;
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
/** An owner plus how many live (unarchived, unbinned) tasks they hold. */
export type OwnerSummary = Owner & { taskCount: number };
export type InsertStage = z.infer<typeof insertStageSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertSubStage = z.infer<typeof insertSubStageSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
