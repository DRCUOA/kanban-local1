-- Add free-form `owner` label to tasks. Length capped at 15 chars at the DB level
-- via VARCHAR(15) so the schema enforces it regardless of any app-layer drift.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "owner" varchar(15);
