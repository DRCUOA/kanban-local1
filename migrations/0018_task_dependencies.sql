-- Task dependencies: predecessor / successor as a many-to-many on tasks.
--
--   predecessor ──▶ successor      ("predecessor must finish before successor")
--
-- One row is one edge, stored in ONE direction only. "Successor" is not a second
-- fact: a task's successors are the rows where it is `predecessor_id`; its
-- predecessors are the rows where it is `successor_id`. Two stored directions
-- would admit rows that disagree about the same relation (EPIC-05 Option A).
-- Timing judgements (on time / late) are derived at read time, never stored.
--
-- This is the ordering relation. It is independent of tasks.goal_task_id
-- (membership: a building-block contributes to a goal, 0017) and of
-- tasks.parent_task_id (decomposition). Critical-path reports traverse this
-- table; project views group by goal_task_id.
--
-- Rules, enforced here so no writer (API, import, agent, psql) can break them:
--   * an edge joins two distinct tasks                    (CHECK)
--   * the same edge cannot be stored twice                (PRIMARY KEY)
--   * the graph is acyclic, so a critical path exists     (trigger)
--   * deleting a task forever removes its edges           (ON DELETE CASCADE)
-- Binning (soft delete) and archiving keep the edges; whether a binned or done
-- predecessor still counts is a read-time judgement.

CREATE TABLE IF NOT EXISTS "task_dependencies" (
	"predecessor_id" integer NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
	"successor_id" integer NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_pk" PRIMARY KEY ("predecessor_id", "successor_id"),
	CONSTRAINT "task_dependencies_no_self" CHECK ("predecessor_id" <> "successor_id")
);
--> statement-breakpoint
-- The primary key serves "successors of X"; this serves "predecessors of X".
CREATE INDEX IF NOT EXISTS "task_dependencies_successor_idx" ON "task_dependencies" ("successor_id");
--> statement-breakpoint
-- Reject an edge that would close a loop: it is a cycle exactly when the new
-- edge's predecessor is already reachable from its successor.
CREATE OR REPLACE FUNCTION task_dependencies_acyclic_guard() RETURNS trigger AS $$
BEGIN
	IF EXISTS (
		WITH RECURSIVE downstream(id) AS (
			SELECT NEW."successor_id"
			UNION
			SELECT d."successor_id" FROM "task_dependencies" d JOIN downstream ON d."predecessor_id" = downstream.id
		)
		SELECT 1 FROM downstream WHERE id = NEW."predecessor_id"
	) THEN
		RAISE EXCEPTION 'dependency % -> % would create a cycle', NEW."predecessor_id", NEW."successor_id"
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_dependencies_acyclic" ON "task_dependencies";
--> statement-breakpoint
CREATE TRIGGER "task_dependencies_acyclic"
	BEFORE INSERT ON "task_dependencies"
	FOR EACH ROW EXECUTE FUNCTION task_dependencies_acyclic_guard();
