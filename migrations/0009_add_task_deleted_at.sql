-- Bin (soft delete): null = live, timestamp = sitting in the Bin.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
-- Every board read filters on this, so keep the live rows cheap to find.
CREATE INDEX IF NOT EXISTS "tasks_deleted_at_idx" ON "tasks" ("deleted_at");
