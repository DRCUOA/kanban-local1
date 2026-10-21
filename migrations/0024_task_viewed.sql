-- When a task was first opened, for the landing page's NEW TASKS row. Null =
-- new: the inbox turned mail into the task and nobody has opened it yet. The
-- default stamps every other way a task is made, and it fills the rows that
-- are already here, so the board starts with nothing new.
ALTER TABLE "tasks" ADD COLUMN "viewed_at" timestamp DEFAULT now();
