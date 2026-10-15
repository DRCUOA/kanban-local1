-- A dependency joins two tasks in the same project ("no project" counts as one
-- project of its own). Without it a project-scoped board or critical path
-- would show a task waiting on one it cannot see.
--
-- Enforced both ways, because either end can move:
--   * adding an edge between tasks in different projects is refused;
--   * moving a task into a different project while an edge links it to a task
--     left behind is refused (unlink first, or let the form do it).
-- Edges written before this migration are not rewritten; they are checked the
-- next time either task's project changes.

CREATE OR REPLACE FUNCTION task_dependencies_project_guard() RETURNS trigger AS $$
DECLARE
	pred_project integer;
	succ_project integer;
BEGIN
	SELECT "project_id" INTO pred_project FROM "tasks" WHERE "id" = NEW."predecessor_id";
	SELECT "project_id" INTO succ_project FROM "tasks" WHERE "id" = NEW."successor_id";
	IF pred_project IS DISTINCT FROM succ_project THEN
		RAISE EXCEPTION 'dependency % -> % joins tasks in different projects', NEW."predecessor_id", NEW."successor_id"
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_dependencies_same_project" ON "task_dependencies";
--> statement-breakpoint
CREATE TRIGGER "task_dependencies_same_project"
	BEFORE INSERT ON "task_dependencies"
	FOR EACH ROW EXECUTE FUNCTION task_dependencies_project_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tasks_project_move_guard() RETURNS trigger AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "task_dependencies" d
		JOIN "tasks" other ON other."id" = CASE WHEN d."predecessor_id" = NEW."id" THEN d."successor_id" ELSE d."predecessor_id" END
		WHERE (d."predecessor_id" = NEW."id" OR d."successor_id" = NEW."id")
			AND other."project_id" IS DISTINCT FROM NEW."project_id"
	) THEN
		RAISE EXCEPTION 'task % has dependencies on tasks in another project; unlink them before moving it', NEW."id"
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "tasks_project_move_guard" ON "tasks";
--> statement-breakpoint
CREATE TRIGGER "tasks_project_move_guard"
	BEFORE UPDATE OF "project_id" ON "tasks"
	FOR EACH ROW
	WHEN (OLD."project_id" IS DISTINCT FROM NEW."project_id")
	EXECUTE FUNCTION tasks_project_move_guard();
