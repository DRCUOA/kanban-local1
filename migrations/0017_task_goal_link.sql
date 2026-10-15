-- Goal link: a `building-block` task points at the `goal` task it contributes
-- to. This is the one relationship critical-path and project views traverse:
--
--   goal (type = 'goal', goal_task_id IS NULL)
--     └── 1..n building-blocks (type = 'building-block', goal_task_id = goal.id)
--
-- It is deliberately a separate column from `parent_task_id` (subtasks) and
-- from the planned EPIC-05 dependency edges: "contributes to" (membership),
-- "is a part of" (decomposition) and "must finish before" (ordering) are three
-- different questions and must not share one column.
--
-- Cardinality: a building-block has at most one goal; a goal has many blocks;
-- a building-block with no goal is allowed (orphan, not yet assigned). Goals
-- do not nest (a goal never has a goal_task_id), so the graph is two levels
-- deep and cannot contain a cycle.
--
-- Every rule below is enforced in the database, not only in the API, so a
-- direct write, an import or an agent cannot create an ambiguous row.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "goal_task_id" integer;
--> statement-breakpoint
-- Deleting a goal forever releases its blocks rather than taking them with it.
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_goal_task_id_fk') THEN
		ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_task_id_fk"
			FOREIGN KEY ("goal_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_goal_link_only_blocks') THEN
		ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_link_only_blocks"
			CHECK ("goal_task_id" IS NULL OR "type" = 'building-block');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_goal_not_self') THEN
		ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_not_self"
			CHECK ("goal_task_id" IS NULL OR "goal_task_id" <> "id");
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_type_valid') THEN
		ALTER TABLE "tasks" ADD CONSTRAINT "tasks_type_valid"
			CHECK ("type" IS NULL OR "type" IN ('goal', 'building-block'));
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_goal_task_id_idx" ON "tasks" ("goal_task_id");
--> statement-breakpoint
-- A CHECK cannot look at another row, so two rules need a trigger:
--   1. the target of goal_task_id must be a `goal`;
--   2. a `goal` that still has building-blocks cannot stop being a goal.
CREATE OR REPLACE FUNCTION tasks_goal_link_guard() RETURNS trigger AS $$
BEGIN
	IF NEW."goal_task_id" IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1 FROM "tasks" WHERE "id" = NEW."goal_task_id" AND "type" = 'goal'
		) THEN
			RAISE EXCEPTION 'tasks.goal_task_id % must reference a task of type goal', NEW."goal_task_id"
				USING ERRCODE = '23514';
		END IF;
	END IF;
	IF TG_OP = 'UPDATE' AND OLD."type" = 'goal' AND NEW."type" IS DISTINCT FROM 'goal' THEN
		IF EXISTS (SELECT 1 FROM "tasks" WHERE "goal_task_id" = OLD."id") THEN
			RAISE EXCEPTION 'task % is the goal of building-blocks; reassign them before changing its type', OLD."id"
				USING ERRCODE = '23514';
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "tasks_goal_link_guard" ON "tasks";
--> statement-breakpoint
CREATE TRIGGER "tasks_goal_link_guard"
	BEFORE INSERT OR UPDATE OF "goal_task_id", "type" ON "tasks"
	FOR EACH ROW EXECUTE FUNCTION tasks_goal_link_guard();
