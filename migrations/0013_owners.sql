-- EPIC-06: owner becomes an entity (docs/epics/EPIC-06-owner-as-entity.md).
--
-- Before this migration, "whose task is this?" was a free-text varchar(15)
-- whose set of valid values was whatever `SELECT DISTINCT owner FROM tasks`
-- returned, plus a sub-stage tag string carrying the same fact a second time.
-- After it, assignment is `tasks.owner_id` and nothing else. Person-named
-- lanes bind to the same rows and derive their membership from it.
--
-- Backfill rule: the lane wins. Where a task's text owner and its person lane
-- disagree, the lane is treated as the truer record and every overwrite is
-- recorded in `owner_backfill_report`. Anything ambiguous aborts the whole
-- migration rather than guessing (OWN-R22).

CREATE TABLE IF NOT EXISTS "owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text,
	"color" text,
	"archived" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
-- Case-variant names ("Rich" / "rich ") are the duplicate-owner defect this
-- epic removes; the database refuses them rather than trusting the API to.
CREATE UNIQUE INDEX IF NOT EXISTS "owners_name_lower_uniq" ON "owners" (lower(btrim("name")));
--> statement-breakpoint
-- Nullable on purpose: null is Unassigned, as null project_id is "no project".
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "owner_id" integer;
--> statement-breakpoint
ALTER TABLE "sub_stages" ADD COLUMN IF NOT EXISTS "owner_id" integer;
--> statement-breakpoint
-- `tasks.owner` stops being an input and becomes a mirror of `owners.name`,
-- so it can no longer be capped at 15 characters.
ALTER TABLE "tasks" ALTER COLUMN "owner" TYPE text;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_owner_id_owners_id_fk') THEN
		ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_owners_id_fk"
			FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sub_stages_owner_id_owners_id_fk') THEN
		ALTER TABLE "sub_stages" ADD CONSTRAINT "sub_stages_owner_id_owners_id_fk"
			FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_owner_id_stage_id_idx" ON "tasks" ("owner_id", "stage_id");
--> statement-breakpoint
-- A stage may hold at most one lane per owner, or "the tasks in this stage
-- owned by Rich" has two homes and lane membership is ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "sub_stages_stage_owner_uniq"
	ON "sub_stages" ("stage_id", "owner_id") WHERE "owner_id" IS NOT NULL;
--> statement-breakpoint
-- The record of what the backfill decided, kept rather than printed: a report
-- in a log file outlives nothing, and this one is the evidence for every
-- assignment the migration changed.
CREATE TABLE IF NOT EXISTS "owner_backfill_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"previous_owner" text,
	"assigned_owner" text NOT NULL,
	"deciding_lane" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- One row per distinct text owner, case-folded. Where case variants exist the
-- spelling on the most tasks wins, ties broken alphabetically.
INSERT INTO "owners" ("name")
SELECT DISTINCT ON (lower(name)) name
FROM (
	SELECT btrim("owner") AS name, count(*) AS uses
	FROM "tasks"
	WHERE "owner" IS NOT NULL AND btrim("owner") <> ''
	GROUP BY btrim("owner")
) candidates
ORDER BY lower(name), uses DESC, name
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- A lane is a person lane when its name, stripped of decorative characters and
-- collapsed whitespace the way shared/briefing.ts `cleanLabel` does it, equals
-- an owner's name. Equality, not containment — so "Cross check with Moi" is a
-- status lane that happens to mention a person, and stays one.
UPDATE "sub_stages" ss
SET "owner_id" = o."id"
FROM "owners" o
WHERE lower(btrim(regexp_replace(
		regexp_replace(ss."name", '[^[:alnum:][:space:]''.-]', '', 'g'),
		'\s+', ' ', 'g'))) = lower(btrim(o."name"));
--> statement-breakpoint
-- Guard 1: two lanes in one stage claiming the same person. The unique index
-- would refuse it anyway; this names the rows instead of reporting a conflict.
DO $$
DECLARE clash text;
BEGIN
	SELECT string_agg(ids, '; ') INTO clash FROM (
		SELECT 'stage ' || "stage_id" || ' owner ' || "owner_id" || ' lanes ' ||
			string_agg("id"::text, ',' ORDER BY "id") AS ids
		FROM "sub_stages"
		WHERE "owner_id" IS NOT NULL
		GROUP BY "stage_id", "owner_id"
		HAVING count(*) > 1
	) clashes;
	IF clash IS NOT NULL THEN
		RAISE EXCEPTION 'EPIC-06 backfill aborted: one stage holds two lanes for the same owner (%)', clash;
	END IF;
