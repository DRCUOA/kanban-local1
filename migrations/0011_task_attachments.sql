-- Task attachments (docs/epics/EPIC-03-task-data-integrity.md, story 7): a
-- file attached to a description is a row here, not base64 inside the
-- description text. The description references it by `/api/attachments/:id`.
CREATE TABLE IF NOT EXISTS "task_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- task_id is null for an upload whose description has not been saved yet (or
-- was saved without it); those rows are swept after a day. A task that is
-- deleted forever takes its files with it.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'task_attachments_task_id_tasks_id_fk'
	) THEN
		ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk"
			FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
-- Export lists a task's files, and the sweeper looks for unbound rows.
CREATE INDEX IF NOT EXISTS "task_attachments_task_id_idx" ON "task_attachments" ("task_id");
