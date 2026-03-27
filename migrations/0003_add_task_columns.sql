-- Align `tasks` with shared/schema.ts: columns added in app code but never shipped in SQL migrations.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'backlog';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'normal';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "effort" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "due_date" timestamp;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" jsonb;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrence" text DEFAULT 'none';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "history" jsonb;