END $$;
--> statement-breakpoint
-- Guard 2: a task carrying the tags of two person lanes in its own stage has
-- no single lane answer, so the migration refuses to pick one.
DO $$
DECLARE clash text;
BEGIN
	SELECT string_agg(DISTINCT t."id"::text, ',') INTO clash
	FROM "tasks" t
	JOIN "sub_stages" ss ON ss."stage_id" = t."stage_id" AND ss."owner_id" IS NOT NULL
	WHERE t."tags" IS NOT NULL AND t."tags" ? ss."tag"
	GROUP BY t."id"
	HAVING count(DISTINCT ss."owner_id") > 1;
	IF clash IS NOT NULL THEN
		RAISE EXCEPTION 'EPIC-06 backfill aborted: tasks carry two person-lane tags in one stage (%)', clash;
	END IF;
END $$;
--> statement-breakpoint
-- Step 1 of the assignment: the lane the task actually sits in wins.
UPDATE "tasks" t
SET "owner_id" = ss."owner_id"
FROM "sub_stages" ss
WHERE ss."owner_id" IS NOT NULL
	AND ss."stage_id" = t."stage_id"
	AND t."tags" IS NOT NULL
	AND t."tags" ? ss."tag";
--> statement-breakpoint
-- Record every row where the lane overruled a different text owner.
INSERT INTO "owner_backfill_report" ("task_id", "previous_owner", "assigned_owner", "deciding_lane")
SELECT t."id", btrim(t."owner"), o."name", ss."name"
FROM "tasks" t
JOIN "owners" o ON o."id" = t."owner_id"
JOIN "sub_stages" ss ON ss."owner_id" = t."owner_id" AND ss."stage_id" = t."stage_id"
WHERE t."owner" IS NOT NULL
	AND btrim(t."owner") <> ''
	AND lower(btrim(t."owner")) <> lower(btrim(o."name"));
--> statement-breakpoint
-- Step 2: everything the lanes did not decide falls back to the text owner.
UPDATE "tasks" t
SET "owner_id" = o."id"
FROM "owners" o
WHERE t."owner_id" IS NULL
	AND t."owner" IS NOT NULL
	AND btrim(t."owner") <> ''
	AND lower(btrim(t."owner")) = lower(btrim(o."name"));
--> statement-breakpoint
-- Guard 3: a named owner that ended up assigned to nothing means the matching
-- above has a hole, and a silent hole is the defect this epic is about.
DO $$
DECLARE orphans text;
BEGIN
	SELECT string_agg("id"::text, ',') INTO orphans
	FROM "tasks"
	WHERE "owner_id" IS NULL AND "owner" IS NOT NULL AND btrim("owner") <> '';
	IF orphans IS NOT NULL THEN
		RAISE EXCEPTION 'EPIC-06 backfill aborted: tasks name an owner that did not resolve to a row (%)', orphans;
	END IF;
END $$;
--> statement-breakpoint
-- The lane tags have no reader left. Strip exactly those, and nothing else:
-- topic tags ("solar", "family") share this array and must survive.
UPDATE "tasks" t
SET "tags" = (
	SELECT jsonb_agg(elem)
	FROM jsonb_array_elements_text(t."tags") AS elem
	WHERE elem NOT IN (SELECT "tag" FROM "sub_stages" WHERE "owner_id" IS NOT NULL)
)
WHERE t."tags" IS NOT NULL
	AND EXISTS (
		SELECT 1 FROM jsonb_array_elements_text(t."tags") AS elem
		WHERE elem IN (SELECT "tag" FROM "sub_stages" WHERE "owner_id" IS NOT NULL)
	);
--> statement-breakpoint
-- The mirror. A generated column cannot read another table, so two triggers
-- keep `tasks.owner` in step with the owner's name for consumers that still
-- read it (GET /api/export, the daily-briefing agent). OWN-10 deletes all of
-- this once those consumers have moved to `owner_id`.
CREATE OR REPLACE FUNCTION "tasks_sync_owner_mirror"() RETURNS trigger AS $$
BEGIN
	NEW."owner" := (SELECT "name" FROM "owners" WHERE "id" = NEW."owner_id");
	RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "tasks_owner_mirror" ON "tasks";
--> statement-breakpoint
CREATE TRIGGER "tasks_owner_mirror"
	BEFORE INSERT OR UPDATE OF "owner_id" ON "tasks"
	FOR EACH ROW EXECUTE FUNCTION "tasks_sync_owner_mirror"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "owners_sync_name_mirror"() RETURNS trigger AS $$
BEGIN
	UPDATE "tasks" SET "owner" = NEW."name" WHERE "owner_id" = NEW."id";
	RETURN NULL;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "owners_name_mirror" ON "owners";
--> statement-breakpoint
CREATE TRIGGER "owners_name_mirror"
	AFTER UPDATE OF "name" ON "owners"
	FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
	EXECUTE FUNCTION "owners_sync_name_mirror"();
--> statement-breakpoint
-- One sync at the end: after this, `tasks.owner` says exactly what `owner_id`
-- says, including NULL for a task that ended up Unassigned.
UPDATE "tasks" t SET "owner" = (SELECT "name" FROM "owners" o WHERE o."id" = t."owner_id");
