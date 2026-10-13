-- EPIC-03 story 1: a column's meaning stops depending on its display name.
-- (docs/epics/EPIC-03-task-data-integrity.md, finding #5.)
--
-- Before this migration, "is this column done?" was answered by substring-
-- matching `stages.name` at read time, in four slightly different functions.
-- Renaming a column silently restated every task in it, names carried emoji
-- and stray whitespace ("Waiting ✋️ ", "Done  ✔"), and the matching was wrong
-- in a way nobody could see: 'abandoned' contains 'done', so an Abandoned
-- column classified as done.
--
-- After it, `stages.kind` holds the meaning and the name is decoration.
--
-- This is the one and only place the name inference runs. Precedence is fixed
-- here and differs from the old TypeScript on purpose: waiting is tested
-- before anything else because a "Waiting on Done" column is waiting, and
-- abandoned is tested before done so "Abandoned" stops reading as done.

ALTER TABLE "stages" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'backlog';
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stages_kind_check') THEN
		ALTER TABLE "stages" ADD CONSTRAINT "stages_kind_check"
			CHECK ("kind" IN ('backlog','in_progress','waiting','done','abandoned'));
	END IF;
END $$;
--> statement-breakpoint
-- The record of what the inference decided, kept rather than printed: these
-- are the rows an operator should eyeball in Admin, and the evidence for every
-- task state this migration implies.
CREATE TABLE IF NOT EXISTS "stage_kind_backfill_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"stage_name" text NOT NULL,
	"assigned_kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "stages" SET "kind" = CASE
	WHEN lower("name") ~ '(wait|block|hold)'              THEN 'waiting'
	WHEN lower("name") ~ '(abandon|cancel|drop|won.?t)'   THEN 'abandoned'
	WHEN lower("name") ~ '(progress|doing|active|wip)'    THEN 'in_progress'
	WHEN lower("name") ~ '(done|complete|finish|ship)'    THEN 'done'
	ELSE 'backlog'
END;
--> statement-breakpoint
INSERT INTO "stage_kind_backfill_report" ("stage_id", "stage_name", "assigned_kind")
SELECT "id", "name", "kind" FROM "stages" ORDER BY "order", "id";
--> statement-breakpoint
-- Finding #5's other half: two columns sharing an `order` made the board's
-- column order non-deterministic. Renumber duplicates by (order, id) before
-- the uniqueness constraint story 9 adds can be relied on. Not the constraint
-- itself — that is story 9's, and it needs the Admin reorder UI with it.
WITH renumbered AS (
	SELECT "id", row_number() OVER (ORDER BY "order", "id") AS seq FROM "stages"
)
UPDATE "stages" s SET "order" = r.seq
FROM renumbered r
WHERE s."id" = r."id" AND s."order" <> r.seq;
