-- Blank sub-stage tags predate the non-empty validation added in #95. They made
-- every tagged task match every sub-stage of a stage and crash the task editor's
-- sub-stage picker (a Radix SelectItem value must be a non-empty string).
-- Give each one a unique tag derived from its id.
UPDATE "sub_stages" SET "tag" = 'sub-stage-' || "id" WHERE btrim("tag") = '';
--> statement-breakpoint
-- The pre-#96 drag-drop code appended empty-string tags to tasks dropped on a
-- stage body. Strip them; jsonb_agg returns NULL when nothing remains, which
-- clears the column the same way the app does (tags: null).
UPDATE "tasks"
SET "tags" = (
  SELECT jsonb_agg(t)
  FROM jsonb_array_elements_text("tags") AS t
  WHERE t <> ''
)
WHERE "tags" @> '[""]'::jsonb;
