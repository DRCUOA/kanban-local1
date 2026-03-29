ALTER TABLE "inbound_email_processing"
  DROP CONSTRAINT "inbound_email_processing_created_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "inbound_email_processing"
  ADD CONSTRAINT "inbound_email_processing_created_task_id_tasks_id_fk"
  FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
