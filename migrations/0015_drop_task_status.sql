-- EPIC-03 story 2: one authoritative state per task.
-- (docs/epics/EPIC-03-task-data-integrity.md, finding #1.)
--
-- `tasks.status` and `tasks.stage_id` were two contradictory state machines.
-- Against production data on 11 Aug 2026, three of 22 tasks disagreed: #126
-- was `status: in_progress` sitting in Backlog, #128 and #139 were
-- `status: backlog` sitting in Waiting. The UI rendered `stage_id`; an agent
-- filtering `status = 'in_progress'` got a different set, and the export had
-- to ship a `statusConflict` flag to report the disagreement it papered over.
--
-- The stage wins. It is what the board draws and what a human therefore
-- believes, and it is the half of the pair the user manipulates directly by
-- dragging a card. Every row whose status disagreed keeps its old value in
-- `history`, so nothing is lost silently and the modal shows the change.
--
-- Depends on 0014: without `stages.kind` there is no stage-derived state to
-- collapse into.

-- Guard: the backfill reads `stages.kind`, so refuse to run if 0014 has not.
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'stages' AND column_name = 'kind'
	) THEN
		RAISE EXCEPTION 'EPIC-03 story 2 aborted: stages.kind is missing, run 0014_stage_kind first';
	END IF;
END $$;
--> statement-breakpoint
-- Skip the whole reconciliation when the column has already gone, so a
-- re-run on a migrated database is a no-op rather than an error.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'tasks' AND column_name = 'status'
	) THEN
		RETURN;
	END IF;

	-- The evidence table: one row per task whose stored status the stage
	-- overruled. Created only on the run that actually reconciles.
	CREATE TABLE IF NOT EXISTS "task_status_backfill_report" (
		"id" serial PRIMARY KEY NOT NULL,
		"task_id" integer NOT NULL,
		"previous_status" text,
		"stage_name" text NOT NULL,
		"resolved_kind" text NOT NULL,
		"created_at" timestamp DEFAULT now() NOT NULL
	);

	EXECUTE $sql$
		INSERT INTO "task_status_backfill_report"
			("task_id", "previous_status", "stage_name", "resolved_kind")
		SELECT t."id", t."status", s."name", s."kind"
		FROM "tasks" t
		JOIN "stages" s ON s."id" = t."stage_id"
		WHERE t."status" IS NOT NULL
			AND btrim(t."status") <> ''
			AND t."status" <> s."kind"
		ORDER BY t."id"
	$sql$;

	-- Every reconciled task gets a history line naming what it used to claim,
	-- so the change is visible in the task's own History modal rather than
	-- only in a migration table.
	EXECUTE $sql$
		UPDATE "tasks" t
		SET "history" = coalesce(t."history", '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
			'status', s."kind",
			'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
			'note', 'EPIC-03: state taken from the ' || btrim(s."name") ||
				' column; the stored status said ' || t."status"
		))
		FROM "stages" s
		WHERE s."id" = t."stage_id"
			AND t."status" IS NOT NULL
			AND btrim(t."status") <> ''
			AND t."status" <> s."kind"
	$sql$;

	-- The drop. Nothing reads `tasks.status` after this; a task's state is the
	-- kind of the stage it sits in.
	EXECUTE 'ALTER TABLE "tasks" DROP COLUMN "status"';
END $$;
