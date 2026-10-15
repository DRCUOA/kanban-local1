-- A building-block belongs to the same project as its goal, when its goal has one.
--
--   goal.project_id IS NOT NULL  =>  every block's project_id = goal.project_id
--   goal.project_id IS NULL      =>  the goal is cross-cutting; its blocks keep
--                                    whatever project they have (or none)
--
-- Without this a project-scoped board or report could show a block whose goal
-- is hidden, or a goal missing its blocks. The no-project goal is the
-- deliberate escape hatch for work that spans projects.
--
-- Enforced on writes in both directions: linking or moving a block, and moving
-- a goal into a project while blocks sit elsewhere. Rows written before this
-- migration are not rewritten; they are checked the next time they are touched.

CREATE OR REPLACE FUNCTION tasks_goal_link_guard() RETURNS trigger AS $$
DECLARE
	goal_project integer;
BEGIN
	IF NEW."goal_task_id" IS NOT NULL THEN
		SELECT "project_id" INTO goal_project FROM "tasks"
			WHERE "id" = NEW."goal_task_id" AND "type" = 'goal';
		IF NOT FOUND THEN
			RAISE EXCEPTION 'tasks.goal_task_id % must reference a task of type goal', NEW."goal_task_id"
				USING ERRCODE = '23514';
		END IF;
		IF goal_project IS NOT NULL AND NEW."project_id" IS DISTINCT FROM goal_project THEN
			RAISE EXCEPTION 'a building-block must be in the same project as its goal (goal % is in project %)',
				NEW."goal_task_id", goal_project
				USING ERRCODE = '23514';
		END IF;
	END IF;
	IF TG_OP = 'UPDATE' AND OLD."type" = 'goal' AND NEW."type" IS DISTINCT FROM 'goal' THEN
		IF EXISTS (SELECT 1 FROM "tasks" WHERE "goal_task_id" = OLD."id") THEN
			RAISE EXCEPTION 'task % is the goal of building-blocks; reassign them before changing its type', OLD."id"
				USING ERRCODE = '23514';
		END IF;
	END IF;
	IF TG_OP = 'UPDATE' AND NEW."type" = 'goal' AND NEW."project_id" IS NOT NULL
		AND NEW."project_id" IS DISTINCT FROM OLD."project_id" THEN
		IF EXISTS (
			SELECT 1 FROM "tasks"
			WHERE "goal_task_id" = NEW."id" AND "project_id" IS DISTINCT FROM NEW."project_id"
		) THEN
			RAISE EXCEPTION 'goal % has building-blocks in other projects; move them first', NEW."id"
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
	BEFORE INSERT OR UPDATE OF "goal_task_id", "type", "project_id" ON "tasks"
	FOR EACH ROW EXECUTE FUNCTION tasks_goal_link_guard();
