-- Where a lane's tasks print on the day sheet: 'now' (Do now), 'next' or
-- 'later'. Null = follow the column's kind (In Progress prints under Do now,
-- Backlog under Next, Waiting under Later; DAY_SHEET_SECTION_BY_KIND in
-- shared/constants.ts), so existing lanes need no backfill.
ALTER TABLE "sub_stages" ADD COLUMN IF NOT EXISTS "day_sheet_section" text;
--> statement-breakpoint
ALTER TABLE "sub_stages" DROP CONSTRAINT IF EXISTS "sub_stages_day_sheet_section_check";
--> statement-breakpoint
ALTER TABLE "sub_stages" ADD CONSTRAINT "sub_stages_day_sheet_section_check"
  CHECK ("day_sheet_section" IS NULL OR "day_sheet_section" IN ('now', 'next', 'later'));
