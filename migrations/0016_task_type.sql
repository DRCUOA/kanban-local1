-- Task type: a task is either a `goal` (the outcome, e.g. "build a shed") or a
-- `building-block` (work towards one, e.g. "buy some wood"). Null = unset, so
-- existing tasks are left alone rather than guessed at.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "type" text;
