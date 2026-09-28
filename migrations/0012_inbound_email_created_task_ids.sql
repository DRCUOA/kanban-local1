-- Replaces the files 0005_inbound_email_created_task_ids.sql and
-- 0006_fk_created_task_id_set_null.sql, which were never registered in
-- meta/_journal.json, so the migrator never applied them: a database created
-- from the migrations alone had no `created_task_ids`, and "Delete forever"
-- on a task (storage.deleteTask updates it) failed. Databases that got the
-- column another way (`db:push`, by hand) are unaffected: every statement
-- here is a no-op where its work is already done.
ALTER TABLE "inbound_email_processing"
  ADD COLUMN IF NOT EXISTS "created_task_ids" jsonb;
--> statement-breakpoint
-- The FK is re-created with ON DELETE SET NULL so deleting a task never fails
-- on an inbound-email row that points at it.
ALTER TABLE "inbound_email_processing"
  DROP CONSTRAINT IF EXISTS "inbound_email_processing_created_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "inbound_email_processing"
  ADD CONSTRAINT "inbound_email_processing_created_task_id_tasks_id_fk"
  FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
