ALTER TABLE "inbound_email_processing"
ADD COLUMN IF NOT EXISTS "created_task_ids" jsonb;
