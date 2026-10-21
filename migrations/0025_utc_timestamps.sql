-- Timestamps the database stamped itself are moved from the server's local
-- time to UTC.
--
-- Every timestamp column is `timestamp` without time zone, and the app reads
-- each one back as UTC. A Date the app writes is stored as UTC, but `now()` —
-- every `DEFAULT now()` and the `NOW()` in server SQL — was cast into the
-- session's TimeZone. On a Postgres whose own TimeZone is not UTC (a Homebrew
-- server set to Pacific/Auckland) those values hold local wall-clock time, so
-- a task made at 07:28Z came back from GET /api/tasks as 20:28Z. Sessions are
-- pinned to UTC from now on (server/pg-config.ts, server/migrate.ts); this
-- moves the values already stored.
--
-- The zone they were stored in is the one the server gives a session by
-- default. server/migrate.ts reads it before pinning its own session and
-- passes it in as `kanban.legacy_time_zone`; run any other way (drizzle-kit
-- migrate), the session's own TimeZone is that default. On a server whose
-- zone is UTC no value changes and no row is touched.
--
-- Moved: the columns only `now()` ever writes. `updated_at` on tasks and on
-- inbound_email_processing is written by the app as well, so it moves only
-- where it still equals `created_at` — both were defaulted by the same INSERT
-- and nothing has written the row since. Not moved: columns the app always
-- writes itself (app_settings.updated_at, access_devices.issued_at,
-- gmail_watch_cursor.updated_at, due, deleted, lease and attempt times), and
-- the few `updated_at`/`processed_at` values the inbound worker's own `NOW()`
-- wrote, which cannot be told apart from the app's.
--
-- Every value moved is recorded in `utc_timestamp_repair_report`, with the
-- value it had and the zone it was read in.

CREATE TABLE IF NOT EXISTS "utc_timestamp_repair_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"row_key" text NOT NULL,
	"column_name" text NOT NULL,
	"stored" timestamp NOT NULL,
	"repaired" timestamp NOT NULL,
	"server_time_zone" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
DO $$
DECLARE
	zone text := coalesce(
		nullif(current_setting('kanban.legacy_time_zone', true), ''),
		current_setting('TimeZone')
	);
	-- What a `now()` stored earlier in this same run, under the UTC pin: a
	-- value an earlier migration of the run wrote (0024 filling viewed_at)
	-- is UTC already and stays.
	this_run timestamp := now() AT TIME ZONE 'UTC';
	target record;
	moved text;
BEGIN
	FOR target IN SELECT * FROM (VALUES
		-- updated_at first: its condition reads created_at before that moves.
		('tasks', 'updated_at', '"id"::text', '"updated_at" = "created_at"'),
		('tasks', 'created_at', '"id"::text', 'true'),
		('tasks', 'viewed_at', '"id"::text', 'true'),
		('stages', 'created_at', '"id"::text', 'true'),
		('projects', 'created_at', '"id"::text', 'true'),
		('owners', 'created_at', '"id"::text', 'true'),
		('sub_stages', 'created_at', '"id"::text', 'true'),
		('task_attachments', 'created_at', '"id"::text', 'true'),
		('task_dependencies', 'created_at', '"predecessor_id" || ''->'' || "successor_id"', 'true'),
		('inbound_email_processing', 'updated_at', '"id"::text', '"updated_at" = "created_at"'),
		('inbound_email_processing', 'created_at', '"id"::text', 'true'),
		('owner_backfill_report', 'created_at', '"id"::text', 'true'),
		('stage_kind_backfill_report', 'created_at', '"id"::text', 'true'),
		('task_status_backfill_report', 'created_at', '"id"::text', 'true')
	) AS t(table_name, column_name, row_key, only_if)
	LOOP
		moved := format('(%I AT TIME ZONE $1) AT TIME ZONE ''UTC''', target.column_name);
		EXECUTE format(
			'INSERT INTO "utc_timestamp_repair_report"
				("table_name", "row_key", "column_name", "stored", "repaired", "server_time_zone")
			SELECT %L, %s, %L, %I, %s, $1 FROM %I
			WHERE %I IS NOT NULL AND %I <> $2 AND %s <> %I AND (%s)',
			target.table_name, target.row_key, target.column_name, target.column_name, moved,
			target.table_name, target.column_name, target.column_name, moved, target.column_name,
			target.only_if
		) USING zone, this_run;
		EXECUTE format(
			'UPDATE %I SET %I = %s WHERE %I IS NOT NULL AND %I <> $2 AND %s <> %I AND (%s)',
			target.table_name, target.column_name, moved, target.column_name, target.column_name,
			moved, target.column_name, target.only_if
		) USING zone, this_run;
	END LOOP;
END $$;
