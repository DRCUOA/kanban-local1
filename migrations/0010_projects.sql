-- Project layer (docs/epics/EPIC-01-project-layer.md): a project is a set of
-- tasks related to a common goal. It scopes which tasks the board shows and
-- never changes the stages, so stages and sub-stages stay global.
CREATE TABLE IF NOT EXISTS "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text,
	"color" text,
	"archived" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
-- Nullable on purpose: null is "no project". Every existing task stays visible
-- under "All projects" and "No project" with no backfill and no broken window.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "project_id" integer;
--> statement-breakpoint
-- Deleting a project releases its tasks instead of taking them with it.
-- Guarded so a database that already got the constraint from `db:push` still
-- applies cleanly.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'tasks_project_id_projects_id_fk'
	) THEN
		ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
-- A scoped board read is `WHERE project_id = ? AND archived = false AND deleted_at IS NULL`,
-- then grouped by stage on the client.
CREATE INDEX IF NOT EXISTS "tasks_project_id_stage_id_idx" ON "tasks" ("project_id", "stage_id");
